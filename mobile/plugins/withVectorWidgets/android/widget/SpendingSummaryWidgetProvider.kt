package com.cardlytics.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.cardlytics.app.R

class SpendingSummaryWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val data = WidgetDataReader.load(context)

        for (appWidgetId in appWidgetIds) {
            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val views = buildViews(context, data, options)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        val data = WidgetDataReader.load(context)
        val views = buildViews(context, data, newOptions)
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun buildViews(context: Context, data: WidgetData, options: Bundle): RemoteViews {
        val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
        val layoutId = when {
            minWidth >= 250 -> R.layout.widget_spending_large
            minWidth >= 180 -> R.layout.widget_spending_medium
            else -> R.layout.widget_spending_small
        }

        val views = RemoteViews(context.packageName, layoutId)

        // Total spend
        views.setTextViewText(
            R.id.txt_total_spend,
            CurrencyFormatter.format(data.currentMonth.totalSpend, data.currentMonth.currency)
        )

        // Credits (if available in medium/large)
        if (layoutId != R.layout.widget_spending_small && data.currentMonth.totalCredits > 0) {
            views.setTextViewText(
                R.id.txt_credits,
                "Credits: ${CurrencyFormatter.format(data.currentMonth.totalCredits, data.currentMonth.currency)}"
            )
            views.setViewVisibility(R.id.txt_credits, View.VISIBLE)
        }

        // Category rows for medium/large
        if (layoutId != R.layout.widget_spending_small) {
            val catIds = listOf(
                Triple(R.id.cat1_name, R.id.cat1_amount, R.id.cat1_row),
                Triple(R.id.cat2_name, R.id.cat2_amount, R.id.cat2_row),
                Triple(R.id.cat3_name, R.id.cat3_amount, R.id.cat3_row)
            )

            for (i in catIds.indices) {
                val (nameId, amountId, rowId) = catIds[i]
                if (i < data.topCategories.size) {
                    val cat = data.topCategories[i]
                    views.setTextViewText(nameId, cat.name)
                    views.setTextViewText(
                        amountId,
                        CurrencyFormatter.format(cat.amount, data.currentMonth.currency)
                    )
                    views.setViewVisibility(rowId, View.VISIBLE)
                } else {
                    views.setViewVisibility(rowId, View.GONE)
                }
            }
        }

        // Tap → open app
        val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse("vector://home")).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 2, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

        return views
    }
}
