import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { navigate } from "raviger";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function navigateToDeliveryPrint(
  facilityId: string,
  locationId: string,
  deliveryId: string,
) {
  navigate(
    `/facility/${facilityId}/locations/${locationId}/inventory/external/deliveries/incoming/${deliveryId}/print`,
  );
}

/**
 * Converts date to DD/MM/YYYY format for eAushadhi API
 * Handles multiple input formats: YYYY-MM-DD, DD/MM/YYYY
 * @param date - Date string in various formats
 * @returns Date string in DD/MM/YYYY format
 */
export function formatDateForEaushadhiAPI(date: string): string {
  if (!date) return "";

  // If already in DD/MM/YYYY format, return as is
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    return date;
  }

  // If in YYYY-MM-DD format (ISO), convert to DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [yyyy, mm, dd] = date.split("-");
    return `${dd}/${mm}/${yyyy}`;
  }

  // Return as is if format is unknown
  return date;
}

/**
 * Converts date from YYYY-MM-DD to MM/DD/YYYY format for URL parameters
 * @param isoDate - Date string in YYYY-MM-DD format
 * @returns Date string in MM/DD/YYYY format
 */
export function formatDateForURL(isoDate: string): string {
  if (!isoDate) return "";
  const [yyyy, mm, dd] = isoDate.split("-");
  return `${mm}/${dd}/${yyyy}`;
}
