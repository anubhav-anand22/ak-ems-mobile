import { ConfirmDeleteDialog } from "@/components/shopping-list/ConfirmDeleteDialog";
import { AddSplitModal } from "@/components/splits/AddSplitModal";
import { SplitCard } from "@/components/splits/SplitCard";
import { SplitParticipantModal } from "@/components/splits/SplitParticipantModal";
import Seperator from "@/components/ui/Seperator";
import { CustomPaperTheme } from "@/constants/paperTheme";
import {
  createSplit,
  deleteSplit,
  getSplitsPaginated,
  SplitParticipant,
  SplitRecordType,
} from "@/db";
import { useGlobalState } from "@/lib/gState";
import { log } from "@/lib/log";
import { indianNumberFormatter } from "@/lib/numFormator";
import { sendDirectSMS } from "@/lib/sendDirectSMS";
import {
  buildSplitSmsMessage,
  getMeParticipantMoney,
  SplitDistributionMode,
  SPLITS_PAGE_SIZE,
} from "@/lib/splitUtils";
import * as SMS from "expo-sms";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  FlatList,
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
  Text,
  useTheme,
} from "react-native-paper";

export default function MoneySplitScreen() {
  const router = useRouter();
  const theme = useTheme<CustomPaperTheme>();
  const dimensions = useWindowDimensions();
  const setSnackbar = useGlobalState((s) => s.setSnackbar);

  const [splits, setSplits] = useState<SplitRecordType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const isFetchingRef = useRef(false);
  const offsetRef = useRef(0);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [draftDistributionMode, setDraftDistributionMode] =
    useState<SplitDistributionMode>("equal");
  const [draftTotalAmount, setDraftTotalAmount] = useState(0);
  const [draftParticipants, setDraftParticipants] = useState<
    SplitParticipant[]
  >([]);
  const [isSavingSplit, setIsSavingSplit] = useState(false);
  const [splitSubmitError, setSplitSubmitError] = useState<string | null>(null);

  const [participantModalVisible, setParticipantModalVisible] = useState(false);
  const [participantIsMe, setParticipantIsMe] = useState(false);
  const [editingParticipant, setEditingParticipant] =
    useState<SplitParticipant | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<SplitRecordType | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadSplits = useCallback(
    async (isLoadMore = false) => {
      if (isFetchingRef.current) return;
      if (isLoadMore && !hasMore) return;

      isFetchingRef.current = true;
      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        offsetRef.current = 0;
      }

      try {
        const nextOffset = isLoadMore ? offsetRef.current : 0;
        const rows = await getSplitsPaginated({
          limit: SPLITS_PAGE_SIZE,
          offset: nextOffset,
        });

        if (isLoadMore) {
          setSplits((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            return [...prev, ...rows.filter((r) => !seen.has(r.id))];
          });
        } else {
          setSplits(rows);
        }

        offsetRef.current = nextOffset + rows.length;
        setHasMore(rows.length === SPLITS_PAGE_SIZE);
      } catch (err) {
        log.error("Failed to load splits:", err);
        setSnackbar({
          message: "Failed to load money splits",
          type: "error",
          action: "dismiss",
        });
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [hasMore, setSnackbar],
  );

  useFocusEffect(
    useCallback(() => {
      loadSplits(false);
    }, [loadSplits]),
  );

  const openAddSplitModal = () => {
    setDraftDistributionMode("equal");
    setDraftTotalAmount(0);
    setDraftParticipants([]);
    setSplitSubmitError(null);
    setAddModalVisible(true);
  };

  const openAddParticipantModal = (isMe: boolean) => {
    setEditingParticipant(null);
    setParticipantIsMe(isMe);
    setParticipantModalVisible(true);
  };

  const openEditParticipantModal = (participant: SplitParticipant) => {
    setEditingParticipant(participant);
    setParticipantIsMe(participant.isMe);
    setParticipantModalVisible(true);
  };

  const dispatchSplitSms = async (
    totalAmount: number,
    participants: SplitParticipant[],
  ) => {
    const withPhones = participants.filter(
      (p) => typeof p.phoneNumber === "string" && p.phoneNumber.trim().length > 0,
    );
    if (withPhones.length === 0) return;

    const smsComposerAvailable = await SMS.isAvailableAsync().catch(() => false);

    for (let i = 0; i < withPhones.length; i++) {
      const participant = withPhones[i];
      const phone = participant.phoneNumber!.trim();
      const message = buildSplitSmsMessage({ totalAmount, participant });

      const directRes = await sendDirectSMS(phone, message).catch((err) => {
        log.error("Direct split SMS failed:", err);
        return { errMsg: "Direct SMS failed" };
      });

      if (directRes?.errMsg && smsComposerAvailable) {
        await SMS.sendSMSAsync([phone], message).catch(log.error);
      }

      if (i < withPhones.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  };

  const handleSubmitSplit = async (params: {
    totalAmount: number;
    participants: SplitParticipant[];
    sendSms: boolean;
    addTx: boolean;
  }) => {
    try {
      setIsSavingSplit(true);
      setSplitSubmitError(null);

      const created = await createSplit({
        totalAmount: params.totalAmount,
        participants: params.participants,
      });

      setSplits((prev) => [created, ...prev]);

      if (params.sendSms) {
        dispatchSplitSms(params.totalAmount, params.participants).catch(
          log.error,
        );
      }

      const meMoney = params.addTx
        ? getMeParticipantMoney(params.participants)
        : null;

      setAddModalVisible(false);
      setDraftParticipants([]);
      setDraftTotalAmount(0);

      setSnackbar({
        message: params.sendSms
          ? "Split saved & SMS notification triggered"
          : "Split saved",
        type: "success",
        action: "dismiss",
      });

      if (params.addTx && meMoney !== null && meMoney > 0) {
        router.push({
          pathname: "/add-expense",
          params: {
            amount: String(meMoney),
            from: "split",
          },
        });
      }
    } catch (err: any) {
      log.error("Failed to save split:", err);
      setSplitSubmitError(err?.message || "Failed to save split");
    } finally {
      setIsSavingSplit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    const targetId = deleteTarget.id;

    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteSplit(targetId);
      setSplits((prev) => prev.filter((item) => item.id !== targetId));
      setDeleteTarget(null);
      setSnackbar({
        message: "Split deleted",
        type: "info",
        action: "dismiss",
      });
    } catch (err: any) {
      log.error("Failed to delete split:", err);
      setDeleteError(err?.message || "Failed to delete split");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Appbar.Header elevated>
        <Appbar.BackAction
          testID="split-back-btn"
          onPress={() => router.back()}
        />
        <Appbar.Content title="Money Split" />
      </Appbar.Header>

      <FlatList
        data={splits}
        keyExtractor={(item) => item.id.toString()}
        ItemSeparatorComponent={Seperator.S10}
        contentContainerStyle={{ padding: 10, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => loadSplits(false)}
          />
        }
        onEndReached={() => {
          if (hasMore && !isLoadingMore && !isLoading) {
            loadSplits(true);
          }
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <SplitCard
            split={item}
            isDeleting={isDeleting && deleteTarget?.id === item.id}
            onDelete={(target) => {
              setDeleteError(null);
              setDeleteTarget(target);
            }}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View
              testID="split-empty-state"
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
                source="call-split"
                size={Math.min(dimensions.width, dimensions.height) / 5}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                No splits yet
              </Text>
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                Split bills by percentage, parts, or exact money and share
                everyone&apos;s share via SMS.
              </Text>
              <Button
                testID="split-empty-add-btn"
                mode="contained"
                icon="plus"
                onPress={openAddSplitModal}
              >
                New Split
              </Button>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={{ paddingVertical: 16, marginBottom: 76 }}>
            {isLoadingMore ? <ActivityIndicator size="small" /> : null}
          </View>
        }
      />

      <FAB
        testID="split-add-fab"
        icon="plus"
        style={styles.fab}
        onPress={openAddSplitModal}
      />

      <AddSplitModal
        visible={addModalVisible}
        isNestedModalOpen={participantModalVisible}
        isSubmitting={isSavingSplit}
        submitError={splitSubmitError}
        distributionMode={draftDistributionMode}
        onChangeDistributionMode={setDraftDistributionMode}
        participants={draftParticipants}
        onChangeParticipants={setDraftParticipants}
        onTotalAmountChange={setDraftTotalAmount}
        onOpenAddParticipant={openAddParticipantModal}
        onOpenEditParticipant={openEditParticipantModal}
        onDismiss={() => {
          setAddModalVisible(false);
          setSplitSubmitError(null);
        }}
        onSubmitSplit={handleSubmitSplit}
      />

      {/* Rendered after AddSplitModal so its Portal Dialog stacks strictly above it */}
      <SplitParticipantModal
        visible={participantModalVisible}
        totalAmount={draftTotalAmount}
        distributionMode={draftDistributionMode}
        isMeMode={participantIsMe}
        editingParticipant={editingParticipant}
        existingParticipants={draftParticipants}
        onDismiss={() => {
          setParticipantModalVisible(false);
          setEditingParticipant(null);
        }}
        onSave={(updatedParticipants) => {
          setDraftParticipants(updatedParticipants);
          setParticipantModalVisible(false);
          setEditingParticipant(null);
        }}
      />

      <ConfirmDeleteDialog
        visible={deleteTarget !== null}
        title="Delete Split"
        itemName={
          deleteTarget
            ? `₹${indianNumberFormatter.format(deleteTarget.totalAmount)} split`
            : ""
        }
        message={`Are you sure you want to delete this ₹${deleteTarget ? indianNumberFormatter.format(deleteTarget.totalAmount) : "0"} split?`}
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
