import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, X, ChevronDown, Check, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { I18NNAMESPACE } from "@/lib/contants";

// Constants
const SCHEMA_VERSIONS = ["1.0"];
const DEFAULT_CREDENTIALS_REF = "EAUSHADHI_API_SECRET_KEY";

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
  meta: {
    disable_inward_date: boolean;
    manual_addition: boolean;
    allow_deleting_inward_after_fetch: boolean;
    allow_updating_quantity_after_received: boolean;
  };
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
interface SelectOption {
  id: string;
  name: string;
}
interface SupplierSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (id: string, name: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function SupplierSelect({
  options,
  value,
  onChange,
  placeholder = "Select supplier...",
  disabled = false,
}: SupplierSelectProps) {
  const { t } = useTranslation(I18NNAMESPACE);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full h-9 flex items-center justify-between border border-gray-300 rounded-md px-3 text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
      >
        <span
          className={`truncate ${selected ? "text-gray-900" : "text-gray-400"}`}
        >
          {selected?.name ?? placeholder}
        </span>
        <ChevronDown
          className={`size-4 text-gray-400 shrink-0 ml-1 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute top-full left-0 z-30 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {options.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              {t("drawer_no_options")}
            </p>
          ) : (
            options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                onClick={() => {
                  onChange(o.id, o.name);
                  setOpen(false);
                }}
              >
                <span
                  className={
                    value === o.id
                      ? "text-green-700 font-medium"
                      : "text-gray-800"
                  }
                >
                  {o.name}
                </span>
                {value === o.id && (
                  <Check className="size-3.5 text-green-600 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function InstituteMappingAdmin() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(I18NNAMESPACE);
  const [selectedMapping, setSelectedMapping] =
    useState<InstituteMapping | null>(null);
  const [supplierRows, setSupplierRows] = useState<SupplierMapping[]>([]);
  const [newSupplierRows, setNewSupplierRows] = useState<NewSupplierRow[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [instituteId, setInstituteId] = useState("");
  const [schemaVersion, setSchemaVersion] = useState("");
  const [credentialsRef, setCredentialsRef] = useState("");
  const [disableInwardDate, setDisableInwardDate] = useState(false);
  const [manualAddition, setManualAddition] = useState(false);
  const [allowDeletingInwardAfterFetch, setAllowDeletingInwardAfterFetch] =
    useState(false);
  const [
    allowUpdatingQuantityAfterReceived,
    setAllowUpdatingQuantityAfterReceived,
  ] = useState(false);

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
          schema_version: schemaVersion,
          credentials_ref: credentialsRef,
          meta: {
            disable_inward_date: disableInwardDate,
            manual_addition: manualAddition,
            allow_deleting_inward_after_fetch: allowDeletingInwardAfterFetch,
            allow_updating_quantity_after_received:
              allowUpdatingQuantityAfterReceived,
          },
          supplier_mappings: newSupplierRows
            .filter((s) => s.supplier_id)
            .map((s) => ({
              supplier_id: s.supplier_id,
              eaushadhi_warehouse_name: s.eaushadhi_warehouse_name,
              is_default: s.is_default,
            })),
        },
      ),
    onSuccess: () => {
      toast.success(t("drawer_mapping_updated"));
      queryClient.invalidateQueries({ queryKey: ["institute-mappings-admin"] });
      setSelectedMapping(null);
    },
    onError: () => toast.error(t("drawer_mapping_update_error")),
  });

  const { mutate: createMapping, isPending: isCreating } = useMutation({
    mutationFn: () =>
      request(`/api/care_eaushadhi/institute-mappings/`, HttpMethod.POST, {
        facility_id: facilityId,
        eaushadhi_institute_id: instituteId,
        schema_version: schemaVersion,
        credentials_ref: credentialsRef,
        meta: {
          disable_inward_date: disableInwardDate,
          manual_addition: manualAddition,
          allow_deleting_inward_after_fetch: allowDeletingInwardAfterFetch,
          allow_updating_quantity_after_received:
            allowUpdatingQuantityAfterReceived,
        },
        supplier_mappings: newSupplierRows
          .filter((s) => s.supplier_id)
          .map((s) => ({
            supplier_id: s.supplier_id,
            eaushadhi_warehouse_name: s.eaushadhi_warehouse_name,
            is_default: s.is_default,
          })),
      }),
    onSuccess: () => {
      toast.success(t("drawer_mapping_created"));
      queryClient.invalidateQueries({ queryKey: ["institute-mappings-admin"] });
      setSelectedMapping(null);
    },
    onError: () => toast.error(t("drawer_mapping_create_error")),
  });

  const openDrawer = (m: InstituteMapping) => {
    setSelectedMapping(m);
    setFacilityId(m.facility_id);
    setInstituteId(m.eaushadhi_institute_id);
    setSchemaVersion(m.schema_version ?? "");
    setCredentialsRef(m.credentials_ref ?? "");
    setDisableInwardDate(m.meta?.disable_inward_date ?? false);
    setManualAddition(m.meta?.manual_addition ?? false);
    setAllowDeletingInwardAfterFetch(
      m.meta?.allow_deleting_inward_after_fetch ?? false,
    );
    setAllowUpdatingQuantityAfterReceived(
      m.meta?.allow_updating_quantity_after_received ?? false,
    );
    setSupplierRows(m.supplier_mappings);
    setNewSupplierRows([]);
  };

  const addNewSupplierRow = () => {
    setNewSupplierRows((rows) => [
      ...rows,
      {
        tempId: crypto.randomUUID(),
        supplier_id: "",
        supplier_name: "",
        eaushadhi_warehouse_name: "",
        is_default: rows.length === 0 && supplierRows.length === 0,
      },
    ]);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("admin_title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("admin_subtitle")}</p>
        </div>
        <Button
          className="flex items-center gap-2"
          onClick={() => {
            setSelectedMapping({
              id: "",
              facility_id: "",
              eaushadhi_institute_id: "",
              schema_version: SCHEMA_VERSIONS[0],
              credentials_ref: DEFAULT_CREDENTIALS_REF,
              meta: {
                disable_inward_date: false,
                manual_addition: false,
                allow_deleting_inward_after_fetch: false,
                allow_updating_quantity_after_received: false,
              },
              supplier_mappings: [],
            });
            setFacilityId("");
            setInstituteId("");
            setSchemaVersion(SCHEMA_VERSIONS[0]);
            setCredentialsRef(DEFAULT_CREDENTIALS_REF);
            setDisableInwardDate(false);
            setManualAddition(false);
            setAllowDeletingInwardAfterFetch(false);
            setAllowUpdatingQuantityAfterReceived(false);
            setSupplierRows([]);
            setNewSupplierRows([]);
          }}
        >
          <PlusCircle className="size-4" /> {t("admin_add_mapping")}
        </Button>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t("admin_col_facility")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t("admin_col_institute_id")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t("admin_col_suppliers")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t("admin_col_default_warehouse")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t("admin_col_actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded w-16" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded w-10" />
                  </td>
                </tr>
              ))
            ) : mappings.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  {t("admin_no_mappings")}
                </td>
              </tr>
            ) : (
              mappings.map((m) => {
                const defaultSupplier = m.supplier_mappings.find(
                  (s) => s.is_default,
                );
                const facilityName =
                  facilities.find((f) => f.id === m.facility_id)?.name ??
                  m.facility_id;
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {facilityName}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {m.eaushadhi_institute_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="font-semibold">
                        {m.supplier_mappings.length}
                      </span>
                      {m.supplier_mappings.length !== 1
                        ? t("admin_supplier_plural")
                        : t("admin_supplier_single")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {defaultSupplier?.eaushadhi_warehouse_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDrawer(m)}
                      >
                        {t("admin_edit")}
                      </Button>
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
          <div
            className="flex-1 bg-black/40"
            onClick={() => setSelectedMapping(null)}
          />
          <div className="w-[420px] bg-white h-full overflow-y-auto shadow-xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedMapping?.id
                    ? t("drawer_edit_title")
                    : t("drawer_add_title")}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {t("drawer_subtitle")}
                </p>
              </div>
              <button onClick={() => setSelectedMapping(null)} className="mt-1">
                <X className="size-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-8 flex-1">
              {/* Institute Details */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {t("drawer_institute_details_title")}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t("drawer_institute_details_subtitle")}
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-1 block">
                      {t("drawer_facility_label")}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <SupplierSelect
                      options={facilities.map((f) => ({
                        id: f.id,
                        name: f.name,
                      }))}
                      value={facilityId}
                      onChange={(id) => setFacilityId(id)}
                      placeholder={t("drawer_facility_placeholder")}
                      disabled={!!selectedMapping?.id}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t("drawer_facility_hint")}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-1 block">
                      {t("drawer_institute_id_label")}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={instituteId}
                      onChange={(e) => setInstituteId(e.target.value)}
                      className="h-9"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t("drawer_institute_id_hint")}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-1 block">
                      {t("drawer_schema_version_label")}
                    </label>
                    <SupplierSelect
                      options={SCHEMA_VERSIONS.map((v) => ({ id: v, name: v }))}
                      value={schemaVersion}
                      onChange={(id) => setSchemaVersion(id)}
                      placeholder={t("drawer_schema_version_placeholder")}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t("drawer_schema_version_hint")}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-1 block">
                      {t("drawer_credentials_ref_label")}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={credentialsRef}
                      onChange={(e) => setCredentialsRef(e.target.value)}
                      className="h-9"
                      placeholder={DEFAULT_CREDENTIALS_REF}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t("drawer_credentials_ref_hint")}
                    </p>
                  </div>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* Supplier Mappings */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {t("drawer_supplier_mappings_title")}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t("drawer_supplier_mappings_subtitle")}
                </p>

                <div className="space-y-3">
                  {/* Existing rows */}
                  {supplierRows.map((s, idx) => (
                    <div
                      key={s.id}
                      className="border border-gray-200 rounded-lg p-3 space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3 items-start">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-600">
                            {t("drawer_col_supplier")}
                          </label>
                          <SupplierSelect
                            options={suppliers.map((sup) => ({
                              id: sup.id,
                              name: sup.name,
                            }))}
                            value={s.supplier_id}
                            onChange={(id, name) => {
                              setSupplierRows((rows) =>
                                rows.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        supplier_id: id,
                                        supplier_name: name,
                                        eaushadhi_warehouse_name:
                                          r.eaushadhi_warehouse_name || name,
                                      }
                                    : r,
                                ),
                              );
                            }}
                            placeholder={t("drawer_supplier_placeholder")}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-600">
                            {t("drawer_col_warehouse")}
                          </label>
                          <Input
                            value={s.eaushadhi_warehouse_name}
                            onChange={(e) =>
                              setSupplierRows((rows) =>
                                rows.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        eaushadhi_warehouse_name:
                                          e.target.value,
                                      }
                                    : r,
                                ),
                              )
                            }
                            placeholder={t("drawer_warehouse_placeholder")}
                            className="h-9 text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`same-as-supplier-${s.id}`}
                              className="size-3.5 cursor-pointer"
                              checked={
                                s.eaushadhi_warehouse_name ===
                                  s.supplier_name && !!s.supplier_name
                              }
                              onChange={(e) =>
                                setSupplierRows((rows) =>
                                  rows.map((r, i) =>
                                    i === idx
                                      ? {
                                          ...r,
                                          eaushadhi_warehouse_name: e.target
                                            .checked
                                            ? r.supplier_name
                                            : "",
                                        }
                                      : r,
                                  ),
                                )
                              }
                            />
                            <label
                              htmlFor={`same-as-supplier-${s.id}`}
                              className="text-xs text-gray-500 cursor-pointer"
                            >
                              {t("drawer_same_as_supplier")}
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <Field
                          orientation="horizontal"
                          className="items-center gap-2"
                        >
                          <Switch
                            id={`default-${s.id}`}
                            checked={s.is_default}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSupplierRows((rows) =>
                                  rows.map((r) => ({
                                    ...r,
                                    is_default: r.id === s.id,
                                  })),
                                );
                              } else {
                                setSupplierRows((rows) =>
                                  rows.map((r) =>
                                    r.id === s.id
                                      ? { ...r, is_default: false }
                                      : r,
                                  ),
                                );
                              }
                            }}
                          />
                          <FieldLabel
                            htmlFor={`default-${s.id}`}
                            className="text-xs text-gray-600 cursor-pointer"
                          >
                            {t("drawer_make_default")}
                          </FieldLabel>
                        </Field>
                        <button
                          type="button"
                          onClick={() =>
                            setSupplierRows((rows) =>
                              rows.filter((r) => r.id !== s.id),
                            )
                          }
                          className="text-red-600 hover:text-white hover:bg-red-600 transition-colors p-1.5 rounded-md border border-red-300 hover:border-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {newSupplierRows.map((s, idx) => (
                    <div
                      key={s.tempId}
                      className="border border-gray-200 rounded-lg p-3 space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3 items-start">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-600">
                            {t("drawer_col_supplier")}
                          </label>
                          <SupplierSelect
                            options={suppliers.map((sup) => ({
                              id: sup.id,
                              name: sup.name,
                            }))}
                            value={s.supplier_id}
                            onChange={(id, name) => {
                              setNewSupplierRows((rows) =>
                                rows.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        supplier_id: id,
                                        supplier_name: name,
                                        eaushadhi_warehouse_name:
                                          r.eaushadhi_warehouse_name || name,
                                      }
                                    : r,
                                ),
                              );
                            }}
                            placeholder={t("drawer_supplier_placeholder")}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-600">
                            {t("drawer_col_warehouse")}
                          </label>
                          <Input
                            value={s.eaushadhi_warehouse_name}
                            onChange={(e) =>
                              setNewSupplierRows((rows) =>
                                rows.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        eaushadhi_warehouse_name:
                                          e.target.value,
                                      }
                                    : r,
                                ),
                              )
                            }
                            placeholder={t("drawer_warehouse_placeholder")}
                            className="h-9 text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`same-as-supplier-new-${idx}`}
                              className="size-3.5 cursor-pointer"
                              checked={
                                s.eaushadhi_warehouse_name ===
                                  s.supplier_name && !!s.supplier_name
                              }
                              onChange={(e) =>
                                setNewSupplierRows((rows) =>
                                  rows.map((r, i) =>
                                    i === idx
                                      ? {
                                          ...r,
                                          eaushadhi_warehouse_name: e.target
                                            .checked
                                            ? r.supplier_name
                                            : "",
                                        }
                                      : r,
                                  ),
                                )
                              }
                            />
                            <label
                              htmlFor={`same-as-supplier-new-${idx}`}
                              className="text-xs text-gray-500 cursor-pointer"
                            >
                              {t("drawer_same_as_supplier")}
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <Field
                          orientation="horizontal"
                          className="items-center gap-2"
                        >
                          <Switch
                            id={`default-new-${idx}`}
                            checked={s.is_default}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewSupplierRows((rows) =>
                                  rows.map((r, i) => ({
                                    ...r,
                                    is_default: i === idx,
                                  })),
                                );
                              } else {
                                setNewSupplierRows((rows) =>
                                  rows.map((r, i) =>
                                    i === idx ? { ...r, is_default: false } : r,
                                  ),
                                );
                              }
                            }}
                          />
                          <FieldLabel
                            htmlFor={`default-new-${idx}`}
                            className="text-xs text-gray-600 cursor-pointer"
                          >
                            {t("drawer_make_default")}
                          </FieldLabel>
                        </Field>
                        <button
                          type="button"
                          onClick={() =>
                            setNewSupplierRows((rows) =>
                              rows.filter((_, i) => i !== idx),
                            )
                          }
                          className="text-red-600 hover:text-white hover:bg-red-600 transition-colors p-1.5 rounded-md border border-red-300 hover:border-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {supplierRows.length === 0 &&
                    newSupplierRows.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-2">
                        {t("drawer_no_suppliers")}
                      </p>
                    )}
                </div>

                {/* Add another supplier */}
                <button
                  type="button"
                  onClick={addNewSupplierRow}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-green-700 hover:text-green-800 border border-dashed border-green-300 rounded-lg py-2 hover:bg-green-50 transition-colors"
                >
                  <span className="text-base">+</span>{" "}
                  {t("drawer_add_supplier")}
                </button>
              </div>

              <hr className="border-gray-200" />

              {/* Settings */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {t("drawer_settings_title")}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t("drawer_settings_subtitle")}
                </p>
                <div className="space-y-5">
                  <Field
                    orientation="horizontal"
                    className="justify-between items-start"
                  >
                    <div className="flex-1">
                      <FieldLabel
                        htmlFor="disable-inward-date"
                        className="text-sm font-medium text-gray-900"
                      >
                        {t("drawer_disable_inward_date_label")}
                      </FieldLabel>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t("drawer_disable_inward_date_hint")}
                      </p>
                    </div>
                    <Switch
                      id="disable-inward-date"
                      checked={disableInwardDate}
                      onCheckedChange={setDisableInwardDate}
                    />
                  </Field>
                  <Field
                    orientation="horizontal"
                    className="justify-between items-start"
                  >
                    <div className="flex-1">
                      <FieldLabel
                        htmlFor="manual-addition"
                        className="text-sm font-medium text-gray-900"
                      >
                        {t("drawer_manual_addition_label")}
                      </FieldLabel>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t("drawer_manual_addition_hint")}
                      </p>
                    </div>
                    <Switch
                      id="manual-addition"
                      checked={manualAddition}
                      onCheckedChange={setManualAddition}
                    />
                  </Field>
                  <Field
                    orientation="horizontal"
                    className="justify-between items-start"
                  >
                    <div className="flex-1">
                      <FieldLabel
                        htmlFor="allow-deleting-inward"
                        className="text-sm font-medium text-gray-900"
                      >
                        {t("drawer_allow_deleting_inward_label")}
                      </FieldLabel>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t("drawer_allow_deleting_inward_hint")}
                      </p>
                    </div>
                    <Switch
                      id="allow-deleting-inward"
                      checked={allowDeletingInwardAfterFetch}
                      onCheckedChange={setAllowDeletingInwardAfterFetch}
                    />
                  </Field>
                  <Field
                    orientation="horizontal"
                    className="justify-between items-start"
                  >
                    <div className="flex-1">
                      <FieldLabel
                        htmlFor="allow-updating-quantity"
                        className="text-sm font-medium text-gray-900"
                      >
                        {t("drawer_allow_updating_quantity_label")}
                      </FieldLabel>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t("drawer_allow_updating_quantity_hint")}
                      </p>
                    </div>
                    <Switch
                      id="allow-updating-quantity"
                      checked={allowUpdatingQuantityAfterReceived}
                      onCheckedChange={setAllowUpdatingQuantityAfterReceived}
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setSelectedMapping(null)}
              >
                {t("drawer_cancel")}
              </Button>
              <Button
                onClick={() => {
                  if (!selectedMapping?.id) {
                    if (!facilityId) {
                      toast.error(t("drawer_facility_required"));
                      return;
                    }
                    if (!instituteId) {
                      toast.error(t("drawer_institute_id_required"));
                      return;
                    }
                    if (!credentialsRef) {
                      toast.error(t("drawer_credentials_required"));
                      return;
                    }
                    createMapping();
                    return;
                  }
                  saveMapping();
                }}
                disabled={isSaving || isCreating}
                className="!bg-green-700 hover:!bg-green-800 !text-white !opacity-100 flex items-center gap-2"
              >
                {isSaving || isCreating
                  ? t("drawer_saving")
                  : `✓ ${t("drawer_save_mapping")}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
