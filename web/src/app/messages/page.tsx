"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useSession } from "@/lib/client/session";
import { EASE, Empty, Img, PageHeader, PageLoader, cx } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

export default function Messages() {
  const { authenticated, api, me } = useSession();
  const { data } = useQuery({ queryKey: ["convs"], queryFn: () => api<any>("/api/conversations"), enabled: authenticated, refetchInterval: 10000 });
  if (!authenticated)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Empty title="Messages">Sign in to chat with owners and advertisers.</Empty>
        <div className="mt-6 flex justify-center"><SignInButtons /></div>
      </div>
    );
  if (!data) return <PageLoader label="Loading messages" />;
  const unread = data.conversations.reduce((n: number, c: any) => n + (c.unread > 0 ? c.unread : 0), 0);
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader kicker="Inbox" title="Messages" sub={unread ? `${unread} unread message${unread > 1 ? "s" : ""}` : "Talk to owners and advertisers about a space."} />
      {!data.conversations.length && <Empty title="No conversations yet">Message an owner from any space page.</Empty>}
      <motion.div className="space-y-2.5" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.06 } } }}>
        {data.conversations.map((c: any) => {
          const other = c.advertiser_user_id === me?.user?.id ? c.own : c.adv;
          const name = other?.brand_name ?? other?.display_name ?? other?.handle;
          const hot = c.unread > 0;
          return (
            <motion.div key={c.id} variants={{ h: { opacity: 0, y: 18, filter: "blur(6px)" }, s: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: EASE } } }} whileHover={{ x: 4 }}>
              <Link href={`/messages/${c.id}`} className={cx("group relative flex items-center gap-4 overflow-hidden rounded-3xl border p-3.5 transition-colors", hot ? "border-p/40 bg-p/[0.07] shadow-[0_0_40px_-12px_rgba(171,159,242,0.55)]" : "border-line bg-white/[0.03] hover:border-p/30")} data-testid="conversation">
                {hot && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-p" />}
                <div className="relative">
                  <Img blob={c.spaces?.closeup_blob_id} alt="" className="h-14 w-14 rounded-2xl" />
                  {hot && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-p ring-2 ring-ink" style={{ animation: "live-dot 1.6s ease-in-out infinite" }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cx("truncate", hot ? "font-extrabold" : "font-semibold")}>{name}</div>
                  <div className="truncate text-sm text-muted">about {c.spaces?.label} · <span className="font-mono text-xs">{c.spaces?.ens_name}</span></div>
                </div>
                {hot && <span className="rounded-full bg-p px-2.5 py-1 text-xs font-extrabold text-ink">{c.unread} new</span>}
                <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-p" />
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
