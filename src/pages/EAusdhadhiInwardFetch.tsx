import { ChevronLeft, Loader2Icon, RefreshCw, PencilLine } from "lucide-react";
import { navigate } from "raviger";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { I18NNAMESPACE, POLL_STEP_MS, POLLING_TIMEOUT } from "@/lib/contants";
import { useInstituteMapping } from "@/contexts/InstituteMappingContext";

interface Props {
  facilityId: string;
  locationId: string;
  deliveryOrderId: string;
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
  meta?: {
    error_code?: string;
    error_message?: string;
    error_details?: Record<string, unknown>;
    failed_at?: string;
  } | null;
}

interface InwardRecordsResponse {
  count: number;
  results: InwardRecord[];
}
interface InitiateInwardFetchPayload {
  facility_id: string;
  inward_date: string;
  triggered_by: "USER";
  force_refresh: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  abandoned: "bg-red-100 text-red-700",
  entered_in_error: "bg-red-100 text-red-700",
};

// ── Inward state machine ───────────────────────────────────────────────────
type InwardUIState =
  | "loading" // initial load / mid-retry in flight
  | "fetching" // record exists with sync_status === "FETCHING"
  | "retry" // count=0, FAILED, or FETCHED with items_current_count=0
  | "redirect"; // FETCHED with items_current_count > 0 → navigate away

function resolveInwardState(
  isRetrying: boolean,
  isInwardLoading: boolean,
  inwardRecords: InwardRecordsResponse | undefined,
): InwardUIState {
  // While a retry POST is in flight or we haven't loaded yet
  if (isRetrying || isInwardLoading || inwardRecords === undefined) {
    return "loading";
  }

  const record = inwardRecords.results[0];

  // No records at all
  if (inwardRecords.count === 0 || !record) return "retry";

  // eAushadhi is still syncing
  if (record.sync_status === "FETCHING") return "fetching";

  // Sync finished — check item counts
  if (record.sync_status === "FETCHED") {
    return record.items_current_count > 0 ? "redirect" : "retry";
  }

  // FAILED or any other terminal error status
  return "retry";
}

