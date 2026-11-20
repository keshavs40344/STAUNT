package com.staunt.browser

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class BookmarksActivity : AppCompatActivity() {

    private lateinit var bookmarkDb: BookmarkDb
    private lateinit var rvBookmarks: RecyclerView
    private lateinit var tvEmptyBookmarks: TextView
    private lateinit var adapter: BookmarksAdapter
    private val bookmarkList = mutableListOf<BookmarkItem>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_bookmarks)

        val toolbar = findViewById<Toolbar>(R.id.bookmarksToolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        bookmarkDb = BookmarkDb(this)
        rvBookmarks = findViewById(R.id.rvBookmarks)
        tvEmptyBookmarks = findViewById(R.id.tvEmptyBookmarks)

        adapter = BookmarksAdapter(
            items = bookmarkList,
            onItemClick = { item ->
                val resultIntent = Intent().apply {
                    putExtra("open_url", item.url)
                }
                setResult(Activity.RESULT_OK, resultIntent)
                finish()
            },
            onDeleteClick = { item, position ->
                if (position in bookmarkList.indices) {
                    bookmarkDb.deleteBookmark(item.id)
                    bookmarkList.removeAt(position)
                    adapter.notifyItemRemoved(position)
                    updateEmptyState()
                }
            }
        )

        rvBookmarks.layoutManager = LinearLayoutManager(this)
        rvBookmarks.adapter = adapter

        loadBookmarks()
    }

    private fun loadBookmarks() {
        bookmarkList.clear()
        bookmarkList.addAll(bookmarkDb.getAllBookmarks())
        adapter.notifyDataSetChanged()
        updateEmptyState()
    }

    private fun updateEmptyState() {
        val isEmpty = bookmarkList.isEmpty()
        tvEmptyBookmarks.visibility = if (isEmpty) View.VISIBLE else View.GONE
        rvBookmarks.visibility = if (isEmpty) View.GONE else View.VISIBLE
    }

    private class BookmarksAdapter(
        private val items: List<BookmarkItem>,
        private val onItemClick: (BookmarkItem) -> Unit,
        private val onDeleteClick: (BookmarkItem, Int) -> Unit
    ) : RecyclerView.Adapter<BookmarksAdapter.ViewHolder>() {

        class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvTitle: TextView = view.findViewById(R.id.tvBookmarkTitle)
            val tvUrl: TextView = view.findViewById(R.id.tvBookmarkUrl)
            val btnDelete: ImageButton = view.findViewById(R.id.btnDeleteBookmark)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_bookmark, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.tvTitle.text = item.title.ifBlank { item.url }
            holder.tvUrl.text = item.url

            holder.itemView.setOnClickListener { onItemClick(item) }
            holder.btnDelete.setOnClickListener { onDeleteClick(item, holder.bindingAdapterPosition) }
        }

        override fun getItemCount(): Int = items.size
    }
}
