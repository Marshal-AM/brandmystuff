"use client";
import { ENS_DEPLOYMENT } from "@/lib/deployment";
import { Badge, Card, suiscan } from "./ui";

export function VerifyPanel({ name, suiId, v, ens }: { name: string; suiId?: string | null; v: any; ens: any }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Verify on-chain</h3>
        {v == null ? <Badge>checking…</Badge> : v.verified ? <Badge tone="ok">✓ ENS ↔ Sui verified</Badge> : <Badge tone="warn">{ens?.status === "registered" ? "Mismatch" : "ENS pending"}</Badge>}
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-muted">ENS name (Sepolia ENSv2)</dt>
          <dd className="font-mono break-all">
            <a className="underline" href={`${ENS_DEPLOYMENT.appUrl}/${name}`} target="_blank" rel="noreferrer">
              {name}
            </a>{" "}
            <span className="text-xs text-muted">({ens?.status ?? "pending"})</span>
          </dd>
        </div>
        {suiId && (
          <div>
            <dt className="text-muted">Sui object</dt>
            <dd className="font-mono break-all">
              <a className="underline" href={suiscan("object", suiId)} target="_blank" rel="noreferrer">
                {suiId}
              </a>
            </dd>
          </div>
        )}
        {v?.suiRef && (
          <div>
            <dt className="text-muted">ENS record eth.brandmystuff.sui.object</dt>
            <dd className="font-mono break-all">{v.suiRef}</dd>
          </div>
        )}
        {v?.records &&
          Object.entries(v.records).map(([k, val]) => (
            <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono break-all">{(val as string) || "—"}</dd>
            </div>
          ))}
      </dl>
    </Card>
  );
}
