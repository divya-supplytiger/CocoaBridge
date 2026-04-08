import crypto from "crypto";

export async function callMcpTool(toolName, args) {
  const { MCP_SERVER_URL, MCP_SECRET } = process.env;
  if (!MCP_SERVER_URL || !MCP_SECRET) {
    throw new Error("MCP_SERVER_URL and MCP_SECRET must be configured");
  }

  const response = await fetch(MCP_SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${MCP_SECRET}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: toolName, arguments: args },
      id: crypto.randomUUID(),
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP server returned ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  let result;

  if (contentType.includes("text/event-stream")) {
    // StreamableHTTPServerTransport returns SSE — parse the event stream
    const text = await response.text();
    const jsonRpcMessages = text
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6));

    // Find the JSON-RPC response (has "result" or "error" field)
    for (const msg of jsonRpcMessages) {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.result || parsed.error) {
          result = parsed;
          break;
        }
      } catch {
        // skip non-JSON lines
      }
    }

    if (!result) {
      throw new Error("No JSON-RPC response found in MCP SSE stream");
    }
  } else {
    result = await response.json();
  }

  if (result.error) {
    throw new Error(`MCP error: ${result.error.message || JSON.stringify(result.error)}`);
  }

  const text = result.result.content[0].text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
