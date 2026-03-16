import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create MCP server instance
const server = new McpServer({
    name: "CocoaBridge MCP Server",
    version: "1.0.0",
    description: "MCP server for CocoaBridge",
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    }
});

// Helper function to create a user and save to users.json
const createUser = async (name, email, address, phone) => {
    const dataDir = join(__dirname, '../data');
    const filePath = join(dataDir, 'users.json');
    let users = [];
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        users = JSON.parse(data).users || [];
    } catch {
        // file doesn't exist yet, start with empty array
    }
    const id = users.length + 1;
    const newUser = { id, name, email, address, phone };
    users.push(newUser);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ users }, null, 2));
    return id;
};

server.tool(
  "create-user",
  "A tool to create a user using the provided name, email, address, and phone number.",
  {
    name: z.string(),
    email: z.string(),
    address: z.string(),
    phone: z.string(),
  },
  {
    title: "Create User",
    description:
      "Creates a user with the given name, email, address, and phone number.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  async (params) => {
    try {
      const id = await createUser(
        params.name,
        params.email,
        params.address,
        params.phone,
      );
      return {
        content: [
          { type: "text", text: `User created successfully with ID: ${id}` },
        ],
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Failed to create user: ${error.message}` },
        ],
      };
    }
  },
);

// Resource to get list of users
server.resource(
    "users",
    "users://all",
{
    description: "A resource that provides a list of users",
    title: "Users List",
    mimeType: "application/json",


}, async uri => {
      const dataDir = join(__dirname, '../data');
    const filePath = join(dataDir, 'users.json');
    let users = [];
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        users = JSON.parse(data).users || [];
    } catch {
        // file doesn't exist yet, start with empty array
    }
    return {
        contents: [{
                        uri: uri.href,
                        text: JSON.stringify({ users }, null, 2),
                        mimeType: "application/json",
                      },
                    ],
            };


}
);

// Resource to get details of a specific user by ID
server.resource(
  "user-details",
  new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  {
    description: "A resource that provides user details",
    title: "User Details",
    mimeType: "application/json",
  },
  async (uri, {userId}) => {
    const dataDir = join(__dirname, "../data");
    const filePath = join(dataDir, "users.json");
    let user = null;
    try {
        const data = await fs.readFile(filePath, "utf-8");
        const users = JSON.parse(data).users || [];
        user = users.find(u => u.id === parseInt(userId));
    } catch {
        console.error(`Failed to read users from file: ${filePath}`);
    }
    if (!user) {
        return {
            contents: [
                {
                    uri: uri.href,
                    text: JSON.stringify({ error: "User not found" }, null, 2),
                    mimeType: "application/json",
                },
            ],
        };
    };
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify({ user }, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  },
);

// Generate a fake user for testing
server.prompt("generate-fake-user", "Generate a fake user based on a given name", 
    {
        name: z.string()
    }, 
    ({name}) => {
        return {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `Generate a fake user with the name ${name}. The user should have a realistic email, address, and phone number.`
                    },
                },
            ],
        };
    },  
);


// Sample tool
server.tool("create-random-user", "Create a random user with fake data", {
    title: " Create Random User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
}, async () => {
    const result = await server.server.request({
      method: "sampling/createMessage",
      params: {
        messages: [{
            role: "user",
            content: {
                type: "text",
                text: "Generate fake user data. The user should have a realistic name, email, address, and phone number. Return this data as a JSON object with no additional text or formatting so it can be used with JSON.parse()."
            }
        }
        ],
        maxTokens: 1024,
      }
    },
    // Callback to handle the response from the sampling request (use schema)
    CreateMessageResultSchema
);

if (result.content.type !== "text") {
    return {
                content: [
                  {
                    type: "text",
                    text: `Failed to generate user data`,
                  },
                ],
            };

}

try {
const fakeUser = JSON.parse(result.content.text.trim().replace(/```json/, "").replace(/```/, "").trim());

const id = await createUser(fakeUser);

return {
    content: [
        {
            type:  "text",
            text: `User ${id} created successfully.`
        }
    ]
}
} catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to generate user data`,
        },
      ],
    };

}

}
);

const main = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
};

main().catch((err) => {
    process.stderr.write(`Fatal error: ${err.message}\n`);
    process.exit(1);
});
