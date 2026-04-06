import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const NoteLog = ({ title = "Notes", queryKey, fetchFn, createFn, deleteFn, canAdd, canDelete }) => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");

  const { data, isLoading } = useQuery({ queryKey, queryFn: fetchFn });

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: () => createFn(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setText("");
      setShowForm(false);
      toast.success("Note added");
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to add note"),
  });

  const { mutate: remove } = useMutation({
    mutationFn: (noteId) => deleteFn(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Note deleted");
    },
    onError: (err) => toast.error(err?.response?.data?.error ?? "Failed to delete note"),
  });

  const notes = data?.data ?? [];

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300 mt-4">
      <div className="card-body gap-3">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-base">{title}</h2>
          {canAdd && !showForm && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowForm(true)}>
              Add Note
            </button>
          )}
        </div>

        {showForm && (
          <div className="flex flex-col gap-2 p-3 bg-base-200 rounded-lg">
            <div className="flex flex-col gap-1">
              <label className="text-sm">Note <span className="opacity-40 text-xs">— markdown supported</span></label>
              <textarea
                className="textarea textarea-bordered textarea-sm w-full"
                placeholder="Add a note…"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setText(""); }}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => create()}
                disabled={isCreating || !text.trim()}
              >
                {isCreating ? <span className="loading loading-spinner loading-xs" /> : "Save"}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner loading-sm opacity-50" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-sm opacity-40 py-2">No notes yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <div key={note.id} className="flex items-start justify-between gap-3 py-2 border-b border-base-200 last:border-0">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs opacity-40">
                    {new Date(note.createdAt).toLocaleDateString()} · {note.user?.name ?? "Unknown"}
                  </span>
                  <div className="prose prose-sm max-w-none text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.text}</ReactMarkdown>
                  </div>
                </div>
                {canDelete?.(note) && (
                  <button
                    className="btn btn-ghost btn-xs text-error shrink-0"
                    onClick={() => remove(note.id)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteLog;
