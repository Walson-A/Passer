import ExpoModulesCore
import Foundation
import Security
import UIKit

/// The Passer device network (passer-core) for the iPhone app.
///
/// Wraps the UniFFI bindings of `passer-ffi` (`passer_ffi.swift` and
/// `PasserFFI.xcframework`, fetched by `scripts/fetch-passer-core.mjs`). Every decision
/// about permissions, approvals and sessions is made by the Rust core; this file only
/// stores the key, forwards approval prompts to JavaScript and translates calls.
public class PasserCoreModule: Module {
  private var device: PasserDevice?
  private let prompts = PromptBook()

  public func definition() -> ModuleDefinition {
    Name("PasserCore")

    Events("onApprovalRequest", "onApprovalClosed", "onDeviceJoined", "onReceived", "onTransferProgress")

    AsyncFunction("open") { () async throws -> [String: Any?] in
      let device = try self.openDevice()
      return try await Self.status(device)
    }

    AsyncFunction("status") { () async throws -> [String: Any?] in
      try await Self.status(try self.openDevice())
    }

    AsyncFunction("createGroup") { (groupName: String, deviceName: String) async throws in
      try self.openDevice().createGroup(groupName: groupName, deviceName: deviceName)
    }

    AsyncFunction("join") { (link: String, deviceName: String) async throws -> [String: Any?] in
      let result = try await self.openDevice().join(link: link, deviceName: deviceName, network: .n0Dev)
      return ["groupName": result.groupName, "sas": result.sas]
    }

    AsyncFunction("start") { (coord: String?) async throws in
      try await self.openDevice().start(network: .n0Dev, coord: coord)
    }

    AsyncFunction("stop") { () async in
      await self.device?.stop()
    }

    AsyncFunction("invite") { (minutes: Int, asApprover: Bool) async throws -> String in
      try await self.openDevice().invite(minutes: UInt32(max(1, min(minutes, 15))), asApprover: asApprover).link
    }

    AsyncFunction("call") { (target: String, capability: String, inputJson: String) async throws -> String in
      try await self.openDevice().call(device: target, capability: capability, inputJson: inputJson)
    }

    AsyncFunction("removeDevice") { (id: String) async throws in
      try await self.openDevice().removeDevice(device: id)
    }

    AsyncFunction("stopAllSessions") { () async throws in
      try await self.openDevice().stopAllSessions()
    }

    AsyncFunction("sendFile") {
      (target: String, capability: String, inputJson: String, uri: String, transferId: String) async throws -> String in
      try await self.openDevice().sendFile(
        device: target, capability: capability, inputJson: inputJson,
        path: Self.filePath(uri), progress: ProgressRelay(module: self, id: transferId))
    }

    AsyncFunction("fetchFile") {
      (target: String, capability: String, inputJson: String, uri: String, transferId: String) async throws -> String in
      try await self.openDevice().fetchFile(
        device: target, capability: capability, inputJson: inputJson,
        destination: Self.filePath(uri), progress: ProgressRelay(module: self, id: transferId))
    }

    AsyncFunction("refreshMembers") { () async throws -> Int in
      Int(try await self.openDevice().refreshMembers())
    }

    AsyncFunction("memberCapabilities") { (id: String) throws -> [[String: Any?]] in
      try self.openDevice().memberCapabilities(device: id).map { c in
        [
          "name": c.name,
          "title": c.title,
          "description": c.description,
          "effect": Self.effectName(c.effect),
          "needsApproval": c.needsApproval,
        ]
      }
    }

    AsyncFunction("journal") { (limit: Int, id: String?) async throws -> [[String: Any?]] in
      try await self.openDevice()
        .journalRecent(limit: UInt32(max(1, min(limit, 200))), device: id)
        .map { e in
          [
            "seq": Double(e.seq),
            "at": Double(e.at),
            "outgoing": e.outgoing,
            "peerId": e.peerId,
            "peerShortId": String(e.peerId.prefix(10)),
            "peerName": e.peerName,
            "agent": e.agent,
            "capability": e.capability,
            "target": e.target,
            "decision": e.decision,
            "approved": e.approved,
            "outcome": e.outcome,
          ]
        }
    }

    Function("answerApproval") { (id: Int, allow: Bool) -> Bool in
      self.prompts.answer(id: id, allow: allow)
    }
  }

