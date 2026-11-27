import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_WALLET_ID_KEY = "wallet_default_id";

export async function getDefaultWalletId(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(DEFAULT_WALLET_ID_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function setDefaultWalletId(
  walletId: number | null,
): Promise<void> {
  if (walletId === null) {
    await AsyncStorage.removeItem(DEFAULT_WALLET_ID_KEY);
  } else {
    await AsyncStorage.setItem(DEFAULT_WALLET_ID_KEY, String(walletId));
  }
}
