import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/types";

export type StudentsFilter = 'active' | 'archived' | 'binned' | 'all';

/**
 * @param departmentId - UUID from departments.id. When provided, only students
 *   whose department_id FK matches are returned. Filtering is done server-side.
 * @param filter - Row visibility filter (active/archived/binned/all).
 */
export function useStudents(departmentId?: string, filter: StudentsFilter = 'active') {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("students")
        .select("*")
        .order("student_id");

      // Visibility filter
      if (filter === 'active') {
        query = query.is("deleted_at", null).eq("is_archived", false);
      } else if (filter === 'archived') {
        query = query.is("deleted_at", null).eq("is_archived", true);
      } else if (filter === 'binned') {
        query = query.not("deleted_at", "is", null);
      }

      // Department filter — exact FK match, pushed to DB (no client-side fuzzy logic)
      if (departmentId?.trim()) {
        query = query.eq("department_id", departmentId.trim());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setStudents((data || []) as Student[]);
      setError(null);
    } catch (err) {
      console.error("Error fetching students:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch students");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [departmentId, filter]);

  useEffect(() => {
    fetchStudents();

    const channel = supabase
      .channel('students-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => { fetchStudents(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchStudents, filter]);

  return { students, loading, error, refetch: fetchStudents };
}
