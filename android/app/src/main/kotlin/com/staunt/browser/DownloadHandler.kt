package com.staunt.browser

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.webkit.URLUtil
import android.widget.Toast

class DownloadHandler(private val context: Context) {
    fun downloadFile(url: String, userAgent: String, contentDisposition: String, mimeType: String) {
        // Issue 3 fix: DownloadManager only supports HTTP/HTTPS — reject other schemes
        if (!url.startsWith("http://", ignoreCase = true) && !url.startsWith("https://", ignoreCase = true)) {
            Toast.makeText(
                context,
                "Cannot download: unsupported URL type",
                Toast.LENGTH_SHORT
            ).show()
            return
        }
        try {
            val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                addRequestHeader("User-Agent", userAgent)
                setDescription("Downloading file...")
                setTitle(filename)
                @Suppress("DEPRECATION")
                allowScanningByMediaScanner()
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
            }
            val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
        } catch (e: Exception) {
            Toast.makeText(
                context,
                "Download failed: ${e.localizedMessage ?: "unknown error"}",
                Toast.LENGTH_SHORT
            ).show()
        }
    }
}