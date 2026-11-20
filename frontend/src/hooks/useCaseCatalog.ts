import { useQuery } from "@tanstack/react-query";
import { fetchCaseCatalog } from "@/api/cases";
import type { CaseMode } from "@/types/simulation";

export const useCaseCatalog = (mode: CaseMode) =>
  useQuery({ queryKey: ["catalog", mode], queryFn: () => fetchCaseCatalog(mode) });