/**
 * Reference Source:
 * care_fe AddSupplyDeliveryForm + SmartExternalDeliveryRow + MonetaryComponentSelector + ResourceCategoryPicker
 * Self-contained replica for care_eaushadhi_fe plugin.
 *
 * MODIFICATIONS:
 * - Added inwardRecordId prop for API prefill
 * - Added useEffect to fetch inward record data and auto-populate rows
 * - Maps inward items to delivery rows with batch, expiry, quantity
 * - Handles product knowledge lookup and category selection
 */
import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  FolderOpen,
  Home,
  PlusCircle,
  Search,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";

// ─── Types ─────────────────────────────────────────────────────────────────
interface ProductKnowledge {
  id: string;
  slug: string;
  name: string;
  base_unit?: { code: string; display: string };
  category?: { id: string; slug: string; title: string };
}

interface ChargeItemDefinition {
  id: string;
  slug: string;
  title: string;
  category?: { id: string; slug: string; title: string };
}

interface Product {
  id: string;
  status: string;
  batch?: { lot_number: string };
  expiration_date?: string;
  standard_pack_size?: number;
  charge_item_definition?: ChargeItemDefinition;
}

interface ResourceCategory {
  id: string;
  slug: string;
  title: string;
  has_children?: boolean;
}

interface RowItem {
  product_knowledge_id: string;
  product_knowledge_slug: string;
  product_knowledge_name: string;
  supplied_item_id: string;
  batch_number: string;
  expiry_date: string;
  is_new_batch: boolean;
  charge_item_definition_slug: string;
  pack_size: number;
  pack_qty: number;
  quantity: string;
  accepted_pack_qty: number;
  accepted_qty: string;
}

interface InwardItem {
  id: string;
  drug_name: string;
  batch_no: string;
  expiry_date: string;
  quantity_received_current: string;
  unit_pack: string;
}

interface InwardRecord {
  id: string;
  items: InwardItem[];
}

const EMPTY_ROW = (): RowItem => ({
  product_knowledge_id: "",
  product_knowledge_slug: "",
  product_knowledge_name: "",
  supplied_item_id: "",
  batch_number: "",
  expiry_date: "",
  is_new_batch: false,
  charge_item_definition_slug: "",
  pack_size: 1,
  pack_qty: 1,
  quantity: "1",
  accepted_pack_qty: 1,
  accepted_qty: "1",
});

// ─── Product Knowledge Selector ────────────────────────────────────────────
interface ProductKnowledgeSelectorProps {
  facilityId: string;
  value: string;
  label: string;
  onSelect: (pk: ProductKnowledge) => void;
}

