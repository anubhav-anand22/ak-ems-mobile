import { useGlobalState } from "@/lib/gState";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";
import { View } from "react-native";
import { CustomPaperTheme } from "@/constants/paperTheme";

export const Confirm = () => {
  const theme = useTheme<CustomPaperTheme>();
  const confirmDataObj = useGlobalState((s) => s.confirmDataArr.at(-1));
  const popConfirm = useGlobalState((s) => s.popConfirm);

  return (
    <Portal>
      <Dialog visible={!!confirmDataObj}>
        {confirmDataObj === undefined ? (
          <Dialog.Title>Confirm</Dialog.Title>
        ) : (
          <View>
            <Dialog.Title>{confirmDataObj.title}</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">{confirmDataObj.body}</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                mode="contained-tonal"
                style={{ paddingHorizontal: 15 }}
                onPress={() => {
                  if (confirmDataObj.onCancel) confirmDataObj.onCancel();
                  popConfirm();
                }}
              >
                {confirmDataObj.cancelTxt || "Cancel"}
              </Button>
              <Button
                buttonColor={
                  confirmDataObj.confirmBtnType === "DANGER"
                    ? theme.colors.customError
                    : confirmDataObj.confirmBtnType === "SUCCESS"
                      ? theme.colors.customSuccess
                      : undefined
                }
                textColor={
                  confirmDataObj.confirmBtnType === "DANGER"
                    ? theme.colors.customOnError
                    : confirmDataObj.confirmBtnType === "SUCCESS"
                      ? theme.colors.customOnSuccess
                      : undefined
                }
                style={{ paddingHorizontal: 15 }}
                mode="contained"
                onPress={() => {
                  if (confirmDataObj.onConfirm) confirmDataObj.onConfirm();
                  popConfirm();
                }}
              >
                {confirmDataObj.confirmTxt || "Confirm"}
              </Button>
            </Dialog.Actions>
          </View>
        )}
      </Dialog>
    </Portal>
  );
};
