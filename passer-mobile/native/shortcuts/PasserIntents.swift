import AppIntents
import Foundation
import UIKit
import UniformTypeIdentifiers

// The Shortcuts actions. They run in the app's process, in the background, and talk to
// the PC through `targets/share/_shared` like the share extension does. Titles, descriptions
// and parameter names are keys of `Localizable.xcstrings`; keep the French there in step.

/// A failure Shortcuts and Siri show as it is.
struct PasserIntentError: Error, CustomLocalizedStringResourceConvertible {
  let message: String

  var localizedStringResource: LocalizedStringResource { "\(message)" }
}

/// Where files go on the PC.
enum PCDestination: String, AppEnum {
  case automatic
  case clipboard
  case passboard

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Destination"
  static let caseDisplayRepresentations: [PCDestination: DisplayRepresentation] = [
    .automatic: "Automatic",
    .clipboard: "PC Clipboard",
    .passboard: "Passboard",
  ]
}

enum IntentRun {
  static func connect() async throws -> PasserClient {
    do {
      return try await PasserClient.connect()
    } catch {
      throw fail(error)
    }
  }

  static func fail(_ error: Error) -> PasserIntentError {
    if let intentError = error as? PasserIntentError { return intentError }
    return PasserIntentError(
      message: PasserText.failure(PasserClient.failure(from: error), pcName: PasserShared.currentPC()?.name)
    )
  }

  static func record(
    _ client: PasserClient,
    direction: String = "sent",
    kind: String,
    destination: String,
    title: String,
    size: Int64?
  ) {
    PasserShared.record(.init(pc: client.pc, direction: direction, kind: kind, destination: destination, title: title, size: size))
  }

  /// Copies a file handed over by Shortcuts where Passer can send it from.
  static func stage(_ file: IntentFile) throws -> SharedFile {
    let name = PasserFiles.safeName(file.filename, fallback: "Passer \(PasserClient.timestamp())")
    let url = try PasserFiles.stagingFolder().appendingPathComponent(name)
    if let source = file.fileURL {
      let scoped = source.startAccessingSecurityScopedResource()
      defer { if scoped { source.stopAccessingSecurityScopedResource() } }
      try FileManager.default.copyItem(at: source, to: url)
    } else {
      try file.data.write(to: url)
    }
    return SharedFile.describe(url, name: name, type: file.type)
  }

  /// Sends files as the app does: one image to the PC clipboard, or everything to the Passboard folder.
  static func send(_ files: [SharedFile], to destination: PCDestination, with client: PasserClient) async throws {
    guard let first = files.first else { throw PasserIntentError(message: IntentText.nothingToSend) }
    let toClipboard: Bool
    switch destination {
    case .clipboard:
      guard first.isImage else { throw PasserIntentError(message: IntentText.clipboardOnlyImages) }
      toClipboard = true
    case .passboard:
      toClipboard = false
    case .automatic:
      toClipboard = files.count == 1 && first.isImage
    }

    do {
      if toClipboard {
        // The PC clipboard holds one image: the first one goes.
        let image = try ImageConversion.forClipboard(first)
        try await client.push(file: image.url, name: image.name, mimeType: image.mimeType, to: .clipboard)
        record(client, kind: "image", destination: "pc-clipboard", title: first.name, size: image.size)
      } else {
        for file in files {
          try await client.push(file: file.url, name: file.name, mimeType: file.mimeType, to: .passboard)
        }
        let allImages = files.allSatisfy(\.isImage)
        record(
          client,
          kind: files.count > 1 ? "files" : (first.isImage ? "image" : "file"),
          destination: "passboard",
          title: files.count > 1 ? (allImages ? PasserText.photos(files.count) : PasserText.files(files.count)) : first.name,
          size: PasserFiles.totalSize(files)
        )
      }
    } catch let error as PasserIntentError {
      throw error
    } catch {
      throw fail(error)
    }
  }

  static func pull(with client: PasserClient) async throws -> PullResult {
    do {
      return try await client.pull()
    } catch {
      throw fail(error)
    }
  }
}

// MARK: - Sending

struct SendTextToPCIntent: AppIntent {
  static let title: LocalizedStringResource = "Send Text to PC"
  static let description = IntentDescription("Puts text on your PC's clipboard, ready to paste.")

