import Foundation
import WidgetKit

// Native module for React Native — writes widget data to App Group and reloads widgets.

@objc(VectorWidgetBridge)
class VectorWidgetBridge: NSObject {

    static let appGroupID = "group.com.cardlytics.app"

    @objc
    func writeSharedData(_ json: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: VectorWidgetBridge.appGroupID
        ) else {
            reject("ERR_APP_GROUP", "Could not access App Group container", nil)
            return
        }

        let fileURL = containerURL.appendingPathComponent("widget-data.json")

        do {
            try json.write(to: fileURL, atomically: true, encoding: .utf8)
            resolve(nil)
        } catch {
            reject("ERR_WRITE", "Failed to write widget data: \(error.localizedDescription)", error)
        }
    }

    @objc
    func reloadWidgets(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        resolve(nil)
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
