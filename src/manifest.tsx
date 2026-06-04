import { lazy } from "react";
import EAusdhadhiFetchPage from "./pages/EAusdhadhiFetchPage.tsx";
import DeliveryOrderShow from "./pages/DeliveryOrderShow.tsx";
import DeliveryOrderForm from "./pages/DeliveryOrderForm.tsx";
import DeliveryOrderFetch from "./pages/DeliveryOrderFetch.tsx";

const manifest = {
  plugin: "care_eaushadhi",
  extends: [],
  components: {
    DeliveryOrderActions: lazy(
      () => import("./components/pluggables/eAusdhadhiTriggerButton"),
    ),
  },
  routes: {
    "/facility/:facilityId/locations/:locationId/eaushadhi/fetch": ({
      facilityId,
      locationId,
    }: {
      facilityId: string;
      locationId: string;
    }) => (
      <EAusdhadhiFetchPage facilityId={facilityId} locationId={locationId} />
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
        <DeliveryOrderForm
          facilityId={facilityId}
          locationId={locationId}
          deliveryOrderId={deliveryOrderId}
        />
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
      <DeliveryOrderShow
        facilityId={facilityId}
        locationId={locationId}
        deliveryOrderId={deliveryOrderId}
        internal={false}
      />
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
      <DeliveryOrderFetch
        facilityId={facilityId}
        locationId={locationId}
        deliveryOrderId={deliveryOrderId} internal={false} />
    ),
  },

  navItems: [],
  adminNavItems: [],
};

export default manifest;
