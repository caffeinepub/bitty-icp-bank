import { getBITTYBalance, getICPBalance } from "@/utils/ledgerActors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { waitForActor } from "./actorCache";
import { useActor } from "./useActor";

const TREASURY_WALLET =
  "ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe";
const FUND_WALLET =
  "vqr3d-eby7o-fiwpf-pllu5-yzmxy-4ut67-gnxgr-nfiqw-c3ked-6arfu-zae";
const NEURON_ID = "2927437143767212939";

export interface Announcement {
  id: bigint;
  title: string;
  body: string;
  timestamp: bigint;
}

export function useGetLiveBalances() {
  return useQuery<{ icp: bigint | null; bitty: bigint | null }>({
    queryKey: ["liveBalances"],
    queryFn: async () => {
      const [icp, bitty] = await Promise.all([
        getICPBalance(TREASURY_WALLET),
        getBITTYBalance(TREASURY_WALLET),
      ]);
      return { icp, bitty };
    },
    staleTime: 30_000,
    retry: 2,
  });
}

export function useGetFundBalance() {
  return useQuery<bigint | null>({
    queryKey: ["fundBalance"],
    queryFn: async () => {
      return await getBITTYBalance(FUND_WALLET);
    },
    staleTime: 30_000,
    retry: 2,
  });
}

