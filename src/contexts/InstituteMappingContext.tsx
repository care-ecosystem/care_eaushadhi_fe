import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/apis/query";
import { HttpMethod } from "@/apis/types";

interface SupplierMapping {
  id: string;
  supplier_id: string;
  supplier_name: string;
  eaushadhi_warehouse_name: string;
  is_default: boolean;
}

interface InstituteMappingMeta {
  disable_inward_date: boolean;
  manual_addition: boolean;
  allow_deleting_inward_after_fetch: boolean;
  allow_updating_quantity_after_received: boolean;
}

interface InstituteMapping {
  id: string;
  facility_id: string;
  eaushadhi_institute_id: string;
  schema_version: string;
  credentials_ref: string;
  meta: InstituteMappingMeta;
  supplier_mappings: SupplierMapping[];
}

interface InstituteMappingContextValue {
  instituteMapping: InstituteMapping | null;
  isLoading: boolean;
  error: Error | null;
  meta: InstituteMappingMeta | null;
  supplierMappings: SupplierMapping[];
  defaultSupplier: SupplierMapping | null;
}

const InstituteMappingContext = createContext<
  InstituteMappingContextValue | undefined
>(undefined);

interface InstituteMappingProviderProps {
  facilityId: string;
  children: ReactNode;
}

export function InstituteMappingProvider({
  facilityId,
  children,
}: InstituteMappingProviderProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["institute-mapping", facilityId],
    queryFn: () =>
      request<{ results: InstituteMapping[] }>(
        "/api/care_eaushadhi/institute-mappings/",
        HttpMethod.GET,
        { facility_id: facilityId },
      ),
    enabled: !!facilityId,
  });

  const instituteMapping = data?.results?.[0] || null;
  const meta = instituteMapping?.meta || null;
  const supplierMappings = instituteMapping?.supplier_mappings || [];
  const defaultSupplier = supplierMappings.find((s) => s.is_default) || null;

  const value: InstituteMappingContextValue = {
    instituteMapping,
    isLoading,
    error: error as Error | null,
    meta,
    supplierMappings,
    defaultSupplier,
  };

  return (
    <InstituteMappingContext.Provider value={value}>
      {children}
    </InstituteMappingContext.Provider>
  );
}

export function useInstituteMapping() {
  const context = useContext(InstituteMappingContext);
  if (context === undefined) {
    throw new Error(
      "useInstituteMapping must be used within InstituteMappingProvider",
    );
  }
  return context;
}
