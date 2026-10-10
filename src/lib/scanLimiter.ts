/**
 * Scan Limit & Usage Tracker for Frontend UI
 * Keeps track of remaining daily scans (5 for Trial, 30 for Pro)
 * Harmonized with rateLimitService.ts
 */

import { getScansQuota, recordScanConsumption, updateQuotaFromServer } from './rateLimitService';

export interface ScanUsageInfo {
  usedToday: number;
  maxLimit: number;
  remainingToday: number;
}

export function getScanUsageInfo(isPro: boolean): ScanUsageInfo {
  const quota = getScansQuota(isPro);
  return {
    usedToday: quota.total - quota.remaining,
    maxLimit: quota.total,
    remainingToday: quota.remaining,
  };
}

export function recordScanUsage(isPro = false): void {
  recordScanConsumption(isPro);
}

export function syncServerRemaining(remaining: number, isPro = false): void {
  updateQuotaFromServer(remaining, isPro);
}

