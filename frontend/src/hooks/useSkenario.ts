// hooks/useSkenario.ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSkenario, fetchTabCounts, setStatusRilis } from "@/api/skenario";
import type { SkenarioQuery } from "@/types/skenario";

export const useSkenarioList = (ownerId: string | undefined, q: SkenarioQuery) =>
  useQuery({
    queryKey: ["skenario", "list", ownerId, q],
    queryFn: () => fetchSkenario(ownerId!, q),
    enabled: !!ownerId,
    placeholderData: keepPreviousData,
  });

export const useTabCounts = (ownerId: string | undefined) =>
  useQuery({
    queryKey: ["skenario", "counts", ownerId],
    queryFn: () => fetchTabCounts(ownerId!),
    enabled: !!ownerId,
  });

export function useChangeStatus(ownerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      setStatusRilis(ownerId!, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skenario"] }),
  });
}