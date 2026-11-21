import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Dialog, Icon, Portal, Text, useTheme } from "react-native-paper";
import { PermissionStatus } from "@/hooks/useAppExitWatcher";

export type PermissionSetupDialogProps = {
  visible: boolean;
  permissions: PermissionStatus;
  onDismiss: () => void;
  onGrantUsageStats: () => void;
  onGrantOverlay: () => void;
  onGrantNotifications: () => void;
  onRefresh: () => void;
};

export function PermissionSetupDialog({
  visible,
  permissions,
  onDismiss,
  onGrantUsageStats,
  onGrantOverlay,
  onGrantNotifications,
  onRefresh,
}: PermissionSetupDialogProps) {
  const theme = useTheme();

  const permissionItems = [
    {
      id: "usageStats",
      title: "Usage Access",
      desc: "Detects when payment apps enter and exit foreground",
      icon: "chart-timeline-variant",
      granted: permissions.usageStats,
      onGrant: onGrantUsageStats,
    },
    {
      id: "overlay",
      title: "Display Over Other Apps",
      desc: "Allows AK EMS to auto-open when you finish paying",
      icon: "application-export",
      granted: permissions.overlay,
      onGrant: onGrantOverlay,
    },
    {
      id: "notifications",
      title: "Notifications",
      desc: "Ensures the background service stays alive reliably",
      icon: "bell-outline",
      granted: permissions.notifications,
      onGrant: onGrantNotifications,
    },
  ];

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[
          styles.dialog,
          { backgroundColor: theme.colors.elevation.level3 },
        ]}
      >
        <Dialog.Title style={styles.title}>
          <View style={styles.titleRow}>
            <Icon
              source="shield-alert-outline"
              size={26}
              color={theme.colors.primary}
            />
            <Text variant="titleMedium" style={styles.titleText}>
              Setup Permissions
            </Text>
          </View>
        </Dialog.Title>

        <Dialog.Content style={styles.content}>
          <Text
            variant="bodySmall"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Auto-Launch needs these 3 permissions to monitor payment completion
            and open the expense recorder automatically.
          </Text>

          <View style={styles.itemsList}>
            {permissionItems.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: theme.colors.elevation.level1,
                    borderColor: item.granted
                      ? "#4CAF50"
                      : theme.colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemLeft}>
                    <Icon
                      source={item.icon}
                      size={22}
                      color={
                        item.granted
                          ? "#4CAF50"
                          : theme.colors.primary
                      }
                    />
                    <Text variant="labelLarge" style={styles.itemTitle}>
                      {item.title}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: item.granted
                          ? "rgba(76, 175, 80, 0.15)"
                          : "rgba(244, 67, 54, 0.15)",
                      },
                    ]}
                  >
                    <Text
                      variant="labelSmall"
                      style={{
                        color: item.granted ? "#2E7D32" : "#D32F2F",
                        fontWeight: "600",
                      }}
                    >
                      {item.granted ? "Granted" : "Required"}
                    </Text>
                  </View>
                </View>

                <Text
                  variant="bodySmall"
                  style={[
                    styles.itemDesc,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {item.desc}
                </Text>

                {!item.granted ? (
                  <View style={styles.grantBtnRow}>
                    <Button
                      mode="contained-tonal"
                      compact
                      icon="open-in-new"
                      onPress={item.onGrant}
                      style={styles.grantBtn}
                    >
                      Grant Permission
                    </Button>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </Dialog.Content>

        <Dialog.Actions>
          <Button onPress={onRefresh} icon="refresh">
            Check Status
          </Button>
          <Button onPress={onDismiss}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 20,
    maxHeight: "85%",
  },
  title: {
    paddingBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleText: {
    fontWeight: "bold",
  },
  content: {
    paddingTop: 0,
  },
  subtitle: {
    marginBottom: 12,
    lineHeight: 18,
  },
  itemsList: {
    gap: 10,
  },
  itemCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  itemTitle: {
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  itemDesc: {
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 16,
  },
  grantBtnRow: {
    alignItems: "flex-end",
    marginTop: 4,
  },
  grantBtn: {
    borderRadius: 8,
  },
});