  /// Opens the device once: key from the Keychain, storage in Application Support.
  private func openDevice() throws -> PasserDevice {
    if let device { return device }
    let home = try FileManager.default
      .url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("passer-core", isDirectory: true)
    let device = try PasserDevice(home: home.path, vault: KeychainVault())
    // UIDevice belongs to the main thread; never wait on it from the main thread itself.
    let (idiom, systemVersion) = Thread.isMainThread
      ? (UIDevice.current.userInterfaceIdiom, UIDevice.current.systemVersion)
      : DispatchQueue.main.sync { (UIDevice.current.userInterfaceIdiom, UIDevice.current.systemVersion) }
    device.setDeviceDetails(
      kind: idiom == .pad ? .tablet : .phone,
      osVersion: systemVersion,
      appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    )
    device.setApprovalPrompter(prompter: JsPrompter(module: self, book: prompts))
    device.setAdmissionListener(listener: JoinRelay(module: self))
    // What other devices of the group can ask this phone. Declared before `start`, as
    // the core requires; the core's policy and approvals apply before any of it runs.
    device.addCapabilities(specs: PhoneCapabilities.specs, handler: PhoneCapabilities(module: self))
    self.device = device
    return device
  }

  private static func status(_ device: PasserDevice) async throws -> [String: Any?] {
    let members = (try? device.members()) ?? []
    return [
      "deviceId": device.deviceId(),
      "group": device.groupName(),
      "running": await device.isRunning(),
      "members": members.map { m in
        [
          "id": m.id,
          "shortId": String(m.id.prefix(10)),
          "name": m.name,
          "approver": m.approver,
          "thisDevice": m.thisDevice,
          "kind": Self.kindName(m.kind),
          "os": m.os,
          "osVersion": m.osVersion,
          "appVersion": m.appVersion,
          "coreVersion": m.coreVersion,
          "answeredAt": m.answeredAt.map { Double($0) },
        ] as [String: Any?]
      },
    ]
  }

  /// Expo hands file URIs (`file:///...`); the core wants paths.
  private static func filePath(_ uri: String) -> String {
    if let url = URL(string: uri), url.isFileURL { return url.path }
    return uri
  }

  private static func kindName(_ kind: DeviceKind) -> String {
    switch kind {
    case .phone: return "phone"
    case .tablet: return "tablet"
    case .laptop: return "laptop"
    case .desktop: return "desktop"
    case .unknown: return "unknown"
    }
  }

  private static func effectName(_ effect: EffectKind) -> String {
    switch effect {
    case .read: return "read"
    case .write: return "write"
    case .sensitive: return "sensitive"
    }
  }

  fileprivate func emit(_ name: String, _ body: [String: Any?]) {
    sendEvent(name, body)
  }
}

/// The device key in the Keychain: this device only, never synced, never in a backup,
/// readable after the first unlock (so the app can serve while the phone is locked).
final class KeychainVault: KeyVault, @unchecked Sendable {
  private let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "direct.passer.core",
    kSecAttrAccount as String: "device-key",
  ]

  func load() -> Data? {
    var q = query
    q[kSecReturnData as String] = true
    q[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess else { return nil }
    return item as? Data
  }

  func store(secret: Data) throws {
    var q = query
    q[kSecValueData as String] = secret
    q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    SecItemDelete(query as CFDictionary)
    let status = SecItemAdd(q as CFDictionary, nil)
    if status != errSecSuccess {
      throw PasserError.Storage(message: "Keychain error \(status)")
    }
  }
}

/// Approval prompts waiting for the user's answer in JavaScript.
final class PromptBook: @unchecked Sendable {
  private let lock = NSLock()
  private var next = 1
  private var waiting: [Int: CheckedContinuation<Bool, Never>] = [:]

  func open(_ continuation: CheckedContinuation<Bool, Never>) -> Int {
    lock.lock()
    defer { lock.unlock() }
    let id = next
    next += 1
    waiting[id] = continuation
    return id
  }

