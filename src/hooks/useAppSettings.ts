import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppSettings = {
  admin_email?: string | null;
  payment_qr_url?: string | null;
  custom_fine_types?: string | null;
  voucher_codes?: string | null;
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("app_settings")
          .select("key, value");
        if (error) throw error;
        const map: Record<string, string> = {};
        for (const row of (data || []) as any[]) {
          map[row.key] = row.value;
        }
        setSettings({
          admin_email: map["admin_email"] || null,
          payment_qr_url: map["payment_qr_url"] || null,
          custom_fine_types: map["custom_fine_types"] || null,
          voucher_codes: map["voucher_codes"] || null,
        });
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const upsertSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value })
      .select()
      .maybeSingle();
    if (error) throw error;
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, loading, error, upsertSetting };
}
