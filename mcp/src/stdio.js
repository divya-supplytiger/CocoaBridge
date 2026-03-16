// MCP stdio transport owns process.stdout for JSON-RPC messages.
// Prisma (errorFormat "pretty") and pg can write diagnostics directly
// via process.stdout.write, corrupting the transport. Intercept all
// stdout writes: only allow lines that look like JSON-RPC (start with "{"),
// and redirect everything else to stderr.
const _origWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
  const str = typeof chunk === "string" ? chunk : chunk.toString();
  if (str.startsWith("{")) {
    return _origWrite(chunk, encoding, callback);
  }
  return process.stderr.write(chunk, encoding, callback);
};

import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcpServer.js";

const server = createMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
