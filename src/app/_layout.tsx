import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Text, useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AddTags from "@/components/ui/AddTags";
import { Confirm } from "@/components/ui/Confirm";
import GlobalSnackbar from "@/components/ui/Snakbar";
import { useDatabaseMigrations } from "@/db";
import ReactiveKVStore from "@/lib/reactiveKV";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { paperThemeDark, paperThemeLight } from "@/constants/paperTheme";
import "react-native-reanimated";
import "react-native-gesture-handler";
import { useShareIntent } from "expo-share-intent";
import { log } from "@/lib/log";
import QrModal from "@/components/ui/QrModal";
import { setupGeofenceListeners } from "@/lib/setupGeofenceListeners";
import { syncActiveGeofences } from "@/lib/syncGeofences";
import * as AppExitWatcher from "app-exit-watcher";

SplashScreen.preventAutoHideAsync().catch((e) => {
  log.error(e);
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  // const title = useGlobalState((s) => s.title);
  const { success, error } = useDatabaseMigrations();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  const paperTheme = useMemo(() => {
    return colorScheme === "dark" ? paperThemeDark : paperThemeLight;
  }, [colorScheme]);

  useEffect(() => {
    ReactiveKVStore.reactiveKVStoreInit();
    const listeners = setupGeofenceListeners();
    return () => {
      listeners.removeListeners();
    };
  }, []);

  useEffect(() => {
    log.info({ success, error });
    if (success) {
      syncActiveGeofences().catch(log.error);
    }
  }, [success, error]);

  useEffect(() => {
    if (!success || !hasShareIntent) return;

    log.info(shareIntent);

    const file = shareIntent.files?.[0];
    if (!file || file.mimeType !== "application/pdf") return;

    // Navigate to your import screen
    router.push({
      pathname: "/add-expense",
      params: {
        invoicePDFPath: file.path,
      },
    });

    resetShareIntent();
  }, [success, hasShareIntent]);

  const handledInitialTriggerRef = useRef(false);

  useEffect(() => {
    if (!success || handledInitialTriggerRef.current) return;
    handledInitialTriggerRef.current = true;

    // Initial intent check on startup after root Stack is ready
    const initialPackage = AppExitWatcher.getInitialTriggerPackage();
    if (initialPackage) {
      router.push({
        pathname: "/add-expense",
        params: {
          from: "auto_watcher",
          sourcePackage: initialPackage,
        },
      });
    }
  }, [success]);

  useEffect(() => {
    // Dynamic event listener when app is brought to foreground
    const sub = AppExitWatcher.addAppExitListener((event) => {
      if (event.sourcePackage) {
        router.push({
          pathname: "/add-expense",
          params: {
            from: "auto_watcher",
            sourcePackage: event.sourcePackage,
          },
        });
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  const splashHideAsync = async () => {
    return new Promise((res, rej) => {
      const id = setInterval(() => {
        if (success) {
          SplashScreen.hideAsync().then(res).catch(rej);
          clearInterval(id);
        }
      }, 150);
    });
  };

  if (error) {
    return <Text>Migration error: {error.message}</Text>;
  }

  if (!success) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <KeyboardProvider>
        <PaperProvider theme={paperTheme}>
          {success ? (
            <AnimatedSplashOverlay splashHideAsync={splashHideAsync} />
          ) : null}
          {/*<AppTabs />*/}
          <AddTags />
          <GlobalSnackbar />
          <Confirm />
          <QrModal />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add-expense" />
            <Stack.Screen name="wallet" />
            <Stack.Screen name="HelloWidgetPreviewScreen" />
            <Stack.Screen name="widgetSetting" />
            <Stack.Screen name="logScreen" />
            <Stack.Screen name="pdfParserTest" />
          </Stack>
        </PaperProvider>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
