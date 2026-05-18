import { BENCHMARKS } from '../data/constants.js';

/**
 * Compute a user's status tier and label from their current metrics
 * against the benchmarks for their type.
 */
export function computeStatus(user) {
  const bm = BENCHMARKS[user.type];
  if (user.stage < 4) return { tier: 'onboarding', label: 'Onboarding' };
  if (user.leadsThisWeek < bm.weeklyLeads * 0.5) return { tier: 'red', label: 'Below target' };
  if (user.dealsThisMonth < bm.monthlyQuota * 0.7) return { tier: 'amber', label: 'At risk' };
  return { tier: 'green', label: 'On track' };
}

/**
 * Format a number as a localized string (e.g. 4280 -> "4,280").
 */
export function formatNumber(n) {
  return n.toLocaleString();
}

/**
 * Today's date as a friendly string.
 */
export function formatToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
