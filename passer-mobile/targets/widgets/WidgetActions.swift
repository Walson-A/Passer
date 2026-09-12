import Foundation

/// How the widgets present each action. Titles are keys of this extension's `Localizable.xcstrings`.
extension PasserAction {
  var title: LocalizedStringResource {
    switch self {
    case .sendClipboard: "Send Clipboard"
    case .pull: "Get PC Clipboard"
    case .sendScreenshot: "Send Screenshot"
    case .sendAndDeleteScreenshot: "Send and Delete Screenshot"
    case .sendPhoto: "Send a Photo"
    case .sendFile: "Send a File"
    }
  }

  /// The label under a launch pad button, as on the app's Home.
  var shortTitle: LocalizedStringResource {
    switch self {
    case .sendClipboard: "Paste"
    case .pull: "From PC"
    case .sendScreenshot, .sendAndDeleteScreenshot: "Screenshot"
    case .sendPhoto: "Photo"
    case .sendFile: "File"
    }
  }

  /// SF Symbols, as in `caseDisplayRepresentations` and the app's Siri shortcuts.
  var symbol: String {
    switch self {
    case .sendClipboard: "doc.on.clipboard"
    case .pull: "arrow.down.doc"
    case .sendScreenshot: "camera.viewfinder"
    case .sendAndDeleteScreenshot: "trash"
    case .sendPhoto: "photo"
    case .sendFile: "doc"
    }
  }

  /// What a control does, as the Control Center gallery describes it.
  var controlDescription: LocalizedStringResource {
    switch self {
    case .sendClipboard: "Opens Passer and sends what you copied to your PC's clipboard."
    case .pull: "Opens Passer and copies your PC's clipboard to this iPhone."
    case .sendScreenshot: "Opens Passer and sends your latest screenshot to your PC's clipboard."
    case .sendAndDeleteScreenshot: "Opens Passer, sends your latest screenshot to your PC, then deletes it."
    case .sendPhoto: "Opens Passer on your photos, to send some to your PC."
    case .sendFile: "Opens Passer on your files, to send some to your PC."
    }
  }
}

/// The paired PC's name, from `passer-state.json` (`src/platform/shared-state.ts`). The token is never read here.
enum PairedPCName {
  private struct State: Decodable {
    let pcs: [PC]
  }

  private struct PC: Decodable {
    let name: String
  }

  static func load() -> String? {
    guard
      let folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: PasserActionInbox.appGroup),
      let data = try? Data(contentsOf: folder.appendingPathComponent("passer-state.json")),
      let state = try? JSONDecoder().decode(State.self, from: data)
    else { return nil }
    return state.pcs.first?.name
  }
}
