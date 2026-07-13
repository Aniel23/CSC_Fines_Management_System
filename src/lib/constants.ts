import { Gender, FineType } from "@/types";

export const DEFAULT_DEPARTMENTS = [
  "BSIS-1",
  "BSIS-2",
  "BSIS-3",
  "BSIS-4",
  "BPA-1",
  "BPA-2",
  "BPA-3",
  "BPA-4",
  "BTVTED-1",
  "BTVTED-2",
  "BTVTED-3",
  "BTVTED-4",
  "BTVTED-CHS-1",
  "BTVTED-CHS-2",
  "BTVTED-CHS-3",
  "BTVTED-CHS-4",
];

export const GENDERS: Gender[] = ["Male", "Female", "Other"];

export const FINE_TYPES: FineType[] = [
  "Not wearing ID",
  "Late enrollment",
  "Library fine",
  "Laboratory damage",
  "Dress code violation",
  "Unauthorized absence",
  "Property damage",
  "Other",
];

export const FINE_AMOUNTS: Record<FineType, number> = {
  "Not wearing ID": 50,
  "Late enrollment": 200,
  "Library fine": 100,
  "Laboratory damage": 500,
  "Dress code violation": 75,
  "Unauthorized absence": 150,
  "Property damage": 1000,
  "Other": 100,
};
