package com.cardlytics.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.cardlytics.app.R

class CategoryDonutWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val data = WidgetDataReader.load(context)

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_donut)

            // Render donut chart bitmap
            if (data.topCategories.isNotEmpty()) {
                val bitmap = DonutChartRenderer.render(data.topCategories, size = 200, strokeWidth = 36f)
                views.setImageViewBitmap(R.id.img_donut, bitmap)

                // Center total text
                views.setTextViewText(
                    R.id.txt_donut_total,
                    CurrencyFormatter.formatCompact(data.currentMonth.totalSpend, data.currentMonth.currency)
                )

                // Legend items
                val legendIds = listOf(
                    Pair(R.id.legend1_name, R.id.legend1_pct),
                    Pair(R.id.legend2_name, R.id.legend2_pct),
                    Pair(R.id.legend3_name, R.id.legend3_pct),
                    Pair(R.id.legend4_name, R.id.legend4_pct),
                    Pair(R.id.legend5_name, R.id.legend5_pct)
                )

                for (i in legendIds.indices) {
                    val (nameId, pctId) = legendIds[i]
                    if (i < data.topCategories.size) {
                        val cat = data.topCategories[i]
                        views.setTextViewText(nameId, cat.name)
                        views.setTextViewText(pctId, "${cat.percentage}%")
                    } else {
                        views.setTextViewText(nameId, "")
                        views.setTextViewText(pctId, "")
                    }
                }

                views.setViewVisibility(R.id.txt_empty, View.GONE)
            } else {
                views.setViewVisibility(R.id.txt_empty, View.VISIBLE)
            }

            // Tap → open app
            val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse("vector://home")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 3, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
