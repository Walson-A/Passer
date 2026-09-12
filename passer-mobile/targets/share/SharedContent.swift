import Foundation
import UniformTypeIdentifiers

/// What another app shared, in the terms Passer sends it.
enum SharedContent: Sendable {
  case text(String)
  case link(URL)
  case images([SharedFile])
  case files([SharedFile])

  /// Reads every attachment of the share sheet. Files win over links, links over text.
  static func load(from items: [NSExtensionItem]) async -> SharedContent? {
    let providers = items.flatMap { $0.attachments ?? [] }
    var files: [SharedFile] = []
    var links: [URL] = []
    var texts: [String] = []

    for provider in providers {
      if let file = try? await loadFile(provider) {
        files.append(file)
      } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                let url = try? await loadItem(provider, type: .url) as? URL {
        links.append(url)
      } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                let text = try? await loadItem(provider, type: .plainText) as? String {
        texts.append(text)
      }
    }

    if !files.isEmpty {
      return files.allSatisfy(\.isImage) ? .images(files) : .files(files)
    }
    if let link = links.first { return .link(link) }
    let text = texts.joined(separator: "\n")
    return text.isEmpty ? nil : .text(text)
  }

  private static func loadItem(_ provider: NSItemProvider, type: UTType) async throws -> NSSecureCoding? {
    try await withCheckedThrowingContinuation { continuation in
      provider.loadItem(forTypeIdentifier: type.identifier, options: nil) { item, error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: item)
        }
      }
    }
  }

  /// Photos, videos and files: anything with a file representation. A web link or plain text is not a file.
  private static func loadFile(_ provider: NSItemProvider) async throws -> SharedFile? {
    let types = provider.registeredTypeIdentifiers.compactMap { UTType($0) }
    guard let type = types.first(where: { $0.conforms(to: .image) || $0.conforms(to: .movie) })
      ?? types.first(where: { $0.conforms(to: .fileURL) })
      ?? types.first(where: { $0.conforms(to: .data) && !$0.conforms(to: .url) && !$0.conforms(to: .text) })
    else { return nil }

    return try await withCheckedThrowingContinuation { continuation in
      provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { url, error in
        guard let url else {
          continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown))
          return
        }
        // The file only lives until this callback returns: copy it out first.
        do {
          let name = fileName(provider: provider, url: url, type: type)
          let copy = try PasserFiles.stagingFolder().appendingPathComponent(name)
          try FileManager.default.copyItem(at: url, to: copy)
          continuation.resume(returning: SharedFile.describe(copy, name: name))
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  private static func fileName(provider: NSItemProvider, url: URL, type: UTType) -> String {
    let base = PasserFiles.safeName(
      provider.suggestedName ?? url.deletingPathExtension().lastPathComponent,
      fallback: "Passer \(PasserClient.timestamp())"
    )
    let fileExtension = url.pathExtension.isEmpty ? (type.preferredFilenameExtension ?? "") : url.pathExtension
    if fileExtension.isEmpty || base.lowercased().hasSuffix(".\(fileExtension.lowercased())") { return base }
    return "\(base).\(fileExtension)"
  }
}
