'use client';

import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { SessionListItem } from '@/types/session';

export function SessionManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    sessions,
    currentSessionId,
    autoSaveEnabled,
    createSession,
    loadSession,
    saveCurrentSession,
    deleteSession,
    renameSession,
    setAutoSave,
  } = useChatStore();

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Handle new session
  const handleNewSession = () => {
    const name = prompt('Session name (optional):');
    createSession(name || undefined);
    setIsOpen(false);
  };

  // Handle load session
  const handleLoadSession = (sessionId: string) => {
    if (currentSessionId && currentSessionId !== sessionId) {
      // Auto-save current before switching
      saveCurrentSession();
    }
    loadSession(sessionId);
    setIsOpen(false);
  };

  // Handle rename
  const startRename = (session: SessionListItem) => {
    setEditingId(session.id);
    setEditName(session.name);
  };

  const confirmRename = () => {
    if (editingId && editName.trim()) {
      renameSession(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  // Handle delete
  const handleDelete = (sessionId: string) => {
    if (confirmDelete === sessionId) {
      deleteSession(sessionId);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(sessionId);
      // Auto-clear confirm after 3 seconds
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-surface-light hover:bg-surface-light/80 rounded-lg transition-colors"
        title="Save and manage conversation sessions"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span>Sessions</span>
        {currentSessionId && (
          <span className="w-2 h-2 bg-green-500 rounded-full" title="Session active" />
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-surface border border-border rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="font-semibold">Sessions</h3>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="w-3 h-3 accent-primary"
                />
                Auto-save
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 p-3 border-b border-border">
            <button
              onClick={handleNewSession}
              className="flex-1 px-3 py-2 text-sm bg-primary hover:bg-primary-hover rounded transition-colors"
            >
              + New Session
            </button>
            {currentSessionId && (
              <button
                onClick={() => saveCurrentSession()}
                className="px-3 py-2 text-sm bg-surface-light hover:bg-surface-light/80 rounded transition-colors"
                title="Save current session"
              >
                Save
              </button>
            )}
          </div>

          {/* Session List */}
          <div className="max-h-64 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-muted text-sm">
                No saved sessions yet
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-3 border-b border-border/50 hover:bg-surface-light transition-colors ${
                    session.id === currentSessionId ? 'bg-surface-light' : ''
                  }`}
                >
                  {editingId === session.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                        className="flex-1 px-2 py-1 text-sm bg-surface border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                      <button
                        onClick={confirmRename}
                        className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 text-xs bg-surface-light hover:bg-surface-light/80 rounded"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleLoadSession(session.id)}
                          className="text-left flex-1"
                        >
                          <div className="font-medium text-sm truncate">
                            {session.name}
                            {session.id === currentSessionId && (
                              <span className="ml-2 text-xs text-green-500">(current)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted">
                            {session.messageCount} messages · {session.participantCount} models · {formatDate(session.lastAccessedAt)}
                          </div>
                        </button>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => startRename(session)}
                            className="p-1 text-muted hover:text-foreground transition-colors"
                            title="Rename"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(session.id)}
                            className={`p-1 transition-colors ${confirmDelete === session.id ? 'text-red-500' : 'text-muted hover:text-red-400'}`}
                            title={confirmDelete === session.id ? 'Click again to confirm' : 'Delete'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 text-center text-xs text-muted border-t border-border">
            Sessions saved in browser storage
          </div>
        </div>
      )}
    </div>
  );
}
