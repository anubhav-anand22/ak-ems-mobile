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
    if (confirmDataObj?.inputBox?.validateFn) {
      const res = confirmDataObj.inputBox.validateFn("");
      setIsInpValid(res.isValid);
      setInpErrMsg(res.errMsg ?? "");
    } else if (confirmDataObj?.inputBox?.acceptOnValidOnly) {
      setIsInpValid(false);
      setInpErrMsg("");
    } else {
      setIsInpValid(true);
      setInpErrMsg("");
    }
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
                    testID="confirm-dialog-input"
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
            <Dialog.Actions
              style={{
                flexWrap: "wrap",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <Button
                testID="confirm-dialog-cancel-btn"
                mode="contained-tonal"
                compact
                style={{ marginRight: 0, maxWidth: "100%" }}
                contentStyle={{ paddingHorizontal: 8 }}
                labelStyle={{ flexShrink: 1 }}
                onPress={() => {
                  if (confirmDataObj.onCancel) confirmDataObj.onCancel();
                  popConfirm();
                }}
              >
                {confirmDataObj.cancelTxt || "Cancel"}
              </Button>
              {(confirmDataObj.aditionalBtns || []).map((btnData, i) => (
                <Button
                  key={btnData.id}
                  testID={`confirm-dialog-additional-btn-${i}`}
                  mode="contained-tonal"
                  compact
                  style={{ marginRight: 0, maxWidth: "100%" }}
                  contentStyle={{ paddingHorizontal: 8 }}
                  labelStyle={{ flexShrink: 1 }}
                  onPress={() => {
                    btnData.onPress();
                    popConfirm();
                  }}
                  textColor={
                    btnData.type === "DANGER"
                      ? theme.colors.customError
                      : btnData.type === "SUCCESS"
                        ? theme.colors.customSuccess
                        : undefined
                  }
                >
                  {btnData.txt}
                </Button>
              ))}
              <Button
                testID="confirm-dialog-confirm-btn"
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
                compact
                style={{ marginRight: 0, maxWidth: "100%" }}
                contentStyle={{ paddingHorizontal: 8 }}
                labelStyle={{ flexShrink: 1 }}
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