  @discardableResult
  func answer(id: Int, allow: Bool) -> Bool {
    lock.lock()
    let continuation = waiting.removeValue(forKey: id)
    lock.unlock()
    continuation?.resume(returning: allow)
    return continuation != nil
  }
}

/// Asks the user through the app's UI. No answer within 55 s means no (the core's own
/// limit is 60 s).
final class JsPrompter: ApprovalPrompter, @unchecked Sendable {
  private weak var module: PasserCoreModule?
  private let book: PromptBook

  init(module: PasserCoreModule, book: PromptBook) {
    self.module = module
    self.book = book
  }

  func ask(request: ApprovalInfo) async -> Bool {
    guard let module else { return false }
    let book = self.book
    var requestId = 0
    let allowed = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
      let id = book.open(continuation)
      requestId = id
      module.emit("onApprovalRequest", [
        "id": id,
        "requester": request.requesterName,
        "requesterId": String(request.requesterId.prefix(10)),
        "agent": request.agent,
        "title": request.title,
        "capability": request.capability,
        "target": request.target,
        "minutes": request.durationMinutes,
        "expiresInSecs": 55,
      ])
      Task {
        try? await Task.sleep(nanoseconds: 55_000_000_000)
        book.answer(id: id, allow: false)
      }
    }
    module.emit("onApprovalClosed", ["id": requestId])
    return allowed
  }
}

/// What this phone offers the other devices of its group: the same names, inputs and
/// limits as the PC (`passer-app/src-tauri/src/devices.rs`), so the desktop's "Send my
/// clipboard" and "Send a file" work towards the phone unchanged: text, small files in one
/// call (`file.receive`) and files of any size as a stream (`file.drop`). The node only
/// runs while the app is open, so all of it happens in front of the user.
final class PhoneCapabilities: CapabilityHandler, @unchecked Sendable {
  static let maxText = 200_000
  static let maxFileBytes = 700 * 1024

  static let specs: [CapabilitySpec] = [
    CapabilitySpec(
      name: "clipboard.write",
      title: "Put text on the phone clipboard",
      description: "Replaces the text on this phone's clipboard.",
      inputSchemaJson: #"{"type":"object","properties":{"text":{"type":"string","maxLength":200000}},"required":["text"],"additionalProperties":false}"#,
      effect: .write,
      targetKind: nil,
      indicatorRequired: false,
      stream: nil,
      maxBytes: nil
    ),
    CapabilitySpec(
      name: "file.receive",
      title: "Send a file to the phone",
      description: "Saves a small file (under 700 KB) in Passer on this phone.",
      inputSchemaJson: #"{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":255},"data_base64":{"type":"string","maxLength":955737}},"required":["name","data_base64"],"additionalProperties":false}"#,
      effect: .write,
      targetKind: nil,
      indicatorRequired: false,
      stream: nil,
      maxBytes: nil
    ),
    CapabilitySpec(
      name: "file.drop",
      title: "Drop a file on the phone",
      description: "Receives a file of any size, as a stream, in Passer on this phone.",
      inputSchemaJson: #"{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":255}},"required":["name"],"additionalProperties":false}"#,
      effect: .write,
      targetKind: nil,
      indicatorRequired: false,
      stream: .upload,
      maxBytes: nil
    ),
  ]

  private weak var module: PasserCoreModule?

  init(module: PasserCoreModule) {
    self.module = module
  }

  func invoke(capability: String, target: String?, inputJson: String, caller: CallerInfo) async throws -> String {
    let parsed = try? JSONSerialization.jsonObject(with: Data(inputJson.utf8))
    let input = parsed as? [String: Any] ?? [:]
    switch capability {
    case "clipboard.write":
      guard let text = input["text"] as? String else {
        throw PasserError.Invalid(message: "text is missing")
      }
      guard text.count <= Self.maxText else {
        throw PasserError.Invalid(message: "text too long")
      }
      await MainActor.run { UIPasteboard.general.string = text }
      module?.emit("onReceived", [
        "kind": "text",
        "text": String(text.prefix(160)),
        "from": caller.deviceName,
        "fromId": String(caller.deviceId.prefix(10)),
        "agent": caller.agent,
      ])
      return #"{"ok":true}"#

    case "file.receive":
      guard let encoded = input["data_base64"] as? String,
        let data = Data(base64Encoded: encoded, options: .ignoreUnknownCharacters)
      else {
        throw PasserError.Invalid(message: "data_base64 is not valid base64")
      }
      guard data.count <= Self.maxFileBytes else {
        throw PasserError.Invalid(message: "file too large for this version (700 KB maximum)")
      }
      let url = try Self.save(data, as: input["name"] as? String ?? "")
      module?.emit("onReceived", [
        "kind": "file",
        "name": url.lastPathComponent,
        "uri": url.absoluteString,
        "size": data.count,
        "from": caller.deviceName,
        "fromId": String(caller.deviceId.prefix(10)),
        "agent": caller.agent,
      ])
      return "{\"saved\":true,\"size\":\(data.count)}"

    default:
      throw PasserError.Invalid(message: "unknown capability \(capability)")
    }
  }

