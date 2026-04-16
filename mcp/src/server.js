import "dotenv/config";
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcpServer.js";
import { ENV } from "./env.js";
import {
  findClient,
  isValidRedirectUri,
  generateAuthCode,
  verifyAuthCode,
  generateAccessToken,
  verifyAccessToken,
  verifySHA256PKCE,
  oauthMetadata,
  serveAuthorizePage,
} from "./oauth.js";

// ── Body parser (handles Vercel pre-parsed body OR raw stream) ─────────────
async function readBody(req) {
  if (req.body !== undefined) return req.body;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const ct = req.headers["content-type"] ?? "";
      if (ct.includes("application/json")) {
        try { resolve(JSON.parse(raw)); } catch { resolve({}); }
      } else if (ct.includes("application/x-www-form-urlencoded")) {
        resolve(Object.fromEntries(new URLSearchParams(raw)));
      } else {
        resolve(raw);
      }
    });
    req.on("error", reject);
  });
}

// ── CORS headers helper ────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
}

// ── OAuth route handlers ───────────────────────────────────────────────────

function handleOAuthMetadata(req, res) {
  const baseUrl = ENV.MCP_SERVER_URL.replace(/\/$/, "");
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(oauthMetadata(baseUrl)));
}

function handleAuthorizeGet(req, res) {
  const url = new URL(req.url, "http://localhost");
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "S256";

  const client = findClient(clientId);
  if (!client) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(serveAuthorizePage({ error: `Unknown client: ${clientId}` }));
    return;
  }
  if (!redirectUri || !isValidRedirectUri(client, redirectUri)) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(serveAuthorizePage({ error: "Invalid or disallowed redirect_uri." }));
    return;
  }
  if (codeChallengeMethod !== "S256") {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(serveAuthorizePage({ error: "Only code_challenge_method=S256 is supported." }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(serveAuthorizePage({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }));
}

async function handleAuthorizePost(req, res) {
  const body = await readBody(req);
  const clientId = body.client_id ?? "";
  const redirectUri = body.redirect_uri ?? "";
  const state = body.state ?? "";
  const codeChallenge = body.code_challenge ?? "";

  const client = findClient(clientId);
  if (!client || !redirectUri || !isValidRedirectUri(client, redirectUri)) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(serveAuthorizePage({ error: "Invalid client or redirect_uri." }));
    return;
  }

  const code = generateAuthCode(clientId, redirectUri, codeChallenge);
  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  if (state) callback.searchParams.set("state", state);

  res.writeHead(302, { Location: callback.toString() });
  res.end();
}

async function handleTokenRequest(req, res) {
  const body = await readBody(req);
  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier } = body;

  const fail = (msg) => {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "invalid_request", error_description: msg }));
  };

  if (grant_type !== "authorization_code") return fail("grant_type must be authorization_code");
  if (!code) return fail("Missing code");
  if (!code_verifier) return fail("Missing code_verifier");

  // Validate client credentials
  const client = findClient(client_id);
  if (!client || client.clientSecret !== client_secret) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "invalid_client" }));
    return;
  }

  // Validate auth code
  let codePayload;
  try {
    codePayload = verifyAuthCode(code);
  } catch (err) {
    return fail(`Invalid or expired code: ${err.message}`);
  }

  if (codePayload.clientId !== client_id) return fail("client_id mismatch");
  if (codePayload.redirectUri !== redirect_uri) return fail("redirect_uri mismatch");

  // Verify PKCE
  if (!verifySHA256PKCE(code_verifier, codePayload.codeChallenge)) {
    return fail("PKCE verification failed");
  }

  const accessToken = generateAccessToken(client_id);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 365 * 24 * 60 * 60,
    })
  );
}

// ── Main handler ───────────────────────────────────────────────────────────
/**
 * HTTP entry point for the CocoaBridge MCP Server.
 *
 * Vercel serverless: export default handler
 * Local dev:        node src/server.js  (starts on PORT || 3001)
 */
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  // ── OAuth endpoints (no MCP auth required) ──
  if (req.method === "GET" && path === "/.well-known/oauth-authorization-server") {
    return handleOAuthMetadata(req, res);
  }
  if (req.method === "GET" && path === "/authorize") {
    return handleAuthorizeGet(req, res);
  }
  if (req.method === "POST" && path === "/authorize") {
    return handleAuthorizePost(req, res);
  }
  if (req.method === "POST" && path === "/token") {
    return handleTokenRequest(req, res);
  }

  // ── MCP endpoint — dual auth (MCP_SECRET for Claude, OAuth JWT for ChatGPT) ──
  const isProd = ENV.NODE_ENV === "production";
  if (isProd) {
    const authHeader = req.headers["authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    let authorized = false;

    if (token === ENV.MCP_SECRET) {
      authorized = true; // legacy bearer — Claude Code
    } else if (token) {
      try {
        verifyAccessToken(token);
        authorized = true; // OAuth JWT — ChatGPT (and future clients)
      } catch {
        // invalid token — fall through to 401
      }
    }

    if (!authorized) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
  }

  // Stateless MCP: fresh server + transport per request
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  setCors(res);
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

// ── Local dev server ───────────────────────────────────────────────────────
const isDirectRun =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isDirectRun) {
  const PORT = ENV.PORT;
  const httpServer = createServer(handler);
  httpServer.listen(PORT, () => {
    console.log(`MCP HTTP server listening on http://localhost:${PORT}`);
  });
}
