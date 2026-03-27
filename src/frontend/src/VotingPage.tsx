import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { getBITTYBalance } from "@/utils/ledgerActors";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  Loader2,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Users,
  Vote as VoteIcon,
  Wallet,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";

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

interface ProposalData {
  id: bigint;
  title: string;
  description: string;
  options: string[];
  startTime: bigint;
  endTime: bigint;
  isOpen: boolean;
}

interface VoteData {
  proposalId: bigint;
  voterPrincipal: string;
  optionIndex: bigint;
  weight: bigint;
}

interface ChatMsg {
  id: bigint;
  proposalId: bigint;
  author: string;
  message: string;
  timestamp: bigint;
}

interface VotingPageProps {
  onBack: () => void;
  isAdmin: boolean;
  adminPassword: string;
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

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts / BigInt(1_000_000));
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HowItWorksSection() {
  const [open, setOpen] = useState(false);
  const items = [
    {
      icon: "🪙",
      title: "Minimum 1,000 $BITTYICP required",
      desc: "You must hold at least 1,000 $BITTYICP tokens in your wallet to participate in voting. This ensures only genuine community members vote.",
    },
    {
      icon: "⚡",
      title: "Voting Power = BITTYICP ÷ 1,000",
      desc: "Every 1,000 $BITTYICP gives you 1 vote. Hold 10,000 BITTYICP? You cast 10 votes. More skin in the game = more say.",
    },
    {
      icon: "🔐",
      title: "Connect your wallet to prove ownership",
      desc: "Connect your wallet (Internet Identity or Plug) to prove you own the address. The app automatically reads your principal and checks your $BITTYICP balance — no copy-pasting needed.",
    },
    {
      icon: "📅",
      title: "7-Day Voting Window",
      desc: "Each proposal stays open for a full 7 days so all investors have time to review and cast their vote.",
    },
    {
      icon: "📊",
      title: "Live Results",
      desc: "Vote tallies update in real-time. Anyone can view results — only eligible BITTYICP holders can vote.",
    },
    {
      icon: "💬",
      title: "Community Chat",
      desc: "Each proposal has a dedicated chat so the community can discuss before voting. Requires wallet sign-in.",
    },
  ];

  return (
    <div className="glass-card border border-[oklch(0.87_0.17_90/0.25)] rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[oklch(0.87_0.17_90/0.05)] transition-colors"
        data-ocid="how_it_works.toggle"
      >
        <div className="flex items-center gap-2 text-gold font-heading font-bold tracking-wide">
          <HelpCircle className="h-5 w-5" />
          <span>How Voting Works</span>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-gold" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gold" />
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
            <div className="px-6 pb-6 space-y-4 text-sm text-muted-foreground border-t border-[oklch(0.87_0.17_90/0.15)]">
              <div className="grid gap-3 pt-4">
                {items.map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <span className="text-xl mt-0.5">{item.icon}</span>
                    <div>
                      <p className="font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProposalCard({
  proposal,
  onClick,
}: {
  proposal: ProposalData;
  onClick: () => void;
}) {
  const isExpired = BigInt(Date.now()) * BigInt(1_000_000) > proposal.endTime;
  const isOpen = proposal.isOpen && !isExpired;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="glass-card border border-[oklch(0.87_0.17_90/0.25)] rounded-2xl p-5 cursor-pointer hover:border-[oklch(0.87_0.17_90/0.5)] hover:bg-[oklch(0.87_0.17_90/0.05)] transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge
              className={
                isOpen
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs"
                  : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-xs"
              }
            >
              {isOpen ? "OPEN" : "CLOSED"}
            </Badge>
          </div>
          <h3 className="font-heading font-bold text-foreground text-base leading-tight">
            {proposal.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {proposal.description}
          </p>
        </div>
        <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {timeRemaining(proposal.endTime)}
        </span>
        <span className="flex items-center gap-1">
          <VoteIcon className="h-3.5 w-3.5" />
          {proposal.options.length} options
        </span>
      </div>
    </motion.div>
  );
}

function ChatSection({
  proposalId,
  actor,
  identity,
  plugPrincipal,
}: {
  proposalId: bigint;
  actor: any;
  identity: any;
  plugPrincipal?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatName, setChatName] = useState("");
  const [chatMsg, setChatMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activePrincipal = identity
    ? identity.getPrincipal().toString()
    : (plugPrincipal ?? null);

  const loadMessages = useCallback(async () => {
    if (!actor) return;
    try {
      const msgs = await (actor as any).getChatMessages(proposalId);
      const sorted = [...msgs].sort((a: ChatMsg, b: ChatMsg) =>
        a.timestamp > b.timestamp ? 1 : -1,
      );
      setMessages(sorted);
    } catch (e) {
      console.error("chat load error", e);
    }
  }, [actor, proposalId]);

  useEffect(() => {
    setChatLoading(true);
    loadMessages().finally(() => setChatLoading(false));
  }, [loadMessages]);

  useEffect(() => {
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activePrincipal) {
      setChatName(`${activePrincipal.slice(0, 10)}...`);
    }
  }, [activePrincipal]);

  async function handleSend() {
    if (!actor || !chatMsg.trim() || !chatName.trim()) return;
    setSending(true);
    try {
      const result = await (actor as any).addChatMessage(
        proposalId,
        chatName,
        chatMsg.trim(),
      );
      if (result) {
        setChatMsg("");
        await loadMessages();
      } else {
        toast.error("Failed to send message. Make sure you are signed in.");
      }
    } catch (_e) {
      toast.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  const CHAT_COLORS = [
    "text-amber-400",
    "text-sky-400",
    "text-emerald-400",
    "text-rose-400",
    "text-violet-400",
    "text-orange-400",
  ];

  function colorForAuthor(author: string) {
    let hash = 0;
    for (let i = 0; i < author.length; i++)
      hash = author.charCodeAt(i) + ((hash << 5) - hash);
    return CHAT_COLORS[Math.abs(hash) % CHAT_COLORS.length];
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2 text-gold font-heading font-bold">
        <MessageSquare className="h-5 w-5" />
        <span>Proposal Chat</span>
        <span className="text-xs text-muted-foreground font-normal">
          — discuss before you vote 💬
        </span>
      </div>

      <div className="glass-card border border-[oklch(0.87_0.17_90/0.2)] rounded-2xl overflow-hidden">
        <div
          className="h-64 overflow-y-auto p-4 space-y-3"
          data-ocid="chat.panel"
        >
          {chatLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          )}
          {!chatLoading && messages.length === 0 && (
            <div
              className="text-center text-muted-foreground text-sm py-8"
              data-ocid="chat.empty_state"
            >
              🌟 Be the first to start the conversation!
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={String(msg.id)}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex gap-2.5 items-start"
              >
                <div className="w-7 h-7 rounded-full bg-[oklch(0.87_0.17_90/0.15)] border border-[oklch(0.87_0.17_90/0.3)] flex items-center justify-center shrink-0 text-xs font-bold text-gold">
                  {msg.author.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-xs font-bold ${colorForAuthor(msg.author)} truncate max-w-[120px]`}
                    >
                      {msg.author}
                    </span>
                    <span className="text-xs text-muted-foreground/50 shrink-0">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-snug mt-0.5 break-words">
                    {msg.message}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[oklch(0.87_0.17_90/0.15)] p-3 space-y-2">
          {!activePrincipal ? (
            <p className="text-xs text-muted-foreground text-center py-1">
              🔒 Sign in with a wallet to chat
            </p>
          ) : (
            <>
              <Input
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder="Display name"
                className="text-xs h-8 bg-black/30 border-[oklch(0.87_0.17_90/0.2)] text-foreground"
                data-ocid="chat.input"
              />
              <div className="flex gap-2">
                <Textarea
                  value={chatMsg}
                  onChange={(e) => setChatMsg(e.target.value)}
                  placeholder="Share your thoughts... 🚀"
                  className="text-sm bg-black/30 border-[oklch(0.87_0.17_90/0.2)] text-foreground resize-none min-h-[60px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  data-ocid="chat.textarea"
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !chatMsg.trim() || !chatName.trim()}
                  size="icon"
                  className="bg-[oklch(0.87_0.17_90/0.15)] border border-[oklch(0.87_0.17_90/0.4)] text-gold hover:bg-[oklch(0.87_0.17_90/0.25)] shrink-0 self-end h-[60px] w-10"
                  data-ocid="chat.submit_button"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProposalDetail({
  proposal,
  onBack,
  isAdmin,
  adminPassword,
}: {
  proposal: ProposalData;
  onBack: () => void;
  isAdmin: boolean;
  adminPassword: string;
}) {
  const { actor } = useActor();
  const { identity, login, isLoggingIn, clear } = useInternetIdentity();

  const [plugPrincipal, setPlugPrincipal] = useState<string | null>(null);
  const [plugConnecting, setPlugConnecting] = useState(false);

  const [votes, setVotes] = useState<VoteData[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [bittyBalance, setBittyBalance] = useState<bigint | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [votingPower, setVotingPower] = useState<number>(0);
  const [hasVotedState, setHasVotedState] = useState(false);
  const [casting, setCasting] = useState(false);
  const [closing, setClosing] = useState(false);

  const activePrincipal: string | null =
    identity?.getPrincipal().toString() ?? plugPrincipal ?? null;

  const isExpired = BigInt(Date.now()) * BigInt(1_000_000) > proposal.endTime;
  const isOpen = proposal.isOpen && !isExpired;

  // Load votes on mount
  useEffect(() => {
    async function loadVotes() {
      if (!actor) return;
      try {
        const v = await (actor as any).getVotesForProposal(proposal.id);
        setVotes(v);
      } catch (_e) {
        console.error("load votes error");
      }
    }
    loadVotes();
  }, [actor, proposal.id]);

  // Check if already voted when activePrincipal is known
  useEffect(() => {
    async function checkVoted() {
      if (!actor || !activePrincipal) return;
      try {
        const voted = await (actor as any).hasVoted(
          proposal.id,
          activePrincipal,
        );
        setHasVotedState(voted);
      } catch (_e) {
        console.error("hasVoted error");
      }
    }
    if (activePrincipal) checkVoted();
  }, [actor, proposal.id, activePrincipal]);

  // Auto-check balance when principal is available
  useEffect(() => {
    if (activePrincipal) {
      handleCheckBalance(activePrincipal);
    } else {
      setBittyBalance(null);
      setVotingPower(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePrincipal]);

  async function handleCheckBalance(principal: string) {
    setCheckingBalance(true);
    try {
      const bal = await getBITTYBalance(principal);
      setBittyBalance(bal);
      if (bal !== null) {
        const tokenAmount = Number(bal) / 1e8;
        const power = Math.floor(tokenAmount / 1000);
        setVotingPower(power);
        if (power < 1) {
          toast.error("You need at least 1,000 $BITTYICP to vote");
        } else {
          toast.success(`Voting power: ${power} vote${power !== 1 ? "s" : ""}`);
        }
      }
    } catch (_e) {
      toast.error("Failed to check balance");
    } finally {
      setCheckingBalance(false);
    }
  }

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
        const principal = await window.ic.plug.agent?.getPrincipal();
        setPlugPrincipal(principal?.toString() ?? null);
      } else {
        toast.error("Plug wallet connection was rejected.");
      }
    } catch (_e) {
      toast.error("Failed to connect Plug wallet.");
    } finally {
      setPlugConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (identity) {
      clear();
    }
    if (plugPrincipal) {
      try {
        await window.ic?.plug?.disconnect();
      } catch (_e) {
        // ignore
      }
      setPlugPrincipal(null);
    }
    setBittyBalance(null);
    setVotingPower(0);
    setHasVotedState(false);
    setSelectedOption(null);
  }

  async function handleCastVote() {
    if (!actor || selectedOption === null || !activePrincipal) return;
    setCasting(true);
    try {
      const result = await (actor as any).castVote(
        proposal.id,
        activePrincipal,
        BigInt(selectedOption),
        BigInt(votingPower),
      );
      if (result) {
        toast.success("Vote cast successfully! 🎉");
        setHasVotedState(true);
        const v = await (actor as any).getVotesForProposal(proposal.id);
        setVotes(v);
      } else {
        toast.error("Failed to cast vote. You may have already voted.");
      }
    } catch (_e) {
      toast.error("Vote failed. Please try again.");
    } finally {
      setCasting(false);
    }
  }

  async function handleClose() {
    if (!actor) return;
    setClosing(true);
    try {
      const result = await (actor as any).closeProposal(
        adminPassword,
        proposal.id,
      );
      if (result) {
        toast.success("Proposal closed");
        onBack();
      } else {
        toast.error("Failed to close proposal");
      }
    } catch (_e) {
      toast.error("Failed to close proposal");
    } finally {
      setClosing(false);
    }
  }

  const voteTotals = proposal.options.map((_, i) =>
    votes
      .filter((v) => Number(v.optionIndex) === i)
      .reduce((sum, v) => sum + Number(v.weight), 0),
  );
  const totalVotes = voteTotals.reduce((a, b) => a + b, 0);
  const tokenAmount = bittyBalance !== null ? Number(bittyBalance) / 1e8 : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold transition-colors"
          data-ocid="proposal_detail.back_button"
        >
          <ArrowLeft className="h-4 w-4" /> Back to proposals
        </button>
      </div>

      <div className="glass-card-gold border border-[oklch(0.87_0.17_90/0.35)] rounded-2xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                className={
                  isOpen
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
                }
              >
                {isOpen ? "OPEN" : "CLOSED"}
              </Badge>
            </div>
            <h2 className="font-heading font-bold text-2xl text-foreground">
              {proposal.title}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {proposal.description}
            </p>
          </div>
          {isAdmin && isOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={closing}
              className="border-red-500/40 text-red-400 hover:bg-red-500/10 shrink-0"
              data-ocid="proposal_detail.close_button"
            >
              {closing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
              Close
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {timeRemaining(proposal.endTime)}
        </p>
      </div>

      {/* Results */}
      <Card className="bg-black/30 border-[oklch(0.87_0.17_90/0.25)] rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-gold font-heading text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Live Results
            <span className="text-xs text-muted-foreground font-normal ml-1">
              {totalVotes} total weighted vote{totalVotes !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {proposal.options.map((opt, i) => {
            const pct =
              totalVotes > 0
                ? Math.round((voteTotals[i] / totalVotes) * 100)
                : 0;
            return (
              <div key={opt} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">{opt}</span>
                  <span className="text-muted-foreground text-xs">
                    {voteTotals[i]} votes ({pct}%)
                  </span>
                </div>
                <Progress value={pct} className="h-2 bg-black/40" />
              </div>
            );
          })}
          {votes.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No votes yet — be the first!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Voting section */}
      {isOpen && (
        <Card className="bg-black/30 border-[oklch(0.87_0.17_90/0.25)] rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-gold font-heading text-sm flex items-center gap-2">
              <VoteIcon className="h-4 w-4" /> Cast Your Vote
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activePrincipal ? (
              /* Not signed in — show two wallet options */
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground text-center">
                  Connect the wallet that holds your $BITTYICP to vote
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Internet Identity */}
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      onClick={login}
                      disabled={isLoggingIn}
                      className="w-full bg-[oklch(0.87_0.17_90/0.15)] border border-[oklch(0.87_0.17_90/0.4)] text-gold hover:bg-[oklch(0.87_0.17_90/0.25)]"
                      data-ocid="voting.login_button"
                    >
                      {isLoggingIn ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 mr-2" />
                      )}
                      Internet Identity
                    </Button>
                    <p className="text-[10px] text-muted-foreground/70 text-center leading-snug px-1">
                      Supports NNS, Oisy, NFID, and any Internet Identity-based
                      wallet
                    </p>
                  </div>

                  {/* Plug Wallet */}
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      onClick={connectPlug}
                      disabled={plugConnecting}
                      className="w-full bg-[oklch(0.87_0.17_90/0.15)] border border-[oklch(0.87_0.17_90/0.4)] text-gold hover:bg-[oklch(0.87_0.17_90/0.25)]"
                      data-ocid="voting.plug_button"
                    >
                      {plugConnecting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wallet className="h-4 w-4 mr-2" />
                      )}
                      Connect Plug Wallet
                    </Button>
                    <p className="text-[10px] text-muted-foreground/70 text-center leading-snug px-1">
                      Supports Plug browser extension wallet
                    </p>
                  </div>
                </div>
              </div>
            ) : hasVotedState ? (
              <div
                className="flex items-center gap-2 text-emerald-400 text-sm py-4 justify-center"
                data-ocid="voting.success_state"
              >
                <CheckCircle2 className="h-5 w-5" />
                You have already voted on this proposal
              </div>
            ) : (
              <div className="space-y-4">
                {/* Signed-in identity info */}
                <div className="flex items-center justify-between bg-[oklch(0.87_0.17_90/0.08)] border border-[oklch(0.87_0.17_90/0.2)] rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {checkingBalance ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-gold shrink-0" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5 text-gold shrink-0" />
                    )}
                    <span className="text-xs text-muted-foreground truncate">
                      {checkingBalance
                        ? `Checking balance for: ${activePrincipal.slice(0, 20)}...`
                        : `Connected: ${activePrincipal.slice(0, 20)}...`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors shrink-0 ml-2"
                    data-ocid="voting.toggle"
                  >
                    <LogOut className="h-3 w-3" />
                    Disconnect
                  </button>
                </div>

                {/* Balance result */}
                {!checkingBalance && bittyBalance !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl p-3 text-sm ${
                      votingPower >= 1
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                        : "bg-red-500/10 border border-red-500/30 text-red-400"
                    }`}
                    data-ocid="voting.success_state"
                  >
                    <div className="font-medium">
                      {tokenAmount?.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      $BITTYICP
                    </div>
                    {votingPower >= 1 ? (
                      <div className="text-xs mt-0.5">
                        ⚡ Voting power: <strong>{votingPower}</strong> vote
                        {votingPower !== 1 ? "s" : ""}
                      </div>
                    ) : (
                      <div className="text-xs mt-0.5">
                        You need at least 1,000 $BITTYICP to vote
                      </div>
                    )}
                  </motion.div>
                )}

                {!checkingBalance && votingPower >= 1 && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium">
                      Select an option
                    </p>
                    <div className="space-y-2">
                      {proposal.options.map((opt, i) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedOption(i)}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                            selectedOption === i
                              ? "bg-[oklch(0.87_0.17_90/0.15)] border-[oklch(0.87_0.17_90/0.6)] text-gold font-medium"
                              : "bg-black/20 border-[oklch(0.87_0.17_90/0.2)] text-foreground hover:border-[oklch(0.87_0.17_90/0.4)]"
                          }`}
                          data-ocid="voting.radio"
                        >
                          <span className="mr-2">
                            {selectedOption === i ? "●" : "○"}
                          </span>
                          {opt}
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={handleCastVote}
                      disabled={casting || selectedOption === null}
                      className="w-full bg-[oklch(0.87_0.17_90/0.15)] border border-[oklch(0.87_0.17_90/0.5)] text-gold hover:bg-[oklch(0.87_0.17_90/0.25)] font-heading font-bold tracking-wide"
                      data-ocid="voting.submit_button"
                    >
                      {casting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Casting Vote...
                        </>
                      ) : (
                        `Cast Vote (${votingPower} vote${votingPower !== 1 ? "s" : ""})`
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ChatSection
        proposalId={proposal.id}
        actor={actor}
        identity={identity}
        plugPrincipal={plugPrincipal}
      />
    </motion.div>
  );
}

function CreateProposalForm({
  onCreated,
  adminPassword,
}: {
  onCreated: () => void;
  adminPassword: string;
}) {
  const { actor } = useActor();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["Yes", "No"]);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  function addOption() {
    if (options.length < 5) setOptions([...options, ""]);
  }

  function removeOption(i: number) {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
  }

  async function handleCreate() {
    if (!actor) {
      toast.error("Backend not ready");
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error("Fill in title and description");
      return;
    }
    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      toast.error("At least 2 options required");
      return;
    }
    setCreating(true);
    try {
      const result = await (actor as any).createProposal(
        adminPassword,
        title.trim(),
        description.trim(),
        validOptions,
      );
      if (result) {
        toast.success("Proposal created! 🎉");
        setTitle("");
        setDescription("");
        setOptions(["Yes", "No"]);
        setOpen(false);
        onCreated();
      } else {
        toast.error("Failed to create proposal");
      }
    } catch (_e) {
      toast.error("Failed to create proposal");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="glass-card border border-[oklch(0.87_0.17_90/0.35)] rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[oklch(0.87_0.17_90/0.05)] transition-colors"
        data-ocid="create_proposal.open_modal_button"
      >
        <div className="flex items-center gap-2 text-gold font-heading font-bold">
          <Plus className="h-5 w-5" />
          Create New Proposal
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-gold" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gold" />
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
            <div className="px-6 pb-6 space-y-4 border-t border-[oklch(0.87_0.17_90/0.15)]">
              <div className="space-y-2 pt-4">
                <p className="text-xs text-muted-foreground font-medium">
                  Proposal Title
                </p>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Monthly vs Weekly Dividends"
                  className="bg-black/30 border-[oklch(0.87_0.17_90/0.2)] text-foreground"
                  data-ocid="create_proposal.input"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Description
                </p>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what the community is voting on..."
                  className="bg-black/30 border-[oklch(0.87_0.17_90/0.2)] text-foreground min-h-[80px] resize-none"
                  data-ocid="create_proposal.textarea"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Voting Options
                </p>
                {options.map((opt, i) => (
                  <div key={`option-${i + 1}`} className="flex gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = e.target.value;
                        setOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="bg-black/30 border-[oklch(0.87_0.17_90/0.2)] text-foreground"
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeOption(i)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {options.length < 5 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addOption}
                    className="text-muted-foreground hover:text-gold text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add option
                  </Button>
                )}
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="w-full bg-[oklch(0.87_0.17_90/0.15)] border border-[oklch(0.87_0.17_90/0.5)] text-gold hover:bg-[oklch(0.87_0.17_90/0.25)] font-heading font-bold"
                data-ocid="create_proposal.submit_button"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Proposal (7-day voting window)"
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VotingPage({
  onBack,
  isAdmin,
  adminPassword,
}: VotingPageProps) {
  const { actor } = useActor();
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<ProposalData | null>(
    null,
  );

  const loadProposals = useCallback(async () => {
    if (!actor) return;
    try {
      const p = await (actor as any).getProposals();
      const sorted = [...p].sort((a: ProposalData, b: ProposalData) =>
        b.startTime > a.startTime ? 1 : -1,
      );
      setProposals(sorted);
    } catch (_e) {
      console.error("load proposals error");
    }
  }, [actor]);

  useEffect(() => {
    if (!actor) return;
    setLoading(true);
    loadProposals().finally(() => setLoading(false));
  }, [actor, loadProposals]);

  const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
  const openProposals = proposals.filter((p) => p.isOpen && nowNs <= p.endTime);
  const closedProposals = proposals.filter(
    (p) => !p.isOpen || nowNs > p.endTime,
  );

  return (
    <div className="min-h-screen relative overflow-x-hidden font-body">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/assets/uploads/IMG_5288-1.jpeg')" }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[oklch(0.08_0.03_252/0.40)] via-[oklch(0.10_0.025_252/0.35)] to-[oklch(0.05_0.01_252/0.55)]" />
      <Toaster position="top-right" richColors />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="sticky top-0 z-20 glass-card border-b border-border/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-gold transition-colors"
              data-ocid="voting_page.back_button"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm">Back to Bank</span>
            </button>
            <div className="text-center">
              <h1 className="font-heading font-bold text-xl sm:text-2xl text-foreground tracking-tight flex items-center gap-2">
                <VoteIcon className="h-6 w-6 text-gold" />
                COMMUNITY VOTING
              </h1>
              <p className="text-xs text-muted-foreground">
                Governance by $BITTYICP holders
              </p>
            </div>
            <div className="w-24" />
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 space-y-6">
          <AnimatePresence mode="wait">
            {selectedProposal ? (
              <ProposalDetail
                key={String(selectedProposal.id)}
                proposal={selectedProposal}
                onBack={() => {
                  setSelectedProposal(null);
                  loadProposals();
                }}
                isAdmin={isAdmin}
                adminPassword={adminPassword}
              />
            ) : (
              <motion.div
                key="proposals-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <HowItWorksSection />

                {isAdmin && (
                  <CreateProposalForm
                    onCreated={loadProposals}
                    adminPassword={adminPassword}
                  />
                )}

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Active Proposals", value: openProposals.length },
                    { label: "Total Proposals", value: proposals.length },
                    { label: "Min. to Vote", value: "1,000 BITTY" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="glass-card-gold border border-[oklch(0.87_0.17_90/0.25)] rounded-xl p-3 text-center"
                    >
                      <p className="text-xl font-heading font-bold text-gold">
                        {stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                {loading ? (
                  <div
                    className="flex justify-center py-12"
                    data-ocid="proposals.loading_state"
                  >
                    <Loader2 className="h-8 w-8 animate-spin text-gold" />
                  </div>
                ) : (
                  <>
                    {openProposals.length > 0 && (
                      <div className="space-y-3">
                        <h2 className="font-heading font-bold text-gold text-sm tracking-widest uppercase">
                          Active Proposals
                        </h2>
                        {openProposals.map((p, idx) => (
                          <div
                            key={String(p.id)}
                            data-ocid={`proposals.item.${idx + 1}`}
                          >
                            <ProposalCard
                              proposal={p}
                              onClick={() => setSelectedProposal(p)}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {proposals.length === 0 && (
                      <div
                        className="text-center py-16 space-y-3"
                        data-ocid="proposals.empty_state"
                      >
                        <VoteIcon className="h-12 w-12 text-gold/30 mx-auto" />
                        <p className="text-foreground font-heading font-bold text-lg">
                          No proposals yet
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {isAdmin
                            ? "Create the first proposal using the form above."
                            : "Check back soon for community governance proposals."}
                        </p>
                      </div>
                    )}

                    {closedProposals.length > 0 && (
                      <div className="space-y-3">
                        <h2 className="font-heading font-bold text-muted-foreground text-sm tracking-widest uppercase">
                          Past Proposals
                        </h2>
                        {closedProposals.map((p, idx) => (
                          <div
                            key={String(p.id)}
                            data-ocid={`proposals.item.${idx + 1}`}
                          >
                            <ProposalCard
                              proposal={p}
                              onClick={() => setSelectedProposal(p)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="relative z-10 border-t border-[oklch(0.87_0.17_90/0.15)] py-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()}.{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold transition-colors"
            >
              Built with love using caffeine.ai
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
