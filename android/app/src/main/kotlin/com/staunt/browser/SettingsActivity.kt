package com.staunt.browser

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar

class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val toolbar = findViewById<Toolbar>(R.id.settingsToolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        val prefs = getSharedPreferences("staunt_settings", Context.MODE_PRIVATE)
        val swAdBlocker = findViewById<Switch>(R.id.swAdBlocker)
        val btnClearData = findViewById<Button>(R.id.btnClearData)
        val tvVersion = findViewById<TextView>(R.id.tvVersion)

        // Dynamically query real Android WebView engine package and version
        try {
            val webViewPackage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WebView.getCurrentWebViewPackage()
            } else null
            
            val engineVersion = webViewPackage?.versionName ?: "System Default"
            val appVersion = try {
                packageManager.getPackageInfo(packageName, 0).versionName
            } catch (e: Exception) {
                "2.0.0"
            }
            
            tvVersion.text = "Staunt Version: $appVersion\nWebView Engine: $engineVersion\nChromium Provider: ${webViewPackage?.packageName ?: "Android System WebView"}"
        } catch (e: Exception) {
            tvVersion.text = "Staunt Version 2.0.0\nEngine version unavailable."
        }

        // Ad blocker switch state
        val adBlockEnabled = prefs.getBoolean("ad_block_enabled", true)
        swAdBlocker.isChecked = adBlockEnabled

        swAdBlocker.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean("ad_block_enabled", isChecked).apply()
            Toast.makeText(this, if (isChecked) "Ad Blocker Enabled" else "Ad Blocker Disabled", Toast.LENGTH_SHORT).show()
        }

        // Search engine selector
        val spinnerSearchEngine = findViewById<Spinner>(R.id.spinnerSearchEngine)
        val tvSearchEngineAddress = findViewById<TextView>(R.id.tvSearchEngineAddress)
        val layoutCustomSearchUrl = findViewById<View>(R.id.layoutCustomSearchUrl)
        val etCustomSearchUrl = findViewById<android.widget.EditText>(R.id.etCustomSearchUrl)

        val engineKeys = NativeSearchClient.SUPPORTED_ENGINES.keys.toList()
        val engineLabels = engineKeys.map { key ->
            val meta = NativeSearchClient.SUPPORTED_ENGINES[key]!!
            if (key == "custom") {
                "${meta.icon} ${meta.name} (Custom URL Address)"
            } else {
                "${meta.icon} ${meta.name} — ${meta.template}"
            }
        }
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, engineLabels)
        spinnerSearchEngine.adapter = adapter

        val currentEngine = prefs.getString("search_engine", "google") ?: "google"
        val savedCustomUrl = prefs.getString("custom_search_url", "") ?: ""
        etCustomSearchUrl.setText(savedCustomUrl)

        val curIdx = engineKeys.indexOf(currentEngine).let { if (it >= 0) it else 0 }
        spinnerSearchEngine.setSelection(curIdx)

        fun updateEngineDisplay(key: String) {
            val meta = NativeSearchClient.SUPPORTED_ENGINES[key] ?: NativeSearchClient.SUPPORTED_ENGINES["google"]!!
            if (key == "custom") {
                val customUrl = etCustomSearchUrl.text.toString().trim()
                tvSearchEngineAddress.text = if (customUrl.isNotBlank()) "Custom Address: $customUrl" else "Custom Address: (Please enter custom URL below)"
                layoutCustomSearchUrl.visibility = View.VISIBLE
            } else {
                tvSearchEngineAddress.text = "Address: ${meta.template}"
                layoutCustomSearchUrl.visibility = View.GONE
            }
        }
        updateEngineDisplay(currentEngine)

        spinnerSearchEngine.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                val selectedKey = engineKeys[position]
                val customUrl = etCustomSearchUrl.text.toString().trim()
                prefs.edit().putString("search_engine", selectedKey).apply()
                NativeSearchClient.setSearchEngine(selectedKey, customUrl)
                updateEngineDisplay(selectedKey)
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        etCustomSearchUrl.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val newUrl = s?.toString()?.trim() ?: ""
                prefs.edit().putString("custom_search_url", newUrl).apply()
                if (NativeSearchClient.activeEngine == "custom") {
                    NativeSearchClient.setSearchEngine("custom", newUrl)
                    tvSearchEngineAddress.text = if (newUrl.isNotBlank()) "Custom Address: $newUrl" else "Custom Address: (Please enter custom URL below)"
                }
            }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })

        // Clear Browsing Data
        btnClearData.setOnClickListener {
            val historyDb = HistoryDb(this)
            historyDb.clear()

            CookieManager.getInstance().removeAllCookies(null)
            CookieManager.getInstance().flush()

            WebStorage.getInstance().deleteAllData()

            Toast.makeText(this, "Browsing history, cookies, and cache cleared", Toast.LENGTH_LONG).show()
        }
    }
}
