# MCP Server

## What It Is

The MCP server is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes CocoaBridge's procurement database as structured **tools** and **resources** for LLM consumption.

When a user sends a message in the `/chat` page, the backend calls MCP tools to fetch live data from the database, then passes that data to Gemini to generate a response. The MCP server is what makes the chat feature "know" about SupplyTiger's actual opportunities, awards, contacts, and analytics.

---

## Why It's Separate

The MCP server is deployed independently from the backend for two reasons:

1. **Separation of concerns** — the MCP server is purely read-only. It never writes to the database. Keeping it separate from the backend's write path makes both easier to reason about and maintain.
2. **Latency** — the chat feature benefits from a fast, focused server. Keeping MCP separate means its cold starts and compute don't interfere with the main API.

**Local port:** `3001`
**Production URL:** `cocoabridge-mcp.vercel.app`

---

## What It Provides

### Tools (20+)

Tools are functions the LLM can call to fetch specific data. Each lives in `mcp/src/tools/`:

| Tool | What it fetches |
|---|---|
| `searchOpportunities` | Search/filter opportunities |
| `getOpportunity` | Full opportunity record by ID |
| `searchAwards` | Search/filter awards |
| `getAward` | Full award record by ID |
| `searchBuyingOrgs` | Search federal agencies |
| `getBuyingOrg` | Full buying org record |
| `searchRecipients` | Search award recipients |
| `searchContacts` | Search contacts |
| `getContact` | Full contact record |
| `getContactInteractions` | Outreach log for a contact |
| `searchInboxOpportunities` | Search inbox items |
| `getInboxItem` | Full inbox item record |
| `getWeeklyMetrics` | Weekly procurement metrics |
| `getAnalyticsSummary` | Aggregated analytics (PSC, NAICS, agency) |
| `getIntelligenceSummary` | High-level market intelligence summary |
| `scoreOpportunity` | Run scoring against a specific opportunity |
| `searchPublogItems` | Search PUBLOG/FLIS items |
| `getCidSpec` | USDA Commercial Item Description spec |
| `getAttachmentText` | Parsed text from opportunity attachments |
| `getCalendarEvents` | Industry days calendar |
| `generateBidDraft` / `generateOutreachDraft` | Prompt tools for drafting outputs |

### Resources

Resources are static or dynamic data objects the LLM can read:

| Resource | Description |
|---|---|
| `company-profile` | SupplyTiger's capability statement — UEI, CAGE, NAICS, PSC, core competencies (live from DB) |
| `bid-template` | Federal bid/proposal template with standard sections and compliance checklist |
| `opportunity-detail` | Full opportunity record by ID (dynamic) |
| `award-detail` | Full award record by ID (dynamic) |
| `cid-spec` | USDA CID specification by CID code |

### Prompts

Pre-built prompt flows are registered in `mcp/src/prompts.js`. These define common task templates the chat client can invoke (e.g., analyze fulfillment fit, generate an outreach draft).

---

## How the Chat Client Uses It

The frontend chat widget (`/chat`) is model-agnostic — it sends messages to the backend's `/api/chat` route. The backend:
1. Calls MCP tools via an MCP client (`backend/src/lib/mcpClient.js`) to fetch relevant data
2. Passes the fetched data + the user's message to the LLM (Gemini by default)
3. Returns the LLM's response to the frontend

Because the client is model-agnostic, you can swap Gemini for OpenAI, Claude (Anthropic), or a local Ollama model by changing the model configuration in `backend/src/lib/modelProvider.js`. The MCP layer stays the same regardless of which LLM is used.

---

## Running Locally

```bash
cd mcp
npm run start
```

The server runs at `http://localhost:3001`. It must be running for the chat feature to work locally.

---

## Testing Tools

To interactively browse and test the MCP tools without going through the chat UI:

```bash
cd mcp
npm run inspect:http
```

This opens the MCP Inspector in your browser. From there you can:
- Browse all registered tools and their input schemas
- Run any tool with custom inputs and see the JSON response
- Verify that tools return expected data after making changes

Use this whenever you add or modify a tool — it's the fastest way to validate the output before wiring it into the chat.

---

## Adding a New Tool

1. Create a new file in `mcp/src/tools/`, e.g. `myNewTool.js`
2. Export a registration function:
   ```js
   export function registerMyNewTool(server) {
     server.tool(
       "my-new-tool",
       "Description of what this tool does",
       { /* zod input schema */ },
       async (input) => {
         // query prisma, return result
         return { content: [{ type: "text", text: JSON.stringify(result) }] };
       }
     );
   }
   ```
3. Import and register it in `mcp/src/mcpServer.js`:
   ```js
   import { registerMyNewTool } from "./tools/myNewTool.js";
   // inside createMcpServer():
   registerMyNewTool(server);
   ```
4. Test with `npm run inspect:http`

---

## Prisma in the MCP Server

The MCP server has its own Prisma client but shares the same schema as the backend. The `mcp/package.json` points to the backend schema:

```json
"prisma": {
  "schema": "../backend/prisma/schema.prisma"
}
```

If you update `backend/prisma/schema.prisma`, you must run `npx prisma generate` in both `backend/` and `mcp/`. See `prisma.md` for the full workflow.

Note: Never adjust the file in `mcp/prisma/schema.prisma` directly. Use `backend/prisma/scehma.prisma` to adjust the schema.