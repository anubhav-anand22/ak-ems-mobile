import type { ShoppingCartType, ShoppingProduct } from "@/db/schema";

export type ShoppingProductFormInput = {
  productName: string;
  amount?: string;
  quantity?: string;
  unit?: string;
};

export type ShoppingProductFormErrors = {
  productName?: string;
  amount?: string;
  quantity?: string;
};

export type ShoppingProductValidationResult =
  | {
      isValid: true;
      product: ShoppingProduct;
      errors: ShoppingProductFormErrors;
    }
  | {
      isValid: false;
      errors: ShoppingProductFormErrors;
    };

const VALID_DECIMAL_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

export const sanitizeDecimalInput = (value: string): string =>
  value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

export const validateShoppingProductInput = (
  input: ShoppingProductFormInput,
): ShoppingProductValidationResult => {
  const trimmedName = input.productName.trim();
  const trimmedAmount = (input.amount ?? "").trim();
  const trimmedQuantity = (input.quantity ?? "").trim();
  const trimmedUnit = (input.unit ?? "").trim();

  const errors: ShoppingProductFormErrors = {};

  if (!trimmedName) {
    errors.productName = "Item name cannot be empty.";
  }

  let parsedAmount: number | undefined;
  if (trimmedAmount.length > 0) {
    const numeric = Number(trimmedAmount);
    if (
      !VALID_DECIMAL_PATTERN.test(trimmedAmount) ||
      !Number.isFinite(numeric) ||
      numeric < 0
    ) {
      errors.amount = "Enter a valid non-negative amount.";
    } else {
      parsedAmount = Number(numeric.toFixed(2));
    }
  }

  let parsedQuantity: number | undefined;
  if (trimmedQuantity.length > 0) {
    const numeric = Number(trimmedQuantity);
    if (
      !VALID_DECIMAL_PATTERN.test(trimmedQuantity) ||
      !Number.isFinite(numeric) ||
      numeric <= 0
    ) {
      errors.quantity = "Quantity must be greater than 0.";
    } else {
      parsedQuantity = Number(numeric.toFixed(2));
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    product: {
      productName: trimmedName,
      amount: parsedAmount,
      quantity: parsedQuantity,
      unit: trimmedUnit || undefined,
    },
    errors,
  };
};

export const appendProductToShoppingList = (
  lists: ShoppingCartType[],
  listId: number,
  product: ShoppingProduct,
  updatedAt: Date = new Date(),
): ShoppingCartType[] =>
  lists.map((list) =>
    list.id === listId
      ? {
          ...list,
          products: [...list.products, product],
          updatedAt,
        }
      : list,
  );

export type RemoveProductResult = {
  updatedLists: ShoppingCartType[];
  nextProducts: ShoppingProduct[];
  nextCompletedItems: string[];
  removedProduct: ShoppingProduct;
};

export const removeProductFromShoppingListByIndex = (
  lists: ShoppingCartType[],
  listId: number,
  productIndex: number,
  updatedAt: Date = new Date(),
): RemoveProductResult | null => {
  const targetList = lists.find((list) => list.id === listId);
  if (!targetList || productIndex < 0 || productIndex >= targetList.products.length) {
    return null;
  }

  const removedProduct = targetList.products[productIndex];
  const nextProducts = targetList.products.filter(
    (_, idx) => idx !== productIndex,
  );
  const stillHasSameName = nextProducts.some(
    (p) => p.productName === removedProduct.productName,
  );
  const currentCompleted = targetList.completedItems ?? [];
  const nextCompletedItems = stillHasSameName
    ? [...currentCompleted]
    : currentCompleted.filter((name) => name !== removedProduct.productName);

  const updatedLists = lists.map((list) =>
    list.id === listId
      ? {
          ...list,
          products: nextProducts,
          completedItems: nextCompletedItems,
          updatedAt,
        }
      : list,
  );

  return {
    updatedLists,
    nextProducts,
    nextCompletedItems,
    removedProduct,
  };
};

export const updateShoppingListMetadata = (
  lists: ShoppingCartType[],
  listId: number,
  updates: {
    note: string | null;
    location: ShoppingCartType["location"];
  },
  updatedAt: Date = new Date(),
): ShoppingCartType[] =>
  lists.map((list) =>
    list.id === listId
      ? {
          ...list,
          note: updates.note,
          location: updates.location,
          updatedAt,
        }
      : list,
  );

export const updateShoppingListCompletedItems = (
  lists: ShoppingCartType[],
  listId: number,
  completedItems: string[],
): ShoppingCartType[] =>
  lists.map((list) =>
    list.id === listId
      ? {
          ...list,
          completedItems: [...completedItems],
        }
      : list,
  );

export const toggleShoppingProductCompleted = (
  completedItems: string[] | null | undefined,
  productName: string,
): string[] => {
  const current = Array.isArray(completedItems) ? completedItems : [];
  if (current.includes(productName)) {
    return current.filter((item) => item !== productName);
  }
  return [...current, productName];
};
