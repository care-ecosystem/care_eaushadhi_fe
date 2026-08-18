import { HttpMethod } from "@/apis/types";
import type {
  BatchRequestBody,
  BatchSubRequest,
  SuperBatchRequestBody,
  SuperBatchResult,
  SuperBatchSubRequest,
} from "@/apis/types";
import { extractErrorMessage } from "@/apis/query";
import { downloadCsv } from "@/lib/utils";
import type { ProductMappingCsvRow } from "@/utils/csvValidation";

/** Must match the server's MAX_CHAINS_PER_REQUEST limit for /api/super_batch_request/. */
export const PRODUCT_MAPPING_BATCH_SIZE = 6;

export interface FailedProductMappingRow extends ProductMappingCsvRow {
  message: string;
}

export type ProductMappingRowStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export interface ProductMappingReportRow extends ProductMappingCsvRow {
  status: ProductMappingRowStatus;
  message?: string;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function chunkProductMappingRows(
  rows: ProductMappingCsvRow[],
): ProductMappingCsvRow[][] {
  return chunkArray(rows, PRODUCT_MAPPING_BATCH_SIZE);
}

export const VALIDATION_REQUEST_CONCURRENCY = 2;

export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const index = nextIndex++;
    if (index >= items.length) return;
    results[index] = await worker(items[index], index);
    return runNext();
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runNext),
  );

  return results;
}

function toFullSlug(facilityId: string, slug: string): string {
  if (slug.startsWith("f-") || slug.startsWith("i-")) {
    return slug;
  }
  return `f-${facilityId}-${slug}`;
}

export interface ExistingMappingSplit {
  existingRows: ProductMappingCsvRow[];
  newRows: ProductMappingCsvRow[];
  erroredRows: FailedProductMappingRow[];
}

interface ProductMappingSearchResult {
  mapping_type?: string;
}


export function buildProductMappingSearchBatch(
  rows: ProductMappingCsvRow[],
  facilityId: string,
): BatchRequestBody {
  const requests: BatchSubRequest[] = rows.map((row, chainId) => ({
    reference_id: `search_${chainId}`,
    url: `/api/care_eaushadhi/product-mappings/search/?facility_id=${encodeURIComponent(facilityId)}&eaushadhi_drug_id=${encodeURIComponent(row.drugId)}`,
    method: HttpMethod.GET,
  }));

  return { requests };
}

export function splitRowsByExistingMapping(
  rows: ProductMappingCsvRow[],
  results: SuperBatchResult[],
): ExistingMappingSplit {
  const byRef: Record<string, SuperBatchResult> = Object.fromEntries(
    results.map((result) => [result.reference_id, result]),
  );

  const existingRows: ProductMappingCsvRow[] = [];
  const newRows: ProductMappingCsvRow[] = [];
  const erroredRows: FailedProductMappingRow[] = [];

  rows.forEach((row, chainId) => {
    const searchResult = byRef[`search_${chainId}`];

    if (!searchResult || (searchResult.status_code ?? 200) > 299) {
      erroredRows.push({
        ...row,
        message: searchResult
          ? (extractErrorMessage(searchResult.data) ?? "Unknown error")
          : "Existing mapping check did not run for this row",
      });
      return;
    }

    const data = searchResult.data as
      | { results?: ProductMappingSearchResult[] }
      | undefined;
    const alreadyBulkImported =
      Array.isArray(data?.results) &&
      data.results.some((mapping) => mapping?.mapping_type === "BULK_IMPORT");

    (alreadyBulkImported ? existingRows : newRows).push(row);
  });

  return { existingRows, newRows, erroredRows };
}

export function buildProductKnowledgeLookupBatch(
  rows: ProductMappingCsvRow[],
  facilityId: string,
): BatchRequestBody {
  const requests: BatchSubRequest[] = rows.map((row, chainId) => ({
    reference_id: `pk_${chainId}`,
    url: `/api/v1/product_knowledge/${toFullSlug(facilityId, row.pkSlug)}/?facility=${facilityId}`,
    method: HttpMethod.GET,
  }));

  return { requests };
}

export interface ResolvedProductMappingRow {
  row: ProductMappingCsvRow;
  productKnowledgeId: string;
}

export interface ProductKnowledgeLookupSplit {
  resolvedRows: ResolvedProductMappingRow[];
  failedRows: FailedProductMappingRow[];
  inactiveRows: FailedProductMappingRow[];
}

const ACTIVE_PRODUCT_KNOWLEDGE_STATUS = "active";

export function buildInactiveProductKnowledgeMessage(status: string): string {
  return `Product knowledge is not active (status: ${status}) and was skipped from the import`;
}

