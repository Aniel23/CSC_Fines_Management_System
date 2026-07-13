import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Student } from "@/types";

export function useStudentProfile() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.studentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Try to fetch by ID (UUID) first
      let { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", user.studentId)
        .maybeSingle();

      if (error) throw error;

      // If not found by UUID, try by student_id (string) just in case
      if (!data) {
        const { data: altData, error: altError } = await supabase
          .from("students")
          .select("*")
          .eq("student_id", user.studentId)
          .maybeSingle();
        
        if (altError) throw altError;
        data = altData;
      }

      setStudent(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching student profile:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }, [user?.studentId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { student, loading, error, refetch: fetchProfile };
}
