"use client";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { Card, EASE, etherscanTx, suiscan, usdc, ScrollArea } from "./ui";

const LABEL: Record<string, string> = {
  object_listed: "Object listed",
  space_scored: "Space scored",
  price_changed: "Price changed",
  space_available: "Space available",
  space_paused: "Space paused",
  space_retired: "Space retired",
  space_removed: "Space removed by moderation",
  lease_booked: "Lease booked",
  creative_approved: "Creative approved",
  creative_rejected: "Creative rejected (refunded)",
  lease_expired: "Lease expired (refunded)",
  proof_accepted: "Proof of display accepted",
  tranche_released: "Escrow released",
  tranche_refunded: "Missed period refunded",
  dispute_opened: "Dispute opened",
  dispute_resolved: "Dispute resolved",
  lease_extended: "Lease extended",
  lease_completed: "Lease completed",
  offering_opened: "Tokenised: offering opened",
  units_purchased: "Units purchased",
  offering_closed: "Offering closed",
  offering_failed: "Offering failed (refunds)",
  units_traded: "Units traded",
  sponsored: "Sponsored",
};

export function ActivityFeed({ items }: { items: any[] }) {
  return (
    <Card>
      <h3 className="mb-5 flex items-center gap-2 font-bold">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-p/15 text-p">
          <Activity className="h-4 w-4" />
        </span>
        Activity
      </h3>
      {!items?.length && <p className="text-sm text-muted">No on-chain activity yet.</p>}
      <ScrollArea max={380}><ol className="relative space-y-1">
        {!!items?.length && <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-px bg-gradient-to-b from-p/60 via-line-strong to-transparent" />}
        {items?.map((a, i) => (
          <motion.li
            key={a.id}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: Math.min(i, 10) * 0.05, ease: EASE }}
            className="group relative flex items-start justify-between gap-3 rounded-2xl py-2.5 pl-7 pr-2 transition-colors hover:bg-white/[0.03]"
          >
            <span className="absolute left-0 top-4 grid h-[15px] w-[15px] place-items-center rounded-full border-2 border-p bg-ink transition-colors group-hover:bg-p" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{LABEL[a.kind] ?? a.kind}</div>
              <div className="text-xs text-muted">
                {new Date(a.created_at).toLocaleString()}
                {a.amount != null && ` · ${usdc(a.amount)}`}
                {a.data?.brand && ` · ${a.data.brand}`}
                {a.data?.aqs != null && ` · AQS ${a.data.aqs}`}
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5 pt-0.5 text-[11px] font-bold">
              {a.sui_digest && (
                <a className="rounded-full bg-p/10 px-2 py-0.5 text-p transition-colors hover:bg-p hover:text-ink" href={suiscan("tx", a.sui_digest)} target="_blank" rel="noreferrer">
                  Sui
                </a>
              )}
              {a.eth_tx && (
                <a className="rounded-full bg-white/[0.07] px-2 py-0.5 text-white/70 transition-colors hover:bg-white hover:text-ink" href={etherscanTx(a.eth_tx)} target="_blank" rel="noreferrer">
                  ENS
                </a>
              )}
            </div>
          </motion.li>
        ))}
      </ol></ScrollArea>
    </Card>
  );
}
