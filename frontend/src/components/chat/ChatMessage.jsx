import { User, Bot, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

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
        <div className="px-3 py-2 bg-base-200/30 max-h-60 overflow-auto">
          <pre className="whitespace-pre-wrap text-xs">
            {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

const ChatMessage = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="avatar placeholder shrink-0">
          <div className="bg-primary text-primary-content rounded-full w-8 h-8">
            <Bot className="size-4" />
          </div>
        </div>
      )}

      <div
        className={`max-w-[75%] ${
          isUser
            ? "bg-primary text-primary-content rounded-2xl rounded-br-sm px-4 py-2"
            : "bg-base-200 rounded-2xl rounded-bl-sm px-4 py-2"
        }`}
      >
        {/* Tool invocations */}
        {message.parts?.map((part, i) => {
          if (part.type === "tool-invocation") {
            return <ToolInvocation key={i} toolInvocation={part.toolInvocation} />;
          }
          if (part.type === "text" && part.text) {
            return (
              <div key={i} className="whitespace-pre-wrap break-words">
                {part.text}
              </div>
            );
          }
          return null;
        })}

        {/* Fallback for messages without parts */}
        {!message.parts && message.content && (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
      </div>

      {isUser && (
        <div className="avatar placeholder shrink-0">
          <div className="bg-secondary text-secondary-content rounded-full w-8 h-8">
            <User className="size-4" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
