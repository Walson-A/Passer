import AppIntents
import Foundation

/// What a widget or a control asks the app to do. Raw values are the names in
/// `src/core/app-actions.ts` and the `passer://action/<name>` links; change both sides together.
enum PasserAction: String, AppEnum {
  case sendClipboard = "send-clipboard"
  case pull
  case sendScreenshot = "send-screenshot"
  case sendAndDeleteScreenshot = "send-and-delete-screenshot"
  case sendPhoto = "send-photo"
  case sendFile = "send-file"

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Passer Action"
  static let caseDisplayRepresentations: [PasserAction: DisplayRepresentation] = [
    .sendClipboard: DisplayRepresentation(title: "Send Clipboard", image: .init(systemName: "doc.on.clipboard")),
    .pull: DisplayRepresentation(title: "Get PC Clipboard", image: .init(systemName: "arrow.down.doc")),
    .sendScreenshot: DisplayRepresentation(title: "Send Screenshot", image: .init(systemName: "camera.viewfinder")),
    .sendAndDeleteScreenshot: DisplayRepresentation(title: "Send and Delete Screenshot", image: .init(systemName: "trash")),
    .sendPhoto: DisplayRepresentation(title: "Send a Photo", image: .init(systemName: "photo")),
    .sendFile: DisplayRepresentation(title: "Send a File", image: .init(systemName: "doc")),
  ]

  /// The link a Home Screen or Lock Screen widget opens (`src/app/action/[name].tsx`).
  var url: URL {
    URL(string: "passer://action/\(rawValue)")!
  }
}

/// Brings Passer forward on an action, for the controls: iOS won't let a control open a
/// custom URL scheme. `openAppWhenRun` puts the app in front first, so `perform` runs in the
/// app, which leaves the action where its JavaScript looks (`src/platform/action-inbox.ts`).
/// The intent is compiled into the app and the widgets, as iOS requires to open the app.
struct OpenPasserActionIntent: AppIntent {
  static let title: LocalizedStringResource = "Open in Passer"
  static let openAppWhenRun = true
  static let isDiscoverable = false

  @Parameter(title: "Action")
  var action: PasserAction

  init() {}

  init(action: PasserAction) {
    self.action = action
  }

  func perform() async throws -> some IntentResult {
    PasserActionInbox.post(action)
    return .result()
  }
}

/// `passer-action.json` in the App Group: `{ "action": "send-clipboard", "at": 1757683200000 }`.
enum PasserActionInbox {
  /// Also in `app.config.ts`, `src/platform/app-group.ts` and `targets/share/_shared/PasserShared.swift`.
  static let appGroup = "group.direct.passer.app"

  static func post(_ action: PasserAction) {
    guard let folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return }
    let entry: [String: Any] = ["action": action.rawValue, "at": Int64(Date().timeIntervalSince1970 * 1000)]
    guard let data = try? JSONSerialization.data(withJSONObject: entry) else { return }
    try? data.write(to: folder.appendingPathComponent("passer-action.json"), options: .atomic)
  }
}
