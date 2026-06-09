import { lazy, Suspense } from "react";
import EAusdhadhiDeliveryCreate from "./pages/EAusdhadhiDeliveryCreate.tsx";
import EAusdhadhiDeliveryShow from "./pages/EAusdhadhiDeliveryShow.tsx";
import EAusdhadhiDeliveryEdit from "./pages/EAusdhadhiDeliveryEdit.tsx";
import EAusdhadhiInwardFetch from "./pages/EAusdhadhiInwardFetch.tsx";
import InstituteMappingAdmin from "./pages/InstituteMappingAdmin.tsx";
import { InstituteMappingProvider } from "./contexts/InstituteMappingContext.tsx";
import React from "react";
import { TruckIcon } from "lucide-react";
import en from "../public/locale/en.json";

// Wrapper component for pages
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          eAushadhi Plugin Loading...
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
      url: "/admin/eaushadhi/institute-mappings",
      name: "eAushadhi Institute Mapping",
      icon: <TruckIcon />,
    },
  ],
};

export default manifest;
