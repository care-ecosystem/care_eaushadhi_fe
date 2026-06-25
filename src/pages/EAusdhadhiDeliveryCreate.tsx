import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { navigate } from "raviger";
import { useMutation } from "@tanstack/react-query";
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
import { useTranslation } from "react-i18next";
import { I18NNAMESPACE } from "@/lib/contants";
import { useInstituteMapping } from "@/contexts/InstituteMappingContext";
import { formatDateForEaushadhiAPI, formatDateForURL } from "@/lib/utils";

interface Props {
  facilityId: string;
  locationId: string;
  deliveryOrderId?: string;
}

interface InitiateInwardFetchPayload {
  facility_id: string;
  inward_date: string;
  triggered_by: "USER";
  force_refresh: boolean;
}

// Returns today's date formatted as YYYY-MM-DD (ISO format for date input)
function getTodayFormatted() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function EAusdhadhiDeliveryCreate({
  facilityId,
  locationId,
}: Props) {
  const { t } = useTranslation(I18NNAMESPACE);
  const {
    supplierMappings,
    defaultSupplier,
    meta,
    instituteMapping,
    isLoading,
  } = useInstituteMapping();

  const [name, setName] = useState(t("fetch_page_default_name"));
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [inwardDate, setInwardDate] = useState(getTodayFormatted());
  const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/incoming`;

  useEffect(() => {
    if (defaultSupplier) {
      setSupplier(defaultSupplier.supplier_id);
    }
  }, [defaultSupplier?.supplier_id]);

  // Initiate inward fetch API
  const { mutateAsync: initiateInwardFetch } = useMutation({
    mutationFn: (forceRefresh: boolean) =>
      request<unknown>(
        "/api/care_eaushadhi/initiate-inward-fetch/",
        HttpMethod.POST,
        {
          facility_id: facilityId,
          inward_date: formatDateForEaushadhiAPI(inwardDate),
          triggered_by: "USER",
          force_refresh: forceRefresh,
        } satisfies InitiateInwardFetchPayload,
      ),
  });

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
    onSuccess: async (data: any) => {
      toast.success(t("fetch_page_success"));

      // Initiate inward fetch before redirecting
      try {
        await initiateInwardFetch(false);
      } catch (error) {
        console.error("Failed to initiate inward fetch:", error);
        // Continue with navigation even if fetch fails
      }

      const formattedDate = formatDateForURL(inwardDate);
      navigate(
        `/facility/${facilityId}/locations/${locationId}/eaushadhi/delivery/${data.id}/fetch-inward?inward_date=${formattedDate}`,
      );
    },
    onError: () => {
      toast.error(t("fetch_page_error"));
    },
  });

  // Prepare supplier options (deduplicated by supplier_id)
  const supplierOptions = useMemo(
    () =>
      Array.from(
        new Map(
          supplierMappings.map((mapping) => [
            mapping.supplier_id,
            { id: mapping.supplier_id, name: mapping.supplier_name },
          ]),
        ).values(),
      ),
    [supplierMappings],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  // Error state - no institute mapping or supplier mappings
  if (!instituteMapping || supplierMappings.length === 0) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {t("fetch_page_title")}
          </h1>
          <button
            onClick={() => navigate(returnPath)}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex">
            <div className="shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {t("fetch_page_config_required")}
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  {!instituteMapping
                    ? t("fetch_page_no_institute_mapping")
                    : t("fetch_page_no_supplier_mappings")}
                </p>
                <p className="mt-2">{t("fetch_page_contact_admin")}</p>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(returnPath)}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  {t("fetch_page_go_back")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          {t("fetch_page_title")}
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
            {t("fetch_page_draft")}
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
              {t("fetch_page_name_label")}
            </label>
            <Input
              className="h-9 bg-white"
              placeholder={t("fetch_page_name_placeholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-900">
              {t("fetch_page_vendor_label")}
            </label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder={t("fetch_page_vendor_placeholder")} />
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
        <div className="grid sm:grid-cols-2 gap-4 items-start">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-900">
              {t("fetch_page_inward_date_label")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              className="h-9 bg-white"
              value={inwardDate}
              onChange={(e) => setInwardDate(e.target.value)}
              disabled={meta?.disable_inward_date}
            />
            <p className="text-xs text-gray-500">
              {t("fetch_page_inward_date_hint")}
            </p>
          </div>
        </div>

        {/* Note */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-900">
            {t("fetch_page_note_label")}{" "}
            <span className="text-gray-500 text-sm font-normal italic">
              {t("fetch_page_note_optional")}
            </span>
          </label>
          <Textarea
            rows={3}
            placeholder={t("fetch_page_note_placeholder")}
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
          {t("fetch_page_cancel")}
        </Button>

        <Button
          type="button"
          disabled={isPending}
          className="bg-green-700! hover:bg-green-800! text-white! opacity-100!"
          onClick={() => {
            if (!supplier) {
              toast.error(t("fetch_page_vendor_error"));
              return;
            }
            createDeliveryOrder();
          }}
        >
          {isPending ? t("fetch_page_fetching") : t("fetch_page_fetch")}
        </Button>
      </div>
    </div>
  );
}
