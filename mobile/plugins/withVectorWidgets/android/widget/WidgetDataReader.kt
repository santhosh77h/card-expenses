package com.cardlytics.app.widget

import android.content.Context
import org.json.JSONObject
import java.io.File

object WidgetDataReader {

    fun load(context: Context): WidgetData {
        return try {
            val file = File(context.filesDir, "widget-data.json")
            if (!file.exists()) return WidgetData()

            val json = JSONObject(file.readText())
            parseWidgetData(json)
        } catch (e: Exception) {
            WidgetData()
        }
    }

    private fun parseWidgetData(json: JSONObject): WidgetData {
        val currentMonthJson = json.optJSONObject("currentMonth") ?: JSONObject()
        val currentMonth = CurrentMonth(
            month = currentMonthJson.optString("month", ""),
            totalSpend = currentMonthJson.optDouble("totalSpend", 0.0),
            totalCredits = currentMonthJson.optDouble("totalCredits", 0.0),
            net = currentMonthJson.optDouble("net", 0.0),
            currency = currentMonthJson.optString("currency", "INR")
        )

        val categoriesArray = json.optJSONArray("topCategories")
        val categories = mutableListOf<CategoryItem>()
        if (categoriesArray != null) {
            for (i in 0 until categoriesArray.length()) {
                val catJson = categoriesArray.getJSONObject(i)
                categories.add(
                    CategoryItem(
                        name = catJson.optString("name", ""),
                        amount = catJson.optDouble("amount", 0.0),
                        color = catJson.optString("color", "#6B7280"),
                        percentage = catJson.optInt("percentage", 0)
                    )
                )
            }
        }

        val cardsArray = json.optJSONArray("cards")
        val cards = mutableListOf<CardItem>()
        if (cardsArray != null) {
            for (i in 0 until cardsArray.length()) {
                val cardJson = cardsArray.getJSONObject(i)
                cards.add(
                    CardItem(
                        id = cardJson.optString("id", ""),
                        nickname = cardJson.optString("nickname", ""),
                        last4 = cardJson.optString("last4", ""),
                        currency = cardJson.optString("currency", "INR"),
                        currentMonthSpend = cardJson.optDouble("currentMonthSpend", 0.0)
                    )
                )
            }
        }

        return WidgetData(
            lastUpdated = json.optString("lastUpdated", ""),
            defaultCurrency = json.optString("defaultCurrency", "INR"),
            currentMonth = currentMonth,
            topCategories = categories,
            cards = cards
        )
    }
}
