import Foundation

// MARK: - Widget Data Models (matches widget-data.json schema)

struct WidgetData: Codable {
    let lastUpdated: String
    let defaultCurrency: String
    let currentMonth: CurrentMonth
    let topCategories: [CategoryItem]
    let cards: [CardItem]

    static var empty: WidgetData {
        WidgetData(
            lastUpdated: "",
            defaultCurrency: "INR",
            currentMonth: CurrentMonth(month: "", totalSpend: 0, totalCredits: 0, net: 0, currency: "INR"),
            topCategories: [],
            cards: []
        )
    }
}

struct CurrentMonth: Codable {
    let month: String
    let totalSpend: Double
    let totalCredits: Double
    let net: Double
    let currency: String
}

struct CategoryItem: Codable {
    let name: String
    let amount: Double
    let color: String
    let percentage: Int
}

struct CardItem: Codable {
    let id: String
    let nickname: String
    let last4: String
    let currency: String
    let currentMonthSpend: Double
}
