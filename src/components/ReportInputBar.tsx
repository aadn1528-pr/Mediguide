import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileText,
  X,
  Loader2,
  AlertCircle,
  FlaskConical,
  Eraser,
} from 'lucide-react';
import { SAMPLE_REPORTS, SamplePresetMeta } from '../data/sampleReports';

interface ReportInputBarProps {
  activePresetKey?: string;
  rawText: string;
  onChangeRawText: (text: string) => void;
  onLoadPreset: (preset: SamplePresetMeta) => void;
  onAnalyze: (payload: {
    text: string;
    file?: { data: string; mimeType: string; name: string };
  }) => Promise<boolean | void>;
  isAnalyzing: boolean;
  analyzeError: string | null;
}

const PRESET_RAW_TEXTS = new Set(
  SAMPLE_REPORTS.map((p) => p.report.rawReportText.trim())
);

type SupportedBinaryMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';

function resolveMimeType(file: File): SupportedBinaryMime | 'text/plain' | null {
  const type = (file.type || '').toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (type === 'image/png' || ext === 'png') return 'image/png';
  if (type === 'image/jpeg' || type === 'image/jpg' || ext === 'jpg' || ext === 'jpeg') {
    return 'image/jpeg';
  }
  if (type === 'image/webp' || ext === 'webp') return 'image/webp';
  if (type === 'application/pdf' || ext === 'pdf') return 'application/pdf';
  if (
    type === 'text/plain' ||
    type === 'text/csv' ||
    ext === 'txt' ||
    ext === 'csv'
  ) {
    return 'text/plain';
  }
  return null;
}

export const ReportInputBar: React.FC<ReportInputBarProps> = ({
  activePresetKey,
  rawText,
  onChangeRawText,
  onLoadPreset,
  onAnalyze,
  isAnalyzing,
  analyzeError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<{
    data: string;
    mimeType: SupportedBinaryMime;
    name: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const isPresetTextUnmodified = useMemo(
    () => PRESET_RAW_TEXTS.has(rawText.trim()),
    [rawText]
  );

  const handleSelectedFile = (file: File) => {
    setFileError(null);
    const resolvedMime = resolveMimeType(file);
    if (!resolvedMime) {
      setFileError(
        'Please upload a PNG, JPG, WEBP image, PDF, or TXT/CSV lab report.'
      );
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setFileError('File size must be under 12 MB.');
      return;
    }

    if (resolvedMime === 'text/plain') {
      const textReader = new FileReader();
      textReader.onload = () => {
        const content = typeof textReader.result === 'string' ? textReader.result : '';
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onChangeRawText(content);
      };
      textReader.onerror = () => {
        setFileError('Could not read the selected text file.');
      };
      textReader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setSelectedFile({
        data: base64,
        mimeType: resolvedMime,
        name: file.name,
      });
      // Prevent leftover sample preset text from contaminating an uploaded real report
      if (PRESET_RAW_TEXTS.has(rawText.trim())) {
        onChangeRawText('');
      }
    };
    reader.onerror = () => {
      setFileError('Could not read the selected file.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileError(null);

    const textToSend =
      selectedFile && isPresetTextUnmodified ? '' : rawText;

    const succeeded = await onAnalyze({
      text: textToSend,
      file: selectedFile ?? undefined,
    });

    if (succeeded !== false && selectedFile) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <section
      aria-label="Lab Report Input and Sample Presets"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900">
            Universal Lab Report Analyzer
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Upload a real lab report photo, PDF, or text export, paste raw lab values, or test with a sample report.
          </p>
        </div>
      </div>

      {/* Built-in Lab Report Summaries */}
      <div className="pt-4 pb-4 border-b border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <FlaskConical className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Built-in Lab Report Summaries ({SAMPLE_REPORTS.length})</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Click any built-in summary for instant plain-English results &amp; range bars
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {SAMPLE_REPORTS.map((preset) => {
            const isActive = activePresetKey === preset.key && !selectedFile;
            const dotClass =
              preset.report.priority === 'Routine'
                ? 'bg-emerald-500'
                : preset.report.priority === 'Prompt Doctor Review'
                  ? 'bg-red-500'
                  : 'bg-amber-500';
            const totalItems =
              preset.report.numericMarkers.length +
              preset.report.cultureFindings.length;

            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setFileError(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  onLoadPreset(preset);
                }}
                className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600 ${
                  isActive
                    ? 'bg-teal-50/80 border-teal-600 text-teal-950'
                    : 'bg-slate-50/70 border-slate-200 text-slate-800 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold truncate">
                      {preset.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 tabular-nums">
                    {totalItems}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5 pl-3.5">
                  {preset.shortDesc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload & Raw Text Form */}
      <form onSubmit={handleSubmit} className="pt-4 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* File Dropzone */}
          <div className="lg:col-span-4 flex flex-col">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf,.txt,.csv"
              onChange={handleFileChange}
              className="sr-only"
              id="lab-report-file-input"
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex-1 flex flex-col items-center justify-center text-center p-4 rounded-lg border border-dashed transition-colors ${
                isDragging
                  ? 'border-teal-600 bg-teal-50/70'
                  : 'border-slate-300 bg-slate-50/60 hover:border-teal-500'
              }`}
            >
              {selectedFile ? (
                <div className="w-full space-y-2">
                  <div className="w-full flex items-center justify-between gap-2 bg-white border border-teal-200 rounded-md px-3 py-2 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                      <span className="text-xs font-medium text-slate-800 truncate">
                        {selectedFile.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                      aria-label="Remove uploaded file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-teal-700 font-medium">
                    Ready for AI extraction
                  </p>
                </div>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-teal-700 mb-1.5" aria-hidden="true" />
                  <p className="text-xs font-medium text-slate-700">
                    Drop photo, PDF, or TXT/CSV
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-2 cursor-pointer"
                  >
                    Browse file
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Raw Text Area */}
          <div className="lg:col-span-8 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="raw-lab-text"
                className="text-xs font-medium text-slate-600"
              >
                {selectedFile
                  ? 'Optional notes or extra lines for your uploaded file'
                  : 'Lab report text (paste your own report or edit below)'}
              </label>
              {rawText.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeRawText('')}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <Eraser className="w-3 h-3" aria-hidden="true" />
                  <span>Clear text</span>
                </button>
              )}
            </div>
            <textarea
              id="raw-lab-text"
              rows={3}
              value={rawText}
              onChange={(e) => onChangeRawText(e.target.value)}
              placeholder={
                selectedFile
                  ? 'Optional: add extra context or leave blank to analyze the uploaded file directly...'
                  : 'Paste any real lab report text here (e.g., HbA1c 6.8%, Fasting Glucose 118 mg/dL, TSH 5.4 mIU/L, Urine Culture E. coli...)'
              }
              className="w-full flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 font-mono placeholder:font-sans placeholder:text-slate-400 focus:bg-white focus:border-teal-600 focus:outline-none resize-y"
            />
          </div>
        </div>

        {(fileError || analyzeError) && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{fileError || analyzeError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">
            Supports blood panels, CBC, metabolic, thyroid/vitamin, lipid, and microbiology culture reports.
          </p>
          <button
            type="submit"
            disabled={isAnalyzing || (!rawText.trim() && !selectedFile)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Analyzing Lab Report...</span>
              </>
            ) : (
              <span>
                {selectedFile ? 'Analyze Uploaded File' : 'Analyze Lab Report'}
              </span>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};