export function extractProductKnowledgeLookup(
  rows: ProductMappingCsvRow[],
  results: SuperBatchResult[],
): ProductKnowledgeLookupSplit {
  const byRef: Record<string, SuperBatchResult> = Object.fromEntries(
    results.map((result) => [result.reference_id, result]),
  );

  const resolvedRows: ResolvedProductMappingRow[] = [];
  const failedRows: FailedProductMappingRow[] = [];
  const inactiveRows: FailedProductMappingRow[] = [];

  rows.forEach((row, chainId) => {
    const result = byRef[`pk_${chainId}`];
    const data = result?.data as { id?: string; status?: string } | undefined;
    const productKnowledgeId = data?.id;

    if (!result || (result.status_code ?? 200) > 299 || !productKnowledgeId) {
      failedRows.push({
        ...row,
        message: result
          ? extractErrorMessage(result.data) ?? "Product knowledge not found"
          : "Product knowledge lookup did not run for this row",
      });
      return;
    }

    if (data?.status && data.status !== ACTIVE_PRODUCT_KNOWLEDGE_STATUS) {
      inactiveRows.push({
        ...row,
        message: buildInactiveProductKnowledgeMessage(data.status),
      });
      return;
    }

    resolvedRows.push({ row, productKnowledgeId });
  });

  return { resolvedRows, failedRows, inactiveRows };
}

export function buildProductMappingBatch(
  resolvedRows: ResolvedProductMappingRow[],
  facilityId: string,
): SuperBatchRequestBody {
  const requests: SuperBatchSubRequest[] = resolvedRows.map(
    ({ row, productKnowledgeId }, chainId) => ({
      reference_id: `create_${chainId}`,
      url: "/api/care_eaushadhi/product-mappings/",
      method: HttpMethod.POST,
      body: {
        facility_id: facilityId,
        eaushadhi_drug_id: row.drugId,
        eaushadhi_drug_name: row.drugName,
        mapping_type: "BULK_IMPORT",
        product_knowledge_id: productKnowledgeId,
      },
    }),
  );

  return { requests };
}

export interface BatchFailureSplit {
  failedRows: FailedProductMappingRow[];
  rolledBackRows: ProductMappingCsvRow[];
}

/**
 * The super_batch_request backend wraps an entire batch in one DB
 * transaction: if any sub-request in the batch returns a >299 status, the
 * whole transaction is rolled back (see care_super_batch_be's
 * SuperBatchRequestView.create, which raises HandledError to abort the
 * `transaction.atomic()` block when any response errored). So when a batch
 * fails, every row in that batch is rolled back, not just the row whose own
 * sub-request errored.
 *
 * Given the rows sent in one failed create batch and its results, splits
 * them into rows whose own create request actually errored (with that
 * error's message) and rows that were merely rolled back as collateral —
 * those are reported as skipped with no failure reason, rather than as
 * failed.
 */
export function extractFailedRows(
  resolvedRows: ResolvedProductMappingRow[],
  results: SuperBatchResult[],
): BatchFailureSplit {
  const byRef: Record<string, SuperBatchResult> = Object.fromEntries(
    results.map((result) => [result.reference_id, result]),
  );

  const failedRows: FailedProductMappingRow[] = [];
  const rolledBackRows: ProductMappingCsvRow[] = [];

  resolvedRows.forEach(({ row }, chainId) => {
    const createResult = byRef[`create_${chainId}`];
    const failedResult =
      createResult && (createResult.status_code ?? 200) > 299
        ? createResult
        : undefined;

    if (failedResult) {
      failedRows.push({
        ...row,
        message: extractErrorMessage(failedResult.data) ?? "Unknown error",
      });
    } else {
      rolledBackRows.push(row);
    }
  });

  return { failedRows, rolledBackRows };
}

const REPORT_CSV_HEADERS = [
  "EAushadhi Drug ID",
  "EAushadhi Drug Name",
  "Product Knowledge Name",
  "Product Knowledge Slug",
  "Status",
  "Failure Reason",
];

/** Shown for rows skipped because the drug ID already has a BULK_IMPORT mapping. */
export const SKIPPED_EXISTING_MAPPING_MESSAGE =
  "Product mapping already exists for this EAushadhi Drug ID";

/** Shown for rows skipped because another row in the same batch failed and rolled the batch back. */
export const SKIPPED_BATCH_ROLLBACK_MESSAGE = "Because of issues in other rows";

function toCsvRow(values: string[]): string {
  return values.map((value) => `"${value.replace(/"/g, '""')}"`).join(",");
}

/**
 * Downloads the per-row upload report as a CSV, mirroring the upload
 * template's columns with Status (SUCCESS/FAILED/SKIPPED) and Failure Reason
 * columns appended. Failure Reason is populated for FAILED and SKIPPED rows.
 */
export function downloadProductMappingReport(
  reportRows: ProductMappingReportRow[],
): void {
  const lines = [
    toCsvRow(REPORT_CSV_HEADERS),
    ...reportRows.map((row) =>
      toCsvRow([
        row.drugId,
        row.drugName,
        row.pkName,
        row.pkSlug,
        row.status,
        row.message ?? "",
      ]),
    ),
  ];

  // Leading BOM so Excel detects UTF-8 and splits into columns instead of
  // dumping the whole line (including headers) into column A.
  downloadCsv("product_mapping_upload_report.csv", "\uFEFF" + lines.join("\n"));
}
