export type Department = string;

export type Gender = "Male" | "Female" | "Other";

export type FineStatus = "Paid" | "Pending" | "To Pay";

export type FineType =
  | "Not wearing ID"
  | "Late enrollment"
  | "Library fine"
  | "Laboratory damage"
  | "Dress code violation"
  | "Unauthorized absence"
  | "Property damage"
  | "Other";

export interface Student {
  id: string;
  student_id: string;
  name: string;
  age: number;
  gender: Gender;
  department: string;
  department_id: string | null;
  address: string | null;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Fine {
  id: string;
  student_id: string;
  fine_type: FineType;
  amount: number;
  balance: number;
  status: FineStatus;
  notes: string | null;
  proof_image?: string | null;
  payment_proof?: string | null;
  payment_proofs?: string[] | null;
  pending_payment?: number;
  voucher_used?: string | null;
  original_amount?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CSCOfficer {
  id: string;
  name: string;
  position: string;
  description: string | null;
  photo_url: string | null;
  display_order: number;
}
