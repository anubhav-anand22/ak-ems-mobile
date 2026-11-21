import { useAppExitWatcher } from "@/hooks/useAppExitWatcher";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Divider,
  Icon,
  IconButton,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { AppPickerModal } from "./AppPickerModal";
import { PermissionSetupDialog } from "./PermissionSetupDialog";

export function AutoLaunchSection() {
  const theme = useTheme();
  const {
    isEnabled,
    watchedApps,
    permissions,
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
    closePermissionModal,
    grantUsageStats,
    grantOverlay,
    grantNotifications,
  } = useAppExitWatcher();

  return (
    <>
      <Card testID="settings-auto-launch-card" style={{ paddingTop: 8 }}>
        <Card.Title
          title="Auto-Launch After Payment"
          subtitle="Automatically open expense logger when a payment app closes"
          subtitleNumberOfLines={2}
          right={() => (
            <Switch
              testID="settings-auto-launch-switch"
              value={isEnabled}
              onValueChange={(val) => {
                toggleAutoLaunch(val);
              }}
              style={styles.switch}
            />
          )}
        />

        <Card.Content>
          <Text
            variant="bodySmall"
            style={[
              styles.subtitleText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Detects when selected payment or utility apps exit foreground and
            brings up the Add Expense screen to log your payment right away.
          </Text>

          {isEnabled ? (
            <View style={styles.enabledSection}>
              <View style={styles.actionsRow}>
                <Button
                  testID="settings-select-watched-apps-btn"
                  mode="contained-tonal"
                  icon="apps"
                  onPress={openAppPicker}
                >
                  Select Apps to Watch
                </Button>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.primary, fontWeight: "600" }}
                >
                  {watchedApps.length} Watched
                </Text>
              </View>

              {watchedApps.length > 0 ? (
                <View
                  style={[
                    styles.appsListCard,
                    {
                      backgroundColor: theme.colors.elevation.level1,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  {watchedApps.map((app, index) => (
                    <React.Fragment key={app.packageName}>
                      {index > 0 ? <Divider /> : null}
                      <View style={styles.appRow}>
                        <View style={styles.appIconWrapper}>
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
                              color={theme.colors.primary}
                            />
                          )}
                        </View>
                        <View style={styles.appDetails}>
                          <Text variant="bodyMedium" style={styles.appName}>
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
                        <IconButton
                          icon="close"
                          size={18}
                          onPress={() => removeApp(app.packageName)}
                          style={styles.removeBtn}
                        />
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                <View
                  style={[
                    styles.emptyState,
                    {
                      backgroundColor: theme.colors.elevation.level1,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <Icon
                    source="apps-box"
                    size={36}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.emptyStateTitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    No payment apps selected
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.emptyStateDesc,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Tap &quot;Select Apps to Watch&quot; to pick Google Pay,
                    PhonePe, or other apps to monitor.
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </Card.Content>
      </Card>

      {/* Permission Setup Dialog */}
      <PermissionSetupDialog
        visible={isPermissionModalVisible}
        permissions={permissions}
        onDismiss={closePermissionModal}
        onGrantUsageStats={grantUsageStats}
        onGrantOverlay={grantOverlay}
        onGrantNotifications={grantNotifications}
        onRefresh={refreshPermissions}
      />

      {/* Installed Apps Picker Modal */}
      <AppPickerModal
        visible={isAppPickerModalVisible}
        installedApps={installedApps}
        watchedApps={watchedApps}
        isLoading={isLoadingInstalledApps}
        onClose={closeAppPicker}
        onSave={updateWatchedAppsList}
      />
    </>
  );
}

const styles = StyleSheet.create({
  switch: {
    marginRight: 16,
  },
  subtitleText: {
    marginBottom: 12,
    lineHeight: 18,
  },
  enabledSection: {
    marginTop: 4,
    gap: 12,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appsListCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  appIconWrapper: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  appIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  appDetails: {
    flex: 1,
    paddingRight: 6,
  },
  appName: {
    fontWeight: "600",
  },
  appPackage: {
    fontSize: 11,
  },
  removeBtn: {
    margin: 0,
  },
  emptyState: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateTitle: {
    fontWeight: "600",
    marginTop: 8,
  },
  emptyStateDesc: {
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
});
