import { useState, useEffect, useRef } from "react";
import { getClaudeMd, updateClaudeMd } from "../../lib/tauri";
import { useSessionStore } from "../../stores/sessionStore";

export function InstructionsPanel() {
  const [content, setContent] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = useSessionStore((s) => {
    return s.sessions.find((sess) => sess.id === s.activeSessionId);
  });
  const projectPath = activeSession?.projectPath;

  // Load CLAUDE.md on mount and when project changes
  useEffect(() => {
    if (!projectPath) {
      setContent(null);
      return;
    }

    const load = () => {
      getClaudeMd(projectPath)
        .then(setContent)
        .catch(() => setContent(null));
    };

    load();

    // Poll for external changes every 10 seconds
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [projectPath]);

  const handleEdit = () => {
    setEditContent(content || "");
    setIsEditing(true);
    // Focus textarea after render
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!projectPath) return;
    setIsSaving(true);
    try {
      await updateClaudeMd(projectPath, editContent);
      setContent(editContent);
      setIsEditing(false);
      setLastSaved(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to save CLAUDE.md:", err);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent("");
  };

  if (!projectPath) {
    return (
      <div className="p-4 text-xs text-text-muted">
        Select a session to view project instructions.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-text">CLAUDE.md</h3>
          <span className="text-xs text-text-muted">
            (survives compaction)
          </span>
        </div>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text"
          >
            Edit
          </button>
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isEditing ? (
          <div className="flex flex-col p-3">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[200px] w-full resize-y rounded border border-border bg-bg-tertiary p-3 font-mono text-xs text-text focus:border-accent focus:outline-none"
              placeholder="# Project Instructions&#10;&#10;Add instructions for Claude Code here..."
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="rounded px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-bg-tertiary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded bg-accent px-3 py-1.5 text-xs text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : content !== null ? (
          <div className="p-4">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-muted">
              {content}
            </pre>
            {lastSaved && (
              <div className="mt-2 text-xs text-text-muted">
                Last saved: {lastSaved}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-xs text-text-muted">
            <p>No CLAUDE.md found in this project.</p>
            <button
              onClick={handleEdit}
              className="mt-2 text-accent hover:underline"
            >
              Create one
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
