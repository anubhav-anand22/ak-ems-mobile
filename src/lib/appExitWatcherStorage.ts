import AsyncStorage from "@react-native-async-storage/async-storage";

export type WatchedApp = {
  packageName: string;
  appName: string;
  iconBase64?: string;
  isSuggestedPaymentApp?: boolean;
};

export const AUTO_LAUNCH_STORAGE_KEYS = {
  ENABLED: "AUTO_LAUNCH_AFTER_PAYMENT_ENABLED",
  WATCHED_APPS: "AUTO_LAUNCH_WATCHED_APPS",
} as const;

export async function getAutoLaunchEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(AUTO_LAUNCH_STORAGE_KEYS.ENABLED);
    return val === "true";
  } catch {
    return false;
  }
}

export async function setAutoLaunchEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(
      AUTO_LAUNCH_STORAGE_KEYS.ENABLED,
      enabled ? "true" : "false",
    );
  } catch (e) {
    console.warn("Failed to persist auto-launch enabled state:", e);
  }
}

export async function getWatchedApps(): Promise<WatchedApp[]> {
  try {
    const json = await AsyncStorage.getItem(
      AUTO_LAUNCH_STORAGE_KEYS.WATCHED_APPS,
    );
    if (!json) return [];
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is WatchedApp =>
          Boolean(item && typeof item.packageName === "string"),
      );
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveWatchedApps(apps: WatchedApp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      AUTO_LAUNCH_STORAGE_KEYS.WATCHED_APPS,
      JSON.stringify(apps),
    );
  } catch (e) {
    console.warn("Failed to persist watched apps:", e);
  }
}

export async function addWatchedApp(
  app: WatchedApp,
  currentApps: WatchedApp[],
): Promise<WatchedApp[]> {
  const exists = currentApps.some((a) => a.packageName === app.packageName);
  const updated = exists ? currentApps : [...currentApps, app];
  await saveWatchedApps(updated);
  return updated;
}

export async function removeWatchedApp(
  packageName: string,
  currentApps: WatchedApp[],
): Promise<WatchedApp[]> {
  const updated = currentApps.filter((a) => a.packageName !== packageName);
  await saveWatchedApps(updated);
  return updated;
}

export function isPackageWatched(
  packageName: string,
  watchedApps: WatchedApp[],
): boolean {
  return watchedApps.some((a) => a.packageName === packageName);
}

export const COMMON_PAYMENT_APP_NAMES: Record<string, string> = {
  "com.google.android.apps.nbu.paisa.user": "Google Pay",
  "com.phonepe.app": "PhonePe",
  "net.one97.paytm": "Paytm",
  "in.amazon.mShop.android.shopping": "Amazon Pay",
  "com.myairtelapp": "Airtel Thanks",
  "com.jio.myjio": "MyJio",
  "in.org.npci.upiapp": "BHIM",
  "com.cred.club": "CRED",
  "com.sbi.upi": "BHIM SBI Pay",
  "com.csam.icici.bank.imobile": "iMobile",
  "com.axis.mobile": "Axis Mobile",
  "com.hdfcbank.payzapp": "PayZapp",
  "com.freecharge.android": "Freecharge",
  "com.mobikwik_new": "MobiKwik",
};

export function getFriendlyPaymentAppName(packageName?: string | null): string {
  if (!packageName) return "Payment App";
  if (COMMON_PAYMENT_APP_NAMES[packageName]) {
    return COMMON_PAYMENT_APP_NAMES[packageName];
  }
  const parts = packageName.split(".");
  const candidate = parts[parts.length - 1] || packageName;
  return candidate
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

