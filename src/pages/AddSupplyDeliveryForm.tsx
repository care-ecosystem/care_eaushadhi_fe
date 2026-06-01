import { useState } from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
    id: string;
    slug: string;
    name: string;
    base_unit?: { display: string };
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
    category: string;
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
    category: "",
};

export default function AddSupplyDeliveryForm({ facilityId, deliveryOrderId, destination, onSuccess }: Props) {
    const [items, setItems] = useState<Item[]>([]);
    const [productSearch, setProductSearch] = useState("");
    const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Search products
    const { data: productsData } = useQuery({
        queryKey: ["productKnowledge", productSearch],
        queryFn: () =>
            request<{ results: ProductKnowledge[] }>(
                `/api/v1/facility/${facilityId}/product_knowledge/`,
                HttpMethod.GET,
                { name: productSearch || undefined, limit: 10 },
            ),
        enabled: productSearch.length > 0,
    });

    const products = productsData?.results ?? [];

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
        setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
        setActiveRowIndex(items.length);
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
            if (!item.category) { toast.error(`Category required at row ${i + 1}`); return; }
            if (!item.unit_price) { toast.error(`Unit price required at row ${i + 1}`); return; }
        }

        setIsProcessing(true);
        let successCount = 0;

        for (const item of items) {
            try {
                // 1. Create charge item definition
                const chargeItem = await createChargeItem({
                    slug_value: crypto.randomUUID(),
                    category: item.category,
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
                                <td className="px-2 py-2 relative">
                                    <Input
                                        placeholder="Search product..."
                                        value={item.product_knowledge_name || productSearch}
                                        onChange={(e) => {
                                            setProductSearch(e.target.value);
                                            setActiveRowIndex(index);
                                            updateItem(index, "product_knowledge_name", e.target.value);
                                            updateItem(index, "product_knowledge_slug", "");
                                        }}
                                        className="h-8 text-xs"
                                    />
                                    {/* Dropdown */}
                                    {activeRowIndex === index && products.length > 0 && !item.product_knowledge_slug && (
                                        <div className="absolute top-full left-2 z-10 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                            {products.map((p) => (
                                                <button
                                                    key={p.slug}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                                    onClick={() => {
                                                        updateItem(index, "product_knowledge_slug", p.slug);
                                                        updateItem(index, "product_knowledge_name", p.name);
                                                        setProductSearch("");
                                                        setActiveRowIndex(null);
                                                    }}
                                                >
                                                    {p.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
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
                                <td className="px-2 py-2">
                                    <Input
                                        placeholder="Category"
                                        value={item.category}
                                        onChange={(e) => updateItem(index, "category", e.target.value)}
                                        className="h-8 text-xs"
                                    />
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