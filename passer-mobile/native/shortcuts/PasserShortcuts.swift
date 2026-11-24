import AppIntents

/// The actions ready to use from Siri, Spotlight and the Action Button, with no shortcut to build.
/// Phrases are keys of `AppShortcuts.xcstrings`; short titles are keys of `Localizable.xcstrings`.
struct PasserShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: SendClipboardToPCIntent(),
      phrases: [
        "Send clipboard with \(.applicationName)",
        "Send my clipboard to my PC with \(.applicationName)",
      ],
      shortTitle: "Send Clipboard",
      systemImageName: "doc.on.clipboard"
    )
    AppShortcut(
      intent: CopyPCClipboardIntent(),
      phrases: [
        "Copy PC clipboard with \(.applicationName)",
        "Paste from my PC with \(.applicationName)",
      ],
      shortTitle: "Copy PC Clipboard",
      systemImageName: "arrow.down.doc"
    )
    AppShortcut(
      intent: SendLatestScreenshotIntent(),
      phrases: ["Send latest screenshot with \(.applicationName)"],
      shortTitle: "Send Screenshot",
      systemImageName: "camera.viewfinder"
    )
    AppShortcut(
      intent: SendAndDeleteLatestScreenshotIntent(),
      phrases: ["Send and delete latest screenshot with \(.applicationName)"],
      shortTitle: "Send and Delete Screenshot",
      systemImageName: "trash"
    )
    AppShortcut(
      intent: CheckPCIntent(),
      phrases: ["Is my PC reachable with \(.applicationName)"],
      shortTitle: "Check PC",
      systemImageName: "laptopcomputer"
    )
  }
}
