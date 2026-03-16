/**
 * HTTP entry point for the CocoaBridge MCP Server.
 *
 * This file will be the Vercel serverless handler.
 * For now, use stdio.js for local development:
 *   node src/stdio.js
 */
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

// Temporary: run as stdio until HTTP transport is added in Step 5
const server = createMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
