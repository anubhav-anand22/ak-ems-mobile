import { ShoppingProduct } from "@/db/schema";
import {
  sanitizeDecimalInput,
  ShoppingProductFormErrors,
  validateShoppingProductInput,
} from "@/lib/shoppingListUtils";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  ScrollView,
  TextInput as RNTextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

type AddShoppingProductModalProps = {
  visible: boolean;
  listTitle?: string | null;
  isSubmitting?: boolean;
  submitError?: string | null;
  onDismiss: () => void;
  onSubmit: (product: ShoppingProduct) => void | Promise<void>;
};

export function AddShoppingProductModal({
  visible,
  listTitle,
  isSubmitting = false,
  submitError = null,
  onDismiss,
  onSubmit,
}: AddShoppingProductModalProps) {
  const theme = useTheme();
  const { height } = useWindowDimensions();

  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [errors, setErrors] = useState<ShoppingProductFormErrors>({});

  const amountRef = useRef<RNTextInput>(null);
  const quantityRef = useRef<RNTextInput>(null);
  const unitRef = useRef<RNTextInput>(null);

  useEffect(() => {
    if (visible) {
      setProductName("");
      setAmount("");
      setQuantity("");
      setUnit("");
      setErrors({});
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const validation = validateShoppingProductInput({
      productName,
      amount,
      quantity,
      unit,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    Keyboard.dismiss();
    setErrors({});
    await onSubmit(validation.product);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    Keyboard.dismiss();
    onDismiss();
  };

  const combinedFieldError =
    errors.amount || errors.quantity || submitError || "";

  return (
    <Portal>
      <Dialog
        visible={visible}
        dismissable={!isSubmitting}
        onDismiss={handleClose}
      >
        <Dialog.Title>Add Item</Dialog.Title>
        <Dialog.Content>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: height * 0.55 }}
          >
            <View style={{ gap: 6 }}>
              {listTitle?.trim() ? (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  List: {listTitle.trim()}
                </Text>
              ) : null}

              <TextInput
                testID="add-item-modal-name-input"
                mode="outlined"
                label="Item Name *"
                placeholder="e.g., Fresh Milk"
                autoFocus={visible}
                disabled={isSubmitting}
                error={Boolean(errors.productName)}
                value={productName}
                returnKeyType="next"
                onChangeText={(txt) => {
                  setProductName(txt);
                  if (errors.productName && txt.trim()) {
                    setErrors((prev) => ({ ...prev, productName: undefined }));
                  }
                }}
                onSubmitEditing={() => amountRef.current?.focus()}
              />
              {errors.productName ? (
                <HelperText
                  testID="add-item-modal-name-error"
                  type="error"
                  visible={Boolean(errors.productName)}
                  padding="none"
                >
                  {errors.productName}
                </HelperText>
              ) : null}

              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <TextInput
                  ref={amountRef}
                  testID="add-item-modal-amount-input"
                  mode="outlined"
                  label="Amount"
                  placeholder="0"
                  keyboardType="decimal-pad"
                  disabled={isSubmitting}
                  error={Boolean(errors.amount)}
                  style={{ flex: 1 }}
                  value={amount}
                  returnKeyType="next"
                  onChangeText={(txt) => {
                    setAmount(sanitizeDecimalInput(txt));
                    if (errors.amount) {
                      setErrors((prev) => ({ ...prev, amount: undefined }));
                    }
                  }}
                  onSubmitEditing={() => quantityRef.current?.focus()}
                />
                <TextInput
                  ref={quantityRef}
                  testID="add-item-modal-quantity-input"
                  mode="outlined"
                  label="Qty"
                  placeholder="1"
                  keyboardType="decimal-pad"
                  disabled={isSubmitting}
                  error={Boolean(errors.quantity)}
                  style={{ flex: 0.85 }}
                  value={quantity}
                  returnKeyType="next"
                  onChangeText={(txt) => {
                    setQuantity(sanitizeDecimalInput(txt));
                    if (errors.quantity) {
                      setErrors((prev) => ({ ...prev, quantity: undefined }));
                    }
                  }}
                  onSubmitEditing={() => unitRef.current?.focus()}
                />
                <TextInput
                  ref={unitRef}
                  testID="add-item-modal-unit-input"
                  mode="outlined"
                  label="Unit"
                  placeholder="kg, ml..."
                  disabled={isSubmitting}
                  style={{ flex: 1 }}
                  value={unit}
                  returnKeyType="done"
                  onChangeText={setUnit}
                  onSubmitEditing={handleSubmit}
                />
              </View>

              {combinedFieldError ? (
                <HelperText
                  type="error"
                  visible={Boolean(combinedFieldError)}
                  padding="none"
                >
                  {combinedFieldError}
                </HelperText>
              ) : null}
            </View>
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions style={{ flexWrap: "wrap", rowGap: 8 }}>
          <Button
            testID="add-item-modal-cancel-btn"
            mode="contained-tonal"
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={handleClose}
          >
            Cancel
          </Button>
          <Button
            testID="add-item-modal-submit-btn"
            mode="contained"
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ paddingHorizontal: 12 }}
            onPress={handleSubmit}
          >
            Add Item
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
