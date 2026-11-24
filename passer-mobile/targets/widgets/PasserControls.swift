import AppIntents
import SwiftUI
import WidgetKit

// The Control Center, Lock Screen and Action Button controls. Each opens Passer on its
// action through `OpenPasserActionIntent`, since a control can't open a custom URL scheme.
// Kinds are permanent: iOS keeps the controls people placed by them.

@available(iOS 18.0, *)
private func passerControl(_ action: PasserAction) -> some ControlWidgetConfiguration {
  StaticControlConfiguration(kind: "direct.passer.app.control.\(action.rawValue)") {
    ControlWidgetButton(action: OpenPasserActionIntent(action: action)) {
      Label {
        Text(action.title)
      } icon: {
        Image(systemName: action.symbol)
      }
    }
  }
  .displayName(action.title)
  .description(action.controlDescription)
}

@available(iOS 18.0, *)
struct SendClipboardControl: ControlWidget {
  var body: some ControlWidgetConfiguration { passerControl(.sendClipboard) }
}

@available(iOS 18.0, *)
struct PullControl: ControlWidget {
  var body: some ControlWidgetConfiguration { passerControl(.pull) }
}

@available(iOS 18.0, *)
struct SendScreenshotControl: ControlWidget {
  var body: some ControlWidgetConfiguration { passerControl(.sendScreenshot) }
}

@available(iOS 18.0, *)
struct SendAndDeleteScreenshotControl: ControlWidget {
  var body: some ControlWidgetConfiguration { passerControl(.sendAndDeleteScreenshot) }
}

@available(iOS 18.0, *)
struct SendPhotoControl: ControlWidget {
  var body: some ControlWidgetConfiguration { passerControl(.sendPhoto) }
}

@available(iOS 18.0, *)
struct SendFileControl: ControlWidget {
  var body: some ControlWidgetConfiguration { passerControl(.sendFile) }
}
