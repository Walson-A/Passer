import Foundation
import Security

/// What the share extension and the Shortcuts actions share with the app.
///
/// The app mirrors the paired PCs into `passer-state.json` in the App Group
/// container, and keeps each pairing token in the App Group's keychain group
/// (`src/platform/shared-state.ts`, `src/platform/secrets.ts`). Code here only
/// reads them, and appends the transfers it makes to `passer-outbox.json` so the
/// app can show them in its history. Contract: `docs/mobile/extensions.md`.
enum PasserShared {
  static let appGroup = "group.direct.passer.app"

  struct PairedPC: Codable, Sendable {
    let key: String
    let id: String?
    let name: String
    let host: String?
    let ip: String?
    let port: Int
    /// `host` or `ip`: the address that answered last.
    let preferredAddress: String
  }

  struct State: Codable, Sendable {
    let version: Int
    let language: String
    /// `clipboard`, `passboard`, or nil to ask.
    let photoDestination: String?
    let pcs: [PairedPC]
  }

  static var containerURL: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
  }

  static func loadState() -> State? {
    guard let url = containerURL?.appendingPathComponent("passer-state.json"),
          let data = try? Data(contentsOf: url)
    else { return nil }
    return try? JSONDecoder().decode(State.self, from: data)
  }

  /// The app talks to one PC at a time: the first of the list.
  static func currentPC() -> PairedPC? {
    loadState()?.pcs.first
  }

  /// The app's language, so everything outside the app speaks the same one. Falls back to the device's.
  static var isFrench: Bool {
    if let language = loadState()?.language { return language == "fr" }
    return Locale.preferredLanguages.first?.hasPrefix("fr") ?? false
  }

  /// Reads the token exactly where expo-secure-store saved it: a generic password in
  /// service `app:no-auth`, keyed by the UTF-8 bytes of `passer.token.<key>`.
  static func token(for pc: PairedPC) -> String? {
    let sanitizedKey = pc.key.replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "_", options: .regularExpression)
    let encodedKey = Data("passer.token.\(sanitizedKey)".utf8)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "app:no-auth",
      kSecAttrGeneric as String: encodedKey,
      kSecAttrAccount as String: encodedKey,
      kSecAttrAccessGroup as String: appGroup,
      kSecMatchLimit as String: kSecMatchLimitOne,
      kSecReturnData as String: true,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
          let data = item as? Data
    else { return nil }
    return String(data: data, encoding: .utf8)
  }

  /// A transfer, with the values of `HistoryItem` in `src/state/history.tsx`.
  struct OutboxEntry: Codable, Sendable {
    let pcKey: String
    /// `sent` or `received`.
    let direction: String
    /// `text`, `image`, `file` or `files`.
    let kind: String
    /// `pc-clipboard`, `passboard`, `iphone-clipboard`, `photos` or `files`.
    let destination: String
    let title: String
    let size: Int64?
    /// Milliseconds since 1970.
    let at: Int64

    init(pc: PairedPC, direction: String, kind: String, destination: String, title: String, size: Int64?) {
      self.pcKey = pc.key
      self.direction = direction
      self.kind = kind
      self.destination = destination
      self.title = String(title.prefix(160))
      self.size = size
      self.at = Int64(Date().timeIntervalSince1970 * 1000)
    }
  }

  /// Adds a transfer to the list the app merges into its history when it next comes to the front.
  static func record(_ entry: OutboxEntry) {
    guard let url = containerURL?.appendingPathComponent("passer-outbox.json") else { return }
    var coordinationError: NSError?
    NSFileCoordinator().coordinate(writingItemAt: url, options: .forMerging, error: &coordinationError) { url in
      var entries = (try? JSONDecoder().decode([OutboxEntry].self, from: Data(contentsOf: url))) ?? []
      entries.append(entry)
      // The app keeps 50 items; holding more would only be thrown away.
      if entries.count > 50 { entries.removeFirst(entries.count - 50) }
      try? JSONEncoder().encode(entries).write(to: url, options: .atomic)
    }
  }
}
