/**
 * Reference Source:
 * care_fe/src/pages/Facility/services/inventory/externalSupply/deliveryOrder/DeliveryOrderShow.tsx
 *
 * Notes:
 * - Adapted from CARE FE external supply delivery order module
 */

import { useState } from "react";
import { ChevronLeft, EllipsisVertical, MoreVertical, Printer } from "lucide-react";
import { navigate } from "raviger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import AddSupplyDeliveryForm from "@/pages/AddSupplyDeliveryForm";

interface Props {
    facilityId: string;
    locationId: string;
    deliveryOrderId: string;
}

interface Organization { id: string; name: string; }
interface Location { id: string; name: string; }
interface Tag { id: string; display: string; }
interface User { first_name: string; last_name: string; }
interface SupplyDelivery {
    id: string;
    status: "in_progress" | "completed" | "abandoned";
    supplied_item?: {
        id: string;
        product_knowledge?: { name: string; base_unit?: { display: string } };
        batch?: { lot_number: string };
        expiration_date?: string;
    };
    supplied_item_quantity: string;
    supplied_item_condition: "normal" | "damaged";
    supplied_item_type: string;
    supply_request?: { id: string };
    extensions?: Record<string, unknown>;
}
interface DeliveryOrder {
    id: string;
    name: string;
    status: "draft" | "pending" | "completed" | "abandoned" | "entered_in_error";
    note?: string;
    supplier?: Organization;
    origin?: Location;
    destination: Location;
    tags: Tag[];
    created_date: string;
    created_by: User;
}

const STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    pending: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    abandoned: "bg-red-100 text-red-700",
    entered_in_error: "bg-red-100 text-red-700",
};

