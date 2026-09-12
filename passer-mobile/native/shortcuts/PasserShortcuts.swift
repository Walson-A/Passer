import AppIntents

/// The actions ready to use from Siri, Spotlight and the Action Button, with no shortcut to build.
/// Phrases are keys of `AppShortcuts.xcstrings`, where the French lives.
struct PasserShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: SendClipboardToPCIntent(),
      phrases: [
        "Send clipboard with \(.applicationName)",
        "Send my clipboard to my PC with \(.applicationName)",
      ]
    )
    AppShortcut(
      intent: CopyPCClipboardIntent(),
      phrases: [
        "Copy PC clipboard with \(.applicationName)",
        "Paste from my PC with \(.applicationName)",
      ]
    )
    AppShortcut(
      intent: SendLatestScreenshotIntent(),
      phrases: ["Send latest screenshot with \(.applicationName)"]
    )
    AppShortcut(
      intent: SendAndDeleteLatestScreenshotIntent(),
      phrases: ["Send and delete latest screenshot with \(.applicationName)"]
    )
    AppShortcut(
      intent: CheckPCIntent(),
      phrases: ["Is my PC reachable with \(.applicationName)"]
    )
  }
}
