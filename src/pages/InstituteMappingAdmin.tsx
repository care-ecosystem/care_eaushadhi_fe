import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, X, ChevronDown, Check, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

interface SupplierMapping {
    id: string;
    supplier_id: string;
    supplier_name: string;
    eaushadhi_warehouse_name: string;
    is_default: boolean;
}

interface NewSupplierRow {
    tempId: string;
    supplier_id: string;
    supplier_name: string;
    eaushadhi_warehouse_name: string;
    is_default: boolean;
}

interface InstituteMapping {
    id: string;
    facility_id: string;
    eaushadhi_institute_id: string;
    schema_version: string;
    credentials_ref: string;
    disable_inward_date: boolean;
    manual_addition: boolean;
    supplier_mappings: SupplierMapping[];
}

interface Facility {
    id: string;
    name: string;
}

interface Organization {
    id: string;
    name: string;
}

// ─── Reusable SupplierSelect ───────────────────────────────────────────────
interface SelectOption { id: string; name: string; }
interface SupplierSelectProps {
    options: SelectOption[];
    value: string;
    onChange: (id: string, name: string) => void;
    placeholder?: string;
}

function SupplierSelect({ options, value, onChange, placeholder = "Select supplier..." }: SupplierSelectProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.id === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full h-9 flex items-center justify-between border border-gray-300 rounded-md px-3 text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 transition-colors"
            >
                <span className={`truncate ${selected ? "text-gray-900" : "text-gray-400"}`}>
                    {selected?.name ?? placeholder}
                </span>
                <ChevronDown className={`size-4 text-gray-400 shrink-0 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute top-full left-0 z-30 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {options.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">No options available</p>
                    ) : (
                        options.map(o => (
                            <button
                                key={o.id}
                                type="button"
                                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                                onClick={() => { onChange(o.id, o.name); setOpen(false); }}
                            >
                                <span className={value === o.id ? "text-green-700 font-medium" : "text-gray-800"}>
                                    {o.name}
                                </span>
                                {value === o.id && <Check className="size-3.5 text-green-600 shrink-0" />}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${checked ? "bg-green-600" : "bg-gray-200"}`}
        >
            <span className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transform transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
        </button>
    );
}

