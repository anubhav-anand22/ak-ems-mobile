import { CustomPaperTheme } from "@/constants/paperTheme";
import { View } from "react-native";
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

type ConfirmDeleteDialogProps = {
  visible: boolean;
  title?: string;
  itemName: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDeleting?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void | Promise<void>;
  onDismiss: () => void;
};

export function ConfirmDeleteDialog({
  visible,
  title = "Remove Item",
  itemName,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isDeleting = false,
  errorMessage = null,
  onConfirm,
  onDismiss,
}: ConfirmDeleteDialogProps) {
  const theme = useTheme<CustomPaperTheme>();

  return (
    <Portal>
      <Dialog
        visible={visible}
        dismissable={!isDeleting}
        onDismiss={() => {
          if (!isDeleting) {
            onDismiss();
          }
        }}
      >
        <Dialog.Title testID="confirm-delete-dialog-title">
          {title}
        </Dialog.Title>
        <Dialog.Content>
          <View style={{ gap: 6 }}>
            <Text variant="bodyMedium" testID="confirm-delete-dialog-message">
              {message ?? `Are you sure you want to delete '${itemName}'?`}
            </Text>
            {errorMessage ? (
              <HelperText type="error" visible={Boolean(errorMessage)}>
                {errorMessage}
              </HelperText>
            ) : null}
          </View>
        </Dialog.Content>
        <Dialog.Actions style={{ flexWrap: "wrap", rowGap: 8 }}>
          <Button
            testID="confirm-delete-dialog-cancel-btn"
            mode="contained-tonal"
            disabled={isDeleting}
            style={{ paddingHorizontal: 12 }}
            onPress={onDismiss}
          >
            {cancelLabel}
          </Button>
          <Button
            testID="confirm-delete-dialog-confirm-btn"
            mode="contained"
            loading={isDeleting}
            disabled={isDeleting}
            buttonColor={theme.colors.customError}
            textColor={theme.colors.customOnError}
            style={{ paddingHorizontal: 12 }}
            onPress={onConfirm}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
