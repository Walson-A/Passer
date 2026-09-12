import Foundation

/// How a transfer can fail, as `PasserErrorKind` in `src/core/errors.ts`.
enum PasserFailure: Error, Sendable {
  case notPaired
  case unreachable
  case unauthorized
  case wrongPC
  case notPasser
  case rejected
  case pcFailed
  case badResponse
  case cancelled
}

/// `GET /ping`. `name`, `mdns` and `id` are missing on older desktops.
struct PingInfo: Decodable, Sendable {
  let app: String
  let version: String?
  let host: String?
  let name: String?
  let mdns: String?
  let id: String?
}

enum PullResult: Sendable {
  case text(String)
  /// A PNG, in a temporary file.
  case image(URL)
  /// A ZIP of the files copied on the PC, in a temporary file.
  case files(URL)
}

enum PushDestination: Sendable {
  /// `/push/image`: the PC clipboard. Images only, and the PC decodes PNG and JPEG, not HEIC.
  case clipboard
  /// `/push/file`: the Passboard folder.
  case passboard
}

/// Talks to the paired PC like the app does: `src/core/endpoint.ts` finds it and
/// checks it is the right machine before the token is ever sent, and
/// `src/core/client.ts` reads the desktop's answers. Change both sides together.
struct PasserClient: Sendable {
  let pc: PasserShared.PairedPC
  let token: String
  let baseURL: URL

  static let tokenHeader = "X-Passer-Token"

  private static let session: URLSession = {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.waitsForConnectivity = false
    configuration.timeoutIntervalForRequest = 15
    return URLSession(configuration: configuration)
  }()

  /// Finds the paired PC and loads its token.
  static func connect() async throws -> PasserClient {
    guard let pc = PasserShared.currentPC(), let token = PasserShared.token(for: pc) else {
      throw PasserFailure.notPaired
    }
    let baseURL = try await locate(pc)
    return PasserClient(pc: pc, token: token, baseURL: baseURL)
  }

  // MARK: Finding the PC

  /// The preferred address first, the others 350 ms apart; the first verified answer wins.
  static func locate(_ pc: PasserShared.PairedPC) async throws -> URL {
    let host = pc.host.map { (address: $0, timeout: 2.5) }
    let ip = pc.ip.map { (address: $0, timeout: 1.5) }
    // The bare machine name: away from home, Tailscale's MagicDNS resolves it (see `machineName` in src/core/endpoint.ts).
    let name = pc.host.flatMap { host -> (address: String, timeout: Double)? in
      guard host.lowercased().hasSuffix(".local") else { return nil }
      return (address: String(host.dropLast(".local".count)), timeout: 3.0)
    }
    let ordered: [(address: String, timeout: Double)?]
    switch pc.preferredAddress {
    case "ip": ordered = [ip, host, name]
    case "name": ordered = [name, host, ip]
    default: ordered = [host, ip, name]
    }
    let candidates = ordered.compactMap { $0 }
    guard !candidates.isEmpty else { throw PasserFailure.unreachable }

    return try await withThrowingTaskGroup(of: URL.self) { group in
      for (index, candidate) in candidates.enumerated() {
        group.addTask {
          if index > 0 { try await Task.sleep(nanoseconds: 350_000_000 * UInt64(index)) }
          guard let url = URL(string: "http://\(candidate.address):\(pc.port)") else { throw PasserFailure.unreachable }
          let info = try await ping(url, timeout: candidate.timeout)
          guard isSamePC(pc, info) else { throw PasserFailure.wrongPC }
          return url
        }
      }

      var failures: [Error] = []
      while failures.count < candidates.count {
        do {
          guard let url = try await group.next() else { break }
          group.cancelAll()
          return url
        } catch {
          failures.append(error)
        }
      }
      throw mostSpecific(failures)
    }
  }

