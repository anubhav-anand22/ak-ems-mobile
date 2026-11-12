import { GoalCard } from "@/components/goals/GoalCard";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { ConfirmDeleteDialog } from "@/components/shopping-list/ConfirmDeleteDialog";
import Seperator from "@/components/ui/Seperator";
import { CustomPaperTheme } from "@/constants/paperTheme";
import type { GoalType } from "@/db/schema";
import { useGoals } from "@/hooks/useGoals";
import { getRandomStr } from "@/lib/getRandomStr";
import {
  getGoalTab,
  GoalTabType,
  NormalizedGoalValues,
  validatePositiveGoalDeltaText,
} from "@/lib/goalsUtils";
import { useGlobalState } from "@/lib/gState";
import { log } from "@/lib/log";
import { indianNumberFormatter } from "@/lib/numFormator";
import { sanitizeDecimalInput } from "@/lib/shoppingListUtils";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  FAB,
  Icon,
  Menu,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";

export default function Goals() {
  const theme = useTheme<CustomPaperTheme>();
  const dimensions = useWindowDimensions();
  const addConfirm = useGlobalState((s) => s.addConfirm);
  const setSnackbar = useGlobalState((s) => s.setSnackbar);

  const [activeTab, setActiveTab] = useState<GoalTabType>("active");
  const {
    goals,
    counts,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    createGoal,
    updateGoal,
    adjustGoalProgress,
    deleteGoal,
  } = useGoals(activeTab);

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalType | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<GoalType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [mutatingGoalIds, setMutatingGoalIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [menuState, setMenuState] = useState<{
    x: number;
    y: number;
    goal: GoalType;
  } | null>(null);

  const hasFocusedOnceRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }
      refresh();
    }, [refresh]),
  );

  const setGoalMutating = useCallback((goalId: number, active: boolean) => {
    setMutatingGoalIds((prev) => {
      const next = new Set(prev);
      if (active) {
        next.add(goalId);
      } else {
        next.delete(goalId);
      }
      return next;
    });
  }, []);

  const openCreateModal = () => {
    setEditingGoal(null);
    setFormSubmitError(null);
    setFormModalVisible(true);
  };

  const openEditModal = (goal: GoalType) => {
    setEditingGoal(goal);
    setFormSubmitError(null);
    setFormModalVisible(true);
  };

  const handleFormSubmit = async (
    values: NormalizedGoalValues,
    wasCurrentClamped: boolean,
  ) => {
    if (isSavingForm) return;
    setIsSavingForm(true);
    setFormSubmitError(null);

    try {
      if (editingGoal) {
        const result = await updateGoal(editingGoal.id, values);
        setFormModalVisible(false);
        setEditingGoal(null);

        if (!result) {
          setSnackbar({
            message: "Goal was not found",
            type: "error",
            action: "dismiss",
          });
          return;
        }

        if (wasCurrentClamped) {
          setSnackbar({
            message: `Goal updated (current clamped to ₹${indianNumberFormatter.format(result.updatedGoal.targetMoney)})`,
            type: "info",
            duration: 3000,
          });
        } else if (result.movedTabs && result.nextTab === "achieved") {
          setSnackbar({
            message: `"${result.updatedGoal.targetName}" marked as Achieved`,
            type: "success",
            duration: 2500,
          });
        } else if (result.movedTabs && result.nextTab === "active") {
          setSnackbar({
            message: `"${result.updatedGoal.targetName}" moved to Active`,
            type: "info",
            duration: 2500,
          });
        } else {
          setSnackbar({
            message: "Goal updated",
            type: "success",
            duration: 2500,
          });
        }
      } else {
        const created = await createGoal(values);
        const createdTab = getGoalTab(created);
        setFormModalVisible(false);
        setEditingGoal(null);

        if (createdTab !== activeTab) {
          setActiveTab(createdTab);
        }

        setSnackbar({
          message:
            createdTab === "achieved"
              ? `"${created.targetName}" added to Achieved`
              : "Goal added",
          type: "success",
          duration: 2500,
        });
      }
    } catch (err) {
      log.error("Failed to save goal", err);
      setFormSubmitError("Failed to save goal. Please try again.");
      setSnackbar({
        message: "Failed to save goal",
        type: "error",
        action: "dismiss",
      });
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleAdjustDelta = useCallback(
    async (goal: GoalType, delta: number) => {
      setGoalMutating(goal.id, true);
      try {
        const result = await adjustGoalProgress(goal.id, delta);
        if (!result) return;

        if (result.movedTabs && result.nextTab === "achieved") {
          setSnackbar({
            message: `"${result.updatedGoal.targetName}" achieved! Moved to Achieved tab`,
            type: "success",
            duration: 3000,
          });
        } else if (result.movedTabs && result.nextTab === "active") {
          setSnackbar({
            message: `"${result.updatedGoal.targetName}" moved back to Active tab`,
            type: "info",
            duration: 2500,
          });
        }
      } catch (err) {
        log.error("Failed to update goal progress", err);
        setSnackbar({
          message: "Failed to update goal progress",
          type: "error",
          action: "dismiss",
        });
      } finally {
        setGoalMutating(goal.id, false);
      }
    },
    [adjustGoalProgress, setGoalMutating, setSnackbar],
  );

  const openCustomAdjustConfirm = (
    goal: GoalType,
    direction: "add" | "deduct",
  ) => {
    const isAdd = direction === "add";
    addConfirm({
      id: getRandomStr(),
      title: isAdd ? "Add to Goal" : "Deduct from Goal",
      body: isAdd
        ? `Add funds to "${goal.targetName}" (max ₹${indianNumberFormatter.format(goal.targetMoney)}).`
        : `Deduct funds from "${goal.targetName}" (min ₹0).`,
      inputBox: {
        label: isAdd ? "Amount to add (₹)" : "Amount to deduct (₹)",
        keyboardType: "numeric",
        acceptOnValidOnly: true,
        inpControllFn: sanitizeDecimalInput,
        validateFn: (txt) =>
          validatePositiveGoalDeltaText(sanitizeDecimalInput(txt)),
        onConfirm: (txt) => {
          const check = validatePositiveGoalDeltaText(sanitizeDecimalInput(txt));
          if (!check.isValid || check.amount === undefined) return;
          handleAdjustDelta(goal, isAdd ? check.amount : -check.amount);
        },
      },
      confirmTxt: isAdd ? "Add" : "Deduct",
      confirmBtnType: isAdd ? "SUCCESS" : "DANGER",
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const removed = await deleteGoal(deleteTarget.id);
      if (removed) {
        setSnackbar({
          message: `Deleted "${deleteTarget.targetName}"`,
          type: "success",
          duration: 2500,
        });
      }
      setDeleteTarget(null);
    } catch (err) {
      log.error("Failed to delete goal", err);
      setDeleteError("Failed to delete goal. Please try again.");
      setSnackbar({
        message: "Failed to delete goal",
        type: "error",
        action: "dismiss",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const menuGoal = menuState?.goal ?? null;

  return (
    <>
      <Appbar.Header>
        <Appbar.Content title="Goals" />
        <Appbar.Action
          testID="goals-reload-btn"
          icon="reload"
          onPress={refresh}
        />
      </Appbar.Header>

      <Menu
        visible={menuState !== null}
        anchor={
          menuState ? { x: menuState.x, y: menuState.y } : { x: 0, y: 0 }
        }
        onDismiss={() => setMenuState(null)}
      >
        <Menu.Item
          testID="goal-menu-add-custom"
          leadingIcon="cash-plus"
          title="Add custom amount"
          disabled={
            menuGoal ? menuGoal.currentMoney >= menuGoal.targetMoney : false
          }
          onPress={() => {
            const target = menuGoal;
            setMenuState(null);
            if (target) openCustomAdjustConfirm(target, "add");
          }}
        />
        <Menu.Item
          testID="goal-menu-deduct-custom"
          leadingIcon="cash-minus"
          title="Deduct custom amount"
          disabled={menuGoal ? menuGoal.currentMoney <= 0 : false}
          onPress={() => {
            const target = menuGoal;
            setMenuState(null);
            if (target) openCustomAdjustConfirm(target, "deduct");
          }}
        />
        <Menu.Item
          testID="goal-menu-edit"
          leadingIcon="pencil"
          title="Edit"
          onPress={() => {
            const target = menuGoal;
            setMenuState(null);
            if (target) openEditModal(target);
          }}
        />
        <Menu.Item
          testID="goal-menu-delete"
          leadingIcon="delete"
          title="Delete"
          onPress={() => {
            const target = menuGoal;
            setMenuState(null);
            if (target) {
              setDeleteError(null);
              setDeleteTarget(target);
            }
          }}
        />
      </Menu>

      <FlashList
        testID="goals-list"
        ListHeaderComponent={
          <View style={{ marginBottom: 10 }}>
            <SegmentedButtons
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as GoalTabType)}
              buttons={[
                {
                  value: "active",
                  label: `Active (${counts.active})`,
                  testID: "goals-tab-active",
                },
                {
                  value: "achieved",
                  label: `Achieved (${counts.achieved})`,
                  testID: "goals-tab-achieved",
                },
              ]}
              theme={{ roundness: 2 }}
            />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View
              testID="goals-loading-state"
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 48,
                gap: 10,
              }}
            >
              <ActivityIndicator size="small" />
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Loading goals...
              </Text>
            </View>
          ) : error ? (
            <View
              testID="goals-error-state"
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 36,
                gap: 10,
              }}
            >
              <Text
                style={{
                  fontWeight: "500",
                  fontSize: 16,
                  textAlign: "center",
                  color: theme.colors.customError,
                }}
              >
                {error}
              </Text>
              <Button mode="contained-tonal" onPress={refresh}>
                Retry
              </Button>
            </View>
          ) : (
            <View
              testID={`goals-empty-${activeTab}`}
              style={{
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                paddingVertical: 30,
                gap: 10,
              }}
            >
              <Text
                style={{ fontWeight: "500", fontSize: 18, textAlign: "center" }}
              >
                {activeTab === "active"
                  ? "No active goals\nTap + to add one"
                  : "No achieved goals yet\nKeep saving toward your targets"}
              </Text>
              <Icon
                source={
                  activeTab === "active"
                    ? "cloud-question-outline"
                    : "trophy-outline"
                }
                size={Math.min(dimensions.width, dimensions.height) / 5}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          )
        }
        onEndReached={() => {
          if (hasMore && !isLoading && !isLoadingMore) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.1}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
        data={goals}
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            isMutating={mutatingGoalIds.has(item.id)}
            onAdjustDelta={handleAdjustDelta}
            onOpenMenu={(goal, x, y) => setMenuState({ goal, x, y })}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        ItemSeparatorComponent={Seperator.S10}
        contentContainerStyle={{ padding: 10 }}
        ListFooterComponent={
          <View>
            {isLoadingMore ? (
              <View style={{ paddingVertical: 14, alignItems: "center" }}>
                <ActivityIndicator size="small" />
              </View>
            ) : null}
            <View style={{ width: 100, height: 150 }} />
          </View>
        }
      />

      <FAB
        testID="goals-add-fab"
        icon="plus"
        style={styles.fab}
        onPress={openCreateModal}
      />

      <GoalFormModal
        visible={formModalVisible}
        initialGoal={editingGoal}
        isSubmitting={isSavingForm}
        submitError={formSubmitError}
        onDismiss={() => {
          setFormModalVisible(false);
          setEditingGoal(null);
          setFormSubmitError(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDeleteDialog
        visible={deleteTarget !== null}
        title="Delete Goal"
        itemName={deleteTarget?.targetName ?? ""}
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
