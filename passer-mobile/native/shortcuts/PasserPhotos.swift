import Foundation
import Photos
import UniformTypeIdentifiers

/// The photo library, for the screenshot and photo actions. Access is asked for in the
/// app: an action running in the background cannot show the permission prompt.
enum PasserPhotos {
  static func requireAccess() throws {
    switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
    case .authorized, .limited:
      return
    default:
      throw PasserIntentError(message: IntentText.photosNotAllowed)
    }
  }

  /// The newest photos first, or only screenshots.
  static func latest(screenshotsOnly: Bool, limit: Int) -> [PHAsset] {
    let options = PHFetchOptions()
    if screenshotsOnly {
      options.predicate = NSPredicate(format: "(mediaSubtypes & %d) != 0", PHAssetMediaSubtype.photoScreenshot.rawValue)
    }
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
    options.fetchLimit = limit
    var assets: [PHAsset] = []
    PHAsset.fetchAssets(with: .image, options: options).enumerateObjects { asset, _, _ in
      assets.append(asset)
    }
    return assets
  }

  /// Writes the photo as it looks in Photos (edits included) under its original name,
  /// downloading it from iCloud when needed.
  static func export(_ asset: PHAsset) async throws -> SharedFile {
    let resources = PHAssetResource.assetResources(for: asset)
    let original = resources.first { $0.type == .photo }
    guard let resource = resources.first(where: { $0.type == .fullSizePhoto }) ?? original else {
      throw PasserIntentError(message: IntentText.noPhoto)
    }

    let stem = ((original ?? resource).originalFilename as NSString).deletingPathExtension
    let fileExtension = (resource.originalFilename as NSString).pathExtension
    let name = PasserFiles.safeName(
      fileExtension.isEmpty ? stem : "\(stem).\(fileExtension)",
      fallback: "Passer \(PasserClient.timestamp())"
    )
    let url = try PasserFiles.stagingFolder().appendingPathComponent(name)

    let options = PHAssetResourceRequestOptions()
    options.isNetworkAccessAllowed = true
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      PHAssetResourceManager.default().writeData(for: resource, toFile: url, options: options) { error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume()
        }
      }
    }
    return SharedFile.describe(url, name: name, type: UTType(resource.uniformTypeIdentifier))
  }

  /// Deletes the photos. iOS always asks for confirmation, and on iOS 26 the request
  /// sometimes never answers, so this gives up after 15 seconds rather than hang the action.
  static func delete(_ assets: [PHAsset]) async -> Bool {
    await withCheckedContinuation { continuation in
      let answer = AnswerOnce(continuation)
      PHPhotoLibrary.shared().performChanges({
        PHAssetChangeRequest.deleteAssets(assets as NSArray)
      }, completionHandler: { success, _ in
        answer.resume(success)
      })
      DispatchQueue.global().asyncAfter(deadline: .now() + 15) {
        answer.resume(false)
      }
    }
  }
}

/// Resumes a continuation with the first answer only.
private final class AnswerOnce: @unchecked Sendable {
  private let lock = NSLock()
  private var continuation: CheckedContinuation<Bool, Never>?

  init(_ continuation: CheckedContinuation<Bool, Never>) {
    self.continuation = continuation
  }

  func resume(_ value: Bool) {
    lock.lock()
    defer { lock.unlock() }
    continuation?.resume(returning: value)
    continuation = nil
  }
}
