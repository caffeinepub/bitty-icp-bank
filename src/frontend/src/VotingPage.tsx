import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import {
  useGetRewardsPools,
  useGetVoteAllocations,
  useMarkRewardsDistributed,
} from "@/hooks/useQueries";
import { getBITTYBalance } from "@/utils/ledgerActors";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Gift,
  HelpCircle,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  Send,
  ShieldCheck,
  Trophy,
  Vote as VoteIcon,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import type { MonthlyVote, RewardsPoolEntry, VoteResult } from "./backend.d";
import { loadConfig } from "./config";

// ─── Types ───────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    ic?: {
      plug?: {
        requestConnect: (opts?: { whitelist?: string[] }) => Promise<boolean>;
        agent?: { getPrincipal: () => Promise<{ toString: () => string }> };
        isConnected: () => Promise<boolean>;
        disconnect: () => Promise<void>;
      };
    };
  }
}

interface ChatMsg {
  id: bigint;
  voteId: bigint;
  author: string;
  message: string;
  timestamp: bigint;
}

interface VotingPageProps {
  onBack: () => void;
  isAdmin: boolean;
  adminPassword: string;
}

interface SplitAllocation {
  pctA: number;
  pctB: number;
  pctC: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts / BigInt(1_000_000));
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getVoteStatusInfo(vote: MonthlyVote): {
  label: string;
  color: string;
} {
  const now = BigInt(Date.now()) * BigInt(1_000_000);
  if (vote.isFinalized)
    return { label: "FINALIZED", color: "text-purple-400 border-purple-400" };
  if (now < vote.openTime)
    return { label: "UPCOMING", color: "text-blue-400 border-blue-400" };
  if (now > vote.closeTime)
    return { label: "CLOSED", color: "text-red-400 border-red-400" };
  return { label: "OPEN", color: "text-green-400 border-green-400" };
}

function isVoteOpen(vote: MonthlyVote): boolean {
  const now = BigInt(Date.now()) * BigInt(1_000_000);
  return now >= vote.openTime && now <= vote.closeTime && !vote.isFinalized;
}

