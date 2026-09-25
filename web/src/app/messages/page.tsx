"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/client/session";
import { Badge, Empty, Img, Spinner } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

export default function Messages() {
  const { authenticated, api, me } = useSession();
  const { data } = useQuery({ queryKey: ["convs"], queryFn: () => api<any>("/api/conversations"), enabled: authenticated, refetchInterval: 10000 });
  if (!authenticated) return <div className="grid place-items-center py-24"><SignInButtons /></div>;
  if (!data) return <div className="grid place-items-center py-24"><Spinner /></div>;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-semibold">Messages</h1>
      {!data.conversations.length && <Empty title="No conversations yet">Message an owner from any space page.</Empty>}
      <div className="space-y-2">
        {data.conversations.map((c: any) => {
          const other = c.advertiser_user_id === me?.user?.id ? c.own : c.adv;
          return (
            <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-violet-300" data-testid="conversation">
              <Img blob={c.spaces?.closeup_blob_id} alt="" className="h-12 w-12 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{other?.brand_name ?? other?.display_name ?? other?.handle}</div>
                <div className="truncate text-sm text-muted">about {c.spaces?.label} · {c.spaces?.ens_name}</div>
              </div>
              {c.unread > 0 && <Badge tone="brand">{c.unread} new</Badge>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
