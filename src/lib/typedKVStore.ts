import AsyncStorage from "@react-native-async-storage/async-storage";

export function typedKVStore<T extends string>(key: string, def: T) {
  return {
    async get() {
      return (await AsyncStorage.getItem(key)) as T | null;
    },
    async getWithDefault() {
      const v = await AsyncStorage.getItem(key);
      if (v) {
        return v as T;
      } else {
        return def;
      }
    },
    async set(val: T) {
      await AsyncStorage.setItem(key, val);
    },
  };
}
