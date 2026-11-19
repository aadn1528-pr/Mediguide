import React from 'react';
import { Microscope, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CultureFinding, Language, Susceptibility } from '../types/lab';

interface CulturePathogenCardProps {
  culture: CultureFinding;
  language: Language;
}

function getSusceptibilityStyle(interp: Susceptibility) {
  switch (interp) {
    case 'Susceptible':
      return {
        badge: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />,
        short: 'Susceptible (S)',
      };
    case 'Intermediate':
      return {
        badge: 'bg-amber-50 border-amber-200 text-amber-800',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />,
        short: 'Intermediate (I)',
      };
    case 'Resistant':
      return {
        badge: 'bg-red-50 border-red-200 text-red-800',
        icon: <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />,
        short: 'Resistant (R)',
      };
  }
}

export const CulturePathogenCard: React.FC<CulturePathogenCardProps> = ({
  culture,
  language,
}) => {
  const sensitivityNote =
    culture.sensitivityNotes[language] || culture.sensitivityNotes.en;

  return (
    <article className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 text-teal-800 flex items-center justify-center shrink-0">
            <Microscope className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="font-display text-base font-bold text-slate-900">
              Culture &amp; Pathogen Report
            </h4>
            <p className="text-xs text-slate-500">
              Specimen analysis &amp; antibiotic susceptibility panel
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold whitespace-nowrap shrink-0 self-start sm:self-center ${
            culture.isGrowthDetected
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {culture.isGrowthDetected ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
              <span>Organism Detected · Out of Range</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>No Growth · Normal</span>
            </>
          )}
        </span>
      </div>

      {/* Specimen & Organism Details */}
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="text-xs text-slate-500">Specimen Type</div>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">
              {culture.specimenType}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Collection Site</div>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">
              {culture.collectionSite}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Incubation Window</div>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">
              {culture.incubationTime}
            </div>
          </div>
        </div>

        {/* Organism Banner */}
        <div
          className={`rounded-lg border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            culture.isGrowthDetected
              ? 'bg-red-50/70 border-red-200'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <div>
            <div className="text-xs font-medium text-slate-600">
              Detected Bacteria / Organism
            </div>
            <div
              className={`font-display text-base font-bold mt-0.5 ${
                culture.isGrowthDetected ? 'text-red-900' : 'text-emerald-900'
              }`}
            >
              {culture.organismDetected}
            </div>
          </div>
        </div>

        {/* Plain-Language Sensitivity Breakdown */}
        <div className="text-sm leading-relaxed text-slate-700 bg-slate-50/80 border border-slate-200/80 rounded-lg p-3.5">
          <span className="font-semibold text-slate-900">Plain-Language Sensitivity Guide: </span>
          {sensitivityNote}
        </div>

        {/* Antibiotic Sensitivity Table */}
        {culture.antibiotics.length > 0 && (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Antibiotic Tested</th>
                  <th className="py-2.5 px-4 text-right">MIC / Zone Value</th>
                  <th className="py-2.5 px-4 text-right">Lab Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {culture.antibiotics.map((row) => {
                  const style = getSusceptibilityStyle(row.interpretation);
                  return (
                    <tr key={row.antibiotic} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {row.antibiotic}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                        {row.micOrZone}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap ${style.badge}`}
                        >
                          {style.icon}
                          <span>{style.short}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  );
};
