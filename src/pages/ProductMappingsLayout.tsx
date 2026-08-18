import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  PlusIcon,
  UploadIcon,
  Settings2Icon,
  DownloadIcon,
  Loader2Icon,
} from "lucide-react";
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
import type {
  DuplicateProductMappingCsvRow,
  FormattedError,
  ProductMappingCsvRow,
} from "@/utils/csvValidation";
import { useBatchRequest, useSuperBatchRequest, SuperBatchError } from "@/apis/query";
import {
  buildProductKnowledgeLookupBatch,
  buildProductMappingBatch,
  buildProductMappingSearchBatch,
  chunkArray,
  chunkProductMappingRows,
  downloadProductMappingReport,
  extractFailedRows,
  extractProductKnowledgeLookup,
  PRODUCT_MAPPING_BATCH_SIZE,
  runWithConcurrency,
  SKIPPED_BATCH_ROLLBACK_MESSAGE,
  SKIPPED_EXISTING_MAPPING_MESSAGE,
  splitRowsByExistingMapping,
  VALIDATION_REQUEST_CONCURRENCY,
} from "@/apis/productMappingBatch";
import type {
  FailedProductMappingRow,
  ProductMappingReportRow,
  ResolvedProductMappingRow,
} from "@/apis/productMappingBatch";

