package com.staunt.browser

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.http.SslError
import android.webkit.*
import java.io.ByteArrayInputStream

class StauntWebViewClient(
    private val context: Context,
    private val adBlockEngine: AdBlockEngine,
    private val historyDb: HistoryDb,
    private val onPageStarted: (String) -> Unit,
    private val onPageFinished: (String, String?) -> Unit
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val url = request.url.toString()
        val scheme = request.url.scheme?.lowercase() ?: ""
        if (scheme == "http" || scheme == "https" || scheme == "file" || scheme == "about") {
            return false
        }
        try {
            val intent = Intent(Intent.ACTION_VIEW, request.url)
            intent.addCategory(Intent.CATEGORY_BROWSABLE)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
            return true
        } catch (e: Exception) {
            return true
        }
    }

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        if (!request.isForMainFrame && adBlockEngine.shouldBlock(request.url.toString())) {
            return WebResourceResponse("text/plain", "UTF-8", ByteArrayInputStream("".toByteArray()))
        }
        return super.shouldInterceptRequest(view, request)
    }

    override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
        val primaryError = when (error?.primaryError) {
            SslError.SSL_EXPIRED -> "The security certificate has expired."
            SslError.SSL_IDMISMATCH -> "The security certificate hostname does not match."
            SslError.SSL_UNTRUSTED -> "The security certificate authority is untrusted."
            SslError.SSL_NOTYETVALID -> "The security certificate is not yet valid."
            else -> "An SSL security error occurred."
        }

        AlertDialog.Builder(context)
            .setTitle("⚠️ Security Warning: Invalid SSL Certificate")
            .setMessage("$primaryError\n\nContinuing may expose your sensitive information to attackers. Do you wish to proceed?")
            .setPositiveButton("Proceed (Unsafe)") { _, _ -> handler?.proceed() }
            .setNegativeButton("Go Back (Recommended)") { _, _ ->
                handler?.cancel()
                if (view?.canGoBack() == true) view.goBack()
            }
            .setCancelable(false)
            .show()
    }

    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        onPageStarted(url)
    }

    override fun onPageFinished(view: WebView, url: String) {
        super.onPageFinished(view, url)
        onPageFinished(url, view.title)
    }

    override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
        super.doUpdateVisitedHistory(view, url, isReload)
        if (!isReload) {
            historyDb.addEntry(url, view.title ?: "")
        }
    }

    override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: android.webkit.WebResourceError
    ) {
        super.onReceivedError(view, request, error)
        if (request.isForMainFrame) {
            val failedUrl = request.url.toString()
            val searchQuery = NativeSearchClient.extractSearchQuery(failedUrl)
            val isSearchFailure = searchQuery != null
            val titleText = if (isSearchFailure) "Search Service Unavailable" else "Site Cannot Be Reached"
            val descText = if (isSearchFailure) 
                "Unable to connect to STAUNT Search. Please check your network connection." 
                else "Connection timed out or network offline."
            val queryBadge = if (isSearchFailure) 
                """<div style="margin-bottom:12px;font-size:14px;color:#d4a359;background:rgba(212,163,89,0.12);border:1px solid rgba(212,163,89,0.25);padding:6px 12px;border-radius:6px;display:inline-block;">Query: &ldquo;${searchQuery}&rdquo;</div>""" 
                else ""

            val errorHtml = """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { margin: 0; background: #0e1017; color: #e6e8ec; font-family: -apple-system, Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; }
                        .box { padding: 24px; max-width: 400px; }
                        h2 { font-size: 18px; margin: 12px 0 6px; font-weight: 700; color: #f0f2f5; }
                        p { font-size: 13px; color: #9ca3af; line-height: 1.5; margin: 0 0 20px; }
                        button { background: #d4a359; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; }
                    </style>
                </head>
                <body>
                    <div class="box">
                        <div style="font-size: 40px;">${if (isSearchFailure) "🔍" else "🌐"}</div>
                        <h2>$titleText</h2>
                        $queryBadge
                        <p>$descText</p>
                        <button onclick="location.reload()">Retry</button>
                    </div>
                </body>
                </html>
            """.trimIndent()
            view.loadDataWithBaseURL(null, errorHtml, "text/html", "UTF-8", null)
        }
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        try {
            (view.parent as? android.view.ViewGroup)?.removeView(view)
            view.destroy()
        } catch (_: Exception) {}
        return true
    }
}
