export interface ErrorSummary {
  missingHeaders?: string[];
  emptyRows?: number[];
  parseError?: string;
}

export interface FormattedError {
  type: "missing_headers" | "empty_rows" | "parse_error";
  data?: string | string[] | number[];
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

export function validateCSV(csvText: string): {
  valid: boolean;
  errors: ErrorSummary;
  rowCount: number;
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
    const lines = csvText.split("\n").filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      return {
        valid: false,
        errors: {
          parseError: "CSV must have at least one data row (plus header)",
        },
        rowCount: 0,
      };
    }

    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const parts: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
          if (char === '"') {
            if (line[i + 1] === '"') {
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
          } else {
            current += char;
          }
        }
      }
      parts.push(current.trim());
      return parts;
    });

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
    return {
      valid: !hasErrors,
      errors,
      rowCount: rows.length,
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
