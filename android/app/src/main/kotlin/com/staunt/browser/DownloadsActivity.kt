package com.staunt.browser

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

data class DownloadItem(
    val id: Long,
    val title: String,
    val status: Int,
    val totalBytes: Long,
    val downloadedBytes: Long,
    val localUri: String?
)

class DownloadsActivity : AppCompatActivity() {

    private lateinit var downloadManager: DownloadManager
    private lateinit var rvDownloads: RecyclerView
    private lateinit var tvEmptyDownloads: TextView
    private lateinit var adapter: DownloadsAdapter
    private val downloadList = mutableListOf<DownloadItem>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_downloads)

        val toolbar = findViewById<Toolbar>(R.id.downloadsToolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        val btnSystemDownloads = findViewById<Button>(R.id.btnSystemDownloads)
        btnSystemDownloads.setOnClickListener {
            try {
                startActivity(Intent(DownloadManager.ACTION_VIEW_DOWNLOADS))
            } catch (_: Exception) {
                Toast.makeText(this, "System files unavailable", Toast.LENGTH_SHORT).show()
            }
        }

        downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        rvDownloads = findViewById(R.id.rvDownloads)
        tvEmptyDownloads = findViewById(R.id.tvEmptyDownloads)

        adapter = DownloadsAdapter(
            items = downloadList,
            onItemClick = { item ->
                openDownloadedFile(item)
            },
            onDeleteClick = { item, position ->
                if (position in downloadList.indices) {
                    try {
                        downloadManager.remove(item.id)
                    } catch (_: Exception) {}
                    downloadList.removeAt(position)
                    adapter.notifyItemRemoved(position)
                    updateEmptyState()
                }
            }
        )

        rvDownloads.layoutManager = LinearLayoutManager(this)
        rvDownloads.adapter = adapter

        loadDownloads()
    }

    private fun loadDownloads() {
        downloadList.clear()
        try {
            val query = DownloadManager.Query()
            val cursor = downloadManager.query(query)
            cursor?.use { c ->
                val idCol = c.getColumnIndex(DownloadManager.COLUMN_ID)
                val titleCol = c.getColumnIndex(DownloadManager.COLUMN_TITLE)
                val statusCol = c.getColumnIndex(DownloadManager.COLUMN_STATUS)
                val totalCol = c.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
                val bytesCol = c.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                val uriCol = c.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)

                while (c.moveToNext()) {
                    val id = if (idCol >= 0) c.getLong(idCol) else 0L
                    val title = if (titleCol >= 0) c.getString(titleCol) ?: "Download" else "Download"
                    val status = if (statusCol >= 0) c.getInt(statusCol) else DownloadManager.STATUS_SUCCESSFUL
                    val total = if (totalCol >= 0) c.getLong(totalCol) else 0L
                    val downloaded = if (bytesCol >= 0) c.getLong(bytesCol) else 0L
                    val localUri = if (uriCol >= 0) c.getString(uriCol) else null

                    downloadList.add(
                        DownloadItem(
                            id = id,
                            title = title,
                            status = status,
                            totalBytes = total,
                            downloadedBytes = downloaded,
                            localUri = localUri
                        )
                    )
                }
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Could not load downloads", Toast.LENGTH_SHORT).show()
        }

        adapter.notifyDataSetChanged()
        updateEmptyState()
    }

    private fun openDownloadedFile(item: DownloadItem) {
        val uriStr = item.localUri
        if (uriStr.isNullOrBlank()) {
            Toast.makeText(this, "File not yet ready", Toast.LENGTH_SHORT).show()
            return
        }
        try {
            val fileUri = Uri.parse(uriStr)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(fileUri, "*/*")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        } catch (_: Exception) {
            try {
                startActivity(Intent(DownloadManager.ACTION_VIEW_DOWNLOADS))
            } catch (_: Exception) {
                Toast.makeText(this, "No app available to open this file", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun updateEmptyState() {
        val isEmpty = downloadList.isEmpty()
        tvEmptyDownloads.visibility = if (isEmpty) View.VISIBLE else View.GONE
        rvDownloads.visibility = if (isEmpty) View.GONE else View.VISIBLE
    }

    private class DownloadsAdapter(
        private val items: List<DownloadItem>,
        private val onItemClick: (DownloadItem) -> Unit,
        private val onDeleteClick: (DownloadItem, Int) -> Unit
    ) : RecyclerView.Adapter<DownloadsAdapter.ViewHolder>() {

        class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvTitle: TextView = view.findViewById(R.id.tvDownloadTitle)
            val tvStatus: TextView = view.findViewById(R.id.tvDownloadStatus)
            val tvSize: TextView = view.findViewById(R.id.tvDownloadSize)
            val btnDelete: ImageButton = view.findViewById(R.id.btnDeleteDownload)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_download, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.tvTitle.text = item.title

            when (item.status) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    holder.tvStatus.text = "✓ Completed"
                    holder.tvStatus.setTextColor(holder.itemView.context.getColor(R.color.staunt_success))
                }
                DownloadManager.STATUS_RUNNING -> {
                    holder.tvStatus.text = "⏳ Downloading"
                    holder.tvStatus.setTextColor(holder.itemView.context.getColor(R.color.staunt_accent))
                }
                DownloadManager.STATUS_FAILED -> {
                    holder.tvStatus.text = "✕ Failed"
                    holder.tvStatus.setTextColor(holder.itemView.context.getColor(R.color.staunt_error))
                }
                else -> {
                    holder.tvStatus.text = "Pending"
                    holder.tvStatus.setTextColor(holder.itemView.context.getColor(R.color.staunt_text_dim))
                }
            }

            holder.tvSize.text = formatFileSize(if (item.totalBytes > 0) item.totalBytes else item.downloadedBytes)

            holder.itemView.setOnClickListener { onItemClick(item) }
            holder.btnDelete.setOnClickListener { onDeleteClick(item, holder.bindingAdapterPosition) }
        }

        private fun formatFileSize(bytes: Long): String {
            if (bytes <= 0) return ""
            val kb = bytes / 1024.0
            val mb = kb / 1024.0
            return if (mb >= 1.0) {
                String.format(java.util.Locale.US, "%.1f MB", mb)
            } else {
                String.format(java.util.Locale.US, "%.0f KB", kb)
            }
        }

        override fun getItemCount(): Int = items.size
    }
}
