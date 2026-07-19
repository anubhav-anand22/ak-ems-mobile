import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
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

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // const title = useGlobalState((s) => s.title);
  const { success, error } = useMigrations(db, migrations);

  const paperTheme = useMemo(() => {
    return colorScheme === "dark" ? paperThemeDark : paperThemeLight;
  }, [colorScheme]);

  useEffect(() => {
    ReactiveKVStore.reactiveKVStoreInit();
  }, []);

  useLayoutEffect(() => {
    if (success) {
      SplashScreen.hide();
    }
  }, [success]);

  useEffect(() => {
    console.log({ success, error });
  }, [success, error]);

  if (error) {
    return <Text>Migration error: {error.message}</Text>;
  }

  if (!success) {
    return <Text>Loading...</Text>;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <KeyboardProvider>
        <PaperProvider theme={paperTheme}>
          <AnimatedSplashOverlay />
          {/*<AppTabs />*/}
          <AddTags />
          <GlobalSnackbar />
          <Confirm />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add-expense" />
          </Stack>
        </PaperProvider>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
