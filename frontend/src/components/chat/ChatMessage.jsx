import { Bot, User, Loader2, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ToolInvocation = ({ toolInvocation }) => {
  const [expanded, setExpanded] = useState(false);
  const { toolName, state, result } = toolInvocation;

  const friendlyName = toolName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="my-2 border border-base-300 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-base-200/50 hover:bg-base-200 transition-colors text-left"
      >
        {state === "call" ? (
          <Loader2 className="size-4 animate-spin text-info" />
        ) : (
          <span className="size-4 text-success">✓</span>
        )}
        <span className="font-medium flex-1">
          {state === "call" ? `Calling ${friendlyName}…` : friendlyName}
        </span>
        {state === "result" &&
          (expanded ? (
            <ChevronDown className="size-4 opacity-50" />
          ) : (
            <ChevronRight className="size-4 opacity-50" />
          ))}
      </button>
      {expanded && state === "result" && result && (
        <div className="px-3 py-2 bg-base-200 max-h-60 overflow-auto">
          <pre className="whitespace-pre-wrap text-xs">
            {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

const MarkdownContent = ({ children }) => (
  <div className="prose prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
  </div>
);

const getMessageText = (message) => {
  if (message.parts) {
    return message.parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text)
      .join("\n");
  }
  return message.content ?? "";
};

const CopyButton = ({ text, isUser }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className={`opacity-0 group-hover:opacity-100 transition-opacity btn btn-ghost btn-xs ${isUser ? "text-primary-content/70 hover:text-primary-content" : "text-base-content/50 hover:text-base-content"}`}
      title="Copy message"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
};

const ChatMessage = ({ message, owner }) => {
  const isUser = message.role === "user";
  const displayName = isUser ? owner?.name ?? "User" : "Mary";

  const hasContent = message.content ||
    message.parts?.some((p) => (p.type === "text" && p.text) || p.type === "tool-invocation");
  const isThinking = !isUser && !hasContent;
  const textContent = getMessageText(message);

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center">
          <Bot className="size-4" />
        </div>
      )}

      <div
        className={`group relative max-w-[75%] ${
          isUser
            ? "bg-primary text-primary-content rounded-2xl rounded-br-sm px-4 py-2"
            : "bg-base-200 rounded-2xl rounded-bl-sm px-4 py-2"
        }`}
      >
        <p className={`text-xs font-semibold mb-1 ${isUser ? "text-primary-content/70" : "text-base-content/50"}`}>
          {displayName}
        </p>

        {isThinking && (
          <div className="flex items-center gap-2 text-base-content/50 text-sm">
            <span className="loading loading-dots loading-sm"></span>
            <span>Thinking…</span>
          </div>
        )}

        {/* Tool invocations */}
        {message.parts?.map((part, i) => {
          if (part.type === "tool-invocation") {
            return <ToolInvocation key={i} toolInvocation={part.toolInvocation} />;
          }
          if (part.type === "text" && part.text) {
            return isUser ? (
              <div key={i} className="whitespace-pre-wrap break-words">
                {part.text}
              </div>
            ) : (
              <MarkdownContent key={i}>{part.text}</MarkdownContent>
            );
          }
          return null;
        })}

        {/* Fallback for messages without parts */}
        {!message.parts && message.content && (
          isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <MarkdownContent>{message.content}</MarkdownContent>
          )
        )}

<div className="flex justify-end">
        {textContent && <CopyButton text={textContent} isUser={isUser} />}
        </div>
      </div>

      {isUser && (
        owner?.imageUrl ? (
          <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden">
            <img src={owner.imageUrl} alt={displayName} className="w-full h-full object-cover" />
          </div>
        ) : owner?.name ? (
          <div className="shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-content flex items-center justify-center">
            <span className="text-xs font-bold">
              {owner.name[0].toUpperCase()}
            </span>
          </div>
        ) : (
          <div className="shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-content flex items-center justify-center">
            <User className="size-4" />
          </div>
        )
      )}
    </div>
  );
};

export default ChatMessage;
