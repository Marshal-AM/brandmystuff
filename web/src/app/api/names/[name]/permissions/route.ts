import { handler } from "@/server/http";
import { permissionsView } from "@/server/ens/permissions";

/** Who may write each record of a name (live on-chain role reads) and its permission history. */
export const GET = handler(async (req, ctx: { params: Promise<{ name: string }> }) => {
  const name = decodeURIComponent((await ctx.params).name).toLowerCase();
  return permissionsView(name, new URL(req.url).searchParams.get("probe") === "1");
});
