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
      setStudent(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // user.studentId is the UUID stored in user_roles.student_id.
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", user.studentId)
        .maybeSingle();

      if (error) throw error;

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
