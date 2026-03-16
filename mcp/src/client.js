import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {confirm, input, select} from "@inquirer/prompts";
import {ENV} from "./env.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, jsonSchema } from "ai";
import { CreateMessageRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const mcp = new Client({
    name: "CocoaBridge MCP Client",
    version: "1.0.0",
    description: "MCP client for CocoaBridge"
},
{
    capabilities: {sampling: {}},

},
);

const transport = new StdioClientTransport({
    command: "node",
    args: ["./src/server.js"],
    sterr: "ignore",
});

const google = createGoogleGenerativeAI({
    apiKey: ENV.GEMINI_API_KEY,
});

const handleTool = async (tool) => {
    const args = {};

    // If the tool has an input schema, prompt the user for each input
    // Ex: name (string), age (number), etc.
    for (const [key, value] of Object.entries(tool.inputSchema.properties ?? {})) {
        args[key] = await input({
            message: `Enter value for ${key} (${value.type}):`,
        });
    }

    // Call the tool with the provided arguments
    const result = await mcp.callTool({
        name: tool.name,
        arguments: args,
    });

    console.log(result.content[0].text);
}

const handleResource = async (uri) => {
    let finalUri = uri;
  const paramMatches = uri.match(/{([^}]+)}/g);

  if(paramMatches) {
    for (const paramMatch of paramMatches) {
        const paramName = paramMatch.replace("{", "").replace("}", "");
        const paramValue = await input({
            message: `Enter value for ${paramName}:`,
        });
        finalUri = finalUri.replace(paramMatch, paramValue);
    }
  }

  const result = await mcp.readResource({ uri: finalUri });

  console.log(JSON.stringify(JSON.parse(result.contents[0].text), null, 2));
}

const handlePrompt = async (prompt) => {
    const args = {};
    for(const arg of prompt.arguments ?? []) {
        args[arg.name] = await input({
            message: `Enter value for (${arg.name}):`,
        });
    }

    const response = await mcp.getPrompt({
        name: prompt.name,
        arguments: args,
    });

    for(const message of response.messages) {
        console.log(await handleServerMessagePrompt(message));
    }
};

// only handle text messages for now, but this could be extended to handle other message types like images, files, etc.
const handleServerMessagePrompt = async (message) => {
    if(message.content.type !== "text") return;

    console.log(message.content.text);

    const run = await confirm({
        message: "Would you like to run the above prompt?",
        default: true,
    });

    if(!run) return;

    const {text} = await generateText({
        model: google("gemini-2.5-flash"),
        prompt: message.content.text,   
    });

    return text;
};

const handleQuery = async (tools) => {
const query = await input({message: "Enter your query: "});

// Gemini requires function names to match [a-zA-Z_][a-zA-Z0-9_]* (no hyphens)
const sanitizeName = (name) => name.replace(/-/g, "_");

const {text, toolResults, steps } = await generateText({
    model: google("gemini-2.5-flash"),
    prompt: query,
    maxSteps: 5,
    tools: tools.reduce(
        (obj, tool) => {
            const { $schema, ...schema } = tool.inputSchema;
            return {
                ...obj,
                [sanitizeName(tool.name)]: {
                    description: tool.description,
                    inputSchema: jsonSchema(schema),
                    execute: async (args) => {
                        const result = await mcp.callTool({
                            name: tool.name,
                            arguments: args,
                        });
                        return result.content
                            .filter((c) => c.type === "text")
                            .map((c) => c.text)
                            .join("\n");
                    },
                },
            };
        }, {},
    ),  
})

// Find the last tool result text as fallback
const lastToolText = steps.flatMap(s => s.toolResults).pop()?.result;
console.log(text || lastToolText || "No text generated.");
}

const main = async () => {
  // connect to the server using the transport
  await mcp.connect(transport);

  const [{ tools }, { prompts }, { resources }, { resourceTemplates }] =
    await Promise.all([
      mcp.listTools(),
      mcp.listPrompts(),
      mcp.listResources(),
      mcp.listResourceTemplates(),
    ]);

  // Handle sampling/createMessage requests from the server
  mcp.setRequestHandler(CreateMessageRequestSchema, async (request) => {
    const texts = [];
      for (const message of request.params.messages) {
        const text = await handleServerMessagePrompt(message);
        if(text) texts.push(text);
      }

    return {
      model: "gemini-2.5-flash",
      role: "user",
      stopReason: "endTurn",
      content: {
        type: "text",
        text: texts.join("\n"),
      },
    };
  });

  console.log("You are connected!");
  while (true) {
    const option = await select({
      message: "What would you like to do?",
      choices: ["Query", "Tools", "Resources", "Prompts"],
    });

    switch (option) {
      case "Tools":
        const toolName = await select({
          message: "Select a tool",
          choices: tools.map((tool) => ({
            // Use the title annotation if it exists, otherwise fall back to the tool name
            name: tool.annotations?.title || tool.name,
            value: tool.name,
            description: tool.description,
          })),
        });

        // Find the selected tool by name
        const tool = tools.find((t) => t.name === toolName);

        // if the user selected a tool that doesn't exist, log an error.
        if (!tool) {
          console.error("Tool not found");
        } else {
          await handleTool(tool);
        }
        break;

      case "Resources":
        const resourceUri = await select({
          message: "Select a resource",
          choices: [
            ...resources.map((resource) => ({
              name: resource.name,
              value: resource.uri,
              description: resource.description,
            })),
            ...resourceTemplates.map((template) => ({
              name: template.name,
              value: template.uriTemplate,
              description: template.description,
            })),
          ],
        });
        const uri =
          resources.find((r) => r.uri === resourceUri)?.uri ??
          resourceTemplates.find((r) => r.uriTemplate === resourceUri)
            ?.uriTemplate;

        if (!uri) {
          console.error("Resource not found");
        } else {
          await handleResource(uri);
        }
        break;
      case "Prompts":
        const promptName = await select({
          message: "Select a prompt",
          choices: prompts.map((prompt) => ({
            name: prompt.name,
            value: prompt.name,
            description: prompt.description,
          })),
        });

        const prompt = prompts.find((p) => p.name === promptName);
        if (!prompt) {
          console.error("Prompt not found");
        } else {
          await handlePrompt(prompt);
        }
        break;
      case "Query":
        await handleQuery(tools);
        break;
    }
  }
};;

main();