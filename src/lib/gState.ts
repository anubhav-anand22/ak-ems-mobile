import { IconSource } from "react-native-paper/lib/typescript/components/Icon";
import { create } from "zustand";

export type SnackbarState = {
  visible: boolean;
  message: string;
  icon?: IconSource;
  onIconPress?: () => void;
  duration?: number;
  type?: "success" | "error" | "info" | "warning";
  action?:
    | {
        label: string;
        onPress: () => void;
        textColor?: string;
      }
    | "dismiss";
};

export type SnackbarInput = Omit<SnackbarState, "visible"> & {
  visible?: boolean;
};

export type ConfirmData = {
  id: string;
  title: string;
  body?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmTxt?: string;
  cancelTxt?: string;
  inputBox?: {
    label?: string;
    validateFn?: (txt: string) => { isValid: boolean; errMsg?: string };
    acceptOnValidOnly?: boolean;
    keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
    onConfirm?: (txt: string) => void;
    inpControllFn?: (txt: string) => string;
  };
  confirmBtnType?: "DANGER" | "SUCCESS" | "DEFAULT";
};

export type GlobalState = {
  title: string;
  setTitle: (newTitle: string) => void;
  addTagDialogShow: boolean;
  setAddTagDialogShow: (show: boolean) => void;
  snackbar: SnackbarState | null;
  setSnackbar: (snackbar: SnackbarInput | null) => void;
  dismissSnackbar: () => void;
  confirmDataArr: ConfirmData[];
  addConfirm: (obj: ConfirmData) => void;
  removeConfirm: (id: string) => void;
  popConfirm: () => void;
};

export const useGlobalState = create<GlobalState>((set) => ({
  title: "",
  setTitle: (newTitle: string) => set({ title: newTitle }),
  addTagDialogShow: false,
  setAddTagDialogShow: (show: boolean) => set({ addTagDialogShow: show }),
  snackbar: null,
  setSnackbar: (snackbar: SnackbarInput | null) =>
    set({ snackbar: { ...snackbar, visible: true } as SnackbarState | null }),
  dismissSnackbar: () => {
    set((state) => ({
      snackbar: state.snackbar ? { ...state.snackbar, visible: false } : null,
    }));
  },
  confirmDataArr: [],
  addConfirm: (obj) => {
    set((state) => ({
      confirmDataArr: [...state.confirmDataArr, obj],
    }));
  },
  removeConfirm: (id) => {
    set((s) => ({
      confirmDataArr: s.confirmDataArr.filter((e) => e.id !== id),
    }));
  },
  popConfirm: () => {
    set((s) => {
      const newConfirmDataArr = [...s.confirmDataArr];
      newConfirmDataArr.pop();
      return {
        confirmDataArr: newConfirmDataArr,
      };
    });
  },
}));
