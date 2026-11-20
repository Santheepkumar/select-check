package com.selectcheck.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView

/**
 * Floating Overlay Service for Android:
 * Renders the floating SelectCheck logo (`44x44dp`) over WhatsApp using SYSTEM_ALERT_WINDOW.
 */
class FloatingOverlayService : Service() {

    companion object {
        const val ACTION_SHOW_LOGO = "com.selectcheck.mobile.SHOW_LOGO"
        const val ACTION_HIDE_LOGO = "com.selectcheck.mobile.HIDE_LOGO"
        const val EXTRA_TEXT = "extra_selected_text"
        private const val CHANNEL_ID = "selectcheck_floating_service"
        private const val NOTIFICATION_ID = 4040
    }

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var currentSelectedText: String = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        startForegroundServiceNotification()
    }

    private fun startForegroundServiceNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SelectCheck Floating Assistant",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps SelectCheck background text refinement active"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)

            val notification = Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("SelectCheck Active")
                .setContentText("Listening for text selections in WhatsApp")
                .setSmallIcon(android.R.drawable.ic_menu_edit)
                .build()

            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_STICKY

        when (action) {
            ACTION_SHOW_LOGO -> {
                currentSelectedText = intent.getStringExtra(EXTRA_TEXT) ?: ""
                showFloatingBall()
            }
            ACTION_HIDE_LOGO -> {
                hideFloatingBall()
            }
        }
        return START_STICKY
    }

    private fun showFloatingBall() {
        if (!Settings.canDrawOverlays(this)) return
        if (floatingView != null) return // Already showing

        val layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 100
            y = 300
        }

        // Programmatically create or inflate the floating ball view
        val ballView = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_edit)
            setBackgroundColor(0xFF00A884.toInt()) // WhatsApp Emerald
            setPadding(20, 20, 20, 20)
            setOnClickListener {
                // User clicked floating ball -> invoke refinement or open main UI
                onBallClicked()
            }
        }

        floatingView = ballView
        windowManager?.addView(floatingView, layoutParams)
    }

    private fun onBallClicked() {
        // Tapping floating logo opens the refinement sheet or auto-replaces text
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_TEXT, currentSelectedText)
        }
        startActivity(intent)
        hideFloatingBall()
    }

    private fun hideFloatingBall() {
        if (floatingView != null) {
            windowManager?.removeView(floatingView)
            floatingView = null
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        hideFloatingBall()
    }
}
