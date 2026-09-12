import ImageIO
import SwiftUI

/// The share sheet, in the app's Conduit vocabulary: the PC at the top, a line down
/// to what is being sent, and the choice or the progress at the bottom, in the thumb zone.
struct ShareView: View {
  @ObservedObject var model: ShareModel
  @Environment(\.colorScheme) private var scheme

  private var palette: PasserPalette { .current(scheme) }

  var body: some View {
    VStack(spacing: 0) {
      topBar
      pcNode
        .padding(.top, 8)
      ConduitSegment(phase: model.phase, connection: model.connection, palette: palette)
        .frame(height: 40)
        .padding(.vertical, 10)
      if let content = model.content {
        ContentCard(content: content, palette: palette)
      } else {
        ContentPlaceholder(palette: palette)
      }
      Spacer(minLength: 20)
      footer
    }
    .padding(.horizontal, 20)
    .padding(.bottom, 12)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(palette.sheet.ignoresSafeArea())
    .onAppear { model.start() }
  }

  // MARK: Parts

  private var topBar: some View {
    HStack {
      Button(ShareText.cancel) { model.cancel() }
        .font(PasserType.body)
        .foregroundStyle(palette.textSecondary)
        .frame(minHeight: 44)
      Spacer()
    }
  }

  private var pcNode: some View {
    VStack(spacing: 8) {
      RoundedRectangle(cornerRadius: 20, style: .continuous)
        .fill(palette.raised)
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(palette.borderRaised, lineWidth: 1))
        .frame(width: 60, height: 60)
        .overlay(
          Image(systemName: "laptopcomputer")
            .font(.system(size: 24, weight: .regular))
            .foregroundStyle(palette.textPrimary)
        )
        .accessibilityHidden(true)
      Text(model.pcName.map(PasserText.unbreakable) ?? ShareText.noPC)
        .font(PasserType.pcName)
        .foregroundStyle(palette.textPrimary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      HStack(spacing: 6) {
        Circle().fill(statusColor).frame(width: 7, height: 7)
        Text(statusText)
          .font(PasserType.caption)
          .foregroundStyle(palette.textSecondary)
          .lineLimit(1)
      }
      .accessibilityElement(children: .combine)
    }
  }

  private var statusColor: Color {
    switch model.connection {
    case .searching: return palette.warn
    case .online: return palette.ok
    case .failed: return palette.error
    }
  }

  private var statusText: String {
    switch model.connection {
    case .searching: return ShareText.searching
    case .online(let address): return ShareText.connected(address)
    case .failed: return ShareText.unreachable
    }
  }

  @ViewBuilder
  private var footer: some View {
    switch model.phase {
    case .reading:
      HStack(spacing: 10) {
        ProgressView().tint(palette.textSecondary)
        Text(ShareText.preparing)
          .font(PasserType.body)
          .foregroundStyle(palette.textSecondary)
      }
      .frame(minHeight: 120)
    case .choosing:
      DestinationChoice(photoCount: model.content?.photoCount ?? 1, palette: palette) { destination in
        model.choose(destination)
      }
    case .sending(let progress):
      VStack(spacing: 6) {
        Text(progress.map { "\(Int(($0 * 100).rounded())) %" } ?? ShareText.sending)
          .font(PasserType.title)
          .foregroundStyle(palette.textPrimary)
          .monospacedDigit()
        Text(model.sendingTo == .clipboard ? ShareText.toClipboard : ShareText.toPassboard)
          .font(PasserType.caption)
          .foregroundStyle(palette.textSecondary)
      }
      .accessibilityElement(children: .combine)
      .frame(minHeight: 120)
    case .sent:
      Label(PasserText.sent(to: model.pcName ?? ""), systemImage: "checkmark.circle.fill")
        .font(PasserType.title)
        .foregroundStyle(palette.ok)
        .frame(minHeight: 120)
    case .failed(let failure):
      VStack(spacing: 14) {
        Text(PasserText.failure(failure, pcName: model.pcName))
          .font(PasserType.body)
          .foregroundStyle(palette.textPrimary)
          .multilineTextAlignment(.center)
          .fixedSize(horizontal: false, vertical: true)
        if failure == .notPaired || failure == .unauthorized || failure == .wrongPC {
          PrimaryButton(title: ShareText.close, palette: palette) { model.close() }
        } else {
          PrimaryButton(title: ShareText.retry, palette: palette) { model.retry() }
          Button(ShareText.close) { model.close() }
            .font(PasserType.body)
            .foregroundStyle(palette.textSecondary)
            .frame(minHeight: 44)
        }
      }
    case .nothingToSend:
      VStack(spacing: 14) {
        Text(ShareText.nothingToSend)
          .font(PasserType.body)
          .foregroundStyle(palette.textSecondary)
          .multilineTextAlignment(.center)
        PrimaryButton(title: ShareText.close, palette: palette) { model.close() }
      }
    }
  }
}

