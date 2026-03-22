import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";

export interface Announcement {
  id: bigint;
  title: string;
  body: string;
  timestamp: bigint;
}

export function useGetLiveBalances() {
  const { actor, isFetching } = useActor();
  return useQuery<{ icp: bigint | null; bitty: bigint | null }>({
    queryKey: ["liveBalances"],
    queryFn: async () => {
      if (!actor) return { icp: null, bitty: null };
      const a = actor as any;
      const [icpRes, bittyRes] = await Promise.all([
        a.getLiveICPBalance ? a.getLiveICPBalance() : Promise.resolve([]),
        a.getLiveBITTYBalance ? a.getLiveBITTYBalance() : Promise.resolve([]),
      ]);
      return {
        icp: Array.isArray(icpRes) && icpRes.length > 0 ? icpRes[0] : null,
        bitty:
          Array.isArray(bittyRes) && bittyRes.length > 0 ? bittyRes[0] : null,
      };
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
    retry: 2,
  });
}

export function useGetManualBalances() {
  const { actor, isFetching } = useActor();
  return useQuery<{ icp: string; bitty: string }>({
    queryKey: ["manualBalances"],
    queryFn: async () => {
      if (!actor) return { icp: "0", bitty: "0" };
      const a = actor as any;
      if (!a.getManualBalances) return { icp: "0", bitty: "0" };
      return await a.getManualBalances();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useGetAnnouncements() {
  const { actor, isFetching } = useActor();
  return useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: async () => {
      if (!actor) return [];
      const a = actor as any;
      if (!a.getAnnouncements) return [];
      return await a.getAnnouncements();
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

export function useAdminLogin() {
  const { actor } = useActor();
  return useMutation<boolean, Error, { password: string }>({
    mutationFn: async ({ password }) => {
      if (!actor) throw new Error("No actor");
      const a = actor as any;
      if (!a.adminLogin) throw new Error("Not available");
      return await a.adminLogin(password);
    },
  });
}

export function useAddAnnouncement() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation<
    Announcement | null,
    Error,
    { password: string; title: string; body: string }
  >({
    mutationFn: async ({ password, title, body }) => {
      if (!actor) throw new Error("No actor");
      const a = actor as any;
      const res = await a.addAnnouncement(password, title, body);
      return Array.isArray(res) && res.length > 0 ? res[0] : null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useUpdateAnnouncement() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation<
    boolean,
    Error,
    { password: string; id: bigint; title: string; body: string }
  >({
    mutationFn: async ({ password, id, title, body }) => {
      if (!actor) throw new Error("No actor");
      const a = actor as any;
      return await a.updateAnnouncement(password, id, title, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useDeleteAnnouncement() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation<boolean, Error, { password: string; id: bigint }>({
    mutationFn: async ({ password, id }) => {
      if (!actor) throw new Error("No actor");
      const a = actor as any;
      return await a.deleteAnnouncement(password, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useSetManualBalances() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation<
    boolean,
    Error,
    { password: string; icp: string; bitty: string }
  >({
    mutationFn: async ({ password, icp, bitty }) => {
      if (!actor) throw new Error("No actor");
      const a = actor as any;
      return await a.setManualBalances(password, icp, bitty);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manualBalances"] }),
  });
}
