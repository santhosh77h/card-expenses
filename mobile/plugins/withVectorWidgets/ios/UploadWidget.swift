import WidgetKit
import SwiftUI

// MARK: - Upload / Scan Shortcut Widget (Static — no data needed)

struct UploadWidgetEntryView: View {
    @Environment(\.colorScheme) var colorScheme

    private let bgColor = Color(red: 0.039, green: 0.055, blue: 0.102) // #0A0E1A
    private let accentColor = Color(red: 0, green: 0.898, blue: 0.627) // #00E5A0
    private let textColor = Color.white

    var body: some View {
        ZStack {
            bgColor

            VStack(spacing: 12) {
                Text("VECTOR")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(2)
                    .foregroundColor(accentColor)

                HStack(spacing: 12) {
                    // Upload PDF button
                    Link(destination: URL(string: "vector://upload")!) {
                        VStack(spacing: 6) {
                            Image(systemName: "doc.badge.arrow.up")
                                .font(.system(size: 20))
                                .foregroundColor(accentColor)
                            Text("Upload")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(textColor)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.white.opacity(0.06))
                        .cornerRadius(10)
                    }

                    // Scan / Camera button
                    Link(destination: URL(string: "vector://upload?action=camera")!) {
                        VStack(spacing: 6) {
                            Image(systemName: "camera")
                                .font(.system(size: 20))
                                .foregroundColor(accentColor)
                            Text("Scan")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(textColor)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.white.opacity(0.06))
                        .cornerRadius(10)
                    }
                }
            }
            .padding(12)
        }
    }
}

struct UploadWidget: Widget {
    let kind = "UploadWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: UploadTimelineProvider()) { _ in
            UploadWidgetEntryView()
        }
        .configurationDisplayName("Quick Upload")
        .description("Upload a PDF statement or scan with camera.")
        .supportedFamilies([.systemSmall])
    }
}

// Simple timeline provider for static widget
struct UploadTimelineProvider: TimelineProvider {
    typealias Entry = SimpleEntry

    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(SimpleEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let entry = SimpleEntry(date: Date())
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
}
