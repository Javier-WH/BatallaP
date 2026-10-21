/**
 * itemInventoryService — sizes and stock of sellable items.
 *
 * Stock of an item/size = Σ movements (ingresos/ajustes) − delivered units of
 * that size. Deliveries never create movements, so undoing a delivery gives the
 * unit back on its own. An item has inventory "configured" once it has at least
 * one movement; until then deliveries are still counted per size (sales
 * report) but never produce stock figures or warnings.
 */
import { Charge, ChargeDelivery, ItemInventoryMovement, Person, SellableItem } from '@/models/index';

export const MAX_SIZE_LENGTH = 30;

/** Trimmed, de-duplicated size list; null when empty. */
export function normalizeSizes(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const raw of input) {
    const size = String(raw ?? '').trim().slice(0, MAX_SIZE_LENGTH);
    if (size && !out.some(s => s.toLowerCase() === size.toLowerCase())) out.push(size);
  }
  return out.length ? out : null;
}

export interface SizeRow {
  /** null = units without a size (item without sizes, or deliveries made before sizes existed). */
  size: string | null;
  /** Stock on hand; null while the item has no inventory configured. */
  stock: number | null;
  /** Units handed over (filtered by period when requested). */
  delivered: number;
  /** Units received through ingreso/ajuste movements. */
  received: number;
  /** The size is no longer in the item's list but still has movements/deliveries. */
  retired: boolean;
}

export interface ItemInventory {
  itemId: number;
  sizes: string[];
  configured: boolean;
  /** Units sold (item charges) in the period (all periods when omitted). */
  sold: number;
  delivered: number;
  /** Sold units not delivered yet — their size is still to be defined. */
  pendingDelivery: number;
  rows: SizeRow[];
}

const sizeKey = (s: string | null) => s ?? '';

async function loadDeliveries(itemId: number) {
  const rows = await ChargeDelivery.findAll({
    include: [{ model: Charge, as: 'charge', attributes: ['id', 'schoolPeriodId'], where: { sellableItemId: itemId } }],
  });
  return rows.map((d: any) => ({ size: (d.size as string | null) ?? null, quantity: Number(d.quantity), schoolPeriodId: d.charge.schoolPeriodId as number }));
}

/** Stock summary of one item; `schoolPeriodId` narrows only the sold/delivered report columns, never the stock. */
export async function getItemInventory(item: SellableItem, schoolPeriodId?: number): Promise<ItemInventory> {
  const [movements, deliveries, charges] = await Promise.all([
    ItemInventoryMovement.findAll({ where: { sellableItemId: item.id } }),
    loadDeliveries(item.id),
    Charge.findAll({
      where: { sellableItemId: item.id, type: 'item', active: true, ...(schoolPeriodId ? { schoolPeriodId } : {}) },
      attributes: ['id', 'quantity'],
    }),
  ]);
  const configured = movements.length > 0;
  const listed = item.sizes ?? [];

  const received = new Map<string, number>();
  for (const m of movements) received.set(sizeKey(m.size), (received.get(sizeKey(m.size)) ?? 0) + Number(m.quantity));
  const deliveredAll = new Map<string, number>();
  const deliveredScoped = new Map<string, number>();
  for (const d of deliveries) {
    deliveredAll.set(sizeKey(d.size), (deliveredAll.get(sizeKey(d.size)) ?? 0) + d.quantity);
    if (!schoolPeriodId || d.schoolPeriodId === schoolPeriodId) {
      deliveredScoped.set(sizeKey(d.size), (deliveredScoped.get(sizeKey(d.size)) ?? 0) + d.quantity);
    }
  }

  const keys: (string | null)[] = listed.length ? [...listed] : [null];
  const extra = new Set([...received.keys(), ...deliveredAll.keys()]);
  for (const k of extra) {
    if (k === '' ? !keys.includes(null) : !keys.includes(k)) keys.push(k === '' ? null : k);
  }

  const rows: SizeRow[] = keys.map(size => {
    const k = sizeKey(size);
    const rec = received.get(k) ?? 0;
    return {
      size,
      stock: configured ? rec - (deliveredAll.get(k) ?? 0) : null,
      delivered: deliveredScoped.get(k) ?? 0,
      received: rec,
      retired: size !== null && !listed.includes(size),
    };
  });

  const sold = charges.reduce((sum, c) => sum + Math.max(Number(c.quantity ?? 1), 1), 0);
  const delivered = rows.reduce((sum, r) => sum + r.delivered, 0);
  return { itemId: item.id, sizes: listed, configured, sold, delivered, pendingDelivery: Math.max(sold - delivered, 0), rows };
}

/** Stock on hand of one item/size, or null when the item has no inventory configured. */
export async function getStock(item: SellableItem, size: string | null): Promise<number | null> {
  const inv = await getItemInventory(item);
  if (!inv.configured) return null;
  return inv.rows.find(r => r.size === size)?.stock ?? 0;
}

/** Movement history of an item (newest first) with the administrator who recorded each one. */
export async function listMovements(itemId: number) {
  return ItemInventoryMovement.findAll({
    where: { sellableItemId: itemId },
    include: [{ model: Person, as: 'createdBy', attributes: ['id', 'firstName', 'lastName'] }],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
}

/** Sizes of `current` that are used by movements or deliveries and would be dropped by `next`. */
export async function sizesInUseRemoved(itemId: number, current: string[], next: string[]): Promise<string[]> {
  const removed = current.filter(s => !next.includes(s));
  if (!removed.length) return [];
  const [movements, deliveries] = await Promise.all([
    ItemInventoryMovement.findAll({ where: { sellableItemId: itemId }, attributes: ['size'] }),
    loadDeliveries(itemId),
  ]);
  const used = new Set([...movements.map(m => m.size), ...deliveries.map(d => d.size)]);
  return removed.filter(s => used.has(s));
}
