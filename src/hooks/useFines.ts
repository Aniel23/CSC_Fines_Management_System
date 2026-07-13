import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Fine } from "@/types";

type FinesFilter = 'active' | 'archived' | 'binned' | 'all';

export function useFines(filter: FinesFilter = 'active') {
  const [fines, setFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFines = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("fines")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter === 'active') {
        query = query.is("deleted_at", null).eq("is_archived", false);
      } else if (filter === 'archived') {
        query = query.is("deleted_at", null).eq("is_archived", true);
      } else if (filter === 'binned') {
        query = query.not("deleted_at", "is", null);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setFines(data || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching fines:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch fines");
      setFines([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchFines();

    // Set up realtime subscription
    const channel = supabase
      .channel('fines-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fines'
        },
        () => {
          fetchFines();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFines, filter]);

  return { fines, loading, error, refetch: fetchFines };
}