  @Parameter(title: "Text", inputConnectionBehavior: .connectToPreviousIntentResult)
  var text: String

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard !text.isEmpty else { throw PasserIntentError(message: IntentText.nothingToSend) }
    let client = try await IntentRun.connect()
    do {
      try await client.pushText(text)
    } catch {
      throw IntentRun.fail(error)
    }
    IntentRun.record(client, kind: "text", destination: "pc-clipboard", title: text, size: nil)
    return .result(dialog: "\(PasserText.sent(to: client.pc.name))")
  }
}

struct SendFilesToPCIntent: AppIntent {
  static let title: LocalizedStringResource = "Send Files to PC"
  static let description = IntentDescription(
    "Sends photos or files to your PC: one image to its clipboard, anything else to the Passboard folder."
  )

  // Restricting content types or connecting to the previous result needs iOS 18; the app runs from iOS 17.
  @Parameter(title: "Files")
  var files: [IntentFile]

  @Parameter(title: "Destination", default: .automatic)
  var destination: PCDestination

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let client = try await IntentRun.connect()
    let staged = try files.map(IntentRun.stage)
    try await IntentRun.send(staged, to: destination, with: client)
    return .result(dialog: "\(PasserText.sent(to: client.pc.name))")
  }
}

struct SendClipboardToPCIntent: AppIntent {
  static let title: LocalizedStringResource = "Send Clipboard to PC"
  static let description = IntentDescription(
    "Sends what you copied on this iPhone to your PC's clipboard. iOS may ask you to allow pasting."
  )

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    let pasteboard = UIPasteboard.general
    if pasteboard.hasImages, let image = pasteboard.image, let png = image.pngData() {
      let name = "Passer \(PasserClient.timestamp()).png"
      let url = try PasserFiles.stagingFolder().appendingPathComponent(name)
      try png.write(to: url)
      let client = try await IntentRun.connect()
      do {
        try await client.push(file: url, name: name, mimeType: "image/png", to: .clipboard)
      } catch {
        throw IntentRun.fail(error)
      }
      IntentRun.record(client, kind: "image", destination: "pc-clipboard", title: IntentText.pastedImage, size: Int64(png.count))
      return .result(dialog: "\(PasserText.sent(to: client.pc.name))")
    }

    guard let text = pasteboard.string ?? pasteboard.url?.absoluteString, !text.isEmpty else {
      throw PasserIntentError(message: IntentText.iphoneClipboardUnavailable)
    }
    let client = try await IntentRun.connect()
    do {
      try await client.pushText(text)
    } catch {
      throw IntentRun.fail(error)
    }
    IntentRun.record(client, kind: "text", destination: "pc-clipboard", title: text, size: nil)
    return .result(dialog: "\(PasserText.sent(to: client.pc.name))")
  }
}

struct SendLatestScreenshotIntent: AppIntent {
  static let title: LocalizedStringResource = "Send Latest Screenshot to PC"
  static let description = IntentDescription(
    "Sends your latest screenshot to your PC, by default to its clipboard, ready to paste."
  )

  @Parameter(title: "Destination", default: .clipboard)
  var destination: PCDestination

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let message = try await PhotoSending.send(screenshotsOnly: true, count: 1, destination: destination, deleteAfter: false)
    return .result(dialog: "\(message)")
  }
}

struct SendAndDeleteLatestScreenshotIntent: AppIntent {
  static let title: LocalizedStringResource = "Send and Delete Latest Screenshot"
  static let description = IntentDescription(
    "Sends your latest screenshot to your PC, then deletes it from the photo library. iOS asks you to confirm the deletion."
  )

  @Parameter(title: "Destination", default: .clipboard)
  var destination: PCDestination

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let message = try await PhotoSending.send(screenshotsOnly: true, count: 1, destination: destination, deleteAfter: true)
    return .result(dialog: "\(message)")
  }
}

struct SendLatestPhotosToPCIntent: AppIntent {
  static let title: LocalizedStringResource = "Send Latest Photos to PC"
  static let description = IntentDescription(
    "Sends your most recent photos to your PC: one to its clipboard, several to the Passboard folder."
  )

  @Parameter(title: "Number of Photos", default: 1)
  var count: Int

  @Parameter(title: "Destination", default: .automatic)
  var destination: PCDestination

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let message = try await PhotoSending.send(screenshotsOnly: false, count: count, destination: destination, deleteAfter: false)
    return .result(dialog: "\(message)")
  }
}

