import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { navigate } from "raviger";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function navigateToDeliveryPrint(
  facilityId: string,
  locationId: string,
  deliveryId: string
) {
  navigate(
    `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/incoming/${deliveryId}/print`
  );
}
