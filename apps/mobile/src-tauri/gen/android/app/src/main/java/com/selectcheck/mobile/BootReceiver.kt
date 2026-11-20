package com.selectcheck.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * BroadcastReceiver triggered on android.intent.action.BOOT_COMPLETED:
 * Restarts the SelectCheck background services after device reboot.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED && context != null) {
            val serviceIntent = Intent(context, FloatingOverlayService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        }
    }
}
