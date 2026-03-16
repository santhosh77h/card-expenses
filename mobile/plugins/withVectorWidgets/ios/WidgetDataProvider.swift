import Foundation

// MARK: - Shared data reader for widgets

struct WidgetDataProvider {
    static let appGroupID = "group.com.cardlytics.app"

    static func load() -> WidgetData {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else {
            return .empty
        }

        let fileURL = containerURL.appendingPathComponent("widget-data.json")

        guard FileManager.default.fileExists(atPath: fileURL.path),
              let data = try? Data(contentsOf: fileURL),
              let decoded = try? JSONDecoder().decode(WidgetData.self, from: data)
        else {
            return .empty
        }

        return decoded
    }
}
