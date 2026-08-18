import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { navigate } from "raviger";
import dayjs from "dayjs";

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


const DOSAGE_FORM_MAP: Record<string, string[]> = {
  tablet: ["tablet"],
  tablets: ["tablet"],
  capsule: ["capsule"],
  capsules: ["capsule"],
  injection: ["injection"],
  infusion: ["infusion"],
  suspension: ["suspension", "drop", "syrup"],
  syrup: ["syrup", "suspension", "drop"],
  cream: ["cream"],
  gel: ["gel"],
  ointment: ["ointment"],
  eye: ["eye"],
  drops: ["drop", "suspension"],
  powder: ["powder"],
  solution: ["solution"],
};

const FORM_MODIFIERS = [
  /powder\s+free/g,
  /latex\s+free/g,
  /preservative\s+free/g,
  /alcohol\s+free/g,
];

export function extractDosageFormFilter(drug_name: string): string[] | null {
  let name_lower = drug_name.toLowerCase();
  for (const modifier of FORM_MODIFIERS) {
    name_lower = name_lower.replace(modifier, "");
  }
  for (const [keyword, snomed_displays] of Object.entries(DOSAGE_FORM_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`).test(name_lower)) {
      return snomed_displays;
    }
  }
  return null;
}

const FORM_STOP = new Set([
  // dosage forms
  "tablet", "tablets", "capsule", "capsules", "injection", "infusion",
  "suspension", "syrup", "cream", "gel", "ointment", "eye", "ear",
  "oral", "drops", "powder", "solution", "for", "with",
  // patient / dose descriptors — not part of the drug substance name
  "pediatric", "paediatric", "neonatal", "adult", "forte", "junior",
]);

export function extractGenericName(drug_name: string): string {
  const words = drug_name.toLowerCase().split(/\s+/);
  const generic: string[] = [];
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, "");
    if (FORM_STOP.has(clean)) break;
    if (/^\d/.test(word)) break;
    if (clean) {
      const normalized = word[0].toUpperCase() + word.slice(1);
      generic.push(normalized);
    }
  }
  return generic.length > 0 ? generic.join(" ") : words[0];
}

export function formatDateTime(date: string | null | undefined, format = "DD/MM/YYYY"): string {
  if (!date) return "—";
  return dayjs(date).format(format);
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadProductMappingTemplate(): void {
  const headers = [
    "EAushadhi Drug ID",
    "EAushadhi Drug Name",
    "Product Knowledge Name",
    "Product Knowledge Slug",
  ];
  const sampleData = [
    ["6.6.19", "Cefotaxime Injection IP 1gm 1x1Vial", "Cefotaxime 1gm Injection", "cefotaxime-1gm-injection"],
    ["D00045", "Ibuprofen Oral Suspension IP 100mg/5ml 1x60ml bottle", "Ibuprofen 100mg/5ml Suspension", "ibuprofen-suspension"],
    ["D00046", "Aceclofenac Tablet 100 mg 1x1", "Aceclofenac 100mg Tablet", "aceclofenac-100mg"],
    ["D00146", "Carbamazepine Tablet IP 200 mg 1x1", "Carbamazepine 200mg Tablet", "carbamazepine-200mg"],
  ];

  const rows = [
    headers.map(h => `"${h}"`).join(","),
    ...sampleData.map(row => row.map(cell => `"${cell}"`).join(",")),
  ];
  const csv = rows.join("\n");
  downloadCsv("product_mapping_template.csv", csv);
}