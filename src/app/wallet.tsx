import { ConfirmDeleteDialog } from "@/components/shopping-list/ConfirmDeleteDialog";
import Seperator from "@/components/ui/Seperator";
import { WalletAdjustBalanceModal } from "@/components/wallets/WalletAdjustBalanceModal";
import { WalletCard } from "@/components/wallets/WalletCard";
import { WalletFormModal } from "@/components/wallets/WalletFormModal";
import { CustomPaperTheme } from "@/constants/paperTheme";
import {
  adjustWalletBalance,
  createWallet,
  deleteWallet,
  getWallets,
  updateWallet,
  WalletType,
} from "@/db";
import { useGlobalState } from "@/lib/gState";
import { log } from "@/lib/log";
import { indianNumberFormatter } from "@/lib/numFormator";
import {
  getDefaultWalletId,
  setDefaultWalletId,
} from "@/lib/walletStorage";
import {
  NormalizedWalletValues,
  resolveEffectiveDefaultWalletId,
  roundWalletMoney,
  WalletAdjustmentAction,
} from "@/lib/walletUtils";
import updateWidget from "@/widget/updateWidget";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Chip,
  Divider,
  FAB,
  Icon,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

export default function WalletScreen() {
  const router = useRouter();
  const theme = useTheme<CustomPaperTheme>();
  const dimensions = useWindowDimensions();
  const setSnackbar = useGlobalState((s) => s.setSnackbar);

  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [defaultWalletId, setDefaultWalletState] = useState<number | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [mutatingWalletIds, setMutatingWalletIds] = useState<Set<number>>(
    new Set(),
  );

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletType | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);

  const [adjustTarget, setAdjustTarget] = useState<{
    wallet: WalletType;
    action: WalletAdjustmentAction;
  } | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<WalletType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadWallets = useCallback(async () => {
    try {
      setIsLoading(true);
      const [rows, storedDefaultId] = await Promise.all([
        getWallets(),
        getDefaultWalletId(),
      ]);
      setWallets(rows);
      const effectiveDefault = resolveEffectiveDefaultWalletId(
        rows,
        storedDefaultId,
      );
      setDefaultWalletState(effectiveDefault);
      if (storedDefaultId !== null && effectiveDefault === null) {
        await setDefaultWalletId(null);
      }
    } catch (err) {
      log.error("Failed to load wallets:", err);
      setSnackbar({
        message: "Failed to load wallets",
        type: "error",
        action: "dismiss",
      });
    } finally {
      setIsLoading(false);
    }
  }, [setSnackbar]);

  const handleSelectDefaultWallet = async (walletId: number | null) => {
    try {
      const nextId = walletId === defaultWalletId ? null : walletId;
      await setDefaultWalletId(nextId);
      setDefaultWalletState(nextId);
      const picked = wallets.find((w) => w.id === nextId);
      setSnackbar({
        message: picked
          ? `${picked.name} set as default wallet`
          : "Default wallet cleared",
        type: "info",
        action: "dismiss",
      });
    } catch (err) {
      log.error("Failed to update default wallet:", err);
      setSnackbar({
        message: "Failed to update default wallet",
        type: "error",
        action: "dismiss",
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadWallets();
    }, [loadWallets]),
  );

  const totalBalance = useMemo(
    () =>
      roundWalletMoney(
        wallets.reduce((sum, w) => sum + (Number(w.currentBalance) || 0), 0),
      ),
    [wallets],
  );

  const openCreateModal = () => {
    setEditingWallet(null);
    setFormSubmitError(null);
    setFormModalVisible(true);
  };

  const openEditModal = (wallet: WalletType) => {
    setEditingWallet(wallet);
    setFormSubmitError(null);
    setFormModalVisible(true);
  };

  const handleFormSubmit = async (
    values: NormalizedWalletValues,
    warnings: string[],
  ) => {
    try {
      setIsSavingForm(true);
      setFormSubmitError(null);

      if (editingWallet) {
        const updated = await updateWallet(editingWallet.id, {
          name: values.name,
          currentBalance: values.currentBalance,
          minBalance: values.minBalance,
          maxBalance: values.maxBalance,
        });
        if (updated) {
          setWallets((prev) =>
            prev.map((w) => (w.id === updated.id ? updated : w)),
          );
        }
        setSnackbar({
          message:
            warnings.length > 0
              ? `Wallet updated. ${warnings[0]}`
              : "Wallet updated",
          type: warnings.length > 0 ? "warning" : "success",
          action: "dismiss",
        });
      } else {
        const created = await createWallet({
          name: values.name,
          currentBalance: values.currentBalance,
          minBalance: values.minBalance,
          maxBalance: values.maxBalance,
        });
        setWallets((prev) => [...prev, created]);
        setSnackbar({
          message:
            warnings.length > 0
              ? `Wallet added. ${warnings[0]}`
              : "Wallet added",
          type: warnings.length > 0 ? "warning" : "success",
          action: "dismiss",
        });
      }

      setFormModalVisible(false);
      setEditingWallet(null);
    } catch (err: any) {
      log.error("Failed to save wallet:", err);
      setFormSubmitError(err?.message || "Failed to save wallet");
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleAdjustSubmit = async (params: {
    walletId: number;
    amount: number;
    action: WalletAdjustmentAction;
    note: string;
    warnings: string[];
  }) => {
    try {
      setIsAdjusting(true);
      setAdjustError(null);
      setMutatingWalletIds((prev) => new Set(prev).add(params.walletId));

      const { wallet: updatedWallet } = await adjustWalletBalance({
        walletId: params.walletId,
        amount: params.amount,
        action: params.action,
        note: params.note,
      });

      setWallets((prev) =>
        prev.map((w) => (w.id === updatedWallet.id ? updatedWallet : w)),
      );
      updateWidget(true);
      setAdjustTarget(null);
      setSnackbar({
        message:
          params.warnings.length > 0
            ? `Balance updated. ${params.warnings[0]}`
            : `Balance ${params.action === "add" ? "added" : "subtracted"} & recorded`,
        type: params.warnings.length > 0 ? "warning" : "success",
        action: "dismiss",
      });
    } catch (err: any) {
      log.error("Failed to adjust wallet balance:", err);
      setAdjustError(err?.message || "Failed to adjust balance");
    } finally {
      setIsAdjusting(false);
      setMutatingWalletIds((prev) => {
        const next = new Set(prev);
        next.delete(params.walletId);
        return next;
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    const targetId = deleteTarget.id;

    try {
      setIsDeleting(true);
      setDeleteError(null);
      setMutatingWalletIds((prev) => new Set(prev).add(targetId));

      await deleteWallet(targetId);
      const remaining = wallets.filter((w) => w.id !== targetId);
      setWallets(remaining);
      if (targetId === defaultWalletId || remaining.length <= 1) {
        await setDefaultWalletId(null);
        setDefaultWalletState(null);
      }
      setDeleteTarget(null);
      setSnackbar({
        message: "Wallet deleted",
        type: "info",
        action: "dismiss",
      });
    } catch (err: any) {
      log.error("Failed to delete wallet:", err);
      setDeleteError(err?.message || "Failed to delete wallet");
    } finally {
      setIsDeleting(false);
      setMutatingWalletIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  return (
    <>
      <Appbar.Header elevated>
        <Appbar.BackAction
          testID="wallet-back-btn"
          onPress={() => router.back()}
        />
        <Appbar.Content title="Wallets" />
      </Appbar.Header>

      <FlatList
        data={wallets}
        keyExtractor={(item) => item.id.toString()}
        ItemSeparatorComponent={Seperator.S10}
        contentContainerStyle={{ padding: 10, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadWallets} />
        }
        ListHeaderComponent={
          wallets.length > 0 ? (
            <Surface
              elevation={1}
              style={{
                padding: 14,
                borderRadius: 14,
                marginBottom: 10,
                backgroundColor: theme.colors.elevation.level1,
                gap: 12,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Total Balance ({wallets.length}{" "}
                    {wallets.length === 1 ? "wallet" : "wallets"})
                  </Text>
                  <Text
                    testID="wallet-total-balance"
                    variant="headlineSmall"
                    style={{ fontWeight: "700", color: theme.colors.primary }}
                  >
                    ₹{indianNumberFormatter.format(totalBalance)}
                  </Text>
                </View>
                <Icon
                  source="wallet"
                  size={28}
                  color={theme.colors.primary}
                />
              </View>

              {wallets.length > 1 ? (
                <>
                  <Divider />
                  <View style={{ gap: 6 }}>
                    <Text
                      variant="labelMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Default Wallet (auto-selected in Add Expense)
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <Chip
                        testID="wallet-default-chip-none"
                        mode={defaultWalletId === null ? "flat" : "outlined"}
                        selected={defaultWalletId === null}
                        showSelectedOverlay
                        compact
                        onPress={() => handleSelectDefaultWallet(null)}
                      >
                        None
                      </Chip>
                      {wallets.map((w) => {
                        const isSelected = defaultWalletId === w.id;
                        return (
                          <Chip
                            key={w.id}
                            testID={`wallet-default-chip-${w.id}`}
                            mode={isSelected ? "flat" : "outlined"}
                            selected={isSelected}
                            showSelectedOverlay
                            compact
                            icon={isSelected ? "star" : "star-outline"}
                            onPress={() => handleSelectDefaultWallet(w.id)}
                          >
                            {w.name}
                          </Chip>
                        );
                      })}
                    </View>
                  </View>
                </>
              ) : null}
            </Surface>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View
              testID="wallet-empty-state"
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 24,
                paddingVertical: 48,
                gap: 12,
              }}
            >
              <Icon
                source="wallet-plus-outline"
                size={Math.min(dimensions.width, dimensions.height) / 5}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                No wallets yet
              </Text>
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                Create wallets for Cash, Bank accounts, or UPI to track balances
                across transactions.
              </Text>
              <Button
                testID="wallet-empty-add-btn"
                mode="contained"
                icon="plus"
                onPress={openCreateModal}
              >
                Add Wallet
              </Button>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <WalletCard
            wallet={item}
            isMutating={mutatingWalletIds.has(item.id)}
            showDefaultOption={wallets.length > 1}
            isDefault={wallets.length > 1 && defaultWalletId === item.id}
            onToggleDefault={(w) => handleSelectDefaultWallet(w.id)}
            onEdit={openEditModal}
            onDelete={(w) => {
              setDeleteError(null);
              setDeleteTarget(w);
            }}
            onAdjustBalance={(w, action) => {
              setAdjustError(null);
              setAdjustTarget({ wallet: w, action });
            }}
          />
        )}
        ListFooterComponent={<View style={{ height: 96 }} />}
      />

      <FAB
        testID="wallet-add-fab"
        icon="plus"
        style={styles.fab}
        onPress={openCreateModal}
      />

      <WalletFormModal
        visible={formModalVisible}
        initialWallet={editingWallet}
        isSubmitting={isSavingForm}
        submitError={formSubmitError}
        onDismiss={() => {
          setFormModalVisible(false);
          setEditingWallet(null);
          setFormSubmitError(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <WalletAdjustBalanceModal
        visible={adjustTarget !== null}
        wallet={adjustTarget?.wallet ?? null}
        initialAction={adjustTarget?.action ?? "add"}
        isSubmitting={isAdjusting}
        submitError={adjustError}
        onDismiss={() => {
          setAdjustTarget(null);
          setAdjustError(null);
        }}
        onSubmit={handleAdjustSubmit}
      />

      <ConfirmDeleteDialog
        visible={deleteTarget !== null}
        title="Delete Wallet"
        itemName={deleteTarget?.name ?? ""}
        message={`Are you sure you want to delete '${deleteTarget?.name ?? ""}'? Past transactions will remain in history with their wallet link cleared.`}
        isDeleting={isDeleting}
        errorMessage={deleteError}
        onConfirm={handleConfirmDelete}
        onDismiss={() => {
          setDeleteError(null);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
