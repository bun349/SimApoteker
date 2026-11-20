// hooks/useCaseDetail.ts
import { useQuery } from "@tanstack/react-query";
import { fetchCaseDetail } from "@/api/cases";
import type { CaseMode } from "@/types/simulation";

export const useCaseDetail = (id: string | undefined, mode: CaseMode) =>
  useQuery({ queryKey: ["case", id, mode], queryFn: () => fetchCaseDetail(id!, mode), enabled: !!id });