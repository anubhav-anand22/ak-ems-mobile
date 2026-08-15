import { useGlobalState } from "@/lib/gState";
import {
  Button,
  Dialog,
  Portal,
  Text,
  useTheme,
  TextInput,
  HelperText,
} from "react-native-paper";
import { View } from "react-native";
import { CustomPaperTheme } from "@/constants/paperTheme";
import { useEffect, useState } from "react";

export const Confirm = () => {
  const theme = useTheme<CustomPaperTheme>();
  const confirmDataObj = useGlobalState((s) => s.confirmDataArr.at(-1));
  const popConfirm = useGlobalState((s) => s.popConfirm);
  const [inpVal, setInpVal] = useState("");
  const [isInpValid, setIsInpValid] = useState(true);
  const [inpErrMsg, setInpErrMsg] = useState("");

  useEffect(() => {
    setInpVal("");
    setIsInpValid(true);
  }, [confirmDataObj?.id]);

  return (
    <Portal>
      <Dialog visible={!!confirmDataObj}>
        {confirmDataObj === undefined ? (
          <Dialog.Title>Confirm</Dialog.Title>
        ) : (
          <View>
            <Dialog.Title>{confirmDataObj.title}</Dialog.Title>
            <Dialog.Content>
              {confirmDataObj.body ? (
                <Text variant="bodyMedium">{confirmDataObj.body}</Text>
              ) : null}
              {confirmDataObj.inputBox ? (
                <>
                  <TextInput
                    autoFocus
                    label={confirmDataObj.inputBox.label}
                    value={inpVal}
                    error={!isInpValid}
                    mode="outlined"
                    keyboardType={confirmDataObj.inputBox.keyboardType}
                    onChangeText={(txt) => {
                      setInpVal(
                        confirmDataObj?.inputBox?.inpControllFn
                          ? confirmDataObj.inputBox.inpControllFn(txt)
                          : txt,
                      );
                      if (confirmDataObj?.inputBox?.validateFn) {
                        setIsInpValid(
                          confirmDataObj.inputBox.validateFn(txt).isValid,
                        );
                        setInpErrMsg(
                          confirmDataObj.inputBox.validateFn(txt).errMsg ?? "",
                        );
                      } else {
                        setIsInpValid(true);
                        setInpErrMsg("");
                      }
                    }}
                  />
                  {inpErrMsg && (
                    <HelperText variant="bodySmall" type="error">
                      {inpErrMsg}
                    </HelperText>
                  )}
                </>
              ) : null}
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
                  if (confirmDataObj.inputBox?.acceptOnValidOnly && !isInpValid)
                    return;
                  if (confirmDataObj.inputBox?.onConfirm)
                    confirmDataObj.inputBox.onConfirm(inpVal);
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
