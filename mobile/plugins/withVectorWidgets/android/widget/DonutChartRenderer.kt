package com.cardlytics.app.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF

object DonutChartRenderer {

    fun render(
        categories: List<CategoryItem>,
        size: Int = 200,
        strokeWidth: Float = 36f
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            this.strokeWidth = strokeWidth
            strokeCap = Paint.Cap.BUTT
        }

        val padding = strokeWidth / 2 + 4
        val rect = RectF(padding, padding, size - padding, size - padding)

        val total = categories.sumOf { it.amount }
        if (total <= 0) return bitmap

        var startAngle = -90f

        for (cat in categories) {
            val sweep = (cat.amount / total * 360).toFloat()
            paint.color = parseColor(cat.color)
            canvas.drawArc(rect, startAngle, sweep, false, paint)
            startAngle += sweep
        }

        return bitmap
    }

    private fun parseColor(hex: String): Int {
        return try {
            Color.parseColor(hex)
        } catch (e: Exception) {
            Color.GRAY
        }
    }
}
