import { ConfirmData, useGlobalState } from "./gState";

export const customConfirm = (data: ConfirmData) => {
  return new Promise((res, rej) => {
    useGlobalState.getState().addConfirm({
      ...data,
      onConfirm: () => {
        res(true);
        if (data.onConfirm) data.onConfirm();
      },
      onCancel: () => {
        rej(false);
        if (data.onCancel) data.onCancel();
      },
    });
  });
};
