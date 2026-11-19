/**
 * Shared public runtime freshness gate.
 * Reject missing, malformed, future, and >24-hour merchant snapshots at READ
 * time, even if no DB refresh job has fired since the snapshot was written.
 *
 * Model/pack, region, stock and explicit human verifications are SEPARATE gates.
 */
export const MAX_EU_OFFER_AGE_MS = 24 * 60 * 60 * 1000;

export function isFreshEuroOfferTimestamp(
  checkedAt: unknown,
  nowMs = Date.now(),
  maxAgeMs = MAX_EU_OFFER_AGE_MS,
): boolean {
  if (typeof checkedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(checkedAt)) {
    return false;
  }
  const parsed = Date.parse(checkedAt);
  const age = nowMs - parsed;
  return Number.isFinite(parsed) && Number.isFinite(nowMs) &&
    Number.isFinite(maxAgeMs) && maxAgeMs >= 0 &&
    age >= 0 && age <= maxAgeMs;
}