// ─── Radio Button ──────────────────────────────────────────────────────────
function RadioButton({ checked, onClick }: { checked: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="flex items-center justify-center">
            {checked ? (
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-green-500 border-2 border-green-500">
                    <span className="size-2 rounded-full bg-white" />
                </span>
            ) : (
                <span className="inline-flex items-center justify-center size-5 rounded-full border-2 border-gray-300 hover:border-green-400" />
            )}
        </button>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function InstituteMappingAdmin() {
    const queryClient = useQueryClient();
    const [selectedMapping, setSelectedMapping] = useState<InstituteMapping | null>(null);
    const [supplierRows, setSupplierRows] = useState<SupplierMapping[]>([]);
    const [newSupplierRows, setNewSupplierRows] = useState<NewSupplierRow[]>([]);
    const [facilityId, setFacilityId] = useState("");
    const [instituteId, setInstituteId] = useState("");
    const [schemaVersion, setSchemaVersion] = useState("");
    const [credentialsRef, setCredentialsRef] = useState("");
    const [disableInwardDate, setDisableInwardDate] = useState(false);
    const [manualAddition, setManualAddition] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["institute-mappings-admin"],
        queryFn: () =>
            request<{ results: InstituteMapping[] }>(
                `/api/care_eaushadhi/institute-mappings/`,
                HttpMethod.GET,
            ),
    });

    const { data: facilitiesData } = useQuery({
        queryKey: ["facilities-list"],
        queryFn: () =>
            request<{ results: Facility[] }>(
                `/api/v1/getallfacilities/`,
                HttpMethod.GET,
                { limit: 100 },
            ),
    });

    const { data: organizationsData } = useQuery({
        queryKey: ["suppliers-list"],
        queryFn: () =>
            request<{ results: Organization[] }>(
                `/api/v1/organization/`,
                HttpMethod.GET,
                { org_type: "product_supplier", limit: 100 },
            ),
    });

    const facilities = facilitiesData?.results ?? [];
    const suppliers = organizationsData?.results ?? [];
    const mappings = data?.results ?? [];

    const { mutate: saveMapping, isPending: isSaving } = useMutation({
        mutationFn: () =>
            request(
                `/api/care_eaushadhi/institute-mappings/${selectedMapping?.id}/`,
                HttpMethod.PATCH,
                {
                    disable_inward_date: disableInwardDate,
                    manual_addition: manualAddition,
                },
            ),
        onSuccess: () => {
            toast.success("Mapping updated successfully");
            queryClient.invalidateQueries({ queryKey: ["institute-mappings-admin"] });
            setSelectedMapping(null);
        },
        onError: () => toast.error("Failed to update mapping"),
    });

    const openDrawer = (m: InstituteMapping) => {
        setSelectedMapping(m);
        setFacilityId(m.facility_id);
        setInstituteId(m.eaushadhi_institute_id);
        setSchemaVersion(m.schema_version ?? "");
        setCredentialsRef(m.credentials_ref ?? "");
        setDisableInwardDate(m.disable_inward_date);
        setManualAddition(m.manual_addition);
        setSupplierRows(m.supplier_mappings);
        setNewSupplierRows([]);
    };

    const addNewSupplierRow = () => {
        setNewSupplierRows(rows => [...rows, {
            tempId: crypto.randomUUID(),
            supplier_id: "",
            supplier_name: "",
            eaushadhi_warehouse_name: "",
            is_default: rows.length === 0 && supplierRows.length === 0,
        }]);
    };

    return (
        <div className="container mx-auto max-w-6xl px-4 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900">Institute Mappings</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Configure how each facility connects to eAushadhi and which CARE suppliers map to which eAushadhi warehouses. These mappings drive the supplier picker shown in the Inward Flow.
                    </p>
                </div>
                <Button
                    className="flex items-center gap-2"
                    onClick={() => {
                        setSelectedMapping({
                            id: "", facility_id: "", eaushadhi_institute_id: "",
                            schema_version: "", credentials_ref: "",
                            disable_inward_date: false, manual_addition: false,
                            supplier_mappings: [],
                        });
                        setFacilityId(""); setInstituteId(""); setSchemaVersion("");
                        setCredentialsRef(""); setDisableInwardDate(false);
                        setManualAddition(false); setSupplierRows([]); setNewSupplierRows([]);
                    }}
                >
                    <PlusCircle className="size-4" /> Add Institute Mapping
                </Button>
            </div>

            {/* Table */}
            <div className="border border-gray-200 rounded-lg bg-white overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Facility</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">eAushadhi Institute ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Suppliers Mapped</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Default Warehouse</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            [1, 2, 3].map(i => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-10" /></td>
                                </tr>
                            ))
                        ) : mappings.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                                    No institute mappings found. Add one to get started.
                                </td>
                            </tr>
                        ) : (
                            mappings.map(m => {
                                const defaultSupplier = m.supplier_mappings.find(s => s.is_default);
                                const facilityName = facilities.find(f => f.id === m.facility_id)?.name ?? m.facility_id;
                                return (
                                    <tr key={m.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{facilityName}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                                {m.eaushadhi_institute_id}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <span className="font-semibold">{m.supplier_mappings.length}</span> supplier{m.supplier_mappings.length !== 1 ? "s" : ""}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {defaultSupplier?.eaushadhi_warehouse_name ?? "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button variant="outline" size="sm" onClick={() => openDrawer(m)}>Edit</Button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Drawer */}
            {selectedMapping && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/40" onClick={() => setSelectedMapping(null)} />
                    <div className="w-[480px] bg-white h-full overflow-y-auto shadow-xl flex flex-col">

                        {/* Drawer Header */}
                        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {selectedMapping?.id ? "Edit Institute Mapping" : "Add Institute Mapping"}
                                </h2>
                                <p className="text-sm text-gray-500 mt-0.5">Configure how this facility connects to eAushadhi.</p>
                            </div>
                            <button onClick={() => setSelectedMapping(null)} className="mt-1">
                                <X className="size-5 text-gray-500 hover:text-gray-700" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-8 flex-1">

                            {/* Institute Details */}
                            <div>
                                <h3 className="text-base font-semibold text-gray-900 mb-1">Institute Details</h3>
                                <p className="text-sm text-gray-500 mb-4">Identify the CARE facility and its corresponding eAushadhi credentials.</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-900 mb-1 block">
                                            Facility <span className="text-red-500">*</span>
                                        </label>
                                        <SupplierSelect
                                            options={facilities.map(f => ({ id: f.id, name: f.name }))}
                                            value={facilityId}
                                            onChange={(id) => setFacilityId(id)}
                                            placeholder="Select facility..."
                                        />
                                        <p className="text-xs text-gray-500 mt-1">The CARE facility this mapping applies to. One mapping per facility.</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-900 mb-1 block">
                                            eAushadhi Institute ID <span className="text-red-500">*</span>
                                        </label>
                                        <Input value={instituteId} onChange={e => setInstituteId(e.target.value)} className="h-9" />
                                        <p className="text-xs text-gray-500 mt-1">The unique institute identifier registered with eAushadhi.</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-900 mb-1 block">Schema Version</label>
                                        <Input value={schemaVersion} onChange={e => setSchemaVersion(e.target.value)} className="h-9" placeholder="e.g. 1.0" />
                                        <p className="text-xs text-gray-500 mt-1">Defaults to the latest schema if left blank.</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-900 mb-1 block">
                                            Credentials Reference <span className="text-red-500">*</span>
                                        </label>
                                        <Input value={credentialsRef} onChange={e => setCredentialsRef(e.target.value)} className="h-9" />
                                        <p className="text-xs text-gray-500 mt-1">Name of the secret in the credentials vault holding the eAushadhi API key. The actual key is never displayed.</p>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-200" />

                            {/* Supplier Mappings */}
                            <div>
                                <h3 className="text-base font-semibold text-gray-900 mb-1">Supplier Mappings</h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    Map each CARE supplier to its eAushadhi warehouse name. The default supplier is auto-selected on the Fetch screen.
                                </p>

                                {/* Column headers */}
                                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-1 mb-2">
                                    <span className="text-xs font-medium text-gray-500">Supplier</span>
                                    <span className="text-xs font-medium text-gray-500">eAushadhi Warehouse Name</span>
                                    <span className="text-xs font-medium text-gray-500">Default</span>
                                    <span />
                                </div>

                                <div className="space-y-3">
                                    {/* Existing rows */}
                                    {supplierRows.map((s, idx) => (
                                        <div key={s.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                                            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                                                <SupplierSelect
                                                    options={suppliers.map(sup => ({ id: sup.id, name: sup.name }))}
                                                    value={s.supplier_id}
                                                    onChange={(id, name) => {
                                                        setSupplierRows(rows => rows.map((r, i) =>
                                                            i === idx ? {
                                                                ...r,
                                                                supplier_id: id,
                                                                supplier_name: name,
                                                                eaushadhi_warehouse_name: r.eaushadhi_warehouse_name || name,
                                                            } : r
                                                        ));
                                                    }}
                                                    placeholder="Select supplier..."
                                                />
                                                <Input
                                                    value={s.eaushadhi_warehouse_name}
                                                    onChange={e => setSupplierRows(rows => rows.map((r, i) =>
                                                        i === idx ? { ...r, eaushadhi_warehouse_name: e.target.value } : r
                                                    ))}
                                                    placeholder="e.g. Mysuru WH"
                                                    className="h-9 text-sm"
                                                />
                                                <RadioButton
                                                    checked={s.is_default}
                                                    onClick={() => setSupplierRows(rows =>
                                                        rows.map(r => ({ ...r, is_default: r.id === s.id }))
                                                    )}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setSupplierRows(rows => rows.filter(r => r.id !== s.id))}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    className="size-3.5 cursor-pointer"
                                                    checked={s.eaushadhi_warehouse_name === s.supplier_name && !!s.supplier_name}
                                                    onChange={e => setSupplierRows(rows => rows.map((r, i) =>
                                                        i === idx ? { ...r, eaushadhi_warehouse_name: e.target.checked ? r.supplier_name : "" } : r
                                                    ))}
                                                />
                                                <span className="text-xs text-gray-500">Same as supplier name</span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* New rows */}
                                    {/* {newSupplierRows.map((s, idx) => (
                                        <div key={s.tempId} className="border border-gray-200 rounded-lg p-3 space-y-2">
                                            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                                                <SupplierSelect
                                                    options={suppliers.map(sup => ({ id: sup.id, name: sup.name }))}
                                                    value={s.supplier_id}
                                                    onChange={(id, name) => {
                                                        setNewSupplierRows(rows => rows.map((r, i) =>
                                                            i === idx ? {
                                                                ...r,
                                                                supplier_id: id,
                                                                supplier_name: name,
                                                                eaushadhi_warehouse_name: r.eaushadhi_warehouse_name || name,
                                                            } : r
                                                        ));
                                                    }}
                                                    placeholder="Select supplier..."
                                                />
                                                <Input
                                                    value={s.eaushadhi_warehouse_name}
                                                    onChange={e => setNewSupplierRows(rows => rows.map((r, i) =>
                                                        i === idx ? { ...r, eaushadhi_warehouse_name: e.target.value } : r
                                                    ))}
                                                    placeholder="e.g. Mysuru WH"
                                                    className="h-9 text-xs"
                                                />
                                                <RadioButton
                                                    checked={s.is_default}
                                                    onClick={() => setNewSupplierRows(rows =>
                                                        rows.map((r, i) => ({ ...r, is_default: i === idx }))
                                                    )}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setNewSupplierRows(rows => rows.filter((_, i) => i !== idx))}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    className="size-3"
                                                    checked={s.eaushadhi_warehouse_name === s.supplier_name}
                                                    onChange={e => setNewSupplierRows(rows => rows.map((r, i) =>
                                                        i === idx ? { ...r, eaushadhi_warehouse_name: e.target.checked ? r.supplier_name : "" } : r
                                                    ))}
                                                />
                                                <span className="text-xs text-gray-500">Same as supplier name</span>
                                            </div>
                                        </div>
                                    ))} */}
                                    {newSupplierRows.map((s, idx) => (
                                        <div key={s.tempId} className="border border-gray-200 rounded-lg p-3 space-y-2">
                                            {/* Column headers inside card */}
                                            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center mb-1">
                                                <span className="text-xs text-gray-500">Supplier</span>
                                                <span className="text-xs text-gray-500">eAushadhi Warehouse Name</span>
                                                <span className="text-xs text-gray-500">Default</span>
                                                <span />
                                            </div>
                                            {/* Inputs row */}
                                            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                                                <SupplierSelect
                                                    options={suppliers.map(sup => ({ id: sup.id, name: sup.name }))}
                                                    value={s.supplier_id}
                                                    onChange={(id, name) => {
                                                        setNewSupplierRows(rows => rows.map((r, i) =>
                                                            i === idx ? {
                                                                ...r,
                                                                supplier_id: id,
                                                                supplier_name: name,
                                                                eaushadhi_warehouse_name: r.eaushadhi_warehouse_name || name,
                                                            } : r
                                                        ));
                                                    }}
                                                    placeholder="Select supplier..."
                                                />
                                                <Input
                                                    value={s.eaushadhi_warehouse_name}
                                                    onChange={e => setNewSupplierRows(rows => rows.map((r, i) =>
                                                        i === idx ? { ...r, eaushadhi_warehouse_name: e.target.value } : r
                                                    ))}
                                                    placeholder="e.g. Mysuru WH"
                                                    className="h-9 text-xs"
                                                />
                                                <RadioButton
                                                    checked={s.is_default}
                                                    onClick={() => setNewSupplierRows(rows =>
                                                        rows.map((r, i) => ({ ...r, is_default: i === idx }))
                                                    )}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setNewSupplierRows(rows => rows.filter((_, i) => i !== idx))}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                            {/* Same as supplier name */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <input
                                                    type="checkbox"
                                                    className="size-3"
                                                    checked={s.eaushadhi_warehouse_name === s.supplier_name}
                                                    onChange={e => setNewSupplierRows(rows => rows.map((r, i) =>
                                                        i === idx ? { ...r, eaushadhi_warehouse_name: e.target.checked ? r.supplier_name : "" } : r
                                                    ))}
                                                />
                                                <span className="text-xs text-gray-500">Same as supplier name</span>
                                            </div>
                                        </div>
                                    ))}

                                    {supplierRows.length === 0 && newSupplierRows.length === 0 && (
                                        <p className="text-sm text-gray-400 text-center py-2">No supplier mappings yet.</p>
                                    )}
                                </div>

                                {/* Add another supplier */}
                                <button
                                    type="button"
                                    onClick={addNewSupplierRow}
                                    className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-green-700 hover:text-green-800 border border-dashed border-green-300 rounded-lg py-2 hover:bg-green-50 transition-colors"
                                >
                                    <span className="text-base">+</span> Add another supplier
                                </button>
                            </div>

                            <hr className="border-gray-200" />

                            {/* Settings */}
                            <div>
                                <h3 className="text-base font-semibold text-gray-900 mb-1">Settings</h3>
                                <p className="text-sm text-gray-500 mb-4">Behavioural flags for this facility's inward workflow.</p>
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Disable Inward Date</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Lock the inward date to today — users won't be able to backdate fetches.</p>
                                        </div>
                                        <Toggle checked={disableInwardDate} onChange={() => setDisableInwardDate(v => !v)} />
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Allow Manual Addition</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Let users add items not present in the eAushadhi inward response.</p>
                                        </div>
                                        <Toggle checked={manualAddition} onChange={() => setManualAddition(v => !v)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setSelectedMapping(null)}>Cancel</Button>
                            <Button
                                onClick={() => {
                                    if (!selectedMapping?.id) {
                                        toast.info("Adding new mappings is coming soon.");
                                        return;
                                    }
                                    saveMapping();
                                }}
                                disabled={isSaving}
                                className="!bg-green-700 hover:!bg-green-800 !text-white !opacity-100 flex items-center gap-2"
                            >
                                {isSaving ? "Saving..." : "✓ Save Mapping"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}