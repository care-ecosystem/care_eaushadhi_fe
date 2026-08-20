import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  DuplicateReasonCode,
  FormattedError,
  ProductMappingCsvRow,
} from "@/utils/csvValidation";
import {
  performBatchRequest,
  request,
  useSuperBatchRequest,
  SuperBatchError,
} from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import {
  buildProductKnowledgeLookupBatch,
  buildProductMappingBatch,
  buildProductMappingSearchBatch,
  chunkArray,
  chunkProductMappingRows,
  downloadAllProductMappings,
  downloadProductMappingReport,
  downloadProductMappingValidationReport,
  extractFailedRows,
  extractProductKnowledgeLookup,
  fetchAllProductMappings,
  hasExplicitSlugScope,
  PRODUCT_MAPPING_BATCH_SIZE,
  runWithConcurrency,
  splitRowsByExistingMapping,
  VALIDATION_REQUEST_CONCURRENCY,
} from "@/apis/productMappingBatch";
import type {
  FailedProductMappingRow,
  InactiveProductKnowledgeRow,
  ProductMappingReportRow,
  ProductMappingValidationReportRow,
  ResolvedProductMappingRow,
} from "@/apis/productMappingBatch";

type CsvValidationCounts = {
  ready: number;
  alreadyMapped: number;
  inactive: number;
  duplicates: number;
  failed: number;
};

const DUPLICATE_REASON_TRANSLATION_KEYS: Record<DuplicateReasonCode, string> = {
  DUPLICATE_ROW: "csv_duplicate_row",
  DUPLICATE_DRUG_ID: "csv_duplicate_drug_id",
  DUPLICATE_SLUG: "csv_duplicate_slug",
};

function getProgressPercent({ done, total }: { done: number; total: number }): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

