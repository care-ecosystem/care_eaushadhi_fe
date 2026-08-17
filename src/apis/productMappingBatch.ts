import { HttpMethod } from "@/apis/types";
import type {
  SuperBatchRequestBody,
  SuperBatchResult,
  SuperBatchSubRequest,
} from "@/apis/types";
import { extractErrorMessage } from "@/apis/query";
import type { ProductMappingCsvRow } from "@/utils/csvValidation";

/** Must match the server's MAX_CHAINS_PER_REQUEST limit for /api/super_batch_request/. */
export const PRODUCT_MAPPING_BATCH_SIZE = 6;

export interface FailedProductMappingRow {
  rowNum: number;
  message: string;
}

export function chunkProductMappingRows(
  rows: ProductMappingCsvRow[],
): ProductMappingCsvRow[][] {
  const chunks: ProductMappingCsvRow[][] = [];
  for (let i = 0; i < rows.length; i += PRODUCT_MAPPING_BATCH_SIZE) {
    chunks.push(rows.slice(i, i + PRODUCT_MAPPING_BATCH_SIZE));
  }
  return chunks;
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
): SuperBatchRequestBody {
  const requests: SuperBatchSubRequest[] = rows.map((row, chainId) => ({
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
        rowNum: row.rowNum,
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

export function buildProductMappingBatch(
  rows: ProductMappingCsvRow[],
  facilityId: string,
): SuperBatchRequestBody {
  const requests: SuperBatchSubRequest[] = [];

  rows.forEach((row, chainId) => {
    const getRef = `chain_${chainId}:get_pk`;
    const createRef = `chain_${chainId}:create_mapping`;
    const fullSlug = toFullSlug(facilityId, row.pkSlug);

    requests.push({
      reference_id: getRef,
      url: `/api/v1/product_knowledge/${fullSlug}/?facility=${facilityId}`,
      method: HttpMethod.GET,
    });

    requests.push({
      reference_id: createRef,
      url: "/api/care_eaushadhi/product-mappings/",
      method: HttpMethod.POST,
      body: {
        facility_id: facilityId,
        eaushadhi_drug_id: row.drugId,
        eaushadhi_drug_name: row.drugName,
        mapping_type: "BULK_IMPORT",
        product_knowledge_id: null,
      },
      replacements: [
        {
          source_path: { reference_id: getRef, path: "$.id" },
          value_path: {
            reference_id: createRef,
            path: "$.product_knowledge_id",
            type: "body",
          },
        },
      ],
    });
  });

  return { requests };
}

export function extractFailedRows(
  rows: ProductMappingCsvRow[],
  results: SuperBatchResult[],
): FailedProductMappingRow[] {
  const byRef: Record<string, SuperBatchResult> = Object.fromEntries(
    results.map((result) => [result.reference_id, result]),
  );

  return rows.reduce<FailedProductMappingRow[]>((failed, row, chainId) => {
    const getResult = byRef[`chain_${chainId}:get_pk`];
    const createResult = byRef[`chain_${chainId}:create_mapping`];
    const failedResult =
      getResult && (getResult.status_code ?? 200) > 299
        ? getResult
        : createResult && (createResult.status_code ?? 200) > 299
          ? createResult
          : undefined;

    if (failedResult) {
      failed.push({
        rowNum: row.rowNum,
        message: extractErrorMessage(failedResult.data) ?? "Unknown error",
      });
    }

    return failed;
  }, []);
}
