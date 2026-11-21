import React, { useMemo, useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Checkbox,
  Divider,
  Icon,
  IconButton,
  Searchbar,
  Text,
  useTheme,
} from "react-native-paper";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InstalledApp } from "@/hooks/useAppExitWatcher";
import { WatchedApp } from "@/lib/appExitWatcherStorage";

export type AppPickerModalProps = {
  visible: boolean;
  installedApps: InstalledApp[];
  watchedApps: WatchedApp[];
  isLoading: boolean;
  onClose: () => void;
  onSave: (selected: WatchedApp[]) => void;
};

export function AppPickerModal({
  visible,
  installedApps,
  watchedApps,
  isLoading,
  onClose,
  onSave,
}: AppPickerModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMap, setSelectedMap] = useState<Map<string, WatchedApp>>(
    new Map(),
  );

  // Sync selectedMap whenever modal opens or watchedApps changes
  useEffect(() => {
    if (visible) {
      const map = new Map<string, WatchedApp>();
      for (const app of watchedApps) {
        map.set(app.packageName, app);
      }
      setSelectedMap(map);
      setSearchQuery("");
    }
  }, [visible, watchedApps]);

  const toggleSelect = (app: InstalledApp) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(app.packageName)) {
        next.delete(app.packageName);
      } else {
        next.set(app.packageName, {
          packageName: app.packageName,
          appName: app.appName,
          iconBase64: app.iconBase64,
          isSuggestedPaymentApp: app.isSuggestedPaymentApp,
        });
      }
      return next;
    });
  };

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return installedApps;
    return installedApps.filter(
      (a) =>
        a.appName.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q),
    );
  }, [installedApps, searchQuery]);

  const suggestedApps = useMemo(() => {
    return filteredApps.filter((a) => a.isSuggestedPaymentApp);
  }, [filteredApps]);

  const otherApps = useMemo(() => {
    return filteredApps.filter((a) => !a.isSuggestedPaymentApp);
  }, [filteredApps]);

  const handleSave = () => {
    onSave(Array.from(selectedMap.values()));
    onClose();
  };

  const selectAllSuggested = () => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      for (const app of suggestedApps) {
        next.set(app.packageName, {
          packageName: app.packageName,
          appName: app.appName,
          iconBase64: app.iconBase64,
          isSuggestedPaymentApp: app.isSuggestedPaymentApp,
        });
      }
      return next;
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top || 16,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <IconButton
              icon="close"
              size={24}
              onPress={onClose}
              style={styles.closeBtn}
            />
            <View>
              <Text variant="titleMedium" style={styles.headerTitle}>
                Select Apps to Watch
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {selectedMap.size} app{selectedMap.size === 1 ? "" : "s"} selected
              </Text>
            </View>
          </View>
          <Button mode="contained" onPress={handleSave}>
            Save
          </Button>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search installed apps..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchbar}
          />
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" />
            <Text
              variant="bodyMedium"
              style={[
                styles.loadingText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Loading installed applications...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={styles.listContent}
          >
            {/* Suggested Payment Apps Section */}
            {suggestedApps.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleWithBadge}>
                    <Icon
                      source="star-circle"
                      size={20}
                      color={theme.colors.primary}
                    />
                    <Text
                      variant="titleSmall"
                      style={[
                        styles.sectionTitle,
                        { color: theme.colors.primary },
                      ]}
                    >
                      Suggested Payment Apps
                    </Text>
                  </View>
                  <Button
                    compact
                    mode="text"
                    onPress={selectAllSuggested}
                    labelStyle={styles.selectAllLabel}
                  >
                    Select All
                  </Button>
                </View>

                {suggestedApps.map((app) => {
                  const isChecked = selectedMap.has(app.packageName);
                  return (
                    <Pressable
                      key={app.packageName}
                      onPress={() => toggleSelect(app)}
                      style={[
                        styles.appRow,
                        isChecked && {
                          backgroundColor:
                            theme.colors.elevation.level2,
                        },
                      ]}
                    >
                      <View style={styles.appIconContainer}>
                        {app.iconBase64 ? (
                          <Image
                            source={{ uri: app.iconBase64 }}
                            style={styles.appIcon}
                            contentFit="contain"
                          />
                        ) : (
                          <Icon
                            source="cellphone"
                            size={28}
                            color={theme.colors.primary}
                          />
                        )}
                      </View>
                      <View style={styles.appTextContainer}>
                        <Text variant="bodyLarge" style={styles.appName}>
                          {app.appName}
                        </Text>
                        <Text
                          variant="bodySmall"
                          numberOfLines={1}
                          style={[
                            styles.appPackage,
                            { color: theme.colors.onSurfaceVariant },
                          ]}
                        >
                          {app.packageName}
                        </Text>
                      </View>
                      <Checkbox
                        status={isChecked ? "checked" : "unchecked"}
                        onPress={() => toggleSelect(app)}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {suggestedApps.length > 0 && otherApps.length > 0 ? (
              <Divider style={styles.sectionDivider} />
            ) : null}

            {/* Other Installed Apps Section */}
            {otherApps.length > 0 ? (
              <View style={styles.section}>
                <Text
                  variant="titleSmall"
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  All Other Apps ({otherApps.length})
                </Text>

                {otherApps.map((app) => {
                  const isChecked = selectedMap.has(app.packageName);
                  return (
                    <Pressable
                      key={app.packageName}
                      onPress={() => toggleSelect(app)}
                      style={[
                        styles.appRow,
                        isChecked && {
                          backgroundColor:
                            theme.colors.elevation.level2,
                        },
                      ]}
                    >
                      <View style={styles.appIconContainer}>
                        {app.iconBase64 ? (
                          <Image
                            source={{ uri: app.iconBase64 }}
                            style={styles.appIcon}
                            contentFit="contain"
                          />
                        ) : (
                          <Icon
                            source="application"
                            size={28}
                            color={theme.colors.outline}
                          />
                        )}
                      </View>
                      <View style={styles.appTextContainer}>
                        <Text variant="bodyLarge" style={styles.appName}>
                          {app.appName}
                        </Text>
                        <Text
                          variant="bodySmall"
                          numberOfLines={1}
                          style={[
                            styles.appPackage,
                            { color: theme.colors.onSurfaceVariant },
                          ]}
                        >
                          {app.packageName}
                        </Text>
                      </View>
                      <Checkbox
                        status={isChecked ? "checked" : "unchecked"}
                        onPress={() => toggleSelect(app)}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {filteredApps.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon
                  source="magnify-remove-outline"
                  size={48}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginTop: 8,
                  }}
                >
                  No apps found matching &quot;{searchQuery}&quot;
                </Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeBtn: {
    margin: 0,
  },
  headerTitle: {
    fontWeight: "bold",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchbar: {
    borderRadius: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    opacity: 0.8,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sectionTitleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  selectAllLabel: {
    fontSize: 12,
  },
  sectionDivider: {
    marginVertical: 12,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  appIconContainer: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  appTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  appName: {
    fontWeight: "600",
  },
  appPackage: {
    fontSize: 12,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: "center",
    justifyContent: "center",
  },
});
