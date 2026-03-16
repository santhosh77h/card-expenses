import WidgetKit
import SwiftUI

@main
struct VectorWidgets: WidgetBundle {
    var body: some Widget {
        UploadWidget()
        SpendingSummaryWidget()
        CategoryDonutWidget()
    }
}
