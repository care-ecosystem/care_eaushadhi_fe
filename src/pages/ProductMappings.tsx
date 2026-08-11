import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FolderOpenIcon,
} from "lucide-react";

import { I18NNAMESPACE } from "@/lib/contants";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProductKnowledgeCombobox from "@/components/ProductKnowledgeCombobox";
import CategoryCombobox from "@/components/CategoryCombobox";
import { ProductKnowledge } from "@/types/productKnowledge";
import { formatDateTime } from "@/lib/utils";

interface Category {
  id: string;
  slug: string;
  title: string;
}

interface EaushadhiProductMapping {
  id: string;
  product_knowledge_id: string;
  product_knowledge_name: string;
  eaushadhi_drug_id: string;
}

type ProductMappingsProps = {
  facilityId: string;
  mappingOpen: boolean;
  onMappingOpenChange: (open: boolean) => void;
};

type MappingForm = {
  category: Category | null;
  productKnowledge: ProductKnowledge | null;
  eaushadhi_drug_id: string;
  eaushadhi_drug_name: string;
};

const EMPTY_MAPPING: MappingForm = {
  category: null,
  productKnowledge: null,
  eaushadhi_drug_id: "",
  eaushadhi_drug_name: "",
};

const ProductMappings: FC<ProductMappingsProps> = ({
  facilityId,
  mappingOpen,
  onMappingOpenChange,
}) => {
  const { t } = useTranslation(I18NNAMESPACE);
  const queryClient = useQueryClient();

  const [mappingForm, setMappingForm] = useState<MappingForm>(EMPTY_MAPPING);

  const { data: mappingsData } = useQuery({
    queryKey: ["product-mappings", facilityId],
    queryFn: () =>
      request<{ results: EaushadhiProductMapping[] }>(
        `/api/care_eaushadhi/product-mappings/`,
        HttpMethod.GET,
        {
          facility_id: facilityId,
          mapping_type: "BULK_IMPORT",
        },
      ),
    enabled: !!facilityId
  });

  const mappings = mappingsData?.results ?? [];


  const saveMapping = async () => {
    if (!mappingForm.productKnowledge || !mappingForm.eaushadhi_drug_id || !mappingForm.eaushadhi_drug_name) {
      return;
    }

    const payload = {
      facility_id: facilityId,
      product_knowledge_id: mappingForm.productKnowledge.id,
      eaushadhi_drug_id: mappingForm.eaushadhi_drug_id,
      eaushadhi_drug_name: mappingForm.eaushadhi_drug_name,
      mapping_type: "BULK_IMPORT",
    };

    try {
      await request(
        `/api/care_eaushadhi/product-mappings/`,
        HttpMethod.POST,
        payload,
      );
      toast.success(t("delivery_form_success"));
      setMappingForm(EMPTY_MAPPING);
      onMappingOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["product-mappings", facilityId] });
    } catch (error) {
      toast.error(t("delivery_form_error"));
      console.error("Failed to save mapping:", error);
    }
  };

  const handleCategoryChange = (category: Category | null) => {
    setMappingForm((prev) => ({
      ...prev,
      category,
      productKnowledge: null,
    }));
  };


  return (
    <div>
      <Dialog
        open={mappingOpen}
        onOpenChange={(open) => {
          if (!open) {
            setMappingForm(EMPTY_MAPPING);
          }
          onMappingOpenChange(open);
        }}
      >
        <DialogContent className="max-w-md w-[95%] rounded-md">
          <DialogHeader>
            <DialogTitle>
              {t("add_product_mapping")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                {t("create_pk_field_category")}
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <CategoryCombobox
                facilityId={facilityId}
                value={mappingForm.category}
                onChange={handleCategoryChange}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {t("product_knowledge")}
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <ProductKnowledgeCombobox
                facilityId={facilityId}
                value={mappingForm.productKnowledge}
                onChange={(productKnowledge) =>
                  setMappingForm((prev) => ({ ...prev, productKnowledge }))
                }
                categorySlug={mappingForm.category?.slug}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {t("eaushadhi_drug")} ID
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                type="text"
                placeholder="e.g., DRUG123"
                value={mappingForm.eaushadhi_drug_id}
                onChange={(e) =>
                  setMappingForm((prev) => ({
                    ...prev,
                    eaushadhi_drug_id: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                {t("eaushadhi_drug")} Name
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                type="text"
                placeholder="e.g., Paracetamol 500mg"
                value={mappingForm.eaushadhi_drug_name}
                onChange={(e) =>
                  setMappingForm((prev) => ({
                    ...prev,
                    eaushadhi_drug_name: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">{t("cancel")}</Button>
            </DialogClose>
            <Button
              variant="primary"
              disabled={
                !mappingForm.category ||
                !mappingForm.productKnowledge ||
                !mappingForm.eaushadhi_drug_id ||
                !mappingForm.eaushadhi_drug_name
              }
              onClick={saveMapping}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mappings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-16 text-center">
          <FolderOpenIcon className="text-gray-400 size-6" />
          <p className="font-medium text-gray-900">{t("no_mappings")}</p>
          <p className="text-sm text-gray-500">
            {t("no_mappings_description")}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 border-b border-gray-200">
              <TableRow className="hover:bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  {t("eaushadhi_drug")}
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  {t("product_knowledge")}
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  {t("create_pk_field_category")}
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  Created By
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  Created Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {mappings.map((mapping) => (
                <TableRow key={mapping.id} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {mapping.eaushadhi_drug_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Drug ID: {mapping.eaushadhi_drug_id}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-900">
                    <div>
                      <p className="font-medium">
                        {mapping.product_knowledge?.name || "—"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t("create_pk_field_slug")}: {mapping.product_knowledge?.slug_config?.slug_value || "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-900">
                    {mapping.product_knowledge?.category?.title || "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-900">
                    {mapping.created_by?.first_name} {mapping.created_by?.last_name}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-900">
                    {formatDateTime(mapping.created_date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ProductMappings;
