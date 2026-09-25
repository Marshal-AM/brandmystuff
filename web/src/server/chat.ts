import { db } from "./db";

export async function signAttachments(msgs: any[]) {
  for (const m of msgs) {
    for (const a of m.attachments ?? []) {
      const { data } = await db().storage.from("chat-media").createSignedUrl(a.path, 3600);
      a.url = data?.signedUrl ?? null;
    }
  }
  return msgs;
}

