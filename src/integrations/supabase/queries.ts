import { supabase } from "./client";
import type { Database } from "./types";

// Student queries
export async function getStudents() {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getStudentById(id: string) {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getStudentByStudentId(studentId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getStudentsByStudentId(studentId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createStudent(
  student: Database["public"]["Tables"]["students"]["Insert"]
) {
  const { data, error } = await supabase
    .from("students")
    .insert([student])
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateStudent(
  id: string,
  updates: Database["public"]["Tables"]["students"]["Update"]
) {
  const { data, error } = await supabase
    .from("students")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteStudent(id: string) {
  const { error } = await supabase.rpc('delete_student_with_auth', {
    p_student_id: id
  });

  if (error) throw error;
}

export async function binStudent(id: string) {
  const { error } = await supabase
    .from("students")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function restoreStudent(id: string) {
  const { error } = await supabase
    .from("students")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw error;
}

export async function archiveStudent(id: string) {
  const { error } = await supabase
    .from("students")
    .update({ is_archived: true })
    .eq("id", id);

  if (error) throw error;
}

export async function unarchiveStudent(id: string) {
  const { error } = await supabase
    .from("students")
    .update({ is_archived: false })
    .eq("id", id);

  if (error) throw error;
}

// Fine queries
export async function getFines() {
  const { data, error } = await supabase
    .from("fines")
    .select("*, students(name, student_id)")
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getFinesByStudentId(studentId: string) {
  const { data, error } = await supabase
    .from("fines")
    .select("*")
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createFine(
  fine: Database["public"]["Tables"]["fines"]["Insert"]
) {
  console.log("Creating fine via query:", fine);
  const { data, error } = await supabase
    .from("fines")
    .insert([fine])
    .select();

  if (error) {
    console.error("Supabase createFine error:", error);
    throw error;
  }
  return data?.[0] || null;
}

export async function updateFine(
  id: string,
  updates: Database["public"]["Tables"]["fines"]["Update"]
) {
  console.log("Updating fine via query:", id, updates);
  const { data, error } = await supabase
    .from("fines")
    .update(updates)
    .eq("id", id)
    .select();

  if (error) {
    console.error("Supabase updateFine error:", error);
    throw error;
  }
  return data?.[0] || null;
}

export async function deleteFine(id: string) {
  // Always soft-delete fines to preserve any associated transactions.
  // This avoids removing the fine record entirely when it is referenced by payments.
  const { error } = await supabase
    .from("fines")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function binFine(id: string) {
  const { error } = await supabase
    .from("fines")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function restoreFine(id: string) {
  const { error } = await supabase
    .from("fines")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw error;
}

export async function archiveFine(id: string) {
  const { error } = await supabase
    .from("fines")
    .update({ is_archived: true })
    .eq("id", id);

  if (error) throw error;
}

export async function unarchiveFine(id: string) {
  const { error } = await supabase
    .from("fines")
    .update({ is_archived: false })
    .eq("id", id);

  if (error) throw error;
}

// Transaction queries
export async function getTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, fines(*, students(name, student_id))")
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("payment_date", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createTransaction(
  transaction: Database["public"]["Tables"]["transactions"]["Insert"]
) {
  const { data, error } = await supabase
    .from("transactions")
    .insert([transaction])
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function binTransaction(id: string) {
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function restoreTransaction(id: string) {
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw error;
}

export async function archiveTransaction(id: string) {
  const { error } = await supabase
    .from("transactions")
    .update({ is_archived: true })
    .eq("id", id);

  if (error) throw error;
}

export async function unarchiveTransaction(id: string) {
  const { error } = await supabase
    .from("transactions")
    .update({ is_archived: false })
    .eq("id", id);

  if (error) throw error;
}

// User role queries
export async function getUserRole(userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createUserRole(
  userRole: Database["public"]["Tables"]["user_roles"]["Insert"]
) {
  const { data, error } = await supabase
    .from("user_roles")
    .insert([userRole])
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateUserRole(
  id: string,
  updates: Database["public"]["Tables"]["user_roles"]["Update"]
) {
  const { data, error } = await supabase
    .from("user_roles")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// CSC Officers queries
export async function getCSCOfficers() {
  const { data, error } = await supabase
    .from("csc_officers")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createCSCOfficer(
  officer: Database["public"]["Tables"]["csc_officers"]["Insert"]
) {
  const { data, error } = await supabase
    .from("csc_officers")
    .insert([officer])
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateCSCOfficer(
  id: string,
  updates: Database["public"]["Tables"]["csc_officers"]["Update"]
) {
  const { data, error } = await supabase
    .from("csc_officers")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteCSCOfficer(id: string) {
  const { error } = await supabase.from("csc_officers").delete().eq("id", id);

  if (error) throw error;
}

export function normalizeDepartmentKey(value: string | null | undefined) {
  if (!value) return "";

  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

  if (cleaned.includes("BSIS")) return "BSIS";
  if (cleaned.includes("BPA")) return "BPA";
  if (cleaned.includes("BTVTED")) return "BTVTED";

  return cleaned || value.trim();
}

export function departmentMatches(departmentValue: string | null | undefined, targetDepartment: string | null | undefined) {
  if (!departmentValue || !targetDepartment) return false;

  return normalizeDepartmentKey(departmentValue) === normalizeDepartmentKey(targetDepartment);
}

// Department queries
export async function getUniqueStudentDepartments() {
  const { data, error } = await supabase
    .from("students")
    .select("department");

  if (error) throw error;

  const uniqueDepts = Array.from(new Set((data || []).map((s) => s.department)))
    .filter(Boolean)
    .sort();

  return uniqueDepts;
}

export async function getDepartments() {
  const { data: departments, error: deptError } = await supabase
    .from("departments" as any)
    .select("*")
    .order("name", { ascending: true });

  if (deptError) throw deptError;

  const { data: allStudents, error: studentError } = await supabase
    .from("students")
    .select("department")
    .is("deleted_at", null)
    .eq("is_archived", false);

  if (studentError) throw studentError;

  const departmentCounts = new Map<string, number>();
  for (const student of allStudents || []) {
    const key = (student.department || '').trim();
    if (!key) continue;
    departmentCounts.set(key, (departmentCounts.get(key) || 0) + 1);
  }

  const departmentsWithCounts = (departments || []).map((dept: any) => {
    const deptKey = (dept.name || '').trim();
    return {
      ...dept,
      student_count: departmentCounts.get(deptKey) || 0
    };
  });

  return departmentsWithCounts;
}

export async function getDepartmentById(id: string) {
  const { data, error } = await supabase
    .from("departments" as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createDepartment(
  department: any
) {
  const { data, error } = await supabase
    .from("departments" as any)
    .insert([department])
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateDepartment(
  id: string,
  updates: any
) {
  const { data, error } = await supabase
    .from("departments" as any)
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteDepartment(id: string) {
  const { error } = await supabase.from("departments" as any).delete().eq("id", id);

  if (error) throw error;
}
