import { lazy } from "react";
import EAusdhadhiFetchPage from "./pages/EAusdhadhiFetchPage.tsx";

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
  },
  navItems: [],
  adminNavItems: [],
};

export default manifest;