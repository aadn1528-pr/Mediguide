import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Language, MarkerStatus, NumericMarker } from '../types/lab';

interface NumericMarkerCardProps {
  marker: NumericMarker;
  language: Language;
}

function getStatusMeta(status: MarkerStatus) {
  switch (status) {
    case 'normal':
      return {
        label: 'Normal',
        badgeClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        pinClass: 'bg-emerald-600',
        valueClass: 'text-slate-900',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />,
      };
    case 'borderline':
      return {
        label: 'Borderline',
        badgeClass: 'bg-amber-50 border-amber-200 text-amber-800',
        pinClass: 'bg-amber-500',
        valueClass: 'text-amber-800',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />,
      };
    case 'out_of_range':
      return {
        label: 'Out of Range',
        badgeClass: 'bg-red-50 border-red-200 text-red-800',
        pinClass: 'bg-red-600',
        valueClass: 'text-red-700',
        icon: <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />,
      };
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const NumericMarkerCard: React.FC<NumericMarkerCardProps> = ({
  marker,
  language,
}) => {
  const statusMeta = getStatusMeta(marker.status);

  const safeMin = Math.min(marker.displayMin, marker.refMin, marker.value);
  const safeMax = Math.max(marker.displayMax, marker.refMax, marker.value);
  const span = safeMax - safeMin || 1;

  const refStartPct = clamp(((marker.refMin - safeMin) / span) * 100, 0, 96);
  const refEndPct = clamp(((marker.refMax - safeMin) / span) * 100, refStartPct + 4, 100);
  const valPct = clamp(((marker.value - safeMin) / span) * 100, 2, 98);

  const explanationText = marker.explanation[language] || marker.explanation.en;

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4">
      <div>
        {/* Header: Test Name & Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-display text-sm font-semibold text-slate-900 leading-snug">
            {marker.name}
          </h4>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap shrink-0 ${statusMeta.badgeClass}`}
          >
            {statusMeta.icon}
            <span>{statusMeta.label}</span>
          </span>
        </div>

        {/* Numeric Value & Reference Range */}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`font-mono tabular-nums text-2xl font-bold tracking-tight ${statusMeta.valueClass}`}
            >
              {marker.value}
            </span>
            <span className="font-mono text-xs text-slate-500">{marker.unit}</span>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-500">
            Ref: {marker.referenceRangeText}
          </span>
        </div>

        {/* Visual Range-Indicator Bar */}
        <div className="mt-3.5 pt-1" aria-label={`Range indicator for ${marker.name}`}>
          <div className="relative h-2.5 bg-slate-100 rounded-full border border-slate-200/70">
            {/* Normal Reference Band */}
            <div
              className="absolute top-0 bottom-0 bg-emerald-200/80 rounded-full"
              style={{
                left: `${refStartPct}%`,
                width: `${Math.max(4, refEndPct - refStartPct)}%`,
              }}
              title={`Normal range: ${marker.referenceRangeText}`}
            />
            {/* Patient Value Pin */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-sm ${statusMeta.pinClass}`}
              style={{ left: `${valPct}%` }}
              title={`Your result: ${marker.value} ${marker.unit}`}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
            <span>{safeMin}</span>
            <span className="text-emerald-700 font-medium">
              Normal: {marker.refMin}–{marker.refMax} {marker.unit}
            </span>
            <span>{safeMax}</span>
          </div>
        </div>
      </div>

      {/* Plain-Language Explanation */}
      <p className="pt-3 border-t border-slate-100 text-sm leading-relaxed text-slate-600">
        {explanationText}
      </p>
    </article>
  );
};
