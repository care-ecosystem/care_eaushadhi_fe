import { useState } from "react";
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
import FileDropzone from "@/components/FileDropzone";
import ProductMappings from "./ProductMappings";
import { downloadProductMappingTemplate } from "@/lib/utils";

export default function ProductMappingsLayout() {
  const { t } = useTranslation(I18NNAMESPACE);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const uploadCsv = () => {
    // TODO: send csvFile to the bulk mapping upload API once available
    setCsvFile(null);
    setUploadOpen(false);
  };

  const handleInvalidFile = (fileName: string) => {
    toast.error(t("invalid_file_format"));
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
              if (!open) setCsvFile(null);
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
                onFileChange={setCsvFile}
                dropLabel={t("drag_drop_csv_to_upload")}
                browseLabel={t("browse_file")}
                onInvalidFile={handleInvalidFile}
              />
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
                  <Button variant="primary" disabled={!csvFile} onClick={uploadCsv}>
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
