import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
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
import type { FormattedError } from "@/utils/csvValidation";

export default function ProductMappingsLayout() {
  const { t } = useTranslation(I18NNAMESPACE);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<FormattedError[]>([]);
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
        } else {
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
      }
    };

    reader.readAsText(file);
  };

  const uploadCsv = () => {
    // TODO: send csvFile to the bulk mapping upload API once available
    setCsvFile(null);
    setUploadOpen(false);
    setValidationErrors([]);
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
                    <Button variant="outline">{t("cancel")}</Button>
                  </DialogClose>
                  <Button
                    variant="primary"
                    disabled={!csvFile || validationErrors.length > 0}
                    onClick={uploadCsv}
                  >
                    {t("upload")}
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
