import { Plus, Trash2, Lock, Globe, Pencil, X, Check } from "lucide-react";
import { useState } from "react";
import { useCurrentUser } from "../../lib/CurrentUserContext.jsx";

const ChatSidebar = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onUpdate,
}) => {
  const currentUser = useCurrentUser();
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const startEdit = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title || "");
  };

  const saveEdit = (id, e) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onUpdate(id, { title: editTitle.trim() });
    }
    setEditingId(null);
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full w-64 border-r border-base-300 bg-base-100 shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-base-300">
        <button
          onClick={onNew}
          className="btn btn-primary btn-sm w-full gap-2"
        >
          <Plus className="size-4" />
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {(!conversations || conversations.length === 0) && (
          <p className="text-sm text-base-content/50 p-4 text-center">
            No conversations yet
          </p>
        )}
        {conversations?.map((conv) => {
          const isOwner = conv.userId === currentUser?.id;
          const isActive = conv.id === activeId;

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-base-200 hover:bg-base-200/50 transition-colors ${
                isActive ? "bg-primary/10 border-l-2 border-l-primary" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(conv.id, e);
                        if (e.key === "Escape") cancelEdit(e);
                      }}
                      className="input input-xs input-bordered flex-1 min-w-0"
                      autoFocus
                    />
                    <button onClick={(e) => saveEdit(conv.id, e)} className="btn btn-xs btn-ghost">
                      <Check className="size-3" />
                    </button>
                    <button onClick={cancelEdit} className="btn btn-xs btn-ghost">
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium truncate">
                      {conv.title || "New conversation"}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-base-content/50">
                      {conv.isPrivate ? (
                        <Lock className="size-3" />
                      ) : (
                        <Globe className="size-3" />
                      )}
                      <span className="truncate">
                        {conv.user?.name || "Unknown"}
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(conv.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions (visible on hover, owner only) */}
              {isOwner && editingId !== conv.id && (
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => startEdit(conv, e)}
                    className="btn btn-xs btn-ghost"
                    title="Rename"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate(conv.id, { isPrivate: !conv.isPrivate });
                    }}
                    className="btn btn-xs btn-ghost"
                    title={conv.isPrivate ? "Make public" : "Make private"}
                  >
                    {conv.isPrivate ? <Globe className="size-3" /> : <Lock className="size-3" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="btn btn-xs btn-ghost text-error"
                    title="Delete"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatSidebar;
