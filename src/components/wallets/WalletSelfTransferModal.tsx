import { CustomPaperTheme } from "@/constants/paperTheme";
import type { WalletType } from "@/db";
import {
  DIALOG_BOTTOM_PADDING,
  DIALOG_TOP_PADDING,
  useKeyboardDialogScroll,
} from "@/hooks/useKeyboardDialogScroll";
import { indianNumberFormatter } from "@/lib/numFormator";
import { sanitizeDecimalInput } from "@/lib/shoppingListUtils";
import { validateWalletTransferInput } from "@/lib/walletUtils";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, ScrollView, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

type TransferFieldKey = "amount";

type WalletSelfTransferModalProps = {
  visible: boolean;
  wallets: WalletType[];
  isSubmitting?: boolean;
  submitError?: string | null;
  onDismiss: () => void;
  onSubmit: (params: {
    fromWalletId: number;
    toWalletId: number;
    amount: number;
    warnings: string[];
  }) => void | Promise<void>;
};

export function WalletSelfTransferModal({
  visible,
  wallets,
  isSubmitting = false,
  submitError = null,
  onDismiss,
  onSubmit,
}: WalletSelfTransferModalProps) {
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
  } = useKeyboardDialogScroll<TransferFieldKey>(visible);

  const [fromWalletId, setFromWalletId] = useState<number | null>(null);
  const [toWalletId, setToWalletId] = useState<number | null>(null);
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      const firstId = wallets[0]?.id ?? null;
      const secondId = wallets.find((w) => w.id !== firstId)?.id ?? null;
      setFromWalletId(firstId);
      setToWalletId(secondId);
      setAmountText("");
      setError(null);
      resetScrollOffset();
    } else if (!visible) {
      resetScrollOffset();
    }
    wasVisibleRef.current = visible;
  }, [visible, wallets, resetScrollOffset]);

  const fromWallet = useMemo(
    () => wallets.find((w) => w.id === fromWalletId) ?? null,
    [wallets, fromWalletId],
  );
  const toWallet = useMemo(
    () => wallets.find((w) => w.id === toWalletId) ?? null,
    [wallets, toWalletId],
  );

  const previewValidation = useMemo(() => {
    if (!fromWallet || !toWallet || !amountText.trim()) return null;
    return validateWalletTransferInput({
      fromWallet,
      toWallet,
      amountText,
    });
  }, [fromWallet, toWallet, amountText]);

  const handleSelectFromWallet = (walletId: number) => {
    setError(null);
    if (walletId === toWalletId) {
      setToWalletId(fromWalletId);
    }
    setFromWalletId(walletId);
  };

  const handleSelectToWallet = (walletId: number) => {
    setError(null);
    if (walletId === fromWalletId) {
      setFromWalletId(toWalletId);
    }
    setToWalletId(walletId);
  };

  const handleSwapWallets = () => {
    if (!fromWalletId || !toWalletId || isSubmitting) return;
    setError(null);
    setFromWalletId(toWalletId);
    setToWalletId(fromWalletId);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const validation = validateWalletTransferInput({
      fromWallet,
      toWallet,
      amountText,
    });
    if (!validation.isValid) {
      setError(validation.error);
      requestAnimationFrame(() => scrollFieldIntoView("amount"));
      return;
    }

    Keyboard.dismiss();
    setError(null);
    await onSubmit({
      fromWalletId: fromWallet!.id,
      toWalletId: toWallet!.id,
      amount: validation.amount,
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
        testID="wallet-transfer-dialog"
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
          Self Transfer
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
              <View style={{ gap: 6 }}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  From Wallet
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {wallets.map((w) => {
                    const selected = w.id === fromWalletId;
                    return (
                      <Chip
                        key={`from-${w.id}`}
                        testID={`wallet-transfer-from-${w.id}`}
                        mode={selected ? "flat" : "outlined"}
                        selected={selected}
                        showSelectedOverlay
                        compact
                        disabled={isSubmitting}
                        onPress={() => handleSelectFromWallet(w.id)}
                      >
                        {w.name} (₹{indianNumberFormatter.format(w.currentBalance)})
                      </Chip>
                    );
                  })}
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  To Wallet
                </Text>
                <IconButton
                  testID="wallet-transfer-swap-btn"
                  icon="swap-vertical"
                  size={18}
                  disabled={isSubmitting || !fromWalletId || !toWalletId}
                  accessibilityLabel="Swap source and destination wallets"
                  onPress={handleSwapWallets}
                  style={{ margin: 0 }}
                />
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {wallets.map((w) => {
                  const selected = w.id === toWalletId;
                  return (
                    <Chip
                      key={`to-${w.id}`}
                      testID={`wallet-transfer-to-${w.id}`}
                      mode={selected ? "flat" : "outlined"}
                      selected={selected}
                      showSelectedOverlay
                      compact
                      disabled={isSubmitting}
                      onPress={() => handleSelectToWallet(w.id)}
                    >
                      {w.name} (₹{indianNumberFormatter.format(w.currentBalance)})
                    </Chip>
                  );
                })}
              </View>

              <View onLayout={(e) => registerFieldLayout("amount", e)}>
                <TextInput
                  testID="wallet-transfer-amount-input"
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
                  onSubmitEditing={handleSubmit}
                />
                {error ? (
                  <HelperText
                    testID="wallet-transfer-error"
                    type="error"
                    visible
                    padding="none"
                  >
                    {error}
                  </HelperText>
                ) : null}
              </View>

              {previewValidation?.isValid && fromWallet && toWallet ? (
                <Surface
                  elevation={0}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: theme.colors.surfaceVariant,
                    gap: 4,
                  }}
                >
                  <Text variant="bodySmall">
                    {fromWallet.name}: ₹
                    {indianNumberFormatter.format(fromWallet.currentBalance)} → ₹
                    {indianNumberFormatter.format(
                      previewValidation.nextFromBalance,
                    )}
                  </Text>
                  <Text variant="bodySmall">
                    {toWallet.name}: ₹
                    {indianNumberFormatter.format(toWallet.currentBalance)} → ₹
                    {indianNumberFormatter.format(
                      previewValidation.nextToBalance,
                    )}
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
                </Surface>
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
            testID="wallet-transfer-cancel-btn"
            mode="contained-tonal"
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={handleClose}
          >
            Cancel
          </Button>
          <Button
            testID="wallet-transfer-submit-btn"
            mode="contained"
            icon="swap-horizontal"
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={handleSubmit}
          >
            Transfer
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
