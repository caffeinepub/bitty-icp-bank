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
import {
  type Announcement,
  useAddAnnouncement,
  useAdminLogin,
  useDeleteAnnouncement,
  useGetAnnouncements,
  useGetLiveBalances,
  useGetManualBalances,
  useSetManualBalances,
  useUpdateAnnouncement,
} from "@/hooks/useQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Landmark,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Toaster, toast } from "sonner";

function formatBalance(raw: bigint): string {
  const n = Number(raw);
  return (n / 1e8).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
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

// ─── Balance Card ────────────────────────────────────────────────────────────
interface BalanceCardProps {
  token: string;
  symbol: string;
  liveValue: bigint | null | undefined;
  manualValue: string | undefined;
  isLive: boolean;
  isLoading: boolean;
  variant: "icp" | "bitty";
}

function BalanceCard({
  token,
  symbol,
  liveValue,
  manualValue,
  isLoading,
}: BalanceCardProps) {
  const hasLive = liveValue !== null && liveValue !== undefined;
  const showManual = !hasLive;
  const cardClass = "glass-card-gold gold-glow";
  const amountClass = "text-gold";
  const borderClass = "border-[oklch(0.87_0.17_90/0.4)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`${cardClass} rounded-2xl p-6 flex flex-col gap-3 min-w-0 flex-1`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground tracking-widest uppercase">
          {token}
        </span>
        {isLoading ? (
          <Badge variant="outline" className={`text-xs ${borderClass}`}>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading
          </Badge>
        ) : showManual ? (
          <Badge
            variant="outline"
            className="text-xs border-yellow-500/40 text-yellow-400"
          >
            <AlertTriangle className="h-3 w-3 mr-1" /> MANUAL
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className={`text-xs ${borderClass} ${amountClass}`}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> LIVE
          </Badge>
        )}
      </div>
      <div
        className={`text-3xl font-heading font-bold ${amountClass} tabular-nums break-all`}
      >
        {isLoading ? (
          <span className="opacity-40">—</span>
        ) : hasLive ? (
          formatBalance(liveValue!)
        ) : (
          (manualValue ?? "0")
        )}
      </div>
      <div className="text-xs text-muted-foreground font-mono">{symbol}</div>
    </motion.div>
  );
}

// ─── Admin Panel ─────────────────────────────────────────────────────────────
interface AdminPanelProps {
  password: string;
  onLogout: () => void;
  announcements: Announcement[];
}

