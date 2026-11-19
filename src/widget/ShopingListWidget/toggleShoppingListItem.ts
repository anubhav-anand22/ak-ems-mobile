import {
  getShoppingListById,
  updateShoppingListCompletedItems,
} from "@/db";
import {
  createShoppingListItemToggler,
  type ShoppingListToggleStore,
} from "./widgetHelpers";

const dalShoppingListToggleStore: ShoppingListToggleStore = {
  getListById: async (listId) => {
    const existingList = await getShoppingListById(listId);
    if (!existingList) return null;
    return {
      id: existingList.id,
      products: existingList.products,
      completedItems: existingList.completedItems,
    };
  },
  saveCompletedItems: async (listId, completedItems) => {
    await updateShoppingListCompletedItems(listId, completedItems);
  },
};

export const toggleShoppingListItemInDb = createShoppingListItemToggler(
  dalShoppingListToggleStore,
);