/// The short line between the PC and what is sent. It fills upwards as the upload progresses.
private struct ConduitSegment: View {
  let phase: ShareModel.Phase
  let connection: ShareModel.Connection
  let palette: PasserPalette

  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .bottom) {
        Capsule().fill(baseColor).frame(width: 2)
        Capsule()
          .fill(fillColor)
          .frame(width: 3, height: geometry.size.height * fillFraction)
          .animation(.easeOut(duration: 0.24), value: fillFraction)
      }
      .frame(maxWidth: .infinity)
    }
    .accessibilityHidden(true)
  }

  private var baseColor: Color {
    if case .online = connection { return palette.line }
    return palette.lineIdle
  }

  private var fillColor: Color {
    phase == .sent ? palette.ok : palette.fill
  }

  private var fillFraction: CGFloat {
    switch phase {
    case .sending(let progress): return CGFloat(progress ?? 0)
    case .sent: return 1
    default: return 0
    }
  }
}

private struct ContentPlaceholder: View {
  let palette: PasserPalette

  var body: some View {
    RoundedRectangle(cornerRadius: PasserRadius.card, style: .continuous)
      .fill(palette.card)
      .overlay(RoundedRectangle(cornerRadius: PasserRadius.card, style: .continuous).stroke(palette.borderSubtle, lineWidth: 1))
      .frame(height: 84)
  }
}

private struct ContentCard: View {
  let content: SharedContent
  let palette: PasserPalette

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      leading
      VStack(alignment: .leading, spacing: 3) {
        Text(title)
          .font(PasserType.body.weight(.semibold))
          .foregroundStyle(palette.textPrimary)
          .lineLimit(3)
        if let subtitle {
          Text(subtitle)
            .font(PasserType.caption)
            .foregroundStyle(palette.textSecondary)
            .lineLimit(1)
        }
      }
      Spacer(minLength: 0)
    }
    .padding(12)
    .background(
      RoundedRectangle(cornerRadius: PasserRadius.card, style: .continuous)
        .fill(palette.card)
        .overlay(RoundedRectangle(cornerRadius: PasserRadius.card, style: .continuous).stroke(palette.borderSubtle, lineWidth: 1))
    )
    .accessibilityElement(children: .combine)
  }

  @ViewBuilder
  private var leading: some View {
    switch content {
    case .images(let files):
      HStack(spacing: -18) {
        ForEach(files.prefix(3)) { file in
          Thumbnail(url: file.url, palette: palette)
        }
      }
    case .text:
      IconTile(symbol: "text.alignleft", tint: palette.iconNormal, palette: palette)
    case .link:
      IconTile(symbol: "link", tint: palette.clipboard, palette: palette)
    case .files(let files):
      IconTile(symbol: files.count > 1 ? "doc.on.doc" : "doc", tint: palette.folder, palette: palette)
    }
  }

  private var title: String {
    switch content {
    case .text(let text): return text
    case .link(let url): return url.host ?? url.absoluteString
    case .images(let files): return files.count > 1 ? ShareText.photos(files.count) : files[0].name
    case .files(let files): return files.count > 1 ? ShareText.files(files.count) : files[0].name
    }
  }

  private var subtitle: String? {
    switch content {
    case .text: return nil
    case .link(let url): return url.absoluteString
    case .images(let files), .files(let files):
      return ShareModel.totalSize(files).map { ByteCountFormatter.string(fromByteCount: $0, countStyle: .file) }
    }
  }
}

