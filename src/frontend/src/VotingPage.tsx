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
import { getBITTYBalance, getICPBalance } from "@/utils/ledgerActors";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileText,
  Gift,
  HelpCircle,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
  Vote as VoteIcon,
  Wallet,
  X,
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

interface CustomRewardsPoolEntry {
  proposalId: bigint;
  voteType: { ICP: null } | { BITTYICP: null };
  losingOptionLabel: string;
  losingOptionPct: bigint;
  poolAmount: string;
  distributed: boolean;
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

// ─── MyWalletPanel ───────────────────────────────────────────────────────────

interface VerifiedWallet {
  principal: string;
  balance: number;
  loading: boolean;
}

function MyWalletPanel({
  principal,
  actor: _actorProp,
}: {
  principal: string;
  actor: any;
}) {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const [verifiedWallets, setVerifiedWallets] = useState<VerifiedWallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [externalInput, setExternalInput] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [sendDest, setSendDest] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendToken, setSendToken] = useState<"bitty" | "icp">("bitty");
  const [icpBalance, setIcpBalance] = useState<number>(0);
  const [icpBalanceLoading, setIcpBalanceLoading] = useState(false);
  const [walletBittyBalance, setWalletBittyBalance] = useState<number>(0);

  async function loadVerifiedWallets() {
    if (!actor) return;
    setWalletsLoading(true);
    try {
      const wallets: string[] = await (actor as any).getMyVerifiedWallets();
      const items: VerifiedWallet[] = wallets.map((w) => ({
        principal: w,
        balance: 0,
        loading: true,
      }));
      setVerifiedWallets(items);
      wallets.forEach(async (w, i) => {
        try {
          const raw = await getBITTYBalance(w);
          setVerifiedWallets((prev) =>
            prev.map((v, vi) =>
              vi === i
                ? { ...v, balance: Number(raw) / 1e8, loading: false }
                : v,
            ),
          );
        } catch {
          setVerifiedWallets((prev) =>
            prev.map((v, vi) => (vi === i ? { ...v, loading: false } : v)),
          );
        }
      });
    } catch {
    } finally {
      setWalletsLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadVerifiedWallets is stable within MyWalletPanel
  useEffect(() => {
    if (actor && principal) loadVerifiedWallets();
    if (principal) {
      setIcpBalanceLoading(true);
      Promise.all([
        getICPBalance(principal)
          .then((raw) => Number(raw) / 1e8)
          .catch(() => 0),
        getBITTYBalance(principal)
          .then((raw) => Number(raw) / 1e8)
          .catch(() => 0),
      ])
        .then(([icp, bitty]) => {
          setIcpBalance(icp);
          setWalletBittyBalance(bitty);
        })
        .finally(() => setIcpBalanceLoading(false));
    }
  }, [actor, principal]);

  function copyAddress() {
    navigator.clipboard.writeText(principal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleVerify() {
    if (!externalInput.trim()) return;
    setVerifyLoading(true);
    try {
      let activeActor = actor;
      if (!activeActor) {
        const { createActorWithConfig } = await import("./config");
        activeActor = await createActorWithConfig({
          agentOptions: { identity },
        });
      }
      const res = await (activeActor as any).verifyExternalWallet(
        externalInput.trim(),
      );
      if ("err" in res) {
        toast.error(res.err);
        return;
      }
      toast.success("Wallet verified successfully! Voting power updated.");
      setExternalInput("");
      setShowAddWallet(false);
      await loadVerifiedWallets();
    } catch (e: any) {
      toast.error(e?.message ?? "Verification failed. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleSend() {
    if (!sendDest.trim() || !sendAmount.trim()) {
      toast.error("Enter destination and amount");
      return;
    }
    const amt = Number.parseFloat(sendAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSendLoading(true);
    try {
      toast.error(
        "To send BITTYICP, use NNS, Oisy, or ICRC-1 compatible wallet. Direct transfers from this panel require the Plug wallet.",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setSendLoading(false);
    }
  }

  async function handleSendICP() {
    if (!sendDest.trim() || !sendAmount.trim()) {
      toast.error("Enter destination and amount");
      return;
    }
    const amt = Number.parseFloat(sendAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSendLoading(true);
    try {
      toast.error(
        "To send ICP, use NNS, Oisy, or any ICP-compatible wallet. Direct transfers from this panel require the Plug wallet.",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setSendLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-yellow-600/30 bg-black/40 backdrop-blur-sm overflow-hidden"
    >
      <div className="p-4 border-b border-yellow-600/20">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-yellow-400" />
          <h3 className="font-bold text-yellow-300 text-sm">
            My BITTY ICP Bank Wallet
          </h3>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Receive Address */}
        <div>
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">
            Your BITTY ICP Bank Address (Receive $BITTYICP & $ICP)
          </p>
          <div className="flex items-center gap-2 bg-black/40 rounded-xl border border-yellow-500/20 px-3 py-2">
            <span
              className="text-yellow-300 text-xs font-mono flex-1 truncate"
              title={principal}
            >
              {principal}
            </span>
            <button
              type="button"
              data-ocid="wallet.copy_button"
              onClick={copyAddress}
              className="shrink-0 text-gray-400 hover:text-yellow-400 transition-colors"
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            This address receives both $BITTYICP and $ICP tokens — including
            voting rewards.
          </p>
        </div>

        {/* Token Balances */}
        <div className="rounded-xl border border-yellow-500/30 bg-black/40 p-4">
          <p className="text-sm font-black text-yellow-400 uppercase tracking-widest mb-4 text-center">
            TOKEN BALANCES
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-yellow-500/30 bg-black/50 p-3 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                $BITTYICP
              </p>
              {icpBalanceLoading ? (
                <span className="text-xl text-gray-500">…</span>
              ) : (
                <p className="text-4xl font-black text-yellow-400 leading-none">
                  {walletBittyBalance.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-blue-500/30 bg-black/50 p-3 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                ICP
              </p>
              {icpBalanceLoading ? (
                <span className="text-xl text-gray-500">…</span>
              ) : (
                <p className="text-4xl font-black text-blue-300 leading-none">
                  {icpBalance.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Send Panel */}
        <div>
          <button
            type="button"
            data-ocid="wallet.toggle"
            onClick={() => setShowSend(!showSend)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowUpRight className="w-3 h-3" />
            Send $BITTYICP or $ICP
          </button>
          {showSend && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSendToken("bitty")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold border transition-colors ${sendToken === "bitty" ? "bg-yellow-600/30 border-yellow-500/60 text-yellow-300" : "bg-black/30 border-gray-700 text-gray-400 hover:border-yellow-600/40"}`}
                >
                  $BITTYICP
                </button>
                <button
                  type="button"
                  onClick={() => setSendToken("icp")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold border transition-colors ${sendToken === "icp" ? "bg-blue-600/30 border-blue-500/60 text-blue-300" : "bg-black/30 border-gray-700 text-gray-400 hover:border-blue-600/40"}`}
                >
                  $ICP
                </button>
              </div>
              <Input
                placeholder="Destination address"
                value={sendDest}
                onChange={(e) => setSendDest(e.target.value)}
                className="bg-black/50 border-yellow-600/30 text-white placeholder:text-gray-600 text-xs"
                data-ocid="wallet.input"
              />
              <Input
                placeholder="Amount"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="bg-black/50 border-yellow-600/30 text-white placeholder:text-gray-600 text-xs"
                data-ocid="wallet.input"
              />
              <Button
                size="sm"
                data-ocid="wallet.submit_button"
                onClick={sendToken === "bitty" ? handleSend : handleSendICP}
                disabled={sendLoading}
                className="w-full bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold"
              >
                {sendLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : null}
                Send {sendToken === "bitty" ? "$BITTYICP" : "$ICP"}
              </Button>
            </div>
          )}
        </div>

        {/* Verified Wallets */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-base font-black text-yellow-300 uppercase tracking-widest">
              Verified External Wallets
            </h4>
            {walletsLoading && (
              <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
            )}
          </div>

          {verifiedWallets.length === 0 && !walletsLoading && (
            <div className="rounded-xl border border-yellow-500/40 bg-yellow-900/20 p-3 text-center">
              <p className="text-sm font-bold text-yellow-300">
                No external wallets verified yet.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Verify an external wallet below to boost your voting power.
              </p>
            </div>
          )}

          {verifiedWallets.map((w, i) => (
            <div
              key={w.principal}
              data-ocid={`wallet.item.${i + 1}`}
              className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 mb-1 border border-yellow-600/10"
            >
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-yellow-300 truncate">
                  {w.principal}
                </p>
                {w.loading ? (
                  <p className="text-xs text-gray-500">Loading balance…</p>
                ) : (
                  <p className="text-xs text-gray-400">
                    {w.balance.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    BITTYICP ·{" "}
                    <span className="text-yellow-500">
                      {Math.floor(w.balance / 1000)} votes
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                data-ocid={`wallet.delete_button.${i + 1}`}
                onClick={async () => {
                  const walletPrincipal = w.principal;
                  setVerifiedWallets((prev) =>
                    prev.filter((_, vi) => vi !== i),
                  );
                  try {
                    if (actor) {
                      await (actor as any).unverifyWallet(walletPrincipal);
                    }
                    toast.success(
                      "Wallet permanently unverified. That address is now free to be re-verified by anyone.",
                    );
                  } catch (err) {
                    console.error("unverifyWallet error:", err);
                    toast.error("Failed to unverify wallet. Please try again.");
                    // Re-load wallets to restore state
                    loadVerifiedWallets();
                  }
                }}
                className="ml-2 text-gray-600 hover:text-red-400 transition-colors"
                title="Permanently remove this verified wallet"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Add External Wallet */}
          {!showAddWallet ? (
            <button
              type="button"
              data-ocid="wallet.secondary_button"
              onClick={() => setShowAddWallet(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-yellow-500/60 bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-300 font-bold text-sm py-3 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add External Wallet
            </button>
          ) : (
            <div className="mt-3 space-y-3 p-3 bg-black/30 rounded-xl border border-yellow-600/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-yellow-300">
                  Verify External Wallet
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddWallet(false);
                    setExternalInput("");
                  }}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Instructions */}
              <div className="rounded-lg bg-yellow-900/20 border border-yellow-600/20 p-3 space-y-2">
                <p className="text-xs text-yellow-200 font-semibold">
                  How to verify:
                </p>
                <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
                  <li>Copy your BITTY ICP Bank address below</li>
                  <li>
                    Send at least{" "}
                    <span className="text-yellow-400 font-bold">
                      10 $BITTYICP
                    </span>{" "}
                    from your external wallet to that address
                  </li>
                  <li>
                    Paste your external wallet address below and click{" "}
                    <span className="text-yellow-400 font-bold">VERIFY</span>
                  </li>
                </ol>
              </div>

              {/* Their app address for sending to */}
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Your BITTY ICP Bank Address:
                </p>
                <div className="flex items-center gap-2 bg-black/40 rounded-lg border border-yellow-500/20 px-2 py-1.5">
                  <span className="font-mono text-yellow-300 text-xs flex-1 truncate">
                    {principal}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(principal);
                      toast.success("Address copied!");
                    }}
                    className="text-gray-500 hover:text-yellow-400"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Input + Verify */}
              <Input
                placeholder="Paste external wallet address (e.g. your Oisy address)"
                value={externalInput}
                onChange={(e) => setExternalInput(e.target.value)}
                className="bg-black/50 border-yellow-600/30 text-white placeholder:text-gray-600 text-xs"
                data-ocid="wallet.input"
              />
              <Button
                size="sm"
                data-ocid="wallet.confirm_button"
                onClick={handleVerify}
                disabled={!externalInput.trim() || verifyLoading}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold"
              >
                {verifyLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : null}
                VERIFY
              </Button>
              <p className="text-xs text-gray-500 text-center">
                Once verified, this wallet is permanently linked to your
                account.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
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

// ─── DynamicSplitVotingUI ────────────────────────────────────────────────────

function DynamicSplitVotingUI({
  options,
  onSubmit,
  submitting,
}: {
  options: string[];
  onSubmit: (allocs: Array<{ optionIndex: bigint; pct: bigint }>) => void;
  submitting: boolean;
}) {
  const n = options.length;
  const initPct = () => {
    const base = Math.floor(100 / n);
    const arr = Array(n).fill(base);
    arr[0] += 100 - base * n;
    return arr;
  };
  const [pcts, setPcts] = useState<number[]>(initPct);

  const total = pcts.reduce((a, b) => a + b, 0);
  const isValid = total === 100;

  function handleChange(idx: number, val: number) {
    const newVal = Math.min(100, Math.max(0, val));
    const newPcts = [...pcts];
    newPcts[idx] = newVal;
    // Distribute remainder across other options
    const remaining = 100 - newVal;
    const others = newPcts.filter((_, i) => i !== idx);
    const othersTotal = others.reduce((a, b) => a + b, 0);
    if (othersTotal === 0) {
      const split = Math.floor(remaining / (n - 1));
      for (let i = 0, extra = remaining - split * (n - 1); i < n; i++) {
        if (i !== idx) {
          newPcts[i] = split + (extra > 0 ? 1 : 0);
          if (extra > 0) extra--;
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        if (i !== idx) {
          newPcts[i] = Math.round((pcts[i] / othersTotal) * remaining);
        }
      }
      // Fix rounding
      const newTotal = newPcts.reduce((a, b) => a + b, 0);
      const diff = 100 - newTotal;
      for (let i = 0; i < n; i++) {
        if (i !== idx) {
          newPcts[i] += diff;
          break;
        }
      }
    }
    setPcts(newPcts);
  }

  const colors = [
    "from-yellow-500 to-yellow-400",
    "from-amber-500 to-amber-400",
    "from-orange-500 to-orange-400",
    "from-yellow-600 to-yellow-500",
    "from-amber-600 to-amber-500",
    "from-orange-600 to-orange-500",
  ];

  return (
    <div className="space-y-4">
      {options.map((label, idx) => (
        <div key={label}>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-yellow-300 font-medium truncate max-w-[70%]">
              {label}
            </span>
            <span className="text-sm font-bold text-white">
              {pcts[idx] ?? 0}%
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[pcts[idx] ?? 0]}
            onValueChange={([v]) => handleChange(idx, v)}
            className="cursor-pointer"
          />
          <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-white/10">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${colors[idx % colors.length]} transition-all`}
              style={{ width: `${pcts[idx] ?? 0}%` }}
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
          {100 - total > 0
            ? `${100 - total}% remaining to allocate`
            : `Over by ${total - 100}% — adjust sliders`}
        </p>
      )}
      <Button
        data-ocid="vote.submit_button"
        className="w-full bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 text-black font-bold py-3 disabled:opacity-50"
        disabled={!isValid || submitting}
        onClick={() =>
          onSubmit(
            pcts.map((p, i) => ({ optionIndex: BigInt(i), pct: BigInt(p) })),
          )
        }
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4 mr-2" /> Submit Vote
          </>
        )}
      </Button>
    </div>
  );
}

// ─── CustomProposalCard ───────────────────────────────────────────────────────

function CustomProposalCard({
  proposal,
  principal,
  votingPower,
  actor,
  isAdmin,
  adminPassword,
  onRefresh,
}: {
  proposal: CustomProposal;
  principal: string | null;
  votingPower: number;
  actor: any;
  isAdmin: boolean;
  adminPassword: string;
  onRefresh: () => void;
}) {
  const [results, setResults] = useState<CustomVoteResult[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tokenAmountInput, setTokenAmountInput] = useState(
    proposal.totalVoteAmount || "",
  );
  const [savingAmount, setSavingAmount] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [marking, setMarking] = useState(false);

  const now = BigInt(Date.now()) * BigInt(1_000_000);
  const isOpen = !proposal.isFinalized && proposal.closeTime > now;
  const isExpired = !proposal.isFinalized && proposal.closeTime <= now;
  const isFinalized = proposal.isFinalized;

  const loadResults = useCallback(async () => {
    if (!actor) return;
    try {
      const r = await (actor as any).getCustomVoteResults(proposal.id);
      setResults(r as CustomVoteResult[]);
    } catch {}
  }, [actor, proposal.id]);

  const checkVoted = useCallback(async () => {
    if (!actor || !principal) return;
    try {
      const v = await (actor as any).hasVotedOnCustomProposal(
        proposal.id,
        principal,
      );
      setHasVoted(!!v);
    } catch {}
  }, [actor, proposal.id, principal]);

  useEffect(() => {
    loadResults();
    if (principal) checkVoted();
    const interval = setInterval(() => {
      loadResults();
      if (principal) checkVoted();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadResults, checkVoted, principal]);

  async function castVote(allocs: Array<{ optionIndex: bigint; pct: bigint }>) {
    if (!actor || !principal) return;
    setSubmitting(true);
    try {
      const ok = await (actor as any).castCustomVote(
        proposal.id,
        principal,
        allocs,
        BigInt(votingPower),
      );
      if (ok) {
        toast.success("Vote submitted successfully!");
        setHasVoted(true);
        await loadResults();
      } else {
        toast.error(
          "Vote failed. You may have already voted or insufficient power.",
        );
      }
    } catch (e: any) {
      toast.error(`Error: ${e?.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveTokenAmount() {
    if (!actor) return;
    setSavingAmount(true);
    try {
      const ok = await (actor as any).setCustomProposalAmount(
        adminPassword,
        proposal.id,
        tokenAmountInput,
      );
      if (ok) {
        toast.success("Token amount saved!");
        onRefresh();
      } else toast.error("Failed to save amount.");
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
      const ok = await (actor as any).finalizeCustomProposal(
        adminPassword,
        proposal.id,
      );
      if (ok) {
        toast.success("Proposal finalized!");
        onRefresh();
      } else toast.error("Failed to finalize.");
    } catch (e: any) {
      toast.error(`Error: ${e?.message}`);
    } finally {
      setFinalizing(false);
    }
  }

  async function markDistributed() {
    if (!actor) return;
    setMarking(true);
    try {
      const ok = await (actor as any).markCustomRewardsDistributed(
        adminPassword,
        proposal.id,
      );
      if (ok) {
        toast.success("Marked as distributed!");
        onRefresh();
      } else toast.error("Failed to mark distributed.");
    } catch (e: any) {
      toast.error(`Error: ${e?.message}`);
    } finally {
      setMarking(false);
    }
  }

  const totalVotes = results.reduce((s, r) => s + Number(r.voterCount), 0);
  const maxPct = results.reduce(
    (m, r) => Math.max(m, Number(r.totalWeightedPct)),
    0,
  );

  const voteTypeBadge = "ICP" in proposal.voteType ? "$ICP" : "$BITTYICP";
  const statusColor = isOpen
    ? "border-green-500/60 text-green-400 bg-green-500/10"
    : isExpired
      ? "border-amber-500/60 text-amber-400 bg-amber-500/10"
      : "border-gray-500/60 text-gray-400 bg-gray-500/10";
  const statusLabel = isOpen ? "OPEN" : isExpired ? "EXPIRED" : "FINALIZED";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-yellow-600/40 bg-black/50 backdrop-blur-sm overflow-hidden"
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

        {/* Time remaining */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{timeRemaining(proposal.closeTime)}</span>
          {proposal.totalVoteAmount && proposal.totalVoteAmount !== "0" && (
            <span className="ml-auto text-yellow-400 font-semibold">
              {proposal.totalVoteAmount} {voteTypeBadge}
            </span>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((r) => {
              const pct = Number(r.totalWeightedPct);
              const isWinner = pct === maxPct && pct > 0;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
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
              {totalVotes} total voters
            </p>
          </div>
        )}

        {/* Vote UI */}
        {isOpen && principal && votingPower > 0 && !hasVoted && (
          <div className="border-t border-yellow-600/20 pt-4">
            <p className="text-xs text-yellow-400 mb-3 font-semibold">
              Voting Power: {votingPower} · Allocate 100% across options
            </p>
            <DynamicSplitVotingUI
              options={proposal.options}
              onSubmit={castVote}
              submitting={submitting}
            />
          </div>
        )}

        {isOpen && principal && votingPower > 0 && hasVoted && (
          <div className="flex items-center gap-2 text-green-400 text-sm py-2 border-t border-yellow-600/20 pt-4">
            <CheckCircle2 className="w-4 h-4" />
            <span>You have voted on this proposal</span>
          </div>
        )}

        {isOpen && principal && votingPower === 0 && (
          <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-2">
            You need at least 1,000 $BITTYICP to vote. Your current balance
            gives {votingPower} voting power.
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div className="border-t border-yellow-600/20 pt-4 space-y-3">
            <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider">
              Admin Controls
            </p>
            <div className="flex gap-2">
              <Input
                data-ocid="proposal.input"
                value={tokenAmountInput}
                onChange={(e) => setTokenAmountInput(e.target.value)}
                placeholder="Token amount for this proposal"
                className="bg-black/40 border-yellow-600/30 text-gray-200 text-xs h-9"
              />
              <Button
                data-ocid="proposal.save_button"
                size="sm"
                onClick={saveTokenAmount}
                disabled={savingAmount}
                className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs"
              >
                {savingAmount ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Set"
                )}
              </Button>
            </div>
            {(isOpen || isExpired) && (
              <Button
                data-ocid="proposal.confirm_button"
                size="sm"
                onClick={finalizeVote}
                disabled={finalizing}
                variant="outline"
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 text-xs w-full"
              >
                {finalizing ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-2" />
                ) : null}
                Finalize Proposal
              </Button>
            )}
            {isFinalized && (
              <Button
                data-ocid="proposal.secondary_button"
                size="sm"
                onClick={markDistributed}
                disabled={marking}
                variant="outline"
                className="border-green-500/50 text-green-400 hover:bg-green-500/10 text-xs w-full"
              >
                {marking ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-2" />
                ) : null}
                Mark Rewards Distributed
              </Button>
            )}
          </div>
        )}

        {/* Chat */}
        <ChatSection voteId={proposal.id} principal={principal} actor={actor} />
      </div>
    </motion.div>
  );
}

// ─── CreateProposalForm ───────────────────────────────────────────────────────

function CreateProposalForm({
  actor,
  adminPassword,
  onCreated,
}: {
  actor: any;
  adminPassword: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [voteType, setVoteType] = useState<"ICP" | "BITTYICP">("ICP");
  const [options, setOptions] = useState(["", ""]);
  const [endDateTime, setEndDateTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { actor: localActor, isFetching: actorLoading } = useActor();
  const activeActor = localActor || actor;

  function addOption() {
    if (options.length < 6) setOptions([...options, ""]);
  }

  function removeOption(idx: number) {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
  }

  function updateOption(idx: number, val: string) {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  }

  async function handleSubmit() {
    if (!title.trim() || !endDateTime || options.some((o) => !o.trim())) {
      toast.error("Please fill in all fields and options.");
      return;
    }
    const closeTimeNs =
      BigInt(new Date(endDateTime).getTime()) * BigInt(1_000_000);
    const voteTypeArg = voteType === "ICP" ? { ICP: null } : { BITTYICP: null };
    setSubmitting(true);
    if (!activeActor) {
      toast.error("Not connected to network. Please wait and try again.");
      setSubmitting(false);
      return;
    }
    try {
      const result = await (activeActor as any).createCustomProposal(
        adminPassword,
        title.trim(),
        description.trim(),
        voteTypeArg,
        options.map((o) => o.trim()),
        closeTimeNs,
      );
      if (result !== null && result !== undefined) {
        toast.success("Proposal created successfully!");
        setTitle("");
        setDescription("");
        setOptions(["", ""]);
        setEndDateTime("");
        setOpen(false);
        onCreated();
      } else {
        toast.error("Failed to create proposal. Check password or inputs.");
      }
    } catch (e: any) {
      toast.error(`Error: ${e?.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-yellow-600/30 bg-black/40 overflow-hidden">
      <button
        type="button"
        data-ocid="proposal.open_modal_button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between p-4 text-yellow-300 hover:text-yellow-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-bold uppercase tracking-wider">
            Create New Proposal
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
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
            <div className="p-4 border-t border-yellow-600/20 space-y-4">
              <div>
                <label
                  htmlFor="proposal-title"
                  className="text-xs text-gray-400 font-medium mb-1 block"
                >
                  Proposal Title *
                </label>
                <Input
                  id="proposal-title"
                  data-ocid="proposal.input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter proposal title"
                  className="bg-black/40 border-yellow-600/30 text-gray-200 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="proposal-desc"
                  className="text-xs text-gray-400 font-medium mb-1 block"
                >
                  Description
                </label>
                <Textarea
                  id="proposal-desc"
                  data-ocid="proposal.textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this proposal..."
                  rows={3}
                  className="bg-black/40 border-yellow-600/30 text-gray-200 text-sm resize-none"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">
                  Treasury Type *
                </p>
                <div className="flex gap-2">
                  {(["ICP", "BITTYICP"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setVoteType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${voteType === t ? "border-yellow-500 bg-yellow-500/20 text-yellow-300" : "border-yellow-600/30 text-gray-400 hover:border-yellow-500/50"}`}
                    >
                      ${t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">
                  Options (2–6) *
                </p>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: options list is order-dependent
                    <div key={idx} className="flex gap-2">
                      <Input
                        data-ocid="proposal.input"
                        value={opt}
                        onChange={(e) => updateOption(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        className="bg-black/40 border-yellow-600/30 text-gray-200 text-sm"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="text-red-400 hover:text-red-300 p-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 6 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Option
                  </button>
                )}
              </div>
              <div>
                <label
                  htmlFor="proposal-end"
                  className="text-xs text-gray-400 font-medium mb-1 block"
                >
                  End Date & Time *
                </label>
                <Input
                  id="proposal-end"
                  data-ocid="proposal.input"
                  type="datetime-local"
                  value={endDateTime}
                  onChange={(e) => setEndDateTime(e.target.value)}
                  className="bg-black/40 border-yellow-600/30 text-gray-200 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Proposal opens immediately. Set when voting should close.
                </p>
              </div>
              <Button
                data-ocid="proposal.submit_button"
                onClick={handleSubmit}
                disabled={submitting || actorLoading}
                className="w-full bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 text-black font-bold"
              >
                {actorLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />{" "}
                    Connecting…
                  </>
                ) : submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating…
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" /> Create Proposal
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CustomRewardsBanner ──────────────────────────────────────────────────────

function CustomRewardsBanner({
  customPools,
  customProposals,
  isAdmin,
  adminPassword,
  actor,
  onRefresh,
}: {
  customPools: CustomRewardsPoolEntry[];
  customProposals: CustomProposal[];
  isAdmin: boolean;
  adminPassword: string;
  actor: any;
  onRefresh: () => void;
}) {
  const [marking, setMarking] = useState<bigint | null>(null);

  if (customPools.length === 0) return null;

  async function markDistributed(proposalId: bigint) {
    if (!actor) return;
    setMarking(proposalId);
    try {
      const ok = await (actor as any).markCustomRewardsDistributed(
        adminPassword,
        proposalId,
      );
      if (ok) {
        toast.success("Marked as distributed!");
        onRefresh();
      } else toast.error("Failed to mark distributed.");
    } catch (e: any) {
      toast.error(`Error: ${e?.message}`);
    } finally {
      setMarking(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-yellow-600/40 bg-black/50 backdrop-blur-sm p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Gift className="w-5 h-5 text-yellow-400" />
        <h3 className="text-base font-bold text-yellow-300">
          Community Proposal Rewards
        </h3>
      </div>
      <div className="space-y-3">
        {customPools.map((pool) => {
          const proposal = customProposals.find(
            (p) => p.id === pool.proposalId,
          );
          const title =
            proposal?.title ?? `Proposal #${String(pool.proposalId)}`;
          const voteTypeBadge = "ICP" in pool.voteType ? "$ICP" : "$BITTYICP";
          return (
            <div
              key={String(pool.proposalId)}
              data-ocid="rewards.item.1"
              className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/5 border border-yellow-600/20"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-yellow-300 truncate">
                  {title}
                </p>
                <p className="text-xs text-gray-400">
                  {voteTypeBadge} · Losing:{" "}
                  <span className="text-yellow-400">
                    {pool.losingOptionLabel}
                  </span>{" "}
                  ({Number(pool.losingOptionPct)}%)
                </p>
                {isAdmin ? (
                  <p className="text-xs text-gray-400">
                    Pool: <span className="text-white">{pool.poolAmount}</span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">
                    Total Distribution Pool:{" "}
                    <span className="text-white">
                      {pool.poolAmount} {voteTypeBadge}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {pool.distributed ? (
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
                {isAdmin && !pool.distributed && (
                  <Button
                    data-ocid="rewards.confirm_button"
                    size="sm"
                    variant="outline"
                    onClick={() => markDistributed(pool.proposalId)}
                    disabled={marking === pool.proposalId}
                    className="border-green-500/50 text-green-400 hover:bg-green-500/10 text-xs"
                  >
                    {marking === pool.proposalId ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      "Mark Distributed"
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
  const [customProposals, setCustomProposals] = useState<CustomProposal[]>([]);
  const [customPools, setCustomPools] = useState<CustomRewardsPoolEntry[]>([]);

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

  // Verified wallet voting power
  const [verifiedWalletsVP, setVerifiedWalletsVP] = useState(0);
  useEffect(() => {
    const a = actor as any;
    if (!principal || !a || !a.getMyVerifiedWallets) {
      setVerifiedWalletsVP(0);
      return;
    }
    (async () => {
      try {
        const wallets: string[] = await a.getMyVerifiedWallets();
        const balances = await Promise.all(
          wallets.map((w: string) =>
            getBITTYBalance(w)
              .then((raw) => Number(raw) / 1e8)
              .catch(() => 0),
          ),
        );
        setVerifiedWalletsVP(
          balances.reduce((sum, b) => sum + Math.floor(b / 1000), 0),
        );
      } catch {
        setVerifiedWalletsVP(0);
      }
    })();
  }, [principal, actor]);

  const effectiveVotingPower = votingPower + verifiedWalletsVP;

  // Load votes on actor ready
  const loadVotes = useCallback(async () => {
    const a = actor as any;
    if (!a) return;
    setLoadingVotes(true);
    try {
      const [allVotes, allPools, customProps, customPoolsData] =
        await Promise.all([
          a.getAllVotes(),
          a.getRewardsPools(),
          a.getCustomProposals().catch(() => []),
          a.getCustomRewardsPools().catch(() => []),
        ]);
      setVotes(allVotes);
      setPools(allPools);
      setCustomProposals(customProps as CustomProposal[]);
      setCustomPools(customPoolsData as CustomRewardsPoolEntry[]);
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

  const nowNs = BigInt(Date.now()) * BigInt(1_000_000);

  // Live (open) votes only for the main vote cards section
  const latestBitty = bittyVotes
    .filter((v) => !v.isFinalized && v.openTime <= nowNs)
    .slice(-1)[0];
  const latestICP = icpVotes
    .filter((v) => !v.isFinalized && v.openTime <= nowNs)
    .slice(-1)[0];

  // Upcoming (not yet open) votes - deduplicated, sorted by date
  const upcomingBittyAll = bittyVotes
    .filter((v) => !v.isFinalized && v.openTime > nowNs)
    .sort((a, b) => (a.openTime < b.openTime ? -1 : 1));
  const upcomingBitty = upcomingBittyAll.slice(0, 1);

  const upcomingICPAll = icpVotes
    .filter((v) => !v.isFinalized && v.openTime > nowNs)
    .sort((a, b) => (a.openTime < b.openTime ? -1 : 1));
  const upcomingICP = upcomingICPAll.slice(0, 1);

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
            <img
              src="/assets/img_4570-019d364f-b05b-7469-b9d0-e8428c9ccfeb.jpeg"
              alt="BITTYICP coin"
              className="w-24 h-24 rounded-full object-cover coin-spin"
            />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              BITTY ON ICP GOVERNANCE
            </h1>
          </div>
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

        {/* Total Voting Power */}
        {isSignedIn && (
          <div className="rounded-2xl border border-yellow-600/40 bg-black/40 backdrop-blur-sm p-5 text-center">
            <p className="text-sm font-extrabold text-yellow-300 uppercase tracking-widest mb-2">
              TOTAL VOTING POWER
            </p>
            <p className="text-7xl font-black text-yellow-400 leading-none">
              {effectiveVotingPower}
            </p>
            <p className="text-base font-semibold text-gray-300 mt-2">votes</p>
            <p className="text-xs text-gray-500 mt-2">
              Combined balance of your connected account + all verified external
              wallets
            </p>
          </div>
        )}

        {/* Voting Power Boost Announcement */}
        {isSignedIn && (
          <div className="w-full rounded-xl border border-yellow-500/60 bg-yellow-900/20 px-4 py-3 text-center">
            <p className="text-sm font-extrabold text-yellow-300 uppercase tracking-wide">
              🔗 Boost Your Voting Power
            </p>
            <p className="text-xs text-yellow-200 mt-1">
              Hold $BITTYICP in an external wallet like Oisy? Verify it below to
              add its balance to your voting power. Each verified wallet counts
              toward your total votes.
            </p>
          </div>
        )}

        {/* My Wallet Panel */}
        {isSignedIn && principal && (
          <MyWalletPanel principal={principal} actor={actor} />
        )}

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
                    votingPower={effectiveVotingPower}
                    actor={actor}
                    isAdmin={isAdmin}
                    adminPassword={adminPassword}
                  />
                )}
                {latestICP && (
                  <VoteCard
                    vote={latestICP}
                    principal={principal}
                    votingPower={effectiveVotingPower}
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

            {/* Upcoming Votes */}
            {(upcomingBitty.length > 0 || upcomingICP.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/25 p-2.5">
                    <Clock className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-white tracking-tight">
                      Upcoming Votes
                    </h2>
                    <p className="text-xs text-gray-400">
                      Scheduled votes opening soon
                    </p>
                  </div>
                </div>
                {[...upcomingBitty, ...upcomingICP].map((vote) => (
                  <VoteCard
                    key={String(vote.id)}
                    vote={vote}
                    principal={principal}
                    votingPower={effectiveVotingPower}
                    actor={actor}
                    isAdmin={isAdmin}
                    adminPassword={adminPassword}
                  />
                ))}
              </motion.div>
            )}

            {/* Community Proposals */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-xl bg-yellow-500/10 border border-yellow-500/25 p-2.5">
                  <FileText className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-white tracking-tight">
                    Community Proposals
                  </h2>
                  <p className="text-xs text-gray-400">
                    Admin-created votes on specific treasury decisions
                  </p>
                </div>
              </div>

              {/* Admin: Create Proposal Form */}
              {isAdmin && (
                <CreateProposalForm
                  actor={actor}
                  adminPassword={adminPassword}
                  onCreated={loadVotes}
                />
              )}

              {customProposals.length === 0 ? (
                <div
                  data-ocid="proposals.empty_state"
                  className="text-center py-8 text-gray-500"
                >
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No community proposals yet.</p>
                  {isAdmin && (
                    <p className="text-xs mt-1">
                      Create one above to get started.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {customProposals.map((p) => (
                    <CustomProposalCard
                      key={String(p.id)}
                      proposal={p}
                      principal={principal}
                      votingPower={effectiveVotingPower}
                      actor={actor}
                      isAdmin={isAdmin}
                      adminPassword={adminPassword}
                      onRefresh={loadVotes}
                    />
                  ))}
                </div>
              )}
            </motion.div>

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

            {/* Custom Proposal Rewards - All users */}
            {customPools.length > 0 && (
              <CustomRewardsBanner
                customPools={customPools}
                customProposals={customProposals}
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
        <div className="text-center pb-4">
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

      <Toaster richColors position="top-right" />
    </div>
  );
}
