import React, { useRef } from 'react';
import {
  AlertCircle,
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Clock,
  CloudUpload,
  Database,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  LogIn,
  Paperclip,
  Trash2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { AnalyzedLabReport, SavedReportRecord } from '../types/lab';

interface SavedReportsBarProps {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  onSignIn: () => Promise<void>;
  savedReports: SavedReportRecord[];
  reportsLoading: boolean;
  activeSavedReportId: string | null;
  activeReport: AnalyzedLabReport;
  isSavingReport: boolean;
  isUploadingFile: boolean;
  storageError: string | null;
  onClearStorageError: () => void;
  onSaveCurrentReport: () => Promise<void>;
  onSelectSavedReport: (record: SavedReportRecord) => void;
  onDeleteSavedReport: (reportId: string) => Promise<void>;
  onAttachFileToReport: (reportId: string, file: File) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const SavedReportsBar: React.FC<SavedReportsBarProps> = ({
  user,
  authReady,
  isSigningIn,
  authError,
  onSignIn,
  savedReports,
  reportsLoading,
  activeSavedReportId,
  activeReport,
  isSavingReport,
  isUploadingFile,
  storageError,
  onClearStorageError,
  onSaveCurrentReport,
  onSelectSavedReport,
  onDeleteSavedReport,
  onAttachFileToReport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!authReady) {
    return null;
  }

  if (!user) {
    return (
      <section
        aria-label="Cloud Report History"
        className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">
              Cloud Report History &amp; File Storage
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Sign in with Google to store original lab PDFs/images in Firebase Cloud Storage and sync reports, AI Care chats, and doctor notes.
            </p>
            {authError && (
              <p className="text-xs text-red-700 mt-1.5" role="alert">
                {authError}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onSignIn()}
          disabled={isSigningIn}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isSigningIn ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>
      </section>
    );
  }

  const activeSavedRecord = savedReports.find((r) => r.id === activeSavedReportId) || null;
  const isCurrentReportSaved = Boolean(activeSavedRecord);
  const canAttachFile = Boolean(
    activeSavedRecord && activeSavedRecord.handoffStatus !== 'completed'
  );

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeSavedRecord) return;
    await onAttachFileToReport(activeSavedRecord.id, file);
  };

  return (
    <section
      aria-label="Saved Lab History and Cloud File Storage"
      className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-teal-700" aria-hidden="true" />
          <h2 className="font-display text-sm font-bold text-slate-900">
            Saved Lab History
          </h2>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 tabular-nums">
            {savedReports.length}
          </span>
        </div>

        {!isCurrentReportSaved ? (
          <button
            type="button"
            onClick={() => void onSaveCurrentReport()}
            disabled={isSavingReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {isSavingReport ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Save &ldquo;{activeReport.title}&rdquo;</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>Synced to Cloud</span>
          </span>
        )}
      </div>

      {storageError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{storageError}</span>
          </div>
          <button
            type="button"
            onClick={onClearStorageError}
            aria-label="Dismiss storage notice"
            className="p-0.5 text-amber-700 hover:text-amber-900 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cloud File Storage Attachment Bar for Active Saved Report */}
      {activeSavedRecord && (
        <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => void handleFileSelected(e)}
            className="sr-only"
          />

          {activeSavedRecord.attachment ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-md bg-white border border-slate-200 text-teal-700 flex items-center justify-center shrink-0">
                  {activeSavedRecord.attachment.mimeType === 'application/pdf' ? (
                    <FileText className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ImageIcon className="w-4 h-4" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {activeSavedRecord.attachment.fileName}
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    Cloud Storage · {formatBytes(activeSavedRecord.attachment.sizeBytes)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={activeSavedRecord.attachment.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-semibold text-teal-800 hover:bg-teal-50/60 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Open File</span>
                </a>
                {canAttachFile && (
                  <button
                    type="button"
                    disabled={isUploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isUploadingFile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>{isUploadingFile ? 'Uploading...' : 'Replace'}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Paperclip className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <span>No original lab PDF or image stored in Cloud Storage for this report yet.</span>
              </div>

              {canAttachFile && (
                <button
                  type="button"
                  disabled={isUploadingFile}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-semibold text-teal-800 hover:bg-teal-50/70 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                >
                  {isUploadingFile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{isUploadingFile ? 'Uploading...' : 'Upload Lab File'}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {reportsLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" aria-hidden="true" />
          <span>Loading your saved lab reports...</span>
        </div>
      ) : savedReports.length === 0 ? (
        <p className="text-xs text-slate-500">
          No reports saved yet. Analyze a lab report or click Save above to store it in your personal cloud history.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {savedReports.map((item) => {
            const isSelected = item.id === activeSavedReportId;
            return (
              <div
                key={item.id}
                className={`group flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 transition-colors ${
                  isSelected
                    ? 'bg-teal-50/70 border-teal-600'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectSavedReport(item)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {item.report.title}
                    </span>
                    {item.attachment && (
                      <Paperclip
                        className="w-3 h-3 text-teal-700 shrink-0"
                        aria-label="Includes stored lab file"
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                    <span>{item.report.reportDate}</span>
                    <span aria-hidden="true">·</span>
                    {item.handoffStatus === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                        <span>Doctor Note Ready</span>
                      </span>
                    ) : item.handoffStatus === 'sent' ||
                      item.handoffStatus === 'under_review' ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        <span>Pending Doctor</span>
                      </span>
                    ) : (
                      <span>{item.report.priority}</span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void onDeleteSavedReport(item.id)}
                  aria-label={`Delete ${item.report.title}`}
                  title="Delete saved report"
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
