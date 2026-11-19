import React, { useEffect, useRef, useState } from 'react';
import { Send, ShieldAlert, RotateCcw, MessageSquareHeart, Loader2 } from 'lucide-react';
import { AnalyzedLabReport, ChatMessage, Language } from '../types/lab';

interface AiCareSidebarProps {
  report: AnalyzedLabReport;
  language: Language;
  messages: ChatMessage[];
  isSending: boolean;
  chatError: string | null;
  onSendMessage: (text: string) => Promise<void>;
  onResetChat: () => void;
}

const PROMPT_CHIPS = [
  'Explain my flagged results simply',
  'What diet & lifestyle habits help these numbers?',
  'Generate 5 questions to ask my doctor',
  'Which specialist doctor should I consult?',
];

export const AiCareSidebar: React.FC<AiCareSidebarProps> = ({
  report,
  language,
  messages,
  isSending,
  chatError,
  onSendMessage,
  onResetChat,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput('');
    await onSendMessage(trimmed);
  };

  const handleChipClick = async (prompt: string) => {
    if (isSending) return;
    await onSendMessage(prompt);
  };

  const flaggedCount =
    report.numericMarkers.filter((m) => m.status !== 'normal').length +
    report.cultureFindings.filter((c) => c.status !== 'normal').length;

  return (
    <aside
      aria-label="AI Care and Doctor Prep Guide"
      className="bg-white border border-slate-200 rounded-xl flex flex-col lg:sticky lg:top-20 lg:h-[calc(100vh-6.5rem)] overflow-hidden"
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0 mt-0.5">
            <MessageSquareHeart className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold text-slate-900 truncate">
              AI Care &amp; Doctor Prep Guide
            </h2>
            <p className="text-[11px] text-slate-500 truncate mt-0.5 tabular-nums">
              Report-aware · {report.numericMarkers.length} markers · {flaggedCount} flagged
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onResetChat}
          title="Clear conversation"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
          aria-label="Reset conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Strict Safety Boundary Notice */}
      <div className="px-4 py-2 bg-teal-50/70 border-b border-teal-100 flex items-center gap-2 text-[11px] text-teal-900">
        <ShieldAlert className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
        <span>
          Explains results &amp; prepares doctor questions — never prescribes medicines or dosages.
        </span>
      </div>

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-[260px] lg:min-h-0"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                msg.role === 'user'
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100/90 border border-slate-200/80 text-slate-800'
              }`}
            >
              {msg.content}
            </div>
            <span className="mt-1 px-1 text-[10px] text-slate-400 tabular-nums">
              {msg.role === 'user' ? 'You' : 'MediGuide AI'} · {msg.timestamp}
            </span>
          </div>
        ))}

        {isSending && (
          <div className="flex items-start">
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" aria-hidden="true" />
              <span>
                Reviewing your {language === 'ta' ? 'Tamil' : language === 'hi' ? 'Hindi' : 'lab'} context...
              </span>
            </div>
          </div>
        )}

        {chatError && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800"
          >
            {chatError}
          </div>
        )}
      </div>

      {/* 4 One-Click Prompt Chips & Input */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50/60 space-y-2.5">
        <div className="flex flex-col gap-1.5" aria-label="Quick care prompts">
          <div className="text-[11px] font-semibold text-slate-500">
            Quick Doctor Prep Prompts
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {PROMPT_CHIPS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isSending}
                onClick={() => handleChipClick(prompt)}
                className="text-left px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:border-teal-500 hover:text-teal-900 hover:bg-teal-50/40 disabled:opacity-50 transition-colors truncate cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
          <label htmlFor="ai-care-input" className="sr-only">
            Ask a question about your lab report
          </label>
          <input
            id="ai-care-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a marker or doctor prep..."
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            aria-label="Send message"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </aside>
  );
};
