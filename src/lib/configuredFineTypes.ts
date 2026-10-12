export interface ConfiguredFineType {
  name: string;
  amount: number;
}

/** Parse the violation list managed in the admin profile. */
export function parseConfiguredFineTypes(value?: string | null): ConfiguredFineType[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    return parsed.reduce<ConfiguredFineType[]>((types, item) => {
      if (!item || typeof item !== "object") return types;

      const candidate = item as { name?: unknown; amount?: unknown };
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const amount = Number(candidate.amount);
      const normalizedName = name.toLocaleLowerCase();

      if (!name || !Number.isFinite(amount) || amount <= 0 || seen.has(normalizedName)) {
        return types;
      }

      seen.add(normalizedName);
      types.push({ name, amount });
      return types;
    }, []);
  } catch {
    return [];
  }
}
