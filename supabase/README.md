# Sameieboden — Supabase setup

Everything the chat + Web Push needs lives in this folder. The browser-side
code is already wired up; you just need to run the SQL once and deploy the
Edge Function.

## VAPID keys (already generated)

```
PUBLIC  : BH_vBmhYlmGF9uCRJbCJczTFbyAGQpYDEm57mqTzcXotJemC3L0KX7qWIoDLuncSA89ijBghp1TBpc2ik6x6hJc
PRIVATE : (see private message — set as Supabase secret, never commit)
```

The public key is already pasted into `js/core/push.js`. The private key
must only live as a Supabase secret.

## 1. Run the SQL

Open the Supabase SQL editor and paste `sql/chat_push_setup.sql`.
Before running, edit the `notify_chat_push()` function and replace:

- `<PROJECT_REF>` — your project ref (the `xxxx` in `https://xxxx.supabase.co`)
- `<SERVICE_ROLE>` — Project Settings → API → `service_role` key

Re-run the file any time you change those values; it's idempotent.

## 2. Deploy the Edge Function

Install the Supabase CLI once: `brew install supabase/tap/supabase`.

```bash
cd /Users/hetland/Documents/WebProjects/sameieboden
supabase login                          # one-time
supabase link --project-ref <PROJECT_REF>

supabase secrets set \
  VAPID_PUBLIC_KEY="BH_vBmhYlmGF9uCRJbCJczTFbyAGQpYDEm57mqTzcXotJemC3L0KX7qWIoDLuncSA89ijBghp1TBpc2ik6x6hJc" \
  VAPID_PRIVATE_KEY="<paste private key>" \
  VAPID_SUBJECT="mailto:you@example.com"

supabase functions deploy send-chat-push --no-verify-jwt
```

`--no-verify-jwt` is fine here because the trigger calls the function with
the service-role key in the `Authorization` header. The function itself
does not read the JWT.

## 3. Test

1. Hard-refresh the site, install it as a PWA (required on iOS).
2. Open the chat window, click the bell icon → accept the browser prompt.
3. Switch to a different device / house and send a message.
4. The first device should get a system notification.

## Files

- `sql/chat_push_setup.sql` — tables, RLS, realtime, push trigger.
- `functions/send-chat-push/index.ts` — Edge Function that fans out pushes.
