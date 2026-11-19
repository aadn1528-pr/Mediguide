import React from 'react';
import { ShieldCheck, User as UserIcon, Stethoscope, Microscope, LogIn, LogOut } from 'lucide-react';
import type { User } from 'firebase/auth';
import { DemoView, HandoffStatus } from '../types/lab';

interface TopNavProps {
  demoView: DemoView;
  onChangeDemoView: (view: DemoView) => void;
  handoffStatus: HandoffStatus;
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  isRegisteredDoctor: boolean;
  doctorPendingCount: number;
  hasLinkedLab?: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const TopNav: React.FC<TopNavProps> = ({
  demoView,
  onChangeDemoView,
  handoffStatus,
  user,
  authReady,
  isSigningIn,
  isRegisteredDoctor,
  doctorPendingCount,
  hasLinkedLab = false,
  onSignIn,
  onSignOut,
}) => {
  const showDoctorBadge =
    demoView !== 'doctor' &&
    (doctorPendingCount > 0 || handoffStatus === 'sent' || handoffStatus === 'under_review');

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: MediGuide AI Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v18" />
              <path d="M3 12h4l2.5-4.5L13 16l2.5-4H21" />
            </svg>
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            MediGuide AI
          </span>
        </div>

        {/* Center: Educational Disclaimer Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0">
          <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
          <span>AI Report Explainer — Not a Medical Diagnosis</span>
        </div>

        {/* Right: Portal Switch & Account */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            role="tablist"
            aria-label="Portal View Switcher"
            className="inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={demoView === 'patient'}
              onClick={() => onChangeDemoView('patient')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600 ${
                demoView === 'patient'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Patient</span>
              {handoffStatus === 'completed' && demoView !== 'patient' && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded">
                  Note Ready
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={demoView === 'laboratory'}
              onClick={() => onChangeDemoView('laboratory')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600 ${
                demoView === 'laboratory'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Microscope className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Nearby Labs</span>
              <span className="sm:hidden">Labs</span>
              {hasLinkedLab && (
                <span className="ml-0.5 px-1 py-0.2 rounded-full bg-emerald-300 text-emerald-950 text-[9px] font-bold">
                  Linked
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={demoView === 'doctor'}
              onClick={() => onChangeDemoView('doctor')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600 ${
                demoView === 'doctor'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isRegisteredDoctor ? 'Doctor Portal (Verified)' : 'Doctor Sign-In Portal'}
              </span>
              <span className="sm:hidden">Doctor</span>
              {showDoctorBadge && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded tabular-nums">
                  {doctorPendingCount > 0 ? `${doctorPendingCount} Pending` : 'Pending'}
                </span>
              )}
            </button>
          </div>

          {authReady && (
            user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Account'}
                    className="w-7 h-7 rounded-full border border-slate-200 object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center shrink-0">
                    {(user.displayName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  title={`Signed in as ${user.displayName || user.email || 'Patient'} — Sign out`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void onSignIn()}
                disabled={isSigningIn}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-xs font-semibold text-teal-900 hover:bg-teal-100/70 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>{isSigningIn ? 'Signing in...' : 'Sign In'}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Mobile Disclaimer Row */}
      <div className="lg:hidden px-4 py-1.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-600">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
        <span>AI Report Explainer — Not a Medical Diagnosis</span>
      </div>
    </header>
  );
};