export default function EAusdhadhiInwardFetch({
  facilityId,
  locationId,
  deliveryOrderId,
}: Props) {
  const queryClient = useQueryClient();
  const { t } = useTranslation(I18NNAMESPACE);
  const { meta } = useInstituteMapping();
  // useRef so refetchInterval closure always reads the current value
  const isRetryingRef = useRef(false);
  const pollCountRef = useRef(0);

  const [isRetrying, setIsRetrying] = useState(false);
  const [fetchTimedOut, setFetchTimedOut] = useState(false);
  const fetchTimedOutRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { inward_date, inward_date_api } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("inward_date")?.replace("?", "") ?? null;

    const parsed = raw
      ? (() => {
          const [month, day, year] = raw.split("/");
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        })()
      : null;

    const apiFormat = raw
      ? (() => {
          const [month, day, year] = raw.split("/");
          return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
        })()
      : null;

    return {
      inward_date: parsed,
      inward_date_api: apiFormat,
    };
  }, []);

  const addManuallyBasePath = `/facility/${facilityId}/locations/${locationId}/eaushadhi/delivery/${deliveryOrderId}`;
  const returnPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/incoming`;
  const nativeAddManuallyPath = `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/outgoing/${deliveryOrderId}`;

  const inwardQueryKey = ["inwardRecords", facilityId, inward_date];

  // ── Fetch delivery order ────────────────────────────────────────────────
  const { data: deliveryOrder, isLoading: isDeliveryOrderLoading } = useQuery({
    queryKey: ["deliveryOrder", deliveryOrderId],
    queryFn: () =>
      request<DeliveryOrder>(
        `/api/v1/facility/${facilityId}/order/delivery/${deliveryOrderId}/`,
        HttpMethod.GET,
      ),
  });

  // ── Poll inward records ─────────────────────────────────────────────────
  const { data: inwardRecords, isLoading: isInwardLoading } =
    useQuery<InwardRecordsResponse>({
      queryKey: inwardQueryKey,
      queryFn: () =>
        request<InwardRecordsResponse>(
          "/api/care_eaushadhi/inward-records/",
          HttpMethod.GET,
          { facility_id: facilityId, inward_date },
        ),
      enabled: !!inward_date,
      refetchInterval: (query) => {
        // Always read from refs — never stale inside this closure
        if (fetchTimedOutRef.current) return false;
        const delay = (pollCountRef.current + 1) * POLL_STEP_MS;
        if (isRetryingRef.current) return delay;
        const data = query.state.data;
        if (!data) return delay;
        if (data.count === 0) return false;
        const record = data.results[0];
        if (record?.sync_status === "FETCHING") {
          pollCountRef.current += 1;
          return delay;
        }
        // Terminal status — stop polling
        return false;
      },
    });

  useEffect(() => {
    const record = inwardRecords?.results[0];

    if (record?.sync_status === "FAILED") {
      // Build error message from meta if available, otherwise use generic
      let errorMsg = "Failed to fetch inward records from eAushadhi";

      if (record?.meta?.error_code && record?.meta?.error_message) {
        errorMsg = `${record.meta.error_code}: ${record.meta.error_message}`;
      } else if (record?.meta?.error_code) {
        errorMsg = record.meta.error_code;
      } else if (record?.meta?.error_message) {
        errorMsg = record.meta.error_message;
      }

      toast.error(errorMsg);
    }
  }, [inwardRecords?.results[0]?.sync_status, inwardRecords?.results[0]?.meta]);
  // ═══════════════════════════════════════════════════════════════════════

  // ── Initiate inward fetch ───────────────────────────────────────────────
  const { mutate: initiateInwardFetch, isPending: isInitiating } = useMutation({
    mutationFn: (forceRefresh: boolean) =>
      request<unknown>(
        "/api/care_eaushadhi/initiate-inward-fetch/",
        HttpMethod.POST,
        {
          facility_id: facilityId,
          inward_date: inward_date_api ?? "",
          triggered_by: "USER",
          force_refresh: forceRefresh,
        } satisfies InitiateInwardFetchPayload,
      ),
    onSuccess: () => {
      // Set ref first — immediately visible to the refetchInterval closure
      isRetryingRef.current = true;
      pollCountRef.current = 0;
      setIsRetrying(true);
      queryClient.invalidateQueries({ queryKey: inwardQueryKey });
    },
  });

  // ── Clear retrying state once a terminal status arrives ─────────────────
  useEffect(() => {
    if (!isRetrying || !inwardRecords) return;
    const record = inwardRecords.results[0];
    const isTerminal =
      inwardRecords.count === 0 ||
      (record && record.sync_status !== "FETCHING");
    if (isTerminal) {
      isRetryingRef.current = false;
      setIsRetrying(false);
    }
  }, [inwardRecords, isRetrying]);

  // ── Resolve unified UI state ────────────────────────────────────────────
  const inwardUIState = resolveInwardState(
    isRetrying || isInitiating,
    isInwardLoading,
    inwardRecords,
  );

  // ── Fetch timeout — show message after 10 s of continuous polling ───────
  useEffect(() => {
    if (inwardUIState === "fetching" || inwardUIState === "loading") {
      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          fetchTimedOutRef.current = true;
          setFetchTimedOut(true);
        }, POLLING_TIMEOUT);
      }
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      fetchTimedOutRef.current = false;
      setFetchTimedOut(false);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [inwardUIState]);

  // ── Navigation — fires only when state machine says redirect ────────────
  useEffect(() => {
    if (inwardUIState !== "redirect") return;
    const record = inwardRecords?.results[0];
    if (!record) return;
    navigate(`${addManuallyBasePath}?inward_record_id=${record.id}`);
  }, [inwardUIState, inwardRecords, addManuallyBasePath]);

  // ── Handlers ────────────────────────────────────────────────────────────
  function handleRetry() {
    initiateInwardFetch(true);
  }

  function handleAddManually(recordId?: string) {
    const record = inwardRecords?.results[0];
    const shouldUseNativeRoute =
      !record ||
      record.sync_status === "FAILED" ||
      (record.sync_status === "FETCHED" && record.items_current_count === 0);

    if (shouldUseNativeRoute) {
      navigate(nativeAddManuallyPath);
    } else {
      const url = recordId
        ? `${addManuallyBasePath}?inward_record_id=${recordId}`
        : addManuallyBasePath;
      navigate(url);
    }
  }

  // ── Page-level loading / not found ──────────────────────────────────────
  if (isDeliveryOrderLoading || (isInwardLoading && !deliveryOrder)) {
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
        <p className="text-gray-500">{t("delivery_fetch_not_found")}</p>
      </div>
    );
  }

  // ── Inward section ───────────────────────────────────────────────────────
  function renderInwardSection() {
    // "loading" covers: initial load, mid-retry POST, FETCHING poll
    if (inwardUIState === "loading" || inwardUIState === "fetching") {
      return (
        <div className="flex items-center justify-center px-4 py-10 flex-col gap-4">
          <h2 className="text-lg text-gray-700">
            {t("delivery_fetch_loading_title")}
          </h2>
          <Loader2Icon className="animate-spin text-gray-500 size-6" />
          <p className="text-sm text-gray-500">
            {fetchTimedOut
              ? t("delivery_fetch_timeout_desc")
              : t("delivery_fetch_loading_desc")}
          </p>
        </div>
      );
    }

    // "redirect" — useEffect handles navigation; show brief spinner to avoid flash
    if (inwardUIState === "redirect") {
      return (
        <div className="flex items-center justify-center px-4 py-10 flex-col gap-4">
          <Loader2Icon className="animate-spin text-gray-400 size-6" />
          <p className="text-sm text-gray-400">
            {t("delivery_fetch_redirecting")}
          </p>
        </div>
      );
    }

    // "retry" — count=0, FAILED, or FETCHED with zero items
    const record = inwardRecords?.results[0];
    const isFailed = record?.sync_status === "FAILED";
    const isFetchedEmpty =
      record?.sync_status === "FETCHED" && record.items_current_count === 0;

    const heading = isFailed
      ? t("delivery_fetch_sync_failed")
      : t("delivery_fetch_no_records");
    const description = isFailed
      ? t("delivery_fetch_failed_desc")
      : isFetchedEmpty
        ? t("delivery_fetch_empty_desc")
        : t("delivery_fetch_no_records_desc");
    const retryLabel = isInitiating
      ? t("delivery_fetch_retrying")
      : isFailed
        ? t("delivery_fetch_retry")
        : t("delivery_fetch_refetch");

    return (
      <div className="flex items-center justify-center px-4 py-10 flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            className={`inline-flex items-center justify-center size-10 rounded-full ${
              isFailed ? "bg-red-100" : "bg-yellow-100"
            }`}
          >
            <span
              className={`text-lg font-bold ${
                isFailed ? "text-red-600" : "text-yellow-600"
              }`}
            >
              {isFailed ? "!" : "∅"}
            </span>
          </span>
          <h2 className="text-lg font-semibold text-gray-800">{heading}</h2>
          <p className="text-sm text-gray-500 max-w-sm">{description}</p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <Button
            onClick={handleRetry}
            disabled={isInitiating}
            className="flex items-center gap-2"
          >
            {isInitiating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {t("delivery_fetch_from_eaushadhi")}
          </Button>
          {meta?.manual_addition && (
            <Button
              variant="outline"
              onClick={() => handleAddManually(record?.id)}
              className="flex items-center gap-2"
            >
              <PencilLine className="size-4" />
              {t("delivery_fetch_add_manually")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(returnPath)}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {deliveryOrder.name}
            </h1>
            <p className="text-sm text-gray-500">
              {t("delivery_fetch_dispatch_from")}{" "}
              <span className="font-medium">
                {deliveryOrder.supplier?.name ??
                  deliveryOrder.origin?.name ??
                  "—"}
              </span>{" "}
              {t("delivery_fetch_to")}{" "}
              <span className="font-medium">
                {deliveryOrder.destination.name}
              </span>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">
              {t("delivery_fetch_deliver_to")}
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {deliveryOrder.destination.name}
            </p>
          </div>
          {deliveryOrder.supplier && (
            <div>
              <p className="text-sm font-medium text-gray-500">
                {t("delivery_fetch_supplier")}
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {deliveryOrder.supplier.name}
              </p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-500">
              {t("delivery_fetch_status")}
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
                {t("delivery_fetch_note")}
              </p>
              <p className="text-sm text-gray-700">{deliveryOrder.note}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-500">
              {t("delivery_fetch_created_by")}
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
              {t("delivery_fetch_inward_date")}
            </p>
            <p className="text-base font-semibold text-gray-900">
              {inward_date
                ? new Date(inward_date).toLocaleDateString()
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg bg-white py-10 shadow-sm">
        {renderInwardSection()}
      </div>
    </div>
  );
}
