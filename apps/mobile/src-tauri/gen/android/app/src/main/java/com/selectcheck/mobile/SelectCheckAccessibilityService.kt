package com.selectcheck.mobile

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Android Accessibility Service for SelectCheck Mobile:
 * Runs in background, detects text selection events across all apps (e.g. WhatsApp),
 * triggers the floating logo overlay, and performs in-place text replacement.
 */
class SelectCheckAccessibilityService : AccessibilityService() {

    companion object {
        var instance: SelectCheckAccessibilityService? = null

        /**
         * Automatically replaces the selected text in the active app (WhatsApp)
         * without leaving the app or touching clipboard.
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

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED -> {
                val source = event.source ?: return
                val text = source.text?.toString() ?: return
                val fromIndex = event.fromIndex
                val toIndex = event.toIndex

                if (fromIndex in 0..toIndex && toIndex <= text.length && fromIndex != toIndex) {
                    val selectedText = text.substring(fromIndex, toIndex).trim()

                    // Filter out trivial selections (< 2 chars)
                    if (selectedText.length >= 2) {
                        showFloatingLogo(selectedText)
                    }
                }
            }
        }
    }

    private fun showFloatingLogo(selectedText: String) {
        val overlayIntent = Intent(this, FloatingOverlayService::class.java).apply {
            action = FloatingOverlayService.ACTION_SHOW_LOGO
            putExtra(FloatingOverlayService.EXTRA_TEXT, selectedText)
        }
        startService(overlayIntent)
    }

    override fun onInterrupt() {
        // Handle interruption
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }
}
