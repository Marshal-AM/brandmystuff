"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bot as BotIcon,
  Camera,
  Car,
  Check,
  Coins,
  Globe2,
  GraduationCap,
  Handshake,
  Laptop,
  Megaphone,
  Rocket,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Bot } from "@/components/scout-bot";
import { cx } from "@/components/ui";


// ------------------------------------------------------------------ building blocks

function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-p/30 bg-p/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-p">
      <span className="h-1.5 w-1.5 rounded-full bg-p shadow-[0_0_10px_var(--p)]" />
      {children}
    </span>
  );
}

/** A block of slide content. Slides render instantly: no entrance animation. */
function In({ children, className }: { children: ReactNode; d?: number; className?: string; y?: number }) {
  return <div className={className}>{children}</div>;
}

function Title({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-5xl lg:text-6xl", className)}>{children}</h2>;
}

function Glow({ className }: { className?: string }) {
  return <div aria-hidden className={cx("pointer-events-none absolute rounded-full bg-p/20 blur-[110px]", className)} />;
}

function Pill({ children, on }: { children: ReactNode; on?: boolean }) {
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", on ? "bg-p text-ink" : "border border-line-strong text-white/70")}>{children}</span>;
}

// ------------------------------------------------------------------ slides

function Cover() {
  return (
    <div className="relative grid h-full items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <Glow className="-left-40 top-10 h-[420px] w-[420px]" />
      <div className="relative">
        <In><Kicker>Pitch · 2026</Kicker></In>
        <In d={0.1}>
          <h1 className="mt-6 text-balance text-5xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-7xl lg:text-8xl">
            Your stuff is already an <span className="bg-gradient-to-r from-p via-p-300 to-white bg-clip-text text-transparent">ad space.</span>
          </h1>
        </In>
        <In d={0.25}>
          <p className="mt-6 max-w-xl text-lg text-white/70 sm:text-xl">Rent the space on your laptop, car or shop window to brands. Paid safely, with proof.</p>
        </In>
        <In d={0.4} className="mt-8 flex flex-wrap gap-2">
          <Pill on>Rent</Pill>
          <Pill>Prove</Pill>
          <Pill>Get paid</Pill>
          <Pill>Invest</Pill>
        </In>
      </div>
      <In d={0.3} className="relative mx-auto w-full max-w-md">
        <div className="relative aspect-[4/3] rounded-[2rem] border border-line-strong bg-gradient-to-br from-p-900 to-p-950 p-6 shadow-[0_40px_120px_-30px_rgba(171,159,242,0.45)]">
          {/* laptop lid with stickers */}
          <div className="relative h-full rounded-2xl bg-gradient-to-br from-[#2a2838] to-[#1a1924] shadow-inner">
            <div className="absolute left-1/2 top-1/2 h-10 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10" />
            {[
              { l: "12%", t: "14%", r: -8, c: "bg-p text-ink", t2: "LUMEN" },
              { l: "58%", t: "18%", r: 6, c: "bg-white text-ink", t2: "acme" },
              { l: "16%", t: "62%", r: 5, c: "bg-p-300 text-ink", t2: "orbit" },
              { l: "60%", t: "62%", r: -5, c: "border border-p/60 text-p", t2: "your ad?" },
            ].map((s) => (
              <motion.span
                key={s.t2}
                initial={false}
                animate={{ opacity: 1, scale: 1, rotate: s.r }}
                className={cx("absolute rounded-xl px-3 py-2 text-xs font-extrabold tracking-wide shadow-lg", s.c)}
                style={{ left: s.l, top: s.t }}
              >
                {s.t2}
              </motion.span>
            ))}
          </div>
          <div className="absolute -bottom-6 -right-6">
            <Bot pose="wave" mood="happy" size={96} />
          </div>
        </div>
      </In>
    </div>
  );
}

const TWEETS = [
  { src: "/pitch/ads1.jpeg", w: 709, h: 855, who: "A developer's MacBook", short: "MacBook", views: "10.3M", note: "10 sticker spots sold" },
  { src: "/pitch/ads2.jpeg", w: 553, h: 880, who: "Solana's own logo", short: "Solana logo", views: "951.6K", note: "9 ad spots on a logo" },
  { src: "/pitch/ads3.jpeg", w: 561, h: 566, who: "A groom's tuxedo", short: "Tuxedo", views: "448.5K", note: "Sponsors paid for the suit" },
];

/** The viral posts behind the idea, side by side with their numbers. Click one to see it full size. */
function TweetStack() {
  const [zoom, setZoom] = useState<number | null>(null);
  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {TWEETS.map((t, n) => (
          <In key={t.src} d={0.3 + n * 0.1}>
            <button type="button" onClick={() => setZoom(n)} aria-label={`Open ${t.who} post`} className="block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-white/10 bg-white transition-transform duration-300 hover:-translate-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.src} alt={`${t.who}: viral post about selling ad space`} width={t.w} height={t.h} className="aspect-[3/4] w-full object-cover object-top" />
            </button>
            <div className="mt-3">
              <div className="text-xl font-extrabold tracking-tight text-p">{t.views}</div>
              <div className="text-xs text-muted">views</div>
              <div className="mt-1.5 text-sm font-bold">{t.who}</div>
              <div className="text-xs text-white/60">{t.note}</div>
            </div>
          </In>
        ))}
      </div>
      <AnimatePresence>
        {zoom !== null && (
          <motion.div initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)} className="fixed inset-0 z-[80] grid cursor-zoom-out place-items-center bg-black/80 p-6 backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={TWEETS[zoom].src} alt={TWEETS[zoom].who} className="max-h-[88vh] max-w-[92vw] rounded-2xl shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Inspiration() {
  const why = [
    { icon: Coins, t: "Affordable", d: "hundreds, not thousands" },
    { icon: Globe2, t: "It travels", d: "goes wherever the owner goes" },
    { icon: Users, t: "It's human", d: "feels like a recommendation" },
  ];
  return (
    <div className="relative grid h-full items-center gap-10 lg:grid-cols-[1fr_1fr]">
      <Glow className="right-0 top-0 h-[380px] w-[380px]" />
      <div>
        <In><Kicker>Where it started</Kicker></In>
        <In d={0.1}><Title className="mt-5">People started selling ad space <span className="text-p">on their stuff.</span></Title></In>
        <In d={0.2}>
          <p className="mt-6 max-w-xl text-lg text-white/70">Why it went viral: <span className="font-semibold text-white">small brands could finally afford real-world ads.</span></p>
        </In>
        <div className="mt-7 space-y-2.5">
          {why.map((w, i) => (
            <In key={w.t} d={0.3 + i * 0.1} className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-p/15 text-p"><w.icon className="h-4 w-4" /></span>
              <div><span className="font-bold">{w.t}</span> <span className="text-white/60">· {w.d}</span></div>
            </In>
          ))}
        </div>
        <In d={0.65} className="mt-7 flex flex-wrap gap-x-8 gap-y-3">
          {[["11.7M+", "views"], ["64", "brands bid"], ["20 / 20", "spots sold"]].map(([v, l]) => (
            <div key={l}>
              <div className="text-2xl font-extrabold tracking-tight">{v}</div>
              <div className="text-xs text-muted">{l}</div>
            </div>
          ))}
        </In>
      </div>
      <In d={0.25}><TweetStack /></In>
    </div>
  );
}

function Problem() {
  const barriers = [
    { icon: Coins, t: "Too expensive", d: "Thousands a month, long contracts" },
    { icon: Handshake, t: "Built for big budgets", d: "Agencies ignore $500 brands" },
    { icon: Globe2, t: "Stuck in one place", d: "One corner, one audience" },
  ];
  const broke = [
    "30% of winners never paid",
    "No quality signal",
    "No proof of display",
    "98% of spots sit empty",
  ];
  return (
    <div className="relative flex h-full flex-col justify-center">
      <In><Kicker>The problem</Kicker></In>
      <In d={0.1}><Title className="mt-5 max-w-5xl">Real-world advertising is <span className="text-p">locked away from small brands.</span></Title></In>
      <In d={0.2}><p className="mt-5 max-w-3xl text-lg text-white/70">Small brands can afford online ads. The real world is priced for giants.</p></In>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {barriers.map((c, i) => (
          <In key={c.t} d={0.3 + i * 0.1} className="rounded-3xl border border-line-strong bg-white/[0.03] p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-p/15 text-p"><c.icon className="h-5 w-5" /></span>
            <div className="mt-4 text-lg font-extrabold">{c.t}</div>
            <p className="mt-1.5 text-sm text-white/65">{c.d}</p>
          </In>
        ))}
      </div>
      <In d={0.65} className="mt-4 rounded-3xl border border-line-strong bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-sm font-bold text-white">Cheaper options broke on trust:</span>
          {broke.map((b) => (
            <span key={b} className="inline-flex items-center gap-2 text-sm text-white/60"><X className="h-3.5 w-3.5 text-p" strokeWidth={3} />{b}</span>
          ))}
        </div>
      </In>
    </div>
  );
}

function Insight() {
  const things = [
    { icon: Laptop, name: "Laptop lid", seen: "~400 people / day" },
    { icon: Car, name: "Car rear window", seen: "~2,000 people / day" },
    { icon: Store, name: "Shop window", seen: "~5,000 people / day" },
    { icon: GraduationCap, name: "Backpack on campus", seen: "~800 people / day" },
  ];
  return (
    <div className="relative grid h-full items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
      <Glow className="-left-20 bottom-0 h-[360px] w-[360px]" />
      <div>
        <In><Kicker>The insight</Kicker></In>
        <In d={0.1}><Title className="mt-5">Everyday objects are <span className="text-p">billboards nobody is renting.</span></Title></In>
        <In d={0.2}><p className="mt-6 max-w-lg text-lg text-white/70">Seen every day. Earning nothing. Until now.</p></In>
      </div>
      <div className="space-y-3">
        {things.map((t, i) => (
          <In key={t.name} d={0.2 + i * 0.1} className="flex items-center gap-4 rounded-2xl border border-line-strong bg-white/[0.03] p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-p/15 text-p"><t.icon className="h-6 w-6" /></span>
            <div className="flex-1 font-bold">{t.name}</div>
            <div className="relative h-2 w-28 overflow-hidden rounded-full bg-white/[0.06] sm:w-44">
              <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-p-600 to-p" initial={false} animate={{ width: `${[25, 55, 95, 38][i]}%` }} />
            </div>
            <div className="w-36 text-right text-sm text-muted">{t.seen}</div>
          </In>
        ))}
        <In d={0.7} className="text-right text-xs text-faint">Illustrative daily views</In>
      </div>
    </div>
  );
}

function Solution() {
  const steps = [
    { icon: Camera, t: "Snap", d: "Photo your object, mark the spots" },
    { icon: Sparkles, t: "Score", d: "AI rates every spot" },
    { icon: Handshake, t: "Lease", d: "Brand pays into escrow" },
    { icon: BadgeCheck, t: "Prove & earn", d: "Weekly photo releases pay" },
  ];
  return (
    <div className="relative flex h-full flex-col justify-center">
      <In><Kicker>The solution</Kicker></In>
      <In d={0.1}><Title className="mt-5 max-w-4xl">A marketplace where <span className="text-p">everyone is protected.</span></Title></In>
      <div className="relative mt-12 grid gap-4 md:grid-cols-4">
        <motion.div aria-hidden className="absolute left-[12%] right-[12%] top-7 hidden h-px origin-left bg-gradient-to-r from-p/0 via-p to-p/0 md:block" initial={false} animate={{ scaleX: 1 }} />
        {steps.map((s, i) => (
          <In key={s.t} d={0.25 + i * 0.15} className="relative text-center md:text-left">
            <span className="relative z-10 mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-p text-ink shadow-[0_0_40px_rgba(171,159,242,0.5)] md:mx-0"><s.icon className="h-6 w-6" /></span>
            <div className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-faint">Step {i + 1}</div>
            <div className="mt-1 text-2xl font-extrabold">{s.t}</div>
            <p className="mt-2 text-sm text-white/65">{s.d}</p>
          </In>
        ))}
      </div>
      <In d={0.9} className="mt-10 flex flex-wrap items-center gap-3 rounded-3xl border border-p/30 bg-p/[0.07] p-5">
        <Coins className="h-5 w-5 text-p" />
        <span className="font-bold">Bonus:</span>
        <span className="text-white/75">split a great spot into shares anyone can own.</span>
      </In>
    </div>
  );
}

function Ownership() {
  const reasons = [
    { icon: TrendingUp, t: "Real income", d: "A cut of every rent" },
    { icon: Coins, t: "Tiny entry", d: "10,000 shares per spot" },
    { icon: BadgeCheck, t: "Visible", d: "Weekly proof photos" },
    { icon: Wallet, t: "Paid anywhere", d: "Sui, Base, Arbitrum…" },
    { icon: Handshake, t: "Liquid", d: "Sell any time" },
    { icon: Users, t: "Back people early", d: "Grow if they go viral" },
  ];
  return (
    <div className="relative grid h-full items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <Glow className="-left-24 top-1/3 h-[380px] w-[380px]" />
      <div>
        <In><Kicker>Why own a slice</Kicker></In>
        <In d={0.1}><Title className="mt-5">Own the billboard, <span className="text-p">not just the ad.</span></Title></In>
        <In d={0.2}><p className="mt-6 max-w-md text-lg text-white/70">Like owning a tiny piece of a building that pays rent.</p></In>
        <In d={0.35} className="mt-7 rounded-3xl border border-p/30 bg-p/[0.07] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-p">A simple example</div>
          <p className="mt-2 text-white/80"><b>$40/week</b> rent · 60% to holders · own <b>1%</b> = <b className="text-p">$0.24 every week</b></p>
        </In>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {reasons.map((r, i) => (
          <In key={r.t} d={0.2 + i * 0.08} className="rounded-3xl border border-line-strong bg-white/[0.03] p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-p/15 text-p"><r.icon className="h-5 w-5" /></span>
            <div className="mt-3 font-extrabold">{r.t}</div>
            <p className="mt-1.5 text-sm text-white/65">{r.d}</p>
          </In>
        ))}
      </div>
    </div>
  );
}

function Hype() {
  const steps = [
    { icon: Camera, t: "Post it", d: "Share the spot on socials" },
    { icon: Rocket, t: "It goes viral", d: "Like a token after marketing" },
    { icon: Megaphone, t: "Brands pile in", d: "More leases, higher prices" },
    { icon: Coins, t: "Everyone earns", d: "Owner and holders win" },
  ];
  // Illustrative demand curve for one spot before and after a viral post.
  const bars = [8, 9, 8, 10, 11, 12, 30, 58, 76, 88, 94, 100];
  return (
    <div className="relative flex h-full flex-col justify-center">
      <Glow className="right-10 top-10 h-[360px] w-[360px]" />
      <div className="grid items-end gap-10 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <In><Kicker>Why buy early</Kicker></In>
          <In d={0.1}><Title className="mt-5">One viral post <span className="text-p">can make a spot famous.</span></Title></In>
          <In d={0.2}><p className="mt-5 max-w-xl text-lg text-white/70">Early holders ride the wave with the owner.</p></In>
        </div>
        <In d={0.3} className="relative rounded-3xl border border-line-strong bg-white/[0.03] p-5">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em] text-faint">
            <span>Brands wanting this spot</span>
            <motion.span initial={false} animate={{ opacity: 1, scale: 1 }} className="rounded-full bg-p px-2.5 py-1 text-[10px] text-ink">Post goes viral</motion.span>
          </div>
          <div className="mt-4 flex h-36 items-end gap-1.5">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                initial={false}
                animate={{ height: `${h}%` }}
                className={cx("flex-1 rounded-t-md", i >= 6 ? "bg-gradient-to-t from-p-600 to-p shadow-[0_0_18px_-4px_rgba(171,159,242,0.7)]" : "bg-white/15")}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-faint"><span>Before</span><span>After the post</span></div>
        </In>
      </div>
      <div className="relative mt-10 grid gap-4 md:grid-cols-4">
        {steps.map((st, i) => (
          <In key={st.t} d={0.5 + i * 0.12} className="relative rounded-3xl border border-line-strong bg-white/[0.03] p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-p text-ink"><st.icon className="h-5 w-5" /></span>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-faint">0{i + 1}</span>
            </div>
            <div className="mt-4 text-lg font-extrabold">{st.t}</div>
            <p className="mt-1.5 text-sm text-white/65">{st.d}</p>
            {i < steps.length - 1 && <ArrowRight className="absolute -right-3.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-p md:block" />}
          </In>
        ))}
      </div>
      <In d={1.1} className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-p/30 bg-p/[0.07] p-4 text-sm text-white/80"><span className="font-bold text-p">Owners</span> · more leases, pricier shares</div>
        <div className="rounded-2xl border border-p/30 bg-p/[0.07] p-4 text-sm text-white/80"><span className="font-bold text-p">Holders</span> · more rent, shares worth more</div>
      </In>
    </div>
  );
}

function WhyUse() {
  const who = [
    { icon: Laptop, t: "Owners", pts: ["Earn from your stuff", "Paid upfront, guaranteed", "Raise money on a spot"] },
    { icon: Megaphone, t: "Small brands", pts: ["Ads from $1 a week", "Your brand travels", "Pay only for proven weeks"] },
    { icon: TrendingUp, t: "Shareholders", pts: ["Weekly ad rent", "Start tiny", "Sell any time"] },
    { icon: BotIcon, t: "AI agents", pts: ["Book with no human", "Stay inside a budget", "Pay instantly"] },
  ];
  return (
    <div className="relative flex h-full flex-col justify-center">
      <In><Kicker>Why people use it</Kicker></In>
      <In d={0.1}><Title className="mt-5 max-w-4xl">Something in it <span className="text-p">for everyone at the table.</span></Title></In>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {who.map((w, i) => (
          <In key={w.t} d={0.2 + i * 0.1} className="rounded-3xl border border-line-strong bg-white/[0.03] p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-p/15 text-p"><w.icon className="h-5 w-5" /></span>
            <div className="mt-4 text-lg font-extrabold">{w.t}</div>
            <ul className="mt-3 space-y-2">
              {w.pts.map((p) => (
                <li key={p} className="flex gap-2 text-sm text-white/70"><Check className="mt-0.5 h-4 w-4 shrink-0 text-p" strokeWidth={3} />{p}</li>
              ))}
            </ul>
          </In>
        ))}
      </div>
    </div>
  );
}

function Different() {
  const rows: [string, string, string, string, string][] = [
    ["Any object", "✕", "Laptops", "Cars", "✓"],
    ["Paid upfront", "20% deposit", "~", "Contract", "100% escrow"],
    ["Proof it's up", "✕", "✕", "Monthly", "Weekly"],
    ["Quality score", "✕", "✕", "✕", "✓"],
    ["Shares in a spot", "✕", "✕", "✕", "✓"],
    ["AI agents can buy", "✕", "✕", "✕", "✓"],
  ];
  return (
    <div className="relative flex h-full flex-col justify-center">
      <In><Kicker>What makes us different</Kicker></In>
      <In d={0.1}><Title className="mt-5 max-w-4xl">Others list spots. <span className="text-p">We make them trustworthy.</span></Title></In>
      <In d={0.25} className="mt-10 overflow-hidden rounded-3xl border border-line-strong">
        <div className="grid grid-cols-[1.6fr_repeat(4,1fr)] bg-white/[0.04] text-xs font-bold uppercase tracking-[0.1em] text-faint">
          {["", "Viral auctions", "Laptop sites", "Car wraps", "brandmystuff"].map((h, i) => (
            <div key={i} className={cx("px-4 py-3", i === 4 && "bg-p/15 text-p")}>{h}</div>
          ))}
        </div>
        {rows.map((r) => (
          <motion.div key={r[0]} initial={false} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-[1.6fr_repeat(4,1fr)] border-t border-line text-sm">
            {r.map((c, ci) => (
              <div key={ci} className={cx("px-4 py-3", ci === 0 ? "font-semibold text-white" : "text-white/55", ci === 4 && "bg-p/[0.08] font-bold text-p")}>{c}</div>
            ))}
          </motion.div>
        ))}
      </In>
    </div>
  );
}

function Pmf() {
  const signals = [
    { icon: Users, t: "Demand on both sides", d: "64 brands, thousands of listings" },
    { icon: ShieldCheck, t: "Trust was the blocker", d: "We fix defaults and empty spots" },
    { icon: Rocket, t: "Creators are ready", d: "Next: monetise your stuff" },
    { icon: BotIcon, t: "Agents are buying", d: "AI budgets need inventory" },
  ];
  return (
    <div className="relative grid h-full items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
      <Glow className="-right-24 top-10 h-[380px] w-[380px]" />
      <div>
        <In><Kicker>Product-market fit</Kicker></In>
        <In d={0.1}><Title className="mt-5">The market already <span className="text-p">tried to exist.</span></Title></In>
        <In d={0.2}><p className="mt-6 max-w-md text-lg text-white/70">The demand appeared on its own, then broke on trust.</p></In>
        <In d={0.35} className="mt-8 rounded-3xl border border-p/30 bg-p/[0.07] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-p">Our first customer</div>
          <div className="mt-2 text-lg font-bold">Creators with a laptop</div>
          <div className="text-white/70">+ indie brands with $300–3,000</div>
        </In>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {signals.map((s, i) => (
          <In key={s.t} d={0.2 + i * 0.1} className="rounded-3xl border border-line-strong bg-white/[0.03] p-5">
            <s.icon className="h-5 w-5 text-p" />
            <div className="mt-3 font-extrabold">{s.t}</div>
            <p className="mt-1.5 text-sm text-white/65">{s.d}</p>
          </In>
        ))}
      </div>
    </div>
  );
}

function Gtm() {
  const phases = [
    {
      n: "01",
      when: "Months 0–3",
      t: "Win the campus",
      pts: ["Campus ambassadors", "\"Brand my laptop\" challenge", "First-lease bonus"],
      kpi: "2,000 listed spots",
    },
    {
      n: "02",
      when: "Months 3–6",
      t: "Bring the brands",
      pts: ["Indie & crypto brands", "Hackathon sticker drops", "Self-serve booking"],
      kpi: "300 paying brands",
    },
    {
      n: "03",
      when: "Months 6–12",
      t: "Go beyond laptops",
      pts: ["Drivers & riders", "Shop windows", "Shares for fans"],
      kpi: "10 cities · 3 object types",
    },
    {
      n: "04",
      when: "Year 2",
      t: "Let the agents buy",
      pts: ["Open agent catalogue", "Ad-network plugs", "Always-on demand"],
      kpi: "Agents book 30% of leases",
    },
  ];
  return (
    <div className="relative flex h-full flex-col justify-center">
      <In><Kicker>Go-to-market</Kicker></In>
      <In d={0.1}><Title className="mt-5 max-w-4xl">Start where the trend was born. <span className="text-p">Then widen the circle.</span></Title></In>
      <div className="relative mt-10 grid gap-4 md:grid-cols-4">
        <motion.div aria-hidden className="absolute left-0 right-0 top-[22px] hidden h-px origin-left bg-gradient-to-r from-p via-p/60 to-p/10 md:block" initial={false} animate={{ scaleX: 1 }} />
        {phases.map((p, i) => (
          <In key={p.n} d={0.25 + i * 0.15} className="relative">
            <div className="relative z-10 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-p text-sm font-extrabold text-ink shadow-[0_0_30px_rgba(171,159,242,0.5)]">{p.n}</span>
              <span className="rounded-full bg-p-950 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">{p.when}</span>
            </div>
            <div className="mt-5 rounded-3xl border border-line-strong bg-white/[0.03] p-5">
              <div className="text-xl font-extrabold">{p.t}</div>
              <ul className="mt-3 space-y-2">
                {p.pts.map((x) => (
                  <li key={x} className="flex gap-2 text-sm text-white/70"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-p" />{x}</li>
                ))}
              </ul>
              <div className="mt-4 rounded-2xl bg-p/10 px-3 py-2 text-xs font-bold text-p">Goal · {p.kpi}</div>
            </div>
          </In>
        ))}
      </div>
    </div>
  );
}

function Growth() {
  const loops = [
    { icon: Laptop, t: "Every lid markets us", d: "QR tag on each sticker" },
    { icon: Users, t: "Owners recruit owners", d: "Referral rewards" },
    { icon: Megaphone, t: "Brands come back", d: "Proof makes results visible" },
  ];
  return (
    <div className="relative grid h-full items-center gap-10 lg:grid-cols-2">
      <div>
        <In><Kicker>Growth engine</Kicker></In>
        <In d={0.1}><Title className="mt-5">A flywheel that <span className="text-p">feeds itself.</span></Title></In>
        <div className="mt-8 space-y-3">
          {loops.map((l, i) => (
            <In key={l.t} d={0.2 + i * 0.12} className="flex gap-4 rounded-2xl border border-line-strong bg-white/[0.03] p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-p/15 text-p"><l.icon className="h-5 w-5" /></span>
              <div>
                <div className="font-extrabold">{l.t}</div>
                <p className="mt-1 text-sm text-white/65">{l.d}</p>
              </div>
            </In>
          ))}
        </div>
      </div>
      <In d={0.3} className="relative mx-auto aspect-square w-full max-w-[420px]">
        <div className="absolute inset-0 rounded-full border border-dashed border-p/40" />
        <div className="absolute inset-[18%] rounded-full bg-p/10 blur-2xl" />
        {[
          { t: "More owners", a: -90 },
          { t: "More spots", a: 0 },
          { t: "More brands", a: 90 },
          { t: "More earnings", a: 180 },
        ].map((n) => {
          const r = 44;
          const x = 50 + r * Math.cos((n.a * Math.PI) / 180), y = 50 + r * Math.sin((n.a * Math.PI) / 180);
          return (
            <motion.div key={n.t} initial={false} animate={{ opacity: 1, scale: 1 }} className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-p/40 bg-p-950 px-4 py-2 text-sm font-bold shadow-[0_0_30px_-6px_rgba(171,159,242,0.6)]" style={{ left: `${x}%`, top: `${y}%` }}>
              {n.t}
            </motion.div>
          );
        })}
        <div className="absolute inset-0 grid place-items-center">
          <Bot pose="celebrate" mood="happy" size={110} />
        </div>
      </In>
    </div>
  );
}

function Model() {
  const streams = [
    { pct: "12%", t: "of every lease", d: "Owner keeps 88%" },
    { pct: "3%", t: "on a raise", d: "When shares sell out" },
    { pct: "1%", t: "on share trades", d: "Buy or sell" },
    { pct: "$3–10", t: "a day featured", d: "Never changes ranking" },
  ];
  return (
    <div className="relative flex h-full flex-col justify-center">
      <In><Kicker>Business model</Kicker></In>
      <In d={0.1}><Title className="mt-5 max-w-4xl">We only earn <span className="text-p">when owners earn.</span></Title></In>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {streams.map((s, i) => (
          <In key={s.t} d={0.2 + i * 0.1} className="relative overflow-hidden rounded-3xl border border-line-strong bg-white/[0.03] p-6">
            <Glow className="-right-10 -top-10 h-32 w-32" />
            <div className="relative text-5xl font-extrabold tracking-tight text-p">{s.pct}</div>
            <div className="relative mt-2 text-lg font-bold">{s.t}</div>
            <p className="relative mt-2 text-sm text-white/65">{s.d}</p>
          </In>
        ))}
      </div>
      <In d={0.7} className="mt-8 flex flex-wrap items-center gap-3 text-white/70">
        <Wallet className="h-5 w-5 text-p" />
        $40/week lease → owner <span className="font-bold text-white">$35.20</span> · us <span className="font-bold text-white">$4.80</span>
      </In>
    </div>
  );
}

function Today() {
  const built = [
    "Email sign-up",
    "AI score in a minute",
    "Escrow until proof",
    "Proof releases pay",
    "Shares you can trade",
    "AI agent books ads",
    "Payouts on 5 chains",
    "A public name per spot",
  ];
  return (
    <div className="relative grid h-full items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <In><Kicker>Where we are</Kicker></In>
        <In d={0.1}><Title className="mt-5">Not a mock-up. <span className="text-p">It works today.</span></Title></In>
        <In d={0.2}><p className="mt-6 max-w-md text-lg text-white/70">Every flow runs end to end on public testnets.</p></In>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {built.map((b, i) => (
          <In key={b} d={0.15 + i * 0.06} className="flex items-start gap-3 rounded-2xl border border-line-strong bg-white/[0.03] p-4 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-p text-ink"><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>
            <span className="text-white/80">{b}</span>
          </In>
        ))}
      </div>
    </div>
  );
}

function Close() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center text-center">
      <Glow className="left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2" />
      <In><Bot pose="celebrate" mood="happy" size={120} /></In>
      <In d={0.15}><Kicker>The vision</Kicker></In>
      <In d={0.25}>
        <h2 className="mt-6 max-w-4xl text-balance text-5xl font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-7xl">
          Turn the world&apos;s <span className="bg-gradient-to-r from-p via-p-300 to-white bg-clip-text text-transparent">stuff</span> into the world&apos;s biggest ad network.
        </h2>
      </In>
      <In d={0.4}><p className="mt-6 max-w-2xl text-lg text-white/70">Owned by people. Trusted by brands. Open to agents.</p></In>
      <In d={0.55} className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/list" className="inline-flex items-center gap-2 rounded-full bg-p px-6 py-3 text-sm font-bold text-ink shadow-[0_0_40px_rgba(171,159,242,0.5)] transition-transform hover:scale-[1.03]">List your stuff <ArrowRight className="h-4 w-4" /></Link>
        <Link href="/explore" className="inline-flex items-center gap-2 rounded-full border border-line-strong px-6 py-3 text-sm font-bold text-white transition-colors hover:border-p/60">Explore the marketplace <Globe2 className="h-4 w-4" /></Link>
      </In>
    </div>
  );
}