  /// `file.drop`: the whole file arrived in the core's private folder; move it into Passer.
  func receiveFile(capability: String, target: String?, inputJson: String, caller: CallerInfo, path: String) async throws -> String {
    guard capability == "file.drop" else {
      throw PasserError.Invalid(message: "unknown capability \(capability)")
    }
    let parsed = try? JSONSerialization.jsonObject(with: Data(inputJson.utf8))
    let name = (parsed as? [String: Any])?["name"] as? String ?? ""
    let url = try Self.destination(for: name)
    let size: Int
    do {
      try FileManager.default.moveItem(at: URL(fileURLWithPath: path), to: url)
      size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
    } catch {
      throw PasserError.Storage(message: error.localizedDescription)
    }
    module?.emit("onReceived", [
      "kind": "file",
      "name": url.lastPathComponent,
      "uri": url.absoluteString,
      "size": size,
      "from": caller.deviceName,
      "fromId": String(caller.deviceId.prefix(10)),
      "agent": caller.agent,
    ])
    return "{\"saved\":true,\"size\":\(size)}"
  }

  /// The phone offers no downloads.
  func provideFile(capability: String, target: String?, inputJson: String, caller: CallerInfo) async throws -> String {
    throw PasserError.Invalid(message: "unknown capability \(capability)")
  }

  /// Saves into Documents › Passer, which the Files app shows under On My iPhone › Passer.
  private static func save(_ data: Data, as rawName: String) throws -> URL {
    let url = try destination(for: rawName)
    do {
      try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    } catch {
      throw PasserError.Storage(message: error.localizedDescription)
    }
    return url
  }

  /// A free name in Documents › Passer. Like the PC, only the base name is kept, so a
  /// sender cannot write anywhere else.
  private static func destination(for rawName: String) throws -> URL {
    let base = (rawName as NSString).lastPathComponent
    let name = (base.isEmpty || base == "." || base == "..") ? "received_file" : base
    let folder = try FileManager.default
      .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("Passer", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    var url = folder.appendingPathComponent(name)
    let stem = (name as NSString).deletingPathExtension
    let ext = (name as NSString).pathExtension
    var copy = 2
    while FileManager.default.fileExists(atPath: url.path) {
      url = folder.appendingPathComponent(ext.isEmpty ? "\(stem) \(copy)" : "\(stem) \(copy).\(ext)")
      copy += 1
    }
    return url
  }
}

/// Forwards a transfer's progress to JavaScript.
final class ProgressRelay: TransferProgress, @unchecked Sendable {
  private weak var module: PasserCoreModule?
  private let id: String

  init(module: PasserCoreModule, id: String) {
    self.module = module
    self.id = id
  }

  func progress(done: UInt64, total: UInt64?) {
    module?.emit("onTransferProgress", ["id": id, "done": Double(done), "total": total.map { Double($0) }])
  }
}

/// Tells JavaScript that a device joined through one of this phone's invitations.
final class JoinRelay: AdmissionListener, @unchecked Sendable {
  private weak var module: PasserCoreModule?

  init(module: PasserCoreModule) {
    self.module = module
  }

  func admitted(deviceId: String, deviceName: String, sas: String) {
    module?.emit("onDeviceJoined", ["name": deviceName, "id": String(deviceId.prefix(10)), "sas": sas])
  }
}
