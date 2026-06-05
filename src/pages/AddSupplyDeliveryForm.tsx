/**
 * Supply Delivery Form with E-Aushadhi Integration
 * - Auto-populates from inward records
 * - Product mapping selection with eAushadhi display
 * - Dynamic quantity calculations (pack size × quantity)
 * - Creates record delivery on component mount
 */
import { useState, useEffect, useCallback } from "react";
import { PlusCircle, Trash2, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import {
  useSuperBatchRequest,
  SuperBatchError,
} from "@/apis/query";
import {
  RowDeliveryInput,
  RowDeliveryBatchContext,
} from "@/apis";
import {
  buildChainBatch,
  chunkRows,
  extractChainResults,
  SUPER_BATCH_CHAIN_SIZE,
} from "@/apis/chainBuilder";

// ─── Types ─────────────────────────────────────────────────────────────────
interface ProductKnowledge {
  id: string;
  slug: string;
  name: string;
}

interface ProductMapping {
  id: string;
  eaushadhi_drug_name: string;
  product_knowledge: ProductKnowledge;
}

interface Product {
  id: string;
  batch?: { lot_number: string };
  expiration_date?: string;
  standard_pack_size?: number;
  charge_item_definition?: { slug: string };
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
  product_mapping_id?: string;
}

interface InwardItem {
  id: string;
  drug_name: string;
  batch_no: string;
  expiry_date: string;
  quantity_received_current: string;
  unit_pack: string;
  quantity_in_units?: string;
}

interface InwardRecord {
  items: InwardItem[];
}

interface RecordDeliveryResponse {
  id: string;
  inward_record_id: string;
  delivery_order_id: string;
  facility_id: string;
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
  product_mapping_id: "",
});