// ─── HowItWorks ──────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const [open, setOpen] = useState(false);
  const items = [
    {
      icon: "🪙",
      title: "Minimum 1,000 $BITTYICP required",
      desc: "You must hold at least 1,000 $BITTYICP to vote. This ensures only genuine community members participate.",
    },
    {
      icon: "⚡",
      title: "Voting Power = BITTYICP ÷ 1,000",
      desc: "Every 1,000 $BITTYICP gives you 1 vote. Hold 10,000? You have 10 votes. More tokens = more influence.",
    },
    {
      icon: "🎚️",
      title: "Split your 100% across options",
      desc: "Instead of picking one option, you allocate percentages across all three choices totalling exactly 100%. E.g. 60% Option A, 30% Option B, 10% Option C.",
    },
    {
      icon: "📅",
      title: "Two monthly votes",
      desc: "$BITTYICP vote opens on the 15th of each month. $ICP vote opens on the last day. Both run for 7 days.",
    },
    {
      icon: "🏆",
      title: "Rewards pool from the losing option",
      desc: "After voting closes, the lowest-voted option's percentage goes into a rewards pool. Admin distributes it proportionally to all voters based on their voting power.",
    },
    {
      icon: "🔐",
      title: "Sign in to prove wallet ownership",
      desc: "Connect with Internet Identity or Plug Wallet. Your principal is read automatically — no pasting needed.",
    },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-yellow-600/30 bg-black/40 backdrop-blur-sm overflow-hidden"
    >
      <button
        type="button"
        data-ocid="how_it_works.toggle"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold text-yellow-300">
            How Voting Works
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-yellow-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-yellow-400" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 pb-6 grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item.title}
                  className="flex gap-3 p-3 rounded-xl bg-white/5 border border-yellow-600/20"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-yellow-300">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── ChatSection ─────────────────────────────────────────────────────────────

function ChatSection({
  voteId,
  principal,
  actor,
}: {
  voteId: bigint;
  principal: string | null;
  actor: any;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!actor) return;
    try {
      const msgs = await actor.getChatMessages(voteId);
      setMessages(msgs as ChatMsg[]);
    } catch {}
  }, [actor, voteId]);

  useEffect(() => {
    if (!open) return;
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [open, loadMessages]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function sendMessage() {
    if (!text.trim() || !principal || !actor) return;
    setSending(true);
    try {
      await actor.addChatMessage(voteId, principal, text.trim());
      setText("");
      await loadMessages();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 border-t border-yellow-600/20 pt-4">
      <button
        type="button"
        data-ocid="chat.toggle"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 text-sm font-medium transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        Community Chat
        {open ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div
              className="mt-3 bg-black/30 rounded-xl border border-yellow-600/20 flex flex-col"
              style={{ maxHeight: 280 }}
            >
              <div
                className="flex-1 overflow-y-auto p-3 space-y-2"
                style={{ minHeight: 100 }}
              >
                {messages.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No messages yet. Be the first!
                  </p>
                )}
                {messages.map((m) => (
                  <div key={String(m.id)} className="flex gap-2">
                    <div className="flex-1">
                      <span className="text-yellow-400 text-xs font-mono">
                        {m.author.slice(0, 8)}…
                      </span>
                      <span className="text-gray-500 text-xs ml-2">
                        {formatTimestamp(m.timestamp)}
                      </span>
                      <p className="text-gray-200 text-sm">{m.message}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              {principal ? (
                <div className="flex gap-2 p-2 border-t border-yellow-600/20">
                  <Textarea
                    data-ocid="chat.textarea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Say something..."
                    className="text-sm resize-none bg-black/40 border-yellow-600/30 text-gray-200 placeholder-gray-600 min-h-0 h-9 py-1.5"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button
                    data-ocid="chat.submit_button"
                    size="sm"
                    onClick={sendMessage}
                    disabled={sending || !text.trim()}
                    className="bg-yellow-600 hover:bg-yellow-500 text-black h-9 px-3"
                  >
                    {sending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-2">
                  Sign in to chat
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SplitVotingUI ───────────────────────────────────────────────────────────

function SplitVotingUI({
  options,
  onSubmit,
  submitting,
}: {
  options: [string, string, string];
  onSubmit: (alloc: SplitAllocation) => void;
  submitting: boolean;
}) {
  const [pctA, setPctA] = useState(34);
  const [pctB, setPctB] = useState(33);
  const [pctC, setPctC] = useState(33);

  const total = pctA + pctB + pctC;
  const remaining = 100 - total;
  const isValid = total === 100;

  function handleA(val: number) {
    const newA = Math.min(100, Math.max(0, val));
    let newB = pctB;
    let newC = pctC;
    const slack = 100 - newA;
    if (newB + newC > slack) {
      const excess = newB + newC - slack;
      newC = Math.max(0, newC - excess);
      if (newB + newC > slack) newB = Math.max(0, slack - newC);
    }
    setPctA(newA);
    setPctB(newB);
    setPctC(newC);
  }

  function handleB(val: number) {
    const newB = Math.min(100, Math.max(0, val));
    let newA = pctA;
    let newC = pctC;
    const slack = 100 - newB;
    if (newA + newC > slack) {
      const excess = newA + newC - slack;
      newC = Math.max(0, newC - excess);
      if (newA + newC > slack) newA = Math.max(0, slack - newC);
    }
    setPctB(newB);
    setPctA(newA);
    setPctC(newC);
  }

  function handleC(val: number) {
    const newC = Math.min(100, Math.max(0, val));
    let newA = pctA;
    let newB = pctB;
    const slack = 100 - newC;
    if (newA + newB > slack) {
      const excess = newA + newB - slack;
      newB = Math.max(0, newB - excess);
      if (newA + newB > slack) newA = Math.max(0, slack - newB);
    }
    setPctC(newC);
    setPctA(newA);
    setPctB(newB);
  }

  const sliders = [
    {
      label: options[0],
      pct: pctA,
      onChange: handleA,
      color: "from-yellow-500 to-yellow-400",
    },
    {
      label: options[1],
      pct: pctB,
      onChange: handleB,
      color: "from-amber-500 to-amber-400",
    },
    {
      label: options[2],
      pct: pctC,
      onChange: handleC,
      color: "from-orange-500 to-orange-400",
    },
  ];

  return (
    <div className="space-y-4">
      {sliders.map((s) => (
        <div key={s.label}>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-yellow-300 font-medium truncate max-w-[70%]">
              {s.label}
            </span>
            <span className="text-sm font-bold text-white">{s.pct}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[s.pct]}
            onValueChange={([v]) => s.onChange(v)}
            className="cursor-pointer"
          />
          <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-white/10">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${s.color} transition-all`}
              style={{ width: `${s.pct}%` }}
            />
          </div>
        </div>
      ))}

      <div
        className={`flex items-center justify-between px-3 py-2 rounded-lg border ${isValid ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}`}
      >
        <span className="text-sm">Total allocated</span>
        <span
          className={`font-bold text-lg ${isValid ? "text-green-400" : "text-red-400"}`}
        >
          {total}%
        </span>
      </div>
      {!isValid && (
        <p className="text-xs text-red-400 text-center">
          {remaining > 0
            ? `${remaining}% remaining to allocate`
            : `Over by ${-remaining}% — adjust sliders`}
        </p>
      )}

      <Button
        data-ocid="vote.submit_button"
        className="w-full bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 text-black font-bold py-3 disabled:opacity-50"
        disabled={!isValid || submitting}
        onClick={() => onSubmit({ pctA, pctB, pctC })}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Submitting…
          </>
        ) : (
          <>
            <VoteIcon className="w-4 h-4 mr-2" />
            Submit Vote
          </>
        )}
      </Button>
    </div>
  );
}

// ─── VoteCard ────────────────────────────────────────────────────────────────

function VoteCard({
  vote,
  principal,
  votingPower,
  actor,
  isAdmin,
  adminPassword,
}: {
  vote: MonthlyVote;
  principal: string | null;
  votingPower: number;
  actor: any;
  isAdmin: boolean;
  adminPassword: string;
}) {
  const isICP = "ICP" in vote.voteType;
  const options = getVoteOptions(vote);
  const status = getVoteStatusInfo(vote);
  const open = isVoteOpen(vote);

  const [results, setResults] = useState<VoteResult[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [myAllocation, setMyAllocation] = useState<{
    pctA: number;
    pctB: number;
    pctC: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingResults, setLoadingResults] = useState(true);
  const [voteAmountInput, setVoteAmountInput] = useState("");
  const [savingAmount, setSavingAmount] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const loadData = useCallback(async () => {
    if (!actor) return;
    try {
      const [res, voted] = await Promise.all([
        actor.getVoteResults(vote.id),
        principal
          ? actor.hasVotedOnVote(vote.id, principal)
          : Promise.resolve(false),
      ]);
      setResults(res);
      setHasVoted(voted);
      if (voted && principal) {
        const allocs = await actor.getVoteAllocations(vote.id);
        const mine = allocs.find((a) => a.voterPrincipal === principal);
        if (mine) {
          setMyAllocation({
            pctA: Number(mine.pctA),
            pctB: Number(mine.pctB),
            pctC: Number(mine.pctC),
          });
        }
      }
    } catch {
    } finally {
      setLoadingResults(false);
    }
  }, [actor, vote.id, principal]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function submitVote(alloc: SplitAllocation) {
    if (!principal || !actor) return;
    if (votingPower < 1) {
      toast.error("You need at least 1,000 $BITTYICP to vote.");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await actor.castSplitVote(
        vote.id,
        principal,
        BigInt(alloc.pctA),
        BigInt(alloc.pctB),
        BigInt(alloc.pctC),
        BigInt(votingPower),
      );
      if (ok) {
        toast.success("Vote submitted!");
        setHasVoted(true);
        setMyAllocation(alloc);
        await loadData();
      } else {
        toast.error("Vote failed — you may have already voted.");
      }
    } catch (e: any) {
      toast.error(`Error: ${e?.message ?? "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveVoteAmount() {
    if (!actor || !voteAmountInput.trim()) return;
    setSavingAmount(true);
    try {
      const ok = await actor.setVoteAmount(
        adminPassword,
        vote.id,
        voteAmountInput.trim(),
      );
      if (ok) toast.success("Vote amount saved!");
      else toast.error("Failed to save amount.");
    } catch (e: any) {
      toast.error(`Error: ${e?.message}`);
    } finally {
      setSavingAmount(false);
    }
  }

  async function finalizeVote() {
    if (!actor) return;
    setFinalizing(true);
    try {
      const ok = await actor.finalizeVote(adminPassword, vote.id);
      if (ok) {
        toast.success("Vote finalized! Rewards pool created.");
        await loadData();
      } else {
        toast.error("Failed to finalize.");
      }
    } catch (e: any) {
      toast.error(`Error: ${e?.message}`);
    } finally {
      setFinalizing(false);
    }
  }

  const month = new Date(
    Number(vote.year),
    Number(vote.month) - 1,
  ).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-yellow-600/40 bg-black/50 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-yellow-600/20 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isICP ? (
              <span className="text-2xl">⚡</span>
            ) : (
              <span className="text-2xl">🔥</span>
            )}
            <h3 className="text-lg font-bold text-yellow-300">
              {isICP ? "$ICP Treasury Vote" : "$BITTYICP Treasury Vote"}
            </h3>
          </div>
          <p className="text-sm text-gray-400">
            {month} ·{" "}
            {isICP ? "Opens last day of month" : "Opens 15th of month"}
          </p>
          {vote.totalVoteAmount && vote.totalVoteAmount !== "0" && (
            <p className="text-xs text-yellow-500 mt-1">
              Voting on: {vote.totalVoteAmount} {isICP ? "ICP" : "BITTYICP"}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`text-xs font-bold border px-2 py-0.5 rounded-full ${status.color}`}
          >
            {status.label}
          </span>
          {open && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeRemaining(vote.closeTime)}
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Live Results */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Live Results
          </p>
          {loadingResults ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-500">No votes yet.</p>
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
                return (
                  <div key={r.optionLabel}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300 font-medium truncate max-w-[60%]">
                        {r.optionLabel}
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

        {/* Voting UI */}
        {open && principal && (
          <div className="border-t border-yellow-600/20 pt-4">
            {hasVoted ? (
              <div
                data-ocid="vote.success_state"
                className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4"
              >
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-300">
                    You've voted!
                  </p>
                  {myAllocation && (
                    <p className="text-xs text-gray-400 mt-1">
                      {options[0]}: {myAllocation.pctA}% · {options[1]}:{" "}
                      {myAllocation.pctB}% · {options[2]}: {myAllocation.pctC}%
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Voting power used: {votingPower}
                  </p>
                </div>
              </div>
            ) : votingPower >= 1 ? (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Cast Your Vote · Power: {votingPower}
                </p>
                <SplitVotingUI
                  options={options}
                  onSubmit={submitVote}
                  submitting={submitting}
                />
              </div>
            ) : (
              <div
                data-ocid="vote.error_state"
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300"
              >
                <ShieldCheck className="w-4 h-4" />
                You need at least 1,000 $BITTYICP to vote.
              </div>
            )}
          </div>
        )}

        {open && !principal && (
          <div className="border-t border-yellow-600/20 pt-4 text-center">
            <p className="text-sm text-gray-400">
              Sign in above to cast your vote.
            </p>
          </div>
        )}

        {/* Admin Controls */}
        {isAdmin && (
          <div className="border-t border-yellow-600/20 pt-4 space-y-3">
            <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wider">
              Admin Controls
            </p>
            <div className="flex gap-2">
              <Input
                data-ocid="vote.input"
                value={voteAmountInput}
                onChange={(e) => setVoteAmountInput(e.target.value)}
                placeholder={`Set ${isICP ? "ICP" : "BITTYICP"} amount being voted on`}
                className="bg-black/40 border-yellow-600/30 text-gray-200 text-sm"
              />
              <Button
                data-ocid="vote.save_button"
                size="sm"
                onClick={saveVoteAmount}
                disabled={savingAmount}
                className="bg-yellow-600 hover:bg-yellow-500 text-black whitespace-nowrap"
              >
                {savingAmount ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Set Amount"
                )}
              </Button>
            </div>
            {!vote.isFinalized && (
              <Button
                data-ocid="vote.confirm_button"
                variant="outline"
                size="sm"
                onClick={finalizeVote}
                disabled={finalizing}
                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 w-full"
              >
                {finalizing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Finalize Vote & Create Rewards Pool
              </Button>
            )}
          </div>
        )}

        {/* Chat */}
        <ChatSection voteId={vote.id} principal={principal} actor={actor} />
      </div>
    </motion.div>
  );
}

// ─── RewardsSection ──────────────────────────────────────────────────────────

function RewardsSection({
  pools,
  isAdmin,
  adminPassword,
  actor,
  onRefresh,
}: {
  pools: RewardsPoolEntry[];
  isAdmin: boolean;
  adminPassword: string;
  actor: any;
  onRefresh: () => void;
}) {
  const [marking, setMarking] = useState<bigint | null>(null);

  if (pools.length === 0) return null;

  async function markDistributed(voteId: bigint) {
    if (!actor) return;
    setMarking(voteId);
    try {
      const ok = await actor.markRewardsDistributed(adminPassword, voteId);
      if (ok) {
        toast.success("Rewards marked as distributed!");
        onRefresh();
      } else {
        toast.error("Failed to mark distributed.");
      }
    } catch (e: any) {
      toast.error(`Error: ${e?.message}`);
    } finally {
      setMarking(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-yellow-600/40 bg-black/50 backdrop-blur-sm p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <h3 className="text-lg font-bold text-yellow-300">Rewards Pools</h3>
      </div>
      <div className="space-y-3">
        {pools.map((p) => (
          <div
            key={String(p.voteId)}
            data-ocid="rewards.item.1"
            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-yellow-600/20"
          >
            <div>
              <p className="text-sm font-semibold text-yellow-300">
                {"ICP" in p.voteType ? "$ICP" : "$BITTYICP"} Vote Rewards
              </p>
              <p className="text-xs text-gray-400">
                Losing option:{" "}
                <span className="text-yellow-400">{p.losingOptionLabel}</span> (
                {Number(p.losingOptionPct)}%)
              </p>
              <p className="text-xs text-gray-400">
                Pool amount: <span className="text-white">{p.poolAmount}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {p.distributed ? (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Distributed
                </span>
              ) : (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <Gift className="w-3 h-3" />
                  Pending
                </span>
              )}
              {isAdmin && !p.distributed && (
                <Button
                  data-ocid="rewards.confirm_button"
                  size="sm"
                  variant="outline"
                  onClick={() => markDistributed(p.voteId)}
                  disabled={marking === p.voteId}
                  className="border-green-500/50 text-green-400 hover:bg-green-500/10 text-xs"
                >
                  {marking === p.voteId ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Mark Distributed"
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── RewardsPoolPanel ────────────────────────────────────────────────────────

function RewardsPoolCard({
  pool,
  isAdmin,
  adminPassword: _adminPassword,
  currentUserPrincipal,
  expandedPool,
  setExpandedPool,
  markDistributed,
  markDistributedPending,
}: {
  pool: any;
  isAdmin: boolean;
  adminPassword?: string;
  currentUserPrincipal: string | null;
  expandedPool: string | null;
  setExpandedPool: (id: string | null) => void;
  markDistributed: (voteId: bigint) => Promise<void>;
  markDistributedPending: boolean;
}) {
  const voteAllocations = useGetVoteAllocations(pool.voteId as bigint);
  const allocs = voteAllocations.data ?? [];

  const losingLabel = pool.losingOptionLabel as string;
  const isICP = "ICP" in pool.voteType;
  const optionLabels = isICP
    ? [
        "BUY $BITTYICP & STORE IN TREASURY",
        "INVEST INTO NEURON",
        "HOLD FOR LATER VOTE",
      ]
    : ["BURN $BITTYICP", "SEND TO GAMES/DEV WALLET", "HOLD FOR LATER VOTE"];

  const voterWinningPower: Record<string, number> = {};
  let totalWinningPower = 0;

  for (const alloc of allocs) {
    const pcts = [Number(alloc.pctA), Number(alloc.pctB), Number(alloc.pctC)];
    const vp = Number(alloc.votingPower);
    let winningPct = 0;
    for (let i = 0; i < 3; i++) {
      if (optionLabels[i] !== losingLabel) {
        winningPct += pcts[i];
      }
    }
    const winningPower = (winningPct / 100) * vp;
    voterWinningPower[alloc.voterPrincipal as string] = winningPower;
    totalWinningPower += winningPower;
  }

  const isExpanded = expandedPool === pool.voteId.toString();
  const voteTypeLabel = isICP ? "$ICP" : "$BITTYICP";
  const losingPct = Number(pool.losingOptionPct);

  const myPrincipal = currentUserPrincipal;
  const myWinningPower = myPrincipal
    ? (voterWinningPower[myPrincipal] ?? 0)
    : 0;
  const myShare =
    totalWinningPower > 0 ? myWinningPower / totalWinningPower : 0;
  const poolAmountNum = Number.parseFloat(pool.poolAmount as string) || 0;
  const myRewardEstimate = myShare * poolAmountNum * (losingPct / 100);

  return (
    <div className="rounded-xl border border-yellow-600/40 bg-black/40 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-lg bg-yellow-500/10 border border-yellow-500/25 p-2">
            <Gift className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <div className="font-bold text-sm text-yellow-300">
              {voteTypeLabel} Rewards Pool
            </div>
            <div className="text-xs text-gray-400">
              Vote #{pool.voteId.toString()}
            </div>
          </div>
        </div>
        {pool.distributed ? (
          <Badge
            variant="outline"
            className="text-xs border-green-500/40 text-green-400"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Distributed
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-xs border-yellow-500/40 text-yellow-400"
          >
            Pending
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-black/30 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Losing Option</div>
          <div className="font-semibold text-white text-xs">{losingLabel}</div>
          <div className="text-yellow-400 font-mono text-sm mt-1">
            {losingPct}% of votes
          </div>
        </div>
        <div className="bg-black/30 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Pool Amount</div>
          <div className="font-semibold text-yellow-400 font-mono text-sm">
            {losingPct}% of {pool.poolAmount || "TBD"} {voteTypeLabel}
          </div>
        </div>
      </div>

      {myPrincipal && myShare > 0 && (
        <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">
            Your Estimated Reward Share
          </div>
          <div className="font-bold text-yellow-300 text-lg">
            {(myShare * 100).toFixed(2)}% of pool
          </div>
          {poolAmountNum > 0 && (
            <div className="text-xs text-gray-400 mt-1">
              ≈{" "}
              {myRewardEstimate.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
              {voteTypeLabel}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-yellow-400 transition-colors"
          onClick={() =>
            setExpandedPool(isExpanded ? null : pool.voteId.toString())
          }
        >
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {isExpanded ? "Hide" : "Show"} voter breakdown ({allocs.length}{" "}
          voters)
        </button>
      )}

      {isAdmin && isExpanded && allocs.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {allocs.map((alloc: any) => {
            const wp = voterWinningPower[alloc.voterPrincipal as string] ?? 0;
            const share = totalWinningPower > 0 ? wp / totalWinningPower : 0;
            return (
              <div
                key={alloc.voterPrincipal as string}
                className="flex items-center justify-between gap-2 bg-black/30 rounded-lg px-3 py-2 text-xs"
              >
                <span className="font-mono text-gray-400 truncate max-w-[120px]">
                  {(alloc.voterPrincipal as string).slice(0, 12)}…
                </span>
                <span className="text-yellow-400 font-semibold shrink-0">
                  {(share * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && !pool.distributed && (
        <Button
          onClick={() => markDistributed(pool.voteId as bigint)}
          disabled={markDistributedPending}
          variant="outline"
          className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 w-full"
          data-ocid="rewards.distribute_button"
        >
          {markDistributedPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Gift className="h-4 w-4 mr-2" />
          )}
          Mark as Distributed
        </Button>
      )}
    </div>
  );
}

function RewardsPoolPanel({
  isAdmin,
  adminPassword,
  currentUserPrincipal,
}: {
  isAdmin: boolean;
  adminPassword: string;
  currentUserPrincipal: string | null;
}) {
  const { actor } = useActor();
  const rewardsPools = useGetRewardsPools();
  const markDistributed = useMarkRewardsDistributed();
  const [expandedPool, setExpandedPool] = useState<string | null>(null);

  const undistributed = (rewardsPools.data ?? []).filter(
    (p: any) => !p.distributed,
  );
  const distributed = (rewardsPools.data ?? []).filter(
    (p: any) => p.distributed,
  );

  if (rewardsPools.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  if ((rewardsPools.data ?? []).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No rewards pools yet. They will appear here after votes are finalized.
      </div>
    );
  }

  async function handleMarkDistributed(voteId: bigint) {
    try {
      const a = actor as any;
      const res = await markDistributed.mutateAsync({
        password: adminPassword,
        voteId,
        actor: a,
      });
      if (res) {
        toast.success("Marked as distributed!");
      } else {
        toast.error("Failed — check password");
      }
    } catch {
      toast.error("Failed to mark as distributed");
    }
  }

  return (
    <div className="space-y-4">
      {undistributed.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm tracking-widest uppercase text-yellow-400">
            Pending Distribution
          </h3>
          {undistributed.map((pool: any) => (
            <RewardsPoolCard
              key={pool.voteId.toString()}
              pool={pool}
              isAdmin={isAdmin}
              adminPassword={adminPassword}
              currentUserPrincipal={currentUserPrincipal}
              expandedPool={expandedPool}
              setExpandedPool={setExpandedPool}
              markDistributed={handleMarkDistributed}
              markDistributedPending={markDistributed.isPending}
            />
          ))}
        </div>
      )}
      {distributed.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm tracking-widest uppercase text-gray-500">
            Past Distributions
          </h3>
          {distributed.map((pool: any) => (
            <RewardsPoolCard
              key={pool.voteId.toString()}
              pool={pool}
              isAdmin={isAdmin}
              adminPassword={adminPassword}
              currentUserPrincipal={currentUserPrincipal}
              expandedPool={expandedPool}
              setExpandedPool={setExpandedPool}
              markDistributed={handleMarkDistributed}
              markDistributedPending={markDistributed.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PublicRewardsBanner ─────────────────────────────────────────────────────

function PublicRewardsBanner({ pools }: { pools: RewardsPoolEntry[] }) {
  if (pools.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-yellow-600/30 bg-black/40 backdrop-blur-sm p-5"
      data-ocid="rewards.panel"
    >
      <div className="flex items-center gap-2 mb-4">
        <Gift className="w-4 h-4 text-yellow-400" />
        <h3 className="font-bold text-sm uppercase tracking-widest text-yellow-300">
          Distribution Rewards
        </h3>
      </div>
      <div className="space-y-2">
        {pools.map((p) => {
          const isICP = "ICP" in p.voteType;
          const tokenLabel = isICP ? "$ICP" : "$BITTYICP";
          return (
            <div
              key={p.voteId.toString()}
              className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-4 py-3 border border-yellow-600/15"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  {tokenLabel} Treasury Vote
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Total distribution rewards:{" "}
                  <span className="text-yellow-300 font-semibold">
                    {Number(p.losingOptionPct)}% of{" "}
                    {p.poolAmount || "vote pool"} {tokenLabel}
                  </span>
                </p>
              </div>
              {p.distributed ? (
                <span className="text-xs text-green-400 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Distributed
                </span>
              ) : (
                <span className="text-xs text-amber-400 flex items-center gap-1 shrink-0">
                  <Gift className="w-3.5 h-3.5" />
                  Pending
                </span>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── MyRewardsPanel ──────────────────────────────────────────────────────────

function MyRewardsPanel({
  votes,
  pools,
  principal,
  actor,
}: {
  votes: MonthlyVote[];
  pools: RewardsPoolEntry[];
  principal: string;
  actor: any;
}) {
  const [myAllocations, setMyAllocations] = useState<
    Record<string, { pctA: number; pctB: number; pctC: number; vp: number }>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor || !principal || votes.length === 0) {
      setLoading(false);
      return;
    }
    async function fetchAllocations() {
      try {
        const results = await Promise.all(
          votes.map(async (v) => {
            const allocs = await actor.getVoteAllocations(v.id);
            const mine = allocs.find(
              (a: any) => a.voterPrincipal === principal,
            );
            return { voteId: v.id.toString(), alloc: mine ?? null };
          }),
        );
        const map: typeof myAllocations = {};
        for (const r of results) {
          if (r.alloc) {
            map[r.voteId] = {
              pctA: Number(r.alloc.pctA),
              pctB: Number(r.alloc.pctB),
              pctC: Number(r.alloc.pctC),
              vp: Number(r.alloc.votingPower),
            };
          }
        }
        setMyAllocations(map);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    fetchAllocations();
  }, [actor, principal, votes]);

  const participated = votes.filter((v) => myAllocations[v.id.toString()]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-yellow-600/40 bg-black/50 backdrop-blur-sm p-6 space-y-4"
      data-ocid="my_rewards.panel"
    >
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <h3 className="font-bold text-base text-yellow-300">
          My Rewards History
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
        </div>
      ) : participated.length === 0 ? (
        <p
          className="text-center text-gray-500 text-sm py-6"
          data-ocid="my_rewards.empty_state"
        >
          You haven&apos;t voted in any cycles yet.
        </p>
      ) : (
        <div className="space-y-3">
          {participated.map((vote) => {
            const voteIdStr = vote.id.toString();
            const alloc = myAllocations[voteIdStr];
            const isICP = "ICP" in vote.voteType;
            const tokenLabel = isICP ? "$ICP" : "$BITTYICP";
            const optionLabels = isICP
              ? [
                  "BUY $BITTYICP & STORE IN TREASURY",
                  "INVEST INTO NEURON",
                  "HOLD FOR LATER VOTE",
                ]
              : [
                  "BURN $BITTYICP",
                  "SEND TO GAMES/DEV WALLET",
                  "HOLD FOR LATER VOTE",
                ];
            const pcts = [alloc.pctA, alloc.pctB, alloc.pctC];

            const pool = pools.find((p) => p.voteId.toString() === voteIdStr);

            // Calculate winning power
            let winningPct = 0;
            if (pool) {
              for (let i = 0; i < 3; i++) {
                if (optionLabels[i] !== (pool.losingOptionLabel as string)) {
                  winningPct += pcts[i];
                }
              }
            }
            const losingPct = pool ? 100 - winningPct : 0;

            // Estimate reward (if pool data available)
            const poolAmountNum = pool
              ? Number.parseFloat(pool.poolAmount as string) || 0
              : 0;

            // Month display
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
            const monthNum = Number(vote.month);
            const yearNum = Number(vote.year);
            const monthLabel = `${monthNames[monthNum - 1] ?? monthNum} ${yearNum}`;

            return (
              <div
                key={voteIdStr}
                className="bg-white/5 rounded-xl border border-yellow-600/20 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-yellow-300">
                      {tokenLabel} Treasury Vote
                    </p>
                    <p className="text-xs text-gray-400">{monthLabel}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs border-yellow-500/40 text-yellow-400 shrink-0"
                  >
                    {alloc.vp} votes
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {optionLabels.map((label, i) => (
                    <div
                      key={label}
                      className="bg-black/30 rounded-lg p-2 border border-white/10 text-center"
                    >
                      <p
                        className="text-gray-400 text-[10px] leading-tight mb-1 truncate"
                        title={label}
                      >
                        {label.split(" ").slice(0, 2).join(" ")}…
                      </p>
                      <p
                        className={`font-bold ${pcts[i] > 0 ? "text-yellow-300" : "text-gray-600"}`}
                      >
                        {pcts[i]}%
                      </p>
                    </div>
                  ))}
                </div>

                {pool && (
                  <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        Power on winning options:
                      </span>
                      <span className="text-yellow-300 font-semibold">
                        {winningPct}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        Power on losing option:
                      </span>
                      <span className="text-red-400 font-semibold">
                        {losingPct}%
                      </span>
                    </div>
                    {poolAmountNum > 0 && winningPct > 0 && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-yellow-500/15">
                        <span className="text-gray-400">Estimated reward:</span>
                        <span className="text-green-400 font-semibold">
                          Based on {winningPct}% power
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Status:</span>
                      {pool.distributed ? (
                        <span className="text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Distributed
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Gift className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main VotingPage ─────────────────────────────────────────────────────────

export default function VotingPage({
  onBack,
  isAdmin,
  adminPassword,
}: VotingPageProps) {
  const { actor } = useActor();
  const { identity, login, isLoggingIn, clear } = useInternetIdentity();

  // Auth state
  const [plugPrincipal, setPlugPrincipal] = useState<string | null>(null);
  const [plugConnecting, setPlugConnecting] = useState(false);

  // Balance
  const [bittyBalance, setBittyBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Vote data
  const [votes, setVotes] = useState<MonthlyVote[]>([]);
  const [pools, setPools] = useState<RewardsPoolEntry[]>([]);
  const [loadingVotes, setLoadingVotes] = useState(false);

  // Canister deposit address
  const [canisterId, setCanisterId] = useState<string>("");
  useEffect(() => {
    loadConfig()
      .then((cfg) => setCanisterId(cfg.backend_canister_id))
      .catch(() => {});
  }, []);

  // Derived
  const iiPrincipal = identity?.getPrincipal().toString() ?? null;
  const principal = iiPrincipal ?? plugPrincipal;
  const votingPower = Math.floor(bittyBalance / 1000);
  const isSignedIn = !!principal;

  // Load votes on actor ready
  const loadVotes = useCallback(async () => {
    const a = actor as any;
    if (!a) return;
    setLoadingVotes(true);
    try {
      const [allVotes, allPools] = await Promise.all([
        a.getAllVotes(),
        a.getRewardsPools(),
      ]);
      setVotes(allVotes);
      setPools(allPools);
    } catch {
    } finally {
      setLoadingVotes(false);
    }
  }, [actor]);

  useEffect(() => {
    if (actor) loadVotes();
  }, [actor, loadVotes]);

  // Load balance when principal changes
  useEffect(() => {
    if (!principal) {
      setBittyBalance(0);
      return;
    }
    setBalanceLoading(true);
    getBITTYBalance(principal)
      .then((raw) => setBittyBalance(Number(raw) / 1e8))
      .catch(() => setBittyBalance(0))
      .finally(() => setBalanceLoading(false));
  }, [principal]);

  // Plug wallet connect
  async function connectPlug() {
    if (!window.ic?.plug) {
      toast.error(
        "Plug wallet not found. Please install the Plug browser extension.",
      );
      return;
    }
    setPlugConnecting(true);
    try {
      const connected = await window.ic.plug.requestConnect();
      if (connected) {
        const p = await window.ic.plug.agent?.getPrincipal();
        setPlugPrincipal(p?.toString() ?? null);
      } else {
        toast.error("Plug wallet connection was rejected.");
      }
    } catch {
      toast.error("Failed to connect Plug wallet.");
    } finally {
      setPlugConnecting(false);
    }
  }

  async function disconnectPlug() {
    try {
      await window.ic?.plug?.disconnect();
    } catch {}
    setPlugPrincipal(null);
  }

  function signOut() {
    if (iiPrincipal) clear();
    if (plugPrincipal) disconnectPlug();
  }

  // Separate ICP and BITTYICP votes
  const bittyVotes = votes.filter((v) => "BITTYICP" in v.voteType);
  const icpVotes = votes.filter((v) => "ICP" in v.voteType);

  // Show most recent of each type
  const latestBitty = bittyVotes[bittyVotes.length - 1];
  const latestICP = icpVotes[icpVotes.length - 1];

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('/assets/uploads/IMG_5288-1.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="fixed inset-0 z-0 bg-black/55" />

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
            className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Treasury</span>
          </button>
          {isSignedIn && (
            <button
              type="button"
              data-ocid="auth.toggle"
              onClick={signOut}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          )}
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <VoteIcon className="w-8 h-8 text-yellow-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Community Votes
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Two monthly votes on how to allocate treasury funds
          </p>
        </motion.div>

        {/* Sign-in gate */}
        <AnimatePresence mode="wait">
          {!isSignedIn ? (
            <motion.div
              key="signin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              data-ocid="auth.modal"
              className="rounded-2xl border border-yellow-600/40 bg-black/60 backdrop-blur-sm p-6"
            >
              <div className="text-center mb-6">
                <Wallet className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-yellow-300">
                  Sign In to Vote
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Connect the wallet that holds your $BITTYICP tokens
                </p>
              </div>
              <div className="grid gap-4">
                {/* Internet Identity */}
                <div>
                  <Button
                    data-ocid="auth.primary_button"
                    onClick={() => login()}
                    disabled={isLoggingIn}
                    className="w-full bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 text-black font-bold py-3"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Connecting…
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Sign in with Internet Identity
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    Supports NNS, Oisy, NFID, and any Internet Identity-based
                    wallet
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-yellow-600/20" />
                  <span className="text-xs text-gray-500">or</span>
                  <div className="flex-1 h-px bg-yellow-600/20" />
                </div>

                {/* Plug Wallet */}
                <div>
                  <Button
                    data-ocid="auth.secondary_button"
                    onClick={connectPlug}
                    disabled={plugConnecting}
                    variant="outline"
                    className="w-full border-yellow-600/50 text-yellow-300 hover:bg-yellow-600/10 py-3"
                  >
                    {plugConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Connecting…
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        Connect Plug Wallet
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    Supports Plug browser extension wallet
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="userinfo"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-yellow-600/30 bg-black/40 backdrop-blur-sm p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Connected as</p>
                    <p className="text-sm font-mono text-yellow-300">
                      {principal?.slice(0, 20)}…
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {balanceLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                  ) : (
                    <>
                      <p className="text-sm font-bold text-yellow-400">
                        {bittyBalance.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        BITTYICP
                      </p>
                      <p className="text-xs text-gray-400">
                        {votingPower >= 1 ? (
                          <span className="text-green-400">
                            {votingPower} vote{votingPower !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-red-400">
                            Not eligible (need 1,000+)
                          </span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vote Cards */}
        {isSignedIn && (
          <>
            {loadingVotes ? (
              <div
                data-ocid="votes.loading_state"
                className="flex items-center justify-center py-12 gap-3 text-yellow-400"
              >
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading votes…</span>
              </div>
            ) : (
              <div className="space-y-6">
                {latestBitty && (
                  <VoteCard
                    vote={latestBitty}
                    principal={principal}
                    votingPower={votingPower}
                    actor={actor}
                    isAdmin={isAdmin}
                    adminPassword={adminPassword}
                  />
                )}
                {latestICP && (
                  <VoteCard
                    vote={latestICP}
                    principal={principal}
                    votingPower={votingPower}
                    actor={actor}
                    isAdmin={isAdmin}
                    adminPassword={adminPassword}
                  />
                )}
                {!latestBitty && !latestICP && (
                  <div
                    data-ocid="votes.empty_state"
                    className="text-center py-12 text-gray-500"
                  >
                    <VoteIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No votes available yet this month.</p>
                  </div>
                )}
              </div>
            )}

            {/* Public Distribution Banner - visible to all */}
            <PublicRewardsBanner pools={pools} />

            {/* My Rewards Panel - signed in non-admin voters only */}
            {isSignedIn && !isAdmin && principal && (
              <MyRewardsPanel
                votes={votes}
                pools={pools}
                principal={principal}
                actor={actor}
              />
            )}

            {/* Rewards Pools - Admin Only */}
            {isAdmin && (
              <RewardsSection
                pools={pools}
                isAdmin={isAdmin}
                adminPassword={adminPassword}
                actor={actor}
                onRefresh={loadVotes}
              />
            )}

            {/* How It Works */}
            {/* Internal Rewards Wallet - Enhanced - Admin Only */}
            {isAdmin && (
              <section data-ocid="rewards.section">
                <div className="flex items-center gap-3 mb-5">
                  <div className="shrink-0 rounded-xl bg-yellow-500/10 border border-yellow-500/25 p-2.5">
                    <Gift className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-white tracking-tight">
                      Internal Rewards Wallet
                    </h2>
                    <p className="text-xs text-gray-400">
                      Receives the losing option's % after each vote
                      finalization. Distributed to voters based on
                      winning-option power.
                    </p>
                  </div>
                </div>
                <RewardsPoolPanel
                  isAdmin={isAdmin}
                  adminPassword={adminPassword}
                  currentUserPrincipal={principal}
                />
              </section>
            )}
            {/* Canister Deposit Address - Admin Only */}
            {isAdmin && canisterId && (
              <section data-ocid="deposit.section">
                <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Wallet className="w-4 h-4 shrink-0" />
                    <h3 className="font-bold text-sm uppercase tracking-widest">
                      Canister Deposit Address
                    </h3>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Before each vote cycle is finalized, send tokens here so the
                    canister can automatically execute the distribution. This is
                    the canister&#39;s own wallet — visible to all for
                    verification.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">
                      Canister Principal ID
                    </p>
                    <div className="flex items-center gap-2 bg-black/40 rounded-xl border border-yellow-500/20 px-3 py-2">
                      <span className="text-yellow-300 text-xs font-mono flex-1 break-all">
                        {canisterId}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(canisterId);
                          toast.success("Canister ID copied!");
                        }}
                        className="shrink-0 text-gray-400 hover:text-yellow-400 transition-colors"
                        title="Copy canister ID"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-black/30 rounded-lg p-2 border border-white/10">
                        <p className="text-yellow-400 font-semibold mb-0.5">
                          For{" "}
                        </p>
                        <p className="text-gray-400">
                          Send to the Principal ID above via the BITTYICP token
                          transfer (ICRC-1)
                        </p>
                      </div>
                      <div className="bg-black/30 rounded-lg p-2 border border-white/10">
                        <p className="text-yellow-400 font-semibold mb-0.5">
                          For{" "}
                        </p>
                        <p className="text-gray-400">
                          Send to the Principal ID above — use NNS or your ICP
                          wallet&#39;s send function
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <HowItWorksSection />
          </>
        )}

        {!isSignedIn && <HowItWorksSection />}

        {/* Footer */}
        <div className="text-center text-xs text-gray-600 pb-4">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            caffeine.ai
          </a>
        </div>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}
