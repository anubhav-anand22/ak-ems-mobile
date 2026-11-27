import { CustomPaperTheme } from "@/constants/paperTheme";
import type { WalletType } from "@/db";
import {
  DIALOG_BOTTOM_PADDING,
  DIALOG_TOP_PADDING,
  useKeyboardDialogScroll,
} from "@/hooks/useKeyboardDialogScroll";
import { sanitizeDecimalInput } from "@/lib/shoppingListUtils";
import {
  NormalizedWalletValues,
  validateWalletInput,
  WalletFormErrors,
} from "@/lib/walletUtils";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  ScrollView,
  TextInput as RNTextInput,
  View,
} from "react-native";
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  TextInput,
  useTheme,
} from "react-native-paper";

type WalletFormFieldKey =
  | "name"
  | "currentBalance"
  | "minBalance"
  | "maxBalance";

type WalletFormModalProps = {
  visible: boolean;
  initialWallet: WalletType | null;
  isSubmitting?: boolean;
  submitError?: string | null;
  onDismiss: () => void;
  onSubmit: (
    values: NormalizedWalletValues,
    warnings: string[],
  ) => void | Promise<void>;
};

export function WalletFormModal({
  visible,
  initialWallet,
  isSubmitting = false,
  submitError = null,
  onDismiss,
  onSubmit,
}: WalletFormModalProps) {
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
  } = useKeyboardDialogScroll<WalletFormFieldKey>(visible);

  const [name, setName] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [minBalance, setMinBalance] = useState("");
  const [maxBalance, setMaxBalance] = useState("");
  const [errors, setErrors] = useState<WalletFormErrors>({});

  const balanceRef = useRef<RNTextInput>(null);
  const minBalanceRef = useRef<RNTextInput>(null);
  const maxBalanceRef = useRef<RNTextInput>(null);
  const wasVisibleRef = useRef(false);
  const lastWalletKeyRef = useRef<string | number | null>(null);

  useEffect(() => {
    const walletKey = initialWallet ? initialWallet.id : "new";
    if (
      visible &&
      (!wasVisibleRef.current || lastWalletKeyRef.current !== walletKey)
    ) {
      if (initialWallet) {
        setName(initialWallet.name);
        setCurrentBalance(String(initialWallet.currentBalance));
        setMinBalance(
          initialWallet.minBalance !== null &&
            initialWallet.minBalance !== undefined
            ? String(initialWallet.minBalance)
            : "",
        );
        setMaxBalance(
          initialWallet.maxBalance !== null &&
            initialWallet.maxBalance !== undefined
            ? String(initialWallet.maxBalance)
            : "",
        );
      } else {
        setName("");
        setCurrentBalance("");
        setMinBalance("");
        setMaxBalance("");
      }
      setErrors({});
      resetScrollOffset();
      lastWalletKeyRef.current = walletKey;
    } else if (!visible) {
      lastWalletKeyRef.current = null;
      resetScrollOffset();
    }
    wasVisibleRef.current = visible;
  }, [visible, initialWallet, resetScrollOffset]);

  const liveWarnings = useMemo(() => {
    const res = validateWalletInput({
      name: name || "Wallet",
      currentBalance,
      minBalance,
      maxBalance,
    });
    return res.isValid ? res.warnings : [];
  }, [name, currentBalance, minBalance, maxBalance]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const validation = validateWalletInput({
      name,
      currentBalance,
      minBalance,
      maxBalance,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      const firstErrorField: WalletFormFieldKey | null =
        validation.errors.name
          ? "name"
          : validation.errors.currentBalance
            ? "currentBalance"
            : validation.errors.minBalance
              ? "minBalance"
              : validation.errors.maxBalance
                ? "maxBalance"
                : null;
      if (firstErrorField) {
        requestAnimationFrame(() => scrollFieldIntoView(firstErrorField));
      }
      return;
    }

    Keyboard.dismiss();
    setErrors({});
    await onSubmit(validation.values, validation.warnings);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    Keyboard.dismiss();
    onDismiss();
  };

  const isEditMode = initialWallet !== null;

  return (
    <Portal>
      <Dialog
        testID="wallet-form-dialog"
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
          {isEditMode ? "Edit Wallet" : "Add Wallet"}
        </Dialog.Title>
        <Dialog.Content
          style={{
            flexShrink: 1,
            paddingBottom: contentPaddingBottom,
          }}
        >
          <ScrollView
            ref={scrollViewRef}
            testID="wallet-form-scroll-view"
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
            <View style={{ gap: 8 }}>
              <View onLayout={(e) => registerFieldLayout("name", e)}>
                <TextInput
                  testID="wallet-form-name-input"
                  mode="outlined"
                  label="Wallet Name *"
                  placeholder="e.g., Cash, HDFC Bank, UPI"
                  maxLength={80}
                  autoFocus={visible && !isEditMode}
                  disabled={isSubmitting}
                  error={Boolean(errors.name)}
                  value={name}
                  returnKeyType="next"
                  onFocus={() => handleFieldFocus("name")}
                  onBlur={() => handleFieldBlur("name")}
                  onChangeText={(txt) => {
                    setName(txt);
                    if (errors.name && txt.trim()) {
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  onSubmitEditing={() => balanceRef.current?.focus()}
                />
                {errors.name ? (
                  <HelperText
                    testID="wallet-form-name-error"
                    type="error"
                    visible
                    padding="none"
                  >
                    {errors.name}
                  </HelperText>
                ) : null}
              </View>

              <View onLayout={(e) => registerFieldLayout("currentBalance", e)}>
                <TextInput
                  ref={balanceRef}
                  testID="wallet-form-balance-input"
                  mode="outlined"
                  label="Current Balance (optional)"
                  placeholder="0"
                  keyboardType="decimal-pad"
                  left={<TextInput.Affix text="₹" />}
                  disabled={isSubmitting}
                  error={Boolean(errors.currentBalance)}
                  value={currentBalance}
                  returnKeyType="next"
                  onFocus={() => handleFieldFocus("currentBalance")}
                  onBlur={() => handleFieldBlur("currentBalance")}
                  onChangeText={(txt) => {
                    setCurrentBalance(sanitizeDecimalInput(txt));
                    if (errors.currentBalance) {
                      setErrors((prev) => ({
                        ...prev,
                        currentBalance: undefined,
                      }));
                    }
                  }}
                  onSubmitEditing={() => minBalanceRef.current?.focus()}
                />
                {errors.currentBalance ? (
                  <HelperText
                    testID="wallet-form-balance-error"
                    type="error"
                    visible
                    padding="none"
                  >
                    {errors.currentBalance}
                  </HelperText>
                ) : null}
              </View>

              <View onLayout={(e) => registerFieldLayout("minBalance", e)}>
                <TextInput
                  ref={minBalanceRef}
                  testID="wallet-form-min-input"
                  mode="outlined"
                  label="Minimum Balance (optional)"
                  placeholder="No minimum limit"
                  keyboardType="decimal-pad"
                  left={<TextInput.Affix text="₹" />}
                  disabled={isSubmitting}
                  error={Boolean(errors.minBalance)}
                  value={minBalance}
                  returnKeyType="next"
                  onFocus={() => handleFieldFocus("minBalance")}
                  onBlur={() => handleFieldBlur("minBalance")}
                  onChangeText={(txt) => {
                    setMinBalance(sanitizeDecimalInput(txt));
                    if (errors.minBalance) {
                      setErrors((prev) => ({ ...prev, minBalance: undefined }));
                    }
                  }}
                  onSubmitEditing={() => maxBalanceRef.current?.focus()}
                />
                {errors.minBalance ? (
                  <HelperText
                    testID="wallet-form-min-error"
                    type="error"
                    visible
                    padding="none"
                  >
                    {errors.minBalance}
                  </HelperText>
                ) : null}
              </View>

              <View onLayout={(e) => registerFieldLayout("maxBalance", e)}>
                <TextInput
                  ref={maxBalanceRef}
                  testID="wallet-form-max-input"
                  mode="outlined"
                  label="Maximum Balance (optional)"
                  placeholder="No maximum limit"
                  keyboardType="decimal-pad"
                  left={<TextInput.Affix text="₹" />}
                  disabled={isSubmitting}
                  error={Boolean(errors.maxBalance)}
                  value={maxBalance}
                  returnKeyType="done"
                  onFocus={() => handleFieldFocus("maxBalance")}
                  onBlur={() => handleFieldBlur("maxBalance")}
                  onChangeText={(txt) => {
                    setMaxBalance(sanitizeDecimalInput(txt));
                    if (errors.maxBalance) {
                      setErrors((prev) => ({ ...prev, maxBalance: undefined }));
                    }
                  }}
                  onSubmitEditing={handleSubmit}
                />
                {errors.maxBalance ? (
                  <HelperText
                    testID="wallet-form-max-error"
                    type="error"
                    visible
                    padding="none"
                  >
                    {errors.maxBalance}
                  </HelperText>
                ) : null}
              </View>

              {liveWarnings.map((warn, idx) => (
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
            testID="wallet-form-cancel-btn"
            mode="contained-tonal"
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={handleClose}
          >
            Cancel
          </Button>
          <Button
            testID="wallet-form-submit-btn"
            mode="contained"
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={handleSubmit}
          >
            {isEditMode ? "Save" : "Add Wallet"}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