function ProductKnowledgeSelector({
  facilityId,
  value,
  label,
  onSelect,
}: ProductKnowledgeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<
    { slug: string; title: string }[]
  >([]);
  const [currentParent, setCurrentParent] = useState<string | undefined>(
    undefined,
  );

  const { data: catData, isLoading: isLoadingCats } = useQuery({
    queryKey: ["pk-categories", facilityId, currentParent],
    queryFn: () =>
      request<{
        results: {
          id: string;
          slug: string;
          title: string;
          description?: string;
        }[];
      }>(`/api/v1/facility/${facilityId}/resource_category/`, HttpMethod.GET, {
        resource_type: "product_knowledge",
        parent: currentParent || "",
        limit: 100,
      }),
    enabled: open,
  });

  const { data: pkData, isLoading: isLoadingPK } = useQuery({
    queryKey: ["pk-items", facilityId, currentParent, search],
    queryFn: () =>
      request<{ results: ProductKnowledge[] }>(
        `/api/v1/product_knowledge/`,
        HttpMethod.GET,
        {
          facility: facilityId,
          status: "active",
          include_instance: true,
          ...(currentParent ? { category: currentParent } : {}),
          ...(search ? { name: search } : {}),
          limit: 100,
        },
      ),
    enabled: open && (!!currentParent || !!search),
  });

  const categories = catData?.results ?? [];
  const items = pkData?.results ?? [];
  const isLoading = isLoadingCats || isLoadingPK;

  const resetNav = () => {
    setBreadcrumbs([]);
    setCurrentParent(undefined);
    setSearch("");
  };

  const handleCategorySelect = (slug: string, title: string) => {
    setBreadcrumbs((prev) => [...prev, { slug, title }]);
    setCurrentParent(slug);
    setSearch("");
  };

  const handleBreadcrumb = (index: number) => {
    const nb = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(nb);
    setCurrentParent(nb[index]?.slug);
    setSearch("");
  };

  const handleSelect = (pk: ProductKnowledge) => {
    onSelect(pk);
    setOpen(false);
    resetNav();
  };

  const getCurrentLevelTitle = () => {
    if (breadcrumbs.length === 0) return "Root";
    return breadcrumbs[breadcrumbs.length - 1].title;
  };

  const showCategories = !search && !currentParent && categories.length > 0;
  const showItems = !!search || !!currentParent;

  return (
    <div className="relative w-45">
      <button
        type="button"
        className="flex items-center border border-gray-300 rounded-md h-9 px-3 cursor-pointer hover:border-gray-400 bg-white transition-colors w-full shadow-xs"
        onClick={() => setOpen(true)}
      >
        <span
          className={[
            "flex-1 text-xs truncate text-left",
            !label ? "text-gray-500" : "text-gray-900",
          ].join(" ")}
        >
          {label || "Select product knowledge"}
        </span>
        <ChevronDown
          className={[
            "size-4 shrink-0 opacity-50 transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-100"
            onClick={() => {
              setOpen(false);
              resetNav();
            }}
          />
          <div
            className="absolute bottom-full left-0 z-20 w-[420px] bg-white border border-gray-200 rounded-md shadow-lg mb-1 flex flex-col"
            style={{ maxHeight: "40vh" }}
          >
            <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Home className="size-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-600">
                  {getCurrentLevelTitle()}
                </span>
              </div>
              {value && (
                <button
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
                  onClick={() => {
                    onSelect({ id: "", slug: "", name: "" });
                    setOpen(false);
                    resetNav();
                  }}
                >
                  <X className="size-3" /> Clear
                </button>
              )}
            </div>
            {breadcrumbs.length > 0 && (
              <div className="px-3 py-1.5 border-b bg-gray-100 flex items-center gap-1 text-xs overflow-x-auto shrink-0">
                <button
                  className="text-gray-500 hover:text-gray-700 flex items-center gap-0.5 shrink-0"
                  onClick={resetNav}
                >
                  <Home className="size-3" /> Root
                </button>
                {breadcrumbs.map((b, i) => (
                  <span
                    key={b.slug}
                    className="flex items-center gap-1 shrink-0"
                  >
                    <ChevronRight className="size-3 text-gray-400" />
                    <button
                      className="text-gray-600 hover:text-gray-900 px-1"
                      onClick={() => handleBreadcrumb(i)}
                    >
                      {b.title}
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="px-3 border-b shrink-0">
              <div className="flex items-center gap-2 h-9">
                <Search className="size-4 text-gray-400 shrink-0" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search product knowledge"
                  className="flex-1 text-sm border-0 outline-none bg-transparent"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 animate-pulse"
                    >
                      <div className="size-4 bg-gray-200 rounded" />
                      <div className="h-4 bg-gray-200 rounded flex-1" />
                    </div>
                  ))}
                </div>
              ) : showCategories ? (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 cursor-pointer transition-colors"
                    onClick={() => handleCategorySelect(cat.slug, cat.title)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderOpen className="size-4 text-gray-500 shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {cat.title}
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-gray-500 shrink-0" />
                  </button>
                ))
              ) : showItems ? (
                items.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <Search className="size-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">
                      {search ? `No results for "${search}"` : "No items found"}
                    </div>
                  </div>
                ) : (
                  items.map((pk) => (
                    <button
                      key={pk.id}
                      className={[
                        "w-full flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 cursor-pointer transition-colors",
                        value === pk.slug ? "bg-gray-50" : "",
                      ].join(" ")}
                      onClick={() => handleSelect(pk)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">
                          {pk.name}
                        </span>
                        {search && pk.category && (
                          <span className="text-xs text-gray-400 truncate">
                            {pk.category.title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pk.base_unit && (
                          <span className="text-xs text-gray-400">
                            {pk.base_unit.display}
                          </span>
                        )}
                        {value === pk.slug && (
                          <Check className="size-4 text-gray-700" />
                        )}
                      </div>
                    </button>
                  ))
                )
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <FolderOpen className="size-8 mx-auto mb-2 opacity-50" />
                  <div className="text-sm">No categories found</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Delivery Row ──────────────────────────────────────────────────────────
interface RowProps {
  facilityId: string;
  row: RowItem;
  onChange: (updated: RowItem) => void;
  onRemove: () => void;
}

function DeliveryRow({ facilityId, row, onChange, onRemove }: RowProps) {
  const set = useCallback(
    (field: keyof RowItem, value: unknown) =>
      onChange({ ...row, [field]: value } as RowItem),
    [row, onChange],
  );

  const queryClient = useQueryClient();

  // Auto qty = pack_size × pack_qty
  useEffect(() => {
    const qty = (row.pack_size || 1) * (row.pack_qty || 1);
    if (String(qty) !== row.quantity) {
      onChange({ ...row, quantity: String(qty) });
    }
  }, [row.pack_size, row.pack_qty]); // eslint-disable-line

  // Auto accepted qty = pack_size × accepted_pack_qty
  useEffect(() => {
    const acceptedQty = (row.pack_size || 1) * (row.accepted_pack_qty || 0);
    if (String(acceptedQty) !== row.accepted_qty) {
      onChange({ ...row, accepted_qty: String(acceptedQty) });
    }
  }, [row.pack_size, row.accepted_pack_qty]); // eslint-disable-line

  const handleSelectPK = (pk: ProductKnowledge) => {
    queryClient.removeQueries({
      queryKey: ["products-autofill", facilityId, pk.id],
    });
    onChange({
      ...EMPTY_ROW(),
      product_knowledge_id: pk.id,
      product_knowledge_slug: pk.slug,
      product_knowledge_name: pk.name,
    });
  };

  const handleSelectExisting = (product: Product) => {
    const ci = product.charge_item_definition;
    const packSize = product.standard_pack_size ?? 1;
    onChange({
      ...row,
      supplied_item_id: product.id,
      batch_number: product.batch?.lot_number ?? "",
      expiry_date: product.expiration_date
        ? product.expiration_date.slice(0, 10)
        : "",
      is_new_batch: false,
      charge_item_definition_slug: ci?.slug ?? "",
      pack_size: packSize,
      pack_qty: 1,
      quantity: String(packSize),
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
    const ci = product.charge_item_definition;
    const packSize = product.standard_pack_size ?? 1;
    onChange({
      ...row,
      supplied_item_id: product.id,
      batch_number: product.batch?.lot_number ?? "",
      expiry_date: product.expiration_date
        ? product.expiration_date.slice(0, 10)
        : "",
      is_new_batch: false,
      charge_item_definition_slug: ci?.slug ?? "",
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
      <td className="px-2 py-2 w-full">
        <ProductKnowledgeSelector
          facilityId={facilityId}
          value={row.product_knowledge_slug}
          label={row.product_knowledge_name}
          onSelect={handleSelectPK}
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="text"
          value={row.batch_number}
          onChange={(e) => set("batch_number", e.target.value)}
          disabled={!isProductSelected}
          className="h-9 text-xs min-w-[10rem]"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="date"
          value={row.expiry_date}
          onChange={(e) => set("expiry_date", e.target.value)}
          disabled={!isProductSelected}
          className="h-9 text-xs min-w-[10rem]"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          min={1}
          value={row.pack_size}
          onChange={(e) => set("pack_size", parseInt(e.target.value) || 1)}
          disabled={!isProductSelected}
          className="h-9 text-xs w-20"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          min={1}
          value={row.pack_qty}
          onChange={(e) => set("pack_qty", parseInt(e.target.value) || 1)}
          disabled={!isProductSelected}
          className="h-9 text-xs w-24"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          min={0}
          value={row.accepted_pack_qty}
          onChange={(e) =>
            set("accepted_pack_qty", parseInt(e.target.value) || 0)
          }
          className="h-9 text-xs w-32"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          value={row.accepted_qty}
          disabled
          className="h-9 text-xs bg-gray-100 text-gray-600 w-24"
        />
      </td>
      <td className="px-2 py-2">
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
interface Props {
  facilityId: string;
  deliveryOrderId: string;
  destination: string;
  onSuccess: () => void;
  inwardRecordId?: string;
}

export default function AddSupplyDeliveryForm({
  facilityId,
  deliveryOrderId,
  destination,
  onSuccess,
  inwardRecordId,
}: Props) {
  const [rows, setRows] = useState<RowItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prefillError, setPrefillError] = useState<string>("");

  const updateRow = useCallback((index: number, updated: RowItem) => {
    setRows((prev) => prev.map((r, i) => (i === index ? updated : r)));
  }, []);

  const removeRow = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addRow = () => setRows((prev) => [...prev, EMPTY_ROW()]);

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
    if (!inwardRecord?.items || inwardRecord.items.length === 0) {
      return;
    }
    try {
      const newRows = inwardRecord.items.map((item) => {
        const expiryDate = item.expiry_date
          ? item.expiry_date.split("T")[0]
          : "";
        // unit_pack is pack size, quantity_received_current is total qty received
        const packSize = parseFloat(item.unit_pack) || 1;
        const receivedQty = parseFloat(item.quantity_received_current) || 0;
        const quantity = String(receivedQty); // Total quantity received

        return {
          ...EMPTY_ROW(),
          product_knowledge_name: item.drug_name,
          batch_number: item.batch_no,
          expiry_date: expiryDate,
          pack_size: packSize,
          pack_qty: receivedQty,
          quantity: quantity,
          accepted_pack_qty: receivedQty,
          accepted_qty: String(packSize * receivedQty),
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

  const { mutateAsync: createChargeItem } = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      request<{ id: string; slug: string }>(
        `/api/v1/facility/${facilityId}/charge_item_definition/`,
        HttpMethod.POST,
        data,
      ),
  });

  const { mutateAsync: createProduct } = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      request<{ id: string }>(
        `/api/v1/facility/${facilityId}/product/`,
        HttpMethod.POST,
        data,
      ),
  });

  const { mutateAsync: createSupplyDelivery } = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      request(`/api/v1/supply_delivery/`, HttpMethod.POST, data),
  });

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
    if (!validate()) return;

    setIsProcessing(true);
    let successCount = 0;

    for (const row of rows) {
      try {
        let productId = row.supplied_item_id;
        let chargeItemSlug = row.charge_item_definition_slug;

        if (!productId || row.is_new_batch) {
          const ci = await createChargeItem({
            slug_value: crypto.randomUUID(),
            title: `${row.product_knowledge_name} - ${row.batch_number}`,
            status: "active",
            can_edit_charge_item: false,
            price_components: [
              { monetary_component_type: "base", amount: "0" },
            ],
            discount_configuration: null,
          });
          chargeItemSlug = ci.slug;

          const prod = await createProduct({
            status: "active",
            batch: { lot_number: row.batch_number },
            expiration_date: row.expiry_date,
            product_knowledge: row.product_knowledge_slug,
            charge_item_definition: chargeItemSlug,
            standard_pack_size: row.pack_size,
            extensions: {},
          });
          productId = prod.id;
        }

        await createSupplyDelivery({
          status: "in_progress",
          supplied_item_type: "product",
          supplied_item_condition: "normal",
          supplied_item_quantity: row.quantity,
          supplied_item: productId,
          supplied_item_pack_quantity: row.pack_qty,
          supplied_item_pack_size: row.pack_size,
          destination,
          order: deliveryOrderId,
          extensions: {},
        });
        successCount++;
      } catch (err) {
        console.error(err);
        toast.error(`Failed to save: ${row.product_knowledge_name}`);
      }
    }

    setIsProcessing(false);
    if (successCount > 0) {
      toast.success(`${successCount} item(s) saved successfully`);
      setRows([]);
      onSuccess();
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
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 min-w-[180px] w-full">
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
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-24">
                Accepted Qty
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
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
