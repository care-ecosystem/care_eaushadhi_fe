import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import {
  Trash2,
  AlertCircle,
  RefreshCw,
  CloudOff,
  CircleCheck,
  PlusIcon,
} from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import { useSuperBatchRequest, SuperBatchError } from "@/apis/query";
import { RowDeliveryInput, RowDeliveryBatchContext } from "@/apis";
import {
  buildChainBatch,
  chunkRows,
  extractChainResults,
  SUPER_BATCH_CHAIN_SIZE,
} from "@/apis/chainBuilder";
import { I18NNAMESPACE, INWARD_RECORDS_PAGE_SIZE } from "@/lib/contants";
import {
  formatDateForEaushadhiAPI,
  extractGenericName,
  extractDosageFormFilter,
} from "@/lib/utils";
import { useInstituteMapping } from "@/contexts/InstituteMappingContext";

// ─── Error Handling Utilities (inline) ──────────────────────────────────────
interface ErrorDetail {
  reference_id: string;
  field?: string;
  message: string;
  type?: string;
}

function extractErrorDetailsFromSuperBatch(
  results: any[]
): ErrorDetail[] {
  const errors: ErrorDetail[] = [];

  results.forEach((result) => {
    if (result.status_code > 299) {
      const data = result.data as any;

      if (Array.isArray(data?.errors)) {
        data.errors.forEach((err: any) => {
          if (err.type === "validation_error" && err.msg) {
            // err.msg is an object like { quantity_received: [message] }
            Object.entries(err.msg).forEach(([field, messages]: [string, any]) => {
              const fieldMessages = Array.isArray(messages) ? messages : [messages];
              fieldMessages.forEach((msg: string) => {
                errors.push({
                  reference_id: result.reference_id,
                  field,
                  message: msg,
                  type: err.type,
                });
              });
            });
          } else if (err.msg && typeof err.msg === "string") {
            errors.push({
              reference_id: result.reference_id,
              message: err.msg,
              type: err.type,
            });
          }
        });
      }
      else if (data?.detail && typeof data.detail === "string") {
        errors.push({
          reference_id: result.reference_id,
          message: data.detail,
        });
      }
      else if (data?.message && typeof data.message === "string") {
        errors.push({
          reference_id: result.reference_id,
          message: data.message,
        });
      }
    }
  });

  return errors;
}


function formatErrorMessage(errors: ErrorDetail[], t: (key: string) => string): string {
  if (errors.length === 0) return t("supply_form_unexpected_error");

  const byRef = new Map<string, ErrorDetail[]>();
  errors.forEach((err) => {
    if (!byRef.has(err.reference_id)) {
      byRef.set(err.reference_id, []);
    }
    byRef.get(err.reference_id)!.push(err);
  });

  const messages = errors.map((e) => e.message);

  return messages.join("\n");
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface ProductKnowledge {
  id: string;
  slug: string;
  name: string;
}

interface ProductMapping {
  id: string;
  eaushadhi_drug_name: string;
  eaushadhi_drug_id: string;
  product_knowledge: ProductKnowledge;
  mapping_type?: string;
  usage_count?: number;
}

interface RowItem {
  product_knowledge_id: string;
  product_knowledge_slug: string;
  product_knowledge_name: string;
  supplied_item_id: string;
  record_item_id: string;
  charge_item_category_slug: string;
  batch_number: string;
  expiry_date: string;
  is_new_batch: boolean;
  pack_size: number;
  pack_qty: number;
  quantity: string;
  accepted_pack_qty: number;
  accepted_qty_in_units: string;
  quantity_in_units: string;
  eaushadhi_drug_name?: string;
  eaushadhi_drug_id?: string;
  product_mapping_id?: string;
  suggested_base_unit_code?: string;
}

interface ItemDelivery {
  id: string;
  status: string;
  quantity_received: string;
  supply_delivery_id?: string;
  record_delivery_id?: string;
}

interface DiscrepancyItem {
  drug_name: string;
  available_qty: number;
  accepted_qty: number;
  pack_size: number;
  supply_delivery_ids: string[];
  record_item_delivery_ids: string[];
}

interface InwardItem {
  id: string;
  drug_name: string;
  drug_id: string;
  batch_no: string;
  expiry_date: string;
  quantity_received_current: string;
  unit_pack: string;
  quantity_in_units?: string;
  warehouse_name: string;
  item_deliveries: ItemDelivery[];
}

interface Delivery {
  id: string;
  inward_record_id: string;
  delivery_order_id: string;
}

interface InwardRecord {
  id: string;
  facility_id: string;
  inward_date: string;
  sync_status: string;
  items_initial_count: number;
  items_current_count: number;
  items: InwardItem[];
  deliveries: Delivery[];
}

interface SupplierMapping {
  id: string;
  supplier_id: string;
  eaushadhi_warehouse_name: string;
  supplier_name: string;
  is_default: boolean;
}

interface InstituteMappingResponse {
  count: number;
  results: Array<{
    id: string;
    facility_id: string;
    eaushadhi_institute_id: string;
    supplier_mappings: SupplierMapping[];
  }>;
}

interface InitiateInwardFetchPayload {
  facility_id: string;
  inward_date: string;
  triggered_by: "USER";
  force_refresh: boolean;
}

interface DefaultProductMappingsResponse {
  results: ProductMapping[];
}

const EMPTY_ROW = (): RowItem => ({
  product_knowledge_id: "",
  product_knowledge_slug: "",
  product_knowledge_name: "",
  supplied_item_id: "",
  record_item_id: "",
  charge_item_category_slug: "",
  batch_number: "",
  expiry_date: "",
  is_new_batch: false,
  pack_size: 1,
  pack_qty: 1,
  quantity: "1",
  accepted_pack_qty: 1,
  accepted_qty_in_units: "1",
  quantity_in_units: "",
  eaushadhi_drug_name: "",
  eaushadhi_drug_id: "",
  product_mapping_id: "",
  suggested_base_unit_code: "",
});

function inferBaseUnitCode(drugName: string): string {
  const forms = extractDosageFormFilter(drugName);
  if (!forms) return "{count}";
  if (forms.includes("tablet")) return "{tbl}";
  if (forms.includes("drop") || forms.includes("eye")) return "[drp]";
  if (
    forms.some((f) =>
      ["injection", "infusion", "solution", "syrup", "suspension"].includes(f),
    )
  )
    return "mL";
  if (forms.some((f) => ["cream", "gel", "ointment", "powder"].includes(f)))
    return "g";
  return "{count}";
}

const DOSAGE_UNITS = [
  { code: "{tbl}", display: "tablets", system: "http://unitsofmeasure.org" },
  { code: "g", display: "gram", system: "http://unitsofmeasure.org" },
  { code: "mg", display: "milligram", system: "http://unitsofmeasure.org" },
  { code: "ug", display: "microgram", system: "http://unitsofmeasure.org" },
  { code: "mL", display: "milliliter", system: "http://unitsofmeasure.org" },
  { code: "[drp]", display: "drop", system: "http://unitsofmeasure.org" },
  {
    code: "[iU]",
    display: "international unit",
    system: "http://unitsofmeasure.org",
  },
  { code: "{count}", display: "count", system: "http://unitsofmeasure.org" },
] as const;

function toSlug(value: string, maxLength: number): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, maxLength);
}

