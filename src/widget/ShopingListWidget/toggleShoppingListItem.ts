import { db } from "@/db/dbinit";
import { dbShoppingCart } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createShoppingListItemToggler,
  type ShoppingListToggleStore,
} from "./widgetHelpers";

const drizzleShoppingListToggleStore: ShoppingListToggleStore = {
  getListById: async (listId) => {
    const [existingList] = await db
      .select({
        id: dbShoppingCart.id,
        products: dbShoppingCart.products,
        completedItems: dbShoppingCart.completedItems,
      })
      .from(dbShoppingCart)
      .where(eq(dbShoppingCart.id, listId))
      .limit(1);

    return existingList ?? null;
  },
  saveCompletedItems: async (listId, completedItems) => {
    await db
      .update(dbShoppingCart)
      .set({ completedItems })
      .where(eq(dbShoppingCart.id, listId));
  },
};

export const toggleShoppingListItemInDb = createShoppingListItemToggler(
  drizzleShoppingListToggleStore,
);
