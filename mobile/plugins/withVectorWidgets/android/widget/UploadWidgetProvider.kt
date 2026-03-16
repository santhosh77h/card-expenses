package com.cardlytics.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.cardlytics.app.R

class UploadWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_upload)

            // Upload PDF deep link
            val uploadIntent = Intent(Intent.ACTION_VIEW, Uri.parse("vector://upload")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val uploadPending = PendingIntent.getActivity(
                context, 0, uploadIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_upload, uploadPending)

            // Camera/Scan deep link
            val scanIntent = Intent(Intent.ACTION_VIEW, Uri.parse("vector://upload?action=camera")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val scanPending = PendingIntent.getActivity(
                context, 1, scanIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_scan, scanPending)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
