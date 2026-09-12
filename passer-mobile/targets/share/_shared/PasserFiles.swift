import Foundation
import ImageIO
import UniformTypeIdentifiers

/// A file on its way to the PC, copied where Passer can keep it until it is sent.
struct SharedFile: Sendable, Identifiable {
  let id = UUID()
  let url: URL
  let name: String
  let mimeType: String
  let size: Int64?
  let isImage: Bool

  /// Describes a local file, taking its type from `type` or its extension.
  static func describe(_ url: URL, name: String? = nil, type: UTType? = nil) -> SharedFile {
    let fileType = type ?? UTType(filenameExtension: url.pathExtension) ?? .data
    let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).map { Int64($0) }
    return SharedFile(
      url: url,
      name: name ?? url.lastPathComponent,
      mimeType: fileType.preferredMIMEType ?? "application/octet-stream",
      size: size,
      isImage: fileType.conforms(to: .image)
    )
  }
}

enum PasserFiles {
  /// A fresh folder in the temporary directory, so two files with the same name never overwrite each other.
  static func stagingFolder() throws -> URL {
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder
  }

  /// The PC keeps only the base name, so separators and characters Windows refuses are replaced.
  static func safeName(_ name: String, fallback: String) -> String {
    let cleaned = name
      .replacingOccurrences(of: "[\\\\/:*?\"<>|\\x00-\\x1f]", with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespaces)
    return cleaned.isEmpty ? fallback : cleaned
  }

  static func totalSize(_ files: [SharedFile]) -> Int64? {
    files.allSatisfy { $0.size != nil } ? files.reduce(0) { $0 + ($1.size ?? 0) } : nil
  }
}

enum ImageConversion {
  /// The PC clipboard decodes PNG and JPEG, not HEIC: anything else becomes an upright JPEG.
  static func forClipboard(_ file: SharedFile) throws -> SharedFile {
    if file.mimeType == "image/png" || file.mimeType == "image/jpeg" { return file }
    guard let source = CGImageSourceCreateWithURL(file.url as CFURL, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
    else { throw CocoaError(.fileReadCorruptFile) }

    let width = properties[kCGImagePropertyPixelWidth] as? Int ?? 0
    let height = properties[kCGImagePropertyPixelHeight] as? Int ?? 0
    // The PC ignores EXIF orientation, so the pixels are turned upright here.
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: max(width, height),
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
      throw CocoaError(.fileReadCorruptFile)
    }

    let name = (file.name as NSString).deletingPathExtension + ".jpg"
    let output = try PasserFiles.stagingFolder().appendingPathComponent(name)
    guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
      throw CocoaError(.fileWriteUnknown)
    }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.92] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { throw CocoaError(.fileWriteUnknown) }
    return SharedFile.describe(output, name: name, type: .jpeg)
  }
}
