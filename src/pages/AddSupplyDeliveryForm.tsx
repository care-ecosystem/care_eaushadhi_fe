/**
 * Reference Source:
 * care_fe/src/pages/Facility/services/inventory/externalSupply/deliveryOrder/AddSupplyDeliveryForm.tsx
 *
 * Notes:
 * - Copied and adapted for CARE eAushadhi FE
 * - Modified for custom delivery flow + UI changes
 */

import { useState } from "react";
import { PlusCircle, Trash2, ChevronDown } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";

interface Props {
    facilityId: string;
    deliveryOrderId: string;
    destination: string;
    onSuccess: () => void;
}

interface ProductKnowledge {
    category?: { title: string; slug: string };
    id: string;
    slug: string;
    name: string;
    base_unit?: { display: string };
}

interface ResourceCategory {
    slug: string;
    title: string;
}

interface Item {
    product_knowledge_slug: string;
    product_knowledge_name: string;
    batch_number: string;
    expiry_date: string;
    quantity: string;
    pack_size: string;
    pack_qty: string;
    unit_price: string;
    category_slug: string;
    category_title: string;
}

const EMPTY_ITEM: Item = {
    product_knowledge_slug: "",
    product_knowledge_name: "",
    batch_number: "",
    expiry_date: "",
    quantity: "1",
    pack_size: "1",
    pack_qty: "1",
    unit_price: "",
    category_slug: "",
    category_title: "",
};

