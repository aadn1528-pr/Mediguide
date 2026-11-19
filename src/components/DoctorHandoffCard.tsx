import React from 'react';
import { Send, CheckCircle2, Clock, Stethoscope, ArrowRight } from 'lucide-react';
import { AnalyzedLabReport, DoctorProfile, HandoffStatus, Language } from '../types/lab';

interface DoctorHandoffCardProps {
  report: AnalyzedLabReport;
  language: Language;
  patientNotes: string;
  onChangePatientNotes: (notes: string) => void;
  handoffStatus: HandoffStatus;
  onSendToDoctor: () => void;
  onOpenDoctorPortal: () => void;
  isSignedIn: boolean;
  currentUserUid?: string;
  doctorDirectory: DoctorProfile[];
  selectedDoctorUid: string;
  onChangeSelectedDoctorUid: (uid: string) => void;
}

const STEPS: Array<{ key: HandoffStatus; label: string }> = [
  { key: 'sent', label: 'Report Sent' },
  { key: 'under_review', label: 'Under External Doctor Review' },
  { key: 'completed', label: 'Doctor Notes Received' },
];

function getStepIndex(status: HandoffStatus): number {
  if (status === 'sent') return 0;
  if (status === 'under_review') return 1;
  if (status === 'completed') return 2;
  return -1;
}

export const DoctorHandoffCard: React.FC<DoctorHandoffCardProps> = ({
  report,
  language,
  patientNotes,
  onChangePatientNotes,
  handoffStatus,
  onSendToDoctor,
  onOpenDoctorPortal,
  isSignedIn,
  currentUserUid,
  doctorDirectory,
  selectedDoctorUid,
  onChangeSelectedDoctorUid,
}) => {
  const activeStep = getStepIndex(handoffStatus);
  const rationale =
    report.specialistRationale[language] || report.specialistRationale.en;

  const externalDoctors = doctorDirectory.filter((d) => d.uid !== currentUserUid);
  const selfDoctor = doctorDirectory.find((d) => d.uid === currentUserUid);

  return (
    <section
      aria-label="Get Reviewed by an External Doctor"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900">
            Get Reviewed by an External Doctor
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Send this structured summary and your symptom notes to a verified physician in the Doctor Portal for clinical feedback.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-900 shrink-0 self-start">
          <Stethoscope className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
          <span>Suggested: {report.recommendedSpecialist}</span>
        </div>
      </div>

      {/* Specialist Rationale */}
      <p className="text-sm leading-relaxed text-slate-700 bg-slate-50 border border-slate-200/80 rounded-lg p-3.5">
        <span className="font-semibold text-slate-900">Why this specialist: </span>
        {rationale}
      </p>

      {/* Reviewing Clinician Selector (when signed in) */}
      {isSignedIn && (
        <div>
          <label
            htmlFor="select-reviewing-doctor"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Route to Reviewing Physician
          </label>
          <select
            id="select-reviewing-doctor"
            value={selectedDoctorUid}
            onChange={(e) => onChangeSelectedDoctorUid(e.target.value)}
            disabled={handoffStatus !== 'idle'}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-teal-600 focus:outline-none disabled:opacity-70"
          >
            <option value={currentUserUid || ''}>
              {selfDoctor
                ? `${selfDoctor.doctorName} · ${selfDoctor.specialty} (My Doctor Account)`
                : 'My Doctor Sign-In Portal Queue (Demo / Self-Review)'}
            </option>
            {externalDoctors.map((doc) => (
              <option key={doc.uid} value={doc.uid}>
                {doc.doctorName} · {doc.specialty} ({doc.clinicName})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Optional Patient Notes */}
      <div>
        <label
          htmlFor="patient-symptom-notes"
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          Optional Symptom &amp; Context Notes for Doctor
        </label>
        <textarea
          id="patient-symptom-notes"
          rows={3}
          value={patientNotes}
          onChange={(e) => onChangePatientNotes(e.target.value)}
          disabled={handoffStatus !== 'idle'}
          placeholder="Add any symptoms, recent medications, allergies, or specific questions you want the reviewing doctor to see..."
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 focus:outline-none disabled:opacity-70"
        />
      </div>

      {/* Action & Live Status Tracker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSendToDoctor}
            disabled={handoffStatus !== 'idle'}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>
              {handoffStatus === 'idle'
                ? 'Send Report to External Doctor'
                : 'Report Submitted to Portal'}
            </span>
          </button>

          {handoffStatus !== 'idle' && handoffStatus !== 'completed' && (
            <button
              type="button"
              onClick={onOpenDoctorPortal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-teal-800 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Open Doctor Portal</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* 3-Step Live Handoff Status Tracker */}
      <div
        aria-label="External Doctor Review Status Tracker"
        className="pt-4 border-t border-slate-100"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STEPS.map((step, index) => {
            const isCompleted = activeStep > index || (activeStep === 2 && index === 2);
            const isCurrent = activeStep === index && handoffStatus !== 'completed';
            return (
              <div
                key={step.key}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : isCurrent
                    ? 'bg-teal-50 border-teal-300 text-teal-900'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                ) : isCurrent ? (
                  <Clock className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-300 text-[10px] flex items-center justify-center shrink-0 tabular-nums">
                    {index + 1}
                  </span>
                )}
                <span className="truncate">{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
