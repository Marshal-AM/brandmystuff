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
          <p className="mt-6 max-w-xl text-lg text-white/70 sm:text-xl">brandmystuff lets anyone rent out the space on the things they own, like a laptop lid, a car or a shop window, to brands that want real-world attention. Safely, fairly, and with proof.</p>
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
  { src: "/pitch/ads1.jpeg", w: 709, h: 855, who: "A developer's MacBook", short: "MacBook", views: "10.3M", note: "10 sticker spots auctioned in 14 days" },
  { src: "/pitch/ads2.jpeg", w: 553, h: 880, who: "Solana's own logo", short: "Solana logo", views: "951.6K", note: "9 ad spots sold on a brand's profile picture" },
  { src: "/pitch/ads3.jpeg", w: 561, h: 566, who: "A groom's tuxedo", short: "Tuxedo", views: "448.5K", note: "Sponsors paid for the wedding suit" },
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
    { icon: Coins, t: "Affordable", d: "A spot cost a few hundred euros, not the tens of thousands a billboard campaign does." },
    { icon: Globe2, t: "It travels", d: "The ad goes wherever the person goes: cafés, campuses, flights, even a wedding." },
    { icon: Users, t: "It's human", d: "A real person carrying your brand feels like a recommendation, not an interruption." },
  ];
  return (
    <div className="relative grid h-full items-center gap-10 lg:grid-cols-[1fr_1fr]">
      <Glow className="right-0 top-0 h-[380px] w-[380px]" />
      <div>
        <In><Kicker>Where it started</Kicker></In>
        <In d={0.1}><Title className="mt-5">People started selling ad space <span className="text-p">on their stuff.</span></Title></In>
        <In d={0.2}>
          <p className="mt-6 max-w-xl text-lg text-white/70">A MacBook lid. A brand&apos;s logo. A wedding tuxedo. Each post went viral for the same reason: <span className="font-semibold text-white">small and mid-size brands finally saw real-world advertising they could afford.</span></p>
        </In>
        <div className="mt-7 space-y-2.5">
          {why.map((w, i) => (
            <In key={w.t} d={0.3 + i * 0.1} className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-p/15 text-p"><w.icon className="h-4 w-4" /></span>
              <div><span className="font-bold">{w.t}.</span> <span className="text-white/65">{w.d}</span></div>
            </In>
          ))}
        </div>
        <In d={0.65} className="mt-7 flex flex-wrap gap-x-8 gap-y-3">
          {[["11.7M+", "views across three posts"], ["64", "brands bid on one laptop"], ["20 / 20", "MacBook spots sold"]].map(([v, l]) => (
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
    { icon: Coins, t: "Too expensive", d: "Billboards, transit and venue ads are sold in big blocks, often thousands a month, with long minimum terms." },
    { icon: Handshake, t: "Built for big budgets", d: "Media agencies and ad networks want large clients. A $500 brand isn't worth their phone call." },
    { icon: Globe2, t: "Stuck in one place", d: "A billboard reaches whoever drives past one corner. Small brands can't afford to be on every corner." },
  ];
  const broke = [
    "6 of 20 winning brands never paid",
    "No way to judge if a spot is any good",
    "No proof the sticker ever went up",
    "98% of spots on copycat sites sit empty",
  ];
  return (
    <div className="relative flex h-full flex-col justify-center">
      <In><Kicker>The problem</Kicker></In>
      <In d={0.1}><Title className="mt-5 max-w-5xl">Real-world advertising is <span className="text-p">locked away from small brands.</span></Title></In>
      <In d={0.2}><p className="mt-5 max-w-3xl text-lg text-white/70">Most brands in the world are small or mid-size. They can afford to be seen online, but the physical world, where people actually live, is priced for the giants.</p></In>
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
          <span className="text-sm font-bold text-white">And when a cheaper option appeared, trust broke it:</span>
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
        <In d={0.2}><p className="mt-6 max-w-lg text-lg text-white/70">Billions of things people own are looked at every day. Rented spot by spot, they become an ad network small brands can afford, and income for the people who carry them.</p></In>
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
        <In d={0.7} className="text-right text-xs text-faint">Illustrative daily views, by where the object is used.</In>
      </div>
    </div>
  );
}

function Solution() {
  const steps = [
    { icon: Camera, t: "Snap", d: "Photograph your object and mark the spots an ad could go." },
    { icon: Sparkles, t: "Score", d: "Our AI rates every spot on how well it will be seen, like a credit score for ad space." },
    { icon: Handshake, t: "Lease", d: "A brand books it. Their money is locked safely until the ad goes up." },
    { icon: BadgeCheck, t: "Prove & earn", d: "Snap a photo each week. Proof releases your pay, automatically." },
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
        <span className="text-white/75">a great spot can be split into shares, so fans and investors can own a slice of its future ad income.</span>
      </In>
    </div>
  );
}

function Ownership() {
  const reasons = [
    { icon: TrendingUp, t: "Income from the real world", d: "Every time a brand rents the spot, a share of the rent is paid to you. Not a meme price, actual ad money." },
    { icon: Coins, t: "Start with pocket change", d: "A spot is split into 10,000 shares, so you can own a piece for less than a coffee." },
    { icon: BadgeCheck, t: "You can see it working", d: "Every week the owner posts a photo proving the ad is up. You watch your asset earn." },
    { icon: Wallet, t: "Paid where you are", d: "Your share arrives on its own, on the network you already use. No chasing, no invoices." },
    { icon: Handshake, t: "Sell whenever you like", d: "Shares can be traded with other verified holders, so you're never stuck." },
    { icon: Users, t: "Back people before they blow up", d: "Own a slice of a creator's laptop or a café's window early. If their post goes viral, you grow with them." },
  ];
  return (
    <div className="relative grid h-full items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <Glow className="-left-24 top-1/3 h-[380px] w-[380px]" />
      <div>
        <In><Kicker>Why own a slice</Kicker></In>
        <In d={0.1}><Title className="mt-5">Own the billboard, <span className="text-p">not just the ad.</span></Title></In>
        <In d={0.2}><p className="mt-6 max-w-md text-lg text-white/70">Great spots can be turned into shares. Owners get money today, and anyone can earn from the spot&apos;s future ad income, like owning a tiny piece of a building that pays rent.</p></In>
        <In d={0.35} className="mt-7 rounded-3xl border border-p/30 bg-p/[0.07] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-p">A simple example</div>
          <p className="mt-2 text-white/80">A laptop spot rents for <b>$40 a week</b> and 60% of the rent goes to shareholders. Own <b>1% of it</b> and you receive <b className="text-p">$0.24 every week</b> it&apos;s rented, while the owner has already been paid upfront for the shares they sold.</p>
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
    { icon: Camera, t: "Post it", d: "The owner shares their spot on X, TikTok or Instagram: \u201cbrand my laptop\u201d." },
    { icon: Rocket, t: "It goes viral", d: "Just like a token after good marketing, attention snowballs. Everyone wants to be on that lid." },
    { icon: Megaphone, t: "Brands pile in", d: "More brands book the spot and its other spaces. Demand pushes weekly prices up." },
    { icon: Coins, t: "Everyone earns", d: "The owner makes far more than expected, and every shareholder gets a bigger cut of the rent." },
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
          <In d={0.2}><p className="mt-5 max-w-xl text-lg text-white/70">The MacBook lid proved it: a single post turned a laptop into a must-have ad space. When that happens to a listed spot, the people who already hold its shares ride the wave with the owner.</p></In>
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
        <div className="rounded-2xl border border-p/30 bg-p/[0.07] p-4 text-sm text-white/80"><span className="font-bold text-p">Owners</span> earn from the rush of new leases, and from selling shares at a higher value.</div>
        <div className="rounded-2xl border border-p/30 bg-p/[0.07] p-4 text-sm text-white/80"><span className="font-bold text-p">Shareholders</span> earn more rent every week, and their shares are worth more to the next buyer.</div>
      </In>
    </div>
  );
}

function WhyUse() {
  const who = [
    { icon: Laptop, t: "For owners", pts: ["Earn from things you already carry", "Guaranteed payment, locked upfront", "Raise money early by selling shares of a great spot"] },
    { icon: Megaphone, t: "For small brands", pts: ["Real-world ads from a few dollars a week", "Your brand travels wherever its carrier goes", "Pay only for weeks the ad is proven to be up"] },
    { icon: TrendingUp, t: "For shareholders", pts: ["Earn a share of real ad rent, weekly", "Start with less than a coffee", "Sell your shares any time"] },
    { icon: BotIcon, t: "For AI agents", pts: ["Find and book ads with no human involved", "Spend only inside a budget the brand sets", "Pay instantly, per booking"] },
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
    ["Works with any object", "✕", "Laptops", "Cars", "✓"],
    ["Brand pays before the ad goes up", "20% deposit", "~", "Contract", "100% locked"],
    ["Proof the ad is really up", "✕", "✕", "Monthly photos", "Every week"],
    ["Quality score for each spot", "✕", "✕", "✕", "✓"],
    ["Owners can raise money on a spot", "✕", "✕", "✕", "✓"],
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
    { icon: Users, t: "Pull from both sides", d: "64 brands bid on one laptop within a week, and thousands of people listed their laptops for free on copycat sites." },
    { icon: ShieldCheck, t: "The blocker is trust, not interest", d: "30% of winners defaulted and 98% of listed spots sit empty. We fix exactly that." },
    { icon: Rocket, t: "The creator economy is ready", d: "Millions already monetise their faces and feeds. Monetising their stuff is the obvious next step." },
    { icon: BotIcon, t: "A new buyer is arriving", d: "AI marketing agents are being handed budgets. They need inventory they can find, trust and pay for on their own." },
  ];
  return (
    <div className="relative grid h-full items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
      <Glow className="-right-24 top-10 h-[380px] w-[380px]" />
      <div>
        <In><Kicker>Product-market fit</Kicker></In>
        <In d={0.1}><Title className="mt-5">The market already <span className="text-p">tried to exist.</span></Title></In>
        <In d={0.2}><p className="mt-6 max-w-md text-lg text-white/70">We didn&apos;t invent this demand. We watched it appear on its own, then break for predictable reasons. brandmystuff is built around those exact failure points.</p></In>
        <In d={0.35} className="mt-8 rounded-3xl border border-p/30 bg-p/[0.07] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-p">Our first customer</div>
          <div className="mt-2 text-lg font-bold">Students and creators with a laptop,</div>
          <div className="text-white/70">and indie brands with $300 to $3,000 who want authentic, local reach.</div>
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
      pts: ["Student ambassadors at 10 universities", "\"Brand my laptop\" challenge on X & TikTok", "Free listing + first-lease bonus"],
      kpi: "2,000 listed spots",
    },
    {
      n: "02",
      when: "Months 3–6",
      t: "Bring the brands",
      pts: ["Indie founders, DTC & crypto brands first", "Hackathon & conference sticker drops", "Self-serve booking in minutes"],
      kpi: "300 paying brands",
    },
    {
      n: "03",
      when: "Months 6–12",
      t: "Go beyond laptops",
      pts: ["Rideshare drivers & delivery riders", "Shop windows via local business networks", "Shares in top spots for fans & investors"],
      kpi: "10 cities · 3 object types",
    },
    {
      n: "04",
      when: "Year 2",
      t: "Let the agents buy",
      pts: ["Open catalogue for AI marketing agents", "Agency & ad-network integrations", "Programmatic, always-on demand"],
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
    { icon: Laptop, t: "Every lid is an ad for us", d: "Each sticker carries a tiny brandmystuff tag and QR code. The product markets itself wherever it goes." },
    { icon: Users, t: "Owners recruit owners", d: "Referral rewards when a friend's first lease completes. Campuses spread by word of mouth." },
    { icon: Megaphone, t: "Brands come back", d: "Proof photos and quality scores make results visible, so a good first campaign turns into a repeat buyer." },
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
    { pct: "12%", t: "of every lease", d: "Taken only when the owner is paid. The owner keeps 88%." },
    { pct: "3%", t: "when a spot raises money", d: "A one-time fee when shares of a spot sell out." },
    { pct: "1%", t: "on share trades", d: "When fans and investors buy and sell shares." },
    { pct: "$3–10", t: "per day to be featured", d: "Owners can boost a listing. It never changes the quality ranking." },
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
        Example: a laptop spot rented at $40 a week earns its owner <span className="font-bold text-white">$35.20</span> a week, and us <span className="font-bold text-white">$4.80</span>.
      </In>
    </div>
  );
}

function Today() {
  const built = [
    "Anyone can sign up with just an email",
    "List an object and get an AI quality score in under a minute",
    "Brands book spots and money is locked until proof arrives",
    "Weekly photo proof releases pay automatically",
    "Spots can be split into shares and traded",
    "An AI agent can find and book an ad by itself",
    "Investors choose which network they get paid on",
    "Every spot has a public, human-readable name",
  ];
  return (
    <div className="relative grid h-full items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <In><Kicker>Where we are</Kicker></In>
        <In d={0.1}><Title className="mt-5">Not a mock-up. <span className="text-p">It works today.</span></Title></In>
        <In d={0.2}><p className="mt-6 max-w-md text-lg text-white/70">Every step of the product runs end to end on public test networks, with real test money moving between real people.</p></In>
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
      <In d={0.4}><p className="mt-6 max-w-2xl text-lg text-white/70">Owned by the people who carry it. Trusted by the brands who buy it. Open to the agents who will run it.</p></In>
      <In d={0.55} className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/list" className="inline-flex items-center gap-2 rounded-full bg-p px-6 py-3 text-sm font-bold text-ink shadow-[0_0_40px_rgba(171,159,242,0.5)] transition-transform hover:scale-[1.03]">List your stuff <ArrowRight className="h-4 w-4" /></Link>
        <Link href="/explore" className="inline-flex items-center gap-2 rounded-full border border-line-strong px-6 py-3 text-sm font-bold text-white transition-colors hover:border-p/60">Explore the marketplace <Globe2 className="h-4 w-4" /></Link>
      </In>
    </div>
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
