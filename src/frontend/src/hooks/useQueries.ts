import { getBITTYBalance, getICPBalance } from "@/utils/ledgerActors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { waitForActor } from "./actorCache";
import { useActor } from "./useActor";

const TREASURY_WALLET =
  "ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe";
const FUND_WALLET =
  "vqr3d-eby7o-fiwpf-pllu5-yzmxy-4ut67-gnxgr-nfiqw-c3ked-6arfu-zae";
const NEURON_ID = "9571697172598853748";
const GAMES_WALLET =
  "slfhp-cxr4u-mn53d-4tz4a-gn4ds-snqfa-tunfl-rfyxy-zjtho-iwksr-hqe";

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

const BITTYICP_CANISTER = "qroj6-lyaaa-aaaam-qeqta-cai";

async function fetchIcpUsd(): Promise<number | null> {
  // CoinGecko public API - first attempt
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd",
      { signal: AbortSignal.timeout(4000) },
    );
    if (res.ok) {
      const data = await res.json();
      const price = data["internet-computer"]?.usd;
      if (price) return Number.parseFloat(price) || null;
    }
  } catch {}
  // Fallback: Kraken
  try {
    const res = await fetch(
      "https://api.kraken.com/0/public/Ticker?pair=ICPUSD",
      { signal: AbortSignal.timeout(4000) },
    );
    if (res.ok) {
      const data = await res.json();
      const price = data?.result?.ICPUSD?.c?.[0];
      if (price) return Number.parseFloat(price) || null;
    }
  } catch {}
  // Fallback: Binance
  try {
    const res = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=ICPUSDT",
      { signal: AbortSignal.timeout(4000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.price) return Number.parseFloat(data.price) || null;
    }
  } catch {}
  return null;
}

async function fetchBittyUsd(): Promise<number | null> {
  // 1. ICPSwap specific token endpoint (small payload, fast)
  try {
    const res = await fetch(
      `https://api.icpswap.com/info/token/${BITTYICP_CANISTER}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (res.ok) {
      const data = await res.json();
      // Response might be { data: { priceUSD: "0.00000742" } } or similar
      const tokenData = data?.data ?? data;
      const price =
        tokenData?.priceUSD ??
        tokenData?.priceUsd ??
        tokenData?.price ??
        tokenData?.usdPrice;
      if (price !== undefined && price !== null) {
        const p = Number.parseFloat(String(price));
        if (p > 0) return p;
      }
    }
  } catch {}

  // 2. ICPSwap token/all with timeout (fallback, large payload)
  try {
    const res = await fetch("https://api.icpswap.com/info/token/all", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const tokens: any[] = data?.data ?? data ?? [];
      const token = Array.isArray(tokens)
        ? tokens.find(
            (t: any) =>
              t.address === BITTYICP_CANISTER ||
              t.canisterId === BITTYICP_CANISTER ||
              t.id === BITTYICP_CANISTER,
          )
        : null;
      if (token) {
        const price =
          token.priceUSD ?? token.priceUsd ?? token.price ?? token.usdPrice;
        if (price !== undefined && price !== null) {
          const p = Number.parseFloat(String(price));
          if (p > 0) return p;
        }
      }
    }
  } catch {}

  return null;
}

export function useTokenPrices() {
  return useQuery<{ icpUsd: number | null; bittyUsd: number | null }>({
    queryKey: ["tokenPrices"],
    queryFn: async () => {
      const [icpUsd, bittyUsd] = await Promise.all([
        fetchIcpUsd(),
        fetchBittyUsd(),
      ]);
      return { icpUsd, bittyUsd };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

export function useGetAdminConfig() {
  const { actor, isFetching } = useActor();
  return useQuery<{ neuronTopupAddress: string; gamesWallet: string }>({
    queryKey: ["adminConfig"],
    queryFn: async () => {
      if (!actor) return { neuronTopupAddress: "", gamesWallet: GAMES_WALLET };
      const a = actor as any;
      if (!a.getAdminConfig)
        return { neuronTopupAddress: "", gamesWallet: GAMES_WALLET };
      const config = await a.getAdminConfig();
      // Always use the hardcoded games wallet address
      return { ...config, gamesWallet: GAMES_WALLET };
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