export default function ProductMappingsLayout() {
  const { t } = useTranslation(I18NNAMESPACE);
  const queryClient = useQueryClient();
  const superBatch = useSuperBatchRequest();
  const batchRequest = useBatchRequest();
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ProductMappingCsvRow[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<
    DuplicateProductMappingCsvRow[]
  >([]);
  const [validationErrors, setValidationErrors] = useState<FormattedError[]>([]);
  const [reportRows, setReportRows] = useState<ProductMappingReportRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  const [isValidatingRows, setIsValidatingRows] = useState(false);
  const [validationStage, setValidationStage] = useState<
    "search" | "lookup" | null
  >(null);
  const [validationProgress, setValidationProgress] = useState({
    done: 0,
    total: 0,
  });
  const [existingMappingRows, setExistingMappingRows] = useState<
    ProductMappingCsvRow[]
  >([]);
  const [resolvedRows, setResolvedRows] = useState<ResolvedProductMappingRow[]>(
    [],
  );
  const [preUploadFailedRows, setPreUploadFailedRows] = useState<
    FailedProductMappingRow[]
  >([]);
  const [inactiveProductKnowledgeRows, setInactiveProductKnowledgeRows] =
    useState<FailedProductMappingRow[]>([]);

  const fileReaderRef = useRef<FileReader | null>(null);
  const selectionIdRef = useRef<number>(0);
  const validationRunIdRef = useRef(0);

  const handleFileSelected = (file: File | null) => {
    if (fileReaderRef.current) {
      fileReaderRef.current.abort();
    }

    selectionIdRef.current += 1;
    const currentSelectionId = selectionIdRef.current;

    setCsvFile(file);
    setValidationErrors([]);
    setParsedRows([]);
    setDuplicateRows([]);
    setReportRows([]);
    setExistingMappingRows([]);
    setResolvedRows([]);
    setPreUploadFailedRows([]);
    setInactiveProductKnowledgeRows([]);

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
          setDuplicateRows([]);
        } else {
          setParsedRows(validation.rows ?? []);
          setDuplicateRows(validation.duplicateRows ?? []);
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

  useEffect(() => {
    if (parsedRows.length === 0 || !selectedFacilityId) {
      validationRunIdRef.current += 1;
      setIsValidatingRows(false);
      setValidationStage(null);
      setExistingMappingRows([]);
      setResolvedRows([]);
      setPreUploadFailedRows([]);
      setInactiveProductKnowledgeRows([]);
      return;
    }

    const runId = ++validationRunIdRef.current;
    const rows = parsedRows;
    const facilityId = selectedFacilityId;
    const isStale = () => runId !== validationRunIdRef.current;

    setIsValidatingRows(true);
    setReportRows([]);
    setExistingMappingRows([]);
    setResolvedRows([]);
    setPreUploadFailedRows([]);
    setInactiveProductKnowledgeRows([]);

    (async () => {
      try {
        setValidationStage("search");
        setValidationProgress({ done: 0, total: rows.length });

        const searchChunks = chunkProductMappingRows(rows);
        const rowsToCreate: ProductMappingCsvRow[] = [];
        const existingRows: ProductMappingCsvRow[] = [];
        const erroredSearchRows: FailedProductMappingRow[] = [];
        let searchDone = 0;

        await runWithConcurrency(
          searchChunks,
          VALIDATION_REQUEST_CONCURRENCY,
          async (chunk) => {
            if (isStale()) return;

            const searchPayload = buildProductMappingSearchBatch(
              chunk,
              facilityId,
            );
            const searchResults =
              await batchRequest.mutateAsync(searchPayload).catch((error) => {
                if (error instanceof SuperBatchError) {
                  return error.results;
                }
                console.error("Existing-mapping search batch failed:", error);
                return [];
              });

            if (isStale()) return;

            const { existingRows: chunkExisting, newRows, erroredRows } =
              splitRowsByExistingMapping(chunk, searchResults);
            existingRows.push(...chunkExisting);
            rowsToCreate.push(...newRows);
            erroredSearchRows.push(...erroredRows);
            searchDone += chunk.length;
            setValidationProgress({ done: searchDone, total: rows.length });
          },
        );

        if (isStale()) return;

        setValidationStage("lookup");
        setValidationProgress({ done: 0, total: rowsToCreate.length });

        const lookupChunks = chunkProductMappingRows(rowsToCreate);
        const resolved: ResolvedProductMappingRow[] = [];
        const failed: FailedProductMappingRow[] = [...erroredSearchRows];
        const inactive: FailedProductMappingRow[] = [];
        let lookupDone = 0;

        await runWithConcurrency(
          lookupChunks,
          VALIDATION_REQUEST_CONCURRENCY,
          async (chunk) => {
            if (isStale()) return;

            const lookupPayload = buildProductKnowledgeLookupBatch(
              chunk,
              facilityId,
            );
            const lookupResults =
              await batchRequest.mutateAsync(lookupPayload).catch((error) => {
                if (error instanceof SuperBatchError) {
                  return error.results;
                }
                console.error("Product knowledge lookup batch failed:", error);
                return [];
              });

            if (isStale()) return;

            const {
              resolvedRows: chunkResolvedRows,
              failedRows: chunkLookupFailedRows,
              inactiveRows: chunkInactiveRows,
            } = extractProductKnowledgeLookup(chunk, lookupResults);
            resolved.push(...chunkResolvedRows);
            failed.push(...chunkLookupFailedRows);
            inactive.push(...chunkInactiveRows);
            lookupDone += chunk.length;
            setValidationProgress({ done: lookupDone, total: rowsToCreate.length });
          },
        );

        if (isStale()) return;

        setExistingMappingRows(existingRows);
        setResolvedRows(resolved);
        setPreUploadFailedRows(failed);
        setInactiveProductKnowledgeRows(inactive);

        if (resolved.length === 0) {
          toast.error(
            t("csv_validation_nothing_to_upload", {
              skipped:
                existingRows.length + inactive.length + duplicateRows.length,
              failed: failed.length,
            }),
          );
        } else {
          toast.success(
            t("csv_validation_complete_toast", {
              ready: resolved.length,
              total: rows.length,
            }),
          );
        }
      } catch (error) {
        if (isStale()) return;
        toast.error(
          (error as { message?: string })?.message ??
            t("csv_validation_failed"),
        );
        console.error("Failed to validate product mapping rows:", error);
      } finally {
        if (!isStale()) {
          setIsValidatingRows(false);
          setValidationStage(null);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedRows, selectedFacilityId]);

  const uploadCsv = async () => {
    if (
      !csvFile ||
      isUploading ||
      isValidatingRows ||
      reportRows.length > 0 ||
      resolvedRows.length === 0
    )
      return;

    setIsUploading(true);
    setValidationErrors([]);
    setUploadProgress({ done: 0, total: resolvedRows.length });

    try {
      // Phase 3: create mappings for the rows resolved by pre-validation.
      const createChunks = chunkArray(resolvedRows, PRODUCT_MAPPING_BATCH_SIZE);
      const successRows: ProductMappingCsvRow[] = [];
      const rolledBackRows: ProductMappingCsvRow[] = [];
      const failedRows: FailedProductMappingRow[] = [...preUploadFailedRows];
      let uploadDone = 0;

      for (const chunk of createChunks) {
        const payload = buildProductMappingBatch(chunk, selectedFacilityId);
        try {
          await superBatch.mutateAsync(payload);
          successRows.push(...chunk.map(({ row }) => row));
        } catch (error) {
          if (error instanceof SuperBatchError) {
            const { failedRows: chunkFailedRows, rolledBackRows: chunkRolledBackRows } =
              extractFailedRows(chunk, error.results);
            failedRows.push(...chunkFailedRows);
            rolledBackRows.push(...chunkRolledBackRows);
          } else {
            throw error;
          }
        } finally {
          uploadDone += chunk.length;
          setUploadProgress({ done: uploadDone, total: resolvedRows.length });
        }
      }

      const skippedCount =
        existingMappingRows.length +
        inactiveProductKnowledgeRows.length +
        duplicateRows.length;
      const report: ProductMappingReportRow[] = [
        ...successRows.map((row) => ({
          ...row,
          status: "SUCCESS" as const,
        })),
        ...existingMappingRows.map((row) => ({
          ...row,
          status: "SKIPPED" as const,
          message: SKIPPED_EXISTING_MAPPING_MESSAGE,
        })),
        ...inactiveProductKnowledgeRows.map((row) => ({
          ...row,
          status: "SKIPPED" as const,
          message: row.message,
        })),
        ...rolledBackRows.map((row) => ({
          ...row,
          status: "SKIPPED" as const,
          message: SKIPPED_BATCH_ROLLBACK_MESSAGE,
        })),
        ...duplicateRows.map(({ reason, ...row }) => ({
          ...row,
          status: "SKIPPED" as const,
          message: reason,
        })),
        ...failedRows.map((row) => ({
          ...row,
          status: "FAILED" as const,
          message: row.message,
        })),
      ].sort((a, b) => a.rowNum - b.rowNum);

      setReportRows(report);

      if (failedRows.length > 0) {
        toast.error(t("csv_upload_row_errors"));
      } else {
        toast.success(
          skippedCount > 0
            ? t("csv_upload_success_with_skipped", {
                count: successRows.length,
                skipped: skippedCount,
              })
            : t("csv_upload_success", { count: successRows.length }),
        );
      }

      queryClient.invalidateQueries({
        queryKey: ["product-mappings", selectedFacilityId],
      });
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

  const reportFailedCount = reportRows.filter(
    (row) => row.status === "FAILED",
  ).length;
  const reportSkippedCount = reportRows.filter(
    (row) => row.status === "SKIPPED",
  ).length;
  const reportSuccessCount = reportRows.filter(
    (row) => row.status === "SUCCESS",
  ).length;

  return (
    <div className="container mx-auto max-w-8xl px-4 py-6">
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
                setDuplicateRows([]);
                setValidationErrors([]);
                setReportRows([]);
                setUploadProgress({ done: 0, total: 0 });
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
              {isValidatingRows && (
                <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <Loader2Icon className="size-4 shrink-0 animate-spin" />
                  <span>
                    {validationStage === "search"
                      ? t("csv_validating_existing", validationProgress)
                      : t("csv_validating_product_knowledge", validationProgress)}
                  </span>
                </div>
              )}
              {!isValidatingRows &&
                !isUploading &&
                parsedRows.length > 0 &&
                reportRows.length === 0 && (
                  <Alert>
                    <AlertTitle>{t("csv_pre_validation_ready")}</AlertTitle>
                    <AlertDescription>
                      <p className="text-sm">
                        {t("csv_pre_validation_summary", {
                          ready: resolvedRows.length,
                          skipped: existingMappingRows.length,
                          inactive: inactiveProductKnowledgeRows.length,
                          duplicates: duplicateRows.length,
                          failed: preUploadFailedRows.length,
                        })}
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              {isUploading && (
                <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <Loader2Icon className="size-4 shrink-0 animate-spin" />
                  <span>{t("csv_uploading_progress", uploadProgress)}</span>
                </div>
              )}
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
                        }

                        return (
                          <li key={idx}>{message}</li>
                        );
                      })}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {reportRows.length > 0 && (
                <Alert variant={reportFailedCount > 0 ? "destructive" : "default"}>
                  <AlertTitle>
                    {reportFailedCount > 0
                      ? t("csv_upload_row_errors")
                      : t("csv_upload_complete")}
                  </AlertTitle>
                  <AlertDescription>
                    <div className="flex flex-col items-start gap-2 mt-2">
                      <p className="text-sm">
                        {t("csv_upload_report_summary", {
                          success: reportSuccessCount,
                          skipped: reportSkippedCount,
                          failed: reportFailedCount,
                        })}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white"
                        onClick={() => downloadProductMappingReport(reportRows)}
                      >
                        <DownloadIcon className="mr-2 size-4" />
                        {t("download_report")}
                      </Button>
                    </div>
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
                      {reportRows.length > 0 ? t("close") : t("cancel")}
                    </Button>
                  </DialogClose>
                  <Button
                    variant="primary"
                    disabled={
                      !csvFile ||
                      validationErrors.length > 0 ||
                      isValidatingRows ||
                      isUploading ||
                      reportRows.length > 0 ||
                      resolvedRows.length === 0
                    }
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
