import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Globe, FileDown } from 'lucide-react';
import { AnalyzedLabReport, Language, PriorityLevel } from '../types/lab';

interface BigPictureSummaryProps {
  report: AnalyzedLabReport;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
}

const LANGUAGE_OPTIONS: Array<{ code: Language; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'Tamil' },
  { code: 'hi', label: 'Hindi' },
];

function getPriorityStyle(priority: PriorityLevel) {
  switch (priority) {
    case 'Routine':
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />,
      };
    case 'Follow-Up Recommended':
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-800',
        icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />,
      };
    case 'Prompt Doctor Review':
      return {
        bg: 'bg-red-50 border-red-200 text-red-800',
        icon: <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />,
      };
  }
}

export const BigPictureSummary: React.FC<BigPictureSummaryProps> = ({
  report,
  language,
  onChangeLanguage,
}) => {
  const priorityBadge = getPriorityStyle(report.priority);
  const bullets = report.summaryBullets[language] || report.summaryBullets.en;
  const totalMarkers = report.numericMarkers.length;
  const abnormalCount =
    report.numericMarkers.filter((m) => m.status !== 'normal').length +
    report.cultureFindings.filter((c) => c.status !== 'normal').length;

  const handleDownloadPdf = () => {
    window.print();
  };

  return (
    <section
      aria-label="Plain-English Big Picture Summary"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
    >
      {/* Top Row: Title, Metadata & Language Pill Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-xl font-bold text-slate-900 text-balance">
              {report.title}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold whitespace-nowrap ${priorityBadge.bg}`}
            >
              {priorityBadge.icon}
              <span>{report.priority}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{report.reportDate}</span>
            <span aria-hidden="true">·</span>
            <span>{report.patientLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {totalMarkers} numeric {totalMarkers === 1 ? 'marker' : 'markers'}
              {report.cultureFindings.length > 0
                ? ` · ${report.cultureFindings.length} culture report`
                : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-700 tabular-nums">
              {abnormalCount === 0
                ? 'All markers in range'
                : `${abnormalCount} flagged for review`}
            </span>
          </div>
        </div>

        {/* Right Controls: PDF Download & Language Pill Toggle */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition-colors whitespace-nowrap cursor-pointer"
            title="Download report as PDF (Print to PDF)"
          >
            <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download PDF Report</span>
          </button>

          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <div
              role="group"
              aria-label="Explanation Language"
              className="inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onChangeLanguage(opt.code)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600 ${
                    language === opt.code
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3-Bullet Plain-English Big Picture */}
      <div className="pt-4">
        <h3 className="text-xs font-semibold text-slate-500 mb-3">
          Plain-English Big Picture Summary
        </h3>
        <ul className="space-y-2.5">
          {bullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
              <span className="mt-1.5 w-5 h-5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[11px] font-semibold flex items-center justify-center shrink-0 tabular-nums">
                {idx + 1}
              </span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 pt-3.5 border-t border-slate-100 text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">Priority Note: </span>
          {report.priorityReason[language] || report.priorityReason.en}
        </p>
      </div>
    </section>
  );
};