// ─── Create Product Knowledge Dialog ──────────────────────────────────────────
function CreateProductKnowledgeDialog({
  facilityId,
  eaushadhiDrugId,
  eaushadhiDrugName,
  open,
  onOpenChange,
  onCreated,
  suggestedBaseUnitCode,
  suggestedName,
}: {
  facilityId: string;
  eaushadhiDrugId: string;
  eaushadhiDrugName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (mapping: ProductMapping) => void;
  suggestedBaseUnitCode?: string;
  suggestedName?: string;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const [name, setName] = useState("");
  const [slugValue, setSlugValue] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [baseUnitCode, setBaseUnitCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefill or reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      const displayName = eaushadhiDrugName;
      setName(displayName);
      setSlugValue(toSlug(displayName, 25));
      setCategorySlug("");
      setBaseUnitCode(suggestedBaseUnitCode ?? "");
      setErrors({});
    }
  }, [open, eaushadhiDrugName]);

  const { data: categoriesData } = useQuery({
    queryKey: ["resourceCategories", facilityId, "product_knowledge"],
    queryFn: () =>
      request<{
        results: Array<{ id: string; title: string; slug: string }>;
      }>(`/api/v1/facility/${facilityId}/resource_category/`, HttpMethod.GET, {
        resource_type: "product_knowledge",
      }),
    enabled: open && !!facilityId,
  });

  const categories = categoriesData?.results ?? [];

  function handleNameChange(value: string) {
    setName(value);
    setSlugValue(toSlug(value, 25));
    if (errors.name) setErrors((e) => ({ ...e, name: "" }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("create_pk_error_name_required");
    const slug = slugValue.trim();
    if (slug.length < 5 || slug.length > 25 || !/^[a-z0-9_-]+$/.test(slug))
      next.slugValue = t("create_pk_error_slug_invalid");
    if (!categorySlug)
      next.categorySlug = t("create_pk_error_category_required");
    if (!baseUnitCode)
      next.baseUnitCode = t("create_pk_error_base_unit_required");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const baseUnit = DOSAGE_UNITS.find((u) => u.code === baseUnitCode)!;
      const pk = await request<{ id: string; slug: string; name: string }>(
        `/api/v1/product_knowledge/`,
        HttpMethod.POST,
        {
          name: name.trim(),
          slug_value: slugValue.trim(),
          product_type: "medication",
          status: "active",
          category: categorySlug,
          base_unit: baseUnit,
          facility: facilityId,
          names: [],
          storage_guidelines: [],
        },
      );

      toast.success(t("create_pk_success"));
      onCreated({
        id: "",
        eaushadhi_drug_name: eaushadhiDrugName,
        eaushadhi_drug_id: eaushadhiDrugId,
        product_knowledge: pk,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Error creating product knowledge:", err);
      toast.error(t("create_pk_error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create_pk_title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="pk-name">
              {t("create_pk_field_name")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pk-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-9 text-sm"
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="pk-slug">
              {t("create_pk_field_slug")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pk-slug"
              value={slugValue}
              onChange={(e) => {
                const v = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_-]/g, "");
                setSlugValue(v);
                if (errors.slugValue)
                  setErrors((err) => ({ ...err, slugValue: "" }));
              }}
              className="h-9 text-sm"
            />
            <p className="text-xs text-gray-500">{t("create_pk_slug_hint")}</p>
            {errors.slugValue && (
              <p className="text-xs text-red-500">{errors.slugValue}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="pk-category">
              {t("create_pk_field_category")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Select
              value={categorySlug}
              onValueChange={(v) => {
                setCategorySlug(v);
                if (errors.categorySlug)
                  setErrors((err) => ({ ...err, categorySlug: "" }));
              }}
            >
              <SelectTrigger id="pk-category" className="h-9 text-sm w-full">
                <SelectValue placeholder={t("create_pk_select_category")} />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 && (
                  <div className="py-3 text-center text-xs text-gray-500">
                    {t("create_pk_no_categories")}
                  </div>
                )}
                {categories.map((cat) => (
                  <SelectItem key={cat.slug} value={cat.slug}>
                    {cat.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categorySlug && (
              <p className="text-xs text-red-500">{errors.categorySlug}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="pk-base-unit">
              {t("create_pk_field_base_unit")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Select
              value={baseUnitCode}
              onValueChange={(v) => {
                setBaseUnitCode(v);
                if (errors.baseUnitCode)
                  setErrors((err) => ({ ...err, baseUnitCode: "" }));
              }}
            >
              <SelectTrigger id="pk-base-unit" className="h-9 text-sm w-full">
                <SelectValue placeholder={t("create_pk_select_base_unit")} />
              </SelectTrigger>
              <SelectContent>
                {DOSAGE_UNITS.map((unit) => (
                  <SelectItem key={unit.code} value={unit.code}>
                    {unit.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.baseUnitCode && (
              <p className="text-xs text-red-500">{errors.baseUnitCode}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("supply_form_cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? t("supply_form_saving") : t("create_pk_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Mapping Selector with Lazy Search ──────────────────────────────
function ProductMappingSelector({
  facilityId,
  eaushadhiDrugId,
  eaushadhiDrugName,
  value,
  isLoading,
  onSelect,
  suggestedBaseUnitCode,
  suggestedName,
  autofillMapping,
}: {
  facilityId: string;
  eaushadhiDrugId: string;
  eaushadhiDrugName: string;
  value: string;
  isLoading: boolean;
  onSelect: (mapping: ProductMapping) => void;
  suggestedBaseUnitCode?: string;
  suggestedName?: string;
  autofillMapping?: ProductMapping;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const { meta } = useInstituteMapping();
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductMapping[]>([]);
  const [canCreate, setCanCreate] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Initialize with autofill mapping if available
  useEffect(() => {
    if (
      autofillMapping &&
      eaushadhiDrugId === autofillMapping.eaushadhi_drug_id
    ) {
      if (!hasFetched) {
        setSearchResults([autofillMapping]);
      }
      if (!value) {
        onSelect(autofillMapping);
      }
    }
  }, [autofillMapping, eaushadhiDrugId, value, onSelect]);

  // Fetch product mappings when dropdown opens (search behavior)
  const fetchMappings = useCallback(async (): Promise<ProductMapping[]> => {
    if (!eaushadhiDrugId || isSearching) return [];

    setIsSearching(true);
    setCanCreate(false);
    try {
      const response = await request<{
        results: ProductMapping[];
        can_create: boolean;
      }>(`/api/care_eaushadhi/product-mappings/search/`, HttpMethod.GET, {
        facility_id: facilityId,
        eaushadhi_drug_id: eaushadhiDrugId,
      });
      setSearchResults(response.results || []);
      setCanCreate(response.can_create ?? false);
      return response.results || [];
    } catch (err) {
      console.error("Error fetching product mappings:", err);
      toast.error(t("supply_form_load_products_error"));
      setSearchResults([]);
      setCanCreate(false);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [facilityId, eaushadhiDrugId, isSearching, t]);

  // Fetch mappings when dropdown opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !hasFetched && !isSearching) {
      fetchMappings();
      setHasFetched(true);
    }
  };


  return (
    <>
      <Select
        value={value || undefined}
        onValueChange={(mappingId) => {
          const mapping = searchResults.find((m) => m.id === mappingId);
          if (mapping) {
            onSelect(mapping);
            setIsOpen(false);
          }
        }}
        open={isOpen}
        onOpenChange={handleOpenChange}
        disabled={isLoading || !eaushadhiDrugId}
        modal={false}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue
            placeholder={
              !eaushadhiDrugId
                ? t("supply_form_no_drug_selected")
                : isSearching
                  ? t("supply_form_loading")
                  : t("supply_form_select_product")
            }
          />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="w-[var(--radix-select-trigger-width)]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {isSearching && (
            <div className="flex items-center justify-center py-4 text-xs text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border border-gray-200 border-t-gray-900 mr-2" />
              {t("supply_form_searching")}
            </div>
          )}
          {!isSearching && searchResults.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-4 px-2">
              <p className="text-xs text-gray-500">
                {t("supply_form_no_products_found")}
              </p>
            </div>
          )}
          {!isSearching && (() => {
            const imported = searchResults.filter(m => m.mapping_type === "BULK_IMPORT");
            const suggestions = searchResults
              .filter(m => m.mapping_type !== "BULK_IMPORT")
              .sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0));

            const renderGroup = (label: string, items: typeof searchResults) =>
              items.length > 0 && (
                <SelectGroup key={label}>
                  <SelectLabel className="text-xs text-gray-400 font-medium px-2 py-1">
                    {label}
                  </SelectLabel>
                  {items.map((mapping) => (
                    <SelectPrimitive.Item
                      key={mapping.id}
                      value={mapping.id}
                      className="focus:bg-gray-100 focus:text-gray-900 relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 whitespace-normal wrap-break-word"
                    >
                      <span className="absolute right-2 flex size-3.5 items-center justify-center">
                        <SelectPrimitive.ItemIndicator>
                          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12" /></svg>
                        </SelectPrimitive.ItemIndicator>
                      </span>
                      <SelectPrimitive.ItemText>
                        {mapping.product_knowledge.name}
                      </SelectPrimitive.ItemText>
                      {(mapping.usage_count ?? 0) > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 tabular-nums">
                          {mapping.usage_count}&nbsp;{t("times")}
                        </span>
                      )}
                    </SelectPrimitive.Item>
                  ))}
                </SelectGroup>
              );

            return (
              <>
                {renderGroup(t("supply_form_product_group_imported"), imported)}
                {renderGroup(t("supply_form_product_group_suggestions"), suggestions)}
              </>
            );
          })()}
          {!isSearching && canCreate && (meta?.allow_creating_product_knowledge ?? false) && (
            <div className="flex flex-col items-center gap-2 py-2 px-2 border-t mt-1">
              <Button
                variant="primary"
                size="default"
                type="button"
                className="w-full"
                onClick={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                  setCreateDialogOpen(true);
                }}
              >
                <PlusIcon className="h-4 w-4" />
                {t("supply_form_create_product_knowledge")}
              </Button>
            </div>
          )}
        </SelectContent>
      </Select>

      <CreateProductKnowledgeDialog
        facilityId={facilityId}
        eaushadhiDrugId={eaushadhiDrugId}
        eaushadhiDrugName={eaushadhiDrugName}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        suggestedBaseUnitCode={suggestedBaseUnitCode}
        suggestedName={suggestedName}
        onCreated={async (mapping) => {
          setSearchResults([]);
          const results = await fetchMappings();
          const realMapping = results.find(
            (m) => m.product_knowledge.id === mapping.product_knowledge.id,
          );
          if (realMapping) onSelect(realMapping);
        }}
      />
    </>
  );
}

// ─── Delivery Row ──────────────────────────────────────────────────────────
// ─── Delivery Row ──────────────────────────────────────────────────────────
function DeliveryRowImpl({
  facilityId,
  row,
  updateRow,
  removeRow,
  allowDeletingInward,
  allowUpdatingQuantity,
  autofillMapping,
}: {
  facilityId: string;
  row: RowItem;
  updateRow: (id: string, updated: RowItem) => void;
  removeRow: (id: string) => void;
  allowDeletingInward: boolean;
  allowUpdatingQuantity: boolean;
  autofillMapping?: ProductMapping;
  suggestedBaseUnitCode?: string;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const queryClient = useQueryClient();

  const onChange = useCallback(
    (updated: RowItem) => updateRow(row.record_item_id, updated),
    [updateRow, row.record_item_id],
  );

  const onRemove = useCallback(
    () => removeRow(row.record_item_id),
    [removeRow, row.record_item_id],
  );

  const set = useCallback(
    (field: keyof RowItem, value: unknown) =>
      onChange({ ...row, [field]: value } as RowItem),
    [row, onChange],
  );

  const handleSelectMapping = (mapping: ProductMapping) => {
    queryClient.removeQueries({
      queryKey: ["products-autofill", facilityId, mapping.product_knowledge.id],
    });
    onChange({
      ...row,
      product_knowledge_id: mapping.product_knowledge.id,
      product_knowledge_slug: mapping.product_knowledge.slug,
      product_knowledge_name: mapping.product_knowledge.name,
      product_mapping_id: mapping.id,
    });
  };

  return (
    <tr className="align-top divide-x divide-gray-100 hover:bg-gray-50/40">
      <td className="px-2 py-2 min-w-[280px] max-w-[400px]">
        <div className="flex flex-col gap-1">
          <ProductMappingSelector
            facilityId={facilityId}
            eaushadhiDrugId={row.eaushadhi_drug_id || ""}
            eaushadhiDrugName={row.eaushadhi_drug_name || ""}
            value={row.product_mapping_id || ""}
            isLoading={false}
            onSelect={handleSelectMapping}
            suggestedBaseUnitCode={row.suggested_base_unit_code}
            suggestedName={row.product_knowledge_name}
            autofillMapping={autofillMapping}
          />
          {row.eaushadhi_drug_name && (
            <span className="text-xs text-gray-500 break-words">
              {t("supply_form_eaushadhi_prefix")} {row.eaushadhi_drug_name}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 shrink-0 min-w-[150px]">
        <Input
          type="text"
          value={row.batch_number}
          onChange={(e) => set("batch_number", e.target.value)}
          className="h-9 text-xs w-full"
          disabled
        />
      </td>
      <td className="px-2 py-2 shrink-0 min-w-[150px]">
        <Input
          type="date"
          value={row.expiry_date}
          onChange={(e) => set("expiry_date", e.target.value)}
          className="h-9 text-xs w-full"
          disabled
        />
      </td>
      <td className="px-2 py-2 shrink-0 w-24">
        <Input
          type="number"
          min={1}
          value={row.pack_size}
          onChange={(e) => {
            const pack_size = parseInt(e.target.value) || 1;
            onChange({
              ...row,
              pack_size,
              quantity: String(pack_size * (row.pack_qty || 1)),
              accepted_qty_in_units: String(pack_size * (row.accepted_pack_qty || 0)),
            });
          }}
          className="h-9 text-xs w-full"
          disabled
        />
      </td>
      <td className="px-2 py-2 shrink-0 w-24">
        <Input
          type="number"
          min={1}
          value={row.pack_qty}
          onChange={(e) => {
            const pack_qty = parseInt(e.target.value) || 1;
            onChange({
              ...row,
              pack_qty,
              quantity: String((row.pack_size || 1) * pack_qty),
            });
          }}
          className="h-9 text-xs w-full"
          disabled
        />
      </td>
      {
        allowUpdatingQuantity && 
        (
          <td className="px-2 py-2 shrink-0 w-32">
            <Input
              type="number"
              min={0}
              value={row.accepted_pack_qty}
              onChange={(e) => {
                const accepted_pack_qty = parseInt(e.target.value) || 0;
                onChange({
                  ...row,
                  accepted_pack_qty,
                  accepted_qty_in_units: String((row.pack_size || 1) * accepted_pack_qty),
                });
              }}
              className="h-9 text-xs w-full"
              disabled={!allowUpdatingQuantity}
            />
          </td>
        )
      }
      <td className="px-2 py-2 shrink-0 w-32">
        <div className="flex flex-col gap-1">
          <Input
            type="number"
            value={row.accepted_qty_in_units}
            className="h-9 text-xs bg-gray-100 text-gray-600 w-full"
            disabled
          />
          {row.quantity_in_units && (
            <span className="text-xs text-gray-500 truncate">
              {t("supply_form_original_qty")} {row.quantity_in_units}
            </span>
          )}
        </div>
      </td>
      {allowDeletingInward && (
        <td className="px-2 py-2 shrink-0 w-16">
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
          >
            <Trash2 className="size-4" />
          </button>
        </td>
      )}
    </tr>
  );
}

const DeliveryRow = memo(DeliveryRowImpl, (prev, next) => {
  return (
    prev.row === next.row &&
    prev.autofillMapping === next.autofillMapping &&
    prev.allowDeletingInward === next.allowDeletingInward &&
    prev.allowUpdatingQuantity === next.allowUpdatingQuantity &&
    prev.updateRow === next.updateRow &&
    prev.removeRow === next.removeRow
  );
});
// ─── Main Form ─────────────────────────────────────────────────────────────
export default function AddSupplyDeliveryForm({
  facilityId,
  deliveryOrderId,
  destination,
  supplierId,
  onSuccess,
  supplyDeliveriesCount,
  inwardRecordId: propInwardRecordId,
  inwardDate: propInwardDate,
}: {
  facilityId: string;
  deliveryOrderId: string;
  destination: string;
  supplierId?: string;
  onSuccess: () => void;
  supplyDeliveriesCount: number;
  inwardRecordId?: string;
  inwardDate?: string;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const queryClient = useQueryClient();
  const { meta } = useInstituteMapping();
  const [rows, setRows] = useState<RowItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prefillError, setPrefillError] = useState<string>("");
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([]);
  const [isMarkingErrors, setIsMarkingErrors] = useState(false);
  const [isMarkingAccepted, setIsMarkingAccepted] = useState(false);
  const [urlInwardRecordId, setUrlInwardRecordId] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("inward_record_id");
    if (id) setUrlInwardRecordId(id);
  }, []);

  const inwardRecordId = urlInwardRecordId || propInwardRecordId;

  const getRecordDeliveryIdFromUrl = (): string | null => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("record_delivery_id");
  };

  const addRecordDeliveryIdToUrl = (recordDeliveryId: string): void => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("record_delivery_id", recordDeliveryId);
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`
    );
  };

  const recordDeliveryId = useRef<string | null>(
    getRecordDeliveryIdFromUrl()
  );

  const updateRow = useCallback((id: string, updated: RowItem) => {
    setRows((prev) => prev.map((r) => (r.record_item_id === id ? updated : r)));
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.record_item_id !== id));
  }, []);

  // Step 1: Fetch institute mappings to get supplier warehouse name
  const { data: instituteMappings } = useQuery({
    queryKey: ["instituteMappings", facilityId],
    queryFn: () =>
      request<InstituteMappingResponse>(
        `/api/care_eaushadhi/institute-mappings/`,
        HttpMethod.GET,
        {
          facility_id: facilityId,
        },
      ),
    enabled: !!facilityId,
  });

  const supplierWarehouseName = useMemo(() => {
    if (!supplierId || !instituteMappings?.results?.[0]) return null;

    const mappingResult = instituteMappings.results[0];
    const supplierMapping = mappingResult.supplier_mappings.find(
      (sm) => sm.supplier_id === supplierId,
    );

    return supplierMapping?.supplier_name ?? null;
  }, [supplierId, instituteMappings]);

  const [allInwardItems, setAllInwardItems] = useState<InwardItem[]>([]);
  const [inwardRecordMeta, setInwardRecordMeta] = useState<{
    id: string;
    facility_id: string;
    inward_date: string;
    sync_status: string;
    items_initial_count: number;
    items_current_count: number;
    deliveries: Delivery[];
  } | null>(null);
  const [paginationInProgress, setPaginationInProgress] = useState(false);
  const initializationRef = useRef(false);
  const paginationCancelledRef = useRef(false);

  const fetchAllInwardRecordPages = useCallback(
    async () => {
      if (!inwardRecordId) return;

      try {
        // Reset cancel flag
        paginationCancelledRef.current = false;

        let allItems: InwardItem[] = [];
        let offset = 0;
        let totalCount = 0;
        let isFirstPage = true;

        do {
          // Check if cancelled
          if (paginationCancelledRef.current) {
            console.log("[Pagination] Pagination cancelled by user");
            setPaginationInProgress(false);
            return;
          }

          // Fetch current page
          const pageResponse = await request<{
            meta: Record<string, any>;
            id: string;
            facility_id: string;
            inward_date: string;
            count: number;
            items: InwardItem[];
          }>(
            `/api/care_eaushadhi/inward-records/${inwardRecordId}/`,
            HttpMethod.GET,
            {
              limit: INWARD_RECORDS_PAGE_SIZE,
              offset: offset,
              warehouse_name: supplierWarehouseName || undefined,
            },
          );

          if (!pageResponse) {
            setPaginationInProgress(false);
            return;
          }

          if (isFirstPage) {
            setInwardRecordMeta({
              id: pageResponse.id,
              facility_id: pageResponse.facility_id,
              inward_date: pageResponse.inward_date,
              sync_status: "FETCHED",
              items_initial_count: pageResponse.count,
              items_current_count: pageResponse.count,
              deliveries: [],
            });
            totalCount = pageResponse.count;
            isFirstPage = false;
          }

          if (pageResponse.items && pageResponse.items.length > 0) {
            allItems = [...allItems, ...pageResponse.items];
          }

          setAllInwardItems([...allItems]);

          const pageNumber = Math.floor(offset / INWARD_RECORDS_PAGE_SIZE) + 1;
          const totalPages = Math.ceil(totalCount / INWARD_RECORDS_PAGE_SIZE);

          console.log(
            `[Pagination] Page ${pageNumber}/${totalPages}: Fetched ${pageResponse.items?.length || 0} items. Total so far: ${allItems.length}/${totalCount}`
          );

          offset += INWARD_RECORDS_PAGE_SIZE;

        } while (offset < totalCount);  

        console.log(
          `[Pagination] All ${allItems.length} items fetched successfully!`
        );
        setPaginationInProgress(false);
      } catch (err) {
        console.error("Error fetching inward record pages:", err);
        setPaginationInProgress(false);
      }
    },
    [inwardRecordId, supplierWarehouseName],
  );

  const handleCancel = useCallback(() => {
    console.log("[Cancel] User clicked Cancel button");
    paginationCancelledRef.current = true;
    setPaginationInProgress(false);
    setRows([]);
    setAllInwardItems([]);
    setInwardRecordMeta(null);
    initializationRef.current = false;
    console.log("[Cancel] Pagination exited");
  }, []);

  useEffect(() => {
    if (initializationRef.current) return;

    if (inwardRecordId && !paginationInProgress && allInwardItems.length === 0) {
      initializationRef.current = true;
      setPaginationInProgress(true);
      fetchAllInwardRecordPages().finally(() => {
      });
    }
  }, [inwardRecordId, fetchAllInwardRecordPages]);

  const inwardRecord = useMemo(() => {
    if (!inwardRecordMeta) return null;
    return {
      ...inwardRecordMeta,
      items: allInwardItems,
    };
  }, [inwardRecordMeta, allInwardItems]);

  const { data: defaultMappingsData, isLoading: isLoadingDefaultMappings } = useQuery({
    queryKey: ["defaultProductMappings", inwardRecordId],
    queryFn: () =>
      request<DefaultProductMappingsResponse>(
        `/api/care_eaushadhi/product-mappings/default-mapping/`,
        HttpMethod.GET,
        {
          inward_record_id: inwardRecordId,
        },
      ),
    enabled: !!inwardRecordId,
  });

  // Create a map for quick lookup of autofill mappings by eaushadhi_drug_id
  const autofillMappingsMap = useMemo(() => {
    const map = new Map<string, ProductMapping>();
    if (paginationInProgress) return map;
    if (defaultMappingsData?.results) {
      defaultMappingsData.results.forEach((mapping) => {
        map.set(mapping.eaushadhi_drug_id, mapping);
      });
    }
    return map;
  }, [defaultMappingsData, paginationInProgress]);

  const deliveryInwardRecordIdMapping = useMemo<Delivery | undefined>(() => {
    return inwardRecord?.deliveries.find(
      (d) =>
        d.inward_record_id === inwardRecordId &&
        d.delivery_order_id === deliveryOrderId,
    );
  }, [inwardRecordId, deliveryOrderId, inwardRecord]);

  useEffect(() => {
    if (deliveryInwardRecordIdMapping) {
      recordDeliveryId.current = deliveryInwardRecordIdMapping.id;
    }
  }, [deliveryInwardRecordIdMapping]);

  const inwardDate = propInwardDate || inwardRecord?.inward_date || "";

  useEffect(() => {
    if (!inwardRecord?.items || inwardRecord.items.length === 0) return;
    if (isLoadingDefaultMappings) return;

    try {
      const filteredItems = inwardRecord.items;

      const newDiscrepancies: DiscrepancyItem[] = [];

      const newRows = filteredItems
        .map((item) => {
          const expiryDate = item.expiry_date
            ? item.expiry_date.split("T")[0]
            : "";
          const packSize = parseFloat(item.unit_pack) || 1;
          const receivedQty = parseFloat(item.quantity_received_current) || 0;

          const totalConsumedQty = item.item_deliveries.reduce(
            (consumedQty, delivery) => {
              if (
                delivery.status === "ACCEPTED" ||
                delivery.status === "ACCEPTED_OVERRIDE"
              ) {
                return (
                  consumedQty + parseInt(delivery.quantity_received) / packSize
                );
              }
              return consumedQty;
            },
            0,
          );

          const availableQty = Math.max(receivedQty - totalConsumedQty, 0);

          if (totalConsumedQty > receivedQty) {
            const currentRecordDeliveryId = inwardRecord.deliveries.find(
              (d) => d.delivery_order_id === deliveryOrderId,
            )?.id;

            if (currentRecordDeliveryId) {
              const activeDeliveries = item.item_deliveries.filter(
                (d) =>
                  d.record_delivery_id === currentRecordDeliveryId &&
                  d.status === "ACCEPTED",
              );

              if (activeDeliveries.length > 0) {
                newDiscrepancies.push({
                  drug_name: item.drug_name,
                  available_qty: receivedQty,
                  accepted_qty: totalConsumedQty,
                  pack_size: packSize,
                  supply_delivery_ids: activeDeliveries.map(
                    (d) => d.supply_delivery_id as string,
                  ),
                  record_item_delivery_ids: activeDeliveries.map((d) => d.id),
                });
              }
            }
          }

          const row = {
            ...EMPTY_ROW(),
            record_item_id: item.id,
            product_knowledge_name: extractGenericName(item.drug_name),
            batch_number: item.batch_no,
            expiry_date: expiryDate,
            pack_size: packSize,
            pack_qty: availableQty,
            quantity: String(availableQty),
            accepted_pack_qty: availableQty,
            accepted_qty_in_units: String(packSize * availableQty),
            quantity_in_units: String(packSize * availableQty),
            eaushadhi_drug_name: item.drug_name,
            eaushadhi_drug_id: item.drug_id,
            is_new_batch: true,
            suggested_base_unit_code: inferBaseUnitCode(item.drug_name),
          } as RowItem;

          const cachedMapping = autofillMappingsMap.get(item.drug_id);
          if (cachedMapping) {
            row.product_knowledge_id = cachedMapping.product_knowledge.id;
            row.product_knowledge_slug = cachedMapping.product_knowledge.slug;
            row.product_knowledge_name = cachedMapping.product_knowledge.name;
            row.product_mapping_id = cachedMapping.id;
          }

          return row;
        })
        .filter((row): row is RowItem => row !== null && row.pack_qty > 0);

      setRows(newRows);
      setDiscrepancies(newDiscrepancies);
      setPrefillError("");
    } catch (err) {
      console.error("Error prefilling data:", err);
      setPrefillError(t("supply_form_prefill_error"));
    }
  }, [inwardRecord, supplierWarehouseName, deliveryOrderId, t, autofillMappingsMap, isLoadingDefaultMappings]);

  const { mutateAsync: runSuperBatch } = useSuperBatchRequest();

  // Initiate inward fetch API
  const { mutateAsync: initiateInwardFetch, isPending: isFetching } =
    useMutation({
      mutationFn: (forceRefresh: boolean) => {
        if (!inwardDate) {
          return Promise.reject(new Error("Inward date is required"));
        }
        return request<unknown>(
          "/api/care_eaushadhi/initiate-inward-fetch/",
          HttpMethod.POST,
          {
            facility_id: facilityId,
            inward_date: formatDateForEaushadhiAPI(inwardDate),
            triggered_by: "USER",
            force_refresh: forceRefresh,
          } satisfies InitiateInwardFetchPayload,
        );
      },
    });

  const recordDeliveries = async (payload: {
    inward_record_id: string;
    facility_id: string;
    delivery_order_id: string;
  }) => {
    const existingId = getRecordDeliveryIdFromUrl();
    if (existingId) {
      console.log("✓ Using recordDeliveryId from URL params:", existingId);
      return { id: existingId };
    }

    try {
      const response = await request<{ id: string }>(
        `/api/care_eaushadhi/record-deliveries/`,
        HttpMethod.POST,
        payload,
      );

      addRecordDeliveryIdToUrl(response.id);
      console.log("✓ Created and cached recordDeliveryId in URL:", response.id);

      return response;
    } catch (err: any) {
      // Handle 409 - might already be cached in URL
      const is409 = err.status === 409 || err.statusCode === 409 || (err.message && err.message.includes("409"));
      if (is409) {
        // Try to get from URL params as fallback
        const cachedId = getRecordDeliveryIdFromUrl();
        if (cachedId) {
          console.log("✓ Got recordDeliveryId from URL (409 fallback):", cachedId);
          return { id: cachedId };
        }
        toast.error("This delivery order is already linked elsewhere. Please use a different delivery order.");
      }
      throw err;
    }
  };

  async function handleMarkDiscrepanciesAsError() {
    const allSupplyDeliveryIds = discrepancies.flatMap(
      (d) => d.supply_delivery_ids,
    );
    const allRecordItemDeliveryIds = discrepancies.flatMap(
      (d) => d.record_item_delivery_ids,
    );
    if (
      allSupplyDeliveryIds.length === 0 &&
      allRecordItemDeliveryIds.length === 0
    ) {
      setDiscrepancies([]);
      return;
    }
    setIsMarkingErrors(true);
    try {
      await Promise.all([
        ...allSupplyDeliveryIds.map((id) =>
          request(`/api/v1/supply_delivery/${id}/`, HttpMethod.PATCH, {
            status: "entered_in_error",
          }),
        ),
        ...allRecordItemDeliveryIds.map((id) =>
          request(
            `/api/care_eaushadhi/record-item-deliveries/${id}/`,
            HttpMethod.PATCH,
            { status: "SOURCE_REVERSED" },
          ),
        ),
      ]);
      toast.success(t("supply_form_marked_as_error_success"));
      setDiscrepancies([]);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["inwardRecord", inwardRecordId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["supplyDeliveries", deliveryOrderId],
        }),
      ]);
    } catch {
      toast.error(t("supply_form_marked_as_error_failure"));
    } finally {
      setIsMarkingErrors(false);
    }
  }

  async function handleMarkDiscrepanciesAsAccepted() {
    const allSupplyDeliveryIds = discrepancies.flatMap(
      (d) => d.supply_delivery_ids,
    );
    const allRecordItemDeliveryIds = discrepancies.flatMap(
      (d) => d.record_item_delivery_ids,
    );
    if (
      allSupplyDeliveryIds.length === 0 &&
      allRecordItemDeliveryIds.length === 0
    ) {
      setDiscrepancies([]);
      return;
    }
    setIsMarkingAccepted(true);
    try {
      await Promise.all([
        ...allRecordItemDeliveryIds.map((id) =>
          request(
            `/api/care_eaushadhi/record-item-deliveries/${id}/`,
            HttpMethod.PATCH,
            { status: "ACCEPTED_OVERRIDE" },
          ),
        ),
      ]);
      toast.success(t("supply_form_marked_as_accepted_success"));
      setDiscrepancies([]);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["inwardRecord", inwardRecordId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["supplyDeliveries", deliveryOrderId],
        }),
      ]);
    } catch {
      toast.error(t("supply_form_marked_as_accepted_failure"));
    } finally {
      setIsMarkingAccepted(false);
    }
  }

  function validate(): boolean {
    for (const [i, row] of rows.entries()) {
      const n = i + 1;
      if (!row.product_knowledge_slug) {
        toast.error(t("supply_form_row_select_product", { n }));
        return false;
      }
      if (!row.batch_number) {
        toast.error(t("supply_form_row_batch_required", { n }));
        return false;
      }
      if (!row.expiry_date) {
        toast.error(t("supply_form_row_expiry_required", { n }));
        return false;
      }
    }
    return true;
  }

  async function handleSave() {
    if (rows.length === 0) {
      toast.error(t("supply_form_add_one_item"));
      return;
    }

    if (!validate()) return;

    setIsProcessing(true);

    try {
      if (inwardRecordId && deliveryInwardRecordIdMapping === undefined && !recordDeliveryId.current) {
        try {
          const response = await recordDeliveries({
            inward_record_id: inwardRecordId,
            facility_id: facilityId,
            delivery_order_id: deliveryOrderId,
          });

          recordDeliveryId.current = response.id;
          console.log("✓ Got recordDeliveryId:", response.id);
        } catch (err) {
          console.error("Failed to get recordDeliveryId:", err);
          throw err;
        }
      }

      if (!recordDeliveryId.current) {
        toast.error(t("supply_form_missing_record_delivery_ref"));
        return;
      }

      // Step 1: Convert RowItem[] to RowDeliveryInput[]
      const deliveryInputs: RowDeliveryInput[] = rows.map((row) => ({
        productKnowledgeSlug: row.product_knowledge_slug,
        productKnowledgeName: row.product_knowledge_name,
        chargeItemCategorySlug: row.charge_item_category_slug,
        batchNumber: row.batch_number,
        expiryDate: row.expiry_date,
        packSize: row.pack_size,
        packQty: row.accepted_pack_qty,
        quantity: row.accepted_qty_in_units,
        purchasePrice: "0",
        recordItemId: row.record_item_id,
        existingProductId: row.supplied_item_id || undefined,
        isNewBatch: row.is_new_batch,
      }));

      // Step 2: Split rows into chunks
      const chunks = chunkRows(deliveryInputs);

      // Step 3: Create shared context
      const ctx: RowDeliveryBatchContext = {
        facilityId,
        destination,
        deliveryOrderId,
        recordDeliveryId: recordDeliveryId.current,
        eaushadhiProductKnowledgeId: rows[0]?.product_knowledge_id || "",
      };

      // Step 4: Process each chunk
      for (const chunk of chunks) {
        const payload = buildChainBatch(chunk, ctx);
        const results = await runSuperBatch(payload);
        const chainResults = extractChainResults(results);

        // Check for errors
        for (const result of chainResults) {
          if (result.errors.length > 0) {
            throw new Error(
              `Chain ${result.chainId} failed: ${result.errors.join("; ")}`,
            );
          }
        }
      }

      toast.success(t("supply_form_save_success"));
      setRows([]);
      onSuccess();
    } catch (err) {
      if (err instanceof SuperBatchError) {
        // Extract detailed validation errors from nested response structure
        const errorDetails = extractErrorDetailsFromSuperBatch(err.results);

        if (errorDetails.length > 0) {
          // Show detailed error message with field names
          const errorMessage = formatErrorMessage(errorDetails, t);
          toast.error(errorMessage);
        } else {
          // Fallback: show first failed result's status code
          const firstFailed = err.failed?.[0];
          toast.error(
            `Failed: ${(firstFailed?.data as any)?.detail ??
            firstFailed?.status_code ??
            t("supply_form_unexpected_error")
            }`,
          );
        }

        console.error("SuperBatchError details:", {
          results: err.results,
          failed: err.failed,
          status: err.status,
        });
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        console.error(err);
        toast.error(t("supply_form_unexpected_error"));
      }
    } finally {
      setIsProcessing(false);
    }
  }

  if (prefillError) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-lg p-4 flex gap-3">
        <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-900">
            {t("supply_form_prefill_error_title")}
          </p>
          <p className="text-sm text-red-700 mt-1">{prefillError}</p>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    const allConsumed = supplyDeliveriesCount > 0;
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        {allConsumed ? (
          <CircleCheck className="size-8 text-green-500" />
        ) : (
          <CloudOff className="size-8 text-gray-400" />
        )}
        <p className="text-sm font-medium text-gray-700">
          {allConsumed
            ? t("supply_form_all_items_added")
            : t("supply_form_no_items_from_eaushadhi")}
        </p>
        <p className="text-xs text-gray-500">
          {allConsumed
            ? t("supply_form_all_items_desc")
            : t("supply_form_no_items_desc")}
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await initiateInwardFetch(true);
              toast.success(t("supply_form_refresh_success"));
              
              setAllInwardItems([]);        
              setInwardRecordMeta(null);    
              setPaginationInProgress(true);  
              initializationRef.current = false;
              
              fetchAllInwardRecordPages().finally(() => {  
              });
            } catch (error) {
              console.error("Failed to refresh inward data:", error);
              toast.error(t("supply_form_refresh_error"));
              setPaginationInProgress(false);
            }
          }}
          disabled={isFetching || !inwardDate}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching
            ? t("supply_form_refreshing")
            : allConsumed
              ? t("supply_form_check_new_items")
              : t("supply_form_retry_sync")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ scrollbarGutter: "stable" }}>
      <div className="rounded-md border border-gray-200 overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100">
            <tr className="divide-x divide-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 min-w-[280px] max-w-[400px]">
                {t("supply_form_col_product")}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 min-w-[150px]">
                {t("supply_form_col_batch")}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 min-w-[150px]">
                {t("supply_form_col_expiry")}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-24">
                {t("supply_form_col_pack_size")}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-24">
                {t("supply_form_col_pack_qty")}
              </th>
              {
                meta?.allow_updating_quantity_after_received &&
                (
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-32">
                    {t("supply_form_col_accepted_pack_qty")}
                  </th>
                )
              }
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-32">
                {t("supply_form_col_qty_in_units")}
              </th>
              {(meta?.allow_deleting_inward_after_fetch ?? false) && (
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-16">
                  {t("supply_form_col_actions")}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <DeliveryRow
                key={row.record_item_id}
                facilityId={facilityId}
                row={row}
                updateRow={updateRow}
                removeRow={removeRow}
                allowDeletingInward={
                  meta?.allow_deleting_inward_after_fetch ?? false
                }
                allowUpdatingQuantity={
                  meta?.allow_updating_quantity_after_received ?? false
                }
                autofillMapping={autofillMappingsMap.get(row.eaushadhi_drug_id || "")}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ✅ PAGINATION LOADER AT BOTTOM
      {paginationInProgress && (
        <div className="flex items-center justify-center gap-2 py-4 bg-blue-50 rounded-md border border-blue-100">
          <div className="animate-spin rounded-full h-5 w-5 border border-blue-200 border-t-blue-600" />
          <p className="text-sm text-blue-700 font-medium">
            Loading items from eAushadhi... {allInwardItems.length} items loaded
          </p>
        </div>
      )} */}

      <div className="flex items-center justify-end">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            {t("supply_form_cancel")}
          </Button>

          <Button 
            onClick={handleSave} 
            disabled={isProcessing || paginationInProgress}
          >
            {isProcessing 
              ? t("supply_form_saving") 
              : paginationInProgress
                ? t("supply_form_loading_items")
                : t("supply_form_save")}
          </Button>

        </div>
      </div>

      <Dialog
        open={discrepancies.length > 0}
        onOpenChange={(open) => {
          if (!open) setDiscrepancies([]);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5" />
              {t("supply_form_discrepancy_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {t("supply_form_discrepancy_desc")}
          </p>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr className="divide-x divide-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    {t("supply_form_col_product")}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-36">
                    {t("supply_form_discrepancy_available_qty")}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-36">
                    {t("supply_form_discrepancy_accepted_qty")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {discrepancies.map((item, i) => (
                  <tr key={i} className="divide-x divide-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {item.drug_name}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {item.available_qty * item.pack_size}
                    </td>
                    <td className="px-3 py-2 text-gray-600 font-medium">
                      {item.accepted_qty * item.pack_size}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleMarkDiscrepanciesAsAccepted}
              disabled={isMarkingErrors || isMarkingAccepted}
            >
              {isMarkingAccepted
                ? t("supply_form_marking_accepted")
                : t("supply_form_discrepancy_accept")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleMarkDiscrepanciesAsError}
              disabled={isMarkingErrors || isMarkingAccepted}
            >
              {isMarkingErrors
                ? t("supply_form_marking_error")
                : t("supply_form_discrepancy_mark_error")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}