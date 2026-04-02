import { useActor } from "@/hooks/useActor";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Gift,
  Loader2,
  Vote as VoteIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import type { MonthlyVote, VoteResult } from "./backend.d";

const E8S = 100_000_000;
function formatE8sAmount(raw: string | bigint, decimals = 4): string {
  const n =
    typeof raw === "bigint" ? Number(raw) : Number.parseFloat(raw as string);
  if (Number.isNaN(n)) return "0";
  return (n / E8S).toFixed(decimals).replace(/\.?0+$/, "") || "0";
}

function timeRemaining(endTime: bigint): string {
  const now = BigInt(Date.now()) * BigInt(1_000_000);
  if (endTime <= now) return "Ended";
  const diffMs = Number((endTime - now) / BigInt(1_000_000));
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

function getVoteOptions(vote: MonthlyVote): [string, string, string] {
  if ("ICP" in vote.voteType) {
    return [
      "BUY $BITTYICP & STORE IN TREASURY",
      "INVEST INTO NEURON",
      "HOLD FOR LATER VOTE",
    ];
  }
  return ["BURN $BITTYICP", "SEND TO GAMES/DEV WALLET", "HOLD FOR LATER VOTE"];
}

function getStatusInfo(vote: MonthlyVote): { label: string; color: string } {
  const now = BigInt(Date.now()) * BigInt(1_000_000);
  if (vote.isFinalized)
    return {
      label: "FINALIZED",
      color: "text-gray-300 border-gray-500 bg-gray-500/10",
    };
  if (now < vote.openTime)
    return {
      label: "UPCOMING",
      color: "text-blue-400 border-blue-400 bg-blue-500/10",
    };
  if (now > vote.closeTime)
    return {
      label: "CLOSED",
      color: "text-amber-400 border-amber-500 bg-amber-500/10",
    };
  return {
    label: "🟢 LIVE",
    color: "text-green-400 border-green-400 bg-green-500/10",
  };
}

function HistoryVoteCard({ vote }: { vote: MonthlyVote }) {
  const { actor } = useActor();
  const [results, setResults] = useState<VoteResult[]>([]);
  const [loading, setLoading] = useState(true);

  const isICP = "ICP" in vote.voteType;
  const status = getStatusInfo(vote);
  const now = BigInt(Date.now()) * BigInt(1_000_000);
  const isLive =
    now >= vote.openTime && now <= vote.closeTime && !vote.isFinalized;

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthLabel = `${monthNames[(Number(vote.month) - 1) % 12] ?? Number(vote.month)} ${Number(vote.year)}`;

  const loadResults = useCallback(async () => {
    if (!actor) return;
    try {
      const r = await (actor as any).getVoteResults(vote.id);
      setResults(r);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [actor, vote.id]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-yellow-600/30 bg-black/50 backdrop-blur-sm overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-yellow-600/15 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{isICP ? "⚡" : "🔥"}</span>
            <h3 className="text-base font-bold text-yellow-300">
              {isICP ? "$ICP Treasury Vote" : "$BITTYICP Treasury Vote"}
            </h3>
          </div>
          <p className="text-xs text-gray-400">
            {monthLabel} · {isICP ? "Last day of month" : "15th of month"}
          </p>
          {vote.totalVoteAmount && vote.totalVoteAmount !== "0" && (
            <p className="text-xs text-yellow-500 mt-0.5">
              Voted on: {formatE8sAmount(vote.totalVoteAmount)}{" "}
              {isICP ? "ICP" : "BITTYICP"}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`text-xs font-bold border px-2 py-0.5 rounded-full ${status.color}`}
          >
            {status.label}
          </span>
          {isLive && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeRemaining(vote.closeTime)}
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading results…
          </div>
        ) : results.length === 0 ? (
          <p className="text-sm text-gray-500">No votes cast yet.</p>
        ) : (
          <div className="space-y-3">
            {results.map((r, i) => {
              const pct = Number(r.totalWeightedPct);
              const voters = Number(r.voterCount);
              const barColors = [
                "bg-yellow-500",
                "bg-amber-500",
                "bg-orange-500",
              ];
              const optionLabels = getVoteOptions(vote);
              return (
                <div key={r.optionLabel ?? i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300 font-medium truncate max-w-[60%]">
                      {r.optionLabel || optionLabels[i]}
                    </span>
                    <span className="text-yellow-300 font-bold">
                      {pct.toFixed(1)}% · {voters} voter
                      {voters !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${barColors[i % barColors.length]}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface ScheduledHistoryPageProps {
  onBack: () => void;
}

export default function ScheduledHistoryPage({
  onBack,
}: ScheduledHistoryPageProps) {
  const { actor } = useActor();
  const [votes, setVotes] = useState<MonthlyVote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor) return;
    (async () => {
      try {
        const all = await (actor as any).getAllVotes();
        const sorted = [...(all as MonthlyVote[])].sort((a, b) =>
          b.openTime > a.openTime ? 1 : -1,
        );
        setVotes(sorted);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [actor]);

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          "linear-gradient(135deg, #0a0f1e 0%, #0d1635 50%, #0a0f1e 100%)",
      }}
    >
      <Toaster richColors position="top-right" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <button
            type="button"
            data-ocid="nav.link"
            onClick={onBack}
            className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK TO GOVERNANCE
          </button>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <img
              src="/assets/img_4570-019d364f-b05b-7469-b9d0-e8428c9ccfeb.jpeg"
              alt="BITTYICP coin"
              className="w-14 h-14 rounded-full object-cover coin-spin"
            />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              SCHEDULED VOTE HISTORY
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            All scheduled monthly treasury votes — newest first
          </p>
        </motion.div>

        {/* Vote List */}
        {loading ? (
          <div
            data-ocid="history.loading_state"
            className="flex items-center justify-center py-16 gap-3 text-yellow-400"
          >
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading vote history…</span>
          </div>
        ) : votes.length === 0 ? (
          <div
            data-ocid="history.empty_state"
            className="text-center py-16 text-gray-500"
          >
            <VoteIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-semibold">No scheduled votes yet</p>
            <p className="text-sm mt-1">
              Monthly votes will appear here once created.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {votes.map((vote, i) => (
              <motion.div
                key={String(vote.id)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                data-ocid={`history.item.${i + 1}`}
              >
                <HistoryVoteCard vote={vote} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pb-6 pt-4">
          <a
            href="https://bittyonicp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 font-bold text-lg hover:text-yellow-300 transition-colors"
          >
            BITTYONICP.COM
          </a>
        </div>
      </div>
    </div>
  );
}