export function useGetManualBalances() {
  const { actor, isFetching } = useActor();
  return useQuery<{
    icp: string;
    bitty: string;
    fund: string;
    bittyPriceUsd: string;
  }>({
    queryKey: ["manualBalances"],
    queryFn: async () => {
      if (!actor) return { icp: "", bitty: "", fund: "", bittyPriceUsd: "" };
      const a = actor as any;
      if (!a.getManualBalances)
        return { icp: "", bitty: "", fund: "", bittyPriceUsd: "" };
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
  return useMutation<boolean, Error, { password: string }>({
    mutationFn: async ({ password }) => {
      const a = (await waitForActor()) as any;
      if (!a.adminLogin) throw new Error("Not available");
      return await a.adminLogin(password);
    },
  });
}

export function useAddAnnouncement() {
  const qc = useQueryClient();
  return useMutation<
    Announcement | null,
    Error,
    { password: string; title: string; body: string; actor?: unknown }
  >({
    mutationFn: async ({ password, title, body, actor: pa }) => {
      const a = (pa ?? (await waitForActor())) as any;
      const res = await a.addAnnouncement(password, title, body);
      return Array.isArray(res) && res.length > 0 ? res[0] : null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation<
    boolean,
    Error,
    {
      password: string;
      id: bigint;
      title: string;
      body: string;
      actor?: unknown;
    }
  >({
    mutationFn: async ({ password, id, title, body, actor: pa }) => {
      const a = (pa ?? (await waitForActor())) as any;
      return await a.updateAnnouncement(password, id, title, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation<
    boolean,
    Error,
    { password: string; id: bigint; actor?: unknown }
  >({
    mutationFn: async ({ password, id, actor: pa }) => {
      const a = (pa ?? (await waitForActor())) as any;
      return await a.deleteAnnouncement(password, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useSetManualBalances() {
  const qc = useQueryClient();
  return useMutation<
    boolean,
    Error,
    { password: string; icp: string; bitty: string; actor?: unknown }
  >({
    mutationFn: async ({ password, icp, bitty, actor: pa }) => {
      const a = (pa ?? (await waitForActor())) as any;
      return await a.setManualBalances(password, icp, bitty);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manualBalances"] }),
  });
}

export function useSetManualFundBalance() {
  const qc = useQueryClient();
  return useMutation<
    boolean,
    Error,
    { password: string; fund: string; actor?: unknown }
  >({
    mutationFn: async ({ password, fund, actor: pa }) => {
      const a = (pa ?? (await waitForActor())) as any;
      return await a.setManualFundBalance(password, fund);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manualBalances"] }),
  });
}

export function useSetManualBittyPrice() {
  const qc = useQueryClient();
  return useMutation<
    boolean,
    Error,
    { password: string; price: string; actor?: unknown }
  >({
    mutationFn: async ({ password, price, actor: pa }) => {
      const a = (pa ?? (await waitForActor())) as any;
      if (!a.setManualBittyPrice)
        throw new Error("setManualBittyPrice not found on actor");
      const result = await a.setManualBittyPrice(password, price);
      if (result === false)
        throw new Error("Backend rejected — password mismatch.");
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manualBalances"] }),
  });
}

export function useGetNeuronStake() {
  return useQuery<number | null>({
    queryKey: ["neuronStake"],
    queryFn: async () => {
      try {
        const res = await fetch(
          `https://ic-api.internetcomputer.org/api/v3/neurons/${NEURON_ID}`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        const stakeE8s =
          data?.cached_neuron_stake_e8s ??
          data?.stake_e8s ??
          data?.neuron?.cached_neuron_stake_e8s ??
          null;
        if (stakeE8s === null) return null;
        return Number(stakeE8s) / 1e8;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: 2,
  });
}

export function useTokenPrices() {
  return useQuery<{ icpUsd: number | null; bittyUsd: number | null }>({
    queryKey: ["tokenPrices"],
    queryFn: async () => {
      try {
        const a = (await waitForActor()) as any;
        const [icpStr, bittyStr] = await Promise.all([
          a.getIcpUsdPrice ? a.getIcpUsdPrice() : Promise.resolve(""),
          a.getBittyUsdPrice ? a.getBittyUsdPrice() : Promise.resolve(""),
        ]);
        const icpUsd =
          icpStr && icpStr !== "" ? Number.parseFloat(icpStr) || null : null;
        const bittyUsd =
          bittyStr && bittyStr !== ""
            ? Number.parseFloat(bittyStr) || null
            : null;
        return { icpUsd, bittyUsd };
      } catch {
        return { icpUsd: null, bittyUsd: null };
      }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 2,
  });
}

export function useGetAdminConfig() {
  const { actor, isFetching } = useActor();
  return useQuery<{ neuronTopupAddress: string; gamesWallet: string }>({
    queryKey: ["adminConfig"],
    queryFn: async () => {
      if (!actor) return { neuronTopupAddress: "", gamesWallet: "" };
      const a = actor as any;
      if (!a.getAdminConfig) return { neuronTopupAddress: "", gamesWallet: "" };
      return await a.getAdminConfig();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useSetGamesWallet() {
  const qc = useQueryClient();
  return useMutation<
    boolean,
    Error,
    { password: string; addr: string; actor?: unknown }
  >({
    mutationFn: async ({ password, addr, actor: pa }) => {
      const a = (pa ?? (await waitForActor())) as any;
      return await a.setGamesWallet(password, addr);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminConfig"] }),
  });
}

export function useGetRewardsPools() {
  const { actor, isFetching } = useActor();
  return useQuery<any[]>({
    queryKey: ["rewardsPools"],
    queryFn: async () => {
      if (!actor) return [];
      const a = actor as any;
      if (!a.getRewardsPools) return [];
      return await a.getRewardsPools();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useMarkRewardsDistributed() {
  const qc = useQueryClient();
  return useMutation<
    boolean,
    Error,
    { password: string; voteId: bigint; actor?: unknown }
  >({
    mutationFn: async ({ password, voteId, actor: pa }) => {
      const a = (pa ?? (await waitForActor())) as any;
      return await a.markRewardsDistributed(password, voteId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rewardsPools"] }),
  });
}

export function useGetGamesWalletBalances(gamesWallet: string) {
  return useQuery<{ icp: bigint | null; bitty: bigint | null }>({
    queryKey: ["gamesWalletBalances", gamesWallet],
    queryFn: async () => {
      if (!gamesWallet.trim()) return { icp: null, bitty: null };
      const [icp, bitty] = await Promise.allSettled([
        getICPBalance(gamesWallet),
        getBITTYBalance(gamesWallet),
      ]);
      return {
        icp: icp.status === "fulfilled" ? icp.value : null,
        bitty: bitty.status === "fulfilled" ? bitty.value : null,
      };
    },
    enabled: !!gamesWallet.trim(),
    staleTime: 30_000,
    retry: 2,
  });
}

export function useGetVoteAllocations(voteId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<any[]>({
    queryKey: ["voteAllocations", voteId?.toString()],
    queryFn: async () => {
      if (!actor || voteId === null) return [];
      const a = actor as any;
      if (!a.getVoteAllocations) return [];
      return await a.getVoteAllocations(voteId);
    },
    enabled: !!actor && !isFetching && voteId !== null,
    staleTime: 30_000,
  });
}
