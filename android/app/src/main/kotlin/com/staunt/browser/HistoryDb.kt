package com.staunt.browser

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

data class HistoryItem(
    val id: Long,
    val url: String,
    val title: String,
    val timestamp: Long
)

class HistoryDb(context: Context) : SQLiteOpenHelper(context, "history.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE history (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, title TEXT, favicon TEXT, timestamp INTEGER)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS history")
        onCreate(db)
    }

    fun addEntry(url: String, title: String) {
        val cleanUrl = url.trim()
        if (cleanUrl.isBlank() || cleanUrl.startsWith("file://") || cleanUrl.startsWith("about:") || cleanUrl.startsWith("data:") || cleanUrl.startsWith("javascript:")) {
            return
        }
        val db = writableDatabase
        val values = ContentValues().apply {
            put("url", cleanUrl)
            put("title", title.ifBlank { cleanUrl })
            put("timestamp", System.currentTimeMillis())
        }
        db.insert("history", null, values)
    }

    fun getAllHistory(): List<HistoryItem> {
        val list = mutableListOf<HistoryItem>()
        val db = readableDatabase
        val cursor = db.query(
            "history",
            arrayOf("id", "url", "title", "timestamp"),
            null, null, null, null,
            "timestamp DESC",
            "200"
        )
        cursor.use { c ->
            val idCol = c.getColumnIndexOrThrow("id")
            val urlCol = c.getColumnIndexOrThrow("url")
            val titleCol = c.getColumnIndexOrThrow("title")
            val timeCol = c.getColumnIndexOrThrow("timestamp")
            while (c.moveToNext()) {
                list.add(
                    HistoryItem(
                        id = c.getLong(idCol),
                        url = c.getString(urlCol) ?: "",
                        title = c.getString(titleCol) ?: "",
                        timestamp = c.getLong(timeCol)
                    )
                )
            }
        }
        return list
    }

    fun deleteEntry(id: Long): Int {
        return writableDatabase.delete("history", "id = ?", arrayOf(id.toString()))
    }

    fun clear() {
        writableDatabase.delete("history", null, null)
    }
}