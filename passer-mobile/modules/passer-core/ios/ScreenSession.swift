import AVFoundation
import CoreMedia
import ExpoModulesCore
import Foundation

/// Seeing (and controlling) another device's screen, as Vasistas shares it
/// (`docs/share.md` in the Vasistas repository): a stream of framed messages, JSON events
/// and H.264 video one way, JSON input the other. The video never crosses into JavaScript:
/// it is decoded here, by the system's hardware decoder, and drawn in `PasserScreenView`.
/// The stream itself is passer-core's (`PasserDevice.connectStream`, mobile-v0.4.0).

/// Every open session, by the id JavaScript gave it.
final class ScreenSessions: @unchecked Sendable {
  static let shared = ScreenSessions()
  private let lock = NSLock()
  private var sessions: [String: ScreenSession] = [:]

  func add(_ session: ScreenSession) {
    lock.lock()
    sessions[session.id] = session
    lock.unlock()
  }

  func get(_ id: String) -> ScreenSession? {
    lock.lock()
    defer { lock.unlock() }
    return sessions[id]
  }

  func remove(_ id: String) {
    lock.lock()
    let session = sessions.removeValue(forKey: id)
    lock.unlock()
    session?.close()
  }
}

/// What passer-core hands over, piece by piece and in order, from one of its own threads.
/// Pieces don't line up with Vasistas's frames: the session puts those back together.
final class ScreenSink: StreamSink, @unchecked Sendable {
  private weak var session: ScreenSession?

  init(_ session: ScreenSession) {
    self.session = session
  }

  func onData(bytes: Data) {
    session?.receive(bytes)
  }

  func onClosed(error: String?) {
    session?.streamClosed(error)
  }
}

final class ScreenSession: @unchecked Sendable {
  let id: String
  let renderer = H264Renderer()
  private let lock = NSLock()
  private var handle: StreamHandle?
  /// The viewer left (or never got a stream): a handle arriving late is cancelled at once.
  private var left = false
  /// The stream ended before `connectStream` returned its handle.
  private var endedEarly: String?? = nil
  private var buffer = Data()
  private let emit: (_ body: [String: Any?]) -> Void
  /// The viewer's input, sent one message after the other: a click's down never overtakes its up.
  private let outbox: AsyncStream<Data>.Continuation
  private let outgoing: AsyncStream<Data>

