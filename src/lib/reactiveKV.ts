import { create } from "zustand";
import AsyncStore from "@react-native-async-storage/async-storage";
import { log } from "./log";

interface KVStore {
  tags: string[];
}

interface ReactiveKVStore extends KVStore {
  addTags: (tags: string[]) => void;
  deleteTags: (tags: string[]) => void;
  deleteTag: (tag: string) => void;
}

const keys: { [K in keyof KVStore]: K } = {
  tags: "tags",
};

const useReactiveKVStore = create<ReactiveKVStore>((set) => ({
  tags: [],
  addTags: (tags: string[]) =>
    set((state) => {
      const newTags = Array.from(new Set([...state.tags, ...tags]));
      AsyncStore.setItem(keys.tags, JSON.stringify(newTags));
      return { tags: newTags };
    }),
  deleteTags: (tags: string[]) =>
    set((state) => {
      const newTags = state.tags.filter((tag) => !tags.includes(tag));
      AsyncStore.setItem(keys.tags, JSON.stringify(newTags));
      return { tags: newTags };
    }),
  deleteTag: (tag: string) =>
    set((state) => {
      const newTags = state.tags.filter((t) => t !== tag);
      AsyncStore.setItem(keys.tags, JSON.stringify(newTags));
      return { tags: newTags };
    }),
}));

const reactiveKVStoreInit = () => {
  try {
    Object.keys(keys).forEach((key) => {
      AsyncStore.getItem(keys[key as keyof KVStore]).then((value) => {
        if (value) {
          useReactiveKVStore.setState({ [key]: JSON.parse(value) });
        }
      });
    });
  } catch (e) {
    log.error(e);
  }
};

const ReactiveKVStore = {
  useReactiveKVStore,
  reactiveKVStoreInit,
  keys,
};

export default ReactiveKVStore;

// type ReactiveKVStore = {
//   title: string;
//   setTitle: (newTitle: string) => void;
//   addTagDialogShow: boolean;
//   setAddTagDialogShow: (show: boolean) => void;
// };

// const Keys

// export const useReactiveKVStore = create<ReactiveKVStore>((set) => ({
//   title: "",
//   setTitle: (newTitle: string) => set({ title: newTitle }),
//   addTagDialogShow: false,
//   setAddTagDialogShow: (show: boolean) => set({ addTagDialogShow: show }),
// }));

// export const useReactiveKVStoreInit = () => {

// }

// useReactiveKVStore.setState({})
