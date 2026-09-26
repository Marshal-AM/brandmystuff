import { handler } from "@/server/http";
import { ensPulse } from "@/server/ens/view";

export const GET = handler(async () => ensPulse());
