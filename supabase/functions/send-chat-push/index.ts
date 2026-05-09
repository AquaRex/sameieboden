// Supabase Edge Function: send-chat-push
//
// Triggered by the `chat_messages_push` Postgres trigger after a new message
// row is inserted. Looks up every push subscription that should be notified
// and fans out a Web Push to each one. Stale subscriptions (410/404) are
// pruned automatically.
//
// Deploy:
//   supabase functions deploy send-chat-push --no-verify-jwt
//   supabase secrets set \
//     VAPID_PUBLIC_KEY="<public>" \
//     VAPID_PRIVATE_KEY="<private>" \
//     VAPID_SUBJECT="mailto:you@example.com"
//
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let payload: { from_house?: string; to_house?: string | null; body?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const from = (payload.from_house ?? "").trim();
  const to   = payload.to_house ?? null;
  const body = (payload.body ?? "").toString();
  if (!from || !body) return new Response("Missing fields", { status: 400 });

  // Pick recipients:
  //   - direct message (to !== null): subscriptions whose house === to
  //   - broadcast      (to === null): every subscription except sender's house
  let q = db.from("push_subscriptions").select("endpoint, p256dh, auth, house");
  q = to === null ? q.neq("house", from) : q.eq("house", to);
  const { data: subs, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const message = JSON.stringify({ from, to, body });
  const stale: string[] = [];

  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) stale.push(s.endpoint);
        else console.error("push failed", status, err);
      }
    }),
  );

  if (stale.length) {
    await db.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return Response.json({ sent: (subs?.length ?? 0) - stale.length, pruned: stale.length });
});
