import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon, UploadIcon, Settings2Icon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import FacilitySelector from "@/components/FacilitySelector";
import { I18NNAMESPACE } from "@/lib/contants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import FileDropzone from "@/components/FileDropzone";
import ProductMappings from "./ProductMappings";
import { downloadProductMappingTemplate } from "@/lib/utils";
import { validateCSV } from "@/utils/csvValidation";
import type { FormattedError, ProductMappingCsvRow } from "@/utils/csvValidation";
import { useSuperBatchRequest, SuperBatchError } from "@/apis/query";
import {
  buildProductMappingBatch,
  buildProductMappingSearchBatch,
  chunkProductMappingRows,
  extractFailedRows,
  splitRowsByExistingMapping,
} from "@/apis/productMappingBatch";
import type { FailedProductMappingRow } from "@/apis/productMappingBatch";

export default function ProductMappingsLayout() {
  const { t } = useTranslation(I18NNAMESPACE);
  const queryClient = useQueryClient();
  const superBatch = useSuperBatchRequest();
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ProductMappingCsvRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<FormattedError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileReaderRef = useRef<FileReader | null>(null);
  const selectionIdRef = useRef<number>(0);

  const handleFileSelected = (file: File | null) => {
    if (fileReaderRef.current) {
      fileReaderRef.current.abort();
    }

    selectionIdRef.current += 1;
    const currentSelectionId = selectionIdRef.current;

    setCsvFile(file);
    setValidationErrors([]);
    setParsedRows([]);

    if (!file) return;

    const reader = new FileReader();
    fileReaderRef.current = reader;

    reader.onload = (e) => {
      if (currentSelectionId !== selectionIdRef.current) {
        return;
      }

      try {
        const csvText = e.target?.result as string;
        const validation = validateCSV(csvText);

        if (!validation.valid) {
          const errors: FormattedError[] = [];

          if (validation.errors.parseError) {
            errors.push({
              type: "parse_error",
              data: validation.errors.parseError,
            });
          }

          if (validation.errors.missingHeaders?.length) {
            errors.push({
              type: "missing_headers",
              data: validation.errors.missingHeaders,
            });
          }

          if (validation.errors.emptyRows?.length) {
            const rowsDisplay =
              validation.errors.emptyRows.length > 10
                ? `${validation.errors.emptyRows.slice(0, 10).join(", ")}, ... (${validation.errors.emptyRows.length} total)`
                : validation.errors.emptyRows.join(", ");
            errors.push({
              type: "empty_rows",
              data: rowsDisplay,
            });
          }

          setValidationErrors(errors);
          setCsvFile(null);
          setParsedRows([]);
        } else {
          setParsedRows(validation.rows ?? []);
          toast.success(`Valid CSV with ${validation.rowCount} rows`);
        }
      } catch (error) {
        if (currentSelectionId !== selectionIdRef.current) {
          return;
        }

        setValidationErrors([
          {
            type: "parse_error",
            data: error instanceof Error ? error.message : "Unknown error",
          },
        ]);
        setCsvFile(null);
        setParsedRows([]);
      }
    };

    reader.readAsText(file);
  };

  const uploadCsv = async () => {
    if (!csvFile || parsedRows.length === 0 || isUploading) return;

    setIsUploading(true);
    setValidationErrors([]);

    try {
      // Phase 1: search in batch for rows that already have a BULK_IMPORT
      const searchChunks = chunkProductMappingRows(parsedRows);
      const rowsToCreate: ProductMappingCsvRow[] = [];
      const erroredSearchRows: FailedProductMappingRow[] = [];
      let skippedCount = 0;

      for (const chunk of searchChunks) {
        const searchPayload = buildProductMappingSearchBatch(
          chunk,
          selectedFacilityId,
        );
        // A single row's search failing rolls the whole search sub-request
        // back with a SuperBatchError, but `error.results` still carries
        // every row's result (successes included) — reuse it either way.
        const searchResults =
          await superBatch.mutateAsync(searchPayload).catch((error) => {
            if (error instanceof SuperBatchError) {
              return error.results;
            }
            throw error;
          });

        const { existingRows, newRows, erroredRows } =
          splitRowsByExistingMapping(chunk, searchResults);
        skippedCount += existingRows.length;
        rowsToCreate.push(...newRows);
        erroredSearchRows.push(...erroredRows);
      }

      // Phase 2: create mappings only for the rows that still need one.
      const createChunks = chunkProductMappingRows(rowsToCreate);
      const failedRows: FailedProductMappingRow[] = [...erroredSearchRows];

      for (const chunk of createChunks) {
        const payload = buildProductMappingBatch(chunk, selectedFacilityId);
        try {
          await superBatch.mutateAsync(payload);
        } catch (error) {
          if (error instanceof SuperBatchError) {
            failedRows.push(...extractFailedRows(chunk, error.results));
          } else {
            throw error;
          }
        }
      }

      if (failedRows.length > 0) {
        const rowMessages = failedRows.map(
          (row) => `${t("row")} ${row.rowNum}: ${row.message}`,
        );
        setValidationErrors([
          {
            type: "upload_errors",
            data: rowMessages,
          },
        ]);
        toast.error(rowMessages.join(" | "));
        // Rows within a chunk succeed/fail independently — a chunk with some
        // failures may still have created other rows, so refresh either way.
        queryClient.invalidateQueries({
          queryKey: ["product-mappings", selectedFacilityId],
        });
        return;
      }

      toast.success(
        skippedCount > 0
          ? t("csv_upload_success_with_skipped", {
              count: rowsToCreate.length,
              skipped: skippedCount,
            })
          : t("csv_upload_success", { count: parsedRows.length }),
      );
      queryClient.invalidateQueries({
        queryKey: ["product-mappings", selectedFacilityId],
      });
      setCsvFile(null);
      setParsedRows([]);
      setUploadOpen(false);
      setValidationErrors([]);
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? t("csv_upload_error"));
      console.error("Failed to upload product mappings:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleInvalidFile = (fileName: string) => {
    toast.error(t("invalid_file_format"));
    setValidationErrors([]);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("product_mappings")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("product_mappings_subtitle")}
        </p>
      </div>

      <div className="mb-6 flex items-end gap-4">
        <div className="flex-1">
          <FacilitySelector
            value={selectedFacilityId}
            onSelect={setSelectedFacilityId}
          />
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Dialog
            open={uploadOpen}
            onOpenChange={(open) => {
              if (!open) {
                setCsvFile(null);
                setParsedRows([]);
                setValidationErrors([]);
              }
              setUploadOpen(open);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!selectedFacilityId}>
                <UploadIcon className="mr-2 size-4" />
                {t("upload_mapping_csv")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md w-[95%] rounded-md">
              <DialogHeader>
                <DialogTitle>{t("upload_mapping_csv")}</DialogTitle>
                <DialogDescription>
                  {t("upload_mapping_csv_subtitle")}
                </DialogDescription>
              </DialogHeader>
              <FileDropzone
                accept=".csv"
                selectedFile={csvFile}
                onFileChange={handleFileSelected}
                dropLabel={t("drag_drop_csv_to_upload")}
                browseLabel={t("browse_file")}
                onInvalidFile={handleInvalidFile}
              />
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>{t("csv_validation_issues")}</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      {validationErrors.map((error, idx) => {
                        let message = "";
                        if (error.type === "missing_headers") {
                          const columns = Array.isArray(error.data)
                            ? error.data.join(", ")
                            : error.data;
                          message = `${t("csv_missing_headers")}: ${columns}`;
                        } else if (error.type === "empty_rows") {
                          message = `${t("csv_empty_values")}: ${error.data}`;
                        } else if (error.type === "parse_error") {
                          message = `${t("csv_parse_error")}: ${error.data}`;
                        } else if (error.type === "upload_errors") {
                          const rows = Array.isArray(error.data)
                            ? error.data.join(", ")
                            : error.data;
                          message = `${t("csv_upload_row_errors")}: ${rows}`;
                        }

                        return (
                          <li key={idx}>{message}</li>
                        );
                      })}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <DialogFooter className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadProductMappingTemplate}
                >
                  <DownloadIcon className="mr-2 size-4" />
                  {t("download_template")}
                </Button>
                <div className="flex gap-2">
                  <DialogClose asChild>
                    <Button variant="outline" disabled={isUploading}>
                      {t("cancel")}
                    </Button>
                  </DialogClose>
                  <Button
                    variant="primary"
                    disabled={!csvFile || validationErrors.length > 0 || isUploading}
                    onClick={uploadCsv}
                  >
                    {isUploading ? t("uploading") : t("upload")}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="primary"
            disabled={!selectedFacilityId}
            onClick={() => setMappingOpen(true)}
          >
            <PlusIcon className="mr-2 size-4" />
            {t("add_mapping_manually")}
          </Button>
        </div>
      </div>

      {!selectedFacilityId ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-16 text-center">
          <Settings2Icon className="text-gray-400 size-6" />
          <p className="font-medium text-gray-700">{t("select_facility_to_start")}</p>
        </div>
      ) : (
        <ProductMappings
          facilityId={selectedFacilityId}
          mappingOpen={mappingOpen}
          onMappingOpenChange={setMappingOpen}
        />
      )}
    </div>
  );
}