export default function AddSupplyDeliveryForm({ facilityId, deliveryOrderId, destination, onSuccess }: Props) {
    const [items, setItems] = useState<Item[]>([]);
    const [productSearches, setProductSearches] = useState<Record<number, string>>({});
    const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [categoryOpenRow, setCategoryOpenRow] = useState<number | null>(null);
    const [categorySearch, setCategorySearch] = useState("");

    // Search products
    const activeSearch = activeRowIndex !== null ? (productSearches[activeRowIndex] || "") : "";

    const { data: productsData } = useQuery({
        queryKey: ["productKnowledge", facilityId, items[activeRowIndex ?? 0]?.category_slug],
        queryFn: () =>
            request<{ results: ProductKnowledge[] }>(
                `/api/v1/product_knowledge/`,
                HttpMethod.GET,
                { limit: 100, facility: facilityId, status: "active", include_instance: true, category: items[activeRowIndex ?? 0]?.category_slug || undefined },
            ),
        enabled: true,
    });
    const products = productsData?.results ?? [];

    const { data: categoriesData } = useQuery({
        queryKey: ["resourceCategories", facilityId, categorySearch],
        queryFn: () =>
            request<{ results: ResourceCategory[] }>(
                `/api/v1/facility/${facilityId}/resource_category/`,
                HttpMethod.GET,
                { resource_type: "charge_item_definition", name: categorySearch || undefined, limit: 100 },
            ),
        enabled: true,
    });
    const categories = categoriesData?.results ?? [];

    const { mutateAsync: createProduct } = useMutation({
        mutationFn: (data: Record<string, unknown>) =>
            request<{ id: string }>(
                `/api/v1/facility/${facilityId}/product/`,
                HttpMethod.POST,
                data,
            ),
    });

    const { mutateAsync: createChargeItem } = useMutation({
        mutationFn: (data: Record<string, unknown>) =>
            request<{ slug: string }>(
                `/api/v1/facility/${facilityId}/charge_item_definition/`,
                HttpMethod.POST,
                data,
            ),
    });

    const { mutateAsync: createSupplyDelivery } = useMutation({
        mutationFn: (data: Record<string, unknown>) =>
            request(
                `/api/v1/supply_delivery/`,
                HttpMethod.POST,
                data,
            ),
    });

    function updateItem(index: number, field: keyof Item, value: string) {
        setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
        );
    }

    function addRow() {
        setItems((prev) => {
            setActiveRowIndex(prev.length);
            return [...prev, { ...EMPTY_ITEM }];
        });
    }

    function removeRow(index: number) {
        setItems((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleSave() {
        // Validate
        for (const [i, item] of items.entries()) {
            if (!item.product_knowledge_slug) { toast.error(`Select a product at row ${i + 1}`); return; }
            if (!item.batch_number) { toast.error(`Batch number required at row ${i + 1}`); return; }
            if (!item.expiry_date) { toast.error(`Expiry date required at row ${i + 1}`); return; }
            if (!item.category_slug) { toast.error(`Category required at row ${i + 1}`); return; }
            if (!item.unit_price) { toast.error(`Unit price required at row ${i + 1}`); return; }
        }

        setIsProcessing(true);
        let successCount = 0;

        for (const item of items) {
            try {
                // 1. Create charge item definition
                const chargeItem = await createChargeItem({
                    slug_value: crypto.randomUUID(),
                    category: item.category_slug,
                    title: `${item.product_knowledge_name} - ${item.batch_number}`,
                    status: "active",
                    can_edit_charge_item: false,
                    price_components: [
                        { monetary_component_type: "base", amount: item.unit_price }
                    ],
                    discount_configuration: null,
                });

                // 2. Create product
                const product = await createProduct({
                    status: "active",
                    batch: { lot_number: item.batch_number },
                    expiration_date: item.expiry_date,
                    product_knowledge: item.product_knowledge_slug,
                    charge_item_definition: chargeItem.slug,
                    standard_pack_size: parseInt(item.pack_size),
                    extensions: {},
                });

                // 3. Create supply delivery
                await createSupplyDelivery({
                    status: "in_progress",
                    supplied_item_type: "product",
                    supplied_item_condition: "normal",
                    supplied_item_quantity: item.quantity,
                    supplied_item: product.id,
                    supplied_item_pack_quantity: parseInt(item.pack_qty),
                    supplied_item_pack_size: parseInt(item.pack_size),
                    destination,
                    order: deliveryOrderId,
                    extensions: {},
                });

                successCount++;
            } catch {
                toast.error(`Failed to save item: ${item.product_knowledge_name}`);
            }
        }

        setIsProcessing(false);

        if (successCount > 0) {
            toast.success(`${successCount} item(s) saved successfully`);
            setItems([]);
            onSuccess();
        }
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm font-medium text-gray-700">Add items to this delivery</p>
                <p className="text-xs text-gray-500">Add products that are being delivered</p>
                <Button variant="outline" onClick={addRow} className="flex items-center gap-2">
                    <PlusCircle className="size-4" />
                    Add Item
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[180px]">Product</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[120px]">Batch</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[130px]">Expiry</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[120px]">Category</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">Pack Size</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">Pack Qty</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">Qty</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[100px]">Unit Price</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {items.map((item, index) => (
                            <tr key={index} className="align-top">
                                {/* Product search */}
                                <td className="px-2 py-2">
                                    <select
                                        value={item.product_knowledge_slug}
                                        onChange={(e) => {
                                            const selected = products.find(
                                                (p) => p.slug === e.target.value
                                            );

                                            if (selected) {
                                                updateItem(index, "product_knowledge_slug", selected.slug);
                                                updateItem(index, "product_knowledge_name", selected.name);

                                                const matchedCat = categories.find(
                                                    (c) =>
                                                        c.title.toLowerCase() ===
                                                        selected.category?.title?.toLowerCase()
                                                );

                                                if (matchedCat) {
                                                    updateItem(index, "category_slug", matchedCat.slug);
                                                    updateItem(index, "category_title", matchedCat.title);
                                                }
                                            }
                                        }}
                                        className="h-8 text-xs w-full border border-gray-200 rounded-md px-2 bg-white"
                                    >
                                        <option value="">Select product...</option>

                                        {products.map((p) => (
                                            <option key={p.slug} value={p.slug}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-2 py-2">
                                    <Input
                                        placeholder="Batch no."
                                        value={item.batch_number}
                                        onChange={(e) => updateItem(index, "batch_number", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <Input
                                        type="date"
                                        value={item.expiry_date}
                                        onChange={(e) => updateItem(index, "expiry_date", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </td>
                                <td className="px-2 py-2 relative">
                                    <div
                                        className="flex items-center border border-gray-200 rounded-md h-8 px-2 bg-white transition-colors cursor-pointer hover:border-gray-400"
                                        onClick={() => { setCategoryOpenRow(index); setCategorySearch(""); }}
                                    >
                                        <span className={`flex-1 text-xs truncate ${!item.category_title ? "text-gray-400" : "text-gray-900"}`}>
                                            {item.category_title || "Select category..."}
                                        </span>
                                        <ChevronDown className="size-3 text-gray-400 shrink-0 ml-1" />
                                    </div>
                                    {categoryOpenRow === index && (
                                        <div className="absolute top-full left-2 z-20 w-64 bg-white border border-gray-200 rounded-md shadow-lg">
                                            <div className="p-2 border-b border-gray-100">
                                                <Input autoFocus placeholder="Search category..." value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="h-7 text-xs" />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {categories.length === 0 ? (
                                                    <p className="px-3 py-4 text-xs text-gray-400 text-center">No categories found</p>
                                                ) : (
                                                    categories.map((c) => (
                                                        <button key={c.slug} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50" onClick={() => { updateItem(index, "category_slug", c.slug); updateItem(index, "category_title", c.title); setCategoryOpenRow(null); }}>
                                                            {c.title}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </td>
                                <td className="px-2 py-2">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={item.pack_size}
                                        onChange={(e) => updateItem(index, "pack_size", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={item.pack_qty}
                                        onChange={(e) => updateItem(index, "pack_qty", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={item.quantity}
                                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="0.00"
                                        value={item.unit_price}
                                        onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <button
                                        onClick={() => removeRow(index)}
                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {categoryOpenRow !== null && (
                <div className="fixed inset-0 z-10" onClick={() => setCategoryOpenRow(null)} />
            )}
            <div className="flex items-center justify-between">
                <Button variant="outline" onClick={addRow} className="flex items-center gap-2">
                    <PlusCircle className="size-4" />
                    Add Another
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setItems([])}>
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