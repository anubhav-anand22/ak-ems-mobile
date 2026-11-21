export type PermissionStatus = {
  usageStats: boolean;
  overlay: boolean;
  notifications: boolean;
  allGranted: boolean;
};

export type InstalledApp = {
  packageName: string;
  appName: string;
  iconBase64: string;
  isSuggestedPaymentApp: boolean;
};

export type AppExitEvent = {
  sourcePackage: string;
};

type AppExitWatcherEvents = {
  onAppExitTriggered: (event: AppExitEvent) => void;
};

function getNativeModule(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require("react-native");
    if (rn?.Platform?.OS !== "android") return null;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require("expo");
    if (typeof expo?.requireOptionalNativeModule === "function") {
      return expo.requireOptionalNativeModule("AppExitWatcher");
    }
    return null;
  } catch {
    return null;
  }
}

function getEventEmitter(moduleInstance: any): any {
  if (!moduleInstance) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require("expo");
    if (typeof expo?.EventEmitter === "function") {
      return new expo.EventEmitter(moduleInstance);
    }
    return null;
  } catch {
    return null;
  }
}

const nativeModule = getNativeModule();
const eventEmitter = getEventEmitter(nativeModule);

export async function checkPermissions(): Promise<PermissionStatus> {
  if (!nativeModule?.checkPermissions) {
    return {
      usageStats: false,
      overlay: false,
      notifications: false,
      allGranted: false,
    };
  }
  return await nativeModule.checkPermissions();
}

export async function requestUsageStatsPermission(): Promise<void> {
  if (nativeModule?.requestUsageStatsPermission) {
    await nativeModule.requestUsageStatsPermission();
  }
}

export async function requestOverlayPermission(): Promise<void> {
  if (nativeModule?.requestOverlayPermission) {
    await nativeModule.requestOverlayPermission();
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if (nativeModule?.requestNotificationPermission) {
    await nativeModule.requestNotificationPermission();
  }
}

export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (!nativeModule?.getInstalledApps) {
    return [];
  }
  return await nativeModule.getInstalledApps();
}

export function startWatcher(packageNames: string[]): void {
  if (nativeModule?.startWatcher) {
    nativeModule.startWatcher(packageNames);
  }
}

export function updateWatchedPackages(packageNames: string[]): void {
  if (nativeModule?.updateWatchedPackages) {
    nativeModule.updateWatchedPackages(packageNames);
  }
}

export function stopWatcher(): void {
  if (nativeModule?.stopWatcher) {
    nativeModule.stopWatcher();
  }
}

export function isWatcherRunning(): boolean {
  if (nativeModule?.isWatcherRunning) {
    return Boolean(nativeModule.isWatcherRunning());
  }
  return false;
}

export function getInitialTriggerPackage(): string | null {
  if (nativeModule?.getInitialTriggerPackage) {
    return nativeModule.getInitialTriggerPackage() ?? null;
  }
  return null;
}

export function addAppExitListener(
  listener: (event: AppExitEvent) => void,
): { remove: () => void } {
  if (!eventEmitter) {
    return { remove: () => {} };
  }
  const subscription = eventEmitter.addListener(
    "onAppExitTriggered",
    (event: AppExitEvent) => {
      listener(event);
    },
  );
  return {
    remove: () => {
      subscription.remove();
    },
  };
}

export default {
  checkPermissions,
  requestUsageStatsPermission,
  requestOverlayPermission,
  requestNotificationPermission,
  getInstalledApps,
  startWatcher,
  updateWatchedPackages,
  stopWatcher,
  isWatcherRunning,
  getInitialTriggerPackage,
  addAppExitListener,
};
