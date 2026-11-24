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

    Events("onApprovalRequest", "onApprovalClosed", "onDeviceJoined")

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
