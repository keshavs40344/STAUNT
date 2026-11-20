package com.staunt.browser

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

data class BookmarkItem(
    val id: Long,
    val url: String,
    val title: String,
    val created: Long
)

class BookmarkDb(context: Context) : SQLiteOpenHelper(context, "bookmarks.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, title TEXT, favicon TEXT, folder TEXT, created INTEGER)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS bookmarks")
        onCreate(db)
    }

    fun addBookmark(url: String, title: String): Long {
        val cleanUrl = url.trim()
        if (cleanUrl.isBlank() || cleanUrl.startsWith("file://") || cleanUrl.startsWith("about:") || cleanUrl.startsWith("data:") || cleanUrl.startsWith("javascript:")) {
            return -1L
        }
        val db = writableDatabase
        val values = ContentValues().apply {
            put("url", cleanUrl)
            put("title", title.ifBlank { cleanUrl })
            put("created", System.currentTimeMillis())
        }
        return db.insert("bookmarks", null, values)
    }

    fun getAllBookmarks(): List<BookmarkItem> {
        val list = mutableListOf<BookmarkItem>()
        val db = readableDatabase
        val cursor = db.query(
            "bookmarks",
            arrayOf("id", "url", "title", "created"),
            null, null, null, null,
            "created DESC"
        )
        cursor.use { c ->
            val idCol = c.getColumnIndexOrThrow("id")
            val urlCol = c.getColumnIndexOrThrow("url")
            val titleCol = c.getColumnIndexOrThrow("title")
            val createdCol = c.getColumnIndexOrThrow("created")
            while (c.moveToNext()) {
                list.add(
                    BookmarkItem(
                        id = c.getLong(idCol),
                        url = c.getString(urlCol) ?: "",
                        title = c.getString(titleCol) ?: "",
                        created = c.getLong(createdCol)
                    )
                )
            }
        }
        return list
    }

    fun deleteBookmark(id: Long): Int {
        return writableDatabase.delete("bookmarks", "id = ?", arrayOf(id.toString()))
    }

    fun deleteBookmarkByUrl(url: String): Int {
        return writableDatabase.delete("bookmarks", "url = ?", arrayOf(url))
    }

    fun isBookmarked(url: String): Boolean {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT 1 FROM bookmarks WHERE url = ? LIMIT 1", arrayOf(url))
        cursor.use { c ->
            return c.moveToFirst()
        }
    }
}