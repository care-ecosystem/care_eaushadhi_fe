import { useState } from "react";
import { X } from "lucide-react";
import { navigate } from "raviger";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    deliveryOrderId?: string;
}

interface Organization {
    id: string;
    name: string;
}

// Returns today's date formatted as MM/DD/YYYY
function getTodayFormatted() {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}

export default function EAusdhadhiFetchPage({ facilityId, locationId }: Props) {
    const [name, setName] = useState("fetching stock from eAushadhi");
    const [supplier, setSupplier] = useState("");
    const [note, setNote] = useState("");
    const [inwardDate] = useState(getTodayFormatted());

    const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/incoming`;

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

    const { mutate: createDeliveryOrder, isPending } = useMutation({
        mutationFn: () =>
            request(
                `/api/v1/facility/${facilityId}/order/delivery/`,
                HttpMethod.POST,
                {
                    name,
                    supplier,
                    destination: locationId,
                    note,
                    inward_date: inwardDate,
                    status: "draft",
                    extensions: {},
                },
            ),
        onSuccess: (data: any) => {
            toast.success("Delivery order created successfully");
            navigate(
                `/facility/${facilityId}/locations/${locationId}/eaushadhi/${data.id}`,
            );
        },
        onError: () => {
            toast.error("Failed to create delivery order");
        },
    });

    return (
        <div className="container mx-auto max-w-5xl px-4 py-6">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    Fetch from eAushadhi
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                        Draft
                    </span>
                </h1>
                <button
                    onClick={() => navigate(returnPath)}
                    className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                >
                    <X className="size-5" />
                    <span className="sr-only">Close</span>
                </button>
            </div>

            {/* Card */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4 mb-6">

                {/* Name + Supplier */}
                <div className="grid sm:grid-cols-2 gap-4 items-start">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-900">
                            Name
                        </label>
                        <Input
                            className="h-9 bg-white"
                            placeholder="Enter order name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-900">
                            Vendor/Distributor
                        </label>
                        <Select value={supplier} onValueChange={setSupplier}>
                            <SelectTrigger className="h-9 bg-white">
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

                {/* Inward Date */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-900">
                        Inward Date{" "}
                        <span className="text-red-500">*</span>
                    </label>
                    <Input
                        className="h-9 bg-white text-gray-500"
                        value={inwardDate}
                        readOnly
                    />
                    <p className="text-xs text-gray-500">
                        Defaults to today. Backdating is restricted by facility policy.
                    </p>
                </div>

                {/* Note */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-900">
                        Note{" "}
                        <span className="text-gray-500 text-sm font-normal italic">(Optional)</span>
                    </label>
                    <Textarea
                        rows={3}
                        placeholder="Add any notes about this fetch..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="bg-white"
                    />
                </div>

            </div>

            {/* Footer buttons */}
            <div className="flex justify-end space-x-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(returnPath)}
                >
                    Cancel
                    <span className="ml-1.5 text-xs bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-mono">
                        ESC
                    </span>
                </Button>

                <Button
                    type="button"
                    disabled={isPending}
                    className="!bg-green-700 hover:!bg-green-800 !text-white !opacity-100"
                    onClick={() => {
                        if (!supplier) {
                            toast.error("Please select a vendor/distributor");
                            return;
                        }
                        createDeliveryOrder();
                    }}
                >
                    {isPending ? "Fetching..." : "Fetch"}
                    <span className="ml-1.5 text-xs bg-green-600 border border-green-500 rounded px-1.5 py-0.5 font-mono">
                        ENTER
                    </span>
                </Button>
            </div>
        </div>
    );
}