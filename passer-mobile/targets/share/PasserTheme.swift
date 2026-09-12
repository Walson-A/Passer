import SwiftUI

extension Color {
  init(hex: UInt32, opacity: Double = 1) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: opacity
    )
  }
}

/// The app's design tokens (`src/theme/tokens.ts`), for the share sheet. Keep both in step.
struct PasserPalette {
  let ground: Color
  let sheet: Color
  let textPrimary: Color
  let textSecondary: Color
  let textTertiary: Color
  let card: Color
  let raised: Color
  let well: Color
  let borderSubtle: Color
  let borderRaised: Color
  let iconNormal: Color
  let iconDim: Color
  let accent: Color
  let ok: Color
  let okWash: Color
  let okBorder: Color
  let warn: Color
  let warnWash: Color
  let error: Color
  let errorWash: Color
  let clipboard: Color
  let folder: Color
  let folderWash: Color
  let buttonBackground: Color
  let buttonForeground: Color
  let line: Color
  let lineIdle: Color
  let fill: Color

  static let dark = PasserPalette(
    ground: Color(hex: 0x0F0F0F),
    sheet: Color(hex: 0x171717),
    textPrimary: Color(hex: 0xFFFFFF, opacity: 0.92),
    textSecondary: Color(hex: 0xFFFFFF, opacity: 0.58),
    textTertiary: Color(hex: 0xFFFFFF, opacity: 0.40),
    card: Color(hex: 0xFFFFFF, opacity: 0.035),
    raised: Color(hex: 0xFFFFFF, opacity: 0.06),
    well: Color(hex: 0x000000, opacity: 0.30),
    borderSubtle: Color(hex: 0xFFFFFF, opacity: 0.07),
    borderRaised: Color(hex: 0xFFFFFF, opacity: 0.10),
    iconNormal: Color(hex: 0xFFFFFF, opacity: 0.74),
    iconDim: Color(hex: 0xFFFFFF, opacity: 0.40),
    accent: Color(hex: 0x60A5FA),
    ok: Color(hex: 0x34D399),
    okWash: Color(hex: 0x34D399, opacity: 0.14),
    okBorder: Color(hex: 0x34D399, opacity: 0.40),
    warn: Color(hex: 0xFBBF24),
    warnWash: Color(hex: 0xFBBF24, opacity: 0.14),
    error: Color(hex: 0xF87171),
    errorWash: Color(hex: 0xF87171, opacity: 0.14),
    clipboard: Color(hex: 0x34D399, opacity: 0.85),
    folder: Color(hex: 0xFB923C, opacity: 0.85),
    folderWash: Color(hex: 0xFB923C, opacity: 0.14),
    buttonBackground: Color(hex: 0xFFFFFF),
    buttonForeground: Color(hex: 0x0F0F0F),
    line: Color(hex: 0xF3FBFD, opacity: 0.72),
    lineIdle: Color(hex: 0xFFFFFF, opacity: 0.13),
    fill: Color(hex: 0xF3FBFD)
  )

  static let light = PasserPalette(
    ground: Color(hex: 0xF3F3F0),
    sheet: Color(hex: 0xF7F7F5),
    textPrimary: Color(hex: 0x151514),
    textSecondary: Color(hex: 0x151514, opacity: 0.62),
    textTertiary: Color(hex: 0x151514, opacity: 0.46),
    card: Color(hex: 0xFFFFFF),
    raised: Color(hex: 0xFFFFFF),
    well: Color(hex: 0x151514, opacity: 0.045),
    borderSubtle: Color(hex: 0x151514, opacity: 0.07),
    borderRaised: Color(hex: 0x151514, opacity: 0.10),
    iconNormal: Color(hex: 0x151514, opacity: 0.72),
    iconDim: Color(hex: 0x151514, opacity: 0.42),
    accent: Color(hex: 0x2563EB),
    ok: Color(hex: 0x059669),
    okWash: Color(hex: 0x059669, opacity: 0.10),
    okBorder: Color(hex: 0x059669, opacity: 0.38),
    warn: Color(hex: 0xB45309),
    warnWash: Color(hex: 0xD97706, opacity: 0.10),
    error: Color(hex: 0xDC2626),
    errorWash: Color(hex: 0xDC2626, opacity: 0.08),
    clipboard: Color(hex: 0x059669),
    folder: Color(hex: 0xEA580C),
    folderWash: Color(hex: 0xEA580C, opacity: 0.10),
    buttonBackground: Color(hex: 0x151514),
    buttonForeground: Color(hex: 0xFFFFFF),
    line: Color(hex: 0x151514, opacity: 0.55),
    lineIdle: Color(hex: 0x151514, opacity: 0.13),
    fill: Color(hex: 0x2563EB)
  )

  static func current(_ scheme: ColorScheme) -> PasserPalette {
    scheme == .dark ? .dark : .light
  }
}

/// The type scale of `src/theme/tokens.ts`.
enum PasserType {
  static let pcName = Font.system(size: 22, weight: .semibold)
  static let title = Font.system(size: 17, weight: .semibold)
  static let body = Font.system(size: 14, weight: .medium)
  static let caption = Font.system(size: 12)
  static let meta = Font.system(size: 11)
  static let label = Font.system(size: 10, weight: .black)
}

enum PasserRadius {
  static let button: CGFloat = 16
  static let socket: CGFloat = 18
  static let capsule: CGFloat = 20
  static let card: CGFloat = 22
}
