/**
 * Never burst multiple product-page requests to a single merchant.
 * HTTP 403/429 opens a merchant-level circuit breaker for the rest of the run.
 * Other merchants continue independently; skipped offers stay unchanged.
 */
export async function checkOffersByMerchant<
  T extends { merchantName: string },
  R extends { responseStatus: number | null },
>(
  targets: readonly T[],
  check: (target: T) => Promise<R>,
  skipped: (target: T, blockedStatus: 403 | 429) => R,
  maxConcurrentMerchants = 2,
): Promise<R[]> {
  const groups = new Map<string, Array<{ index: number; target: T }>>();
  targets.forEach((target, index) => {
    // Unnamed merchants must not be accidentally conflated.
    const merchant = target.merchantName.trim().toLowerCase() || "unnamed-" + index;
    const group = groups.get(merchant) ?? [];
    group.push({ index, target });
    groups.set(merchant, group);
  });

  const buckets = [...groups.values()];
  const results = new Array<R>(targets.length);
  let nextBucket = 0;
  const worker = async () => {
    while (nextBucket < buckets.length) {
      const bucket = buckets[nextBucket++];
      if (!bucket) break;
      let blockedStatus: 403 | 429 | null = null;
      for (const { index, target } of bucket) {
        if (blockedStatus !== null) {
          results[index] = skipped(target, blockedStatus);
          continue;
        }
        const result = await check(target);
        results[index] = result;
        if (result.responseStatus === 403 || result.responseStatus === 429) {
          blockedStatus = result.responseStatus;
        }
      }
    }
  };

  const parallelism = Math.min(
    buckets.length,
    Math.max(1, Math.floor(maxConcurrentMerchants) || 1),
  );
  await Promise.all(Array.from({ length: parallelism }, () => worker()));
  return results;
}
