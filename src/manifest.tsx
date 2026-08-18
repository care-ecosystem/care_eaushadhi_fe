import { lazy, Suspense } from "react";
import { InstituteMappingProvider } from "./contexts/InstituteMappingContext.tsx";
import React from "react";
import { PillIcon } from "lucide-react";
import en from "../public/locale/en.json";

// Lazy load all page components for better code splitting and module federation
const EAusdhadhiDeliveryCreate = lazy(
  () => import("./pages/EAusdhadhiDeliveryCreate.tsx"),
);
const EAusdhadhiDeliveryShow = lazy(
  () => import("./pages/EAusdhadhiDeliveryShow.tsx"),
);
const EAusdhadhiDeliveryEdit = lazy(
  () => import("./pages/EAusdhadhiDeliveryEdit.tsx"),
);
const EAusdhadhiInwardFetch = lazy(
  () => import("./pages/EAusdhadhiInwardFetch.tsx"),
);
const InstituteMappingAdmin = lazy(
  () => import("./pages/InstituteMappingAdmin.tsx"),
);
const ProductMappingsLayout = lazy(
  () => import("./pages/ProductMappingsLayout.tsx"),
);

// Wrapper component for pages
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="w-full px-6 py-6 max-w-5xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

// Wrapper component for pages that need institute mapping data
function FacilityPageWrapper({
  facilityId,
  children,
}: {
  facilityId: string;
  children: React.ReactNode;
}) {
  return (
    <PageWrapper>
      <InstituteMappingProvider facilityId={facilityId}>
        {children}
      </InstituteMappingProvider>
    </PageWrapper>
  );
}

const manifest = {
  plugin: "care_eaushadhi",
  extends: [],
  components: {
    DeliveryOrderActions: lazy(
      () => import("./components/pluggables/eAusdhadhiTriggerButton"),
    ),
  },
  i18n: {
    en,
  },
  routes: {
    "/admin/eaushadhi/institute-mappings": () => (
      <PageWrapper>
        <InstituteMappingAdmin />
      </PageWrapper>
    ),
    "/admin/eaushadhi/product-mappings": () => (
      <PageWrapper>
        <ProductMappingsLayout />
      </PageWrapper>
    ),
    "/facility/:facilityId/locations/:locationId/eaushadhi/delivery/create": ({
      facilityId,
      locationId,
    }: {
      facilityId: string;
      locationId: string;
    }) => (
      <FacilityPageWrapper facilityId={facilityId}>
        <EAusdhadhiDeliveryCreate
          facilityId={facilityId}
          locationId={locationId}
        />
      </FacilityPageWrapper>
    ),

    "/facility/:facilityId/locations/:locationId/eaushadhi/delivery/:deliveryOrderId/edit":
      ({
        facilityId,
        locationId,
        deliveryOrderId,
      }: {
        facilityId: string;
        locationId: string;
        deliveryOrderId: string;
      }) => (
        <FacilityPageWrapper facilityId={facilityId}>
          <EAusdhadhiDeliveryEdit
            facilityId={facilityId}
            locationId={locationId}
            deliveryOrderId={deliveryOrderId}
          />
        </FacilityPageWrapper>
      ),

    "/facility/:facilityId/locations/:locationId/eaushadhi/delivery/:deliveryOrderId":
      ({
        facilityId,
        locationId,
        deliveryOrderId,
      }: {
        facilityId: string;
        locationId: string;
        deliveryOrderId: string;
      }) => (
        <FacilityPageWrapper facilityId={facilityId}>
          <EAusdhadhiDeliveryShow
            facilityId={facilityId}
            locationId={locationId}
            deliveryOrderId={deliveryOrderId}
            internal={false}
          />
        </FacilityPageWrapper>
      ),
    "/facility/:facilityId/locations/:locationId/eaushadhi/delivery/:deliveryOrderId/fetch-inward":
      ({
        facilityId,
        locationId,
        deliveryOrderId,
      }: {
        facilityId: string;
        locationId: string;
        deliveryOrderId: string;
      }) => (
        <FacilityPageWrapper facilityId={facilityId}>
          <EAusdhadhiInwardFetch
            facilityId={facilityId}
            locationId={locationId}
            deliveryOrderId={deliveryOrderId}
          />
        </FacilityPageWrapper>
      ),
  },
  navItems: [],
  adminNavItems: [
    {
      name: "eAushadhi",
      icon: <PillIcon className="care-svg-icon__baseline" />,
      children: [
        {
          name: "Institute Mappings",
          url: "/admin/eaushadhi/institute-mappings",
        },
        {
          name: "Product Mappings",
          url: "/admin/eaushadhi/product-mappings",
        },
      ],
    },
  ],
};

export default manifest;
