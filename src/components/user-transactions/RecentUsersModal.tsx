import { CustomPaperTheme } from "@/constants/paperTheme";
import { RecentUserItem } from "@/hooks/useRecentUsers";
import { formatSmartDate } from "@/lib/formatSmartDate";
import { getInitials } from "@/lib/userTransactionsUtils";
import {
  FlatList,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Dialog,
  Divider,
  Icon,
  Portal,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

type RecentUsersModalProps = {
  visible: boolean;
  users: RecentUserItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onDismiss: () => void;
  onSelectUser: (user: RecentUserItem) => void;
  onLoadMore: () => void;
  onRetry: () => void;
};

export function RecentUsersModal({
  visible,
  users,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onDismiss,
  onSelectUser,
  onLoadMore,
  onRetry,
}: RecentUsersModalProps) {
  const theme = useTheme<CustomPaperTheme>();
  const { height } = useWindowDimensions();
  const listHeight = Math.max(240, Math.min(height * 0.52, 440));

  return (
    <Portal>
      <Dialog
        testID="recent-users-dialog"
        visible={visible}
        onDismiss={onDismiss}
        style={{ marginHorizontal: 18, maxHeight: height * 0.82 }}
      >
        <Dialog.Title>Recent Contacts</Dialog.Title>
        <Dialog.Content style={{ paddingHorizontal: 0, paddingBottom: 8 }}>
          <View style={{ height: listHeight }}>
            {isLoading && users.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <ActivityIndicator size="small" />
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Loading recent contacts...
                </Text>
              </View>
            ) : error && users.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 24,
                  gap: 10,
                }}
              >
                <Icon
                  source="alert-circle-outline"
                  size={36}
                  color={theme.colors.customError}
                />
                <Text
                  variant="bodyMedium"
                  style={{ textAlign: "center", color: theme.colors.onSurfaceVariant }}
                >
                  {error}
                </Text>
                <Button mode="contained-tonal" onPress={onRetry}>
                  Retry
                </Button>
              </View>
            ) : (
              <FlatList
                testID="recent-users-list"
                data={users}
                keyExtractor={(item) => item.toFrom}
                ItemSeparatorComponent={Divider}
                onEndReachedThreshold={0.2}
                onEndReached={() => {
                  if (hasMore && !isLoading && !isLoadingMore) {
                    onLoadMore();
                  }
                }}
                ListEmptyComponent={
                  <View
                    testID="recent-users-empty"
                    style={{
                      height: listHeight - 20,
                      justifyContent: "center",
                      alignItems: "center",
                      paddingHorizontal: 24,
                      gap: 8,
                    }}
                  >
                    <Icon
                      source="account-off-outline"
                      size={40}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text variant="titleSmall">No Contacts Yet</Text>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        textAlign: "center",
                      }}
                    >
                      Contacts appear here once transactions are recorded.
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  isLoadingMore ? (
                    <View style={{ paddingVertical: 14, alignItems: "center" }}>
                      <ActivityIndicator size="small" />
                    </View>
                  ) : error && users.length > 0 ? (
                    <View style={{ paddingVertical: 10, alignItems: "center" }}>
                      <Button mode="text" compact onPress={onLoadMore}>
                        Load more failed • Tap to retry
                      </Button>
                    </View>
                  ) : null
                }
                renderItem={({ item, index }) => (
                  <TouchableRipple
                    testID={`recent-user-row-${index}`}
                    onPress={() => onSelectUser(item)}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        gap: 12,
                      }}
                    >
                      <Avatar.Text
                        size={40}
                        label={getInitials(item.toFrom)}
                        style={{
                          backgroundColor: theme.colors.primaryContainer,
                        }}
                        color={theme.colors.onPrimaryContainer}
                      />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text variant="titleSmall" numberOfLines={1}>
                          {item.toFrom}
                        </Text>
                        <Text
                          variant="bodySmall"
                          numberOfLines={1}
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {formatSmartDate(item.latestTransactionAt)}
                          {item.phoneNumber ? ` • ${item.phoneNumber}` : ""}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text
                          variant="labelSmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {item.transactionCount} tx
                        </Text>
                        <Icon
                          source="chevron-right"
                          size={18}
                          color={theme.colors.onSurfaceVariant}
                        />
                      </View>
                    </View>
                  </TouchableRipple>
                )}
              />
            )}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button testID="recent-users-close-btn" onPress={onDismiss}>
            Close
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
