import { TradePack, TradePackId } from './types';
import { HVAC_TRADE_PACK } from './hvac';
import { PLUMBING_TRADE_PACK } from './plumbing';
import { LAWN_TRADE_PACK } from './lawn';
import { GENERAL_TRADE_PACK } from './general';

export * from './types';
export { HVAC_TRADE_PACK } from './hvac';
export { PLUMBING_TRADE_PACK } from './plumbing';
export { LAWN_TRADE_PACK } from './lawn';
export { GENERAL_TRADE_PACK } from './general';

/**
 * Global Registry of Trade Vertical Packs.
 * Allows adding new trades (lawn, plumbing, roofing, electrical, landscaping) dynamically without forking the app.
 */
export const TRADE_PACK_REGISTRY: Record<TradePackId, TradePack> = {
  hvac: HVAC_TRADE_PACK,
  plumbing: PLUMBING_TRADE_PACK,
  lawn: LAWN_TRADE_PACK,
  roofing: GENERAL_TRADE_PACK,
  general: GENERAL_TRADE_PACK
};

/**
 * Register a custom or newly defined trade pack at runtime.
 */
export function registerTradePack(pack: TradePack): void {
  if (pack && pack.id) {
    TRADE_PACK_REGISTRY[pack.id] = pack;
  }
}

/**
 * Resolves a category string or search query to the corresponding trade pack ID.
 */
export function resolveTradePackId(categoryOrQuery?: string): TradePackId {
  if (!categoryOrQuery || typeof categoryOrQuery !== 'string') {
    return 'general';
  }

  const query = categoryOrQuery.toLowerCase().trim();

  // 1. Check HVAC keywords
  if (HVAC_TRADE_PACK.keywords.some(k => query.includes(k.toLowerCase()))) {
    return 'hvac';
  }

  // 2. Check Plumbing keywords
  if (PLUMBING_TRADE_PACK.keywords.some(k => query.includes(k.toLowerCase()))) {
    return 'plumbing';
  }

  // 3. Check Lawn / Landscaping keywords
  if (LAWN_TRADE_PACK.keywords.some(k => query.includes(k.toLowerCase()))) {
    return 'lawn';
  }

  return 'general';
}

/**
 * Retrieves the full Trade Pack configuration for a given business category, profile, or query.
 */
export function getTradePack(categoryOrQuery?: string): TradePack {
  const packId = resolveTradePackId(categoryOrQuery);
  return TRADE_PACK_REGISTRY[packId] || GENERAL_TRADE_PACK;
}

/**
 * Helper to check if a specific trade pack is active for a profile
 */
export function isTradePackActive(categoryOrQuery: string | undefined, packId: TradePackId): boolean {
  return resolveTradePackId(categoryOrQuery) === packId;
}