private struct IconTile: View {
  let symbol: String
  let tint: Color
  let palette: PasserPalette

  var body: some View {
    RoundedRectangle(cornerRadius: 14, style: .continuous)
      .fill(palette.well)
      .frame(width: 48, height: 48)
      .overlay(Image(systemName: symbol).font(.system(size: 18, weight: .medium)).foregroundStyle(tint))
  }
}

private struct Thumbnail: View {
  let url: URL
  let palette: PasserPalette
  @State private var image: UIImage?

  var body: some View {
    ZStack {
      palette.well
      if let image {
        Image(uiImage: image).resizable().scaledToFill()
      }
    }
    .frame(width: 48, height: 48)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(palette.sheet, lineWidth: 2))
    .onAppear { image = Self.load(url) }
  }

  /// A small upright thumbnail; the full photo is never decoded here.
  static func load(_ url: URL) -> UIImage? {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: 144,
    ]
    guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
    return UIImage(cgImage: cgImage)
  }
}

/// The app's destination sheet in miniature: the PC clipboard or the Passboard folder.
private struct DestinationChoice: View {
  let photoCount: Int
  let palette: PasserPalette
  let onChoose: (PushDestination) -> Void

  var body: some View {
    VStack(spacing: 10) {
      option(
        symbol: "doc.on.clipboard",
        tint: palette.clipboard,
        wash: palette.okWash,
        title: ShareText.clipboardTitle,
        detail: photoCount > 1 ? "\(ShareText.clipboardBody) \(ShareText.clipboardOnlyOne)" : ShareText.clipboardBody
      ) { onChoose(.clipboard) }
      option(
        symbol: "folder",
        tint: palette.folder,
        wash: palette.folderWash,
        title: ShareText.passboardTitle,
        detail: ShareText.passboardBody
      ) { onChoose(.passboard) }
    }
  }

  private func option(symbol: String, tint: Color, wash: Color, title: String, detail: String, action: @escaping () -> Void) -> some View {
    Button(action: {
      UISelectionFeedbackGenerator().selectionChanged()
      action()
    }) {
      HStack(spacing: 12) {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
          .fill(wash)
          .frame(width: 44, height: 44)
          .overlay(Image(systemName: symbol).font(.system(size: 18, weight: .medium)).foregroundStyle(tint))
        VStack(alignment: .leading, spacing: 3) {
          Text(title).font(PasserType.body.weight(.semibold)).foregroundStyle(palette.textPrimary)
          Text(detail)
            .font(PasserType.caption)
            .foregroundStyle(palette.textSecondary)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
        }
        Spacer(minLength: 0)
        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(palette.iconDim)
      }
      .padding(.vertical, 12)
      .padding(.leading, 12)
      .padding(.trailing, 14)
      .frame(minHeight: 72)
      .background(
        RoundedRectangle(cornerRadius: PasserRadius.capsule, style: .continuous)
          .fill(palette.card)
          .overlay(RoundedRectangle(cornerRadius: PasserRadius.capsule, style: .continuous).stroke(palette.borderSubtle, lineWidth: 1))
      )
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(.isButton)
  }
}

private struct PrimaryButton: View {
  let title: String
  let palette: PasserPalette
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Text(title)
        .font(PasserType.title)
        .foregroundStyle(palette.buttonForeground)
        .frame(maxWidth: .infinity, minHeight: 54)
        .background(Capsule().fill(palette.buttonBackground))
    }
    .buttonStyle(.plain)
  }
}

extension SharedContent {
  var photoCount: Int {
    if case .images(let files) = self { return files.count }
    return 0
  }
}
