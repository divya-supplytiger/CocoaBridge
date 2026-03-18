import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { Send, Square, Info } from "lucide-react";
import toast from "react-hot-toast";
import ChatSidebar from "../components/chat/ChatSidebar.jsx";
import ChatMessage from "../components/chat/ChatMessage.jsx";
import { chatApi } from "../lib/api.js";

const API_BASE =
  import.meta.env.VITE_ENV === "production"
    ? import.meta.env.VITE_API_BASE_URL
    : "http://localhost:5050/api";

const RETENTION_TOAST_KEY = "chat_retention_toast_shown";

const ChatPage = () => {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [selectedModelOverride, setSelectedModel] = useState(null);
  const [input, setInput] = useState("");

  // Refs for dynamic values — transport captures body once, so we use refs + prepareSendMessagesRequest
  const conversationIdRef = useRef(null);
  const selectedModelRef = useRef(null);

  // Show retention toast once per session
  useEffect(() => {
    if (!sessionStorage.getItem(RETENTION_TOAST_KEY)) {
      toast("Conversations are retained for 14 days.", {
        icon: "ℹ️",
        duration: 5000,
      });
      sessionStorage.setItem(RETENTION_TOAST_KEY, "true");
    }
  }, []);

  // Fetch available models
  const { data: models } = useQuery({
    queryKey: ["chatModels"],
    queryFn: chatApi.getModels,
    staleTime: 5 * 60 * 1000,
  });

  // Derive selected model: user override → default → first available
  const selectedModel = useMemo(() => {
    if (selectedModelOverride && models?.some((m) => m.id === selectedModelOverride)) {
      return selectedModelOverride;
    }
    if (!models?.length) return null;
    return (models.find((m) => m.isDefault) || models[0]).id;
  }, [models, selectedModelOverride]);

  // Keep refs in sync with state
  conversationIdRef.current = activeConversationId;
  selectedModelRef.current = selectedModel;

  // Fetch conversations
  const { data: conversations } = useQuery({
    queryKey: ["chatConversations"],
    queryFn: chatApi.listConversations,
    refetchInterval: 30000,
  });

  // Load messages for active conversation
  const { data: savedMessages } = useQuery({
    queryKey: ["chatMessages", activeConversationId],
    queryFn: () => chatApi.getMessages(activeConversationId),
    enabled: !!activeConversationId,
  });

  // useChat hook — core streaming integration
  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: `${API_BASE}/chat`,
      credentials: "include",
      prepareSendMessagesRequest: ({ body, messages }) => ({
        body: {
          ...body,
          messages,
          conversationId: conversationIdRef.current,
          model: selectedModelRef.current,
        },
      }),
      fetch: async (url, init) => {
        const response = await fetch(url, init);
        // Capture conversation ID from response header for new conversations
        const newConvId = response.headers.get("x-conversation-id");
        if (newConvId && !conversationIdRef.current) {
          conversationIdRef.current = newConvId;
          setActiveConversationId(newConvId);
        }
        return response;
      },
    }),
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
      if (conversationIdRef.current) {
        queryClient.invalidateQueries({ queryKey: ["chatMessages", conversationIdRef.current] });
      }
    },
    onError: (error) => {
      let msg = error?.message || "Something went wrong";
      // Backend 500 responses arrive as JSON strings — extract the inner message
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.message) msg = parsed.message;
      } catch {
        // not JSON, use as-is
      }
      if (msg.includes("rate limit") || msg.includes("quota") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        toast.error("Rate limit exceeded — please wait a moment and try again.");
      } else if (msg.includes("unavailable") || msg.includes("not found")) {
        toast.error("Model unavailable — try selecting a different model.");
      } else if (msg.includes("pipeThrough") || msg.includes("body is empty") || msg.includes("Failed to fetch")) {
        toast.error("Connection error — please try again.");
      } else {
        toast.error(msg);
      }
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Load saved messages into useChat when switching conversations
  useEffect(() => {
    if (savedMessages) {
      setMessages(
        savedMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          ...(msg.toolCalls && { toolInvocations: msg.toolCalls }),
        }))
      );
    }
  }, [savedMessages, setMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Delete conversation
  const deleteMutation = useMutation({
    mutationFn: chatApi.deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
      if (activeConversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
  });

  // Update conversation (rename, toggle privacy)
  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => chatApi.updateConversation(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
    },
  });

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  const handleSelectConversation = (id) => {
    setActiveConversationId(id);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const handleUpdate = (id, body) => {
    updateMutation.mutate({ id, body });
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-4 overflow-hidden rounded-lg border border-base-300">
      {/* Conversation sidebar */}
      <ChatSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header with model selector */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 bg-base-100">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg">
              {activeConversationId
                ? conversations?.find((c) => c.id === activeConversationId)
                    ?.title || "Chat"
                : "New Chat"}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Retention info */}
            <div className="tooltip tooltip-left" data-tip="Conversations are retained for 14 days">
              <Info className="size-4 text-base-content/40" />
            </div>

            {/* Model selector */}
            {models?.length > 0 && (
              <select
                value={selectedModel || ""}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="select select-sm select-bordered"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-base-content/40">
              <p className="text-lg font-medium">CocoaBridge AI</p>
              <p className="text-sm mt-1">
                Ask about federal procurement opportunities, awards, and more.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isStreaming && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3 justify-start">
              <div className="avatar placeholder shrink-0">
                <div className="bg-primary text-primary-content rounded-full w-8 h-8">
                  <span className="loading loading-dots loading-xs"></span>
                </div>
              </div>
              <div className="bg-base-200 rounded-2xl rounded-bl-sm px-4 py-2">
                <span className="loading loading-dots loading-sm"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-base-300 bg-base-100 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim() || isStreaming) return;
              sendMessage({ role: "user", content: input.trim() });
              setInput("");
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!input.trim() || isStreaming) return;
                  sendMessage({ role: "user", content: input.trim() });
                  setInput("");
                }
              }}
              placeholder="Ask about opportunities, awards, agencies..."
              className="textarea textarea-bordered flex-1 min-h-[44px] max-h-32 resize-none"
              rows={1}
              disabled={isStreaming}
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={stop}
                className="btn btn-error btn-sm"
                title="Stop generating"
              >
                <Square className="size-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input?.trim()}
                className="btn btn-primary btn-sm"
              >
                <Send className="size-4" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
