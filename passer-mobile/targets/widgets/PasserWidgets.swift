import AppIntents
import SwiftUI
import WidgetKit

@main
struct PasserWidgets: WidgetBundle {
  var body: some Widget {
    ActionWidget()
    LaunchPadWidget()
    if #available(iOS 18.0, *) {
      SendClipboardControl()
      PullControl()
      SendScreenshotControl()
      SendAndDeleteScreenshotControl()
      SendPhotoControl()
      SendFileControl()
    }
  }
}

/// The app reloads the widgets when it pairs a PC (`src/platform/shared-state.ts`); this only catches a missed reload.
private let refreshInterval: TimeInterval = 6 * 60 * 60

// MARK: - One action: Home Screen (small) and Lock Screen

struct ChooseActionIntent: WidgetConfigurationIntent {
  static let title: LocalizedStringResource = "Choose an Action"
  static let description = IntentDescription("The action this widget opens in Passer.")

  @Parameter(title: "Action", default: .sendClipboard)
  var action: PasserAction
}

struct ActionEntry: TimelineEntry {
  let date: Date
  let action: PasserAction
  /// Nil until a PC is paired in the app.
  let pcName: String?
}

struct ActionProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> ActionEntry {
    ActionEntry(date: .now, action: .sendClipboard, pcName: nil)
  }

  func snapshot(for configuration: ChooseActionIntent, in context: Context) async -> ActionEntry {
    ActionEntry(date: .now, action: configuration.action, pcName: PairedPCName.load())
  }

  func timeline(for configuration: ChooseActionIntent, in context: Context) async -> Timeline<ActionEntry> {
    let entry = ActionEntry(date: .now, action: configuration.action, pcName: PairedPCName.load())
    return Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(refreshInterval)))
  }
}

struct ActionWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "direct.passer.app.widget.action", intent: ChooseActionIntent.self, provider: ActionProvider()) { entry in
      ActionWidgetView(entry: entry)
    }
    .configurationDisplayName("Passer Action")
    .description("Opens Passer on the action you choose: your clipboard, your latest screenshot, a photo or a file.")
    .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
  }
}

struct ActionWidgetView: View {
  let entry: ActionEntry
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: entry.action.symbol)
          .font(.system(size: 20, weight: .semibold))
          .widgetAccentable()
      }
      .accessibilityLabel(Text(entry.action.title))
      .widgetURL(entry.action.url)
      .containerBackground(for: .widget) { Color.clear }
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 1) {
        Label {
          Text(verbatim: "Passer")
        } icon: {
          Image(systemName: entry.action.symbol)
        }
        .font(.system(size: 13, weight: .semibold))
        .widgetAccentable()
        Text(entry.action.title)
          .font(.system(size: 15, weight: .medium))
          .lineLimit(2)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .widgetURL(entry.action.url)
      .containerBackground(for: .widget) { Color.clear }
    default:
      let palette = WidgetPalette.current(scheme)
      SmallActionView(entry: entry, palette: palette)
        .widgetURL(entry.action.url)
        .containerBackground(for: .widget) { palette.ground }
    }
  }
}

/// The action as one of Home's buttons: the solid tile, its name, and the PC it goes to or comes from.
struct SmallActionView: View {
  let entry: ActionEntry
  let palette: WidgetPalette

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Image(systemName: entry.action.symbol)
        .font(.system(size: 19, weight: .semibold))
        .foregroundStyle(palette.buttonForeground)
        .frame(width: 44, height: 44)
        .background(palette.buttonBackground, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .widgetAccentable()
      Spacer(minLength: 8)
      Text(entry.action.title)
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(palette.textPrimary)
        .lineLimit(2)
        .minimumScaleFactor(0.85)
      PCLine(name: entry.pcName, palette: palette)
        .padding(.top, 4)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

// MARK: - Launch pad: Home Screen (medium)

struct PCEntry: TimelineEntry {
  let date: Date
  let pcName: String?
}

struct PCProvider: TimelineProvider {
  func placeholder(in context: Context) -> PCEntry {
    PCEntry(date: .now, pcName: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (PCEntry) -> Void) {
    completion(PCEntry(date: .now, pcName: PairedPCName.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<PCEntry>) -> Void) {
    let entry = PCEntry(date: .now, pcName: PairedPCName.load())
    completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(refreshInterval))))
  }
}

struct LaunchPadWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "direct.passer.app.widget.launch-pad", provider: PCProvider()) { entry in
      LaunchPadView(entry: entry)
    }
    .configurationDisplayName("Passer")
    .description("Paste to your PC, get its clipboard, or send your latest screenshot or a photo, in one tap.")
    .supportedFamilies([.systemMedium])
  }
}

/// Home's launch pad on the Home Screen: paste first and solid, the others raised.
struct LaunchPadView: View {
  let entry: PCEntry
  @Environment(\.colorScheme) private var scheme

  private let actions: [PasserAction] = [.sendClipboard, .pull, .sendScreenshot, .sendPhoto]

  var body: some View {
    let palette = WidgetPalette.current(scheme)
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .firstTextBaseline) {
        PCLine(name: entry.pcName, palette: palette)
        Spacer(minLength: 8)
        Text(verbatim: "Passer")
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(palette.textTertiary)
      }
      Spacer(minLength: 10)
      HStack(spacing: 8) {
        ForEach(actions, id: \.self) { action in
          Link(destination: action.url) {
            LaunchPadButton(action: action, primary: action == .sendClipboard, palette: palette)
          }
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .containerBackground(for: .widget) { palette.ground }
  }
}

struct LaunchPadButton: View {
  let action: PasserAction
  let primary: Bool
  let palette: WidgetPalette

  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: action.symbol)
        .font(.system(size: 18, weight: .semibold))
        .foregroundStyle(primary ? palette.buttonForeground : palette.iconNormal)
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .background {
          RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(primary ? palette.buttonBackground : palette.raised)
            .overlay {
              RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(primary ? Color.clear : palette.borderRaised, lineWidth: 1)
            }
        }
        .widgetAccentable(primary)
      Text(action.shortTitle)
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(palette.textSecondary)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity)
  }
}

// MARK: - Shared pieces

/// The PC the widget talks to, or what to do when there is none yet.
struct PCLine: View {
  let name: String?
  let palette: WidgetPalette

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: "laptopcomputer")
        .font(.system(size: 10, weight: .semibold))
      if let name {
        Text(verbatim: name)
      } else {
        Text("Pair a PC in Passer")
      }
    }
    .font(.system(size: 11, weight: .medium))
    .foregroundStyle(palette.textSecondary)
    .lineLimit(1)
  }
}
