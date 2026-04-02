import { Progress } from "@/components/ui/progress";
import { useActor } from "@/hooks/useActor";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Gift,
  Loader2,
  Trophy,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";

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

interface CustomProposal {
  id: bigint;
  title: string;
  description: string;
  voteType: { ICP: null } | { BITTYICP: null };
  options: string[];
  openTime: bigint;
  closeTime: bigint;
  isFinalized: boolean;
  totalVoteAmount: string;
}

interface CustomVoteResult {
  optionLabel: string;
  optionIndex: bigint;
  totalWeightedPct: bigint;
  voterCount: bigint;
}

function HistoryProposalCard({ proposal }: { proposal: CustomProposal }) {
  const { actor } = useActor();
  const [results, setResults] = useState<CustomVoteResult[]>([]);
  const [loading, setLoading] = useState(true);

  const now = BigInt(Date.now()) * BigInt(1_000_000);
  const isOpen = !proposal.isFinalized && proposal.closeTime > now;
  const isFinalized = proposal.isFinalized;
  const isDistributed = proposal.isFinalized && (proposal as any).distributed;

  const voteTypeBadge = "ICP" in proposal.voteType ? "$ICP" : "$BITTYICP";

  const statusColor = isOpen
    ? "border-green-500/60 text-green-400 bg-green-500/10"
    : isDistributed
      ? "border-purple-500/60 text-purple-400 bg-purple-500/10"
      : isFinalized
        ? "border-gray-500/60 text-gray-400 bg-gray-500/10"
        : "border-amber-500/60 text-amber-400 bg-amber-500/10";

  const statusLabel = isOpen
    ? "🟢 LIVE"
    : isDistributed
      ? "✓ DISTRIBUTED"
      : isFinalized
        ? "FINALIZED"
        : "CLOSED";

  const loadResults = useCallback(async () => {
    if (!actor) return;
    try {
      const r = await (actor as any).getCustomVoteResults(proposal.id);
      setResults(r as CustomVoteResult[]);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [actor, proposal.id]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const maxPct = results.reduce(
    (m, r) => Math.max(m, Number(r.totalWeightedPct)),
    0,
  );
  const totalVoters = results.reduce((s, r) => s + Number(r.voterCount), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-yellow-600/30 bg-black/50 backdrop-blur-sm overflow-hidden"
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${statusColor}`}
              >
                {statusLabel}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-yellow-600/50 text-yellow-400 bg-yellow-500/10 font-semibold">
                {voteTypeBadge}
              </span>
            </div>
            <h3 className="text-base font-bold text-white leading-snug">
              {proposal.title}
            </h3>
            {proposal.description && (
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {proposal.description}
              </p>
            )}
          </div>
        </div>

        {/* Time info */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {isFinalized ? (
            <span className="text-gray-500">Voting Closed</span>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{timeRemaining(proposal.closeTime)}</span>
            </>
          )}
          {proposal.totalVoteAmount && proposal.totalVoteAmount !== "0" && (
            <span className="ml-auto text-yellow-400 font-semibold">
              {formatE8sAmount(proposal.totalVoteAmount)} {voteTypeBadge}
            </span>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading results…
          </div>
        ) : results.length === 0 ? (
          <p className="text-sm text-gray-500">No votes cast yet.</p>
        ) : (
          <div className="space-y-2">
            {results.map((r) => {
              const pct = Number(r.totalWeightedPct);
              const isWinner = pct === maxPct && pct > 0;
              return (
                <div key={String(r.optionIndex)}>
                  <div className="flex justify-between text-xs mb-1">
                    <span
                      className={`font-medium ${isWinner && isFinalized ? "text-yellow-400" : "text-gray-300"}`}
                    >
                      {r.optionLabel}
                      {isWinner && isFinalized && (
                        <Trophy className="w-3 h-3 inline ml-1" />
                      )}
                    </span>
                    <span className="text-gray-400">
                      {pct.toFixed(1)}% · {String(r.voterCount)} voters
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
            <p className="text-xs text-gray-500 text-right">
              {totalVoters} total voters
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface CommunityHistoryPageProps {
  onBack: () => void;
}

export default function CommunityHistoryPage({
  onBack,
}: CommunityHistoryPageProps) {
  const { actor } = useActor();
  const [proposals, setProposals] = useState<CustomProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor) return;
    (async () => {
      try {
        const all = await (actor as any).getCustomProposals();
        const sorted = [...(all as CustomProposal[])].sort((a, b) =>
          b.openTime > a.openTime ? 1 : -1,
        );
        setProposals(sorted);
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
            <FileText className="w-10 h-10 text-yellow-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              COMMUNITY PROPOSAL HISTORY
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            All team and community proposals — newest first
          </p>
        </motion.div>

        {/* Proposal List */}
        {loading ? (
          <div
            data-ocid="history.loading_state"
            className="flex items-center justify-center py-16 gap-3 text-yellow-400"
          >
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading proposal history…</span>
          </div>
        ) : proposals.length === 0 ? (
          <div
            data-ocid="history.empty_state"
            className="text-center py-16 text-gray-500"
          >
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-semibold">No community proposals yet</p>
            <p className="text-sm mt-1">
              Admin-created proposals will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal, i) => (
              <motion.div
                key={String(proposal.id)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                data-ocid={`history.item.${i + 1}`}
              >
                <HistoryProposalCard proposal={proposal} />
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
