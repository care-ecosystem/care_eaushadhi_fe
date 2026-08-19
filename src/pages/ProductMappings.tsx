import { FC, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderOpenIcon,
  PencilIcon,
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
  eaushadhi_drug_name: string;
  product_knowledge?: {
    id: string;
    name: string;
    slug_config?: { slug_value: string };
    category?: { id: string; title: string; slug: string };
  };
  created_by?: { first_name: string; last_name: string };
  created_date?: string;
}

type ProductMappingsProps = {
  facilityId: string;
  mappingOpen: boolean;
  onMappingOpenChange: (open: boolean) => void;
  onMappingsCountChange: (count: number) => void;
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

/** Matches the backend's default page size for this endpoint. */
const PRODUCT_MAPPINGS_PAGE_SIZE = 10;

const ProductMappings: FC<ProductMappingsProps> = ({
  facilityId,
  mappingOpen,
  onMappingOpenChange,
  onMappingsCountChange,
}) => {
  const { t } = useTranslation(I18NNAMESPACE);
  const queryClient = useQueryClient();

  const [mappingForm, setMappingForm] = useState<MappingForm>(EMPTY_MAPPING);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [offset, setOffset] = useState(0);

  const { data: mappingsData } = useQuery({
    queryKey: ["product-mappings", facilityId, offset],
    queryFn: () =>
      request<{ count: number; results: EaushadhiProductMapping[] }>(
        `/api/care_eaushadhi/product-mappings/`,
        HttpMethod.GET,
        {
          facility_id: facilityId,
          mapping_type: "BULK_IMPORT",
          limit: PRODUCT_MAPPINGS_PAGE_SIZE,
          offset,
        },
      ),
    enabled: !!facilityId
  });

  const mappings = mappingsData?.results ?? [];
  const totalCount = mappingsData?.count ?? 0;

  useEffect(() => {
    if (mappingsData) {
      onMappingsCountChange(mappingsData.count);
    }
  }, [mappingsData, onMappingsCountChange]);

  const rangeStart = totalCount === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PRODUCT_MAPPINGS_PAGE_SIZE, totalCount);
  const canGoPrev = offset > 0;
  const canGoNext = offset + PRODUCT_MAPPINGS_PAGE_SIZE < totalCount;

  useEffect(() => {
    setMappingForm(EMPTY_MAPPING);
    setEditingId(null);
    setOffset(0);
  }, [facilityId]);

  const saveMapping = async () => {
    const hasRequiredDrugFields = mappingForm.eaushadhi_drug_id && mappingForm.eaushadhi_drug_name;
    const hasRequiredCreateFields = mappingForm.productKnowledge && mappingForm.category && hasRequiredDrugFields;

    if (editingId ? !hasRequiredDrugFields : !hasRequiredCreateFields) {
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      if (editingId) {
        const updatePayload = {
          eaushadhi_drug_id: mappingForm.eaushadhi_drug_id,
          eaushadhi_drug_name: mappingForm.eaushadhi_drug_name,
        };
        await request(
          `/api/care_eaushadhi/product-mappings/${editingId}/`,
          HttpMethod.PATCH,
          updatePayload,
        );
        toast.success(t("mapping_updated_success"));
      } else {
        const createPayload = {
          facility_id: facilityId,
          product_knowledge_id: mappingForm.productKnowledge?.id,
          eaushadhi_drug_id: mappingForm.eaushadhi_drug_id,
          eaushadhi_drug_name: mappingForm.eaushadhi_drug_name,
          mapping_type: "BULK_IMPORT",
        };
        await request(
          `/api/care_eaushadhi/product-mappings/`,
          HttpMethod.POST,
          createPayload,
        );
        toast.success(t("mapping_created_success"));
      }
      setMappingForm(EMPTY_MAPPING);
      setEditingId(null);
      onMappingOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["product-mappings", facilityId] });
    } catch (error) {
      if (editingId) {
        toast.error(t("mapping_updated_error"));
      } else {
        toast.error(t("mapping_created_error"));
      }
      console.error("Failed to save mapping:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditMapping = (mapping: EaushadhiProductMapping) => {
    const productKnowledge = mapping.product_knowledge
      ? {
          id: mapping.product_knowledge.id,
          name: mapping.product_knowledge.name,
          slug: mapping.product_knowledge.slug_config?.slug_value || "",
        }
      : null;

    setMappingForm({
      category: mapping.product_knowledge?.category || null,
      productKnowledge,
      eaushadhi_drug_id: mapping.eaushadhi_drug_id,
      eaushadhi_drug_name: mapping.eaushadhi_drug_name,
    });
    setEditingId(mapping.id);
    onMappingOpenChange(true);
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
            setEditingId(null);
          }
          onMappingOpenChange(open);
        }}
      >
        <DialogContent className="max-w-md w-[95%] rounded-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("edit_mapping") : t("add_product_mapping")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                {t("create_pk_field_category")}
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              {editingId ? (
                <div className="px-3 py-2 rounded-md border border-gray-300 bg-gray-50 text-gray-600">
                  {mappingForm.category?.title || "—"}
                </div>
              ) : (
                <CategoryCombobox
                  facilityId={facilityId}
                  value={mappingForm.category}
                  onChange={handleCategoryChange}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>
                {t("product_knowledge")}
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              {editingId ? (
                <div className="px-3 py-2 rounded-md border border-gray-300 bg-gray-50 text-gray-600">
                  {mappingForm.productKnowledge?.name || "—"}
                </div>
              ) : (
                <ProductKnowledgeCombobox
                  facilityId={facilityId}
                  value={mappingForm.productKnowledge}
                  onChange={(productKnowledge) =>
                    setMappingForm((prev) => ({ ...prev, productKnowledge }))
                  }
                  categorySlug={mappingForm.category?.slug}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>
                {t("drug_id_label")}
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
                {t("drug_name_label")}
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
                isSaving || (
                  editingId
                    ? !mappingForm.eaushadhi_drug_id || !mappingForm.eaushadhi_drug_name
                    : !mappingForm.category || !mappingForm.productKnowledge || !mappingForm.eaushadhi_drug_id || !mappingForm.eaushadhi_drug_name
                )
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
          <Table className="table-fixed `min-w-[720px]`">
            <TableHeader className="bg-gray-50 border-b border-gray-200">
              <TableRow className="hover:bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-[30%]">
                  {t("product_knowledge")}
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-[12%]">
                  {t("create_pk_field_category")}
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-[30%]">
                  {t("eaushadhi_drug")}
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-[10%]">
                  {t("created_by")}
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-[10%]">
                  {t("created_date")}
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-[10%]">
                  {t("actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {mappings.map((mapping) => (
                <TableRow key={mapping.id} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3 text-gray-900">
                    <div>
                      <p className="font-medium break-words">
                        {mapping.product_knowledge?.name || "—"}
                      </p>
                      <p className="text-xs text-gray-500 break-words">
                        {t("create_pk_field_slug")}: {mapping.product_knowledge?.slug_config?.slug_value || "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-900 break-words">
                    {mapping.product_knowledge?.category?.title || "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 break-words">
                        {mapping.eaushadhi_drug_name}
                      </p>
                      <p className="text-xs text-gray-500 break-words">
                        {t("drug_id_label")}: {mapping.eaushadhi_drug_id}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-900 break-words">
                    {mapping.created_by?.first_name} {mapping.created_by?.last_name}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-900 break-words">
                    {formatDateTime(mapping.created_date)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditMapping(mapping)}
                    >
                      <PencilIcon className="mr-2 size-4" />
                      {t("edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              {t("pagination_showing", {
                start: rangeStart,
                end: rangeEnd,
                total: totalCount,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!canGoPrev}
                onClick={() =>
                  setOffset((prev) =>
                    Math.max(0, prev - PRODUCT_MAPPINGS_PAGE_SIZE),
                  )
                }
              >
                <ChevronLeftIcon className="mr-2 size-4" />
                {t("previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!canGoNext}
                onClick={() =>
                  setOffset((prev) => prev + PRODUCT_MAPPINGS_PAGE_SIZE)
                }
              >
                {t("next")}
                <ChevronRightIcon className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMappings;