export default function ProductMappingsLayout() {
  const { t } = useTranslation(I18NNAMESPACE);

  const getCsvValidationSummaryParts = (counts: CsvValidationCounts) =>
    [
      counts.ready > 0 && {
        text: t("csv_summary_ready", { count: counts.ready }),
        isFailure: false,
      },
      counts.alreadyMapped > 0 && {
        text: t("csv_summary_already_mapped", { count: counts.alreadyMapped }),
        isFailure: false,
      },
      counts.inactive > 0 && {
        text: t("csv_summary_inactive", { count: counts.inactive }),
        isFailure: false,
      },
      counts.duplicates > 0 && {
        text: t("csv_summary_duplicate", { count: counts.duplicates }),
        isFailure: false,
      },
      counts.failed > 0 && {
        text: t("csv_summary_failed", { count: counts.failed }),
        isFailure: true,
      },
    ].filter((part): part is { text: string; isFailure: boolean } =>
      Boolean(part),
    );

  const buildCsvValidationSummary = (counts: CsvValidationCounts) =>
    getCsvValidationSummaryParts(counts)
      .map((part) => part.text)
      .join(", ");

  const getCsvUploadReportSummaryParts = (counts: {
    success: number;
    skipped: number;
    failed: number;
  }) =>
    [
      counts.success > 0 && {
        text: t("csv_report_summary_success", { count: counts.success }),
        isFailure: false,
      },
      counts.skipped > 0 && {
        text: t("csv_report_summary_skipped", { count: counts.skipped }),
        isFailure: false,
      },
      counts.failed > 0 && {
        text: t("csv_report_summary_failed", { count: counts.failed }),
        isFailure: true,
      },
    ].filter((part): part is { text: string; isFailure: boolean } =>
      Boolean(part),
    );

  const getReportHeaders = () => [
    t("csv_report_header_drug_id"),
    t("csv_report_header_drug_name"),
    t("csv_report_header_pk_name"),
    t("csv_report_header_pk_slug"),
    t("csv_report_header_status"),
    t("csv_report_header_failure_reason"),
  ];

  const queryClient = useQueryClient();
  const superBatch = useSuperBatchRequest();
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [isDownloadingMappings, setIsDownloadingMappings] = useState(false);
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
    useState<InactiveProductKnowledgeRow[]>([]);

  const buildValidationReportRows = (): ProductMappingValidationReportRow[] =>
    [
      ...resolvedRows.map(({ row }) => ({
        ...row,
        status: "SUCCESS" as const,
      })),
      ...existingMappingRows.map((row) => ({
        ...row,
        status: "FAILED" as const,
        message: t("csv_skipped_existing_mapping"),
      })),
      ...inactiveProductKnowledgeRows.map((row) => ({
        ...row,
        status: "FAILED" as const,
        message: t("csv_inactive_product_knowledge_message", {
          status: row.productKnowledgeStatus,
        }),
      })),
      ...duplicateRows.map(({ reasonCode, ...row }) => ({
        ...row,
        status: "FAILED" as const,
        message: t(DUPLICATE_REASON_TRANSLATION_KEYS[reasonCode]),
      })),
      ...preUploadFailedRows.map((row) => ({
        ...row,
        status: "FAILED" as const,
        message: row.message,
      })),
    ].sort((a, b) => a.rowNum - b.rowNum);

  const { data: mappingsCountData, isLoading: isMappingsCountLoading } = useQuery({
    queryKey: ["product-mappings", selectedFacilityId, "count"],
    queryFn: () =>
      request<{ count: number }>(
        `/api/care_eaushadhi/product-mappings/`,
        HttpMethod.GET,
        {
          facility_id: selectedFacilityId,
          mapping_type: "BULK_IMPORT",
          limit: 1,
          offset: 0,
        },
      ),
    enabled: !!selectedFacilityId,
  });
  const mappingsCount = mappingsCountData?.count ?? null;

  const handleDownloadAllMappings = async () => {
    if (!selectedFacilityId || isDownloadingMappings) return;

    setIsDownloadingMappings(true);
    try {
      const mappings = await fetchAllProductMappings(selectedFacilityId);
      downloadAllProductMappings(mappings);
    } catch (error) {
      toast.error(
        (error as { message?: string })?.message ??
          t("download_all_mappings_error"),
      );
    } finally {
      setIsDownloadingMappings(false);
    }
  };

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
        const validationSteps = rows.length * 2;
        let validationDone = 0;
        setValidationProgress({ done: 0, total: validationSteps });

        const searchChunks = chunkProductMappingRows(rows);
        const rowsToCreate: ProductMappingCsvRow[] = [];
        const existingRows: ProductMappingCsvRow[] = [];
        const erroredSearchRows: FailedProductMappingRow[] = [];

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
              await performBatchRequest(searchPayload).catch((error: unknown) => {
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
            validationDone +=
              newRows.length + (chunkExisting.length + erroredRows.length) * 2;
            setValidationProgress({ done: validationDone, total: validationSteps });
          },
        );

        if (isStale()) return;

        const lookupChunks = chunkProductMappingRows(rowsToCreate);
        const resolved: ResolvedProductMappingRow[] = [];
        const failed: FailedProductMappingRow[] = [...erroredSearchRows];
        const inactive: InactiveProductKnowledgeRow[] = [];

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
              await performBatchRequest(lookupPayload).catch((error: unknown) => {
                if (error instanceof SuperBatchError) {
                  return error.results;
                }
                console.error("Product knowledge lookup batch failed:", error);
                return [];
              });

            if (isStale()) return;

            const facilitySplit = extractProductKnowledgeLookup(chunk, lookupResults);

            let chunkResolvedRows = facilitySplit.resolvedRows;
            let chunkInactiveRows = facilitySplit.inactiveRows;
            let chunkLookupFailedRows = facilitySplit.failedRows;

            const retryRows: ProductMappingCsvRow[] = facilitySplit.failedRows
              .filter((row) => !hasExplicitSlugScope(row.pkSlug))
              .map(({ message, ...row }) => row);

            if (retryRows.length > 0) {
              const instanceLookupPayload = buildProductKnowledgeLookupBatch(
                retryRows,
                facilityId,
                true,
              );
              const instanceLookupResults =
                await performBatchRequest(instanceLookupPayload).catch(
                  (error: unknown) => {
                    if (error instanceof SuperBatchError) {
                      return error.results;
                    }
                    console.error(
                      "Product knowledge instance-scope retry failed:",
                      error,
                    );
                    return [];
                  },
                );

              if (isStale()) return;

              const instanceSplit = extractProductKnowledgeLookup(
                retryRows,
                instanceLookupResults,
              );
              const definiteFailedRows = facilitySplit.failedRows.filter((row) =>
                hasExplicitSlugScope(row.pkSlug),
              );

              chunkResolvedRows = [...chunkResolvedRows, ...instanceSplit.resolvedRows];
              chunkInactiveRows = [...chunkInactiveRows, ...instanceSplit.inactiveRows];
              chunkLookupFailedRows = [...definiteFailedRows, ...instanceSplit.failedRows];
            }

            resolved.push(...chunkResolvedRows);
            failed.push(...chunkLookupFailedRows);
            inactive.push(...chunkInactiveRows);
            validationDone += chunk.length;
            setValidationProgress({ done: validationDone, total: validationSteps });
          },
        );

        if (isStale()) return;

        setExistingMappingRows(existingRows);
        setResolvedRows(resolved);
        setPreUploadFailedRows(failed);
        setInactiveProductKnowledgeRows(inactive);

        const counts: CsvValidationCounts = {
          ready: resolved.length,
          alreadyMapped: existingRows.length,
          inactive: inactive.length,
          duplicates: duplicateRows.length,
          failed: failed.length,
        };

        if (resolved.length === 0) {
          toast.error(
            t("csv_validation_nothing_to_upload", {
              breakdown: buildCsvValidationSummary(counts),
            }),
          );
        } else {
          toast.success(
            t("csv_validation_complete_toast", {
              ready: resolved.length,
              total:
                counts.ready +
                counts.alreadyMapped +
                counts.inactive +
                counts.duplicates +
                counts.failed,
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
          message: t("csv_skipped_existing_mapping"),
        })),
        ...inactiveProductKnowledgeRows.map((row) => ({
          ...row,
          status: "SKIPPED" as const,
          message: t("csv_inactive_product_knowledge_message", {
            status: row.productKnowledgeStatus,
          }),
        })),
        ...rolledBackRows.map((row) => ({
          ...row,
          status: "SKIPPED" as const,
          message: t("csv_skipped_batch_rollback"),
        })),
        ...duplicateRows.map(({ reasonCode, ...row }) => ({
          ...row,
          status: "SKIPPED" as const,
          message: t(DUPLICATE_REASON_TRANSLATION_KEYS[reasonCode]),
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

  const handleInvalidFile = (_fileName: string) => {
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
          <Button
            variant="outline"
            disabled={
              !selectedFacilityId ||
              isDownloadingMappings ||
              isMappingsCountLoading ||
              !mappingsCount
            }
            onClick={handleDownloadAllMappings}
          >
            <DownloadIcon className="mr-2 size-4" />
            {isDownloadingMappings
              ? t("downloading_mappings")
              : t("download_all_mappings")}
          </Button>
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
                <div className="flex flex-col gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Loader2Icon className="size-4 shrink-0 animate-spin" />
                    <span>
                      {t("csv_validating_rows", {
                        percent: getProgressPercent(validationProgress),
                      })}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-[width]"
                      style={{ width: `${getProgressPercent(validationProgress)}%` }}
                    />
                  </div>
                </div>
              )}
              {!isValidatingRows &&
                !isUploading &&
                parsedRows.length > 0 &&
                reportRows.length === 0 && (
                  <Alert>
                    <AlertTitle>
                      {existingMappingRows.length +
                        inactiveProductKnowledgeRows.length +
                        duplicateRows.length +
                        preUploadFailedRows.length >
                      0
                        ? t("csv_pre_validation_issues")
                        : t("csv_pre_validation_ready")}
                    </AlertTitle>
                    <AlertDescription>
                      <div className="flex flex-col items-start gap-2">
                        <div className="flex flex-col gap-0.5">
                          {getCsvValidationSummaryParts({
                            ready: resolvedRows.length,
                            alreadyMapped: existingMappingRows.length,
                            inactive: inactiveProductKnowledgeRows.length,
                            duplicates: duplicateRows.length,
                            failed: preUploadFailedRows.length,
                          }).map((part) => (
                            <p
                              key={part.text}
                              className={
                                part.isFailure
                                  ? "text-sm text-red-600"
                                  : "text-sm"
                              }
                            >
                              {part.text}
                            </p>
                          ))}
                        </div>
                        {resolvedRows.length > 0 &&
                          (existingMappingRows.length +
                            inactiveProductKnowledgeRows.length +
                            duplicateRows.length +
                            preUploadFailedRows.length) >
                            0 && (
                            <p className="text-sm">
                              {t("csv_pre_validation_partial_upload_notice", {
                                count: resolvedRows.length,
                              })}
                            </p>
                          )}
                        <p className="text-sm text-gray-950 dark:text-gray-50">
                          {t("csv_download_validation_report_label")}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white"
                          onClick={() =>
                            downloadProductMappingValidationReport(
                              buildValidationReportRows(),
                              {
                                headers: getReportHeaders(),
                                success: t("csv_validation_status_success"),
                                failed: t("csv_validation_status_failed"),
                              },
                            )
                          }
                        >
                          <DownloadIcon className="mr-2 size-4" />
                          {t("download_validation_report")}
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              {isUploading && (
                <div className="flex flex-col gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Loader2Icon className="size-4 shrink-0 animate-spin" />
                    <span>
                      {t("csv_uploading_progress", {
                        percent: getProgressPercent(uploadProgress),
                      })}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-[width]"
                      style={{ width: `${getProgressPercent(uploadProgress)}%` }}
                    />
                  </div>
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
                      <div className="flex flex-col gap-0.5">
                        {getCsvUploadReportSummaryParts({
                          success: reportSuccessCount,
                          skipped: reportSkippedCount,
                          failed: reportFailedCount,
                        }).map((part) => (
                          <p
                            key={part.text}
                            className={
                              part.isFailure ? "text-sm text-red-600" : "text-sm"
                            }
                          >
                            {part.text}
                          </p>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white text-gray-950 dark:text-gray-50"
                        onClick={() =>
                          downloadProductMappingReport(reportRows, {
                            headers: getReportHeaders(),
                            success: t("csv_report_status_success"),
                            failed: t("csv_report_status_failed"),
                            skipped: t("csv_report_status_skipped"),
                          })
                        }
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
