import { VerticalConfig, VerticalId } from './types';
import { HVAC_VERTICAL_CONFIG } from './hvac';
import { PLUMBING_VERTICAL_CONFIG } from './plumbing';
import { GENERAL_VERTICAL_CONFIG } from './general';
import { getTradePack, resolveTradePackId } from '../../tradePacks';

export * from './types';
export { HVAC_VERTICAL_CONFIG } from './hvac';
export { PLUMBING_VERTICAL_CONFIG } from './plumbing';
export { GENERAL_VERTICAL_CONFIG } from './general';

export const VERTICAL_REGISTRY: Record<VerticalId, VerticalConfig> = {
  hvac: HVAC_VERTICAL_CONFIG,
  plumbing: PLUMBING_VERTICAL_CONFIG,
  roofing: GENERAL_VERTICAL_CONFIG,
  general: GENERAL_VERTICAL_CONFIG
};

/**
 * Resolves a given category or text query to the matching vertical ID.
 */
export function resolveVerticalId(categoryOrQuery?: string): VerticalId {
  return resolveTradePackId(categoryOrQuery) as VerticalId;
}

/**
 * Retrieves the full Vertical Dictionary Config for a given business category or search query.
 */
export function getVerticalConfig(categoryOrQuery?: string): VerticalConfig {
  const verticalId = resolveVerticalId(categoryOrQuery);
  return VERTICAL_REGISTRY[verticalId] || GENERAL_VERTICAL_CONFIG;
}

/**
 * Re-export getTradePack for modern trade pack features
 */
export { getTradePack };
