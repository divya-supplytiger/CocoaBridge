import "dotenv/config";
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcpServer.js";
import { ENV } from "./env.js";

// --- Vercel-compatible serverless handler ---
/**
 * HTTP entry point for the CocoaBridge MCP Server.
 *
 * Vercel serverless: export default handler
 * Local dev:        node src/server.js  (starts on PORT || 3001)
 */
export default async function handler(req, res) {
  // --- CORS preflight ---
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
    });
    res.end();
    return;
  }

  // --- Bearer auth (SEC1) — enforced in production, skipped in dev ---
  const isProd = ENV.NODE_ENV === "production";
  if (isProd) {
    const expected = ENV.MCP_SECRET;
    const auth = req.headers["authorization"];
    if (!expected || !auth || auth !== `Bearer ${expected}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
  }

  // --- Stateless MCP: fresh server + transport per request ---
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless for serverless
  });

  res.setHeader("Access-Control-Allow-Origin", "*");

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

// --- Local dev server (when run directly: node src/server.js) ---
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
