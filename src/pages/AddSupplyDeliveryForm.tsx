import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
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
import { I18NNAMESPACE } from "@/lib/contants";
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
      const displayName = suggestedName || eaushadhiDrugName;
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
}: {
  facilityId: string;
  eaushadhiDrugId: string;
  eaushadhiDrugName: string;
  value: string;
  isLoading: boolean;
  onSelect: (mapping: ProductMapping) => void;
  suggestedBaseUnitCode?: string;
  suggestedName?: string;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductMapping[]>([]);
  const [canCreate, setCanCreate] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch product mappings when dropdown opens
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
  }, [facilityId, eaushadhiDrugId, isSearching]);

  // Fetch mappings when dropdown opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && searchResults.length === 0 && !isSearching) {
      fetchMappings();
    }
  };

  const selectedMapping = searchResults.find((m) => m.id === value);

  return (
    <>
      <Select
        value={value}
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
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue
            placeholder={
              !eaushadhiDrugId
                ? t("supply_form_no_drug_selected")
                : isSearching
                  ? t("supply_form_loading")
                  : selectedMapping
                    ? selectedMapping.product_knowledge.name
                    : t("supply_form_select_product")
            }
          />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="w-[var(--radix-select-trigger-width)]"
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
          {!isSearching &&
            searchResults.map((mapping) => (
              <SelectItem
                key={mapping.id}
                value={mapping.id}
                className="whitespace-normal wrap-break-word"
              >
                {mapping.product_knowledge.name}
              </SelectItem>
            ))}
          {!isSearching && canCreate && (
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
function DeliveryRow({
  facilityId,
  row,
  onChange,
  onRemove,
  allowDeletingInward,
  allowUpdatingQuantity,
}: {
  facilityId: string;
  row: RowItem;
  onChange: (updated: RowItem) => void;
  onRemove: () => void;
  allowDeletingInward: boolean;
  allowUpdatingQuantity: boolean;
  suggestedBaseUnitCode?: string;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const set = useCallback(
    (field: keyof RowItem, value: unknown) =>
      onChange({ ...row, [field]: value } as RowItem),
    [row, onChange],
  );

  const queryClient = useQueryClient();

  // Auto-calculate quantity from pack size and pack quantity
  useEffect(() => {
    const qty = (row.pack_size || 1) * (row.pack_qty || 1);
    if (String(qty) !== row.quantity) {
      onChange({ ...row, quantity: String(qty) });
    }
  }, [row.pack_size, row.pack_qty]); // eslint-disable-line

  // Auto-calculate accepted quantity
  useEffect(() => {
    const acceptedQty = (row.pack_size || 1) * (row.accepted_pack_qty || 0);
    if (String(acceptedQty) !== row.accepted_qty_in_units) {
      onChange({ ...row, accepted_qty_in_units: String(acceptedQty) });
    }
  }, [row.pack_size, row.accepted_pack_qty]); // eslint-disable-line

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
          />
          {row.eaushadhi_drug_name && (
            <span className="text-xs text-gray-500 truncate">
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
          onChange={(e) => set("pack_size", parseInt(e.target.value) || 1)}
          className="h-9 text-xs w-full"
          disabled
        />
      </td>
      <td className="px-2 py-2 shrink-0 w-24">
        <Input
          type="number"
          min={1}
          value={row.pack_qty}
          onChange={(e) => set("pack_qty", parseInt(e.target.value) || 1)}
          className="h-9 text-xs w-full"
          disabled
        />
      </td>
      <td className="px-2 py-2 shrink-0 w-32">
        <Input
          type="number"
          min={0}
          value={row.accepted_pack_qty}
          onChange={(e) =>
            set("accepted_pack_qty", parseInt(e.target.value) || 0)
          }
          className="h-9 text-xs w-full"
          disabled={!allowUpdatingQuantity}
        />
      </td>
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

  // Extract inward_record_id from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("inward_record_id");
    if (id) setUrlInwardRecordId(id);
  }, []);

  const inwardRecordId = urlInwardRecordId || propInwardRecordId;
  const recordDeliveryId = useRef<string | null>(null);

  const updateRow = useCallback((index: number, updated: RowItem) => {
    setRows((prev) => prev.map((r, i) => (i === index ? updated : r)));
  }, []);

  const removeRow = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
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

  // Extract warehouse name from supplier mappings
  const supplierWarehouseName = useMemo(() => {
    if (!supplierId || !instituteMappings?.results?.[0]) return null;

    const mappingResult = instituteMappings.results[0];
    const supplierMapping = mappingResult.supplier_mappings.find(
      (sm) => sm.supplier_id === supplierId,
    );

    return supplierMapping?.eaushadhi_warehouse_name || null;
  }, [supplierId, instituteMappings]);

  // Step 2: Fetch inward record and prefill rows
  const { data: inwardRecord, isLoading: isLoadingInward } = useQuery({
    queryKey: ["inwardRecord", inwardRecordId],
    queryFn: () =>
      request<InwardRecord>(
        `/api/care_eaushadhi/inward-records/${inwardRecordId}/`,
        HttpMethod.GET,
      ),
    enabled: !!inwardRecordId,
  });

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

  // Derive inwardDate from prop or inward record
  const inwardDate = propInwardDate || inwardRecord?.inward_date || "";

  // Step 3: Filter and prefill rows based on warehouse name
  useEffect(() => {
    if (!inwardRecord?.items || inwardRecord.items.length === 0) return;

    try {
      // Filter items by warehouse name
      const filteredItems = inwardRecord.items.filter(
        (item) => item.warehouse_name === supplierWarehouseName,
      );

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

          return {
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
        })
        .filter((row): row is RowItem => row !== null && row.pack_qty > 0);

      setRows(newRows);
      setDiscrepancies(newDiscrepancies);
      setPrefillError("");
    } catch (err) {
      console.error("Error prefilling data:", err);
      setPrefillError(t("supply_form_prefill_error"));
    }
  }, [inwardRecord, supplierWarehouseName]);

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

  // Mutation for recording deliveries in eAushadhi system
  const { mutateAsync: recordDeliveries } = useMutation({
    mutationFn: async (payload: {
      inward_record_id: string;
      facility_id: string;
      delivery_order_id: string;
    }) =>
      request<{ id: string }>(
        `/api/care_eaushadhi/record-deliveries/`,
        HttpMethod.POST,
        payload,
      ),
  });

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
      // Step 0: Record deliveries in eAushadhi system and get recordDeliveryId
      if (inwardRecordId && deliveryInwardRecordIdMapping === undefined) {
        const response = await recordDeliveries({
          inward_record_id: inwardRecordId,
          facility_id: facilityId,
          delivery_order_id: deliveryOrderId,
        });

        recordDeliveryId.current = response.id;
      }

      if (recordDeliveryId.current === null) {
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
            `Failed: ${
              (firstFailed?.data as any)?.detail ??
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

  if (inwardRecordId && isLoadingInward) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border border-gray-200 border-t-gray-900" />
        <p className="text-sm font-medium text-gray-700">
          {t("supply_form_loading_inward_record")}
        </p>
      </div>
    );
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
              // Invalidate the inward record query to trigger a refetch
              await queryClient.invalidateQueries({
                queryKey: ["inwardRecord", inwardRecordId],
              });
            } catch (error) {
              console.error("Failed to refresh inward data:", error);
              toast.error(t("supply_form_refresh_error"));
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
    <div className="space-y-4">
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
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-32">
                {t("supply_form_col_accepted_pack_qty")}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-32">
                {t("supply_form_col_qty_in_units")}
              </th>
              {(meta?.allow_deleting_inward_after_fetch ?? true) && (
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-16">
                  {t("supply_form_col_actions")}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, index) => (
              <DeliveryRow
                key={row.record_item_id}
                facilityId={facilityId}
                row={row}
                onChange={(updated) => updateRow(index, updated)}
                onRemove={() => removeRow(index)}
                allowDeletingInward={
                  meta?.allow_deleting_inward_after_fetch ?? true
                }
                allowUpdatingQuantity={
                  meta?.allow_updating_quantity_after_received ?? true
                }
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setRows([])}
            disabled={isProcessing}
          >
            {t("supply_form_cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? t("supply_form_saving") : t("supply_form_save")}
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
