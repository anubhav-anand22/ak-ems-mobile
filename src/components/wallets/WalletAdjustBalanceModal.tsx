import { CustomPaperTheme } from "@/constants/paperTheme";
import type { WalletType } from "@/db";
import {
  DIALOG_BOTTOM_PADDING,
  DIALOG_TOP_PADDING,
  useKeyboardDialogScroll,
} from "@/hooks/useKeyboardDialogScroll";
import { indianNumberFormatter } from "@/lib/numFormator";
import { sanitizeDecimalInput } from "@/lib/shoppingListUtils";
import {
  validateWalletAdjustmentInput,
  WalletAdjustmentAction,
} from "@/lib/walletUtils";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, ScrollView, View } from "react-native";
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

type AdjustFieldKey = "amount" | "note";

type WalletAdjustBalanceModalProps = {
  visible: boolean;
  wallet: WalletType | null;
  initialAction?: WalletAdjustmentAction;
  isSubmitting?: boolean;
  submitError?: string | null;
  onDismiss: () => void;
  onSubmit: (params: {
    walletId: number;
    amount: number;
    action: WalletAdjustmentAction;
    note: string;
    warnings: string[];
  }) => void | Promise<void>;
};

export function WalletAdjustBalanceModal({
  visible,
  wallet,
  initialAction = "add",
  isSubmitting = false,
  submitError = null,
  onDismiss,
  onSubmit,
}: WalletAdjustBalanceModalProps) {
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
  } = useKeyboardDialogScroll<AdjustFieldKey>(visible);

  const [action, setAction] = useState<WalletAdjustmentAction>(initialAction);
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setAction(initialAction);
      setAmountText("");
      setNote("");
      setError(null);
      resetScrollOffset();
    } else if (!visible) {
      resetScrollOffset();
    }
    wasVisibleRef.current = visible;
  }, [visible, initialAction, resetScrollOffset]);

  const previewValidation = useMemo(() => {
    if (!wallet || !amountText.trim()) return null;
    return validateWalletAdjustmentInput({
      amountText,
      action,
      wallet,
    });
  }, [wallet, amountText, action]);

  const handleSubmit = async () => {
    if (!wallet || isSubmitting) return;

    const validation = validateWalletAdjustmentInput({
      amountText,
      action,
      wallet,
    });
    if (!validation.isValid) {
      setError(validation.error);
      requestAnimationFrame(() => scrollFieldIntoView("amount"));
      return;
    }

    Keyboard.dismiss();
    setError(null);
    await onSubmit({
      walletId: wallet.id,
      amount: validation.amount,
      action,
      note: note.trim(),
      warnings: validation.warnings,
    });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    Keyboard.dismiss();
    onDismiss();
  };

  return (
    <Portal>
      <Dialog
        testID="wallet-adjust-dialog"
        visible={visible}
        dismissable={!isSubmitting}
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
          Adjust Balance{wallet ? `: ${wallet.name}` : ""}
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
              {wallet ? (
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
                    Current Balance
                  </Text>
                  <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                    ₹{indianNumberFormatter.format(wallet.currentBalance)}
                  </Text>
                </Surface>
              ) : null}

              <SegmentedButtons
                value={action}
                onValueChange={(val) => {
                  setAction(val as WalletAdjustmentAction);
                  setError(null);
                }}
                buttons={[
                  {
                    value: "add",
                    label: "Add (+)",
                    icon: "plus",
                    disabled: isSubmitting,
                  },
                  {
                    value: "subtract",
                    label: "Subtract (-)",
                    icon: "minus",
                    disabled: isSubmitting,
                  },
                ]}
              />

              <View onLayout={(e) => registerFieldLayout("amount", e)}>
                <TextInput
                  testID="wallet-adjust-amount-input"
                  mode="outlined"
                  label="Amount *"
                  placeholder="0"
                  keyboardType="decimal-pad"
                  left={<TextInput.Affix text="₹" />}
                  autoFocus={visible}
                  disabled={isSubmitting}
                  error={Boolean(error)}
                  value={amountText}
                  onFocus={() => handleFieldFocus("amount")}
                  onBlur={() => handleFieldBlur("amount")}
                  onChangeText={(txt) => {
                    setAmountText(sanitizeDecimalInput(txt));
                    if (error) setError(null);
                  }}
                />
                {error ? (
                  <HelperText
                    testID="wallet-adjust-amount-error"
                    type="error"
                    visible
                    padding="none"
                  >
                    {error}
                  </HelperText>
                ) : null}
              </View>

              <View onLayout={(e) => registerFieldLayout("note", e)}>
                <TextInput
                  testID="wallet-adjust-note-input"
                  mode="outlined"
                  label="Note (optional)"
                  placeholder={
                    action === "add" ? "e.g., ATM deposit" : "e.g., Cash out"
                  }
                  maxLength={100}
                  disabled={isSubmitting}
                  value={note}
                  onFocus={() => handleFieldFocus("note")}
                  onBlur={() => handleFieldBlur("note")}
                  onChangeText={setNote}
                  onSubmitEditing={handleSubmit}
                />
              </View>

              {previewValidation?.isValid ? (
                <View style={{ gap: 4 }}>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    New balance: ₹
                    {indianNumberFormatter.format(previewValidation.nextBalance)}
                  </Text>
                  {previewValidation.warnings.map((warn, idx) => (
                    <HelperText
                      key={idx}
                      type="info"
                      visible
                      padding="none"
                      style={{ color: theme.colors.tertiary }}
                    >
                      ⚠ {warn}
                    </HelperText>
                  ))}
                </View>
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
            testID="wallet-adjust-cancel-btn"
            mode="contained-tonal"
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={handleClose}
          >
            Cancel
          </Button>
          <Button
            testID="wallet-adjust-submit-btn"
            mode="contained"
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={handleSubmit}
          >
            {action === "add" ? "Add Balance" : "Subtract Balance"}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
