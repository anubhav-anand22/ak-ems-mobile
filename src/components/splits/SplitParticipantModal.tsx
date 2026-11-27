import { CustomPaperTheme } from "@/constants/paperTheme";
import type { SplitParticipant, SplitType } from "@/db/schema";
import {
  DIALOG_BOTTOM_PADDING,
  DIALOG_TOP_PADDING,
  useKeyboardDialogScroll,
} from "@/hooks/useKeyboardDialogScroll";
import { getContact } from "@/lib/getContact";
import { indianNumberFormatter } from "@/lib/numFormator";
import { sanitizeDecimalInput } from "@/lib/shoppingListUtils";
import {
  SplitDistributionMode,
  validateParticipantInput,
} from "@/lib/splitUtils";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, ScrollView, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

type ParticipantFieldKey = "name" | "value";

type SplitParticipantModalProps = {
  visible: boolean;
  totalAmount: number;
  distributionMode: SplitDistributionMode;
  isMeMode: boolean;
  editingParticipant: SplitParticipant | null;
  existingParticipants: SplitParticipant[];
  onDismiss: () => void;
  onSave: (updatedParticipants: SplitParticipant[]) => void;
};

export function SplitParticipantModal({
  visible,
  totalAmount,
  distributionMode,
  isMeMode,
  editingParticipant,
  existingParticipants,
  onDismiss,
  onSave,
}: SplitParticipantModalProps) {
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
  } = useKeyboardDialogScroll<ParticipantFieldKey>(visible);

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [splitType, setSplitType] = useState<SplitType>("percentage");
  const [splitValueText, setSplitValueText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const wasVisibleRef = useRef(false);

  const effectiveIsMe = editingParticipant ? editingParticipant.isMe : isMeMode;

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      if (editingParticipant) {
        setName(editingParticipant.isMe ? "me" : editingParticipant.name);
        setPhoneNumber(editingParticipant.phoneNumber ?? null);
        setSplitType(editingParticipant.splitType);
        setSplitValueText(String(editingParticipant.splitValue));
      } else {
        setName(isMeMode ? "me" : "");
        setPhoneNumber(null);
        setSplitType("percentage");
        setSplitValueText("");
      }
      setError(null);
      resetScrollOffset();
    } else if (!visible) {
      resetScrollOffset();
    }
    wasVisibleRef.current = visible;
  }, [visible, editingParticipant, isMeMode, resetScrollOffset]);

  const previewValidation = useMemo(() => {
    if (!visible) return null;
    if (distributionMode === "custom" && !splitValueText.trim()) return null;
    return validateParticipantInput({
      totalAmount,
      name: effectiveIsMe ? "me" : name || "Participant",
      isMe: effectiveIsMe,
      phoneNumber,
      distributionMode,
      splitType,
      splitValueText,
      existingParticipants,
      editingParticipantId: editingParticipant?.id ?? null,
    });
  }, [
    visible,
    totalAmount,
    distributionMode,
    effectiveIsMe,
    name,
    phoneNumber,
    splitType,
    splitValueText,
    existingParticipants,
    editingParticipant?.id,
  ]);

  const handlePickContact = async () => {
    try {
      const picked = await getContact();
      if (!picked) return;
      const pickedPhone = picked.phoneNumber?.[0]?.number?.trim() || null;
      if (!effectiveIsMe && picked.fullName?.trim()) {
        setName(picked.fullName.trim());
      }
      setPhoneNumber(pickedPhone);
      setError(null);
    } catch {
      // ignore cancelled/failed picker gracefully
    }
  };

  const handleSubmit = () => {
    const validation = validateParticipantInput({
      totalAmount,
      name: effectiveIsMe ? "me" : name,
      isMe: effectiveIsMe,
      phoneNumber,
      distributionMode,
      splitType,
      splitValueText,
      existingParticipants,
      editingParticipantId: editingParticipant?.id ?? null,
      newId: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    });

    if (!validation.isValid) {
      setError(validation.error);
      requestAnimationFrame(() =>
        scrollFieldIntoView(
          validation.error.toLowerCase().includes("name") ? "name" : "value",
        ),
      );
      return;
    }

    Keyboard.dismiss();
    setError(null);
    onSave(validation.recalculatedList);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onDismiss();
  };

  return (
    <Portal>
      <Dialog
        testID="split-participant-dialog"
        visible={visible}
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
          {editingParticipant
            ? "Edit Participant"
            : effectiveIsMe
              ? "Add Me"
              : "Add Participant"}
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
            <View style={{ gap: 10 }}>
              <View onLayout={(e) => registerFieldLayout("name", e)}>
                <TextInput
                  testID="split-participant-name-input"
                  mode="outlined"
                  label="Participant Name *"
                  placeholder="e.g., Alex"
                  disabled={effectiveIsMe}
                  value={effectiveIsMe ? "me" : name}
                  onFocus={() => handleFieldFocus("name")}
                  onBlur={() => handleFieldBlur("name")}
                  onChangeText={(txt) => {
                    setName(txt);
                    if (error) setError(null);
                  }}
                  right={
                    <TextInput.Icon
                      testID="split-participant-pick-contact-btn"
                      icon="contacts-outline"
                      onPress={handlePickContact}
                    />
                  }
                />
              </View>

              {phoneNumber ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Chip
                    testID="split-participant-phone-chip"
                    compact
                    mode="outlined"
                    icon="phone-outline"
                    onClose={() => setPhoneNumber(null)}
                  >
                    {phoneNumber}
                  </Chip>
                </View>
              ) : (
                <Button
                  testID="split-participant-contact-btn"
                  mode="text"
                  compact
                  icon="account-search-outline"
                  style={{ alignSelf: "flex-start" }}
                  onPress={handlePickContact}
                >
                  Pick from Contacts
                </Button>
              )}

              {distributionMode === "custom" ? (
                <>
                  <View style={{ gap: 6 }}>
                    <Text
                      variant="labelMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Split Mode
                    </Text>
                    <SegmentedButtons
                      value={splitType}
                      onValueChange={(val) => {
                        const nextType = val as SplitType;
                        setSplitType(nextType);
                        if (nextType === "part" && !splitValueText.trim()) {
                          setSplitValueText("1");
                        }
                        setError(null);
                      }}
                      buttons={[
                        { value: "percentage", label: "%" },
                        { value: "part", label: "Part" },
                        { value: "money", label: "₹ Money" },
                      ]}
                    />
                  </View>

                  <View onLayout={(e) => registerFieldLayout("value", e)}>
                    <TextInput
                      testID="split-participant-value-input"
                      mode="outlined"
                      label={
                        splitType === "percentage"
                          ? "Percentage (%) *"
                          : splitType === "money"
                            ? "Money Amount (₹) *"
                            : "Part Share (e.g., 1, 2, 0.5) *"
                      }
                      placeholder={splitType === "part" ? "1" : "0"}
                      keyboardType="decimal-pad"
                      left={
                        splitType === "money" ? (
                          <TextInput.Affix text="₹" />
                        ) : undefined
                      }
                      right={
                        splitType === "percentage" ? (
                          <TextInput.Affix text="%" />
                        ) : undefined
                      }
                      value={splitValueText}
                      onFocus={() => handleFieldFocus("value")}
                      onBlur={() => handleFieldBlur("value")}
                      onChangeText={(txt) => {
                        setSplitValueText(sanitizeDecimalInput(txt));
                        if (error) setError(null);
                      }}
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                </>
              ) : null}

              {previewValidation?.isValid ? (
                <Surface
                  elevation={0}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: theme.colors.surfaceVariant,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Calculated Share
                  </Text>
                  <Text
                    testID="split-participant-preview"
                    variant="titleSmall"
                    style={{ fontWeight: "700", color: theme.colors.primary }}
                  >
                    ₹
                    {indianNumberFormatter.format(
                      previewValidation.participant.calculatedMoney,
                    )}{" "}
                    ({previewValidation.participant.calculatedPercentage.toFixed(2)}
                    %)
                  </Text>
                </Surface>
              ) : null}

              {error ? (
                <HelperText
                  testID="split-participant-error"
                  type="error"
                  visible
                  padding="none"
                >
                  {error}
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
            testID="split-participant-cancel-btn"
            mode="contained-tonal"
            style={{ paddingHorizontal: 12 }}
            onPress={handleClose}
          >
            Cancel
          </Button>
          <Button
            testID="split-participant-save-btn"
            mode="contained"
            style={{ paddingHorizontal: 12 }}
            onPress={handleSubmit}
          >
            {editingParticipant ? "Update" : "Add"}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
