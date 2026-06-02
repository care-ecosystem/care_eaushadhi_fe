import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { navigate } from "raviger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";

interface Props {
    facilityId: string;
    locationId: string;
    deliveryOrderId: string;
}

interface Organization {
    id: string;
    name: string;
}

interface DeliveryOrder {
    id: string;
    name: string;
    note: string | null;
    status: string;
    supplier?: { id: string; name: string } | null;
    destination: { id: string; name: string };
    origin?: { id: string; name: string } | null;
    extensions?: Record<string, unknown>;
}

export default function DeliveryOrderForm({ facilityId, locationId, deliveryOrderId }: Props) {
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [supplier, setSupplier] = useState("");
    const [note, setNote] = useState("");

    const returnPath = `/facility/${facilityId}/locations/${locationId}/eaushadhi/${deliveryOrderId}`;

    const { data: existingOrder, isFetching } = useQuery({
        queryKey: ["deliveryOrder", deliveryOrderId],
        queryFn: () =>
            request<DeliveryOrder>(
                `/api/v1/facility/${facilityId}/order/delivery/${deliveryOrderId}/`,
                HttpMethod.GET,
            ),
    });

    useEffect(() => {
        if (existingOrder) {
            setName(existingOrder.name ?? "");
            setSupplier(existingOrder.supplier?.id ?? "");
            setNote(existingOrder.note ?? "");
        }
    }, [existingOrder]);

    const { data: suppliersData } = useQuery({
        queryKey: ["organizations", "product_supplier"],
        queryFn: () =>
            request<{ results: Organization[] }>(
                "/api/v1/organization/",
                HttpMethod.GET,
                { org_type: "product_supplier" },
            ),
    });

    const supplierOptions = suppliersData?.results ?? [];

    const { mutate: updateDeliveryOrder, isPending } = useMutation({
        mutationFn: () =>
            request<DeliveryOrder>(
                `/api/v1/facility/${facilityId}/order/delivery/${deliveryOrderId}/`,
                HttpMethod.PUT,
                {
                    name,
                    supplier,
                    destination: existingOrder?.destination?.id ?? locationId,
                    origin: existingOrder?.origin?.id ?? undefined,
                    note,
                    status: existingOrder?.status ?? "draft",
                    extensions: existingOrder?.extensions ?? {},
                },
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["deliveryOrder", deliveryOrderId] });
            toast.success("Delivery order updated successfully");
            navigate(returnPath);
        },
        onError: () => {
            toast.error("Failed to update delivery order");
        },
    });

    if (isFetching) {
        return (
            <div className="w-full px-6 py-6 max-w-5xl mx-auto">
                <div className="border border-gray-200 rounded-lg bg-white p-6 space-y-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-9 bg-gray-200 rounded" />
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                    <div className="h-9 bg-gray-200 rounded" />
                    <div className="h-4 bg-gray-200 rounded w-1/5" />
                    <div className="h-24 bg-gray-200 rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full px-6 py-6 space-y-4 max-w-5xl mx-auto">
            <div className="relative border border-gray-200 rounded-lg bg-white p-6 space-y-6">
                <button
                    onClick={() => navigate(returnPath)}
                    className="absolute top-4 right-4 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                    <X className="size-4" />
                </button>

                <div>
                    <h1 className="text-xl font-semibold text-gray-900">Edit Delivery Order</h1>
                    {existingOrder?.status && (
                        <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                            {existingOrder.status}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter order name"
                            className="bg-white"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            Supplier <span className="text-red-500">*</span>
                        </Label>
                        <Select value={supplier} onValueChange={setSupplier}>
                            <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select Vendor/Distributor" />
                            </SelectTrigger>
                            <SelectContent>
                                {supplierOptions.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                        Note <span className="text-gray-400 font-normal italic">(Optional)</span>
                    </Label>
                    <Textarea
                        placeholder="Add any notes about this order..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={4}
                        className="bg-white resize-y"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => navigate(returnPath)}>
                    Cancel
                </Button>
                <Button
                    onClick={() => updateDeliveryOrder()}
                    disabled={isPending || !name || !supplier}
                    className="bg-green-700 hover:bg-green-800 text-white"
                >
                    {isPending ? "Saving..." : "Save"}
                </Button>
            </div>
        </div>
    );
}
