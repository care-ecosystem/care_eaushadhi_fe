export interface ErrorSummary {
  missingHeaders?: string[];
  emptyRows?: number[];
  parseError?: string;
}

export interface FormattedError {
  type: "missing_headers" | "empty_rows" | "parse_error";
  data?: string | string[] | number[];
}

export interface ProductMappingCsvRow {
  rowNum: number;
  drugId: string;
  drugName: string;
  pkName: string;
  pkSlug: string;
}

const REQUIRED_HEADERS = [
  "EAushadhi Drug ID",
  "EAushadhi Drug Name",
  "Product Knowledge Name",
  "Product Knowledge Slug",
];

function validateCSVHeaders(headers: string[]): string[] {
  const missing: string[] = [];
  REQUIRED_HEADERS.forEach((required) => {
    if (!headers.includes(required)) {
      missing.push(required);
    }
  });
  return missing;
}

function validateCSVRows(rows: string[][], headers: string[]): number[] {
  const emptyRows: number[] = [];

  const headerIndices = {
    drugId: headers.indexOf("EAushadhi Drug ID"),
    drugName: headers.indexOf("EAushadhi Drug Name"),
    pkName: headers.indexOf("Product Knowledge Name"),
    pkSlug: headers.indexOf("Product Knowledge Slug"),
  };

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;

    const drugId = row[headerIndices.drugId]?.trim() || "";
    const drugName = row[headerIndices.drugName]?.trim() || "";
    const pkName = row[headerIndices.pkName]?.trim() || "";
    const pkSlug = row[headerIndices.pkSlug]?.trim() || "";

    if (!drugId || !drugName || !pkName || !pkSlug) {
      emptyRows.push(rowNum);
    }
  });

  return emptyRows;
}

export interface DuplicateProductMappingCsvRow extends ProductMappingCsvRow {
  reason: string;
}

export interface DuplicateRowSplit {
  uniqueRows: ProductMappingCsvRow[];
  duplicateRows: DuplicateProductMappingCsvRow[];
}

export const SKIPPED_DUPLICATE_ROW_MESSAGE = "Duplicate Row";

export const SKIPPED_DUPLICATE_DRUG_ID_MESSAGE = "Duplicate Drug ID";

export const SKIPPED_DUPLICATE_SLUG_MESSAGE =
  "Duplicate Product Knowledge Slug in this CSV";


function getFullRowKey(row: ProductMappingCsvRow): string {
  return [row.drugId, row.drugName, row.pkName, row.pkSlug]
    .map((value) => value.toLowerCase())
    .join("|");
}

export function splitDuplicateRows(
  rows: ProductMappingCsvRow[],
): DuplicateRowSplit {
  const drugIdGroups = new Map<string, ProductMappingCsvRow[]>();
  const slugGroups = new Map<string, ProductMappingCsvRow[]>();

  rows.forEach((row) => {
    const drugIdKey = row.drugId.toLowerCase();
    const slugKey = row.pkSlug.toLowerCase();

    if (!drugIdGroups.has(drugIdKey)) drugIdGroups.set(drugIdKey, []);
    drugIdGroups.get(drugIdKey)!.push(row);

    if (!slugGroups.has(slugKey)) slugGroups.set(slugKey, []);
    slugGroups.get(slugKey)!.push(row);
  });

  const uniqueRows: ProductMappingCsvRow[] = [];
  const duplicateRows: DuplicateProductMappingCsvRow[] = [];
  const seenFullRowKeys = new Set<string>();

  rows.forEach((row) => {
    const drugIdKey = row.drugId.toLowerCase();
    const slugKey = row.pkSlug.toLowerCase();
    const fullRowKey = getFullRowKey(row);

    const drugIdGroup = drugIdGroups.get(drugIdKey)!;
    const slugGroup = slugGroups.get(slugKey)!;

    const isDrugIdDuplicated = drugIdGroup.length > 1;
    // Every row sharing this drug ID is an exact duplicate of this one -
    // treat as a "completely duplicate row" group instead of a drug-ID clash.
    const isExactDuplicateGroup =
      isDrugIdDuplicated &&
      drugIdGroup.every((other) => getFullRowKey(other) === fullRowKey);

    let reason: string | null = null;

    if (isExactDuplicateGroup) {
      if (seenFullRowKeys.has(fullRowKey)) {
        reason = SKIPPED_DUPLICATE_ROW_MESSAGE;
      } else {
        seenFullRowKeys.add(fullRowKey);
      }
    } else if (isDrugIdDuplicated) {
      reason = SKIPPED_DUPLICATE_DRUG_ID_MESSAGE;
    } else if (slugGroup.length > 1) {
      reason = SKIPPED_DUPLICATE_SLUG_MESSAGE;
    }

    if (reason) {
      duplicateRows.push({ ...row, reason });
    } else {
      uniqueRows.push(row);
    }
  });

  return { uniqueRows, duplicateRows };
}

