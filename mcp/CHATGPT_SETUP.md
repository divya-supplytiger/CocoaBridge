# Connecting ChatGPT Web to the SupplyTiger MCP Server

One-time setup guide.

**Note**: Currently only connectable if ChatGPT is in developer mode (memory doesn't persist). This is to protect data when connecting to unverified apps.

---

## Step 1 — Add environment variables in Vercel

Go to **Vercel → cocoabridge-mcp project → Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `OAUTH_CLIENT_ID` | `chatgpt` (or any identifier you choose) |
| `OAUTH_CLIENT_SECRET` | A strong random string (generate one below) |
| `JWT_SECRET` | A strong random string (generate one below) |

**To generate random secrets** (run in any terminal):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run that twice — one value for `OAUTH_CLIENT_SECRET`, one for `JWT_SECRET`.

After adding the variables, **redeploy** the MCP server (Vercel → Deployments → Redeploy).

---

## Step 2 — Add the MCP server to ChatGPT

1. Go to [chatgpt.com](https://chatgpt.com) and open **Settings**
2. Navigate to **Apps**
3. Click on **Advanced Settings** to enable developer mode
4. Click **Create App** (or similar)
5. Enter your MCP server URL:
   ```
   https://<your-mcp-vercel-url>
   ```
6. Type 'chatgpt' into the 'Client ID' field
7. ChatGPT will fetch `/.well-known/oauth-authorization-server` automatically

---

## Step 3 — Approve the connection

ChatGPT will redirect you to the SupplyTiger authorization page at:
```
https://<your-mcp-vercel-url>/authorize?client_id=chatgpt&...
```

You'll see a page listing the tools ChatGPT will have access to. Click **Approve**.

ChatGPT completes the OAuth flow and stores the access token. Setup is done.

---

## Step 4 — Verify it works

In ChatGPT, try:
> "Search for recent opportunities in my SupplyTiger inbox"

ChatGPT should call `search_inbox_opportunities` and return results.

---

## Replicating this setup (for a new team member)

1. Add them to the ChatGPT workspace (Team/Enterprise → Members)
2. Workspace-level MCP connections are shared automatically — they don't need to redo the OAuth flow
3. If they're setting up their **own** ChatGPT account (not on the shared workspace), repeat Steps 2–3 above using the same `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` already in Vercel

---

## Adding a second AI client (Cursor, Copilot, etc.)

Open `mcp/src/oauth.js` and add an entry to `OAUTH_CLIENTS`:

```js
export const OAUTH_CLIENTS = [
  {
    clientId: ENV.OAUTH_CLIENT_ID,       // existing ChatGPT client
    clientSecret: ENV.OAUTH_CLIENT_SECRET,
    name: "ChatGPT",
    allowedRedirectPrefixes: ["https://chatgpt.com/", "https://chat.openai.com/"],
  },
  // New client:
  {
    clientId: process.env.CURSOR_CLIENT_ID,
    clientSecret: process.env.CURSOR_CLIENT_SECRET,
    name: "Cursor",
    allowedRedirectPrefixes: ["https://cursor.sh/"],
  },
];
```

Add the corresponding `CURSOR_CLIENT_ID` and `CURSOR_CLIENT_SECRET` env vars in Vercel, redeploy, and follow the same auth flow for that client.

---

## Claude Code

Claude Code continues to use the existing `MCP_SECRET` bearer token — no changes needed there.
