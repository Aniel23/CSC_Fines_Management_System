import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Fine, Student } from "@/types";

export interface TransactionWithDetails {
  id: string;
  fine_id: string | null;
  amount_paid: number;
  payment_date: string;
  notes: string | null;
  recorded_by: string | null;
  fines: (Fine & { students: Student | null }) | null;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("transactions")
        .select("*, fines(*, students(*))")
        .order("payment_date", { ascending: false });

      if (fetchError) throw fetchError;
      setTransactions(data || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch transactions");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();

    // Set up realtime subscription
    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions'
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTransactions]);

  return { transactions, loading, error, refetch: fetchTransactions };
}
