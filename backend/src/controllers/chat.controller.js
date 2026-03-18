import { streamText, stepCountIs } from "ai";
import prisma from "../config/db.js";
import { getModel, getAvailableModels } from "../lib/modelProvider.js";
import { chatTools } from "../lib/chatTools.js";

// Extract text from a message in either UIMessage (parts) or CoreMessage (content) format.
// UIMessages from @ai-sdk/react v3 may have content:"" with actual text only in parts.
function getMessageText(msg) {
  if (typeof msg.content === "string" && msg.content) return msg.content;
  if (Array.isArray(msg.parts)) {
    const text = msg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    if (text) return text;
  }
  if (typeof msg.content === "string") return msg.content;
  return "";
}

const SYSTEM_PROMPT = `You are Mary from CocoaBridge, a federal procurement intelligence assistant for SupplyTiger (Prime Printer Solution Inc).

## Company Profile
- Legal Name: Prime Printer Solution Inc (dba SupplyTiger)
- UEI: REMMPZ6DUJ88 | CAGE: 4Z7K1
- NAICS: 424450, 424410, 424490 (Food/confectionery wholesale)
- PSC: 8925, 8950 (Sugar/confectionery, condiments/related products)
- Acquisition Paths: Micro-purchase, GSA Schedule, Subcontracting
- Core: Climate-controlled chocolate fulfillment, bulk food distribution, eCommerce

## Your Role
Help users search for and analyze federal contracting opportunities, awards, agencies, and contractors. Use the available tools to query the procurement database. Provide actionable analysis — opportunity fit, competitive landscape, agency patterns, and bid/no-bid recommendations.

## Guidelines
- Always use tools to get current data — do not fabricate opportunity details
- When scoring opportunities, use the score_opportunity tool
- For competitive analysis, use get_intelligence_summary
- Present results in clear, structured formats (tables, bullet points)
- Flag opportunities that match SupplyTiger's NAICS/PSC codes
- Note: Conversations are retained for 14 days`;

const EXPIRY_DAYS = 14;

function makeExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + EXPIRY_DAYS);
  return d;
}

// POST /api/chat — streaming chat
export async function handleChat(req, res) {
  try {
    const { messages, conversationId, model: modelId } = req.body;
    const userId = req.user.id;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages array is required" });
    }

    // Resolve or create conversation
    let convId = conversationId;
    if (!convId) {
      // Auto-generate title from first user message
      const firstUserMsg = messages.find((m) => m.role === "user");
      const firstText = firstUserMsg ? getMessageText(firstUserMsg) : "";
      const title = firstText ? firstText.slice(0, 60) : "New conversation";

      const conversation = await prisma.chatConversation.create({
        data: {
          userId,
          title,
          expiresAt: makeExpiresAt(),
        },
      });
      convId = conversation.id;
    }

    // Set conversation ID header so frontend can track it
    res.setHeader("x-conversation-id", convId);

    // Save the latest user message
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.role === "user") {
      const text = getMessageText(lastUserMsg);
      if (text) {
        await prisma.chatMessage.create({
          data: {
            conversationId: convId,
            role: "user",
            content: text,
          },
        });
      }
    }

    // Convert to CoreMessages for streamText (handles both UIMessage and CoreMessage formats).
    // Drop assistant messages with empty content (e.g. failed tool-only turns) —
    // Gemini rejects conversations containing empty assistant messages, which would
    // permanently break the conversation on every subsequent request.
    const model = getModel(modelId);
    const coreMessages = messages
      .map((m) => ({ role: m.role, content: getMessageText(m) }))
      .filter((m) => m.role !== "assistant" || m.content);

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: coreMessages,
      tools: chatTools,
      stopWhen: stepCountIs(5),
      onFinish: async ({ text, toolCalls }) => {
        // Persist assistant response
        if (text) {
          await prisma.chatMessage.create({
            data: {
              conversationId: convId,
              role: "assistant",
              content: text,
              toolCalls: toolCalls?.length ? toolCalls : undefined,
            },
          });
        }
      },
    });

    result.pipeUIMessageStreamToResponse(res, {
      onError: (error) => {
        console.error("Stream error:", error);
        const msg = error?.message || "";
        if (msg.includes("quota") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
          return "The AI model's rate limit has been exceeded. Please wait a moment and try again.";
        }
        if (msg.includes("not found") || msg.includes("404")) {
          return "The selected AI model is currently unavailable. Please try a different model.";
        }
        return "Something went wrong. Please try again.";
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    if (!res.headersSent) {
      // Return a user-friendly message instead of raw internal errors
      const raw = error.message || "";
      let message = "Chat failed. Please try again.";
      if (raw.includes("quota") || raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
        message = "Rate limit exceeded — please wait a moment and try again.";
      } else if (raw.includes("not found") || raw.includes("404")) {
        message = "The selected AI model is currently unavailable.";
      } else if (raw.includes("No LLM provider")) {
        message = "No AI model is configured. Please contact an administrator.";
      }
      res.status(500).json({ message });
    }
  }
}

// GET /api/chat/models
export async function listModels(req, res) {
  try {
    res.json(getAvailableModels());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// GET /api/chat/conversations
export async function listConversations(req, res) {
  try {
    const userId = req.user.id;

    const conversations = await prisma.chatConversation.findMany({
      where: {
        OR: [{ isPrivate: false }, { userId }],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, imageUrl: true } },
      },
    });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// GET /api/chat/conversations/:id/messages
export async function getConversationMessages(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify access
    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.isPrivate && conversation.userId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// DELETE /api/chat/conversations/:id
export async function deleteConversation(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.userId !== userId) {
      return res.status(403).json({ message: "Can only delete your own conversations" });
    }

    await prisma.chatConversation.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// PATCH /api/chat/conversations/:id
export async function updateConversation(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, isPrivate } = req.body;

    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.userId !== userId) {
      return res.status(403).json({ message: "Can only update your own conversations" });
    }

    const data = {};
    if (title !== undefined) data.title = title;
    if (isPrivate !== undefined) data.isPrivate = isPrivate;

    const updated = await prisma.chatConversation.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