function toProductMappingRows(rows: string[][], headers: string[]): ProductMappingCsvRow[] {
  const headerIndices = {
    drugId: headers.indexOf("EAushadhi Drug ID"),
    drugName: headers.indexOf("EAushadhi Drug Name"),
    pkName: headers.indexOf("Product Knowledge Name"),
    pkSlug: headers.indexOf("Product Knowledge Slug"),
  };

  return rows.map((row, idx) => ({
    rowNum: idx + 2,
    drugId: row[headerIndices.drugId]?.trim() || "",
    drugName: row[headerIndices.drugName]?.trim() || "",
    pkName: row[headerIndices.pkName]?.trim() || "",
    pkSlug: row[headerIndices.pkSlug]?.trim() || "",
  }));
}

export function validateCSV(csvText: string): {
  valid: boolean;
  errors: ErrorSummary;
  rowCount: number;
  rows?: ProductMappingCsvRow[];
  duplicateRows?: DuplicateProductMappingCsvRow[];
} {
  const errors: ErrorSummary = {};

  if (!csvText || csvText.trim().length === 0) {
    return {
      valid: false,
      errors: { parseError: "CSV file is empty" },
      rowCount: 0,
    };
  }

  try {
    const records: string[][] = [];
    let current = "";
    let inQuotes = false;
    let parts: string[] = [];

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];

      if (inQuotes) {
        if (char === '"') {
          if (csvText[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          parts.push(current.trim());
          current = "";
        } else if (char === "\n" || char === "\r") {
          if (current.trim() || parts.length > 0) {
            parts.push(current.trim());
            if (parts.some((p) => p.length > 0)) {
              records.push(parts);
            }
            parts = [];
            current = "";
          }
          if (char === "\r" && csvText[i + 1] === "\n") {
            i++;
          }
        } else {
          current += char;
        }
      }
    }

    if (inQuotes) {
      return {
        valid: false,
        errors: { parseError: "Unterminated quoted field in CSV" },
        rowCount: 0,
      };
    }

    if (current.trim() || parts.length > 0) {
      parts.push(current.trim());
      if (parts.some((p) => p.length > 0)) {
        records.push(parts);
      }
    }

    if (records.length < 2) {
      return {
        valid: false,
        errors: {
          parseError: "CSV must have at least one data row (plus header)",
        },
        rowCount: 0,
      };
    }

    const headers = records[0].map((h) => h.trim());
    const rows = records.slice(1);

    const missingHeaders = validateCSVHeaders(headers);
    if (missingHeaders.length > 0) {
      errors.missingHeaders = missingHeaders;
    }

    if (!missingHeaders.length) {
      const emptyRows = validateCSVRows(rows, headers);
      if (emptyRows.length > 0) {
        errors.emptyRows = emptyRows;
      }
    }

    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      return { valid: false, errors, rowCount: rows.length };
    }

    const { uniqueRows, duplicateRows } = splitDuplicateRows(
      toProductMappingRows(rows, headers),
    );

    return {
      valid: true,
      errors,
      rowCount: rows.length,
      rows: uniqueRows,
      duplicateRows,
    };
  } catch (error) {
    return {
      valid: false,
      errors: {
        parseError: `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      rowCount: 0,
    };
  }
}
