package expo.modules.appexitwatcher

import android.app.ActivityOptions
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import java.util.concurrent.ConcurrentHashMap

class AppExitWatcherService : Service() {
  companion object {
    const val CHANNEL_ID = "app_exit_watcher_channel"
    const val HEADS_UP_CHANNEL_ID = "app_exit_heads_up_channel"
    const val NOTIFICATION_ID = 91823
    const val ALERT_NOTIFICATION_ID = 91824
    const val ACTION_START = "expo.modules.appexitwatcher.START"
    const val ACTION_STOP = "expo.modules.appexitwatcher.STOP"
    const val ACTION_UPDATE_PACKAGES = "expo.modules.appexitwatcher.UPDATE_PACKAGES"
    const val EXTRA_PACKAGES = "packages"
    const val COOLDOWN_MS = 5000L

    @Volatile
    var isServiceRunning: Boolean = false
      private set

    val watchedPackages: MutableSet<String> = ConcurrentHashMap.newKeySet()

    @Volatile
    var lastForegroundPackage: String? = null

    @Volatile
    var lastTriggerTimestamp: Long = 0L

    val KNOWN_APP_NAMES = mapOf(
      "com.google.android.apps.nbu.paisa.user" to "Google Pay",
      "com.phonepe.app" to "PhonePe",
      "net.one97.paytm" to "Paytm",
      "in.amazon.mShop.android.shopping" to "Amazon Pay",
      "com.myairtelapp" to "Airtel Thanks",
      "com.jio.myjio" to "MyJio",
      "in.org.npci.upiapp" to "BHIM",
      "com.cred.club" to "CRED",
      "com.sbi.upi" to "BHIM SBI Pay",
      "com.csam.icici.bank.imobile" to "iMobile",
      "com.axis.mobile" to "Axis Mobile",
      "com.hdfcbank.payzapp" to "PayZapp",
      "com.freecharge.android" to "Freecharge",
      "com.mobikwik_new" to "MobiKwik"
    )
  }

  private var workerThread: HandlerThread? = null
  private var workerHandler: Handler? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val action = intent?.action ?: ACTION_START

