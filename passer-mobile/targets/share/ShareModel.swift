import Foundation
import UIKit

/// The share sheet's flow: read what was shared and find the PC at the same time,
/// then send, straight away or once a photo's destination is chosen.
@MainActor
final class ShareModel: ObservableObject {
  enum Connection: Equatable {
    case searching
    case online(address: String)
    case failed(PasserFailure)
  }

  enum Phase: Equatable {
    case reading
    /// A photo can go to the PC clipboard or the Passboard folder.
    case choosing
    /// 0...1, or nil while the size is unknown.
    case sending(Double?)
    case sent
    case failed(PasserFailure)
    case nothingToSend
  }

  @Published private(set) var content: SharedContent?
  @Published private(set) var connection: Connection = .searching
  @Published private(set) var phase: Phase = .reading
  @Published private(set) var sendingTo: PushDestination = .passboard
  let pcName: String?

  private let items: [NSExtensionItem]
  private let onFinish: () -> Void
  private let onCancel: () -> Void
  private var client: PasserClient?
  private var work: Task<Void, Never>?

  init(items: [NSExtensionItem], onFinish: @escaping () -> Void, onCancel: @escaping () -> Void) {
    self.items = items
    self.onFinish = onFinish
    self.onCancel = onCancel
    self.pcName = PasserShared.currentPC()?.name
  }

  func start() {
    guard work == nil else { return }
    work = Task {
      async let loaded = SharedContent.load(from: items)
      await connect()
      content = await loaded
      proceed()
    }
  }

  func retry() {
    work?.cancel()
    phase = .reading
    connection = .searching
    work = Task {
      await connect()
      proceed()
    }
  }

  /// Sends a photo where the person chose.
  func choose(_ destination: PushDestination) {
    send(to: destination)
  }

  func cancel() {
    work?.cancel()
    onCancel()
  }

  func close() {
    onCancel()
  }

  // MARK: Flow

  private func connect() async {
    connection = .searching
    do {
      let client = try await PasserClient.connect()
      self.client = client
      connection = .online(address: client.baseURL.host ?? "")
    } catch {
      connection = .failed(PasserClient.failure(from: error))
    }
  }

  private func proceed() {
    guard let content else {
      phase = .nothingToSend
      return
    }
    if case .failed(let failure) = connection {
      phase = .failed(failure)
      announce(PasserText.failure(failure, pcName: pcName))
      return
    }
    switch content {
    case .text, .link:
      send(to: .clipboard)
    case .files:
      send(to: .passboard)
    case .images:
      // The choice the app remembers applies here too.
      switch PasserShared.loadState()?.photoDestination {
      case "clipboard": send(to: .clipboard)
      case "passboard": send(to: .passboard)
      default: phase = .choosing
      }
    }
  }

  private func send(to destination: PushDestination) {
    guard let client, let content else { return }
    sendingTo = destination
    phase = .sending(nil)
    work = Task {
      do {
        switch content {
        case .text(let text):
          try await client.pushText(text)
          record(client, kind: "text", destination: "pc-clipboard", title: text, size: nil)
        case .link(let url):
          try await client.pushText(url.absoluteString)
          record(client, kind: "text", destination: "pc-clipboard", title: url.absoluteString, size: nil)
        case .images(let files) where destination == .clipboard:
          // The PC clipboard holds one image: the first one goes.
          let image = try ImageConversion.forClipboard(files[0])
          try await upload([image], to: .clipboard, with: client)
          record(client, kind: "image", destination: "pc-clipboard", title: files[0].name, size: image.size)
        case .images(let files):
          try await upload(files, to: .passboard, with: client)
          record(
            client,
            kind: files.count > 1 ? "files" : "image",
            destination: "passboard",
            title: files.count > 1 ? ShareText.photos(files.count) : files[0].name,
            size: Self.totalSize(files)
          )
        case .files(let files):
          try await upload(files, to: .passboard, with: client)
          record(
            client,
            kind: files.count > 1 ? "files" : "file",
            destination: "passboard",
            title: files.count > 1 ? ShareText.files(files.count) : files[0].name,
            size: Self.totalSize(files)
          )
        }
        phase = .sent
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        announce(PasserText.sent(to: client.pc.name))
        try? await Task.sleep(nanoseconds: 1_100_000_000)
        onFinish()
      } catch {
        let failure = PasserClient.failure(from: error)
        guard failure != .cancelled else { return }
        phase = .failed(failure)
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        announce(PasserText.failure(failure, pcName: pcName))
      }
    }
  }

  /// Uploads files one after the other, with progress across the whole batch.
  private func upload(_ files: [SharedFile], to destination: PushDestination, with client: PasserClient) async throws {
    let total = Self.totalSize(files) ?? 0
    var done: Int64 = 0
    for file in files {
      try Task.checkCancellation()
      let before = done
      let size = file.size ?? 0
      try await client.push(file: file.url, name: file.name, mimeType: file.mimeType, to: destination) { [weak self] fraction in
        Task { @MainActor in
          guard let self, total > 0 else { return }
          self.phase = .sending(min(1, (Double(before) + Double(size) * fraction) / Double(total)))
        }
      }
      done += size
    }
  }

  private func record(_ client: PasserClient, kind: String, destination: String, title: String, size: Int64?) {
    PasserShared.record(.init(pc: client.pc, direction: "sent", kind: kind, destination: destination, title: title, size: size))
  }

  private func announce(_ message: String) {
    UIAccessibility.post(notification: .announcement, argument: message)
  }

  static func totalSize(_ files: [SharedFile]) -> Int64? {
    PasserFiles.totalSize(files)
  }
}
