package com.selectcheck.mobile

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  companion object {
    var instance: MainActivity? = null
    const val TAG = "SelectCheckMain"
  }

  private var currentWebView: WebView? = null
  private var pendingText: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    instance = this
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    extractTextFromIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    extractTextFromIntent(intent)
    deliverPendingText()
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    currentWebView = webView

    // Expose AndroidNative bridge directly to JavaScript
    webView.addJavascriptInterface(AndroidNativeBridge(this), "AndroidNative")
    deliverPendingText()
  }

  override fun onResume() {
    super.onResume()
    // Refresh permission statuses in webview on resume
    notifyPermissionsChanged()
  }

  private fun extractTextFromIntent(intent: Intent?) {
    if (intent == null) return
    val text = when {
      intent.action == Intent.ACTION_PROCESS_TEXT -> {
        intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
      }
      intent.hasExtra("extra_selected_text") -> {
        intent.getStringExtra("extra_selected_text")
      }
      intent.action == Intent.ACTION_SEND && intent.type?.startsWith("text/") == true -> {
        intent.getStringExtra(Intent.EXTRA_TEXT)
      }
      else -> null
    }

    if (!text.isNullOrBlank()) {
      pendingText = text
      Log.i(TAG, "Extracted pending text from intent: $text")
    }
  }

  fun deliverPendingText() {
    val text = pendingText ?: return
    val webView = currentWebView ?: return

    val escaped = org.json.JSONObject.quote(text)
    val script = """
      (function() {
        window.__SELECTCHECK_INCOMING_TEXT__ = $escaped;
        window.dispatchEvent(new CustomEvent('selectcheck:incoming-text', { detail: { text: $escaped } }));
      })();
    """.trimIndent()

    webView.postDelayed({
      webView.evaluateJavascript(script, null)
    }, 400)

    pendingText = null
  }

  fun notifyPermissionsChanged() {
    val webView = currentWebView ?: return
    val script = """
      (function() {
        if (window.__SELECTCHECK_REFRESH_PERMS__) {
          window.__SELECTCHECK_REFRESH_PERMS__();
        }
      })();
    """.trimIndent()
    webView.postDelayed({
      webView.evaluateJavascript(script, null)
    }, 200)
  }

  class AndroidNativeBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun openAccessibilitySettings() {
      try {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        activity.startActivity(intent)
      } catch (e: Exception) {
        Log.e(TAG, "Failed to open accessibility settings", e)
      }
    }

    @JavascriptInterface
    fun openOverlaySettings() {
      try {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${activity.packageName}")
          ).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
        } else {
          Intent(Settings.ACTION_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
        }
        activity.startActivity(intent)
      } catch (e: Exception) {
        try {
          val fallback = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
          activity.startActivity(fallback)
        } catch (ex: Exception) {
          Log.e(TAG, "Failed to open overlay settings", ex)
        }
      }
    }

    @JavascriptInterface
    fun openAppDetailsSettings() {
      try {
        val intent = Intent(
          Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:${activity.packageName}")
        ).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        activity.startActivity(intent)
      } catch (e: Exception) {
        Log.e(TAG, "Failed to open app details settings", e)
      }
    }

    @JavascriptInterface
    fun isAccessibilityServiceEnabled(): Boolean {
      val expected1 = "${activity.packageName}/${SelectCheckAccessibilityService::class.java.name}"
      val expected2 = "${activity.packageName}/${SelectCheckAccessibilityService::class.java.canonicalName}"
      val expectedShort = "${activity.packageName}/.SelectCheckAccessibilityService"

      val enabledServices = Settings.Secure.getString(
        activity.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      ) ?: return false

      val colonSplitter = TextUtils.SimpleStringSplitter(':')
      colonSplitter.setString(enabledServices)
      while (colonSplitter.hasNext()) {
        val componentName = colonSplitter.next()
        if (componentName.equals(expected1, ignoreCase = true) ||
            componentName.equals(expected2, ignoreCase = true) ||
            componentName.equals(expectedShort, ignoreCase = true) ||
            (componentName.contains(activity.packageName) && componentName.contains("SelectCheckAccessibilityService"))) {
          return true
        }
      }
      return false
    }

    @JavascriptInterface
    fun canDrawOverlays(): Boolean {
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Settings.canDrawOverlays(activity)
      } else {
        true
      }
    }

    @JavascriptInterface
    fun toggleFloatingBubble(enable: Boolean) {
      val intent = Intent(activity, FloatingOverlayService::class.java).apply {
        action = if (enable) FloatingOverlayService.ACTION_SHOW_LOGO else FloatingOverlayService.ACTION_HIDE_LOGO
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && enable) {
        activity.startForegroundService(intent)
      } else {
        activity.startService(intent)
      }
    }

    @JavascriptInterface
    fun isFloatingBubbleRunning(): Boolean {
      return FloatingOverlayService.isRunning
    }

    @JavascriptInterface
    fun replaceTextInActiveApp(newText: String): Boolean {
      return SelectCheckAccessibilityService.replaceSelectedText(newText)
    }
  }
}