export default function DeliveryOrderShow({ facilityId, locationId, deliveryOrderId }: Props) {
    const queryClient = useQueryClient();
    const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);

    // Confirm dialog state — matches core exactly
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        status: "completed" | "abandoned";
        condition: "normal" | "damaged";
    }>({
        open: false,
        status: "completed",
        condition: "normal",
    });

    // Order status dialog (abandoned / entered_in_error)
    const [orderStatusDialog, setOrderStatusDialog] = useState<{
        open: boolean;
        status: "abandoned" | "entered_in_error" | null;
    }>({ open: false, status: null });

    // Dropdown open states
    const [itemsDropdownOpen, setItemsDropdownOpen] = useState(false);
    const [orderDropdownOpen, setOrderDropdownOpen] = useState(false);

    const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/incoming`;

    // Fetch delivery order
    const { data: deliveryOrder, isLoading } = useQuery({
        queryKey: ["deliveryOrder", deliveryOrderId],
        queryFn: () =>
            request<DeliveryOrder>(
                `/api/v1/facility/${facilityId}/order/delivery/${deliveryOrderId}/`,
                HttpMethod.GET,
            ),
    });

    // Fetch supply deliveries
    const { data: supplyDeliveriesData, isLoading: isLoadingItems } = useQuery({
        queryKey: ["supplyDeliveries", deliveryOrderId],
        queryFn: () =>
            request<{ results: SupplyDelivery[] }>(
                `/api/v1/supply_delivery/`,
                HttpMethod.GET,
                { order: deliveryOrderId, facility: facilityId, ordering: "created_date" },
            ),
        enabled: !!deliveryOrderId,
        // Auto-select in_progress items when pending
        select: (data) => {
            if (deliveryOrder?.status === "pending") {
                const inProgressIds = data.results
                    .filter(d => d.status === "in_progress")
                    .map(d => d.id);
                // Only set once on first load
                setTimeout(() => setSelectedDeliveries(inProgressIds), 0);
            }
            return data;
        },
    });

    const supplyDeliveries = supplyDeliveriesData?.results ?? [];
    const isRequester = locationId === deliveryOrder?.destination.id;

    // Update delivery order status
    const { mutate: updateStatus, isPending: isUpdating } = useMutation({
        mutationFn: (status: string) =>
            request(
                `/api/v1/facility/${facilityId}/order/delivery/${deliveryOrderId}/`,
                HttpMethod.PUT,
                {
                    ...deliveryOrder,
                    status,
                    supplier: deliveryOrder?.supplier?.id,
                    origin: deliveryOrder?.origin?.id,
                    destination: deliveryOrder?.destination.id,
                },
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["deliveryOrder", deliveryOrderId] });
            toast.success("Status updated successfully");
            setOrderStatusDialog({ open: false, status: null });
        },
        onError: () => toast.error("Failed to update status"),
    });

    // Upsert supply deliveries
    const { mutate: upsertDeliveries, isPending: isUpserting } = useMutation({
        mutationFn: (datapoints: Record<string, unknown>[]) =>
            request(
                `/api/v1/supply_delivery/upsert/`,
                HttpMethod.POST,
                { datapoints },
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["supplyDeliveries", deliveryOrderId] });
            toast.success("Items updated successfully");
            setSelectedDeliveries([]);
            setConfirmDialog(prev => ({ ...prev, open: false }));
        },
        onError: () => toast.error("Failed to update items"),
    });

    function handleConfirmUpdateStock() {
        if (selectedDeliveries.length === 0) {
            toast.error("Please select at least one item");
            return;
        }
        setConfirmDialog({ open: true, status: "completed", condition: "normal" });
    }

    function handleSubmitDialog() {
        const datapoints = supplyDeliveries
            .filter(d => selectedDeliveries.includes(d.id))
            .map(d => ({
                id: d.id,
                status: confirmDialog.status,
                supplied_item: d.supplied_item?.id,
                supplied_item_quantity: d.supplied_item_quantity,
                supplied_item_condition: confirmDialog.condition,
                supplied_item_type: d.supplied_item_type,
                supply_request: d.supply_request?.id,
                extensions: d.extensions ?? {},
            }));
        upsertDeliveries(datapoints);
    }

    function handleMarkAsAbandoned() {
        if (selectedDeliveries.length === 0) {
            toast.error("Please select at least one item");
            return;
        }
        const datapoints = supplyDeliveries
            .filter(d => selectedDeliveries.includes(d.id))
            .map(d => ({
                id: d.id,
                status: "abandoned",
                supplied_item_quantity: d.supplied_item_quantity,
                supplied_item_condition: d.supplied_item_condition,
                supplied_item_type: d.supplied_item_type,
                supply_request: d.supply_request?.id,
                extensions: d.extensions ?? {},
            }));
        upsertDeliveries(datapoints);
        setItemsDropdownOpen(false);
    }

    function handleMarkAsDamaged() {
        if (selectedDeliveries.length === 0) {
            toast.error("Please select at least one item");
            return;
        }
        const datapoints = supplyDeliveries
            .filter(d => selectedDeliveries.includes(d.id))
            .map(d => ({
                id: d.id,
                status: "completed",
                supplied_item_quantity: d.supplied_item_quantity,
                supplied_item_condition: "damaged",
                supplied_item_type: d.supplied_item_type,
                supply_request: d.supply_request?.id,
                extensions: d.extensions ?? {},
            }));
        upsertDeliveries(datapoints);
        setItemsDropdownOpen(false);
    }

    if (isLoading) {
        return (
            <div className="w-full px-6 py-6 max-w-5xl mx-auto">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                </div>
            </div>
        );
    }

    if (!deliveryOrder) {
        return (
            <div className="w-full px-6 py-6 max-w-5xl mx-auto">
                <p className="text-gray-500">Delivery order not found.</p>
            </div>
        );
    }

    return (
        <div className="w-full px-6 py-6 space-y-6 max-w-5xl mx-auto">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(returnPath)}
                        className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">{deliveryOrder.name}</h1>
                        <p className="text-sm text-gray-500">
                            From <span className="font-medium">{deliveryOrder.supplier?.name ?? deliveryOrder.origin?.name ?? "—"}</span>
                            {" → "}
                            To <span className="font-medium">{deliveryOrder.destination.name}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                    {/* Print */}
                    <Button variant="outline" onClick={() => window.print()} className="flex items-center gap-2">
                        <Printer className="size-4" /> Print
                    </Button>

                    {/* Edit — draft only */}
                    {deliveryOrder.status === "draft" && (
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/facility/${facilityId}/locations/${locationId}/eaushadhi/${deliveryOrderId}/edit`)}
                        >
                            Edit
                        </Button>
                    )}

                    {/* Mark as Approved — draft only */}
                    {deliveryOrder.status === "draft" && (
                        <Button
                            onClick={() => updateStatus("pending")}
                            disabled={isUpdating || supplyDeliveries.length === 0}
                        >
                            {isUpdating ? "Updating..." : "Mark as Approved"}
                        </Button>
                    )}

                    {/* Mark as Completed — pending + isRequester */}
                    {deliveryOrder.status === "pending" && isRequester && (
                        <Button
                            onClick={() => updateStatus("completed")}
                            disabled={isUpdating || isUpserting || selectedDeliveries.length !== 0}
                        >
                            {isUpdating ? "Updating..." : "Mark as Completed"}
                        </Button>
                    )}

                    {/* Dropdown: Abandoned / Entered in Error — draft only */}
                    {deliveryOrder.status === "draft" && (
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setOrderDropdownOpen(o => !o)}
                            >
                                <EllipsisVertical className="size-4" />
                            </Button>
                            {orderDropdownOpen && (
                                <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-white border border-gray-200 rounded-md shadow-lg">
                                    <button
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600"
                                        onClick={() => {
                                            setOrderStatusDialog({ open: true, status: "entered_in_error" });
                                            setOrderDropdownOpen(false);
                                        }}
                                    >
                                        Mark as Entered in Error
                                    </button>
                                    <button
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600"
                                        onClick={() => {
                                            setOrderStatusDialog({ open: true, status: "abandoned" });
                                            setOrderDropdownOpen(false);
                                        }}
                                    >
                                        Mark as Abandoned
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Delivery Info Card ── */}
            <div className="border border-gray-200 rounded-lg bg-white p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Deliver To</p>
                        <p className="text-lg font-semibold text-gray-900">{deliveryOrder.destination.name}</p>
                    </div>
                    {deliveryOrder.supplier && (
                        <div>
                            <p className="text-sm font-medium text-gray-500">Supplier</p>
                            <p className="text-lg font-semibold text-gray-900">{deliveryOrder.supplier.name}</p>
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-medium text-gray-500">Status</p>
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-sm ${STATUS_COLORS[deliveryOrder.status]}`}>
                            {deliveryOrder.status}
                        </span>
                    </div>
                    {deliveryOrder.note && (
                        <div>
                            <p className="text-sm font-medium text-gray-500">Note</p>
                            <p className="text-sm text-gray-700">{deliveryOrder.note}</p>
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-medium text-gray-500">Created By</p>
                        <p className="text-base font-semibold text-gray-900">
                            {deliveryOrder.created_by.first_name} {deliveryOrder.created_by.last_name}
                        </p>
                        <p className="text-xs text-gray-500">
                            {new Date(deliveryOrder.created_date).toLocaleString()}
                        </p>
                    </div>
                    {deliveryOrder.tags?.length > 0 && (
                        <div>
                            <p className="text-sm font-medium text-gray-500">Tags</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {deliveryOrder.tags.map(tag => (
                                    <span key={tag.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                        {tag.display}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Supply Deliveries Section ── */}
            <div className="border border-gray-200 rounded-lg bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h2 className="text-base font-semibold text-gray-900">
                        {isRequester
                            ? deliveryOrder.status === "completed"
                                ? "Items Updated in Stock"
                                : "Items to Receive"
                            : "Supply Deliveries"}
                    </h2>

                    {/* Items section action buttons — pending + isRequester */}
                    {deliveryOrder.status === "pending" && isRequester && (
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleConfirmUpdateStock}
                                disabled={isUpdating || isUpserting || selectedDeliveries.length === 0}
                            >
                                {isUpserting ? "Updating..." : "Receive / Update Stock"}
                            </Button>
                            <div className="relative">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setItemsDropdownOpen(o => !o)}
                                >
                                    <MoreVertical className="size-4" />
                                </Button>
                                {itemsDropdownOpen && (
                                    <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white border border-gray-200 rounded-md shadow-lg">
                                        <button
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                                            onClick={handleMarkAsAbandoned}
                                            disabled={isUpserting || selectedDeliveries.length === 0}
                                        >
                                            Mark as Abandoned
                                        </button>
                                        <button
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                                            onClick={handleMarkAsDamaged}
                                            disabled={isUpserting || selectedDeliveries.length === 0}
                                        >
                                            Mark as Damaged
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 space-y-4">
                    {/* Loading skeleton */}
                    {isLoadingItems ? (
                        <div className="space-y-2 animate-pulse">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-4 bg-gray-200 rounded w-3/4" />
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Items table */}
                            {supplyDeliveries.length > 0 && (
                                <div className="rounded-md border border-gray-200 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                {deliveryOrder.status === "pending" && isRequester && (
                                                    <th className="px-3 py-2 text-left w-8">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                supplyDeliveries.filter(d => d.status === "in_progress").length > 0 &&
                                                                selectedDeliveries.length === supplyDeliveries.filter(d => d.status === "in_progress").length
                                                            }
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedDeliveries(
                                                                        supplyDeliveries.filter(d => d.status === "in_progress").map(d => d.id)
                                                                    );
                                                                } else {
                                                                    setSelectedDeliveries([]);
                                                                }
                                                            }}
                                                        />
                                                    </th>
                                                )}
                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Product</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Batch</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Expiry</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Qty</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Condition</th>
                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {supplyDeliveries.map((d) => (
                                                <tr key={d.id} className="hover:bg-gray-50">
                                                    {deliveryOrder.status === "pending" && isRequester && (
                                                        <td className="px-3 py-2">
                                                            {d.status === "in_progress" && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedDeliveries.includes(d.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setSelectedDeliveries([...selectedDeliveries, d.id]);
                                                                        } else {
                                                                            setSelectedDeliveries(selectedDeliveries.filter(id => id !== d.id));
                                                                        }
                                                                    }}
                                                                />
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2 font-medium">
                                                        {d.supplied_item?.product_knowledge?.name ?? "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-600">
                                                        {d.supplied_item?.batch?.lot_number ?? "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-600">
                                                        {d.supplied_item?.expiration_date
                                                            ? new Date(d.supplied_item.expiration_date).toLocaleDateString()
                                                            : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-600">
                                                        {d.supplied_item_quantity}{" "}
                                                        {d.supplied_item?.product_knowledge?.base_unit?.display ?? ""}
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-600 capitalize">
                                                        {d.supplied_item_condition}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${
                                                            d.status === "completed" ? "bg-green-100 text-green-700"
                                                            : d.status === "abandoned" ? "bg-red-100 text-red-700"
                                                            : "bg-yellow-100 text-yellow-700"
                                                        }`}>
                                                            {d.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Add items form — draft only */}
                            {deliveryOrder.status === "draft" && (
                                <AddSupplyDeliveryForm
                                    facilityId={facilityId}
                                    deliveryOrderId={deliveryOrderId}
                                    destination={deliveryOrder.destination.id}
                                    onSuccess={() => {
                                        queryClient.invalidateQueries({ queryKey: ["supplyDeliveries", deliveryOrderId] });
                                    }}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Confirm Receive Dialog ── */}
            {confirmDialog.open && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Receive / Update Stock</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Apply updates to {selectedDeliveries.length} selected item(s).
                            </p>
                        </div>

                        {/* Receiving Status */}
                        <div className="space-y-3 bg-gray-50 p-4 rounded-md">
                            <Label className="text-sm font-medium">Receiving Status</Label>
                            <div className="flex gap-3 flex-wrap">
                                {(["completed", "abandoned"] as const).map(s => (
                                    <label
                                        key={s}
                                        className={`flex items-center gap-2 px-4 py-3 rounded-md border-[1.5px] cursor-pointer transition-all ${
                                            confirmDialog.status === s
                                                ? "border-primary-600 bg-primary-50"
                                                : "border-gray-300 bg-white hover:border-gray-400"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            checked={confirmDialog.status === s}
                                            onChange={() => setConfirmDialog(prev => ({ ...prev, status: s }))}
                                        />
                                        <span className="font-medium capitalize">{s}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Condition — only when completed */}
                            {confirmDialog.status === "completed" && (
                                <div className="space-y-3 mt-2">
                                    <Label className="text-sm font-medium">Item Condition</Label>
                                    <div className="flex gap-3 flex-wrap">
                                        {(["normal", "damaged"] as const).map(c => (
                                            <label
                                                key={c}
                                                className={`flex items-center gap-2 px-4 py-3 rounded-md border-[1.5px] cursor-pointer transition-all ${
                                                    confirmDialog.condition === c
                                                        ? "border-primary-600 bg-primary-50"
                                                        : "border-gray-300 bg-white hover:border-gray-400"
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    checked={confirmDialog.condition === c}
                                                    onChange={() => setConfirmDialog(prev => ({ ...prev, condition: c }))}
                                                />
                                                <span className="font-medium capitalize">{c}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmitDialog}
                                disabled={isUpserting}
                                className={confirmDialog.status === "abandoned" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                            >
                                {isUpserting ? "Updating..." : "Confirm"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Order Status Dialog (Abandoned / Entered in Error) ── */}
            {orderStatusDialog.open && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            {orderStatusDialog.status === "entered_in_error"
                                ? "Mark as Entered in Error"
                                : "Mark as Abandoned"}
                        </h2>
                        <p className="text-sm text-gray-600">
                            {orderStatusDialog.status === "entered_in_error"
                                ? "Are you sure you want to mark this order as entered in error? This action cannot be undone."
                                : "Are you sure you want to abandon this order? This action cannot be undone."}
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setOrderStatusDialog({ open: false, status: null })}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 text-white"
                                disabled={isUpdating}
                                onClick={() => {
                                    if (orderStatusDialog.status) updateStatus(orderStatusDialog.status);
                                }}
                            >
                                {isUpdating ? "Updating..." : "Confirm"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}