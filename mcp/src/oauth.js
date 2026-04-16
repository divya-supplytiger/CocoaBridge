import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env.js";

// ── Client Registry ────────────────────────────────────────────────────────
// One entry per OAuth application. To add a new client (Cursor, Copilot, etc.),
// append an object here — no changes needed elsewhere.
export const OAUTH_CLIENTS = [
  {
    clientId: ENV.OAUTH_CLIENT_ID,
    clientSecret: ENV.OAUTH_CLIENT_SECRET,
    name: "ChatGPT",
    // ChatGPT uses dynamic callback URIs; validate by allowed prefixes.
    allowedRedirectPrefixes: [
      "https://chatgpt.com/",
      "https://chat.openai.com/",
    ],
  },
  // Future clients:
  // { clientId: "cursor", clientSecret: "...", name: "Cursor", allowedRedirectPrefixes: ["https://cursor.sh/"] },
  // { clientId: "copilot", clientSecret: "...", name: "GitHub Copilot", allowedRedirectPrefixes: ["https://github.com/"] },
];

export function findClient(clientId) {
  return OAUTH_CLIENTS.find((c) => c.clientId === clientId) ?? null;
}

export function isValidRedirectUri(client, redirectUri) {
  return client.allowedRedirectPrefixes.some((prefix) =>
    redirectUri.startsWith(prefix)
  );
}

// ── JWT (jose) ────────────────────────────────────────────────────────────
const jwtSecret = new TextEncoder().encode(ENV.JWT_SECRET);

async function signJwt(payload, expiresInSeconds) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(jwtSecret);
}

async function verifyJwt(token) {
  const { payload } = await jwtVerify(token, jwtSecret);
  return payload;
}

// ── Auth Codes (5-minute TTL) ──────────────────────────────────────────────
export async function generateAuthCode(clientId, redirectUri, codeChallenge) {
  return signJwt({ type: "auth_code", clientId, redirectUri, codeChallenge }, 5 * 60);
}

export async function verifyAuthCode(code) {
  const payload = await verifyJwt(code);
  if (payload.type !== "auth_code") throw new Error("Not an auth code");
  return payload;
}

// ── Access Tokens (1-year TTL) ─────────────────────────────────────────────
export async function generateAccessToken(clientId) {
  return signJwt({ type: "access_token", clientId }, 365 * 24 * 60 * 60);
}

export async function verifyAccessToken(token) {
  const payload = await verifyJwt(token);
  if (payload.type !== "access_token") throw new Error("Not an access token");
  return payload;
}

// ── PKCE S256 Verification ─────────────────────────────────────────────────
export function verifySHA256PKCE(codeVerifier, codeChallenge) {
  const computed = createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return computed === codeChallenge;
}

// ── OAuth Metadata Document ────────────────────────────────────────────────
export function oauthMetadata(baseUrl) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
  };
}

// ── Authorization Approval Page HTML ──────────────────────────────────────
export function serveAuthorizePage({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod, error }) {
  if (error) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authorization Error — SupplyTiger</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; color: #1a1a1a; }
    h1 { font-size: 1.4rem; }
    .error { color: #c0392b; background: #fdf2f2; padding: 12px 16px; border-radius: 6px; margin: 16px 0; }
  </style>
</head>
<body>
  <h1>Authorization Error</h1>
  <div class="error">${esc(error)}</div>
</body>
</html>`;
  }

  const client = findClient(clientId);
  const clientName = client?.name ?? esc(clientId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Connect ${clientName} to SupplyTiger</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; color: #1a1a1a; }
    h1 { font-size: 1.4rem; margin-bottom: 6px; }
    p { color: #555; line-height: 1.6; margin-top: 4px; }
    .card { border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px 24px; margin: 20px 0; background: #fafafa; }
    .card ul { margin: 8px 0 0; padding-left: 20px; color: #444; line-height: 1.8; }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    button { padding: 10px 24px; border-radius: 6px; border: none; cursor: pointer; font-size: 1rem; font-weight: 500; }
    .approve { background: #16a34a; color: #fff; }
    .approve:hover { background: #15803d; }
    .cancel { background: #f0f0f0; color: #333; }
    .cancel:hover { background: #e0e0e0; }
  </style>
</head>
<body>
  <h1>Connect SupplyTiger to ${clientName}</h1>
  <p>${clientName} is requesting access to your SupplyTiger procurement tools.</p>
  <div class="card">
    <strong>Access includes:</strong>
    <ul>
      <li>Search opportunities &amp; awards</li>
      <li>View contacts &amp; buying organizations</li>
      <li>Read inbox items, calendar &amp; analytics</li>
      <li>Score &amp; analyze opportunities</li>
    </ul>
  </div>
  <form method="POST" action="/authorize">
    <input type="hidden" name="client_id"             value="${esc(clientId)}">
    <input type="hidden" name="redirect_uri"           value="${esc(redirectUri)}">
    <input type="hidden" name="state"                  value="${esc(state ?? "")}">
    <input type="hidden" name="code_challenge"         value="${esc(codeChallenge)}">
    <input type="hidden" name="code_challenge_method"  value="${esc(codeChallengeMethod ?? "S256")}">
    <div class="actions">
      <button type="submit" class="approve">Approve</button>
      <button type="button" class="cancel" onclick="window.close()">Cancel</button>
    </div>
  </form>
</body>
</html>`;
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