  init(id: String, emit: @escaping (_ body: [String: Any?]) -> Void) {
    self.id = id
    self.emit = emit
    (outgoing, outbox) = AsyncStream<Data>.makeStream()
    renderer.onNeedKeyframe = { [weak self] in
      self?.sendJson(#"{"type":"keyframe"}"#)
    }
  }

  /// The opened stream. Starts sending what the viewer queued meanwhile.
  func attach(_ handle: StreamHandle) {
    lock.lock()
    let gone = left
    let early = endedEarly
    if !gone { self.handle = handle }
    lock.unlock()
    if gone {
      Task { await handle.cancel() }
      return
    }
    let outgoing = self.outgoing
    Task {
      for await frame in outgoing {
        do { try await handle.send(bytes: frame) } catch { break }
      }
      // The viewer is done: end this side, so the PC sees it leave, then everything.
      await handle.close()
      try? await Task.sleep(nanoseconds: 3_000_000_000)
      await handle.cancel()
    }
    if let early { finish(handle, early) }
  }

  /// Bytes as they come off the stream: put frames back together, then route them.
  func receive(_ chunk: Data) {
    buffer.append(chunk)
    while buffer.count >= 5 {
      let start = buffer.startIndex
      let kind = buffer[start]
      let length = Int(buffer[start + 1]) | Int(buffer[start + 2]) << 8 | Int(buffer[start + 3]) << 16
        | Int(buffer[start + 4]) << 24
      guard buffer.count >= 5 + length else { break }
      let payload = buffer.subdata(in: (start + 5)..<(start + 5 + length))
      buffer.removeSubrange(start..<(start + 5 + length))
      switch kind {
      case 1:
        emit(["sessionId": id, "json": String(data: payload, encoding: .utf8) ?? ""])
      case 2:
        renderer.enqueue(frame: payload)
      case 3:
        emitPointerShape(payload)
      default:
        break
      }
    }
  }

  /// The PC stopped sending. Its final answer says why: `interrupted` when its user pressed
  /// stop or Escape, or a sensitive session reached its time limit.
  func streamClosed(_ error: String?) {
    lock.lock()
    let handle = self.handle
    if handle == nil { endedEarly = .some(error) }
    lock.unlock()
    if let handle { finish(handle, error) }
  }

  private func finish(_ handle: StreamHandle, _ error: String?) {
    let id = self.id
    let emit = self.emit
    Task {
      var code: String? = nil
      var message = error
      do {
        _ = try await handle.result()
      } catch let PasserError.Refused(refusal, detail) {
        code = refusal
        message = detail
      } catch {
        if message == nil { message = "\(error)" }
      }
      emit(["sessionId": id, "closed": true, "error": message, "code": code])
      ScreenSessions.shared.remove(id)
    }
  }

  /// A JSON message from the viewer, framed as kind 1, queued behind the ones before it.
  func sendJson(_ json: String) {
    let payload = Data(json.utf8)
    var frame = Data([1])
    var length = UInt32(payload.count).littleEndian
    frame.append(Data(bytes: &length, count: 4))
    frame.append(payload)
    outbox.yield(frame)
  }

  /// The viewer leaves: what it queued still goes (release_all first), then the stream ends.
  func close() {
    lock.lock()
    left = true
    lock.unlock()
    outbox.finish()
  }

  /// Width, height, hot spot x and y (four u16 LE), then straight RGBA.
  private func emitPointerShape(_ payload: Data) {
    guard payload.count >= 8 else { return }
    let start = payload.startIndex
    func u16(_ at: Int) -> Int { Int(payload[start + at]) | Int(payload[start + at + 1]) << 8 }
    let width = u16(0), height = u16(2)
    guard payload.count >= 8 + width * height * 4, width > 0, height > 0, width <= 256, height <= 256 else { return }
    emit([
      "sessionId": id,
      "shape": [
        "width": width, "height": height, "hotX": u16(4), "hotY": u16(6),
        "rgba": payload.subdata(in: (start + 8)..<(start + 8 + width * height * 4)).base64EncodedString(),
      ],
    ])
  }
}

/// H.264 (Annex B, SPS and PPS before each keyframe) into an `AVSampleBufferDisplayLayer`,
/// which decodes in hardware and shows each frame as soon as it arrives.
final class H264Renderer: @unchecked Sendable {
  let layer = AVSampleBufferDisplayLayer()
  var onNeedKeyframe: (() -> Void)?
  private var format: CMVideoFormatDescription?
  private var sps: Data?
  private var pps: Data?

  init() {
    layer.videoGravity = .resizeAspect
  }

  /// A video frame: 8 bytes of time, 1 byte (1: keyframe), then the NAL units.
  func enqueue(frame: Data) {
    guard frame.count > 9 else { return }
    let units = Self.nalUnits(frame.subdata(in: (frame.startIndex + 9)..<frame.endIndex))
    var picture: [Data] = []
    var parametersChanged = false
    for unit in units {
      guard let header = unit.first else { continue }
      switch header & 0x1F {
      case 7:
        if unit != sps { sps = unit; parametersChanged = true }
      case 8:
        if unit != pps { pps = unit; parametersChanged = true }
      default:
        picture.append(unit)
      }
    }
    if parametersChanged || format == nil { makeFormat() }
    guard let format, !picture.isEmpty, let sample = Self.sample(picture, format: format) else { return }
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      if self.layer.status == .failed {
        self.layer.flush()
        self.onNeedKeyframe?()
        return
      }
      self.layer.enqueue(sample)
    }
  }

