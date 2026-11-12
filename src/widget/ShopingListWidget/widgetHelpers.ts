import type { ShoppingCartType, ShoppingProduct } from "@/db/schema";
import { formatSmartDate } from "@/lib/formatSmartDate";
import { indianNumberFormatter } from "@/lib/numFormator";
import { toggleShoppingProductCompleted } from "@/lib/shoppingListUtils";

export const MAX_WIDGET_SHOPPING_LISTS = 3;
export const TOGGLE_SHOPPING_ITEM_ACTION = "TOGGLE_SHOPPING_ITEM";

export type HexColor = `#${string}`;

export type ShoppingWidgetPalette = {
  background: HexColor;
  text: HexColor;
  secondaryText: HexColor;
  checkedText: HexColor;
  checkedSecondaryText: HexColor;
  headerBg: HexColor;
  sectionBg: HexColor;
  divider: HexColor;
  checkboxBorder: HexColor;
};

export type ToggleShoppingItemPayload = {
  listId: number;
  productName: string;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const parseHexColor = (hex: string): RgbColor | null => {
  const cleaned = hex.trim().replace(/^#/, "");
  if (cleaned.length === 3) {
    const [r, g, b] = cleaned.split("");
    const parsed = {
      r: Number.parseInt(`${r}${r}`, 16),
      g: Number.parseInt(`${g}${g}`, 16),
      b: Number.parseInt(`${b}${b}`, 16),
    };
    return Number.isNaN(parsed.r) ||
      Number.isNaN(parsed.g) ||
      Number.isNaN(parsed.b)
      ? null
      : parsed;
  }

  if (cleaned.length === 6) {
    const parsed = {
      r: Number.parseInt(cleaned.slice(0, 2), 16),
      g: Number.parseInt(cleaned.slice(2, 4), 16),
      b: Number.parseInt(cleaned.slice(4, 6), 16),
    };
    return Number.isNaN(parsed.r) ||
      Number.isNaN(parsed.g) ||
      Number.isNaN(parsed.b)
      ? null
      : parsed;
  }

  return null;
};

const toTwoDigitHex = (value: number): string =>
  Math.min(255, Math.max(0, Math.round(value)))
    .toString(16)
    .padStart(2, "0");

export const blendHexColors = (
  fromHex: string,
  toHex: string,
  ratio: number,
): HexColor => {
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const from = parseHexColor(fromHex) ?? { r: 0, g: 0, b: 0 };
  const to = parseHexColor(toHex) ?? { r: 255, g: 255, b: 255 };

  const r = from.r + (to.r - from.r) * clampedRatio;
  const g = from.g + (to.g - from.g) * clampedRatio;
  const b = from.b + (to.b - from.b) * clampedRatio;

  return `#${toTwoDigitHex(r)}${toTwoDigitHex(g)}${toTwoDigitHex(b)}` as HexColor;
};

export const getShoppingWidgetPalette = (theme: {
  color: string;
  backgroundColor: string;
}): ShoppingWidgetPalette => {
  const text = (
    parseHexColor(theme.color) ? theme.color : "#111111"
  ) as HexColor;
  const background = (
    parseHexColor(theme.backgroundColor) ? theme.backgroundColor : "#ffffff"
  ) as HexColor;

  return {
    background,
    text,
    secondaryText: blendHexColors(text, background, 0.3),
    checkedText: blendHexColors(text, background, 0.55),
    checkedSecondaryText: blendHexColors(text, background, 0.62),
    headerBg: blendHexColors(background, text, 0.08),
    sectionBg: blendHexColors(background, text, 0.05),
    divider: blendHexColors(background, text, 0.14),
    checkboxBorder: blendHexColors(text, background, 0.25),
  };
};

export const getShoppingListUri = (
  isDev: boolean = false,
  listId?: number,
): string => {
  const scheme = isDev ? "akemsmobile-dev" : "akemsmobile";
  const baseUri = `${scheme}://(tabs)/shoping-list?isFromWidget=true`;
  if (typeof listId === "number" && Number.isFinite(listId)) {
    return `${baseUri}&listId=${listId}`;
  }
  return baseUri;
};

export const getShoppingListDisplayTitle = (
  note: string | null | undefined,
): string => {
  const trimmed = note?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Shopping List";
};

export const getCompletedCountForList = (
  list: Pick<ShoppingCartType, "products" | "completedItems">,
): number => {
  const products = Array.isArray(list.products) ? list.products : [];
  const completedSet = new Set(
    Array.isArray(list.completedItems) ? list.completedItems : [],
  );
  return products.filter((product) => completedSet.has(product.productName))
    .length;
};

export const formatShoppingProductMeta = (
  product: Pick<ShoppingProduct, "amount" | "quantity" | "unit">,
): string => {
  const parts: string[] = [];
  const trimmedUnit = product.unit?.trim();

  if (
    typeof product.quantity === "number" &&
    Number.isFinite(product.quantity) &&
    product.quantity > 0
  ) {
    const qtyStr = indianNumberFormatter.format(product.quantity);
    parts.push(trimmedUnit ? `${qtyStr} ${trimmedUnit}` : qtyStr);
  } else if (trimmedUnit) {
    parts.push(trimmedUnit);
  }

  if (
    typeof product.amount === "number" &&
    Number.isFinite(product.amount) &&
    product.amount > 0
  ) {
    parts.push(`₹${indianNumberFormatter.format(product.amount)}`);
  }

  return parts.join(" • ");
};

export const formatShoppingListDate = (
  updatedAt: Date | string | number,
): string => {
  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatSmartDate(date);
};

export const getLatestShoppingLists = (
  lists: ShoppingCartType[],
  limit: number = MAX_WIDGET_SHOPPING_LISTS,
): ShoppingCartType[] => {
  if (!Array.isArray(lists) || limit <= 0) {
    return [];
  }

  return [...lists]
    .sort((a, b) => {
      const aTime =
        a.updatedAt instanceof Date
          ? a.updatedAt.getTime()
          : new Date(a.updatedAt).getTime();
      const bTime =
        b.updatedAt instanceof Date
          ? b.updatedAt.getTime()
          : new Date(b.updatedAt).getTime();

      if (Number.isFinite(bTime) && Number.isFinite(aTime) && bTime !== aTime) {
        return bTime - aTime;
      }
      return b.id - a.id;
    })
    .slice(0, limit);
};

export const parseToggleShoppingItemData = (
  clickActionData: unknown,
): ToggleShoppingItemPayload | null => {
  if (!clickActionData || typeof clickActionData !== "object") {
    return null;
  }

  const record = clickActionData as Record<string, unknown>;
  const rawListId = record.listId;
  const rawProductName = record.productName;

  const listId =
    typeof rawListId === "number"
      ? rawListId
      : typeof rawListId === "string" && rawListId.trim().length > 0
        ? Number(rawListId)
        : Number.NaN;

  if (!Number.isInteger(listId) || listId <= 0) {
    return null;
  }

  if (typeof rawProductName !== "string" || rawProductName.length === 0) {
    return null;
  }

  return {
    listId,
    productName: rawProductName,
  };
};

export const getCheckboxSvg = (
  textColor: string,
  backgroundColor: string,
  checked: boolean,
  borderColor: string = textColor,
): string => {
  if (checked) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" fill="${textColor}"/><path d="M7.5 12.2L10.6 15.2L16.5 9" stroke="${backgroundColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="${borderColor}" stroke-width="2.2"/></svg>`;
};

export const getRefreshIconSvg = (color: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;

export type ShoppingListToggleStore = {
  getListById: (
    listId: number,
  ) => Promise<Pick<
    ShoppingCartType,
    "id" | "products" | "completedItems"
  > | null>;
  saveCompletedItems: (
    listId: number,
    completedItems: string[],
  ) => Promise<void>;
};

export const createShoppingListItemToggler = (
  store: ShoppingListToggleStore,
) => {
  let pendingToggle: Promise<void> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = pendingToggle.then(task);
    pendingToggle = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return (listId: number, productName: string): Promise<string[] | null> =>
    enqueue(async () => {
      const existingList = await store.getListById(listId);
      if (!existingList) {
        return null;
      }

      const products = Array.isArray(existingList.products)
        ? existingList.products
        : [];
      const currentCompleted = Array.isArray(existingList.completedItems)
        ? existingList.completedItems
        : [];

      if (!products.some((product) => product.productName === productName)) {
        return currentCompleted;
      }

      const nextCompletedItems = toggleShoppingProductCompleted(
        currentCompleted,
        productName,
      );
      await store.saveCompletedItems(listId, nextCompletedItems);
      return nextCompletedItems;
    });
};
