package com.selectcheck.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Floating Overlay Service for Android:
 * Renders a persistent, draggable floating SelectCheck bubble (48x48dp)
 * over WhatsApp and other apps using SYSTEM_ALERT_WINDOW.
 */
class FloatingOverlayService : Service() {

    companion object {
        const val TAG = "SelectCheckOverlay"
        const val ACTION_SHOW_LOGO = "com.selectcheck.mobile.SHOW_LOGO"
        const val ACTION_HIDE_LOGO = "com.selectcheck.mobile.HIDE_LOGO"
        const val EXTRA_TEXT = "extra_selected_text"
        private const val CHANNEL_ID = "selectcheck_floating_service"
        private const val NOTIFICATION_ID = 4040

        var isRunning: Boolean = false
            private set
    }

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var currentSelectedText: String = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        startForegroundServiceNotification()
        isRunning = true
    }

    private fun startForegroundServiceNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SelectCheck Floating Assistant",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps SelectCheck floating assistant active over other apps"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)

            val openIntent = packageManager.getLaunchIntentForPackage(packageName)
            val pendingOpen = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("SelectCheck Assistant Active")
                .setContentText("Tap the floating bubble to refine messages anytime")
                .setSmallIcon(android.R.drawable.ic_menu_edit)
                .setContentIntent(pendingOpen)
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
                stopSelf()
            }
        }
        return START_STICKY
    }

    private fun showFloatingBall() {
        if (!Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Cannot draw overlay: permission not granted")
            return
        }
        if (floatingView != null) return // Already showing

        val wm = windowManager ?: return
        val dp = resources.displayMetrics.density

        val sizePx = (48 * dp).toInt()
        val layoutParams = WindowManager.LayoutParams(
            sizePx,
            sizePx,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = (resources.displayMetrics.widthPixels - (60 * dp)).toInt()
            y = (resources.displayMetrics.heightPixels * 0.4).toInt()
        }

        // Programmatically create the floating ball view
        val ballView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            elevation = 16 * dp

            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#00A884")) // WhatsApp emerald
                setStroke((2 * dp).toInt(), Color.parseColor("#FFFFFF"))
            }
            background = bg
        }

        val icon = TextView(this).apply {
            text = "✨"
            textSize = 20f
            gravity = Gravity.CENTER
        }
        ballView.addView(icon)

        // Setup touch listener for dragging and clicking
        ballView.setOnTouchListener(object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f
            private var isDragging = false

            override fun onTouch(v: View?, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = layoutParams.x
                        initialY = layoutParams.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isDragging = false
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - initialTouchX).toInt()
                        val dy = (event.rawY - initialTouchY).toInt()
                        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                            isDragging = true
                        }
                        if (isDragging) {
                            layoutParams.x = initialX + dx
                            layoutParams.y = initialY + dy
                            try {
                                wm.updateViewLayout(ballView, layoutParams)
                            } catch (e: Exception) {
                                // ignore
                            }
                        }
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        if (!isDragging) {
                            onBallClicked()
                        } else {
                            // Snap to nearest screen edge (left or right)
                            val screenWidth = resources.displayMetrics.widthPixels
                            layoutParams.x = if (layoutParams.x + (24 * dp) < screenWidth / 2) {
                                (8 * dp).toInt()
                            } else {
                                (screenWidth - (56 * dp)).toInt()
                            }
                            try {
                                wm.updateViewLayout(ballView, layoutParams)
                            } catch (e: Exception) {
                                // ignore
                            }
                        }
                        return true
                    }
                }
                return false
            }
        })

        try {
            wm.addView(ballView, layoutParams)
            floatingView = ballView
            Log.i(TAG, "Floating assistant bubble added")
        } catch (e: Exception) {
            Log.e(TAG, "Failed adding floating ball overlay", e)
        }
    }

    private fun onBallClicked() {
        Log.i(TAG, "Floating ball clicked, opening SelectCheck")
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            action = Intent.ACTION_SEND
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (currentSelectedText.isNotBlank()) {
                putExtra(EXTRA_TEXT, currentSelectedText)
            }
        }
        if (intent != null) {
            startActivity(intent)
        }
    }

    private fun hideFloatingBall() {
        if (floatingView != null) {
            try {
                windowManager?.removeView(floatingView)
            } catch (e: Exception) {
                // ignore
            }
            floatingView = null
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        hideFloatingBall()
        isRunning = false
    }
}
