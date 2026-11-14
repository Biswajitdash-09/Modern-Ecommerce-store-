import type { CartItem, CropSpec, GarmentDef, GarmentSize } from './garments';

export interface RailParams {
  railTop: number;
  sag: number;
  gap: number;
  gs: number;
  start: number;
  zoneTop: number;
}

export function computeScaleUnit(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0;
  if (width > 820) {
    return Math.min(width / 1440, height / 900);
  }
  return Math.min(width / 390, height / 780);
}

export function getRailParams(viewportWidth: number): RailParams {
  if (viewportWidth > 820) {
    return {
      railTop: 270,
      sag: 74,
      gap: 121,
      gs: 0.455,
      start: 113,
      zoneTop: 230,
    };
  }
  return {
    railTop: 292,
    sag: 30,
    gap: 80,
    gs: 0.3,
    start: 46,
    zoneTop: 260,
  };
}

export function computeRailY(
  x: number,
  pageWidth: number,
  railTop: number,
  sag: number,
  u: number
): number {
  if (pageWidth <= 0) return (railTop + sag) * u;
  const half = pageWidth / 2;
  const t = (x - half) / half;
  return (railTop + sag * (1 - t * t)) * u;
}

export function computeRailPath(
  pageWidth: number,
  railTop: number,
  sag: number,
  u: number
): string {
  const y0 = computeRailY(0, pageWidth, railTop, sag, u);
  const yMid = computeRailY(pageWidth / 2, pageWidth, railTop, sag, u);
  const yc = 2 * yMid - y0;
  return `M0 ${y0.toFixed(2)} Q ${(pageWidth / 2).toFixed(2)} ${yc.toFixed(2)} ${pageWidth.toFixed(2)} ${y0.toFixed(2)}`;
}

export function computeMaxScroll(
  start: number,
  gap: number,
  count: number,
  u: number,
  pageWidth: number
): number {
  if (count <= 0) return 0;
  return Math.max(0, (2 * start + (count - 1) * gap) * u - pageWidth);
}

export interface CropLayout {
  width: number;
  height: number;
  left: number;
  bgWidth: number;
  bgPosX: number;
  bgPosY: number;
}

export function computeCropLayout(crop: CropSpec, scale: number): CropLayout {
  return {
    width: 340 * scale,
    height: (crop.h + 6) * scale,
    left: -170 * scale,
    bgWidth: 1360 * scale,
    bgPosX: -(crop.hookX - 170) * scale,
    bgPosY: -crop.y * scale,
  };
}

const NEIGHBOR_TABLE = [0, 50, 24, 9, 0] as const;

export function computeNeighborOffset(
  index: number,
  hoveredIndex: number | null,
  gs: number,
  u: number
): number {
  if (hoveredIndex === null || hoveredIndex < 0) return 0;
  const d = index - hoveredIndex;
  if (d === 0) return 0;
  const mag = NEIGHBOR_TABLE[Math.min(Math.abs(d), 4)];
  return Math.sign(d) * mag * (gs / 0.48) * u;
}

export function stepScroll(
  cur: number,
  target: number,
  dt: number
): { cur: number; vel: number } {
  const clampedDt = Math.max(0, Math.min(dt, 3));
  if (clampedDt === 0) return { cur, vel: 0 };
  const alpha = 1 - Math.pow(1 - 0.085, clampedDt);
  const next = cur + (target - cur) * alpha;
  const vel = (next - cur) / clampedDt;
  return { cur: next, vel };
}

export function stepSway(
  angle: number,
  angVel: number,
  railVel: number,
  dt: number,
  reducedMotion: boolean
): { angle: number; angVel: number } {
  if (reducedMotion) return { angle: 0, angVel: 0 };
  const clampedDt = Math.max(0, Math.min(dt, 3));
  const targetAngle = Math.max(-7, Math.min(7, -railVel * 0.22));
  let av = angVel + (targetAngle - angle) * 0.05 * clampedDt;
  av *= Math.pow(0.88, clampedDt);
  const a = angle + av * clampedDt;
  return { angle: a, angVel: av };
}

export function computeMobileQvScale(
  frontH: number,
  backH: number,
  availH: number,
  u: number
): number {
  const maxH = Math.max(frontH, backH) + 6;
  if (maxH <= 0 || availH <= 0) return 0.3 * u;
  return Math.min(0.46 * u, availH / maxH);
}

export function addItemToCart(
  cart: CartItem[],
  garment: GarmentDef,
  size: GarmentSize
): CartItem[] {
  const existingIdx = cart.findIndex(
    (item) => item.k === garment.k && item.size === size
  );
  if (existingIdx !== -1) {
    const existing = cart[existingIdx];
    const updated: CartItem = {
      ...existing,
      qty: existing.qty + 1,
      isNew: true,
    };
    const rest = cart.filter((_, idx) => idx !== existingIdx);
    return [updated, ...rest];
  }
  const newItem: CartItem = {
    id: `${garment.k}-${size}-${Date.now()}`,
    k: garment.k,
    name: garment.name,
    size,
    price: garment.price,
    qty: 1,
    isNew: true,
  };
  return [newItem, ...cart];
}

export function updateCartQty(
  cart: CartItem[],
  id: string,
  delta: number
): CartItem[] {
  return cart
    .map((item) => {
      if (item.id !== id) return item;
      return { ...item, qty: item.qty + delta, isNew: false };
    })
    .filter((item) => item.qty > 0);
}

export function removeCartItem(cart: CartItem[], id: string): CartItem[] {
  return cart.filter((item) => item.id !== id);
}

export function computeCartTotals(cart: CartItem[]): {
  count: number;
  total: number;
} {
  let count = 0;
  let total = 0;
  for (const item of cart) {
    count += item.qty;
    total += item.price * item.qty;
  }
  return { count, total };
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
