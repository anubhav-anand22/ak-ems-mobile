import { CustomPaperTheme } from "@/constants/paperTheme";
import type { WalletType } from "@/db";
import { indianNumberFormatter } from "@/lib/numFormator";
import { getWalletBoundsWarnings, WalletAdjustmentAction } from "@/lib/walletUtils";
import { useWindowDimensions, View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

type WalletCardProps = {
  wallet: WalletType;
  isMutating?: boolean;
  showDefaultOption?: boolean;
  isDefault?: boolean;
  onToggleDefault?: (wallet: WalletType) => void;
  onEdit: (wallet: WalletType) => void;
  onDelete: (wallet: WalletType) => void;
  onAdjustBalance: (
    wallet: WalletType,
    action: WalletAdjustmentAction,
  ) => void;
};

export function WalletCard({
  wallet,
  isMutating = false,
  showDefaultOption = false,
  isDefault = false,
  onToggleDefault,
  onEdit,
  onDelete,
  onAdjustBalance,
}: WalletCardProps) {
  const theme = useTheme<CustomPaperTheme>();
  const { fontScale } = useWindowDimensions();

  const boundsWarnings = getWalletBoundsWarnings({
    walletName: wallet.name,
    balance: wallet.currentBalance,
    minBalance: wallet.minBalance ?? null,
    maxBalance: wallet.maxBalance ?? null,
  });

  const hasMin =
    wallet.minBalance !== null && wallet.minBalance !== undefined;
  const hasMax =
    wallet.maxBalance !== null && wallet.maxBalance !== undefined;
  const isBelowMin =
    hasMin && wallet.currentBalance < (wallet.minBalance as number);
  const isAboveMax =
    hasMax && wallet.currentBalance > (wallet.maxBalance as number);

  return (
    <Card testID={`wallet-card-${wallet.id}`} style={{ overflow: "hidden" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: theme.colors.surface,
          paddingLeft: 12,
          paddingRight: 4,
          paddingTop: 4,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flex: 1,
          }}
        >
          <Icon
            source="wallet-outline"
            size={20}
            color={
              boundsWarnings.length > 0
                ? theme.colors.tertiary
                : theme.colors.primary
            }
          />
          <Text
            testID={`wallet-card-name-${wallet.id}`}
            variant="titleMedium"
            style={{ fontWeight: "700", flex: 1 }}
            numberOfLines={1}
          >
            {wallet.name}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {showDefaultOption && onToggleDefault ? (
            <IconButton
              testID={`wallet-card-default-btn-${wallet.id}`}
              icon={isDefault ? "star" : "star-outline"}
              size={20}
              iconColor={
                isDefault ? theme.colors.primary : theme.colors.onSurfaceVariant
              }
              disabled={isMutating}
              accessibilityLabel={
                isDefault
                  ? `${wallet.name} is default wallet`
                  : `Set ${wallet.name} as default wallet`
              }
              onPress={() => onToggleDefault(wallet)}
            />
          ) : null}
          <IconButton
            testID={`wallet-card-edit-btn-${wallet.id}`}
            icon="pencil-outline"
            size={20}
            disabled={isMutating}
            accessibilityLabel={`Edit ${wallet.name}`}
            onPress={() => onEdit(wallet)}
          />
          <IconButton
            testID={`wallet-card-delete-btn-${wallet.id}`}
            icon="delete-outline"
            size={20}
            iconColor={theme.colors.customError}
            disabled={isMutating}
            accessibilityLabel={`Delete ${wallet.name}`}
            onPress={() => onDelete(wallet)}
          />
        </View>
      </View>

      <Card.Content style={{ gap: 10, paddingTop: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 4,
          }}
        >
          <Text
            testID={`wallet-card-balance-${wallet.id}`}
            style={{
              fontSize: 24 * fontScale,
              fontWeight: "bold",
              color: theme.colors.onSurface,
            }}
          >
            ₹{indianNumberFormatter.format(wallet.currentBalance)}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            available
          </Text>
        </View>

        {(isDefault || hasMin || hasMax) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {isDefault ? (
              <Chip
                testID={`wallet-card-default-badge-${wallet.id}`}
                compact
                mode="flat"
                icon="star"
              >
                Default
              </Chip>
            ) : null}
            {hasMin ? (
              <Chip
                compact
                mode="outlined"
                icon={isBelowMin ? "alert-outline" : "arrow-collapse-down"}
                textStyle={{
                  fontSize: 12,
                  color: isBelowMin
                    ? theme.colors.tertiary
                    : theme.colors.onSurfaceVariant,
                }}
              >
                Min: ₹{indianNumberFormatter.format(wallet.minBalance!)}
              </Chip>
            ) : null}
            {hasMax ? (
              <Chip
                compact
                mode="outlined"
                icon={isAboveMax ? "alert-outline" : "arrow-collapse-up"}
                textStyle={{
                  fontSize: 12,
                  color: isAboveMax
                    ? theme.colors.tertiary
                    : theme.colors.onSurfaceVariant,
                }}
              >
                Max: ₹{indianNumberFormatter.format(wallet.maxBalance!)}
              </Chip>
            ) : null}
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginTop: 2,
          }}
        >
          <Button
            testID={`wallet-card-add-balance-btn-${wallet.id}`}
            mode="contained-tonal"
            compact
            icon="plus"
            disabled={isMutating}
            style={{ flex: 1 }}
            onPress={() => onAdjustBalance(wallet, "add")}
          >
            Add
          </Button>
          <Button
            testID={`wallet-card-subtract-balance-btn-${wallet.id}`}
            mode="outlined"
            compact
            icon="minus"
            disabled={isMutating}
            style={{ flex: 1 }}
            onPress={() => onAdjustBalance(wallet, "subtract")}
          >
            Subtract
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}
