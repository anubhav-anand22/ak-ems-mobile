import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMON_PAYMENT_APP_NAMES,
  getFriendlyPaymentAppName,
  isPackageWatched,
  WatchedApp,
} from "../src/lib/appExitWatcherStorage";
import * as AppExitWatcher from "../modules/app-exit-watcher";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withAppExitWatcher = require("../scripts/withAppExitWatcher");

test("appExitWatcher - getFriendlyPaymentAppName formatting", () => {
  assert.equal(
    getFriendlyPaymentAppName("com.google.android.apps.nbu.paisa.user"),
    "Google Pay",
  );
  assert.equal(getFriendlyPaymentAppName("com.phonepe.app"), "PhonePe");
  assert.equal(getFriendlyPaymentAppName("net.one97.paytm"), "Paytm");
  assert.equal(
    getFriendlyPaymentAppName("in.amazon.mShop.android.shopping"),
    "Amazon Pay",
  );
  assert.equal(getFriendlyPaymentAppName("com.myairtelapp"), "Airtel Thanks");
  assert.equal(getFriendlyPaymentAppName("com.jio.myjio"), "MyJio");
  assert.equal(getFriendlyPaymentAppName("in.org.npci.upiapp"), "BHIM");
  assert.equal(getFriendlyPaymentAppName("com.cred.club"), "CRED");
  assert.equal(getFriendlyPaymentAppName("com.sbi.upi"), "BHIM SBI Pay");

  // Fallback for custom or unlisted packages
  assert.equal(
    getFriendlyPaymentAppName("com.hdfc.mobile_banking"),
    "Mobile Banking",
  );
  assert.equal(getFriendlyPaymentAppName(null), "Payment App");
  assert.equal(getFriendlyPaymentAppName(""), "Payment App");
});

test("appExitWatcher - isPackageWatched lookup", () => {
  const watched: WatchedApp[] = [
    { packageName: "com.phonepe.app", appName: "PhonePe" },
    { packageName: "net.one97.paytm", appName: "Paytm" },
  ];

  assert.equal(isPackageWatched("com.phonepe.app", watched), true);
  assert.equal(isPackageWatched("net.one97.paytm", watched), true);
  assert.equal(
    isPackageWatched("com.google.android.apps.nbu.paisa.user", watched),
    false,
  );
  assert.equal(isPackageWatched("", watched), false);
});

test("appExitWatcher - Common payment app dictionary matches suggested apps", () => {
  assert.ok(COMMON_PAYMENT_APP_NAMES["com.google.android.apps.nbu.paisa.user"]);
  assert.ok(COMMON_PAYMENT_APP_NAMES["com.phonepe.app"]);
  assert.ok(COMMON_PAYMENT_APP_NAMES["net.one97.paytm"]);
  assert.ok(COMMON_PAYMENT_APP_NAMES["in.amazon.mShop.android.shopping"]);
  assert.ok(COMMON_PAYMENT_APP_NAMES["com.myairtelapp"]);
  assert.ok(COMMON_PAYMENT_APP_NAMES["com.jio.myjio"]);
});

test("appExitWatcher - Module fallback API on non-Android test environment", async () => {
  const perms = await AppExitWatcher.checkPermissions();
  assert.deepEqual(perms, {
    usageStats: false,
    overlay: false,
    notifications: false,
    allGranted: false,
  });

  const apps = await AppExitWatcher.getInstalledApps();
  assert.deepEqual(apps, []);

  assert.equal(AppExitWatcher.isWatcherRunning(), false);
  assert.equal(AppExitWatcher.getInitialTriggerPackage(), null);

  // Shouldn't throw
  AppExitWatcher.startWatcher(["com.phonepe.app"]);
  AppExitWatcher.updateWatchedPackages(["com.phonepe.app"]);
  AppExitWatcher.stopWatcher();

  const listener = AppExitWatcher.addAppExitListener(() => {});
  assert.ok(listener);
  assert.equal(typeof listener.remove, "function");
  listener.remove();
});

test("appExitWatcher - Expo Config Plugin manifest manipulation", () => {
  const initialManifest = {
    $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
    "uses-permission": [],
    application: [
      {
        $: { "android:name": ".MainApplication" },
        service: [],
      },
    ],
  };

  const manifest = withAppExitWatcher.applyAppExitWatcherManifest(initialManifest);

  // Verify permissions
  const permissions = manifest["uses-permission"].map(
    (p: any) => p.$["android:name"],
  );
  assert.ok(permissions.includes("android.permission.PACKAGE_USAGE_STATS"));
  assert.ok(permissions.includes("android.permission.SYSTEM_ALERT_WINDOW"));
  assert.ok(permissions.includes("android.permission.FOREGROUND_SERVICE"));
  assert.ok(
    permissions.includes("android.permission.FOREGROUND_SERVICE_SPECIAL_USE"),
  );
  assert.ok(permissions.includes("android.permission.POST_NOTIFICATIONS"));
  assert.ok(permissions.includes("android.permission.USE_FULL_SCREEN_INTENT"));
  assert.ok(permissions.includes("android.permission.QUERY_ALL_PACKAGES"));

  // Verify queries element
  assert.ok(manifest.queries && manifest.queries.length > 0);

  // Verify service registration
  const app = manifest.application[0];
  const service = app.service.find(
    (s: any) =>
      s.$["android:name"] ===
      "expo.modules.appexitwatcher.AppExitWatcherService",
  );
  assert.ok(service);
  assert.equal(service.$["android:exported"], "false");
  assert.equal(service.$["android:foregroundServiceType"], "specialUse");

  // Verify Android 14+ specialUse subtype property
  assert.ok(service.property && service.property.length > 0);
  assert.equal(
    service.property[0].$["android:name"],
    "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
  );
});
