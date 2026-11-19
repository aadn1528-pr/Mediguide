import React from 'react';
import { BadgeCheck, CalendarClock, Stethoscope } from 'lucide-react';
import { DoctorResponse } from '../types/lab';

interface VerifiedDoctorBannerProps {
  response: DoctorResponse;
}

export const VerifiedDoctorBanner: React.FC<VerifiedDoctorBannerProps> = ({
  response,
}) => {
  return (
    <section
      aria-label="Verified External Doctor's Note"
      className="bg-teal-50/80 border border-teal-300 rounded-xl p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-teal-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
            <BadgeCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-teal-950">
              Verified External Doctor&apos;s Note
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-teal-800">
              <span className="font-semibold">{response.doctorName}</span>
              <span aria-hidden="true">·</span>
              <span>{response.specialty}</span>
              <span aria-hidden="true">·</span>
              <span>Reviewed {response.respondedAt}</span>
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-teal-200 text-xs font-semibold text-teal-800 whitespace-nowrap shrink-0 self-start sm:self-center">
          <CalendarClock className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>Follow-up: {response.followUpTimeframe}</span>
        </div>
      </div>

      <div className="pt-3.5 flex items-start gap-3">
        <Stethoscope className="w-4 h-4 text-teal-700 shrink-0 mt-1" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-line">
          {response.clinicalNote}
        </p>
      </div>
    </section>
  );
};
