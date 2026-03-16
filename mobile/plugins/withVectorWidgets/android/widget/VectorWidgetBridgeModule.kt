package com.cardlytics.app.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class VectorWidgetBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VectorWidgetBridge"

    @ReactMethod
    fun writeSharedData(json: String, promise: Promise) {
        try {
            val file = File(reactApplicationContext.filesDir, "widget-data.json")
            file.writeText(json)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERR_WRITE", "Failed to write widget data: ${e.message}", e)
        }
    }

    @ReactMethod
    fun reloadWidgets(promise: Promise) {
        try {
            val context = reactApplicationContext
            val widgetManager = AppWidgetManager.getInstance(context)

            val providers = listOf(
                UploadWidgetProvider::class.java,
                SpendingSummaryWidgetProvider::class.java,
                CategoryDonutWidgetProvider::class.java
            )

            for (provider in providers) {
                val componentName = ComponentName(context, provider)
                val ids = widgetManager.getAppWidgetIds(componentName)
                if (ids.isNotEmpty()) {
                    val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
                        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                        component = componentName
                    }
                    context.sendBroadcast(intent)
                }
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERR_RELOAD", "Failed to reload widgets: ${e.message}", e)
        }
    }
}
