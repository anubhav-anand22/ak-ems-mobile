import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as AppExitWatcher from "app-exit-watcher";
import {
  getAutoLaunchEnabled,
  getWatchedApps,
  isPackageWatched,
  removeWatchedApp,
  saveWatchedApps,
  setAutoLaunchEnabled,
  WatchedApp,
} from "@/lib/appExitWatcherStorage";

export type PermissionStatus = AppExitWatcher.PermissionStatus;
export type InstalledApp = AppExitWatcher.InstalledApp;

export function useAppExitWatcher() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [watchedApps, setWatchedApps] = useState<WatchedApp[]>([]);
  const [permissions, setPermissions] = useState<PermissionStatus>({
    usageStats: false,
    overlay: false,
    notifications: false,
    allGranted: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isPermissionModalVisible, setIsPermissionModalVisible] =
    useState(false);
  const [isAppPickerModalVisible, setIsAppPickerModalVisible] = useState(false);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [isLoadingInstalledApps, setIsLoadingInstalledApps] = useState(false);

  // Tracks if the user clicked the toggle ON and was redirected to settings to grant permissions
  const isPendingActivationRef = useRef(false);
  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;
  const watchedAppsRef = useRef(watchedApps);
  watchedAppsRef.current = watchedApps;

  const refreshPermissions = useCallback(async (): Promise<PermissionStatus> => {
    try {
      const status = await AppExitWatcher.checkPermissions();
      setPermissions(status);

      // If user was prompted to grant permissions and now all are granted
      if (isPendingActivationRef.current && status.allGranted) {
        isPendingActivationRef.current = false;
        setIsPermissionModalVisible(false);
        setIsEnabled(true);
        await setAutoLaunchEnabled(true);

        const currentWatched = watchedAppsRef.current;
        AppExitWatcher.startWatcher(currentWatched.map((a) => a.packageName));

        if (currentWatched.length === 0) {
          setIsAppPickerModalVisible(true);
        }
      }

      return status;
    } catch (e) {
      console.warn("Failed to check permissions:", e);
      return {
        usageStats: false,
        overlay: false,
        notifications: false,
        allGranted: false,
      };
    }
  }, []);

  // Initial load
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setIsLoading(true);
        const [savedEnabled, savedApps, currentPerms] = await Promise.all([
          getAutoLaunchEnabled(),
          getWatchedApps(),
          AppExitWatcher.checkPermissions(),
        ]);

        if (!isMounted) return;

        setWatchedApps(savedApps);
        setPermissions(currentPerms);

        if (savedEnabled && currentPerms.allGranted) {
          setIsEnabled(true);
          AppExitWatcher.startWatcher(savedApps.map((a) => a.packageName));
        } else {
          setIsEnabled(false);
          if (savedEnabled && !currentPerms.allGranted) {
            // Permissions were revoked externally
            await setAutoLaunchEnabled(false);
          }
        }
      } catch (e) {
        console.warn("Error initializing AppExitWatcher state:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // AppState change listener (e.g., returning from Android Settings)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          refreshPermissions();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [refreshPermissions]);

  const toggleAutoLaunch = useCallback(
    async (targetValue?: boolean): Promise<boolean> => {
      const nextValue = targetValue !== undefined ? targetValue : !isEnabled;

      if (!nextValue) {
        // Turning OFF
        isPendingActivationRef.current = false;
        setIsPermissionModalVisible(false);
        setIsEnabled(false);
        await setAutoLaunchEnabled(false);
        AppExitWatcher.stopWatcher();
        return false;
      }

      // Turning ON: check permissions first
      const status = await refreshPermissions();
      if (!status.allGranted) {
        isPendingActivationRef.current = true;
        setIsPermissionModalVisible(true);
        return false;
      }

      // All permissions are granted!
      isPendingActivationRef.current = false;
      setIsEnabled(true);
      await setAutoLaunchEnabled(true);
      AppExitWatcher.startWatcher(watchedApps.map((a) => a.packageName));

      if (watchedApps.length === 0) {
        setIsAppPickerModalVisible(true);
      }

      return true;
    },
    [isEnabled, refreshPermissions, watchedApps],
  );

  const updateWatchedAppsList = useCallback(
    async (newApps: WatchedApp[]) => {
      setWatchedApps(newApps);
      await saveWatchedApps(newApps);
      if (isEnabledRef.current) {
        AppExitWatcher.updateWatchedPackages(newApps.map((a) => a.packageName));
      }
    },
    [],
  );

  const removeApp = useCallback(
    async (packageName: string) => {
      const updated = await removeWatchedApp(packageName, watchedApps);
      setWatchedApps(updated);
      if (isEnabledRef.current) {
        AppExitWatcher.updateWatchedPackages(updated.map((a) => a.packageName));
      }
    },
    [watchedApps],
  );

  const loadInstalledApps = useCallback(async () => {
    try {
      setIsLoadingInstalledApps(true);
      const apps = await AppExitWatcher.getInstalledApps();
      setInstalledApps(apps);
      return apps;
    } catch (e) {
      console.warn("Failed to get installed apps:", e);
      return [];
    } finally {
      setIsLoadingInstalledApps(false);
    }
  }, []);

  const openAppPicker = useCallback(async () => {
    setIsAppPickerModalVisible(true);
    await loadInstalledApps();
  }, [loadInstalledApps]);

  const closeAppPicker = useCallback(() => {
    setIsAppPickerModalVisible(false);
  }, []);

  const openPermissionModal = useCallback(() => {
    setIsPermissionModalVisible(true);
  }, []);

  const closePermissionModal = useCallback(() => {
    isPendingActivationRef.current = false;
    setIsPermissionModalVisible(false);
  }, []);

  const grantUsageStats = useCallback(async () => {
    await AppExitWatcher.requestUsageStatsPermission();
  }, []);

  const grantOverlay = useCallback(async () => {
    await AppExitWatcher.requestOverlayPermission();
  }, []);

  const grantNotifications = useCallback(async () => {
    await AppExitWatcher.requestNotificationPermission();
  }, []);

  return {
    isEnabled,
    watchedApps,
    permissions,
    isLoading,
    isPermissionModalVisible,
    isAppPickerModalVisible,
    installedApps,
    isLoadingInstalledApps,
    toggleAutoLaunch,
    refreshPermissions,
    updateWatchedAppsList,
    removeApp,
    openAppPicker,
    closeAppPicker,
    openPermissionModal,
    closePermissionModal,
    loadInstalledApps,
    grantUsageStats,
    grantOverlay,
    grantNotifications,
    isPackageWatched: (pkg: string) => isPackageWatched(pkg, watchedApps),
  };
}
