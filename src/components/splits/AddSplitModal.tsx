import { CustomPaperTheme } from "@/constants/paperTheme";
import type { SplitParticipant } from "@/db/schema";
import {
  DIALOG_BOTTOM_PADDING,
  DIALOG_TOP_PADDING,
  useKeyboardDialogScroll,
} from "@/hooks/useKeyboardDialogScroll";
import { indianNumberFormatter } from "@/lib/numFormator";
import { sanitizeDecimalInput } from "@/lib/shoppingListUtils";
import {
  hasContactParticipants,
  hasMeParticipant,
  recalculateSplitParticipantsForMode,
  roundSplitMoney,
  SplitDistributionMode,
  validateSplitSubmission,
} from "@/lib/splitUtils";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, View } from "react-native";
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  Divider,
  HelperText,
  IconButton,
  Portal,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

type AddSplitFieldKey = "totalAmount";

type AddSplitModalProps = {
  visible: boolean;
  isNestedModalOpen?: boolean;
  isSubmitting?: boolean;
  submitError?: string | null;
  distributionMode: SplitDistributionMode;
  onChangeDistributionMode: (mode: SplitDistributionMode) => void;
  participants: SplitParticipant[];
  onChangeParticipants: (participants: SplitParticipant[]) => void;
  onTotalAmountChange: (totalAmount: number) => void;
  onOpenAddParticipant: (isMe: boolean) => void;
  onOpenEditParticipant: (participant: SplitParticipant) => void;
  onDismiss: () => void;
  onSubmitSplit: (params: {
    totalAmount: number;
    participants: SplitParticipant[];
    sendSms: boolean;
    addTx: boolean;
  }) => void | Promise<void>;
};

