"use client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/client/session";
import { Button, Card, Empty, Img, useAction } from "@/components/ui";
import { SignInButtons } from "@/components/shell";

export default function BrandKit() {
  const { authenticated, api } = useSession();
  const { data, refetch } = useQuery({ queryKey: ["brand-kit"], queryFn: () => api<any>("/api/brand-assets"), enabled: authenticated });
  const { busy, run } = useAction();
  if (!authenticated) return <div className="grid place-items-center py-24"><SignInButtons /></div>;
  const upload = (file: File) =>
    run("up", async () => {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", file.name.replace(/\.[^.]+$/, ""));
      await api("/api/brand-assets", { method: "POST", body: fd });
      await refetch();
    }, "Added to brand kit");
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Brand kit</h1>
          <p className="text-muted">Logos and creatives you can put on any space. Owners download print-ready files in every size.</p>
        </div>
        <label className="cursor-pointer rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-800">
          {busy === "up" ? "Uploading…" : "+ Upload"}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" data-testid="brand-upload" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {!data?.assets?.length && <div className="col-span-full"><Empty title="Your kit is empty">Upload a PNG, SVG, JPEG or WEBP (1000 px+ or vector).</Empty></div>}
        {data?.assets?.map((a: any) => (
          <Card key={a.id} className="p-3">
            <Img blob={a.blob_id} alt={a.name} className="aspect-square w-full rounded-lg bg-[repeating-conic-gradient(#f3f3f3_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] object-contain" />
            <div className="mt-2 truncate text-sm font-medium">{a.name}</div>
            <div className="text-xs text-muted">{a.width}×{a.height}px</div>
            <Button size="sm" variant="ghost" className="mt-1" onClick={() => run("d" + a.id, async () => { await api(`/api/brand-assets?id=${a.id}`, { method: "DELETE" }); refetch(); })}>Remove</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
