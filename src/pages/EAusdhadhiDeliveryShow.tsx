import { useMemo, useCallback } from "react";
import { ChevronLeft, Printer } from "lucide-react";
import { navigate } from "raviger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import AddSupplyDeliveryForm from "@/pages/AddSupplyDeliveryForm";
import { navigateToDeliveryPrint } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { I18NNAMESPACE } from "@/lib/contants";

interface Props {
  facilityId: string;
  locationId: string;
  deliveryOrderId: string;
  internal: boolean;
}

interface Organization {
  id: string;
  name: string;
}
interface Location {
  id: string;
  name: string;
}
interface User {
  first_name: string;
  last_name: string;
}
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
  created_date: string;
  created_by: User;
}

interface InwardRecord {
  id: string;
  facility_id: string;
  inward_date: string;
  sync_status: string;
  items_initial_count: number;
  items_current_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  abandoned: "bg-red-100 text-red-700",
  entered_in_error: "bg-red-100 text-red-700",
};

export default function EAusdhadhiDeliveryShow({
  facilityId,
  locationId,
  deliveryOrderId,
}: Props) {
  const queryClient = useQueryClient();
  const { t } = useTranslation(I18NNAMESPACE);
  // ──────────────────────────────────────────────────────────────────────────
  // MODIFICATION: Extract inward_record_id from URL query parameters
  // ──────────────────────────────────────────────────────────────────────────
  const inwardRecordId = useMemo(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.get("inward_record_id") || undefined;
    }
    return undefined;
  }, []);

  const goBackToDeliveryPage = useCallback(() => {
    navigate(
      `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/incoming`,
    );
  }, [facilityId, locationId]);
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
        {
          order: deliveryOrderId,
          facility: facilityId,
          ordering: "created_date",
        },
      ),
    enabled: !!deliveryOrderId,
  });

  // Fetch inward record if inwardRecordId is available
  const { data: inwardRecord } = useQuery({
    queryKey: ["inwardRecord", inwardRecordId],
    queryFn: () =>
      request<InwardRecord>(
        `/api/care_eaushadhi/inward-records/${inwardRecordId}/`,
        HttpMethod.GET,
      ),
    enabled: !!inwardRecordId,
  });

  const supplierId = deliveryOrder?.supplier?.id;
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
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({
        queryKey: ["deliveryOrder", deliveryOrderId],
      });
      toast.success(t("delivery_show_status_updated"));

      // If status is pending, redirect to outgoing page
      if (response?.status === "pending") {
        const redirectPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/outgoing/${deliveryOrderId}`;
        navigate(redirectPath);
      }
    },
    onError: () => toast.error(t("delivery_show_status_error")),
  });

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
        <p className="text-gray-500">{t("delivery_show_not_found")}</p>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6 space-y-6 mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <button
            onClick={goBackToDeliveryPage}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {deliveryOrder.name}
            </h1>
            <p className="text-sm text-gray-500">
              {t("delivery_show_dispatch_from")}{" "}
              <span className="font-medium">
                {deliveryOrder.supplier?.name ??
                  deliveryOrder.origin?.name ??
                  "—"}
              </span>{" "}
              {t("delivery_show_to")}{" "}
              <span className="font-medium">
                {deliveryOrder.destination.name}
              </span>
              .
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {/* Print */}
          <Button
            variant="outline"
            onClick={() =>
              navigateToDeliveryPrint(facilityId, locationId, deliveryOrderId)
            }
            className="flex items-center gap-2"
          >
            <Printer className="size-4" /> {t("delivery_show_print")}
          </Button>

          {/* Edit — draft only */}
          {deliveryOrder.status === "draft" && (
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  `/facility/${facilityId}/locations/${locationId}/eaushadhi/delivery/${deliveryOrderId}/edit?inward_record_id=${inwardRecordId}`,
                )
              }
            >
              {t("delivery_show_edit")}
            </Button>
          )}

          {/* Mark as Approved — draft only */}
          {deliveryOrder.status === "draft" && (
            <Button
              onClick={() => updateStatus("pending")}
              disabled={isUpdating || supplyDeliveries.length === 0}
              className="!bg-green-700 hover:!bg-green-800 !text-white !opacity-100"
            >
              {isUpdating
                ? t("delivery_show_updating")
                : t("delivery_show_mark_approved")}
            </Button>
          )}
        </div>
      </div>

      {/* ── Delivery Info Card ── */}
      <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">
              {t("delivery_show_deliver_to")}
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {deliveryOrder.destination.name}
            </p>
          </div>
          {deliveryOrder.supplier && (
            <div>
              <p className="text-sm font-medium text-gray-500">
                {t("delivery_show_supplier")}
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {deliveryOrder.supplier.name}
              </p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-500">
              {t("delivery_show_status")}
            </p>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[deliveryOrder.status]}`}
            >
              {t(`status_${deliveryOrder.status}`)}
            </span>
          </div>
          {deliveryOrder.note && (
            <div>
              <p className="text-sm font-medium text-gray-500">
                {t("delivery_show_note")}
              </p>
              <p className="text-sm text-gray-700">{deliveryOrder.note}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-500">
              {t("delivery_show_created_by")}
            </p>
            <p className="text-base font-semibold text-gray-900">
              {deliveryOrder.created_by.first_name}{" "}
              {deliveryOrder.created_by.last_name}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(deliveryOrder.created_date).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">
              {t("delivery_show_inward_date")}
            </p>
            <p className="text-base font-semibold text-gray-900">
              {inwardRecord?.inward_date
                ? new Date(inwardRecord.inward_date).toLocaleDateString()
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Supply Deliveries Section ── */}
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {isRequester
              ? deliveryOrder.status === "completed"
                ? t("delivery_show_items_updated")
                : t("delivery_show_items_to_receive")
              : t("delivery_show_supply_deliveries")}
          </h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Loading skeleton */}
          {isLoadingItems ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
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
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          {t("delivery_show_product")}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          {t("delivery_show_batch")}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          {t("delivery_show_expiry")}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          {t("delivery_show_qty")}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          {t("delivery_show_condition")}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          {t("delivery_show_status_col")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {supplyDeliveries.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">
                            {d.supplied_item?.product_knowledge?.name ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {d.supplied_item?.batch?.lot_number ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {d.supplied_item?.expiration_date
                              ? new Date(
                                  d.supplied_item.expiration_date,
                                ).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {parseFloat(d.supplied_item_quantity).toFixed(2)}{" "}
                            {d.supplied_item?.product_knowledge?.base_unit
                              ?.display ?? ""}
                          </td>
                          <td className="px-3 py-2 text-gray-600 capitalize">
                            {d.supplied_item_condition}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-sm whitespace-nowrap border ${
                                d.status === "completed"
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : d.status === "abandoned"
                                    ? "bg-red-100 text-red-700 border-red-200"
                                    : d.status === "in_progress"
                                      ? "bg-blue-100 text-blue-700 border-blue-200"
                                      : "bg-yellow-100 text-yellow-700 border-yellow-200"
                              }`}
                            >
                              {t(`status_${d.status}`)}
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
                  supplierId={supplierId}
                  destination={deliveryOrder.destination.id}
                  inwardRecordId={inwardRecordId}
                  inwardDate={inwardRecord?.inward_date}
                  supplyDeliveriesCount={supplyDeliveries?.length}
                  onSuccess={() => {
                    queryClient.invalidateQueries({
                      queryKey: ["supplyDeliveries", deliveryOrderId],
                    });
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
