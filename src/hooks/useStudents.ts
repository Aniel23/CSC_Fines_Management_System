import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeDepartmentKey } from "@/integrations/supabase/queries";
import type { Student } from "@/types";

export type StudentsFilter = 'active' | 'archived' | 'binned' | 'all';

export function useStudents(department?: string, filter: StudentsFilter = 'active') {
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

      if (filter === 'active') {
        query = query.is("deleted_at", null).eq("is_archived", false);
      } else if (filter === 'archived') {
        query = query.is("deleted_at", null).eq("is_archived", true);
      } else if (filter === 'binned') {
        query = query.not("deleted_at", "is", null);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const allStudents = (data || []) as Student[];
      const selectedDepartment = department?.trim();
      const filteredStudents = selectedDepartment
        ? allStudents.filter((student) => (student.department || '').trim().toLowerCase() === selectedDepartment.toLowerCase())
        : allStudents;

      setStudents(filteredStudents);
      setError(null);
    } catch (err) {
      console.error("Error fetching students:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch students");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [department, filter]);

  useEffect(() => {
    fetchStudents();

    const channel = supabase
      .channel('students-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students'
        },
        () => {
          fetchStudents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStudents, filter]);

  return { students, loading, error, refetch: fetchStudents };
}
