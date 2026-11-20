package com.staunt.browser

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class HistoryActivity : AppCompatActivity() {

    private lateinit var historyDb: HistoryDb
    private lateinit var rvHistory: RecyclerView
    private lateinit var tvEmptyHistory: TextView
    private lateinit var adapter: HistoryAdapter
    private val historyList = mutableListOf<HistoryItem>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_history)

        val toolbar = findViewById<Toolbar>(R.id.historyToolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        historyDb = HistoryDb(this)
        rvHistory = findViewById(R.id.rvHistory)
        tvEmptyHistory = findViewById(R.id.tvEmptyHistory)
        val btnClearHistory = findViewById<Button>(R.id.btnClearHistory)

        adapter = HistoryAdapter(
            items = historyList,
            onItemClick = { item ->
                val resultIntent = Intent().apply {
                    putExtra("open_url", item.url)
                }
                setResult(Activity.RESULT_OK, resultIntent)
                finish()
            },
            onDeleteClick = { item, position ->
                if (position in historyList.indices) {
                    historyDb.deleteEntry(item.id)
                    historyList.removeAt(position)
                    adapter.notifyItemRemoved(position)
                    updateEmptyState()
                }
            }
        )

        rvHistory.layoutManager = LinearLayoutManager(this)
        rvHistory.adapter = adapter

        btnClearHistory.setOnClickListener {
            if (historyList.isEmpty()) return@setOnClickListener
            AlertDialog.Builder(this)
                .setTitle("Clear History")
                .setMessage("Are you sure you want to clear your entire browsing history?")
                .setPositiveButton("Clear") { _, _ ->
                    historyDb.clear()
                    historyList.clear()
                    adapter.notifyDataSetChanged()
                    updateEmptyState()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        loadHistory()
    }

    private fun loadHistory() {
        historyList.clear()
        historyList.addAll(historyDb.getAllHistory())
        adapter.notifyDataSetChanged()
        updateEmptyState()
    }

    private fun updateEmptyState() {
        val isEmpty = historyList.isEmpty()
        tvEmptyHistory.visibility = if (isEmpty) View.VISIBLE else View.GONE
        rvHistory.visibility = if (isEmpty) View.GONE else View.VISIBLE
    }

    private class HistoryAdapter(
        private val items: List<HistoryItem>,
        private val onItemClick: (HistoryItem) -> Unit,
        private val onDeleteClick: (HistoryItem, Int) -> Unit
    ) : RecyclerView.Adapter<HistoryAdapter.ViewHolder>() {

        private val dateFormat = SimpleDateFormat("MMM d, yyyy • h:mm a", Locale.getDefault())

        class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvTitle: TextView = view.findViewById(R.id.tvHistoryTitle)
            val tvUrl: TextView = view.findViewById(R.id.tvHistoryUrl)
            val tvTime: TextView = view.findViewById(R.id.tvHistoryTime)
            val btnDelete: ImageButton = view.findViewById(R.id.btnDeleteHistory)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_history, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.tvTitle.text = item.title.ifBlank { item.url }
            holder.tvUrl.text = item.url
            holder.tvTime.text = dateFormat.format(Date(item.timestamp))

            holder.itemView.setOnClickListener { onItemClick(item) }
            holder.btnDelete.setOnClickListener { onDeleteClick(item, holder.bindingAdapterPosition) }
        }

        override fun getItemCount(): Int = items.size
    }
}
