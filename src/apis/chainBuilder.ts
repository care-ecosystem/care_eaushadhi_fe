import { HttpMethod } from "@/apis/types";
import type {
  SuperBatchRequestBody,
  SuperBatchResult,
  SuperBatchSubRequest,
} from "@/apis/types";
import {
  buildRowDeliveryBatch,
  RowDeliveryInput,
  RowDeliveryBatchContext,
} from "@/apis/index";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Maximum number of rows to process in parallel per super-batch request.
 * CRITICAL: This must match your server's MAX_CHAINS_PER_REQUEST limit.
 *
 * Recommended: 8 (good balance of parallelism vs payload size)
 * Range: 4-16
 *
 * Higher = fewer HTTP requests but larger payloads
 * Lower = more HTTP requests but smaller payloads
 */
export const SUPER_BATCH_CHAIN_SIZE = 6;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result from processing one chain (all 3 steps for one row).
 * Extracted from flat results array returned by server.
 */
export interface ChainResult {
  chainId: number;
  productId?: string;
  supplyDeliveryId?: string;
  inwardItemId?: string;
  errors: string[];
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Build a batch containing up to SUPER_BATCH_CHAIN_SIZE rows.
 * Each row becomes one chain with namespaced reference IDs.
 *
 * All chains execute in parallel on the server.
 * Within each chain, the 3 steps execute sequentially.
 *
 * @example
 * const rows = [row1, row2, row3, row4, row5, row6, row7, row8];
 * const payload = buildChainBatch(rows, ctx);
 * // payload contains 24 requests:
 * // - chain_0:create_product, chain_0:create_supply_delivery, chain_0:create_inward_item
 * // - chain_1:create_product, chain_1:create_supply_delivery, chain_1:create_inward_item
 * // - ... (up to chain_7)
 */
export function buildChainBatch(
  rows: RowDeliveryInput[],
  ctx: RowDeliveryBatchContext,
): SuperBatchRequestBody {
  if (rows.length === 0) {
    throw new Error("Cannot build batch with zero rows");
  }

  if (rows.length > SUPER_BATCH_CHAIN_SIZE) {
    throw new Error(
      `Max ${SUPER_BATCH_CHAIN_SIZE} rows per batch, got ${rows.length}. Use chunkRows() first.`,
    );
  }

  const requests: SuperBatchSubRequest[] = [];

  // For each row, build its 3-step chain with namespaced reference IDs
  rows.forEach((row, chainId) => {
    // Build the single-row batch (3 requests)
    const payload = buildRowDeliveryBatch(row, ctx);

    // Prefix all reference IDs with chain_N: to prevent collisions
    const chainPrefix = `chain_${chainId}`;
    payload.requests.forEach((req) => {
      requests.push({
        ...req,
        reference_id: `${chainPrefix}:${req.reference_id}`,
        replacements: req.replacements?.map((r) => ({
          source_path: {
            ...r.source_path,
            reference_id: `${chainPrefix}:${r.source_path.reference_id}`,
          },
          value_path: {
            ...r.value_path,
            reference_id: `${chainPrefix}:${r.value_path.reference_id}`,
          },
        })),
      });
    });
  });

  return { requests };
}

/**
 * Split rows into chunks for parallel batch processing.
 *
 * @example
 * const rows = [...100 rows...];
 * const chunks = chunkRows(rows);
 * // chunks = [[8], [8], [8], ..., [4]] (13 chunks total)
 * // Each chunk can be processed via buildChainBatch()
 */
export function chunkRows(rows: RowDeliveryInput[]): RowDeliveryInput[][] {
  const chunks: RowDeliveryInput[][] = [];
  for (let i = 0; i < rows.length; i += SUPER_BATCH_CHAIN_SIZE) {
    chunks.push(rows.slice(i, i + SUPER_BATCH_CHAIN_SIZE));
  }
  return chunks;
}

/**
 * Parse flat results array and group by chain.
 *
 * Server returns results as flat array with reference_id like:
 *   "chain_0:create_product", "chain_0:create_supply_delivery", ...
 *   "chain_1:create_product", "chain_1:create_supply_delivery", ...
 *
 * This function groups them by chain_N and extracts IDs.
 *
 * @example
 * const results = await runSuperBatch(payload);
 * const chainResults = extractChainResults(results);
 * // chainResults[0] = { chainId: 0, productId: "...", supplyDeliveryId: "...", ... }
 * // chainResults[1] = { chainId: 1, productId: "...", supplyDeliveryId: "...", ... }
 */
export function extractChainResults(
  results: SuperBatchResult[],
): ChainResult[] {
  // Group results by chain ID
  const byChain: Record<number, SuperBatchResult[]> = {};

  results.forEach((result) => {
    // Extract chain ID from reference_id like "chain_0:create_product"
    const match = result.reference_id.match(/^chain_(\d+):/);
    if (!match) {
      console.warn(
        `extractChainResults: unexpected reference_id format: ${result.reference_id}`,
      );
      return;
    }

    const chainId = parseInt(match[1], 10);
    if (!byChain[chainId]) {
      byChain[chainId] = [];
    }
    byChain[chainId].push(result);
  });

  // Convert to ChainResult array
  const chainResults: ChainResult[] = Object.entries(byChain).map(
    ([chainIdStr, chainResults]) => {
      const chainId = parseInt(chainIdStr, 10);

      // Build lookup: "chain_0:create_product" -> result
      const byRef: Record<string, SuperBatchResult> = Object.fromEntries(
        chainResults.map((r) => [r.reference_id, r]),
      );

      // Extract ID from specific step in this chain
      const idOf = (step: string) => {
        const key = `chain_${chainId}:${step}`;
        return (byRef[key]?.data as { id?: string } | undefined)?.id;
      };

      // Collect any errors in this chain
      const errors = chainResults
        .filter((r) => (r.status_code ?? 200) > 299)
        .map(
          (r) =>
            `${r.reference_id}: ${r.status_code} - ${
              (r.data as any)?.detail ?? "Unknown error"
            }`,
        );

      return {
        chainId,
        productId: idOf("create_product"),
        supplyDeliveryId: idOf("create_supply_delivery"),
        inwardItemId: idOf("create_inward_item"),
        errors,
      };
    },
  );

  // Sort by chain ID for consistent ordering
  chainResults.sort((a, b) => a.chainId - b.chainId);

  return chainResults;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate total API calls for given rows.
 * Useful for progress tracking.
 *
 * Most rows: 3 APIs (create_product + create_supply_delivery + create_inward_item)
 * Reused product: 2 APIs (skip create_product)
 */
export function calculateApiCount(rows: RowDeliveryInput[]): number {
  let total = 0;
  rows.forEach((row) => {
    const reuseExistingProduct = !!row.existingProductId && !row.isNewBatch;
    total += reuseExistingProduct ? 2 : 3;
  });
  return total;
}

/**
 * Calculate number of HTTP requests needed for given rows.
 *
 * @example
 * calculateHttpRequests([...100 rows...]) // => 13 (100 / 8 = 12.5, round up)
 */
export function calculateHttpRequests(rows: RowDeliveryInput[]): number {
  return Math.ceil(rows.length / SUPER_BATCH_CHAIN_SIZE);
}