  static func ping(_ baseURL: URL, timeout: TimeInterval) async throws -> PingInfo {
    var request = URLRequest(url: baseURL.appendingPathComponent("ping"))
    request.timeoutInterval = timeout
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await session.data(for: request)
    } catch {
      throw failure(from: error)
    }
    guard (response as? HTTPURLResponse)?.statusCode == 200,
          let info = try? JSONDecoder().decode(PingInfo.self, from: data),
          info.app == "passer"
    else { throw PasserFailure.notPasser }
    return info
  }

  /// The stable id decides when both sides have one; otherwise the machine name does.
  static func isSamePC(_ pc: PasserShared.PairedPC, _ info: PingInfo) -> Bool {
    if let expected = pc.id, let answered = info.id { return expected == answered }
    let answered = (info.name ?? info.host ?? "").lowercased()
    return !answered.isEmpty && answered == pc.name.lowercased()
  }

  private static func mostSpecific(_ failures: [Error]) -> PasserFailure {
    let kinds = failures.compactMap { $0 as? PasserFailure }
    if kinds.contains(.wrongPC) { return .wrongPC }
    if kinds.contains(.notPasser) { return .notPasser }
    if kinds.contains(.cancelled) && kinds.allSatisfy({ $0 == .cancelled }) { return .cancelled }
    return .unreachable
  }

  // MARK: Transfers

  /// Puts text on the PC clipboard.
  func pushText(_ text: String) async throws {
    var request = authorized("push", method: "POST")
    request.timeoutInterval = 10
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(["text": text])
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await Self.session.data(for: request)
    } catch {
      throw Self.failure(from: error)
    }
    try Self.interpret(response, data)
  }

  /// Uploads a file to the PC clipboard or the Passboard folder, streamed from disk.
  func push(
    file: URL,
    name: String,
    mimeType: String,
    to destination: PushDestination,
    progress: (@Sendable (Double) -> Void)? = nil
  ) async throws {
    let boundary = "passer-\(UUID().uuidString)"
    let body = try Self.multipartBody(
      file: file,
      field: destination == .clipboard ? "image" : "file",
      name: name,
      mimeType: mimeType,
      boundary: boundary
    )
    defer { try? FileManager.default.removeItem(at: body) }

    var request = authorized(destination == .clipboard ? "push/image" : "push/file", method: "POST")
    request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await Self.session.upload(for: request, fromFile: body, delegate: UploadProgress(progress))
    } catch {
      throw Self.failure(from: error)
    }
    try Self.interpret(response, data)
  }

  /// Reads the PC clipboard: text, an image, or copied files as a ZIP.
  func pull() async throws -> PullResult {
    var request = authorized("pull", method: "GET")
    request.timeoutInterval = 60
    let location: URL
    let response: URLResponse
    do {
      (location, response) = try await Self.session.download(for: request)
    } catch {
      throw Self.failure(from: error)
    }
    guard let http = response as? HTTPURLResponse else { throw PasserFailure.badResponse }
    let type = (http.value(forHTTPHeaderField: "Content-Type") ?? "")
      .split(separator: ";").first.map { $0.trimmingCharacters(in: .whitespaces).lowercased() } ?? ""

    if !(200..<300).contains(http.statusCode) || type == "application/json" {
      let data = try Data(contentsOf: location)
      try? FileManager.default.removeItem(at: location)
      let body = try Self.interpret(response, data)
      guard let text = body?["text"] as? String else { throw PasserFailure.badResponse }
      return .text(text)
    }

    let fileExtension: String
    switch type {
    case "image/png": fileExtension = "png"
    case "application/zip": fileExtension = "zip"
    default: throw PasserFailure.badResponse
    }
    // `/pull` sets no file name, so the file is named after the moment it arrived, as in the app.
    let kept = FileManager.default.temporaryDirectory.appendingPathComponent("Passer \(Self.timestamp()).\(fileExtension)")
    try? FileManager.default.removeItem(at: kept)
    try FileManager.default.moveItem(at: location, to: kept)
    return fileExtension == "png" ? .image(kept) : .files(kept)
  }

  // MARK: Plumbing

  private func authorized(_ path: String, method: String) -> URLRequest {
    var request = URLRequest(url: baseURL.appendingPathComponent(path))
    request.httpMethod = method
    request.setValue(token, forHTTPHeaderField: Self.tokenHeader)
    return request
  }

  /// Mirrors `interpretResponse` in `src/core/http.ts`, including the HTTP 200 error bodies of older desktops.
  @discardableResult
  static func interpret(_ response: URLResponse, _ data: Data) throws -> [String: Any]? {
    guard let status = (response as? HTTPURLResponse)?.statusCode else { throw PasserFailure.badResponse }
    let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    switch status {
    case 401: throw PasserFailure.unauthorized
    case 400: throw PasserFailure.rejected
    case 500...: throw PasserFailure.pcFailed
    case 200..<300: break
    default: throw PasserFailure.badResponse
    }
    if let body, (body["status"] as? String) == "error" || (body["error"] is String && body["text"] == nil) {
      throw PasserFailure.pcFailed
    }
    return body
  }

  static func failure(from error: Error) -> PasserFailure {
    if let failure = error as? PasserFailure { return failure }
    if error is CancellationError || (error as? URLError)?.code == .cancelled { return .cancelled }
    return .unreachable
  }

  /// Writes the multipart request body to a temporary file, so a large file is never held in memory.
  private static func multipartBody(file: URL, field: String, name: String, mimeType: String, boundary: String) throws -> URL {
    let body = FileManager.default.temporaryDirectory.appendingPathComponent("passer-upload-\(UUID().uuidString)")
    FileManager.default.createFile(atPath: body.path, contents: nil)
    let output = try FileHandle(forWritingTo: body)
    defer { try? output.close() }

    let filename = name.replacingOccurrences(of: "\"", with: "'")
    let head = "--\(boundary)\r\nContent-Disposition: form-data; name=\"\(field)\"; filename=\"\(filename)\"\r\nContent-Type: \(mimeType)\r\n\r\n"
    try output.write(contentsOf: Data(head.utf8))

    let input = try FileHandle(forReadingFrom: file)
    defer { try? input.close() }
    while let chunk = try input.read(upToCount: 1 << 20), !chunk.isEmpty {
      try output.write(contentsOf: chunk)
    }
    try output.write(contentsOf: Data("\r\n--\(boundary)--\r\n".utf8))
    return body
  }

  /// `2026-09-12 14.32.05`: sortable, and legal in Windows file names.
  static func timestamp(_ date: Date = Date()) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd HH.mm.ss"
    return formatter.string(from: date)
  }
}

private final class UploadProgress: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  private let report: (@Sendable (Double) -> Void)?

  init(_ report: (@Sendable (Double) -> Void)?) {
    self.report = report
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didSendBodyData bytesSent: Int64,
    totalBytesSent: Int64,
    totalBytesExpectedToSend: Int64
  ) {
    guard totalBytesExpectedToSend > 0 else { return }
    report?(Double(totalBytesSent) / Double(totalBytesExpectedToSend))
  }
}
