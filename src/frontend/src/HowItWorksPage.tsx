import {
  ArrowLeft,
  BarChart3,
  Building2,
  Coins,
  Gamepad2,
  Gift,
  Rocket,
  Shield,
  Wallet,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

export default function HowItWorksPage({ onBack }: { onBack: () => void }) {
  // Generate random particle values once, stable across renders
  const rockets = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      angle: (Math.random() - 0.5) * 20,
      duration: 4 + Math.random() * 5,
      delay: Math.random() * 6,
      size: 16 + Math.floor(Math.random() * 15),
    })),
  );

  const coins = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      duration: 7 + Math.random() * 6,
      delay: Math.random() * 8,
      size: 14 + Math.floor(Math.random() * 10),
    })),
  );

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const sections = [
    {
      id: "voting-power",
      accent: "from-yellow-500",
      borderColor: "border-yellow-500/40",
      bgGlow: "bg-yellow-900/10",
      iconColor: "text-yellow-400",
      titleColor: "text-yellow-300",
      Icon: Zap,
      title: "Voting Power",
      steps: [
        { n: "1", text: "Every 1,000 $BITTYICP in your wallet = 1 Vote (VP)." },
        {
          n: "2",
          text: "Hold 10,000 $BITTYICP? You have 10 VP. Simple math, massive influence.",
        },
        {
          n: "3",
          text: "Verify external wallets (like Oisy) to stack additional VP from those balances.",
        },
        {
          n: "4",
          text: "Total VP = your connected wallet + all verified external wallets combined.",
        },
      ],
    },
    {
      id: "split-voting",
      accent: "from-blue-500",
      borderColor: "border-blue-500/40",
      bgGlow: "bg-blue-900/10",
      iconColor: "text-blue-400",
      titleColor: "text-blue-300",
      Icon: BarChart3,
      title: "Split Voting",
      steps: [
        {
          n: "1",
          text: "Each vote has 3 options. You don't pick just one — you allocate % across all three.",
        },
        {
          n: "2",
          text: "Your percentages must total exactly 100%. E.g. 60% / 30% / 10%.",
        },
        {
          n: "3",
          text: "This nuanced system lets you express conviction while hedging your position.",
        },
        {
          n: "4",
          text: "Your VP is distributed proportionally — more weight behind higher allocations.",
        },
      ],
    },
    {
      id: "monthly-votes",
      accent: "from-green-500",
      borderColor: "border-green-500/40",
      bgGlow: "bg-green-900/10",
      iconColor: "text-green-400",
      titleColor: "text-green-300",
      Icon: Coins,
      title: "Monthly Treasury Votes",
      steps: [
        {
          n: "1",
          text: "Two scheduled votes run every single month, no exceptions.",
        },
        {
          n: "2",
          text: "The 15th: Vote on what to do with the $BITTYICP treasury balance.",
        },
        {
          n: "3",
          text: "End of Month: Vote on what to do with the $ICP treasury balance.",
        },
        {
          n: "4",
          text: "Each vote runs for 7 days. Results lock automatically at close.",
        },
      ],
      extra: (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-green-900/20 border border-green-500/30 p-4 text-center">
            <div className="text-2xl mb-2">📅</div>
            <p className="text-green-300 font-black text-sm uppercase tracking-wider">
              15th Monthly
            </p>
            <p className="text-gray-400 text-xs mt-1">$BITTYICP Vote</p>
            <p className="text-gray-500 text-xs mt-1">
              Burn / Dev Wallet / Hold
            </p>
          </div>
          <div className="rounded-xl bg-blue-900/20 border border-blue-500/30 p-4 text-center">
            <div className="text-2xl mb-2">🗓️</div>
            <p className="text-blue-300 font-black text-sm uppercase tracking-wider">
              End of Month
            </p>
            <p className="text-gray-400 text-xs mt-1">$ICP Vote</p>
            <p className="text-gray-500 text-xs mt-1">
              Buy BITTY / Neuron / Hold
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "rewards",
      accent: "from-purple-500",
      borderColor: "border-purple-500/40",
      bgGlow: "bg-purple-900/10",
      iconColor: "text-purple-400",
      titleColor: "text-purple-300",
      Icon: Gift,
      title: "Governance Rewards",
      steps: [
        {
          n: "1",
          text: "After each vote, the lowest-voted option's percentage becomes the rewards pool.",
        },
        {
          n: "2",
          text: "Only voters who placed power on WINNING options earn from this pool.",
        },
        {
          n: "3",
          text: "Voting power on losing options is deducted from your reward share.",
        },
        {
          n: "4",
          text: "Admin triggers on-chain distribution — real token transfers, fully verifiable.",
        },
        {
          n: "5",
          text: "Rewards land directly in your connected principal. II users can then send out; Plug users receive directly.",
        },
      ],
    },
    {
      id: "verify-wallets",
      accent: "from-cyan-500",
      borderColor: "border-cyan-500/40",
      bgGlow: "bg-cyan-900/10",
      iconColor: "text-cyan-400",
      titleColor: "text-cyan-300",
      Icon: Shield,
      title: "Verifying External Wallets",
      steps: [
        { n: "1", text: "Sign in with Internet Identity or Plug Wallet." },
        { n: "2", text: "Copy your app principal ID from the wallet panel." },
        {
          n: "3",
          text: "From the external wallet (e.g. Oisy), send exactly 10 $BITTYICP to your principal.",
        },
        {
          n: "4",
          text: "Enter the external wallet's principal and click VERIFY. Done!",
        },
        {
          n: "⚠️",
          text: "Internet Identity creates a unique principal per app for privacy. Plug uses a universal principal, so your balance shows automatically without verification.",
        },
      ],
    },
    {
      id: "treasury",
      accent: "from-orange-500",
      borderColor: "border-orange-500/40",
      bgGlow: "bg-orange-900/10",
      iconColor: "text-orange-400",
      titleColor: "text-orange-300",
      Icon: Building2,
      title: "Treasury Wallets",
      steps: [
        {
          n: "🏦",
          text: "Main Treasury — holds $ICP and $BITTYICP. The primary vote subject each month.",
        },
        {
          n: "⚡",
          text: "NNS Neuron — staked ICP earning rewards on the Network Nervous System. Publicly verifiable.",
        },
        {
          n: "📈",
          text: "Future Investment Fund — $BITTYICP held for strategic future investments.",
        },
        {
          n: "🛠️",
          text: "Developments Wallet — funds active development, tooling, and project building.",
        },
        {
          n: "🎮",
          text: "Games & Rewards Wallet — loads the internal distribution wallet and prizes for community games.",
        },
      ],
    },
    {
      id: "games-rewards",
      accent: "from-pink-500",
      borderColor: "border-pink-500/40",
      bgGlow: "bg-pink-900/10",
      iconColor: "text-pink-400",
      titleColor: "text-pink-300",
      Icon: Gamepad2,
      title: "Games & Rewards Wallet",
      steps: [],
      extra: (
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <div className="rounded-xl bg-pink-900/20 border border-pink-500/30 p-4">
            <div className="text-2xl mb-2">🏧</div>
            <p className="text-pink-300 font-black text-sm uppercase tracking-wider">
              Internal Distribution
            </p>
            <p className="text-gray-400 text-xs mt-2">
              This wallet loads the internal canister rewards wallet, which then
              executes on-chain token transfers to each winning voter's
              principal after every vote.
            </p>
          </div>
          <div className="rounded-xl bg-purple-900/20 border border-purple-500/30 p-4">
            <div className="text-2xl mb-2">🎮</div>
            <p className="text-purple-300 font-black text-sm uppercase tracking-wider">
              Community Game Rewards
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Future games and community competitions will pay out prizes from
              this wallet, keeping gaming rewards separate from governance
              distributions.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "signing-in",
      accent: "from-yellow-400",
      borderColor: "border-yellow-400/40",
      bgGlow: "bg-yellow-900/10",
      iconColor: "text-yellow-300",
      titleColor: "text-yellow-200",
      Icon: Wallet,
      title: "Signing In",
      steps: [
        {
          n: "🔐",
          text: "Internet Identity (II) — generates a unique principal per app for maximum privacy. Great for anonymous participation.",
        },
        {
          n: "🔌",
          text: "Plug Wallet — uses a universal principal. Your $BITTYICP balance appears automatically without needing wallet verification.",
        },
        {
          n: "✅",
          text: "Either option gives you full voting capability. II users verify external wallets to stack VP; Plug users are already verified.",
        },
        {
          n: "📬",
          text: "Rewards land at your sign-in principal. From there you can send to any external wallet anytime.",
        },
      ],
    },
  ];

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "#06091a" }}
    >
      {/* ── Particle layer ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {rockets.current.map((r) => (
          <motion.div
            key={`rocket-${r.id}`}
            className="absolute select-none"
            style={{
              left: `${r.x}%`,
              bottom: "-40px",
              fontSize: r.size,
              rotate: r.angle,
            }}
            animate={{
              y: ["-10vh", "-115vh"],
              opacity: [0, 0.9, 0.9, 0],
            }}
            transition={{
              duration: r.duration,
              delay: r.delay,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          >
            🚀
          </motion.div>
        ))}
        {coins.current.map((c) => (
          <motion.div
            key={`coin-${c.id}`}
            className="absolute select-none"
            style={{
              left: `${c.x}%`,
              bottom: "-30px",
              fontSize: c.size,
            }}
            animate={{
              y: ["0vh", "-110vh"],
              opacity: [0, 0.5, 0.5, 0],
            }}
            transition={{
              duration: c.duration,
              delay: c.delay,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          >
            🪙
          </motion.div>
        ))}
      </div>

      {/* ── Top gold glow ── */}
      <div
        className="fixed top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "340px",
          background:
            "radial-gradient(ellipse 70% 340px at 50% 0%, oklch(0.87 0.17 90 / 0.18) 0%, transparent 70%)",
          zIndex: 1,
        }}
      />

      {/* ── Main content ── */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* Back button */}
        <div className="sticky top-0 z-20 pt-4 pb-2 px-4 flex items-center gap-3">
          <motion.button
            type="button"
            onClick={onBack}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/40 text-yellow-400 hover:bg-yellow-900/20 font-bold text-sm transition-colors backdrop-blur-sm bg-black/40"
            data-ocid="how_it_works.back.button"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK TO GOVERNANCE
          </motion.button>
        </div>

        {/* ── Hero ── */}
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-10 text-center">
          {/* Spinning coin */}
          <motion.div
            className="mx-auto mb-6"
            style={{ width: 100, height: 100 }}
            animate={{ rotateY: [0, 360] }}
            transition={{
              duration: 3,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          >
            <img
              src="/assets/bittyicp-coin.jpeg"
              alt="BITTYICP Coin"
              className="w-full h-full rounded-full object-cover"
              style={{
                border: "3px solid oklch(0.87 0.17 90)",
                boxShadow:
                  "0 0 24px oklch(0.87 0.17 90 / 0.6), 0 0 60px oklch(0.87 0.17 90 / 0.2)",
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h1
              className="font-black uppercase text-white tracking-tighter"
              style={{
                fontFamily: "Impact, Arial Black, sans-serif",
                fontSize: "clamp(2.8rem, 10vw, 5rem)",
                lineHeight: 1,
                textShadow: "0 0 40px oklch(0.87 0.17 90 / 0.5)",
              }}
            >
              HOW IT <span style={{ color: "oklch(0.87 0.17 90)" }}>WORKS</span>
            </h1>
            {/* Gold accent line */}
            <motion.div
              className="mx-auto mt-3 mb-4 rounded-full"
              style={{
                height: 4,
                background:
                  "linear-gradient(90deg, transparent, oklch(0.87 0.17 90), transparent)",
              }}
              initial={{ width: 0 }}
              animate={{ width: "60%" }}
              transition={{ duration: 0.8, delay: 0.4 }}
            />
            <p className="text-gray-300 text-base sm:text-lg max-w-xl mx-auto">
              BITTY ICP BANK governance is fully on-chain. Every vote, reward,
              and transfer is publicly verifiable on the Internet Computer.
            </p>
          </motion.div>

          {/* Quick stats */}
          <motion.div
            className="grid grid-cols-3 gap-3 mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            {[
              { stat: "2x", label: "Monthly Votes" },
              { stat: "1K", label: "BITTYICP = 1 VP" },
              { stat: "100%", label: "On-Chain" },
            ].map(({ stat, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-yellow-500/30 bg-yellow-900/10 py-4 px-2"
              >
                <p
                  className="font-black text-yellow-400"
                  style={{
                    fontFamily: "Impact, Arial Black, sans-serif",
                    fontSize: "1.8rem",
                  }}
                >
                  {stat}
                </p>
                <p className="text-gray-400 text-xs uppercase tracking-wider mt-1">
                  {label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Section cards ── */}
        <div className="max-w-3xl mx-auto px-4 pb-6 flex flex-col gap-5">
          {sections.map((section, idx) => (
            <motion.div
              key={section.id}
              className={`rounded-2xl border ${section.borderColor} ${section.bgGlow} overflow-hidden`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: idx * 0.04 }}
            >
              {/* Left accent bar + header */}
              <div className="flex items-start gap-0">
                <div
                  className={`w-1.5 shrink-0 self-stretch bg-gradient-to-b ${section.accent} to-transparent rounded-l-2xl`}
                />
                <div className="flex-1 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                      <section.Icon
                        className={`w-5 h-5 ${section.iconColor}`}
                      />
                    </div>
                    <h2
                      className={`font-black text-lg uppercase tracking-wide ${section.titleColor}`}
                      style={{
                        fontFamily: "Impact, Arial Black, sans-serif",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {section.title}
                    </h2>
                  </div>

                  {/* Numbered steps */}
                  {section.steps.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {section.steps.map((step) => (
                        <div key={step.n} className="flex gap-3 items-start">
                          <span
                            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${section.iconColor} border ${section.borderColor}`}
                            style={{ background: "rgba(255,255,255,0.04)" }}
                          >
                            {step.n}
                          </span>
                          <p className="text-gray-300 text-sm leading-relaxed pt-0.5">
                            {step.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extra content (grids, etc.) */}
                  {section.extra}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── CTA block ── */}
        <motion.div
          className="max-w-3xl mx-auto px-4 pb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="rounded-2xl border-2 border-yellow-500/60 p-8 text-center"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.87 0.17 90 / 0.08) 0%, transparent 60%)",
              boxShadow: "0 0 40px oklch(0.87 0.17 90 / 0.15)",
            }}
          >
            <div className="text-4xl mb-3">🚀</div>
            <h2
              className="text-white font-black uppercase text-2xl sm:text-3xl mb-2"
              style={{
                fontFamily: "Impact, Arial Black, sans-serif",
                letterSpacing: "0.06em",
              }}
            >
              READY TO VOTE?
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Head to the governance page, sign in, and make your voice count.
            </p>
            <motion.button
              type="button"
              onClick={onBack}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="px-8 py-3 rounded-full font-black text-black uppercase tracking-wider text-sm"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.87 0.17 90) 0%, oklch(0.78 0.18 75) 100%)",
                fontFamily: "Impact, Arial Black, sans-serif",
                letterSpacing: "0.08em",
              }}
              data-ocid="how_it_works.go_to_governance.button"
            >
              GO TO GOVERNANCE →
            </motion.button>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center pb-8">
          <a
            href="https://bittyonicp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 font-bold text-lg hover:text-yellow-300 transition-colors"
          >
            BITTYONICP.COM
          </a>
          <p className="text-gray-600 text-xs mt-2">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition-colors"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </div>

      <AnimatePresence />
    </div>
  );
}
