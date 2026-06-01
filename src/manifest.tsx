import { lazy } from "react";
import EAusdhadhiFetchPage from "./pages/EAusdhadhiFetchPage.tsx";
import DeliveryOrderShow from "./pages/DeliveryOrderShow.tsx";

const manifest = {
  plugin: "care_eaushadhi",
  extends: [],
  components: {
    DeliveryOrderListActions: lazy(
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
      <EAusdhadhiFetchPage
        facilityId={facilityId}
        locationId={locationId}
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
      />
    ),
  },

  navItems: [],
  adminNavItems: [],
};

export default manifest;