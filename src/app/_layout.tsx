import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Text, useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AddTags from "@/components/ui/AddTags";
import { Confirm } from "@/components/ui/Confirm";
import GlobalSnackbar from "@/components/ui/Snakbar";
import { db } from "@/db/dbinit";
import migrations from "@/db/drizzle/migrations";
import ReactiveKVStore from "@/lib/reactiveKV";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { paperThemeDark, paperThemeLight } from "@/constants/paperTheme";
import "react-native-reanimated";
import "react-native-gesture-handler";
import { useShareIntent } from "expo-share-intent";

SplashScreen.preventAutoHideAsync().catch((e) => {
  console.log(e);
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  // const title = useGlobalState((s) => s.title);
  const { success, error } = useMigrations(db, migrations);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  const paperTheme = useMemo(() => {
    return colorScheme === "dark" ? paperThemeDark : paperThemeLight;
  }, [colorScheme]);

  useEffect(() => {
    ReactiveKVStore.reactiveKVStoreInit();
  }, []);

  useEffect(() => {
    console.log({ success, error });
  }, [success, error]);

  useEffect(() => {
    if (!hasShareIntent) return;

    console.log(shareIntent);

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
  }, [hasShareIntent]);

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
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add-expense" />
            <Stack.Screen name="HelloWidgetPreviewScreen" />
            <Stack.Screen name="widgetSetting" />
          </Stack>
        </PaperProvider>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
