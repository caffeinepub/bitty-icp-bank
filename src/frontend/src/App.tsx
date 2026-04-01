import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { setCachedActor } from "@/hooks/actorCache";
import { useActor } from "@/hooks/useActor";
import {
  type Announcement,
  useAddAnnouncement,
  useAdminLogin,
  useDeleteAnnouncement,
  useGetAdminConfig,
  useGetAnnouncements,
  useGetFundBalance,
  useGetGamesWalletBalances,
  useGetLiveBalances,
  useGetManualBalances,
  useGetNeuronStake,
  useSetGamesWallet,
  useSetManualBalances,
  useSetManualBittyPrice,
  useSetManualFundBalance,
  useTokenPrices,
  useUpdateAnnouncement,
} from "@/hooks/useQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gamepad2,
  HelpCircle,
  Landmark,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import VotingPage from "./VotingPage";

const HIDE_BALANCES = false;

const NEURON_ID = "2927437143767212939";
const ADMIN_PASSWORD = "bittybittywhatwhat";

function copyToClipboard(text: string, label: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast.success(`${label} copied to clipboard!`);
    })
    .catch(() => {
      toast.error("Failed to copy to clipboard");
    });
}

function CopyableId({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="font-mono text-xs text-muted-foreground break-all bg-black/20 rounded-lg px-3 py-1.5 flex-1">
        {value}
      </span>
      <button
        type="button"
        onClick={() => copyToClipboard(value, label)}
        className="shrink-0 p-1.5 rounded-lg border border-[oklch(0.87_0.17_90/0.3)] bg-[oklch(0.87_0.17_90/0.08)] text-gold hover:bg-[oklch(0.87_0.17_90/0.18)] transition-colors"
        title={`Copy ${label}`}
        data-ocid={`copy.${label.toLowerCase().replace(/\s/g, "_")}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function formatBalance(raw: bigint): string {
  const n = Number(raw);
  return (n / 1e8).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

function formatUsd(amount: number): string {
  if (amount >= 1000) {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatDate(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  return new Date(ms).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Resolve displayed balance as a number for USD calc
function resolveBalanceNumber(
  manualValue: string | undefined,
  liveValue: bigint | null | undefined,
): number | null {
  if (manualValue && manualValue.trim() !== "") {
    const n = Number.parseFloat(manualValue.replace(/,/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  if (liveValue !== null && liveValue !== undefined) {
    return Number(liveValue) / 1e8;
  }
  return null;
}

// ─── Balance Card ────────────────────────────────────────────────────────────
interface BalanceCardProps {
  token: string;
  symbol: string;
  liveValue: bigint | null | undefined;
  manualValue: string | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  usdPrice: number | null | undefined; // price per token in USD
  explorerUrl?: string;
}

function BalanceCard({
  token,
  symbol,
  liveValue,
  manualValue,
  isLoading,
  isAdmin,
  usdPrice,
  explorerUrl,
}: BalanceCardProps) {
  const hasManual = manualValue && manualValue.trim() !== "";
  const hasLive = liveValue !== null && liveValue !== undefined;
  const showingManual = hasManual;
  const cardClass = "glass-card-gold gold-glow";
  const amountClass = "text-gold";

  const balanceNum = resolveBalanceNumber(manualValue, liveValue);
  const usdValue =
    balanceNum !== null && usdPrice != null && usdPrice > 0
      ? balanceNum * usdPrice
      : null;

  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`${cardClass} rounded-2xl p-6 flex flex-col gap-2 min-w-0 flex-1 ${explorerUrl ? "cursor-pointer hover:ring-2 hover:ring-[oklch(0.87_0.17_90/0.5)] transition-all" : ""}`}
    >
      <div className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
        {token}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-1">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : (
        <div
          className={`text-3xl font-heading font-bold ${amountClass} tabular-nums break-all`}
        >
          {HIDE_BALANCES ? (
            <span>0</span>
          ) : hasManual ? (
            manualValue
          ) : hasLive ? (
            formatBalance(liveValue!)
          ) : (
            <span className="opacity-40">0</span>
          )}
        </div>
      )}
      <div className="text-xs text-muted-foreground font-mono">{symbol}</div>
      {isLoading ? (
        <div className="text-xs text-muted-foreground opacity-50 mt-0.5">
          Loading…
        </div>
      ) : HIDE_BALANCES ? (
        <div className="text-sm text-muted-foreground mt-0.5">$0.00 USD</div>
      ) : usdValue !== null ? (
        <div className="text-sm text-muted-foreground mt-0.5">
          {formatUsd(usdValue)} USD
        </div>
      ) : null}
      {!isLoading && usdValue === null && showingManual && isAdmin && (
        <Badge
          variant="outline"
          className="text-xs border-yellow-500/40 text-yellow-400 self-start"
        >
          <AlertTriangle className="h-3 w-3 mr-1" /> MANUAL
        </Badge>
      )}
      {explorerUrl && (
        <div className="text-xs text-muted-foreground/50 mt-1">
          View on IC Dashboard ↗
        </div>
      )}
    </motion.div>
  );

  if (explorerUrl) {
    return (
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block min-w-0 flex-1"
      >
        {cardContent}
      </a>
    );
  }
  return cardContent;
}

// ─── Admin Panel ─────────────────────────────────────────────────────────────
interface AdminPanelProps {
  password: string;
  onLogout: () => void;
  announcements: Announcement[];
}

function AdminPanel({ password, onLogout, announcements }: AdminPanelProps) {
  const { actor } = useActor();
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [manualIcp, setManualIcp] = useState("");
  const [manualBitty, setManualBitty] = useState("");
  const [manualFund, setManualFund] = useState("");

  const addAnn = useAddAnnouncement();
  const updateAnn = useUpdateAnnouncement();
  const deleteAnn = useDeleteAnnouncement();
  const setManual = useSetManualBalances();
  const setManualFundBalance = useSetManualFundBalance();
  const setManualBittyPriceMutation = useSetManualBittyPrice();
  const setGamesWalletMutation = useSetGamesWallet();
  const [manualBittyPrice, setManualBittyPrice] = useState("");
  const [gamesWalletInput, setGamesWalletInput] = useState("");
  const [resetWalletsLoading, setResetWalletsLoading] = useState(false);
  const [resetWalletsConfirm, setResetWalletsConfirm] = useState(false);

  async function handlePostAnnouncement() {
    if (!annTitle.trim() || !annBody.trim()) {
      toast.error("Title and body are required");
      return;
    }
    try {
      await addAnn.mutateAsync({
        password,
        title: annTitle.trim(),
        body: annBody.trim(),
        actor,
      });
      toast.success("Announcement posted!");
      setAnnTitle("");
      setAnnBody("");
    } catch (e: any) {
      toast.error(`Failed to post announcement: ${e?.message ?? String(e)}`);
    }
  }

  async function handleUpdateAnnouncement(id: bigint) {
    if (!editTitle.trim() || !editBody.trim()) {
      toast.error("Title and body are required");
      return;
    }
    await updateAnn.mutateAsync({
      password,
      id,
      title: editTitle.trim(),
      body: editBody.trim(),
      actor,
    });
    toast.success("Announcement updated!");
    setEditingId(null);
  }

  async function handleDeleteAnnouncement(id: bigint) {
    await deleteAnn.mutateAsync({ password, id, actor });
    toast.success("Announcement deleted");
  }

  async function handleSaveTreasuryManual() {
    if (!manualIcp.trim() && !manualBitty.trim()) {
      toast.error("Enter at least one balance");
      return;
    }
    await setManual.mutateAsync({
      password,
      icp: manualIcp.trim(),
      bitty: manualBitty.trim(),
      actor,
    });
    toast.success("Treasury manual balances saved!");
    setManualIcp("");
    setManualBitty("");
  }

  async function handleClearTreasuryManual() {
    await setManual.mutateAsync({ password, icp: "", bitty: "", actor });
    toast.success("Treasury manual balances cleared — live values will show");
    setManualIcp("");
    setManualBitty("");
  }

  async function handleSaveFundManual() {
    if (!manualFund.trim()) {
      toast.error("Enter a balance amount");
      return;
    }
    await setManualFundBalance.mutateAsync({
      password,
      fund: manualFund.trim(),
      actor,
    });
    toast.success("Fund manual balance saved!");
    setManualFund("");
  }

  async function handleClearFundManual() {
    await setManualFundBalance.mutateAsync({ password, fund: "", actor });
    toast.success("Fund manual balance cleared — live value will show");
    setManualFund("");
  }

  async function handleSaveBittyPrice() {
    const trimmed = manualBittyPrice.trim();
    if (!trimmed) {
      toast.error("Enter a price");
      return;
    }
    const num = Number.parseFloat(trimmed);
    if (Number.isNaN(num) || num <= 0) {
      toast.error("Enter a valid positive number");
      return;
    }
    try {
      await setManualBittyPriceMutation.mutateAsync({
        password,
        price: trimmed,
        actor,
      });
      toast.success("BITTYICP price saved!");
      setManualBittyPrice("");
    } catch {
      toast.error("Failed to save price");
    }
  }

  async function handleClearBittyPrice() {
    try {
      await setManualBittyPriceMutation.mutateAsync({
        password,
        price: "",
        actor,
      });
      toast.success(
        "BITTYICP price cleared — live price will be used if available",
      );
      setManualBittyPrice("");
    } catch {
      toast.error("Failed to clear price");
    }
  }

  async function handleSaveGamesWallet() {
    const trimmed = gamesWalletInput.trim();
    if (!trimmed) {
      toast.error("Enter a wallet address");
      return;
    }
    try {
      await setGamesWalletMutation.mutateAsync({
        password,
        addr: trimmed,
        actor,
      });
      toast.success("Games wallet address saved!");
      setGamesWalletInput("");
    } catch {
      toast.error("Failed to save games wallet");
    }
  }

  async function handleClearGamesWallet() {
    try {
      await setGamesWalletMutation.mutateAsync({ password, addr: "", actor });
      toast.success("Games wallet cleared");
      setGamesWalletInput("");
    } catch {
      toast.error("Failed to clear");
    }
  }
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-icp" />
          <span className="font-heading font-bold text-lg text-icp">
            Admin Panel
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          data-ocid="admin.logout_button"
        >
          <LogOut className="h-4 w-4 mr-1" /> Logout
        </Button>
      </div>

      {/* Post Announcement */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <h3 className="font-heading font-semibold text-sm tracking-widest uppercase text-muted-foreground">
          Post Announcement
        </h3>
        <Input
          id="ann-title"
          placeholder="Title"
          value={annTitle}
          onChange={(e) => setAnnTitle(e.target.value)}
          className="bg-secondary/50 border-border"
          onKeyDown={(e) => {
            if (e.key === "Enter") handlePostAnnouncement();
          }}
          data-ocid="announcement.title.input"
        />
        <Textarea
          id="ann-body"
          placeholder="Body text..."
          value={annBody}
          onChange={(e) => setAnnBody(e.target.value)}
          rows={3}
          className="bg-secondary/50 border-border resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey))
              handlePostAnnouncement();
          }}
          data-ocid="announcement.body.textarea"
        />
        <Button
          onClick={handlePostAnnouncement}
          disabled={addAnn.isPending}
          className="bg-primary text-primary-foreground hover:opacity-90 w-full"
          data-ocid="announcement.submit_button"
        >
          {addAnn.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Post Announcement
        </Button>
      </div>

      {/* Treasury Manual Balance Override */}
      <div className="glass-card-gold rounded-xl p-5 space-y-4">
        <h3 className="font-heading font-semibold text-sm tracking-widest uppercase text-yellow-400">
          Treasury Manual Override
        </h3>
        <p className="text-xs text-muted-foreground">
          Manual values take priority over live. Clear to show live again.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="manual-icp"
              className="text-xs text-muted-foreground"
            >
              ICP Amount
            </label>
            <Input
              id="manual-icp"
              placeholder="e.g. 1234.5678"
              value={manualIcp}
              onChange={(e) => setManualIcp(e.target.value)}
              className="bg-secondary/50 border-border font-mono"
              data-ocid="manual.icp.input"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="manual-bitty"
              className="text-xs text-muted-foreground"
            >
              BITTYICP Amount
            </label>
            <Input
              id="manual-bitty"
              placeholder="e.g. 500000"
              value={manualBitty}
              onChange={(e) => setManualBitty(e.target.value)}
              className="bg-secondary/50 border-border font-mono"
              data-ocid="manual.bitty.input"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSaveTreasuryManual}
            disabled={setManual.isPending}
            variant="outline"
            className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 flex-1"
            data-ocid="manual.save_button"
          >
            {setManual.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Save
          </Button>
          <Button
            onClick={handleClearTreasuryManual}
            disabled={setManual.isPending}
            variant="ghost"
            className="text-muted-foreground hover:text-foreground flex-1"
            data-ocid="manual.clear_button"
          >
            Clear (use live)
          </Button>
        </div>
      </div>

      {/* Fund Manual Balance Override */}
      <div className="glass-card-gold rounded-xl p-5 space-y-4">
        <h3 className="font-heading font-semibold text-sm tracking-widest uppercase text-yellow-400">
          Fund Manual Override
        </h3>
        <p className="text-xs text-muted-foreground">
          Override the Future Investment Fund $BITTYICP balance. Manual takes
          priority over live.
        </p>
        <div className="space-y-1">
          <label
            htmlFor="manual-fund"
            className="text-xs text-muted-foreground"
          >
            Fund $BITTYICP Amount
          </label>
          <Input
            id="manual-fund"
            placeholder="e.g. 1000000"
            value={manualFund}
            onChange={(e) => setManualFund(e.target.value)}
            className="bg-secondary/50 border-border font-mono"
            data-ocid="manual.fund.input"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSaveFundManual}
            disabled={setManualFundBalance.isPending}
            variant="outline"
            className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 flex-1"
            data-ocid="manual.fund.save_button"
          >
            {setManualFundBalance.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Save Fund Balance
          </Button>
          <Button
            onClick={handleClearFundManual}
            disabled={setManualFundBalance.isPending}
            variant="ghost"
            className="text-muted-foreground hover:text-foreground flex-1"
            data-ocid="manual.fund.clear_button"
          >
            Clear (use live)
          </Button>
        </div>
      </div>

      {/* BITTYICP Price Override */}
      <div className="glass-card-gold rounded-xl p-5 space-y-4">
        <h3 className="font-heading font-semibold text-sm tracking-widest uppercase text-yellow-400">
          BITTYICP Price Override
        </h3>
        <p className="text-xs text-muted-foreground">
          Set the manual price per $BITTYICP in USD. Live ICPSwap price takes
          priority if available — this is used as fallback.
        </p>
        <div className="space-y-1">
          <label
            htmlFor="manual-bitty-price"
            className="text-xs text-muted-foreground"
          >
            Price per $BITTYICP (USD)
          </label>
          <Input
            id="manual-bitty-price"
            placeholder="e.g. 0.00042"
            value={manualBittyPrice}
            onChange={(e) => setManualBittyPrice(e.target.value)}
            className="bg-secondary/50 border-border font-mono"
            data-ocid="manual.bitty_price.input"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSaveBittyPrice}
            disabled={setManualBittyPriceMutation.isPending}
            variant="outline"
            className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 flex-1"
            data-ocid="manual.bitty_price.save_button"
          >
            {setManualBittyPriceMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Save Price
          </Button>
          <Button
            onClick={handleClearBittyPrice}
            disabled={setManualBittyPriceMutation.isPending}
            variant="ghost"
            className="text-muted-foreground hover:text-foreground flex-1"
            data-ocid="manual.bitty_price.clear_button"
          >
            Clear (use live)
          </Button>
        </div>
      </div>

      {/* Games & Development Wallet */}
      <div className="glass-card-gold rounded-xl p-5 space-y-4">
        <h3 className="font-heading font-semibold text-sm tracking-widest uppercase text-yellow-400">
          Games & Development Wallet
        </h3>
        <p className="text-xs text-muted-foreground">
          Set the wallet address for the Games & Development fund. When set,
          live balances will display on the main page.
        </p>
        <div className="space-y-1">
          <label
            htmlFor="games-wallet"
            className="text-xs text-muted-foreground"
          >
            Wallet Address
          </label>
          <Input
            id="games-wallet"
            placeholder="Paste wallet address..."
            value={gamesWalletInput}
            onChange={(e) => setGamesWalletInput(e.target.value)}
            className="bg-secondary/50 border-border font-mono text-xs"
            data-ocid="admin.games_wallet.input"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSaveGamesWallet}
            disabled={setGamesWalletMutation.isPending}
            variant="outline"
            className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 flex-1"
            data-ocid="admin.games_wallet.save_button"
          >
            {setGamesWalletMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Save Wallet
          </Button>
          <Button
            onClick={handleClearGamesWallet}
            disabled={setGamesWalletMutation.isPending}
            variant="ghost"
            className="text-muted-foreground hover:text-foreground flex-1"
            data-ocid="admin.games_wallet.clear_button"
          >
            Clear
          </Button>
        </div>
      </div>
      {/* Reset Verified Wallets */}
      <div className="space-y-3 border border-red-500/30 rounded-xl p-4">
        <h3 className="font-heading font-semibold text-sm tracking-widest uppercase text-red-400">
          ⚠ Danger Zone
        </h3>
        <p className="text-xs text-muted-foreground">
          Reset All Verified Wallets will permanently clear every user's
          verified external wallet links. This cannot be undone.
        </p>
        {!resetWalletsConfirm ? (
          <Button
            onClick={() => setResetWalletsConfirm(true)}
            variant="outline"
            className="border-red-500/40 text-red-400 hover:bg-red-500/10 w-full"
            data-ocid="admin.reset_wallets.button"
          >
            Reset All Verified Wallets
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-400 font-semibold text-center">
              Are you sure? This clears ALL users' verified wallets.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  setResetWalletsLoading(true);
                  try {
                    const a = actor as any;
                    if (!a || !a.adminResetVerifiedWallets)
                      throw new Error("Not connected");
                    await a.adminResetVerifiedWallets(password);
                    toast.success("All verified wallets have been reset.");
                    setResetWalletsConfirm(false);
                  } catch (err: any) {
                    toast.error(
                      `Failed to reset: ${err?.message ?? String(err)}`,
                    );
                  } finally {
                    setResetWalletsLoading(false);
                  }
                }}
                disabled={resetWalletsLoading}
                variant="destructive"
                className="flex-1"
                data-ocid="admin.reset_wallets.confirm_button"
              >
                {resetWalletsLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Yes, Reset All
              </Button>
              <Button
                onClick={() => setResetWalletsConfirm(false)}
                variant="ghost"
                className="flex-1 text-muted-foreground"
                data-ocid="admin.reset_wallets.cancel_button"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* Existing Announcements */}
      <div className="space-y-3">
        <h3 className="font-heading font-semibold text-sm tracking-widest uppercase text-muted-foreground">
          Manage Announcements
        </h3>
        {announcements.length === 0 && (
          <p
            className="text-sm text-muted-foreground text-center py-4"
            data-ocid="announcements.empty_state"
          >
            No announcements yet.
          </p>
        )}
        {[...announcements]
          .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))
          .map((ann, idx) => (
            <div
              key={ann.id.toString()}
              className="glass-card rounded-xl p-4 space-y-2"
              data-ocid={`announcements.item.${idx + 1}`}
            >
              {editingId === ann.id ? (
                <div className="space-y-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="bg-secondary/50 border-border"
                    data-ocid="announcement.edit.title.input"
                  />
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    className="bg-secondary/50 border-border resize-none"
                    data-ocid="announcement.edit.textarea"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateAnnouncement(ann.id)}
                      disabled={updateAnn.isPending}
                      className="flex-1 bg-primary text-primary-foreground"
                      data-ocid="announcement.save_button"
                    >
                      {updateAnn.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      className="flex-1"
                      data-ocid="announcement.cancel_button"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {ann.title}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-icp"
                        onClick={() => {
                          setEditingId(ann.id);
                          setEditTitle(ann.title);
                          setEditBody(ann.body);
                        }}
                        data-ocid={`announcements.edit_button.${idx + 1}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        data-ocid={`announcements.delete_button.${idx + 1}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{ann.body}</p>
                  <p className="text-xs text-muted-foreground/50">
                    {formatDate(ann.timestamp)}
                  </p>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Login Modal ──────────────────────────────────────────────────────────────
interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (password: string) => void;
}

function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const adminLogin = useAdminLogin();

  function resetForm() {
    setPw("");
    setError("");
  }

  async function handleLogin() {
    setError("");
    if (pw === ADMIN_PASSWORD) {
      onSuccess(pw);
      resetForm();
      return;
    }
    setLoading(true);
    try {
      const ok = await adminLogin.mutateAsync({ password: pw });
      if (ok) {
        onSuccess(pw);
        resetForm();
      } else {
        setError("Invalid password. Please try again.");
      }
    } catch {
      setError("Invalid password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleLogin();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent
        className="glass-card border-0 max-w-sm"
        data-ocid="admin.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2 text-icp">
            <ShieldCheck className="h-5 w-5" />
            Admin Access
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label
              htmlFor="admin-password"
              className="text-xs text-muted-foreground"
            >
              Password
            </label>
            <Input
              id="admin-password"
              type="password"
              placeholder="Enter admin password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-secondary/50 border-border"
              data-ocid="admin.input"
            />
          </div>
          {error && (
            <p
              className="text-xs text-destructive"
              data-ocid="admin.error_state"
            >
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleLogin}
              disabled={loading || !pw}
              className="flex-1 bg-primary text-primary-foreground hover:opacity-90"
              data-ocid="admin.submit_button"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Login
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="flex-1"
              data-ocid="admin.cancel_button"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [currentPage, setCurrentPage] = useState<"dashboard" | "voting">(
    "dashboard",
  );
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const _qc = useQueryClient();

  const { actor } = useActor();
  if (actor) setCachedActor(actor);

  const liveBalances = useGetLiveBalances();
  const fundBalance = useGetFundBalance();
  const neuronStake = useGetNeuronStake();
  const manualBalances = useGetManualBalances();
  const announcements = useGetAnnouncements();
  const tokenPrices = useTokenPrices();
  const adminConfig = useGetAdminConfig();
  const GAMES_WALLET_ADDRESS =
    "slfhp-cxr4u-mn53d-4tz4a-gn4ds-snqfa-tunfl-rfyxy-zjtho-iwksr-hqe";
  const gamesWallet = adminConfig.data?.gamesWallet || GAMES_WALLET_ADDRESS;
  const gamesBalances = useGetGamesWalletBalances(gamesWallet);

  const isAdmin = !!adminPassword;

  function handleTitleTap() {
    if (isAdmin) return;
    const next = tapCount + 1;
    if (next >= 5) {
      setTapCount(0);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      setLoginOpen(true);
      return;
    }
    setTapCount(next);
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      setTapCount(0);
      tapTimerRef.current = null;
    }, 3000);
  }

  function handleLoginSuccess(pw: string) {
    setAdminPassword(pw);
    setLoginOpen(false);
    setAdminOpen(true);
    toast.success("Welcome, Admin!");
  }

  const icpLive = liveBalances.data?.icp ?? null;
  const bittyLive = liveBalances.data?.bitty ?? null;
  const fundLive = fundBalance.data ?? null;

  const manualIcp = manualBalances.data?.icp ?? "";
  const manualBitty = manualBalances.data?.bitty ?? "";
  const manualFund = manualBalances.data?.fund ?? "";

  const fundHasManual = manualFund.trim() !== "";
  const fundHasLive = fundLive !== null;

  const icpUsd = tokenPrices.data?.icpUsd ?? null;
  const bittyUsd = tokenPrices.data?.bittyUsd ?? null;

  // Neuron stake USD
  const neuronStakeNum = neuronStake.data ?? null;
  const neuronUsdValue =
    neuronStakeNum !== null && icpUsd !== null ? neuronStakeNum * icpUsd : null;

  // Fund USD value
  const fundBalanceNum = resolveBalanceNumber(manualFund, fundLive ?? null);
  const fundUsdValue =
    fundBalanceNum !== null && bittyUsd !== null
      ? fundBalanceNum * bittyUsd
      : null;

  // Total ICP treasury USD value (ICP treasury + NNS neuron stake)
  const icpTreasuryNum = resolveBalanceNumber(manualIcp, icpLive);
  const neuronIcpNum = neuronStake.data ?? null;
  const totalIcpUsd =
    icpUsd !== null && icpTreasuryNum !== null && neuronIcpNum !== null
      ? (icpTreasuryNum + neuronIcpNum) * icpUsd
      : null;
  const totalIcpLoading =
    (liveBalances.isLoading && manualBalances.isLoading) ||
    neuronStake.isLoading;

  // Grand total USD = all treasury sources combined
  const bittyTreasuryNum = resolveBalanceNumber(manualBitty, bittyLive);
  const bittyTreasuryUsd =
    bittyTreasuryNum !== null && bittyUsd !== null
      ? bittyTreasuryNum * bittyUsd
      : null;

  const gamesBittyRaw = gamesBalances.data?.bitty ?? null;
  const gamesBittyNum =
    gamesBittyRaw !== null ? Number(gamesBittyRaw) / 1e8 : null;
  const gamesIcpRaw = gamesBalances.data?.icp ?? null;
  const gamesIcpNum = gamesIcpRaw !== null ? Number(gamesIcpRaw) / 1e8 : null;
  const gamesIcpUsd =
    gamesIcpNum !== null && icpUsd !== null ? gamesIcpNum * icpUsd : null;
  const gamesUsdValue =
    gamesBittyNum !== null && bittyUsd !== null
      ? gamesBittyNum * bittyUsd
      : null;

  const grandTotalUsd =
    totalIcpUsd !== null ||
    bittyTreasuryUsd !== null ||
    fundUsdValue !== null ||
    gamesUsdValue !== null
      ? (totalIcpUsd ?? 0) +
        (bittyTreasuryUsd ?? 0) +
        (fundUsdValue ?? 0) +
        (gamesUsdValue ?? 0)
      : null;

  const grandTotalLoading =
    totalIcpLoading || (liveBalances.isLoading && manualBalances.isLoading);

  const sortedAnnouncements = [...(announcements.data ?? [])].sort((a, b) =>
    b.timestamp > a.timestamp ? 1 : -1,
  );

  if (currentPage === "voting") {
    return (
      <VotingPage
        onBack={() => setCurrentPage("dashboard")}
        isAdmin={isAdmin}
        adminPassword={ADMIN_PASSWORD}
      />
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden font-body">
      {/* Background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/assets/IMG_5288.jpeg')" }}
      />
      {/* Overlay */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[oklch(0.08_0.03_252/0.40)] via-[oklch(0.10_0.025_252/0.35)] to-[oklch(0.05_0.01_252/0.55)]" />

      <Toaster position="top-right" richColors />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 glass-card border-b border-border/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            {/* Title area — 5 taps triggers admin login */}
            <button
              type="button"
              className="flex items-center gap-3 cursor-pointer select-none bg-transparent border-0 p-0 text-left"
              onClick={handleTitleTap}
              data-ocid="header.title.button"
            >
              <Landmark className="h-7 w-7 text-gold shrink-0" />
              <div>
                <h1 className="font-heading font-bold text-xl sm:text-2xl text-foreground tracking-tight leading-none">
                  BITTY ICP BANK
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Official Treasury Dashboard
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => setCurrentPage("voting")}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[oklch(0.87_0.17_90/0.55)] bg-[oklch(0.87_0.17_90/0.08)] text-gold font-heading font-bold text-xs tracking-widest uppercase shadow-[0_0_18px_oklch(0.87_0.17_90/0.18)] hover:bg-[oklch(0.87_0.17_90/0.16)] hover:shadow-[0_0_28px_oklch(0.87_0.17_90/0.30)] transition-all duration-200"
                data-ocid="vote_page.link"
              >
                Vote
              </motion.button>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/40 text-icp hover:bg-primary/10"
                  onClick={() => setAdminOpen(true)}
                  data-ocid="admin.open_modal_button"
                >
                  <ShieldCheck className="h-4 w-4 mr-1" /> Admin
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 space-y-10">
          {/* Grand Total Treasury Value Banner */}
          {/* Grand Total + CEO stacked vertically */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="glass-card-gold rounded-2xl overflow-visible"
            style={{
              boxShadow:
                "0 0 48px oklch(0.87 0.17 90 / 0.38), 0 0 96px oklch(0.87 0.17 90 / 0.18)",
            }}
            data-ocid="grand_total.card"
          >
            {/* Total Balance */}
            <div className="p-7 text-center">
              <p className="text-xs font-semibold text-gold/70 tracking-[0.22em] uppercase mb-1">
                Total Treasury Value
              </p>
              <p className="text-xs text-muted-foreground/50 mb-4">
                All Wallets · Neuron · Funds
              </p>
              {HIDE_BALANCES ? (
                <span className="text-5xl sm:text-6xl font-heading font-extrabold text-gold tabular-nums drop-shadow-[0_0_18px_oklch(0.87_0.17_90/0.55)]">
                  $0.00
                </span>
              ) : grandTotalLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-gold/60" />
                  <span className="text-5xl font-heading font-bold text-gold/30">
                    —
                  </span>
                </div>
              ) : grandTotalUsd !== null ? (
                <span className="text-5xl sm:text-6xl font-heading font-extrabold text-gold tabular-nums drop-shadow-[0_0_18px_oklch(0.87_0.17_90/0.55)]">
                  {formatUsd(grandTotalUsd)}
                </span>
              ) : (
                <span className="text-5xl font-heading font-bold text-gold/30">
                  —
                </span>
              )}
            </div>
          </motion.div>

          {/* Balance Section */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-lg text-foreground tracking-tight">
                TREASURY BALANCES
              </h2>
              {/* Bitty CEO + HOW IT WORKS — CEO is tall, bubble floats above his head */}
              <div className="relative flex items-end" style={{ height: 180 }}>
                {/* CEO Character */}
                <button
                  type="button"
                  onClick={() => setHowItWorksOpen(true)}
                  className="border-none bg-transparent p-0 cursor-pointer hover:scale-105 transition-transform duration-200"
                  aria-label="How It Works"
                >
                  <img
                    src="/assets/generated/bitty-ceo-cropped-transparent.dim_600x800.png"
                    alt="Bitty CEO"
                    className="object-contain"
                    style={{ height: 160 }}
                  />
                </button>
                {/* Speech bubble above head */}
                <button
                  onClick={() => setHowItWorksOpen(true)}
                  data-ocid="how_it_works.open_modal_button"
                  type="button"
                  className="absolute top-0 left-0 bg-white border-4 border-black rounded-2xl px-3 py-1.5 cursor-pointer hover:bg-yellow-50 transition-colors duration-150 shadow-[3px_3px_0px_#000]"
                  style={{ transform: "translateX(-10%)" }}
                >
                  <span
                    className="font-black text-black text-sm tracking-wider uppercase leading-tight block text-center"
                    style={{
                      fontFamily: "Impact, Arial Black, sans-serif",
                      WebkitTextStroke: "0.5px black",
                    }}
                  >
                    HOW IT WORKS
                  </span>
                  {/* Speech bubble tail pointing DOWN toward CEO */}
                  <span
                    className="absolute left-1/2 -bottom-4 -translate-x-1/2 w-0 h-0"
                    style={{
                      borderLeft: "8px solid transparent",
                      borderRight: "8px solid transparent",
                      borderTop: "12px solid black",
                    }}
                  />
                  <span
                    className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 w-0 h-0"
                    style={{
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderTop: "9px solid white",
                    }}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <BalanceCard
                token="$ICP Balance"
                symbol="Internet Computer"
                liveValue={icpLive}
                manualValue={manualIcp}
                isLoading={liveBalances.isLoading || manualBalances.isLoading}
                isAdmin={isAdmin}
                usdPrice={icpUsd}
                explorerUrl="https://www.icexplorer.io/address/detail/ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe"
              />
              <BalanceCard
                token="$BITTYICP Balance"
                symbol="BITTY on ICP"
                liveValue={bittyLive}
                manualValue={manualBitty}
                isLoading={liveBalances.isLoading || manualBalances.isLoading}
                isAdmin={isAdmin}
                usdPrice={bittyUsd}
                explorerUrl="https://www.icexplorer.io/address/detail/ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe"
              />
            </div>
          </section>

          {/* NNS PUBLIC NEURON Section */}
          <section>
            <h2 className="font-heading font-bold text-lg text-foreground tracking-tight mb-5">
              NNS PUBLIC NEURON
            </h2>
            <a
              href="https://dashboard.internetcomputer.org/neuron/2927437143767212939"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="glass-card-gold gold-glow rounded-2xl p-6 space-y-5 cursor-pointer hover:ring-2 hover:ring-[oklch(0.87_0.17_90/0.5)] transition-all"
                data-ocid="neuron.card"
              >
                {/* Neuron ID row */}
                <div className="flex items-start gap-4">
                  <div className="shrink-0 rounded-xl bg-[oklch(0.87_0.17_90/0.12)] border border-[oklch(0.87_0.17_90/0.25)] p-3">
                    <Brain className="h-6 w-6 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-1">
                      Neuron ID
                    </p>
                    <CopyableId value={NEURON_ID} label="Neuron ID" />
                  </div>
                </div>

                <div className="h-px bg-[oklch(0.87_0.17_90/0.2)]" />

                {/* ICP Stake */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-1">
                    ICP Staked
                  </p>
                  <div className="text-3xl font-heading font-bold text-gold tabular-nums">
                    {HIDE_BALANCES ? (
                      <span>0</span>
                    ) : neuronStake.isLoading ? (
                      <span className="opacity-40">—</span>
                    ) : neuronStake.data !== null &&
                      neuronStake.data !== undefined ? (
                      neuronStake.data.toLocaleString("en-US", {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                      })
                    ) : (
                      <span className="opacity-40 text-xl">Unavailable</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {HIDE_BALANCES ? (
                      "ICP · $0.00 USD"
                    ) : neuronStake.isLoading ? (
                      <span className="opacity-40">Loading…</span>
                    ) : neuronUsdValue !== null ? (
                      <>ICP · {formatUsd(neuronUsdValue)} USD</>
                    ) : (
                      "ICP"
                    )}
                  </p>
                </div>

                <div className="h-px bg-[oklch(0.87_0.17_90/0.2)]" />

                <p className="text-xs text-muted-foreground leading-relaxed">
                  This neuron stakes ICP on behalf of the treasury through the
                  Network Nervous System (NNS), earning staking rewards that
                  grow the bank over time.
                </p>
                <div className="text-xs text-muted-foreground/50">
                  View on IC Dashboard ↗
                </div>
              </motion.div>
            </a>
          </section>

          {/* Future Investment Fund Section */}
          <section data-ocid="fund.section">
            <h2 className="font-heading font-bold text-lg text-foreground tracking-tight mb-5">
              BITTY ON ICP FUTURE INVESTMENT FUND
            </h2>
            <a
              href="https://www.icexplorer.io/address/detail/vqr3d-eby7o-fiwpf-pllu5-yzmxy-4ut67-gnxgr-nfiqw-c3ked-6arfu-zae"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="glass-card-gold gold-glow rounded-2xl p-6 space-y-5 cursor-pointer hover:ring-2 hover:ring-[oklch(0.87_0.17_90/0.5)] transition-all"
                data-ocid="fund.card"
              >
                {/* Icon + balance */}
                <div className="flex items-start gap-4">
                  <div className="shrink-0 rounded-xl bg-[oklch(0.87_0.17_90/0.12)] border border-[oklch(0.87_0.17_90/0.25)] p-3">
                    <TrendingUp className="h-6 w-6 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-1">
                      $BITTYICP Balance
                    </p>
                    <div className="text-3xl font-heading font-bold text-gold tabular-nums break-all">
                      {HIDE_BALANCES ? (
                        <span>0</span>
                      ) : fundBalance.isLoading && manualBalances.isLoading ? (
                        <span className="opacity-40">—</span>
                      ) : fundHasManual ? (
                        manualFund
                      ) : fundHasLive ? (
                        formatBalance(fundLive!)
                      ) : (
                        <span className="opacity-40 text-xl">Unavailable</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {HIDE_BALANCES ? (
                        "BITTY on ICP · $0.00 USD"
                      ) : fundBalance.isLoading && manualBalances.isLoading ? (
                        <span className="opacity-40">Loading…</span>
                      ) : fundUsdValue !== null ? (
                        <>BITTY on ICP · {formatUsd(fundUsdValue)} USD</>
                      ) : fundHasManual && isAdmin ? (
                        "BITTY on ICP · MANUAL OVERRIDE"
                      ) : (
                        "BITTY on ICP"
                      )}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="h-px bg-[oklch(0.87_0.17_90/0.2)]" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The future investment fund is a fully funded wallet with{" "}
                  <span className="text-gold font-semibold">$BITTYICP</span>{" "}
                  that will remain unavailable until{" "}
                  <span className="text-gold font-semibold">
                    &ldquo;BITTY ON ICP&rdquo;
                  </span>{" "}
                  FDV is at a minimum{" "}
                  <span className="text-gold font-semibold">
                    $2,500,000.00 USD
                  </span>
                  . At this point the fund will be sold for $ICP and re-invested
                  into the{" "}
                  <span className="text-gold font-semibold">
                    &ldquo;BITTY ICP BANK&rdquo;
                  </span>{" "}
                  to exponentially grow the daily dividends that the community
                  will be able to vote on its usage every month.{" "}
                  <span className="text-muted-foreground/60 italic">
                    (Due to change to every week at that point)
                  </span>
                </p>
                <div className="text-xs text-muted-foreground/50">
                  View on IC Dashboard ↗
                </div>
              </motion.div>
            </a>
          </section>

          {/* Games & Development Wallet */}
          <section data-ocid="games.section">
            <h2 className="font-heading font-bold text-lg text-foreground tracking-tight mb-5">
              DEVELOPMENTS WALLET
            </h2>
            <a
              href="https://www.icexplorer.io/address/detail/slfhp-cxr4u-mn53d-4tz4a-gn4ds-snqfa-tunfl-rfyxy-zjtho-iwksr-hqe"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="glass-card-gold gold-glow rounded-2xl p-6 space-y-5 cursor-pointer hover:ring-2 hover:ring-[oklch(0.87_0.17_90/0.5)] transition-all"
                data-ocid="games.card"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 rounded-xl bg-[oklch(0.87_0.17_90/0.12)] border border-[oklch(0.87_0.17_90/0.25)] p-3">
                    <Gamepad2 className="h-6 w-6 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {!gamesWallet ? (
                      <div>
                        <div className="text-2xl font-heading font-bold text-gold/60">
                          COMING SOON
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Wallet address not yet configured
                        </div>
                      </div>
                    ) : gamesBalances.isLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading
                        balances...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-1">
                            $ICP Balance
                          </div>
                          <div className="text-2xl font-heading font-bold text-gold tabular-nums">
                            {HIDE_BALANCES ? (
                              <span>0</span>
                            ) : gamesBalances.data?.icp != null ? (
                              formatBalance(gamesBalances.data.icp)
                            ) : (
                              <span className="opacity-40 text-xl">
                                Unavailable
                              </span>
                            )}
                          </div>
                          {HIDE_BALANCES ? (
                            <div className="text-sm text-muted-foreground mt-0.5">
                              $0.00 USD
                            </div>
                          ) : gamesIcpUsd !== null ? (
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {formatUsd(gamesIcpUsd)} USD
                            </div>
                          ) : null}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-1">
                            $BITTYICP Balance
                          </div>
                          <div className="text-2xl font-heading font-bold text-gold tabular-nums">
                            {HIDE_BALANCES ? (
                              <span>0</span>
                            ) : gamesBalances.data?.bitty != null ? (
                              formatBalance(gamesBalances.data.bitty)
                            ) : (
                              <span className="opacity-40 text-xl">
                                Unavailable
                              </span>
                            )}
                          </div>
                          {HIDE_BALANCES ? (
                            <div className="text-sm text-muted-foreground mt-0.5">
                              $0.00 USD
                            </div>
                          ) : gamesUsdValue !== null ? (
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {formatUsd(gamesUsdValue)} USD
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-px bg-[oklch(0.87_0.17_90/0.2)]" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This wallet receives{" "}
                  <span className="text-gold font-semibold">$BITTYICP</span>{" "}
                  when the community votes to send treasury funds to Games &amp;
                  Development. Funds here are used to grow the{" "}
                  <span className="text-gold font-semibold">BITTY ON ICP</span>{" "}
                  ecosystem through new games, tools, and development
                  initiatives.
                </p>
                <div className="text-xs text-muted-foreground/50">
                  View on IC Dashboard ↗
                </div>
              </motion.div>
            </a>
          </section>
          {/* Announcements */}
          <section>
            <h2 className="font-heading font-bold text-lg text-foreground tracking-tight mb-5">
              Latest Updates
            </h2>
            {announcements.isLoading ? (
              <div
                className="flex justify-center py-10"
                data-ocid="announcements.loading_state"
              >
                <Loader2 className="h-8 w-8 animate-spin text-icp" />
              </div>
            ) : sortedAnnouncements.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card rounded-2xl p-10 text-center"
                data-ocid="announcements.empty_state"
              >
                <Landmark className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No announcements yet. Check back soon.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {sortedAnnouncements.map((ann, idx) => (
                    <motion.article
                      key={ann.id.toString()}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ delay: idx * 0.05 }}
                      className="glass-card rounded-2xl p-6 space-y-2"
                      data-ocid={`announcements.item.${idx + 1}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-heading font-bold text-base text-foreground">
                          {ann.title}
                        </h3>
                        <span className="text-xs text-muted-foreground/60 shrink-0 mt-0.5">
                          {formatDate(ann.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {ann.body}
                      </p>
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </main>

        {/* Footer */}
        <footer className="glass-card border-t border-border/20 py-5">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              © {new Date().getFullYear()} BITTY ON ICP. All rights reserved.
            </span>
            <a
              href="https://bittyonicp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-2xl font-bold text-gold hover:opacity-80 transition-opacity tracking-wider"
              data-ocid="footer.link"
            >
              BITTYONICP.COM <ExternalLink className="h-5 w-5" />
            </a>
          </div>
        </footer>
      </div>
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />
      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent
          className="glass-card border-0 max-w-2xl max-h-[90vh] overflow-y-auto"
          data-ocid="admin.panel.modal"
        >
          <DialogHeader>
            <DialogTitle className="font-heading sr-only">
              Admin Panel
            </DialogTitle>
          </DialogHeader>
          {adminPassword && (
            <AdminPanel
              password={adminPassword}
              onLogout={() => {
                setAdminPassword(null);
                setAdminOpen(false);
                toast.success("Logged out");
              }}
              announcements={announcements.data ?? []}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
        <DialogContent
          className="glass-card-gold border border-[oklch(0.87_0.17_90/0.3)] max-w-lg max-h-[85vh] overflow-y-auto"
          data-ocid="how_it_works.dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-gold text-xl">
              <HelpCircle className="h-5 w-5 shrink-0" />
              How It Works
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-1 text-sm leading-relaxed">
            <p className="text-foreground font-medium">
              Welcome to{" "}
              <span className="text-gold font-bold">
                &ldquo;BITTY ICP BANK&rdquo;
              </span>{" "}
              — the future of{" "}
              <span className="text-gold font-bold">
                &ldquo;BITTY ON ICP&rdquo;
              </span>{" "}
              begins here.
            </p>

            <div className="h-px bg-[oklch(0.87_0.17_90/0.2)]" />

            <div className="space-y-3">
              <h3 className="font-heading font-bold text-gold tracking-wide uppercase text-xs">
                How the Bank works
              </h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-gold mt-0.5 shrink-0">◆</span>
                  <span>
                    Dividends from Dev&apos;s personal wallet flow to the bank
                    to kickstart the system and will continue until the bank
                    reaches a self-sustainable size.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold mt-0.5 shrink-0">◆</span>
                  <span>
                    Dividends from future utility and sales flow into the Bank.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold mt-0.5 shrink-0">◆</span>
                  <div>
                    <span>
                      Every Month the community votes (on the voting platform)
                      what happens to the treasury funds. These actions could
                      be:
                    </span>
                    <ul className="mt-2 ml-4 space-y-1.5">
                      {[
                        "Buyback / Burn",
                        "Rewards for games",
                        "Hold and let the treasury grow",
                        "Invest for further dividends",
                      ].map((item) => (
                        <li key={item} className="flex gap-2 items-start">
                          <span className="text-gold/60 mt-0.5 shrink-0 text-xs">
                            ▸
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              </ul>
            </div>

            <div className="h-px bg-[oklch(0.87_0.17_90/0.2)]" />

            <p className="text-muted-foreground">
              As the project grows and the FDV of{" "}
              <span className="text-gold font-semibold">
                &ldquo;BITTY ON ICP&rdquo;
              </span>{" "}
              grows to a point, a proposal will be made in the{" "}
              <span className="text-gold font-semibold">
                &ldquo;BITTY GOVERNANCE&rdquo;
              </span>{" "}
              app to sell project supply to use for a lump sum investment into
              the NNS staking — allowing a substantial increase to the rate of
              treasury growth.
            </p>

            <div className="flex justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHowItWorksOpen(false)}
                className="border-[oklch(0.87_0.17_90/0.4)] text-gold hover:bg-[oklch(0.87_0.17_90/0.1)]"
                data-ocid="how_it_works.close_button"
              >
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
