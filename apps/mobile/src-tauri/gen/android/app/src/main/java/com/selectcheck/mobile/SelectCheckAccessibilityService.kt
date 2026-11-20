package com.selectcheck.mobile

import android.accessibilityservice.AccessibilityService
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Android Accessibility Service for SelectCheck Mobile:
 * Runs in the background across all apps (WhatsApp, Chrome, Messages, Slack, etc.).
 * Detects text selection gestures and clipboard copies.
 * Displays a sleek, draggable floating "✨ Refine with SelectCheck" pill overlay.
 * Tapping the pill seamlessly opens SelectCheck with the selected text ready for AI refinement.
 */
class SelectCheckAccessibilityService : AccessibilityService() {

    companion object {
        const val TAG = "SelectCheckA11y"
        var instance: SelectCheckAccessibilityService? = null

        /**
         * Automatically replaces the selected text in the active app (e.g. WhatsApp composer)
         * without leaving the app.
         */
        fun replaceSelectedText(newText: String): Boolean {
            val service = instance ?: return false
            val rootNode = service.rootInActiveWindow ?: return false
            val focusedNode = rootNode.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false

            val arguments = Bundle().apply {
                putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    newText
                )
            }
            return focusedNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
        }
    }

    private var windowManager: WindowManager? = null
    private var floatingPillView: View? = null
    private var currentSelectedText: String = ""
    private val mainHandler = Handler(Looper.getMainLooper())
    private var autoDismissRunnable: Runnable? = null
    private var clipboardManager: ClipboardManager? = null
    private var clipListener: ClipboardManager.OnPrimaryClipChangedListener? = null
    private var lastClipboardText: String = ""

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        windowManager = getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        Log.i(TAG, "SelectCheckAccessibilityService connected successfully")

        // Register clipboard listener as complementary trigger for copied text in WhatsApp
        try {
            clipboardManager = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            clipListener = ClipboardManager.OnPrimaryClipChangedListener {
                val clip = clipboardManager?.primaryClip
                if (clip != null && clip.itemCount > 0) {
                    val text = clip.getItemAt(0).text?.toString()?.trim() ?: ""
                    if (text.length >= 2 && text != lastClipboardText && text != currentSelectedText) {
                        lastClipboardText = text
                        Log.i(TAG, "Clipboard copy detected: ${text.take(30)}...")
                        mainHandler.post {
                            showFloatingPill(text, isClipboard = true)
                        }
                    }
                }
            }
            clipboardManager?.addPrimaryClipChangedListener(clipListener)
        } catch (e: Exception) {
            Log.w(TAG, "Clipboard listener registration warning: ${e.message}")
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED -> {
                handleTextSelection(event)
            }
            AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED -> {
                // If user is actively typing new text, only dismiss if selection is collapsed
                if (event.fromIndex == event.toIndex && currentSelectedText.isNotEmpty()) {
                    // Give a slight delay before clearing
                    resetAutoDismissTimer(4000)
                }
            }
        }
    }

    private fun handleTextSelection(event: AccessibilityEvent) {
        val eventText = if (event.text.isNotEmpty()) event.text.joinToString(" ") else ""
        val sourceNode = event.source
        val sourceText = sourceNode?.text?.toString() ?: ""
        val fullText = if (sourceText.isNotBlank()) sourceText else eventText

        val fromIndex = event.fromIndex
        val toIndex = event.toIndex

        Log.d(TAG, "Selection event: from=$fromIndex, to=$toIndex, fullLen=${fullText.length}")

        if (fullText.isNotBlank() && fromIndex >= 0 && toIndex >= 0 && fromIndex != toIndex) {
            val start = minOf(fromIndex, toIndex)
            val end = maxOf(fromIndex, toIndex)
            if (end <= fullText.length) {
                val selected = fullText.substring(start, end).trim()
                if (selected.length >= 2) {
                    Log.i(TAG, "Valid text selected: $selected")
                    currentSelectedText = selected
                    mainHandler.post { showFloatingPill(selected, isClipboard = false) }
                    return
                }
            }
        } else if (eventText.isNotBlank() && eventText.length >= 2 && fromIndex != toIndex) {
            Log.i(TAG, "Valid event text selected: $eventText")
            currentSelectedText = eventText.trim()
            mainHandler.post { showFloatingPill(eventText.trim(), isClipboard = false) }
            return
        }
    }

    private fun showFloatingPill(selectedText: String, isClipboard: Boolean = false) {
        val wm = windowManager ?: return

        // If pill is already on screen, update auto-dismiss timer and text
        if (floatingPillView != null) {
            currentSelectedText = selectedText
            resetAutoDismissTimer(8000)
            return
        }

        currentSelectedText = selectedText

        val pillLayout = createPillView(selectedText, isClipboard)
        val windowType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            windowType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            x = 0
            y = 200 // Position nicely below top app bars
        }

        setupDragAndClickListener(pillLayout, params, selectedText)

        try {
            wm.addView(pillLayout, params)
            floatingPillView = pillLayout
            Log.i(TAG, "Floating pill added to WindowManager")
            resetAutoDismissTimer(8000)
        } catch (e: Exception) {
            Log.e(TAG, "Failed adding floating pill overlay", e)
            // Fallback: If TYPE_ACCESSIBILITY_OVERLAY failed and overlay permission is granted
            if (Settings.canDrawOverlays(this)) {
                try {
                    params.type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    wm.addView(pillLayout, params)
                    floatingPillView = pillLayout
                    resetAutoDismissTimer(8000)
                } catch (ex: Exception) {
                    Log.e(TAG, "Fallback overlay add also failed", ex)
                }
            }
        }
    }

    private fun createPillView(selectedText: String, isClipboard: Boolean): View {
        val dp = resources.displayMetrics.density

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding((12 * dp).toInt(), (8 * dp).toInt(), (10 * dp).toInt(), (8 * dp).toInt())
            elevation = 16 * dp

            val bg = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = 24 * dp
                setColor(Color.parseColor("#111B21")) // WhatsApp dark surface
                setStroke((2 * dp).toInt(), Color.parseColor("#00A884")) // Glowing emerald border
            }
            background = bg
        }

        val iconView = TextView(this).apply {
            text = "✨"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            setPadding(0, 0, (6 * dp).toInt(), 0)
        }

        val textView = TextView(this).apply {
            text = if (isClipboard) "Refine Copied Text" else "Refine with SelectCheck"
            setTextColor(Color.parseColor("#FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, 0, (10 * dp).toInt(), 0)
        }

        // Close button '✕' to easily dismiss
        val closeButton = TextView(this).apply {
            text = "✕"
            setTextColor(Color.parseColor("#8696A0"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setPadding((4 * dp).toInt(), 0, (4 * dp).toInt(), 0)
            setOnClickListener {
                hideFloatingPill()
            }
        }

        container.addView(iconView)
        container.addView(textView)
        container.addView(closeButton)
        return container
    }

    private fun setupDragAndClickListener(
        view: View,
        params: WindowManager.LayoutParams,
        selectedText: String
    ) {
        val wm = windowManager ?: return

        view.setOnTouchListener(object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f
            private var isDragging = false

            override fun onTouch(v: View?, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isDragging = false
                        resetAutoDismissTimer(8000)
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - initialTouchX).toInt()
                        val dy = (event.rawY - initialTouchY).toInt()
                        if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
                            isDragging = true
                        }
                        if (isDragging) {
                            params.x = initialX + dx
                            params.y = initialY + dy
                            try {
                                wm.updateViewLayout(view, params)
                            } catch (e: Exception) {
                                // ignore layout update race
                            }
                        }
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        if (!isDragging) {
                            // User tapped the pill!
                            onPillClicked(selectedText)
                        }
                        return true
                    }
                }
                return false
            }
        })
    }

    private fun onPillClicked(selectedText: String) {
        Log.i(TAG, "Pill clicked, launching SelectCheck with text: ${selectedText.take(30)}...")
        hideFloatingPill()

        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            action = Intent.ACTION_SEND
            putExtra("extra_selected_text", selectedText)
            putExtra(Intent.EXTRA_TEXT, selectedText)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        if (intent != null) {
            startActivity(intent)
        }
    }

    private fun hideFloatingPill() {
        val wm = windowManager ?: return
        val view = floatingPillView ?: return

        autoDismissRunnable?.let { mainHandler.removeCallbacks(it) }
        try {
            wm.removeView(view)
        } catch (e: Exception) {
            // view may already be detached
        } finally {
            floatingPillView = null
        }
    }

    private fun resetAutoDismissTimer(delayMillis: Long = 8000) {
        autoDismissRunnable?.let { mainHandler.removeCallbacks(it) }
        autoDismissRunnable = Runnable {
            Log.d(TAG, "Auto-dismissing floating pill after inactivity")
            hideFloatingPill()
        }
        mainHandler.postDelayed(autoDismissRunnable!!, delayMillis)
    }

    override fun onInterrupt() {
        Log.i(TAG, "Accessibility service interrupted")
        hideFloatingPill()
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "Accessibility service destroyed")
        hideFloatingPill()
        if (clipListener != null && clipboardManager != null) {
            try {
                clipboardManager?.removePrimaryClipChangedListener(clipListener)
            } catch (e: Exception) {
                // ignore
            }
        }
        instance = null
    }
}
