import { getBITTYBalance, getICPBalance } from "@/utils/ledgerActors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";

const TREASURY_WALLET =
  "ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe";
const FUND_WALLET =
  "vqr3d-eby7o-fiwpf-pllu5-yzmxy-4ut67-gnxgr-nfiqw-c3ked-6arfu-zae";
const NEURON_ID = "2927437143767212939";
const BITTYICP_CANISTER = "qroj6-lyaaa-aaaam-qeqta-cai";

export interface Announcement {
  id: bigint;
  title: string;
  body: string;
  timestamp: bigint;
}

// Fetch ICP and BITTYICP balances directly from ledger canisters (frontend agent)
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

// Fetch fund balance directly from BITTYICP ledger (frontend agent)
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
  return useQuery<{ icp: string; bitty: string; fund: string }>({
    queryKey: ["manualBalances"],
    queryFn: async () => {
      if (!actor) return { icp: "", bitty: "", fund: "" };
      const a = actor as any;
      if (!a.getManualBalances) return { icp: "", bitty: "", fund: "" };
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

export function useSetManualFundBalance() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation<boolean, Error, { password: string; fund: string }>({
    mutationFn: async ({ password, fund }) => {
      if (!actor) throw new Error("No actor");
      const a = actor as any;
      return await a.setManualFundBalance(password, fund);
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

// Fetch live token prices: ICP/USD from CoinGecko, BITTYICP/USD from ICPSwap
export function useTokenPrices() {
  return useQuery<{ icpUsd: number | null; bittyUsd: number | null }>({
    queryKey: ["tokenPrices"],
    queryFn: async () => {
      // Fetch ICP/USD price from CoinGecko
      let icpUsd: number | null = null;
      try {
        const cgRes = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd",
        );
        if (cgRes.ok) {
          const cgData = await cgRes.json();
          icpUsd = cgData?.["internet-computer"]?.usd ?? null;
        }
      } catch {
        icpUsd = null;
      }

      // Fetch BITTYICP price from ICPSwap info API
      let bittyUsd: number | null = null;
      try {
        const swapRes = await fetch(
          `https://info.icpswap.com/api/token/price?canisterId=${BITTYICP_CANISTER}`,
        );
        if (swapRes.ok) {
          const swapData = await swapRes.json();
          // ICPSwap returns price in USD directly
          const price =
            swapData?.data?.priceUSD ??
            swapData?.priceUSD ??
            swapData?.data?.price ??
            swapData?.price ??
            null;
          if (price !== null) {
            bittyUsd = Number(price);
          }
        }
      } catch {
        bittyUsd = null;
      }

      // Fallback: try ICPSwap v3 info endpoint
      if (bittyUsd === null) {
        try {
          const swapRes2 = await fetch(
            `https://api.icpswap.com/v3/token/price?canisterId=${BITTYICP_CANISTER}`,
          );
          if (swapRes2.ok) {
            const swapData2 = await swapRes2.json();
            const price =
              swapData2?.data?.priceUSD ??
              swapData2?.priceUSD ??
              swapData2?.data?.price ??
              swapData2?.price ??
              null;
            if (price !== null) {
              bittyUsd = Number(price);
            }
          }
        } catch {
          bittyUsd = null;
        }
      }

      // Last fallback: derive BITTYICP USD from ICPSwap pair ratio * ICP price
      if (bittyUsd === null && icpUsd !== null) {
        try {
          // Use ICPSwap's pool token price endpoint (ICP → BITTYICP)
          const pairRes = await fetch(
            `https://api.icpswap.com/v3/swap/pool/tokens?token0=ryjl3-tyaaa-aaaaa-aaaba-cai&token1=${BITTYICP_CANISTER}`,
          );
          if (pairRes.ok) {
            const pairData = await pairRes.json();
            // token1Price = BITTYICP per 1 ICP
            const bittyPerIcp =
              pairData?.data?.token1Price ?? pairData?.token1Price ?? null;
            if (bittyPerIcp !== null && Number(bittyPerIcp) > 0) {
              bittyUsd = icpUsd / Number(bittyPerIcp);
            }
          }
        } catch {
          bittyUsd = null;
        }
      }

      return { icpUsd, bittyUsd };
    },
    staleTime: 60_000,
    retry: 1,
  });
}
