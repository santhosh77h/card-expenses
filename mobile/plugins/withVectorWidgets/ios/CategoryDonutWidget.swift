import WidgetKit
import SwiftUI

// MARK: - Category Donut Chart Widget

struct DonutEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct DonutTimelineProvider: TimelineProvider {
    typealias Entry = DonutEntry

    func placeholder(in context: Context) -> DonutEntry {
        DonutEntry(date: Date(), data: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (DonutEntry) -> Void) {
        let data = WidgetDataProvider.load()
        completion(DonutEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DonutEntry>) -> Void) {
        let data = WidgetDataProvider.load()
        let entry = DonutEntry(date: Date(), data: data)
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Donut chart view

struct DonutChartView: View {
    let categories: [CategoryItem]
    let totalSpend: Double
    let currency: String

    private let bgColor = Color(red: 0.039, green: 0.055, blue: 0.102)
    private let accentColor = Color(red: 0, green: 0.898, blue: 0.627)

    private var slices: [(CategoryItem, Double, Double)] {
        var result: [(CategoryItem, Double, Double)] = []
        var currentAngle: Double = -90 // start from top

        let total = categories.reduce(0.0) { $0 + $1.amount }
        guard total > 0 else { return [] }

        for cat in categories {
            let sweep = (cat.amount / total) * 360
            result.append((cat, currentAngle, sweep))
            currentAngle += sweep
        }
        return result
    }

    var body: some View {
        HStack(spacing: 12) {
            // Donut chart
            ZStack {
                Canvas { context, size in
                    let center = CGPoint(x: size.width / 2, y: size.height / 2)
                    let radius = min(size.width, size.height) / 2 - 4
                    let innerRadius = radius * 0.55

                    for (cat, startAngle, sweep) in slices {
                        var path = Path()
                        path.addArc(center: center, radius: radius,
                                     startAngle: .degrees(startAngle),
                                     endAngle: .degrees(startAngle + sweep),
                                     clockwise: false)
                        path.addArc(center: center, radius: innerRadius,
                                     startAngle: .degrees(startAngle + sweep),
                                     endAngle: .degrees(startAngle),
                                     clockwise: true)
                        path.closeSubpath()

                        context.fill(path, with: .color(Color(hex: cat.color)))
                    }
                }
                .frame(width: 90, height: 90)

                // Center text
                VStack(spacing: 1) {
                    Text(formatCompact(totalSpend, currency: currency))
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    Text("spent")
                        .font(.system(size: 8))
                        .foregroundColor(Color.white.opacity(0.5))
                }
            }

            // Legend
            VStack(alignment: .leading, spacing: 5) {
                ForEach(categories.prefix(5), id: \.name) { cat in
                    HStack(spacing: 5) {
                        Circle()
                            .fill(Color(hex: cat.color))
                            .frame(width: 7, height: 7)
                        Text(cat.name)
                            .font(.system(size: 10))
                            .foregroundColor(Color.white.opacity(0.8))
                            .lineLimit(1)
                        Spacer()
                        Text("\(cat.percentage)%")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.white)
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func formatCompact(_ amount: Double, currency: String) -> String {
        let symbol: String
        switch currency {
        case "USD": symbol = "$"
        case "EUR": symbol = "€"
        case "GBP": symbol = "£"
        default: symbol = "₹"
        }

        if amount >= 100_000 {
            return "\(symbol)\(String(format: "%.0fK", amount / 1000))"
        } else if amount >= 10_000 {
            return "\(symbol)\(String(format: "%.1fK", amount / 1000))"
        } else {
            let formatter = NumberFormatter()
            formatter.numberStyle = .decimal
            formatter.maximumFractionDigits = 0
            return "\(symbol)\(formatter.string(from: NSNumber(value: amount)) ?? "\(Int(amount))")"
        }
    }
}

// MARK: - Widget entry view

struct CategoryDonutEntryView: View {
    let entry: DonutEntry

    private let bgColor = Color(red: 0.039, green: 0.055, blue: 0.102)
    private let accentColor = Color(red: 0, green: 0.898, blue: 0.627)

    var body: some View {
        ZStack {
            bgColor

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("VECTOR")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(2)
                        .foregroundColor(accentColor)
                    Spacer()
                    Text("Categories")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.5))
                }

                if entry.data.topCategories.isEmpty {
                    Spacer()
                    Text("No spending data yet")
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.4))
                        .frame(maxWidth: .infinity, alignment: .center)
                    Spacer()
                } else {
                    DonutChartView(
                        categories: entry.data.topCategories,
                        totalSpend: entry.data.currentMonth.totalSpend,
                        currency: entry.data.currentMonth.currency
                    )
                }
            }
            .padding(12)
        }
        .widgetURL(URL(string: "vector://home"))
    }
}

// MARK: - Widget definition

struct CategoryDonutWidget: Widget {
    let kind = "CategoryDonutWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DonutTimelineProvider()) { entry in
            CategoryDonutEntryView(entry: entry)
        }
        .configurationDisplayName("Category Breakdown")
        .description("Donut chart of your spending by category.")
        .supportedFamilies([.systemMedium])
    }
}
