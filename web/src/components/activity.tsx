"use client";
import { Card, etherscanTx, suiscan, usdc } from "./ui";

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
      <h3 className="mb-3 font-semibold">Activity</h3>
      {!items?.length && <p className="text-sm text-muted">No on-chain activity yet.</p>}
      <ol className="space-y-2 text-sm">
        {items?.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-3 border-b border-line pb-2 last:border-0">
            <div>
              <div className="font-medium">{LABEL[a.kind] ?? a.kind}</div>
              <div className="text-xs text-muted">
                {new Date(a.created_at).toLocaleString()}
                {a.amount != null && ` · ${usdc(a.amount)}`}
                {a.data?.brand && ` · ${a.data.brand}`}
                {a.data?.aqs != null && ` · AQS ${a.data.aqs}`}
              </div>
            </div>
            <div className="flex shrink-0 gap-2 text-xs">
              {a.sui_digest && (
                <a className="text-brand underline" href={suiscan("tx", a.sui_digest)} target="_blank" rel="noreferrer">
                  Sui
                </a>
              )}
              {a.eth_tx && (
                <a className="text-brand underline" href={etherscanTx(a.eth_tx)} target="_blank" rel="noreferrer">
                  ENS
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
