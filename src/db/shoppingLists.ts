import { desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { dbShoppingCart, ShoppingCartType, ShoppingProduct } from "./schema";

export type CreateShoppingCartInput = {
  products: ShoppingProduct[];
  note?: string | null;
  location?: {
    lon: number;
    lat: number;
    geoFenceId?: string;
  } | null;
  completedItems?: string[] | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateShoppingCartInput = Partial<CreateShoppingCartInput>;

export async function getShoppingLists(options?: {
  limit?: number;
}): Promise<ShoppingCartType[]> {
  let query = getDb()
    .select()
    .from(dbShoppingCart)
    .orderBy(desc(dbShoppingCart.updatedAt), desc(dbShoppingCart.id));

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return await query;
}

export async function getAllShoppingLists(): Promise<ShoppingCartType[]> {
  return await getDb().select().from(dbShoppingCart);
}

export async function getShoppingListById(
  id: number,
): Promise<ShoppingCartType | undefined> {
  const [list] = await getDb()
    .select()
    .from(dbShoppingCart)
    .where(eq(dbShoppingCart.id, id))
    .limit(1);
  return list;
}

export async function getShoppingListsByGeofenceIds(
  ids: string[],
): Promise<ShoppingCartType[]> {
  const allLists = await getAllShoppingLists();
  return allLists.filter((item) =>
    item.location?.geoFenceId ? ids.includes(item.location.geoFenceId) : false,
  );
}

export async function createShoppingList(
  data: CreateShoppingCartInput,
): Promise<ShoppingCartType> {
  const [inserted] = await getDb()
    .insert(dbShoppingCart)
    .values({
      ...data,
      completedItems: data.completedItems ?? [],
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
    })
    .returning();
  return inserted;
}

export async function updateShoppingList(
  id: number,
  updates: UpdateShoppingCartInput,
): Promise<ShoppingCartType | undefined> {
  const [updated] = await getDb()
    .update(dbShoppingCart)
    .set({
      ...updates,
      updatedAt: updates.updatedAt ?? new Date(),
    })
    .where(eq(dbShoppingCart.id, id))
    .returning();
  return updated;
}

export async function updateShoppingListProducts(
  id: number,
  products: ShoppingProduct[],
  updatedAt: Date = new Date(),
): Promise<ShoppingCartType | undefined> {
  const [updated] = await getDb()
    .update(dbShoppingCart)
    .set({
      products,
      updatedAt,
    })
    .where(eq(dbShoppingCart.id, id))
    .returning();
  return updated;
}

export async function updateShoppingListMetadata(
  id: number,
  updates: {
    note?: string | null;
    location?: { lat: number; lon: number; geoFenceId?: string } | null;
    updatedAt?: Date;
  },
): Promise<ShoppingCartType | undefined> {
  const [updated] = await getDb()
    .update(dbShoppingCart)
    .set({
      ...updates,
      updatedAt: updates.updatedAt ?? new Date(),
    })
    .where(eq(dbShoppingCart.id, id))
    .returning();
  return updated;
}

export async function updateShoppingListProductsAndCompleted(
  id: number,
  products: ShoppingProduct[],
  completedItems: string[],
  updatedAt: Date = new Date(),
): Promise<ShoppingCartType | undefined> {
  const [updated] = await getDb()
    .update(dbShoppingCart)
    .set({
      products,
      completedItems,
      updatedAt,
    })
    .where(eq(dbShoppingCart.id, id))
    .returning();
  return updated;
}

export async function updateShoppingListCompletedItems(
  id: number,
  completedItems: string[],
  updatedAt: Date = new Date(),
): Promise<ShoppingCartType | undefined> {
  const [updated] = await getDb()
    .update(dbShoppingCart)
    .set({
      completedItems,
      updatedAt,
    })
    .where(eq(dbShoppingCart.id, id))
    .returning();
  return updated;
}

export async function toggleShoppingListItem(
  listId: number,
  productName: string,
): Promise<ShoppingCartType | undefined> {
  const list = await getShoppingListById(listId);
  if (!list) return undefined;

  const currentCompleted = new Set(list.completedItems || []);
  if (currentCompleted.has(productName)) {
    currentCompleted.delete(productName);
  } else {
    currentCompleted.add(productName);
  }

  const nextCompleted = Array.from(currentCompleted);
  return await updateShoppingListCompletedItems(listId, nextCompleted);
}

export async function deleteShoppingList(id: number): Promise<void> {
  await getDb().delete(dbShoppingCart).where(eq(dbShoppingCart.id, id));
}
