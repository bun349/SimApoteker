import { useQuery } from "@tanstack/react-query";
import { isKodeAvailable } from "@/api/wizard";
import { useDebounce } from "@/hooks/useDebounce";
import { KODE_RE } from "@/lib/wizard";

export type KodeStatus = "empty" | "format" | "checking" | "taken" | "ok" | "error";

export function useKodeAvailability(kode: string, excludeId?: string): KodeStatus {
  const debounced = useDebounce(kode, 400);
  const q = useQuery({
    queryKey: ["skenario", "kode", debounced, excludeId ?? null],
    queryFn: () => isKodeAvailable(debounced, excludeId),
    enabled: KODE_RE.test(debounced),
  });

  if (!kode) return "empty";
  if (!KODE_RE.test(kode)) return "format";
  if (debounced !== kode) return "checking";
  if (q.isError) return "error";
  if (q.data === undefined) return "checking";
  return q.data ? "ok" : "taken";
}