enum PhotoSending {
  static func send(screenshotsOnly: Bool, count: Int, destination: PCDestination, deleteAfter: Bool) async throws -> String {
    try PasserPhotos.requireAccess()
    let assets = PasserPhotos.latest(screenshotsOnly: screenshotsOnly, limit: max(1, min(count, 50)))
    guard !assets.isEmpty else {
      throw PasserIntentError(message: screenshotsOnly ? IntentText.noScreenshot : IntentText.noPhoto)
    }
    // Find the PC before exporting: a photo may have to come down from iCloud first.
    let client = try await IntentRun.connect()
    var files: [SharedFile] = []
    for asset in assets {
      do {
        files.append(try await PasserPhotos.export(asset))
      } catch let error as PasserIntentError {
        throw error
      } catch {
        throw PasserIntentError(message: IntentText.noPhoto)
      }
    }
    try await IntentRun.send(files, to: destination, with: client)
    guard deleteAfter else { return PasserText.sent(to: client.pc.name) }
    return await PasserPhotos.delete(assets) ? IntentText.sentAndDeleted(client.pc.name) : IntentText.sentNotDeleted(client.pc.name)
  }
}

// MARK: - Receiving

struct GetTextFromPCIntent: AppIntent {
  static let title: LocalizedStringResource = "Get Text from PC"
  static let description = IntentDescription("Reads the text on your PC's clipboard, for the next action.")

  func perform() async throws -> some IntentResult & ReturnsValue<String> {
    let client = try await IntentRun.connect()
    switch try await IntentRun.pull(with: client) {
    case .text(let text):
      guard !text.isEmpty else { throw PasserIntentError(message: PasserText.pcClipboardEmpty) }
      return .result(value: text)
    case .image(let url):
      try? FileManager.default.removeItem(at: url)
      throw PasserIntentError(message: IntentText.pcHasImage)
    case .files(let url):
      try? FileManager.default.removeItem(at: url)
      throw PasserIntentError(message: IntentText.pcHasFiles)
    }
  }
}

struct GetFilesFromPCIntent: AppIntent {
  static let title: LocalizedStringResource = "Get Files from PC"
  static let description = IntentDescription("Reads the image or the files copied on your PC, for the next action.")

  func perform() async throws -> some IntentResult & ReturnsValue<[IntentFile]> {
    let client = try await IntentRun.connect()
    switch try await IntentRun.pull(with: client) {
    case .text:
      throw PasserIntentError(message: IntentText.pcHasText)
    case .image(let url), .files(let url):
      defer { try? FileManager.default.removeItem(at: url) }
      // Returned as data: files returned by URL can be deleted before the next action reads them.
      let data = try Data(contentsOf: url)
      let type: UTType = url.pathExtension == "png" ? .png : .zip
      return .result(value: [IntentFile(data: data, filename: url.lastPathComponent, type: type)])
    }
  }
}

struct CopyPCClipboardIntent: AppIntent {
  static let title: LocalizedStringResource = "Copy PC Clipboard"
  static let description = IntentDescription("Copies your PC's clipboard to this iPhone, ready to paste.")

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    let client = try await IntentRun.connect()
    switch try await IntentRun.pull(with: client) {
    case .text(let text):
      guard !text.isEmpty else { throw PasserIntentError(message: PasserText.pcClipboardEmpty) }
      UIPasteboard.general.string = text
      IntentRun.record(client, direction: "received", kind: "text", destination: "iphone-clipboard", title: text, size: nil)
    case .image(let url):
      defer { try? FileManager.default.removeItem(at: url) }
      guard let image = UIImage(contentsOfFile: url.path) else {
        throw PasserIntentError(message: PasserText.failure(.badResponse, pcName: client.pc.name))
      }
      UIPasteboard.general.image = image
      let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).map { Int64($0) }
      IntentRun.record(client, direction: "received", kind: "image", destination: "iphone-clipboard", title: IntentText.imageFromPC, size: size)
    case .files(let url):
      try? FileManager.default.removeItem(at: url)
      throw PasserIntentError(message: IntentText.pcHasFiles)
    }
    return .result(dialog: "\(PasserText.received(from: client.pc.name))")
  }
}

// MARK: - Checking

struct CheckPCIntent: AppIntent {
  static let title: LocalizedStringResource = "Is PC Reachable"
  static let description = IntentDescription(
    "Checks that your paired PC answers on this network, for example to run an automation only at home."
  )

  func perform() async throws -> some IntentResult & ReturnsValue<Bool> & ProvidesDialog {
    do {
      let client = try await PasserClient.connect()
      return .result(value: true, dialog: "\(IntentText.reachable(client.pc.name))")
    } catch {
      let message = PasserText.failure(PasserClient.failure(from: error), pcName: PasserShared.currentPC()?.name)
      return .result(value: false, dialog: "\(message)")
    }
  }
}
