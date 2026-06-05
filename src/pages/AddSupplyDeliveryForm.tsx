import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2,
  AlertCircle,
  RefreshCw,
  CloudOff,
  CircleCheck,
} from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
}

interface InwardRecord {
  items: InwardItem[];
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
});

// ─── Product Mapping Selector with Lazy Search ──────────────────────────────
function ProductMappingSelector({
  facilityId,
  eaushadhiDrugId,
  value,
  isLoading,
  onSelect,
}: {
  facilityId: string;
  eaushadhiDrugId: string;
  value: string;
  isLoading: boolean;
  onSelect: (mapping: ProductMapping) => void;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductMapping[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch product mappings when dropdown opens
  const fetchMappings = useCallback(async () => {
    if (!eaushadhiDrugId || isSearching) return;

    setIsSearching(true);
    try {
      const response = await request<{ results: ProductMapping[] }>(
        `/api/care_eaushadhi/product-mappings/search/`,
        HttpMethod.GET,
        {
          facility_id: facilityId,
          eaushadhi_drug_id: eaushadhiDrugId,
        },
      );
      setSearchResults(response.results || []);
    } catch (err) {
      console.error("Error fetching product mappings:", err);
      toast.error(t("supply_form_load_products_error"));
      setSearchResults([]);
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
      <SelectContent>
        {isSearching && (
          <div className="flex items-center justify-center py-4 text-xs text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border border-gray-200 border-t-gray-900 mr-2" />
            {t("supply_form_searching")}
          </div>
        )}
        {!isSearching && searchResults.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-500">
            {t("supply_form_no_products_found")}
          </div>
        )}
        {!isSearching &&
          searchResults.map((mapping) => (
            <SelectItem key={mapping.id} value={mapping.id}>
              {mapping.product_knowledge.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

// ─── Delivery Row ──────────────────────────────────────────────────────────
function DeliveryRow({
  facilityId,
  row,
  onChange,
  onRemove,
}: {
  facilityId: string;
  row: RowItem;
  onChange: (updated: RowItem) => void;
  onRemove: () => void;
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
            value={row.product_mapping_id || ""}
            isLoading={false}
            onSelect={handleSelectMapping}
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
              Original Qty: {row.quantity_in_units}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 shrink-0 w-16">
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
        >
          <Trash2 className="size-4" />
        </button>
      </td>
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
  goBackToDeliveryPage,
  supplyDeliveriesCount,
  inwardRecordId: propInwardRecordId,
}: {
  facilityId: string;
  deliveryOrderId: string;
  destination: string;
  supplierId?: string;
  onSuccess: () => void;
  goBackToDeliveryPage: () => void;
  supplyDeliveriesCount: number;
  inwardRecordId?: string;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const [rows, setRows] = useState<RowItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prefillError, setPrefillError] = useState<string>("");
  const [urlInwardRecordId, setUrlInwardRecordId] = useState<string>("");

  // Extract inward_record_id from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("inward_record_id");
    if (id) setUrlInwardRecordId(id);
  }, []);

  const inwardRecordId = urlInwardRecordId || propInwardRecordId;
  const recordDeliveryId = "b50e5dc8-4a28-47d1-bcc7-7640e506f841";

  const addRow = () => setRows((prev) => [...prev, EMPTY_ROW()]);

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

  // Step 3: Filter and prefill rows based on warehouse name
  useEffect(() => {
    if (!inwardRecord?.items || inwardRecord.items.length === 0) return;

    try {
      // Filter items by warehouse name
      const filteredItems = inwardRecord.items.filter(
        (item) => item.warehouse_name === supplierWarehouseName,
      );

      const newRows = filteredItems.map((item) => {
        const expiryDate = item.expiry_date
          ? item.expiry_date.split("T")[0]
          : "";
        const packSize = parseFloat(item.unit_pack) || 1;
        const receivedQty = parseFloat(item.quantity_received_current) || 0;

        return {
          ...EMPTY_ROW(),
          record_item_id: item.id,
          product_knowledge_name: item.drug_name,
          batch_number: item.batch_no,
          expiry_date: expiryDate,
          pack_size: packSize,
          pack_qty: receivedQty,
          quantity: String(receivedQty),
          accepted_pack_qty: receivedQty,
          accepted_qty_in_units: String(packSize * receivedQty),
          quantity_in_units: item.quantity_in_units
            ? String(Math.floor(parseFloat(item.quantity_in_units)))
            : "",
          eaushadhi_drug_name: item.drug_name,
          eaushadhi_drug_id: item.drug_id,
          is_new_batch: true,
        } as RowItem;
      });

      setRows(newRows);
      setPrefillError("");
    } catch (err) {
      console.error("Error prefilling data:", err);
      setPrefillError(t("supply_form_prefill_error"));
    }
  }, [inwardRecord, supplierWarehouseName]);

  const { mutateAsync: runSuperBatch } = useSuperBatchRequest();

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
      let finalRecordDeliveryId = recordDeliveryId;

      if (inwardRecordId) {
        const response = await recordDeliveries({
          inward_record_id: inwardRecordId,
          facility_id: facilityId,
          delivery_order_id: deliveryOrderId,
        });
        finalRecordDeliveryId = response.id;
      }

      if (!finalRecordDeliveryId) {
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
        packQty: row.pack_qty,
        quantity: row.quantity,
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
        recordDeliveryId: finalRecordDeliveryId,
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
        const firstError = err.failed?.[0];
        toast.error(
          `Failed: ${
            (firstError?.data as any)?.detail ??
            firstError?.status_code ??
            t("supply_form_unexpected_error")
          }`,
        );
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
          Loading inward record...
        </p>
      </div>
    );
  }

  if (prefillError) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-lg p-4 flex gap-3">
        <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-900">Prefill Error</p>
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
          onClick={()=>{}}
          className="flex items-center gap-2"
        >
          <RefreshCw className="size-4" />
          {allConsumed ? t("supply_form_check_new_items") : t("supply_form_retry_sync")}
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
                Product
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 min-w-[150px]">
                Batch
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 min-w-[150px]">
                Expiry
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-24">
                Pack Size
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-24">
                Pack Qty
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-32">
                Accepted Pack Qty
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-32">
                Qty In Units
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-16">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, index) => (
              <DeliveryRow
                key={index}
                facilityId={facilityId}
                row={row}
                onChange={(updated) => updateRow(index, updated)}
                onRemove={() => removeRow(index)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={goBackToDeliveryPage}
            disabled={isProcessing}
          >
            {t("supply_form_cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? t("supply_form_saving") : t("supply_form_save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
