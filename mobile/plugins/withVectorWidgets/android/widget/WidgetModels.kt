package com.cardlytics.app.widget

data class WidgetData(
    val lastUpdated: String = "",
    val defaultCurrency: String = "INR",
    val currentMonth: CurrentMonth = CurrentMonth(),
    val topCategories: List<CategoryItem> = emptyList(),
    val cards: List<CardItem> = emptyList()
)

data class CurrentMonth(
    val month: String = "",
    val totalSpend: Double = 0.0,
    val totalCredits: Double = 0.0,
    val net: Double = 0.0,
    val currency: String = "INR"
)

data class CategoryItem(
    val name: String = "",
    val amount: Double = 0.0,
    val color: String = "#6B7280",
    val percentage: Int = 0
)

data class CardItem(
    val id: String = "",
    val nickname: String = "",
    val last4: String = "",
    val currency: String = "INR",
    val currentMonthSpend: Double = 0.0
)
