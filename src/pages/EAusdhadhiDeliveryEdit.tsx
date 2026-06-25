import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { navigate } from "raviger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

interface Props {
  facilityId: string;
  locationId: string;
  deliveryOrderId: string;
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

export default function EAusdhadhiDeliveryEdit({
  facilityId,
  locationId,
  deliveryOrderId,
}: Props) {
  const queryClient = useQueryClient();
  const { supplierMappings } = useInstituteMapping();
  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const { t } = useTranslation(I18NNAMESPACE);

  const inwardRecordId = useMemo(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.get("inward_record_id") || undefined;
    }
    return undefined;
  }, []);

  const returnPath = `/facility/${facilityId}/locations/${locationId}/eaushadhi/delivery/${deliveryOrderId}?inward_record_id=${inwardRecordId}`;

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
      queryClient.invalidateQueries({
        queryKey: ["deliveryOrder", deliveryOrderId],
      });
      toast.success(t("delivery_form_success"));
      navigate(returnPath);
    },
    onError: () => {
      toast.error(t("delivery_form_error"));
    },
  });

  if (isFetching) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4 animate-pulse">
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
    <div className="container mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          {t("delivery_form_edit_title")}
          {existingOrder?.status && (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 capitalize">
              {existingOrder.status}
            </span>
          )}
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
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-6 mb-6">
        {/* Name + Vendor/Distributor */}
        <div className="grid grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-900">
              {t("delivery_form_name_label")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("delivery_form_name_placeholder")}
              className="h-9 bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-900">
              {t("delivery_form_vendor_label")}
            </label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue
                  placeholder={t("delivery_form_vendor_placeholder")}
                />
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

        {/* Note */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-900">
            {t("delivery_form_note_label")}{" "}
            <span className="text-gray-500 text-sm font-normal italic">
              {t("delivery_form_note_optional")}
            </span>
          </label>
          <Textarea
            placeholder={t("delivery_form_note_placeholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="bg-white resize-y"
          />
        </div>
      </div>

      {/* Footer buttons */}
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={() => navigate(returnPath)}>
          {t("delivery_form_cancel")}
          <span className="ml-1.5 text-xs bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-mono">
            ESC
          </span>
        </Button>
        <Button
          disabled={isPending}
          style={{ backgroundColor: "#15803d", color: "white", opacity: 1 }}
          onClick={() => {
            if (!name) {
              toast.error(t("delivery_form_name_error"));
              return;
            }
            if (!supplier) {
              toast.error(t("delivery_form_vendor_error"));
              return;
            }
            updateDeliveryOrder();
          }}
        >
          {isPending ? t("delivery_form_saving") : t("delivery_form_save")}
          <span
            className="ml-1.5 text-xs rounded px-1.5 py-0.5 font-mono"
            style={{
              backgroundColor: "#166534",
              border: "1px solid #15803d",
              color: "white",
            }}
          >
            ENTER
          </span>
        </Button>
      </div>
    </div>
  );
}
