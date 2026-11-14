export type GarmentView = 'side' | 'front' | 'back';
export type GarmentSize = 'S' | 'M' | 'L' | 'XL';

export interface CropSpec {
  y: number;
  h: number;
  hookX: number;
}

export interface GarmentDef {
  k: number;
  name: string;
  price: number;
  crops: Record<GarmentView, CropSpec>;
}

export interface CartItem {
  id: string;
  k: number;
  name: string;
  size: GarmentSize;
  price: number;
  qty: number;
  isNew?: boolean;
}

export const SHEET_SOURCES: Record<GarmentView, string> = {
  side: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261113_115504_3ab92758-5854-4a1c-85db-ff8efd929e86.png',
  front: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261113_115743_54dc8c72-0be0-4858-bd0c-10ecb399c16c.png',
  back: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261113_115613_7d45aea6-1bea-41ff-b878-72d7c8bcb9da.png',
};

export function getProxySheetUrl(view: GarmentView): string {
  return `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(SHEET_SOURCES[view])}&w=1360&q=85`;
}

export const SHEET_URLS: Record<GarmentView, string> = {
  side: getProxySheetUrl('side'),
  front: getProxySheetUrl('front'),
  back: getProxySheetUrl('back'),
};

export const GARMENTS: GarmentDef[] = [
  {
    k: 0,
    name: 'Noir Tailored Blazer',
    price: 690,
    crops: {
      side: { y: 44, h: 619, hookX: 185 },
      front: { y: 79, h: 552, hookX: 175 },
      back: { y: 76, h: 515, hookX: 176 },
    },
  },
  {
    k: 1,
    name: 'Ivory Belted Trench',
    price: 690,
    crops: {
      side: { y: 45, h: 860, hookX: 514 },
      front: { y: 76, h: 900, hookX: 511 },
      back: { y: 60, h: 890, hookX: 508 },
    },
  },
  {
    k: 2,
    name: 'Oxblood Silk Slip',
    price: 690,
    crops: {
      side: { y: 45, h: 876, hookX: 834 },
      front: { y: 76, h: 913, hookX: 848 },
      back: { y: 60, h: 901, hookX: 845 },
    },
  },
  {
    k: 3,
    name: 'Taupe Wool Blazer',
    price: 690,
    crops: {
      side: { y: 45, h: 606, hookX: 1169 },
      front: { y: 80, h: 550, hookX: 1179 },
      back: { y: 76, h: 520, hookX: 1180 },
    },
  },
  {
    k: 4,
    name: 'Champagne Bias Slip',
    price: 690,
    crops: {
      side: { y: 1024, h: 937, hookX: 177 },
      front: { y: 1024, h: 936, hookX: 177 },
      back: { y: 1026, h: 931, hookX: 175 },
    },
  },
  {
    k: 5,
    name: 'Pearl Silk Slip',
    price: 690,
    crops: {
      side: { y: 1024, h: 936, hookX: 511 },
      front: { y: 1024, h: 940, hookX: 513 },
      back: { y: 1026, h: 929, hookX: 508 },
    },
  },
  {
    k: 6,
    name: 'Taupe Belted Trench',
    price: 690,
    crops: {
      side: { y: 1024, h: 907, hookX: 825 },
      front: { y: 1024, h: 894, hookX: 851 },
      back: { y: 1024, h: 901, hookX: 845 },
    },
  },
  {
    k: 7,
    name: 'Oxblood Satin Gown',
    price: 690,
    crops: {
      side: { y: 1024, h: 962, hookX: 1166 },
      front: { y: 1024, h: 938, hookX: 1185 },
      back: { y: 1024, h: 934, hookX: 1184 },
    },
  },
];

export const RAIL_ORDER: number[] = [
  0, 1, 2, 3, 4, 0, 5, 6, 7, 0, 4, 1, 2, 3, 5, 6, 7, 1, 4, 3,
];

export const TAG_ROTATIONS: number[] = [-5, 4, -3, 6, -4, 3, -6, 4, -3, 5];

export const SIZES: GarmentSize[] = ['S', 'M', 'L', 'XL'];

export const INITIAL_CART: CartItem[] = [
  {
    id: '3-M',
    k: 3,
    name: 'Taupe Wool Blazer',
    size: 'M',
    price: 690,
    qty: 1,
  },
  {
    id: '4-S',
    k: 4,
    name: 'Champagne Bias Slip',
    size: 'S',
    price: 690,
    qty: 1,
  },
  {
    id: '1-M',
    k: 1,
    name: 'Ivory Belted Trench',
    size: 'M',
    price: 690,
    qty: 1,
  },
];
