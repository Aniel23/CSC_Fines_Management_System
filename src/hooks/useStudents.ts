import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/types";

export type StudentsFilter = 'active' | 'archived' | 'binned' | 'all';

export function useStudents(department?: string, filter: StudentsFilter = 'active') {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const withTimeout = async <T,>(promise: Promise<T>, ms = 15000, message = "Request timed out") => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
      const result = await Promise.race([promise as Promise<T>, timeout]);
      if (timeoutId) clearTimeout(timeoutId);
      return result as T;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    }
  };

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("students")
        .select("*")
        .order("student_id");

      // Add department filter if selected
      if (department) {
        query = query.eq("department", department);
      }

      if (filter === 'active') {
        query = query.is("deleted_at", null).eq("is_archived", false);
      } else if (filter === 'archived') {
        query = query.is("deleted_at", null).eq("is_archived", true);
      } else if (filter === 'binned') {
        query = query.not("deleted_at", "is", null);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setStudents(data || []);
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

    // Set up realtime subscription
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