  private func makeFormat() {
    guard let sps, let pps else { return }
    var description: CMVideoFormatDescription?
    let status = sps.withUnsafeBytes { spsBytes in
      pps.withUnsafeBytes { ppsBytes -> OSStatus in
        let pointers = [
          spsBytes.bindMemory(to: UInt8.self).baseAddress!,
          ppsBytes.bindMemory(to: UInt8.self).baseAddress!,
        ]
        let sizes = [sps.count, pps.count]
        return CMVideoFormatDescriptionCreateFromH264ParameterSets(
          allocator: kCFAllocatorDefault, parameterSetCount: 2, parameterSetPointers: pointers,
          parameterSetSizes: sizes, nalUnitHeaderLength: 4, formatDescriptionOut: &description)
      }
    }
    if status == noErr { format = description }
  }

  /// NAL units with 4-byte big-endian lengths (AVCC), in one sample shown at once.
  private static func sample(_ units: [Data], format: CMVideoFormatDescription) -> CMSampleBuffer? {
    var avcc = Data()
    for unit in units {
      var length = UInt32(unit.count).bigEndian
      avcc.append(Data(bytes: &length, count: 4))
      avcc.append(unit)
    }
    var block: CMBlockBuffer?
    guard
      CMBlockBufferCreateWithMemoryBlock(
        allocator: kCFAllocatorDefault, memoryBlock: nil, blockLength: avcc.count, blockAllocator: kCFAllocatorDefault,
        customBlockSource: nil, offsetToData: 0, dataLength: avcc.count, flags: 0, blockBufferOut: &block) == noErr,
      let block
    else { return nil }
    let copied = avcc.withUnsafeBytes { bytes in
      CMBlockBufferReplaceDataBytes(
        with: bytes.baseAddress!, blockBuffer: block, offsetIntoDestination: 0, dataLength: avcc.count)
    }
    guard copied == noErr else { return nil }
    var sample: CMSampleBuffer?
    var size = avcc.count
    guard
      CMSampleBufferCreateReady(
        allocator: kCFAllocatorDefault, dataBuffer: block, formatDescription: format, sampleCount: 1,
        sampleTimingEntryCount: 0, sampleTimingArray: nil, sampleSizeEntryCount: 1, sampleSizeArray: &size,
        sampleBufferOut: &sample) == noErr,
      let sample
    else { return nil }
    if let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: true),
      CFArrayGetCount(attachments) > 0
    {
      let dictionary = unsafeBitCast(CFArrayGetValueAtIndex(attachments, 0), to: CFMutableDictionary.self)
      CFDictionarySetValue(
        dictionary, Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(),
        Unmanaged.passUnretained(kCFBooleanTrue).toOpaque())
    }
    return sample
  }

  /// Splits Annex B on its start codes (00 00 01, or 00 00 00 01).
  static func nalUnits(_ data: Data) -> [Data] {
    let bytes = [UInt8](data)
    var units: [Data] = []
    var start: Int? = nil
    var index = 0
    while index + 2 < bytes.count {
      if bytes[index] == 0, bytes[index + 1] == 0, bytes[index + 2] == 1 {
        if let begin = start {
          var end = index
          if end > begin, bytes[end - 1] == 0 { end -= 1 }
          if end > begin { units.append(Data(bytes[begin..<end])) }
        }
        index += 3
        start = index
      } else {
        index += 1
      }
    }
    if let begin = start, begin < bytes.count { units.append(Data(bytes[begin..<bytes.count])) }
    return units
  }
}

/// Where a session's video is drawn. The layer fills the view, the video letterboxed inside.
public final class PasserScreenView: ExpoView {
  private var attached: CALayer?

  var sessionId: String = "" {
    didSet { attach() }
  }

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .black
    clipsToBounds = true
  }

  private func attach() {
    attached?.removeFromSuperlayer()
    guard let session = ScreenSessions.shared.get(sessionId) else { return }
    let layer = session.renderer.layer
    layer.frame = bounds
    self.layer.addSublayer(layer)
    attached = layer
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    attached?.frame = bounds
  }
}
