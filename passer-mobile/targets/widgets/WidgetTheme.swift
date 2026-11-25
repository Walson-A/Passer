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

/// The app's design tokens (`src/theme/tokens.ts`) that the widgets use. Keep them in step.
struct WidgetPalette {
  let ground: Color
  let raised: Color
  let borderRaised: Color
  let textPrimary: Color
  let textSecondary: Color
  let textTertiary: Color
  let iconNormal: Color
  /// The paste button's colours: the one solid button on Home.
  let buttonBackground: Color
  let buttonForeground: Color

  static let dark = WidgetPalette(
    ground: Color(hex: 0x0F0F0F),
    raised: Color(hex: 0xFFFFFF, opacity: 0.06),
    borderRaised: Color(hex: 0xFFFFFF, opacity: 0.10),
    textPrimary: Color(hex: 0xFFFFFF, opacity: 0.92),
    textSecondary: Color(hex: 0xFFFFFF, opacity: 0.58),
    textTertiary: Color(hex: 0xFFFFFF, opacity: 0.40),
    iconNormal: Color(hex: 0xFFFFFF, opacity: 0.74),
    buttonBackground: Color(hex: 0xFFFFFF),
    buttonForeground: Color(hex: 0x0F0F0F)
  )

  static let light = WidgetPalette(
    ground: Color(hex: 0xF3F3F0),
    raised: Color(hex: 0xFFFFFF),
    borderRaised: Color(hex: 0x151514, opacity: 0.10),
    textPrimary: Color(hex: 0x151514),
    textSecondary: Color(hex: 0x151514, opacity: 0.62),
    textTertiary: Color(hex: 0x151514, opacity: 0.46),
    iconNormal: Color(hex: 0x151514, opacity: 0.72),
    buttonBackground: Color(hex: 0x151514),
    buttonForeground: Color(hex: 0xFFFFFF)
  )

  static func current(_ scheme: ColorScheme) -> WidgetPalette {
    scheme == .dark ? .dark : .light
  }
}