export function AddSplitModal({
  visible,
  isNestedModalOpen = false,
  isSubmitting = false,
  submitError = null,
  distributionMode,
  onChangeDistributionMode,
  participants,
  onChangeParticipants,
  onTotalAmountChange,
  onOpenAddParticipant,
  onOpenEditParticipant,
  onDismiss,
  onSubmitSplit,
}: AddSplitModalProps) {
  const theme = useTheme<CustomPaperTheme>();
  const {
    scrollViewRef,
    scrollOffsetRef,
    layoutMetrics,
    titlePaddingTop,
    titlePaddingBottom,
    contentPaddingBottom,
    actionsPaddingBottom,
    setTitleHeight,
    setActionsHeight,
    scrollFieldIntoView,
    handleFieldFocus,
    handleFieldBlur,
    registerFieldLayout,
    handleScrollViewLayout,
    resetScrollOffset,
  } = useKeyboardDialogScroll<AddSplitFieldKey>(visible);

  const [totalAmountText, setTotalAmountText] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setTotalAmountText("");
      onTotalAmountChange(0);
      setSendSms(true);
      setError(null);
      resetScrollOffset();
    } else if (!visible) {
      resetScrollOffset();
    }
    wasVisibleRef.current = visible;
  }, [visible, onTotalAmountChange, resetScrollOffset]);

  const totalAmount = useMemo(() => {
    const num = Number(totalAmountText);
    return Number.isFinite(num) && num > 0 ? roundSplitMoney(num) : 0;
  }, [totalAmountText]);

  const isTotalValid = totalAmount > 0;
  const meExists = useMemo(() => hasMeParticipant(participants), [participants]);
  const anyContactPhone = useMemo(
    () => hasContactParticipants(participants),
    [participants],
  );

  const allocatedMoney = useMemo(
    () =>
      roundSplitMoney(
        participants.reduce((sum, p) => sum + p.calculatedMoney, 0),
      ),
    [participants],
  );

  const liveSubmissionCheck = useMemo(() => {
    if (!isTotalValid || participants.length === 0) return null;
    return validateSplitSubmission({ totalAmount, participants });
  }, [isTotalValid, totalAmount, participants]);

  const handleTotalChange = (txt: string) => {
    const cleaned = sanitizeDecimalInput(txt);
    setTotalAmountText(cleaned);
    if (error) setError(null);

    const parsed = Number(cleaned);
    const nextTotal =
      Number.isFinite(parsed) && parsed > 0 ? roundSplitMoney(parsed) : 0;
    onTotalAmountChange(nextTotal);
    if (participants.length > 0) {
      onChangeParticipants(
        recalculateSplitParticipantsForMode(
          nextTotal,
          participants,
          distributionMode,
        ),
      );
    }
  };

  const handleDistributionModeChange = (nextMode: SplitDistributionMode) => {
    onChangeDistributionMode(nextMode);
    if (error) setError(null);
    if (participants.length > 0) {
      onChangeParticipants(
        recalculateSplitParticipantsForMode(totalAmount, participants, nextMode),
      );
    }
  };

  const handleRemoveParticipant = (id: string) => {
    const remaining = participants.filter((p) => p.id !== id);
    onChangeParticipants(
      recalculateSplitParticipantsForMode(
        totalAmount,
        remaining,
        distributionMode,
      ),
    );
    if (error) setError(null);
  };

  const handleActionSubmit = async (addTx: boolean) => {
    if (isSubmitting) return;
    const validation = validateSplitSubmission({
      totalAmount,
      participants,
    });
    if (!validation.isValid) {
      setError(validation.error);
      requestAnimationFrame(() => scrollFieldIntoView("totalAmount"));
      return;
    }

    Keyboard.dismiss();
    setError(null);
    await onSubmitSplit({
      totalAmount,
      participants,
      sendSms: anyContactPhone && sendSms,
      addTx,
    });
  };

  const handleClose = () => {
    if (isSubmitting || isNestedModalOpen) return;
    Keyboard.dismiss();
    onDismiss();
  };

  return (
    <Portal>
      <Dialog
        testID="add-split-dialog"
        visible={visible}
        dismissable={!isSubmitting && !isNestedModalOpen}
        onDismiss={handleClose}
        style={{
          marginTop: DIALOG_TOP_PADDING,
          marginBottom:
            DIALOG_BOTTOM_PADDING + layoutMetrics.extraKeyboardBottomMargin,
          maxHeight: layoutMetrics.dialogMaxHeight,
        }}
      >
        <Dialog.Title
          style={{
            flexShrink: 0,
            marginTop: 0,
            marginBottom: 0,
            paddingTop: titlePaddingTop,
            paddingBottom: titlePaddingBottom,
          }}
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            setTitleHeight((prev) => (prev !== nextHeight ? nextHeight : prev));
          }}
        >
          Money Split
        </Dialog.Title>
        <Dialog.Content
          style={{
            flexShrink: 1,
            paddingBottom: contentPaddingBottom,
          }}
        >
          <ScrollView
            ref={scrollViewRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            scrollEventThrottle={16}
            onScroll={(event) => {
              scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
            }}
            onLayout={handleScrollViewLayout}
            style={{
              flexGrow: 0,
              flexShrink: 1,
              maxHeight: layoutMetrics.scrollMaxHeight,
            }}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            <View style={{ gap: 12 }}>
              <View onLayout={(e) => registerFieldLayout("totalAmount", e)}>
                <TextInput
                  testID="split-total-amount-input"
                  mode="outlined"
                  label="Total Amount *"
                  placeholder="0"
                  keyboardType="decimal-pad"
                  left={<TextInput.Affix text="₹" />}
                  disabled={isSubmitting}
                  value={totalAmountText}
                  onFocus={() => handleFieldFocus("totalAmount")}
                  onBlur={() => handleFieldBlur("totalAmount")}
                  onChangeText={handleTotalChange}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Split Type
                </Text>
                <SegmentedButtons
                  value={distributionMode}
                  onValueChange={(val) =>
                    !isSubmitting &&
                    handleDistributionModeChange(val as SplitDistributionMode)
                  }
                  buttons={[
                    { value: "equal", label: "Equal" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button
                  testID="split-add-participant-btn"
                  mode="contained-tonal"
                  icon="account-plus-outline"
                  disabled={!isTotalValid || isSubmitting}
                  style={{ flex: 1 }}
                  onPress={() => onOpenAddParticipant(false)}
                >
                  Add Participant
                </Button>
                <Button
                  testID="split-add-me-btn"
                  mode="outlined"
                  icon="account-check-outline"
                  disabled={!isTotalValid || meExists || isSubmitting}
                  style={{ flex: 1 }}
                  onPress={() => onOpenAddParticipant(true)}
                >
                  Add Me
                </Button>
              </View>

              {participants.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      variant="labelMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Participants ({participants.length})
                    </Text>
                    <Text
                      variant="labelSmall"
                      style={{
                        color:
                          liveSubmissionCheck && !liveSubmissionCheck.isValid
                            ? theme.colors.customError
                            : theme.colors.onSurfaceVariant,
                      }}
                    >
                      Allocated: ₹{indianNumberFormatter.format(allocatedMoney)} / ₹
                      {indianNumberFormatter.format(totalAmount)}
                    </Text>
                  </View>

                  {participants.map((p) => (
                    <Surface
                      key={p.id}
                      testID={`split-participant-row-${p.id}`}
                      elevation={0}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: theme.colors.surfaceVariant,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <Text
                            variant="bodyMedium"
                            style={{ fontWeight: "700" }}
                            numberOfLines={1}
                          >
                            {p.name}
                          </Text>
                          {p.phoneNumber ? (
                            <Chip
                              compact
                              mode="outlined"
                              icon="phone-outline"
                              textStyle={{ fontSize: 11 }}
                            >
                              {p.phoneNumber}
                            </Chip>
                          ) : null}
                        </View>
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          ₹{indianNumberFormatter.format(p.calculatedMoney)} •{" "}
                          {p.calculatedPercentage.toFixed(2)}%
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row" }}>
                        <IconButton
                          testID={`split-edit-participant-${p.id}`}
                          icon="pencil-outline"
                          size={18}
                          disabled={isSubmitting}
                          onPress={() => onOpenEditParticipant(p)}
                          style={{ margin: 0 }}
                        />
                        <IconButton
                          testID={`split-remove-participant-${p.id}`}
                          icon="close-circle-outline"
                          size={18}
                          iconColor={theme.colors.customError}
                          disabled={isSubmitting}
                          onPress={() => handleRemoveParticipant(p.id)}
                          style={{ margin: 0 }}
                        />
                      </View>
                    </Surface>
                  ))}
                </View>
              ) : (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Enter a total amount above, then add participants or yourself
                  to split the bill.
                </Text>
              )}

              {anyContactPhone ? (
                <>
                  <Divider />
                  <Pressable
                    testID="split-send-sms-toggle"
                    onPress={() => !isSubmitting && setSendSms((v) => !v)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Checkbox
                      status={sendSms ? "checked" : "unchecked"}
                      onPress={() => setSendSms((v) => !v)}
                      disabled={isSubmitting}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" style={{ fontWeight: "600" }}>
                        Send SMS
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        Notify participants with a phone number of their share
                      </Text>
                    </View>
                  </Pressable>
                </>
              ) : null}

              {error || (liveSubmissionCheck && !liveSubmissionCheck.isValid) ? (
                <HelperText
                  testID="add-split-error"
                  type="error"
                  visible
                  padding="none"
                >
                  {error || (!liveSubmissionCheck?.isValid ? liveSubmissionCheck?.error : "")}
                </HelperText>
              ) : null}

              {submitError ? (
                <HelperText
                  type="error"
                  visible={Boolean(submitError)}
                  padding="none"
                  style={{ color: theme.colors.customError }}
                >
                  {submitError}
                </HelperText>
              ) : null}
            </View>
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions
          style={{
            flexWrap: "wrap",
            rowGap: 8,
            flexGrow: 0,
            flexShrink: 0,
            paddingTop: 4,
            paddingBottom: actionsPaddingBottom,
          }}
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            setActionsHeight((prev) =>
              prev !== nextHeight ? nextHeight : prev,
            );
          }}
        >
          <Button
            testID="add-split-cancel-btn"
            mode="contained-tonal"
            disabled={isSubmitting}
            style={{ paddingHorizontal: 10 }}
            onPress={handleClose}
          >
            Cancel
          </Button>
          {meExists ? (
            <Button
              testID="add-split-save-tx-btn"
              mode="contained-tonal"
              icon="plus-circle-outline"
              loading={isSubmitting}
              disabled={isSubmitting}
              style={{ paddingHorizontal: 10 }}
              onPress={() => handleActionSubmit(true)}
            >
              Split & Add Tx
            </Button>
          ) : null}
          <Button
            testID="add-split-save-btn"
            mode="contained"
            icon="call-split"
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={() => handleActionSubmit(false)}
          >
            Split
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
