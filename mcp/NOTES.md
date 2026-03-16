# VSCODE Usage Instructions
# Prompt user / to run
# Inspector to open in browser
# MCP.JSON To run in VSCODE

---

## Step-by-Step Usage Instructions

### 1. Setting Up MCP in VSCode
1. Open VSCode and ensure the Claude Code extension is installed.
2. Create or edit `.vscode/mcp.json` in your project root to register your MCP server.
3. Restart VSCode or reload the window (`Ctrl+Shift+P` → `Developer: Reload Window`).

### 2. Starting the MCP Server
1. Open a terminal in VSCode (`Ctrl+`` ` ``).
2. Navigate to the `mcp/` folder: `cd mcp`
3. Install dependencies if needed: `npm install`
4. Start the server: `npm start:mcp` or `node server.js`

### 3. Opening the MCP Inspector (Browser)
1. Run the inspector command: `npx run inspect:mcp`
2. This opens a browser UI (usually at `http://localhost:6277`).
3. Connect it to your running MCP server to explore and test capabilities.

---

## Resources
Resources are data sources your MCP server exposes to Claude.

**How to use:**
1. In the MCP Inspector, navigate to the **Resources** tab.
2. Browse available resources (e.g., files, database records, API data).
3. Click a resource to read its contents.
4. In Claude Code, reference resources by URI (e.g., `file:///path/to/file`).

**In code:** Resources are registered with `server.resource(name, uri, handler)`.

---

## Prompts
Prompts are reusable message templates your server exposes.

**How to use:**
1. In the MCP Inspector, navigate to the **Prompts** tab.
2. Browse available prompt templates.
3. Select a prompt, fill in any required arguments, and run it.
4. In Claude Code, type `/` to list available slash commands — MCP prompts appear here.

**In code:** Prompts are registered with `server.prompt(name, schema, handler)`.

---

## Tools
Tools are callable functions your MCP server exposes to Claude.

**How to use:**
1. In the MCP Inspector, navigate to the **Tools** tab.
2. Browse available tools and their input schemas.
3. Fill in the required parameters and click **Run Tool** to test.
4. In Claude Code, Claude will automatically call tools when relevant to your request.

**In code:** Tools are registered with `server.tool(name, schema, handler)`.

---

## Keyboard Shortcuts (VSCode)

| Action                        | Shortcut (Windows)         |
|-------------------------------|----------------------------|
| Open Command Palette          | `Ctrl+Shift+P`             |
| Open Terminal                 | `` Ctrl+` ``               |
| Reload Window                 | `Ctrl+Shift+P` → Reload    |
| Open File                     | `Ctrl+P`                   |
| Open Settings                 | `Ctrl+,`                   |
| Split Editor                  | `Ctrl+\`                   |
| Toggle Sidebar                | `Ctrl+B`                   |
| Search in Files               | `Ctrl+Shift+F`             |
| Format Document               | `Shift+Alt+F`              |
| Go to Definition              | `F12`                      |

### Claude Code Shortcuts (in Claude panel)

| Action                        | Shortcut                   |
|-------------------------------|----------------------------|
| Submit message                | `Enter`                    |
| New line in message           | `Shift+Enter`              |
| List slash commands           | `/`                        |
| Clear conversation            | `/clear`                   |
| Open help                     | `/help`                    |