// ─── Product Mapping Selector ──────────────────────────────────────────────
function ProductMappingSelector({
  value,
  mappings,
  isLoadingMappings,
  onSelect,
}: {
  value: string;
  mappings: ProductMapping[];
  isLoadingMappings: boolean;
  onSelect: (mapping: ProductMapping) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(mappingId) => {
        const mapping = mappings.find((m) => m.id === mappingId);
        if (mapping) onSelect(mapping);
      }}
      disabled={isLoadingMappings}
    >
      <SelectTrigger size="sm" className="w-full">
        <SelectValue placeholder="Select a product" />
      </SelectTrigger>
      <SelectContent>
        {mappings.map((mapping) => (
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
  mappings,
  isLoadingMappings,
  onChange,
  onRemove,
}: {
  facilityId: string;
  row: RowItem;
  mappings: ProductMapping[];
  isLoadingMappings: boolean;
  onChange: (updated: RowItem) => void;
  onRemove: () => void;
}) {
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

  const { data: autoFillData } = useQuery({
    queryKey: ["products-autofill", facilityId, row.product_knowledge_id],
    queryFn: () =>
      request<{ results: Product[] }>(
        `/api/v1/facility/${facilityId}/product/`,
        HttpMethod.GET,
        {
          product_knowledge: row.product_knowledge_id,
          ordering: "-created_date",
          limit: 1,
          status: "active",
        },
      ),
    enabled: !!row.product_knowledge_id,
  });

  useEffect(() => {
    const product = autoFillData?.results?.[0];
    if (!product || row.is_new_batch || row.batch_number) return;
    const packSize = product.standard_pack_size ?? 1;
    onChange({
      ...row,
      supplied_item_id: product.id,
      batch_number: product.batch?.lot_number ?? "",
      expiry_date: product.expiration_date
        ? product.expiration_date.slice(0, 10)
        : "",
      is_new_batch: false,
      pack_size: packSize,
      pack_qty: Math.max(
        1,
        Math.floor(
          parseFloat((product as any)?.quantity_received_current ?? "0") /
            packSize,
        ),
      ),
    });
  }, [autoFillData]); // eslint-disable-line

  const isProductSelected = !!row.product_knowledge_slug;

  return (
    <tr className="align-top divide-x divide-gray-100 hover:bg-gray-50/40">
      <td className="px-2 py-2 min-w-[280px] max-w-[400px]">
        <div className="flex flex-col gap-1">
          <ProductMappingSelector
            value={row.product_mapping_id || ""}
            mappings={mappings}
            isLoadingMappings={isLoadingMappings}
            onSelect={handleSelectMapping}
          />
          {row.eaushadhi_drug_name && (
            <span className="text-xs text-gray-500 truncate">
              eAushadhi: {row.eaushadhi_drug_name}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 shrink-0 min-w-[150px]">
        <Input
          type="text"
          value={row.batch_number}
          onChange={(e) => set("batch_number", e.target.value)}
          disabled={!isProductSelected}
          className="h-9 text-xs w-full"
        />
      </td>
      <td className="px-2 py-2 shrink-0 min-w-[150px]">
        <Input
          type="date"
          value={row.expiry_date}
          onChange={(e) => set("expiry_date", e.target.value)}
          disabled={!isProductSelected}
          className="h-9 text-xs w-full"
        />
      </td>
      <td className="px-2 py-2 shrink-0 w-24">
        <Input
          type="number"
          min={1}
          value={row.pack_size}
          onChange={(e) => set("pack_size", parseInt(e.target.value) || 1)}
          disabled={!isProductSelected}
          className="h-9 text-xs w-full"
        />
      </td>
      <td className="px-2 py-2 shrink-0 w-24">
        <Input
          type="number"
          min={1}
          value={row.pack_qty}
          onChange={(e) => set("pack_qty", parseInt(e.target.value) || 1)}
          disabled={!isProductSelected}
          className="h-9 text-xs w-full"
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
            disabled
            className="h-9 text-xs bg-gray-100 text-gray-600 w-full"
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
  onSuccess,
  inwardRecordId: propInwardRecordId,
}: {
  facilityId: string;
  deliveryOrderId: string;
  destination: string;
  onSuccess: () => void;
  inwardRecordId?: string;
}) {
  const [rows, setRows] = useState<RowItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prefillError, setPrefillError] = useState<string>("");
  const [urlInwardRecordId, setUrlInwardRecordId] = useState<string>("");
  const [recordDeliveryId, setRecordDeliveryId] = useState<string>("");
  const [isCreatingRecordDelivery, setIsCreatingRecordDelivery] =
    useState(false);

  // Extract inward_record_id from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("inward_record_id");
    if (id) setUrlInwardRecordId(id);
  }, []);

  const inwardRecordId = urlInwardRecordId || propInwardRecordId;

  // Create record delivery when component mounts (only once)
  useEffect(() => {
    if (!inwardRecordId || !facilityId || !deliveryOrderId || recordDeliveryId) {
      return;
    }

    const createRecordDelivery = async () => {
      setIsCreatingRecordDelivery(true);
      try {
        const response = await request<RecordDeliveryResponse>(
          "/api/care_eaushadhi/record-deliveries/",
          HttpMethod.POST,
          {
            inward_record_id: inwardRecordId,
            facility_id: facilityId,
            delivery_order_id: deliveryOrderId,
          },
        );
        setRecordDeliveryId(response.id);
      } catch (err) {
        console.error("Error creating record delivery:", err);
        toast.error("Failed to create record delivery");
      } finally {
        setIsCreatingRecordDelivery(false);
      }
    };

    createRecordDelivery();
  }, [inwardRecordId, facilityId, deliveryOrderId, recordDeliveryId]);

  const updateRow = useCallback((index: number, updated: RowItem) => {
    setRows((prev) => prev.map((r, i) => (i === index ? updated : r)));
  }, []);

  const removeRow = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addRow = () => setRows((prev) => [...prev, EMPTY_ROW()]);

  // Fetch product mappings
  const { data: mappingsData, isLoading: isLoadingMappings } = useQuery({
    queryKey: ["product-mappings", facilityId, inwardRecordId],
    queryFn: () =>
      request<{ results: ProductMapping[] }>(
        `/api/care_eaushadhi/product-mappings/`,
        HttpMethod.GET,
        {
          facility_id: facilityId,
          inward_record_id: inwardRecordId,
          limit: 100,
        },
      ),
    enabled: !!inwardRecordId,
  });
  const mappings = mappingsData?.results ?? [];

  // Fetch inward record and prefill rows
  const { data: inwardRecord, isLoading: isLoadingInward } = useQuery({
    queryKey: ["inwardRecord", inwardRecordId],
    queryFn: () =>
      request<InwardRecord>(
        `/api/care_eaushadhi/inward-records/${inwardRecordId}/`,
        HttpMethod.GET,
      ),
    enabled: !!inwardRecordId,
  });

  useEffect(() => {
    if (!inwardRecord?.items || inwardRecord.items.length === 0) return;
    try {
      const newRows = inwardRecord.items.map((item) => {
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
          is_new_batch: true,
        } as RowItem;
      });
      setRows(newRows);
      setPrefillError("");
    } catch (err) {
      console.error("Error prefilling data:", err);
      setPrefillError(
        "Failed to prefill data from inward record. Please check the data and try again.",
      );
    }
  }, [inwardRecord]);

  const { mutateAsync: runSuperBatch } = useSuperBatchRequest();

  function validate(): boolean {
    for (const [i, row] of rows.entries()) {
      const n = i + 1;
      if (!row.product_knowledge_slug) {
        toast.error(`Row ${n}: Select a product`);
        return false;
      }
      if (!row.batch_number) {
        toast.error(`Row ${n}: Batch number required`);
        return false;
      }
      if (!row.expiry_date) {
        toast.error(`Row ${n}: Expiry date required`);
        return false;
      }
    }
    return true;
  }

  async function handleSave() {
    if (rows.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    if (!recordDeliveryId) {
      toast.error("Record delivery ID not yet loaded. Please wait...");
      return;
    }

    if (!validate()) return;

    setIsProcessing(true);

    try {
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

      // Step 3: Create shared context (NOW WITH DYNAMIC recordDeliveryId!)
      const ctx: RowDeliveryBatchContext = {
        facilityId,
        destination,
        deliveryOrderId,
        recordDeliveryId, // ✅ Dynamic from API response
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

      toast.success("Saved successfully");
      setRows([]);
      onSuccess();
    } catch (err) {
      if (err instanceof SuperBatchError) {
        const firstError = err.failed?.[0];
        toast.error(
          `Failed: ${
            (firstError?.data as any)?.detail ??
            firstError?.status_code ??
            "Unknown error"
          }`,
        );
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        console.error(err);
        toast.error("Unexpected error");
      }
    } finally {
      setIsProcessing(false);
    }
  }

  // Show loading while creating record delivery
  if (isCreatingRecordDelivery) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border border-gray-200 border-t-gray-900" />
        <p className="text-sm font-medium text-gray-700">
          Creating delivery record...
        </p>
      </div>
    );
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
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm font-medium text-gray-700">
          Add items to this delivery
        </p>
        <p className="text-xs text-gray-500">
          Add products that are being delivered
        </p>
        <Button
          variant="outline"
          onClick={addRow}
          className="flex items-center gap-2"
        >
          <PlusCircle className="size-4" /> Add Item
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
                mappings={mappings}
                isLoadingMappings={isLoadingMappings}
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
            onClick={() => setRows([])}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}