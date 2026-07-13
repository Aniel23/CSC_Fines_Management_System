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

export type TransactionsFilter = 'active' | 'archived' | 'binned' | 'all';

export function useTransactions(filter: TransactionsFilter = 'active') {
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("transactions")
        .select("*, fines(*, students(*))")
        .order("payment_date", { ascending: false });

      if (filter === 'active') {
        query = query.is("deleted_at", null).eq("is_archived", false);
      } else if (filter === 'archived') {
        query = query.is("deleted_at", null).eq("is_archived", true);
      } else if (filter === 'binned') {
        query = query.not("deleted_at", "is", null);
      }

      const { data, error: fetchError } = await query;

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
  }, [filter]);

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
  }, [fetchTransactions, filter]);

  return { transactions, loading, error, refetch: fetchTransactions };
}
