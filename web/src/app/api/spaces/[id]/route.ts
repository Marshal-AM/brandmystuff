import { handler } from "@/server/http";
import { spaceDetail } from "@/server/views";

export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return spaceDetail(id);
});