    when (action) {
      ACTION_STOP -> {
        stopWatcherService()
        return START_NOT_STICKY
      }
      ACTION_UPDATE_PACKAGES -> {
        val packages = intent?.getStringArrayListExtra(EXTRA_PACKAGES)
        if (packages != null) {
          watchedPackages.clear()
          watchedPackages.addAll(packages)
        }
        return START_STICKY
      }
      ACTION_START -> {
        val packages = intent?.getStringArrayListExtra(EXTRA_PACKAGES)
        if (packages != null) {
          watchedPackages.clear()
          watchedPackages.addAll(packages)
        }
        startForegroundWithNotification()
        startPolling()
        isServiceRunning = true
        return START_STICKY
      }
      else -> return START_STICKY
    }
  }

  private fun startForegroundWithNotification() {
    val notification = buildForegroundNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildForegroundNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = if (launchIntent != null) {
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      PendingIntent.getActivity(this, 0, launchIntent, flags)
    } else {
      null
    }

    val iconResId = applicationInfo.icon.takeIf { it != 0 }
      ?: android.R.drawable.ic_dialog_info

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Payment Monitor Active")
      .setContentText("Watching for payment app exits to log expenses")
      .setSmallIcon(iconResId)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(pendingIntent)
      .build()
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java) ?: return

      // 1. Low-priority sticky service channel
      val serviceChannel = NotificationChannel(
        CHANNEL_ID,
        "Payment App Exit Monitor",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Background service monitoring payment app completion"
        setShowBadge(false)
      }
      manager.createNotificationChannel(serviceChannel)

      // 2. High-priority heads-up / full-screen intent channel
      val headsUpChannel = NotificationChannel(
        HEADS_UP_CHANNEL_ID,
        "Expense Quick Launch Alerts",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Alerts to immediately log expenses when payment apps exit"
        setShowBadge(true)
        enableVibration(true)
      }
      manager.createNotificationChannel(headsUpChannel)
    }
  }

  private fun startPolling() {
    if (workerThread != null) return

    val thread = HandlerThread("AppExitWatcherPollingThread").apply { start() }
    workerThread = thread
    val handler = Handler(thread.looper)
    workerHandler = handler

    val pollRunnable = object : Runnable {
      override fun run() {
        try {
          checkForegroundAppTransition()
        } catch (_: Exception) {
          // Guard against UsageStats exceptions
        }
        workerHandler?.postDelayed(this, 1500L)
      }
    }

    handler.post(pollRunnable)
  }

  private fun checkForegroundAppTransition() {
    val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
      ?: return

    val endTime = System.currentTimeMillis()
    val beginTime = endTime - 3500L

    val usageEvents = usageStatsManager.queryEvents(beginTime, endTime)
    var currentResumedPackage: String? = null

    val event = UsageEvents.Event()
    while (usageEvents.hasNextEvent()) {
      usageEvents.getNextEvent(event)
      if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
        currentResumedPackage = event.packageName
      }
    }

    if (currentResumedPackage == null) {
      return
    }

    val previousPackage = lastForegroundPackage
    lastForegroundPackage = currentResumedPackage

    if (previousPackage != null && previousPackage != currentResumedPackage) {
      // Did we just exit a watched package?
      if (watchedPackages.contains(previousPackage)) {
        // If currentResumedPackage is our own app, do not trigger (user switched into our app directly)
        if (currentResumedPackage != packageName) {
          triggerAppLaunch(previousPackage)
        }
      }
    }
  }

  private fun getAppName(pkg: String): String {
    if (KNOWN_APP_NAMES.containsKey(pkg)) {
      return KNOWN_APP_NAMES[pkg]!!
    }
    return try {
      val info = packageManager.getApplicationInfo(pkg, 0)
      packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) {
      val candidate = pkg.substringAfterLast('.')
      candidate.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }
  }

  private fun triggerAppLaunch(sourcePackage: String) {
    val now = System.currentTimeMillis()
    if (now - lastTriggerTimestamp < COOLDOWN_MS) {
      return
    }
    lastTriggerTimestamp = now

    // Check overlay permission before launching activity from background
    val canDrawOverlay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      Settings.canDrawOverlays(this)
    } else {
      true
    }

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
      putExtra("sourcePackage", sourcePackage)
      putExtra("autoLaunchTriggered", true)
      putExtra("timestamp", now)
    }

    val pendingIntent = if (launchIntent != null) {
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      PendingIntent.getActivity(this, ALERT_NOTIFICATION_ID, launchIntent, flags)
    } else {
      null
    }

    // Configure ActivityOptions for Android 14+ (UPSIDE_DOWN_CAKE) Background Activity Launch
    val options = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ActivityOptions.makeBasic().apply {
        setPendingIntentBackgroundActivityStartMode(
          ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
        )
      }.toBundle()
    } else {
      null
    }

    val friendlyName = getAppName(sourcePackage)

    // Notify JS
    AppExitWatcherModule.notifyAppExitTriggered(sourcePackage)

    // Tier 1 & 2: WindowManager Overlay Window Bridge + PendingIntent send on Main Thread
    Handler(Looper.getMainLooper()).post {
      val windowManager = getSystemService(Context.WINDOW_SERVICE) as? WindowManager
      var dummyOverlayView: View? = null

      if (windowManager != null && canDrawOverlay) {
        try {
          val layoutParams = WindowManager.LayoutParams(
            1,
            1,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
              @Suppress("DEPRECATION")
              WindowManager.LayoutParams.TYPE_PHONE
            },
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
              WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
              WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
          ).apply {
            gravity = Gravity.TOP or Gravity.START
          }

          val view = View(this@AppExitWatcherService)
          dummyOverlayView = view
          windowManager.addView(view, layoutParams)
        } catch (_: Exception) {
          // Continue if adding dummy window fails
        }
      }

      // Execute launch
      try {
        if (pendingIntent != null) {
          pendingIntent.send(this@AppExitWatcherService, 0, null, null, null, null, options)
        } else if (launchIntent != null) {
          startActivity(launchIntent)
        }
      } catch (_: Exception) {
        try {
          if (launchIntent != null) {
            startActivity(launchIntent)
          }
        } catch (_: Exception) {}
      }

      // Clean up overlay dummy view after delay
      if (dummyOverlayView != null && windowManager != null) {
        Handler(Looper.getMainLooper()).postDelayed({
          try {
            windowManager.removeView(dummyOverlayView)
          } catch (_: Exception) {}
        }, 1500L)
      }
    }

    // Tier 3: High-priority Heads-up Notification with Full-Screen Intent as guaranteed fallback
    if (pendingIntent != null) {
      try {
        val iconResId = applicationInfo.icon.takeIf { it != 0 }
          ?: android.R.drawable.ic_dialog_info

        val alertNotification = NotificationCompat.Builder(this, HEADS_UP_CHANNEL_ID)
          .setSmallIcon(iconResId)
          .setContentTitle("$friendlyName Exited")
          .setContentText("Tap to record your payment in AK EMS")
          .setPriority(NotificationCompat.PRIORITY_MAX)
          .setCategory(NotificationCompat.CATEGORY_ALARM)
          .setAutoCancel(true)
          .setContentIntent(pendingIntent)
          .setFullScreenIntent(pendingIntent, true)
          .setTimeoutAfter(30000L)
          .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        notificationManager?.notify(ALERT_NOTIFICATION_ID, alertNotification)
      } catch (_: Exception) {
        // Guard against notification posting errors
      }
    }
  }

  private fun stopWatcherService() {
    workerHandler?.removeCallbacksAndMessages(null)
    workerThread?.quitSafely()
    workerThread = null
    workerHandler = null
    isServiceRunning = false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    stopSelf()
  }

  override fun onDestroy() {
    stopWatcherService()
    super.onDestroy()
  }
}