function AdminPanel({ password, onLogout, announcements }: AdminPanelProps) {
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [manualIcp, setManualIcp] = useState("");
  const [manualBitty, setManualBitty] = useState("");

  const addAnn = useAddAnnouncement();
  const updateAnn = useUpdateAnnouncement();
  const deleteAnn = useDeleteAnnouncement();
  const setManual = useSetManualBalances();

  async function handlePostAnnouncement() {
    if (!annTitle.trim() || !annBody.trim()) {
      toast.error("Title and body are required");
      return;
    }
    await addAnn.mutateAsync({
      password,
      title: annTitle.trim(),
      body: annBody.trim(),
    });
    toast.success("Announcement posted!");
    setAnnTitle("");
    setAnnBody("");
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
    });
    toast.success("Announcement updated!");
    setEditingId(null);
  }

  async function handleDeleteAnnouncement(id: bigint) {
    await deleteAnn.mutateAsync({ password, id });
    toast.success("Announcement deleted");
  }

  async function handleSaveManual() {
    if (!manualIcp.trim() && !manualBitty.trim()) {
      toast.error("Enter at least one balance");
      return;
    }
    await setManual.mutateAsync({
      password,
      icp: manualIcp.trim(),
      bitty: manualBitty.trim(),
    });
    toast.success("Manual balances saved!");
    setManualIcp("");
    setManualBitty("");
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
          data-ocid="announcement.title.input"
        />
        <Textarea
          id="ann-body"
          placeholder="Body text..."
          value={annBody}
          onChange={(e) => setAnnBody(e.target.value)}
          rows={3}
          className="bg-secondary/50 border-border resize-none"
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

      {/* Manual Balance Override */}
      <div className="glass-card-gold rounded-xl p-5 space-y-4">
        <h3 className="font-heading font-semibold text-sm tracking-widest uppercase text-yellow-400">
          Manual Balance Override
        </h3>
        <p className="text-xs text-muted-foreground">
          Set fallback balances shown when live query fails.
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
              placeholder="e.g. 1234.56789"
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
        <Button
          onClick={handleSaveManual}
          disabled={setManual.isPending}
          variant="outline"
          className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 w-full"
          data-ocid="manual.save_button"
        >
          {setManual.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Save Manual Balances
        </Button>
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
  const adminLogin = useAdminLogin();

  async function handleLogin() {
    setError("");
    try {
      const ok = await adminLogin.mutateAsync({ password: pw });
      if (ok) {
        onSuccess(pw);
      } else {
        setError("Invalid password. Please try again.");
      }
    } catch {
      setError("Login failed. Please try again.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleLogin();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
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
              disabled={adminLogin.isPending || !pw}
              className="flex-1 bg-primary text-primary-foreground hover:opacity-90"
              data-ocid="admin.submit_button"
            >
              {adminLogin.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Login
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
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
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const qc = useQueryClient();

  const liveBalances = useGetLiveBalances();
  const manualBalances = useGetManualBalances();
  const announcements = useGetAnnouncements();

  const isAdmin = !!adminPassword;

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ["liveBalances"] });
    qc.invalidateQueries({ queryKey: ["manualBalances"] });
    qc.invalidateQueries({ queryKey: ["announcements"] });
    toast.success("Refreshing balances...");
  }

  function handleLoginSuccess(pw: string) {
    setAdminPassword(pw);
    setLoginOpen(false);
    setAdminOpen(true);
    toast.success("Welcome, Admin!");
  }

  const icpLive = liveBalances.data?.icp ?? null;
  const bittyLive = liveBalances.data?.bitty ?? null;
  const sortedAnnouncements = [...(announcements.data ?? [])].sort((a, b) =>
    b.timestamp > a.timestamp ? 1 : -1,
  );

  return (
    <div className="min-h-screen relative overflow-x-hidden font-body">
      {/* Background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/assets/uploads/IMG_5288-1.jpeg')" }}
      />
      {/* Overlay — slightly lighter so more of the photo shows through */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[oklch(0.08_0.03_252/0.65)] via-[oklch(0.10_0.025_252/0.60)] to-[oklch(0.05_0.01_252/0.75)]" />

      <Toaster position="top-right" richColors />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 glass-card border-b border-border/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Landmark className="h-7 w-7 text-gold shrink-0" />
              <div>
                <h1 className="font-heading font-bold text-xl sm:text-2xl text-foreground tracking-tight leading-none">
                  BITTY ICP BANK
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Official Treasury Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/40 text-icp hover:bg-primary/10"
                  onClick={() => setAdminOpen(true)}
                  data-ocid="admin.open_modal_button"
                >
                  <ShieldCheck className="h-4 w-4 mr-1" /> Admin
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border/40 text-muted-foreground hover:text-foreground"
                  onClick={() => setLoginOpen(true)}
                  data-ocid="admin.login_button"
                >
                  Admin Login
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 space-y-10">
          {/* HOW IT WORKS Button */}
          <div className="flex justify-center">
            <motion.button
              onClick={() => setHowItWorksOpen(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[oklch(0.87_0.17_90/0.55)] bg-[oklch(0.87_0.17_90/0.08)] text-gold font-heading font-bold text-sm tracking-widest uppercase shadow-[0_0_18px_oklch(0.87_0.17_90/0.18)] hover:bg-[oklch(0.87_0.17_90/0.16)] hover:shadow-[0_0_28px_oklch(0.87_0.17_90/0.30)] transition-all duration-200"
              data-ocid="how_it_works.open_modal_button"
            >
              <HelpCircle className="h-4 w-4" />
              How It Works
            </motion.button>
          </div>

          {/* Balance Section */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-lg text-foreground tracking-tight">
                Treasury Balances
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={liveBalances.isFetching}
                className="border-border/40 text-muted-foreground hover:text-foreground"
                data-ocid="balances.refresh_button"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${liveBalances.isFetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <BalanceCard
                token="$ICP Balance"
                symbol="Internet Computer"
                liveValue={icpLive}
                manualValue={manualBalances.data?.icp}
                isLive={icpLive !== null}
                isLoading={liveBalances.isLoading}
                variant="icp"
              />
              <BalanceCard
                token="$BITTYICP Balance"
                symbol="BITTY on ICP"
                liveValue={bittyLive}
                manualValue={manualBalances.data?.bitty}
                isLive={bittyLive !== null}
                isLoading={liveBalances.isLoading}
                variant="bitty"
              />
            </div>

            {liveBalances.isError && (
              <p
                className="text-xs text-yellow-400/70 mt-3 text-center"
                data-ocid="balances.error_state"
              >
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Live query failed — showing manual balances
              </p>
            )}
          </section>

          {/* NNS Public Neuron Section */}
          <section>
            <h2 className="font-heading font-bold text-lg text-foreground tracking-tight mb-5">
              NNS Public Neuron
            </h2>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass-card-gold gold-glow rounded-2xl p-6"
              data-ocid="neuron.card"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-xl bg-[oklch(0.87_0.17_90/0.12)] border border-[oklch(0.87_0.17_90/0.25)] p-3">
                  <Brain className="h-6 w-6 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-muted-foreground tracking-widest uppercase">
                      Neuron ID
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs border-[oklch(0.87_0.17_90/0.4)] text-gold shrink-0"
                    >
                      <Clock className="h-3 w-3 mr-1" /> Pending
                    </Badge>
                  </div>
                  <p className="text-2xl font-heading font-bold text-gold italic opacity-70">
                    Coming soon
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    This neuron will stake ICP on behalf of the treasury
                  </p>
                </div>
              </div>
            </motion.div>
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
              className="flex items-center gap-1 text-base font-semibold text-gold hover:opacity-80 transition-opacity"
              data-ocid="footer.link"
            >
              Bittyonicp.com <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </footer>
      </div>

      {/* Login Modal */}
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Admin Panel Dialog */}
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

      {/* How It Works Modal */}
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
