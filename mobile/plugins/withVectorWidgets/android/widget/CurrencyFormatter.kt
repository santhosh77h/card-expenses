package com.cardlytics.app.widget

import java.text.NumberFormat
import java.util.Locale

object CurrencyFormatter {
    fun symbol(currency: String): String = when (currency) {
        "USD" -> "$"
        "EUR" -> "€"
        "GBP" -> "£"
        else -> "₹"
    }

    fun format(amount: Double, currency: String): String {
        val sym = symbol(currency)
        val formatter = NumberFormat.getNumberInstance(
            if (currency == "INR") Locale("en", "IN") else Locale.US
        )
        formatter.maximumFractionDigits = 0
        return "$sym${formatter.format(amount)}"
    }

    fun formatCompact(amount: Double, currency: String): String {
        val sym = symbol(currency)
        return when {
            amount >= 100_000 -> "$sym${(amount / 1000).toInt()}K"
            amount >= 10_000 -> "$sym${String.format("%.1fK", amount / 1000)}"
            else -> format(amount, currency)
        }
    }
}