type Cell = { t: string; d: string };
type Group = { label: string; cells: Cell[] };

/** A quick, scannable grid of what was built on one partner technology. */
function Matrix({ kicker, title, accent, sub, groups, badge }: { kicker: string; title: string; accent: string; sub: string; groups: Group[]; badge?: ReactNode }) {
  return (
    <div className="relative flex h-full flex-col justify-center">
      <Glow className="-right-24 -top-10 h-[360px] w-[360px]" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Kicker>{kicker}</Kicker>
          <Title className="mt-5">{title} <span className="text-p">{accent}</span></Title>
          <p className="mt-3 text-lg text-white/70">{sub}</p>
        </div>
        {badge}
      </div>
      <div className={cx("mt-8 grid gap-3", groups.length === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        {groups.map((g) => (
          <div key={g.label} className="rounded-3xl border border-line-strong bg-white/[0.03] p-4">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-p">{g.label}</div>
            <ul className="space-y-2.5">
              {g.cells.map((c) => (
                <li key={c.t} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-p text-ink"><Check className="h-3 w-3" strokeWidth={3.5} /></span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-tight">{c.t}</div>
                    <div className="text-xs text-white/55">{c.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnSui() {
  return (
    <Matrix
      kicker="Built on Sui"
      title="Every rule and every dollar"
      accent="lives on Sui."
      sub="10 Move modules · 3 live upgrades · testnet"
      groups={[
        { label: "Marketplace", cells: [
          { t: "Objects & ad spaces", d: "Shared objects + calendars" },
          { t: "AI score on-chain", d: "AQS, grade, report hash" },
          { t: "No double booking", d: "Week-level calendar" },
          { t: "Sponsored listings", d: "Paid tags, never ranking" },
        ] },
        { label: "Escrow & payouts", cells: [
          { t: "USDC escrow", d: "Full amount upfront" },
          { t: "Proof-gated tranches", d: "80% match enforced in Move" },
          { t: "Auto refunds", d: "Anyone can trigger after deadlines" },
          { t: "Fee waterfall", d: "12% · holders · owner" },
          { t: "Disputes", d: "Admin-resolved, on-chain" },
        ] },
        { label: "Tokenisation", cells: [
          { t: "10,000 units per spot", d: "Revenue-share offerings" },
          { t: "KYC registry", d: "ERC-3643-style gating" },
          { t: "Income accumulator", d: "Pro-rata, zero dust lost" },
          { t: "Order book", d: "Asks, bids, expiries" },
          { t: "Cross-chain routes", d: "Holder-signed payout.move" },
        ] },
        { label: "Agents & infra", cells: [
          { t: "x402 on Sui", d: "Our own facilitator" },
          { t: "Budget mandates", d: "Agent spend caps in Move" },
          { t: "Admin & operator caps", d: "Governance vs backend rights" },
          { t: "Walrus + Display", d: "Photos render in wallets" },
          { t: "Privy + Sui wallets", d: "Email or wallet sign-in" },
        ] },
      ]}
    />
  );
}

function OnCurvegrid() {
  return (
    <Matrix
      kicker="Powered by Curvegrid"
      title="Four EVM chains,"
      accent="one payout backend."
      sub="MultiBaas runs every EVM step of cross-chain payouts"
      badge={
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/curvegrid.png" alt="Curvegrid" width={427} height={97} className="h-9 w-auto opacity-90 brightness-150" />
      }
      groups={[
        { label: "Deploy & manage", cells: [
          { t: "Relayer on 4 chains", d: "Ethereum, Base, Arbitrum, Optimism" },
          { t: "Contract library", d: "Relayer, Circle, USDC ABIs" },
          { t: "Aliases", d: "No hard-coded addresses" },
          { t: "One-command setup", d: "Idempotent script" },
        ] },
        { label: "Move the money", cells: [
          { t: "Tx composition", d: "Nonce, gas, EIP-1559" },
          { t: "Submit & track", d: "Platform key signs only" },
          { t: "Circle CCTP", d: "Native USDC, no wrapping" },
          { t: "Receipts & retries", d: "Reverts re-delivered" },
        ] },
        { label: "See the results", cells: [
          { t: "Event indexing", d: "Every PayoutDelivered" },
          { t: "Event queries", d: "Lifetime delivered per holder" },
          { t: "Contract reads", d: "Live USDC balance" },
          { t: "Signed webhooks", d: "HMAC, deduplicated" },
        ] },
      ]}
    />
  );
}

function OnEns() {
  return (
    <Matrix
      kicker="Named on ENS"
      title="Every account, object, space"
      accent="and agent has a name."
      sub="ENSv2 on Sepolia · you can edit your bio, not your score"
      groups={[
        { label: "Naming", cells: [
          { t: "brandmystuff.eth tree", d: "Account › object › space › lease" },
          { t: "Subregistries on demand", d: "One per parent name" },
          { t: "Lease labels from Move", d: "Sui and ENS always agree" },
          { t: "Non-transferable", d: "Names stay meaningful" },
        ] },
        { label: "Enhanced Access Control", cells: [
          { t: "Resolver per identity", d: "Permissioned Resolvers" },
          { t: "Key-scoped roles", d: "Owners edit profile keys" },
          { t: "Attested records", d: "Score & price platform-only" },
          { t: "Expiring lease names", d: "Held by the advertiser" },
          { t: "Live permission proofs", d: "Role reads + probes" },
        ] },
        { label: "Records & verification", cells: [
          { t: "AQS datasheet on ENS", d: "Score, grade, price" },
          { t: "Sui ↔ ENS two-way check", d: "sui.object record" },
          { t: "Sui addresses (784)", d: "Resolve names to Sui" },
          { t: "Auto relayer", d: "Sui events → ENS writes" },
        ] },
        { label: "Agents", cells: [
          { t: "scout.<brand>.eth", d: "Agents as namespaces" },
          { t: "Self-registered receipts", d: "buy-<n> per purchase" },
          { t: "Revoke = rights gone", d: "Follows the Sui mandate" },
          { t: "x402 ENS identity", d: "Name must match payer" },
          { t: "ENSIP-26 discovery", d: "MCP + x402 endpoints" },
        ] },
      ]}
    />
  );
}

const SLIDES = [
  { id: "cover", label: "brandmystuff", C: Cover },
  { id: "inspiration", label: "Inspiration", C: Inspiration },
  { id: "problem", label: "Problem", C: Problem },
  { id: "insight", label: "Insight", C: Insight },
  { id: "solution", label: "Solution", C: Solution },
  { id: "own", label: "Why own a slice", C: Ownership },
  { id: "hype", label: "Why buy early", C: Hype },
  { id: "why", label: "Why use it", C: WhyUse },
  { id: "different", label: "Difference", C: Different },
  { id: "pmf", label: "Market fit", C: Pmf },
  { id: "gtm", label: "Go-to-market", C: Gtm },
  { id: "growth", label: "Growth", C: Growth },
  { id: "model", label: "Business model", C: Model },
  { id: "today", label: "Today", C: Today },
  { id: "close", label: "Vision", C: Close },
  { id: "sui", label: "Built on Sui", C: OnSui },
  { id: "curvegrid", label: "Powered by Curvegrid", C: OnCurvegrid },
  { id: "ens", label: "Named on ENS", C: OnEns },
];

// ------------------------------------------------------------------ deck

export default function Pitch() {
  const [[i], setState] = useState<[number, number]>([0, 1]);
  const go = useCallback((n: number) => setState(([cur]) => [Math.max(0, Math.min(SLIDES.length - 1, n)), n >= cur ? 1 : -1]), []);
  const next = useCallback(() => setState(([cur]) => [Math.min(SLIDES.length - 1, cur + 1), 1]), []);
  const prev = useCallback(() => setState(([cur]) => [Math.max(0, cur - 1), -1]), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      if (e.key === "Home") go(0);
      if (e.key === "End") go(SLIDES.length - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev, go]);

  // swipe on touch screens
  const touch = useRef<number | null>(null);
  const S = SLIDES[i];

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-ink text-white"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
        touch.current = null;
      }}
    >
      {/* backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(171,159,242,0.18)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-10 sm:py-6">
        <Link href="/" className="text-white" aria-label="brandmystuff home"><Logo /></Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs font-bold uppercase tracking-[0.16em] text-faint sm:inline">{S.label}</span>
          <Link href="/" className="grid h-9 w-9 place-items-center rounded-full border border-line-strong text-white/70 transition-colors hover:border-p/60 hover:text-white" aria-label="Close pitch"><X className="h-4 w-4" /></Link>
        </div>
      </div>

      {/* slide */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <section
          key={S.id}
          className="absolute inset-0 overflow-y-auto px-5 pb-28 sm:px-10 lg:px-20"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${SLIDES.length}: ${S.label}`}
        >
          <div className="mx-auto h-full min-h-[560px] max-w-7xl">
            <S.C />
          </div>
        </section>
      </div>

      {/* bottom bar: progress + arrows (bottom right) */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 bg-gradient-to-t from-ink via-ink/90 to-transparent px-5 pb-5 pt-10 sm:px-10 sm:pb-7">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-sm tabular-nums text-white/70">
            <span className="text-white">{String(i + 1).padStart(2, "0")}</span> / {String(SLIDES.length).padStart(2, "0")}
          </span>
          <div className="hidden items-center gap-1.5 sm:flex">
            {SLIDES.map((s, n) => (
              <button key={s.id} onClick={() => go(n)} aria-label={`Go to ${s.label}`} className="group relative h-6">
                <span className={cx("block h-1.5 rounded-full transition-all duration-500", n === i ? "w-8 bg-p shadow-[0_0_12px_var(--p)]" : n < i ? "w-3 bg-p/50" : "w-3 bg-white/15 group-hover:bg-white/30")} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prev} disabled={i === 0} aria-label="Previous slide" data-testid="pitch-prev" className="grid h-12 w-12 place-items-center rounded-full border border-line-strong bg-white/[0.04] text-white transition-all hover:border-p/60 hover:bg-p/10 disabled:opacity-30">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button onClick={next} disabled={i === SLIDES.length - 1} aria-label="Next slide" data-testid="pitch-next" className="grid h-12 w-12 place-items-center rounded-full bg-p text-ink shadow-[0_0_30px_rgba(171,159,242,0.5)] transition-all hover:scale-105 disabled:opacity-30 disabled:shadow-none">
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
