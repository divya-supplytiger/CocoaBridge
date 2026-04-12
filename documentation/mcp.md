# Talk about the current MCP server set up. Where it receives info from (our database, resources), how it's utilized, hosted seperately from the rest of the backend. Why that is. How it's used in the front end app (chat client tool), prompt flows, frontend LLM uses GEMINI_API_KEY but the client is model agnostic. API Keys from OPenAI and Claude, or local Ollama models may be used as well.

# Talk about how features should be tested.
- Use: npm run dev (for the server)
- Use: npm run inspect:http and connect to server to view tools and get JSON responses to ensure tools are working as epcteted. Useful when adding new features as well.

# Runs locally on a different port than backend + frontend, runs on cocoabridge-mcp.vercel.app in production