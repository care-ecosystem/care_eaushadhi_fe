import { lazy, Suspense } from "react";
import EAusdhadhiFetchPage from "./pages/EAusdhadhiFetchPage.tsx";
import DeliveryOrderShow from "./pages/DeliveryOrderShow.tsx";
import DeliveryOrderForm from "./pages/DeliveryOrderForm.tsx";
import DeliveryOrderFetch from "./pages/DeliveryOrderFetch.tsx";
import InstituteMappingAdmin from "./pages/InstituteMappingAdmin.tsx";
import React from "react";
import { TruckIcon } from "lucide-react";
import en from "../public/locale/en.json";

// Wrapper component for pages
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">eAushadhi Plugin Loading...</div>
      }
    >
      {children}
    </Suspense>
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
    "/facility/:facilityId/locations/:locationId/eaushadhi/fetch": ({
      facilityId,
      locationId,
    }: {
      facilityId: string;
      locationId: string;
    }) => (<PageWrapper>
      <EAusdhadhiFetchPage facilityId={facilityId} locationId={locationId} /></PageWrapper>
    ),

    "/facility/:facilityId/locations/:locationId/eaushadhi/:deliveryOrderId/edit":
      ({
        facilityId,
        locationId,
        deliveryOrderId,
      }: {
        facilityId: string;
        locationId: string;
        deliveryOrderId: string;
      }) => (
        <PageWrapper>
          <DeliveryOrderForm
            facilityId={facilityId}
            locationId={locationId}
            deliveryOrderId={deliveryOrderId}
          />
        </PageWrapper>
      ),

    "/facility/:facilityId/locations/:locationId/eaushadhi/:deliveryOrderId": ({
      facilityId,
      locationId,
      deliveryOrderId,
    }: {
      facilityId: string;
      locationId: string;
      deliveryOrderId: string;
    }) => (
      <PageWrapper>
        <DeliveryOrderShow
          facilityId={facilityId}
          locationId={locationId}
          deliveryOrderId={deliveryOrderId}
          internal={false}
        />
      </PageWrapper>
    ),
    "/facility/:facilityId/locations/:locationId/eaushadhi/fetch-new/:deliveryOrderId": ({
      facilityId,
      locationId,
      deliveryOrderId,
    }: {
      facilityId: string;
      locationId: string;
      deliveryOrderId: string;
    }) => (
      <PageWrapper>
        <DeliveryOrderFetch
          facilityId={facilityId}
          locationId={locationId}
          deliveryOrderId={deliveryOrderId}
        />
      </PageWrapper>
    ),
  },
  navItems: [],
  adminNavItems: [
    {
      url: "/admin/eaushadhi/institute-mappings",
      name: "eAushadhi Institute Mapping",
      icon: <TruckIcon />,
    },
  ]
};

export default manifest;