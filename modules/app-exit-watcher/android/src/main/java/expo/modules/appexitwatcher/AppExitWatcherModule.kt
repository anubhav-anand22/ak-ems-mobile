package expo.modules.appexitwatcher

import android.app.AppOpsManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

class AppExitWatcherModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  companion object {
    private var instance: AppExitWatcherModule? = null
    var pendingTriggerPackage: String? = null

    fun notifyAppExitTriggered(sourcePackage: String) {
      pendingTriggerPackage = sourcePackage
      instance?.sendEvent("onAppExitTriggered", mapOf("sourcePackage" to sourcePackage))
    }

    val SUGGESTED_PACKAGES = setOf(
      "com.google.android.apps.nbu.paisa.user", // Google Pay
      "com.phonepe.app",                       // PhonePe
      "net.one97.paytm",                       // Paytm
      "in.amazon.mShop.android.shopping",      // Amazon Pay
      "com.myairtelapp",                       // Airtel Thanks
      "com.jio.myjio",                         // MyJio
      "in.org.npci.upiapp",                    // BHIM
      "com.cred.club",                         // CRED
      "com.sbi.upi",                           // BHIM SBI Pay
      "com.csam.icici.bank.imobile",           // iMobile
      "com.axis.mobile",                       // Axis Mobile
      "com.hdfcbank.payzapp",                  // PayZapp
      "com.freecharge.android",                // Freecharge
      "com.mobikwik_new"                       // MobiKwik
    )
  }

  override fun definition() = ModuleDefinition {
    Name("AppExitWatcher")

    Events("onAppExitTriggered")

    OnCreate {
      instance = this@AppExitWatcherModule
    }

    OnDestroy {
      if (instance == this@AppExitWatcherModule) {
        instance = null
      }
    }

    AsyncFunction("checkPermissions") {
      val usageStats = hasUsageStatsPermission()
      val overlay = hasOverlayPermission()
      val notifications = hasNotificationPermission()
      val allGranted = usageStats && overlay && notifications

      mapOf(
        "usageStats" to usageStats,
        "overlay" to overlay,
        "notifications" to notifications,
        "allGranted" to allGranted
      )
    }

    AsyncFunction("requestUsageStatsPermission") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
        data = Uri.parse("package:${context.packageName}")
      }
      try {
        context.startActivity(intent)
      } catch (_: Exception) {
        context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        })
      }
    }

    AsyncFunction("requestOverlayPermission") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}")
        ).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try {
          context.startActivity(intent)
        } catch (_: Exception) {
          context.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          })
        }
      }
    }

    AsyncFunction("requestNotificationPermission") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
          putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        }
        context.startActivity(intent)
      } else {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
          data = Uri.parse("package:${context.packageName}")
        }
        context.startActivity(intent)
      }
    }

    AsyncFunction("getInstalledApps") {
      getInstalledAppsList()
    }

    Function("startWatcher") { packageNames: List<String> ->
      val intent = Intent(context, AppExitWatcherService::class.java).apply {
        action = AppExitWatcherService.ACTION_START
        putStringArrayListExtra(AppExitWatcherService.EXTRA_PACKAGES, ArrayList(packageNames))
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    Function("updateWatchedPackages") { packageNames: List<String> ->
      val intent = Intent(context, AppExitWatcherService::class.java).apply {
        action = AppExitWatcherService.ACTION_UPDATE_PACKAGES
        putStringArrayListExtra(AppExitWatcherService.EXTRA_PACKAGES, ArrayList(packageNames))
      }
      context.startService(intent)
    }

    Function("stopWatcher") {
      val intent = Intent(context, AppExitWatcherService::class.java).apply {
        action = AppExitWatcherService.ACTION_STOP
      }
      context.startService(intent)
    }

    Function("isWatcherRunning") {
      AppExitWatcherService.isServiceRunning
    }

    Function("getInitialTriggerPackage") {
      // Dismiss any alert heads-up notification once app is open
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      notificationManager?.cancel(AppExitWatcherService.ALERT_NOTIFICATION_ID)

      // Check current activity intent first
      val activityIntent = appContext.currentActivity?.intent
      if (activityIntent?.getBooleanExtra("autoLaunchTriggered", false) == true) {
        val pkg = activityIntent.getStringExtra("sourcePackage")
        activityIntent.removeExtra("autoLaunchTriggered")
        activityIntent.removeExtra("sourcePackage")
        return@Function pkg
      }
      val pkg = pendingTriggerPackage
      pendingTriggerPackage = null
      pkg
    }
  }

  private fun hasUsageStatsPermission(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun hasOverlayPermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      Settings.canDrawOverlays(context)
    } else {
      true
    }
  }

  private fun hasNotificationPermission(): Boolean {
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) {
      return false
    }
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ContextCompat.checkSelfPermission(
        context,
        android.Manifest.permission.POST_NOTIFICATIONS
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      true
    }
  }

  private fun getInstalledAppsList(): List<Map<String, Any>> {
    val pm = context.packageManager
    val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
      addCategory(Intent.CATEGORY_LAUNCHER)
    }

    val resolveInfos = pm.queryIntentActivities(mainIntent, 0)
    val appMap = mutableMapOf<String, Map<String, Any>>()

    for (resolveInfo in resolveInfos) {
      val packageName = resolveInfo.activityInfo.packageName ?: continue
      if (packageName == context.packageName) continue // ignore our own app
      if (appMap.containsKey(packageName)) continue

      val appName = try {
        resolveInfo.loadLabel(pm).toString()
      } catch (_: Exception) {
        packageName
      }

      val iconBase64 = try {
        val drawable = resolveInfo.loadIcon(pm)
        drawableToBase64(drawable)
      } catch (_: Exception) {
        ""
      }

      val isSuggested = SUGGESTED_PACKAGES.contains(packageName)

      appMap[packageName] = mapOf(
        "packageName" to packageName,
        "appName" to appName,
        "iconBase64" to iconBase64,
        "isSuggestedPaymentApp" to isSuggested
      )
    }

    return appMap.values.sortedWith(
      compareByDescending<Map<String, Any>> { it["isSuggestedPaymentApp"] as Boolean }
        .thenBy { (it["appName"] as String).lowercase() }
    )
  }

  private fun drawableToBase64(drawable: Drawable): String {
    val bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) {
      drawable.bitmap
    } else {
      val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth.coerceAtMost(96) else 96
      val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight.coerceAtMost(96) else 96
      val b = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(b)
      drawable.setBounds(0, 0, canvas.width, canvas.height)
      drawable.draw(canvas)
      b
    }

    val scaledBitmap = if (bitmap.width > 96 || bitmap.height > 96) {
      Bitmap.createScaledBitmap(bitmap, 96, 96, true)
    } else {
      bitmap
    }

    val outputStream = ByteArrayOutputStream()
    scaledBitmap.compress(Bitmap.CompressFormat.PNG, 85, outputStream)
    val byteArray = outputStream.toByteArray()
    return "data:image/png;base64," + Base64.encodeToString(byteArray, Base64.NO_WRAP)
  }
}
