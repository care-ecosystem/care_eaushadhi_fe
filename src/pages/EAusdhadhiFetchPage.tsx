import { useState } from "react";
import { X } from "lucide-react";
import { navigate } from "raviger";
import { useMutation, useQuery } from "@tanstack/react-query";
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
}

interface Organization {
    id: string;
    name: string;
}

export default function EAusdhadhiFetchPage({ facilityId, locationId }: Props) {
    const [name, setName] = useState("fetching stock from eAushadhi");
    const [supplier, setSupplier] = useState("");
    const [date] = useState(() => {
        const today = new Date();
        return `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
    });
    const [note, setNote] = useState("");
    const [tags, setTags] = useState("");

    const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/incoming`;

    // Fetch real suppliers from backend
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
                    status: "draft",
                    extensions: {},
                },
            ),
        onSuccess: (data: any) => {
            toast.success("Delivery order created successfully");
            navigate(
                `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/incoming/${data.id}`,
            );
        },
        onError: () => {
            toast.error("Failed to create delivery order");
        },
    });

    return (
        <div className="w-full px-6 py-6 space-y-4 max-w-5xl mx-auto">
            <div className="relative border border-gray-200 rounded-lg bg-white p-6 space-y-6">
                <button
                    onClick={() => navigate(returnPath)}
                    className="absolute top-4 right-4 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                    <X className="size-4" />
                </button>

                {/* Row 1: Name + Supplier */}
                <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-medium text-gray-700">Name</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-white"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            Supplier <span className="text-red-500">*</span>
                        </Label>
                        {/* Real suppliers from backend — no more hardcoded values */}
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
                        <p className="text-xs text-gray-500">
                            Pre-selected from your default supplier mapping.
                        </p>
                    </div>
                </div>

                {/* Row 2: Inward Date */}
                <div className="grid grid-cols-2 gap-6 items-start">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                            Inward Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            type="text"
                            value={date}
                            readOnly
                            className="bg-gray-100 text-gray-700 cursor-default"
                        />
                        <p className="text-xs text-gray-500">
                            Defaults to today. Backdating is restricted by facility policy.
                        </p>
                    </div>
                </div>

                {/* Row 3: Note */}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                        Note{" "}
                        <span className="text-gray-400 font-normal italic">(Optional)</span>
                    </Label>
                    <Textarea
                        placeholder="Add any notes about this fetch..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={4}
                        className="bg-white resize-y"
                    />
                </div>

                {/* Row 4: Tags */}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-medium text-gray-700">Tags</Label>
                    <div className="flex items-center gap-2 border border-gray-200 rounded-md px-3 py-2 bg-white min-h-[40px]">
                        <svg
                            className="size-4 text-gray-400 shrink-0"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.29-7.29a1 1 0 0 0 0-1.41z" />
                            <circle cx="7" cy="7" r="1" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Add Tags"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="flex-1 text-sm text-gray-500 placeholder:text-gray-400 outline-none bg-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3">
                <Button
                    variant="outline"
                    onClick={() => navigate(returnPath)}
                    className="flex items-center gap-2"
                >
                    Cancel
                    <kbd className="text-xs bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-mono">
                        ESC
                    </kbd>
                </Button>
                <Button
                    onClick={() => createDeliveryOrder()}
                    disabled={isPending || !supplier}
                    className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white"
                >
                    <svg
                        className="size-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {isPending ? "Fetching..." : "Fetch"}
                    <kbd className="text-xs bg-green-600 border border-green-500 rounded px-1.5 py-0.5 font-mono">
                        ENTER
                    </kbd>
                </Button>
            </div>
        </div>
    );
}