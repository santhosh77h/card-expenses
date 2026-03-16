import WidgetKit
import SwiftUI

// MARK: - Spending Summary Widget

struct SpendingEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct SpendingTimelineProvider: TimelineProvider {
    typealias Entry = SpendingEntry

    func placeholder(in context: Context) -> SpendingEntry {
        SpendingEntry(date: Date(), data: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (SpendingEntry) -> Void) {
        let data = WidgetDataProvider.load()
        completion(SpendingEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SpendingEntry>) -> Void) {
        let data = WidgetDataProvider.load()
        let entry = SpendingEntry(date: Date(), data: data)
        // Refresh hourly as fallback; main app pushes updates via reloadAllTimelines
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Currency formatting helper

private func currencySymbol(for code: String) -> String {
    switch code {
    case "USD": return "$"
    case "EUR": return "€"
    case "GBP": return "£"
    default: return "₹"
    }
}

private func formatAmount(_ amount: Double, currency: String) -> String {
    let symbol = currencySymbol(for: currency)
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.minimumFractionDigits = 0
    formatter.maximumFractionDigits = 0

    if currency == "INR" {
        formatter.locale = Locale(identifier: "en_IN")
    } else {
        formatter.locale = Locale(identifier: "en_US")
    }

    let formatted = formatter.string(from: NSNumber(value: amount)) ?? "\(Int(amount))"
    return "\(symbol)\(formatted)"
}

// MARK: - Small view

struct SpendingSmallView: View {
    let data: WidgetData

    private let bgColor = Color(red: 0.039, green: 0.055, blue: 0.102)
    private let accentColor = Color(red: 0, green: 0.898, blue: 0.627)

    var body: some View {
        ZStack {
            bgColor

            VStack(alignment: .leading, spacing: 8) {
                Text("VECTOR")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(2)
                    .foregroundColor(accentColor)

                Spacer()

                Text("This Month")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.6))

                Text(formatAmount(data.currentMonth.totalSpend, currency: data.currentMonth.currency))
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.white)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)

                if data.currentMonth.totalCredits > 0 {
                    Text("Credits: \(formatAmount(data.currentMonth.totalCredits, currency: data.currentMonth.currency))")
                        .font(.system(size: 10))
                        .foregroundColor(accentColor)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .widgetURL(URL(string: "vector://home"))
    }
}

// MARK: - Medium view

struct SpendingMediumView: View {
    let data: WidgetData

    private let bgColor = Color(red: 0.039, green: 0.055, blue: 0.102)
    private let accentColor = Color(red: 0, green: 0.898, blue: 0.627)

    var body: some View {
        ZStack {
            bgColor

            HStack(spacing: 16) {
                // Left: total
                VStack(alignment: .leading, spacing: 6) {
                    Text("VECTOR")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(2)
                        .foregroundColor(accentColor)

                    Spacer()

                    Text("This Month")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.6))

                    Text(formatAmount(data.currentMonth.totalSpend, currency: data.currentMonth.currency))
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.white)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }

                // Right: top 3 categories
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(data.topCategories.prefix(3), id: \.name) { cat in
                        HStack(spacing: 6) {
                            Circle()
                                .fill(Color(hex: cat.color))
                                .frame(width: 8, height: 8)
                            Text(cat.name)
                                .font(.system(size: 11))
                                .foregroundColor(Color.white.opacity(0.8))
                                .lineLimit(1)
                            Spacer()
                            Text(formatAmount(cat.amount, currency: data.currentMonth.currency))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.white)
                        }
                    }
                    Spacer()
                }
            }
            .padding(14)
        }
        .widgetURL(URL(string: "vector://home"))
    }
}

// MARK: - Large view

struct SpendingLargeView: View {
    let data: WidgetData

    private let bgColor = Color(red: 0.039, green: 0.055, blue: 0.102)
    private let accentColor = Color(red: 0, green: 0.898, blue: 0.627)

    var body: some View {
        ZStack {
            bgColor

            VStack(alignment: .leading, spacing: 10) {
                // Header
                HStack {
                    Text("VECTOR")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(2)
                        .foregroundColor(accentColor)
                    Spacer()
                    Text("This Month")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.5))
                }

                // Total
                Text(formatAmount(data.currentMonth.totalSpend, currency: data.currentMonth.currency))
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.white)

                // Category bars
                ForEach(data.topCategories.prefix(6), id: \.name) { cat in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Circle()
                                .fill(Color(hex: cat.color))
                                .frame(width: 6, height: 6)
                            Text(cat.name)
                                .font(.system(size: 11))
                                .foregroundColor(Color.white.opacity(0.8))
                            Spacer()
                            Text(formatAmount(cat.amount, currency: data.currentMonth.currency))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.white)
                        }

                        GeometryReader { geo in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color(hex: cat.color).opacity(0.3))
                                .frame(height: 3)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(Color(hex: cat.color))
                                        .frame(width: geo.size.width * CGFloat(cat.percentage) / 100, height: 3),
                                    alignment: .leading
                                )
                        }
                        .frame(height: 3)
                    }
                }

                Spacer()

                // Per-card breakdown
                if !data.cards.isEmpty {
                    Divider().background(Color.white.opacity(0.1))
                    HStack(spacing: 8) {
                        ForEach(data.cards.prefix(3), id: \.id) { card in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(card.nickname)
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.5))
                                    .lineLimit(1)
                                Text(formatAmount(card.currentMonthSpend, currency: card.currency))
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
            .padding(14)
        }
        .widgetURL(URL(string: "vector://home"))
    }
}

// MARK: - Widget definition

struct SpendingSummaryWidget: Widget {
    let kind = "SpendingSummaryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SpendingTimelineProvider()) { entry in
            switch WidgetFamily.systemSmall {
            default:
                SpendingSummaryEntryView(entry: entry)
            }
        }
        .configurationDisplayName("Spending Summary")
        .description("See your monthly spending at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct SpendingSummaryEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: SpendingEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SpendingSmallView(data: entry.data)
        case .systemMedium:
            SpendingMediumView(data: entry.data)
        case .systemLarge:
            SpendingLargeView(data: entry.data)
        default:
            SpendingSmallView(data: entry.data)
        }
    }
}

// MARK: - Color hex extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: Double
        switch hex.count {
        case 6:
            r = Double((int >> 16) & 0xFF) / 255.0
            g = Double((int >> 8) & 0xFF) / 255.0
            b = Double(int & 0xFF) / 255.0
        default:
            r = 0; g = 0; b = 0
        }
        self.init(red: r, green: g, blue: b)
    }
}
