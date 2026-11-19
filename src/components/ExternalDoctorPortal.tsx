import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Inbox,
  Loader2,
  LogIn,
  LogOut,
  Microscope,
  Pencil,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import {
  AnalyzedLabReport,
  ClinicalHandoffRecord,
  DoctorProfile,
  DoctorResponse,
  HandoffStatus,
} from '../types/lab';

interface ExternalDoctorPortalProps {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  doctorProfile: DoctorProfile | null;
  doctorProfileLoading: boolean;
  onRegisterOrUpdateDoctor: (input: {
    doctorName: string;
    specialty: string;
    clinicName: string;
    licenseNumber: string;
    acceptingCases: boolean;
  }) => Promise<void>;
  doctorQueueHandoffs: ClinicalHandoffRecord[];
  activePatientReport: AnalyzedLabReport;
  activePatientNotes: string;
  activeHandoffStatus: HandoffStatus;
  onPublishDoctorResponse: (handoffId: string, response: DoctorResponse) => Promise<void>;
  onClaimHandoffForReview: (handoffId: string) => Promise<void>;
  onPullActiveReportToMyQueue: () => Promise<string | null>;
  onReturnToPatientView: () => void;
}

function buildRealisticDoctorNote(
  title: string,
  recommendedSpecialist: string,
  numericMarkers: AnalyzedLabReport['numericMarkers'],
  cultureFindings: AnalyzedLabReport['cultureFindings'],
  patientNotes: string,
  profile: DoctorProfile
): {
  followUpTimeframe: string;
  clinicalNote: string;
} {
  const flagged = numericMarkers.filter((m) => m.status !== 'normal');
  const cultures = cultureFindings.filter((c) => c.isGrowthDetected);

  let followUpTimeframe = 'Within 1–2 weeks';
  let lines: string[] = [];

  if (cultures.length > 0) {
    const culture = cultures[0];
    const susceptibleList = culture.antibiotics
      .filter((a) => a.interpretation === 'Susceptible')
      .map((a) => a.antibiotic)
      .slice(0, 3)
      .join(', ');
    const resistantList = culture.antibiotics
      .filter((a) => a.interpretation === 'Resistant')
      .map((a) => a.antibiotic)
      .join(', ');

    followUpTimeframe = 'Urgent (Today / Same-Day Evaluation)';
    lines = [
      `Clinical Review (${profile.clinicName}): Blood culture grew ${culture.organismDetected} (${culture.incubationTime}) alongside elevated inflammatory markers (${flagged.map((f) => `${f.name} ${f.value} ${f.unit}`).join(', ')}).`,
      `Culture Susceptibility Note: Isolate is susceptible in vitro to ${susceptibleList || 'tested first-line agents'}${resistantList ? ` and resistant to ${resistantList}` : ''}.`,
      `Recommended Next Steps: Please present for an urgent in-person clinical evaluation, vital signs check, and allergy/renal review so targeted antimicrobial therapy and repeat blood cultures can be initiated safely.`,
    ];
  } else if (
    title.toLowerCase().includes('diabetes') ||
    flagged.some((m) => m.category === 'Blood Sugar & Diabetes')
  ) {
    followUpTimeframe = 'In 2 weeks (Repeat labs in 12 weeks)';
    lines = [
      `Clinical Review (${profile.clinicName}): Reviewed flagged metabolic markers (${flagged.map((f) => `${f.name}: ${f.value} ${f.unit}`).join('; ')}).`,
      `Assessment: Results show mild-to-moderate cardiometabolic risk that warrants confirmatory clinical assessment, blood pressure check, and evaluation of cardiovascular risk profile.`,
      `Care Plan to Discuss: Focus on structured daily walking (30 min/day), high-fiber balanced meals with reduced refined carbohydrates, and an in-person consultation to determine whether confirmatory testing or medical therapy is appropriate.`,
    ];
  } else if (
    title.toLowerCase().includes('cbc') ||
    flagged.some((m) => m.category === 'Blood Cells')
  ) {
    followUpTimeframe = 'Within 1 week';
    lines = [
      `Clinical Review (${profile.clinicName}): Noted hematology pattern (${flagged.map((f) => `${f.name}: ${f.value} ${f.unit}`).join(', ')}) with reviewed baseline counts.`,
      `Recommended Confirmatory Labs: Order Serum Ferritin, Iron/TIBC, and Peripheral Smear prior to starting targeted supplementation so the underlying cause is clearly documented.`,
      `Interim Advice: Report any dizziness, shortness of breath, or worsening fatigue promptly during your clinic visit.`,
    ];
  } else {
    followUpTimeframe = 'In 2–4 weeks';
    const summaryStr =
      flagged.length > 0
        ? flagged.map((f) => `${f.name} (${f.value} ${f.unit})`).join(', ')
        : 'No acute abnormalities noted';
    lines = [
      `Clinical Review (${profile.clinicName} · ${recommendedSpecialist} Triage): Evaluated flagged panel findings (${summaryStr}).`,
      `Recommended Next Steps: Discuss targeted micronutrient repletion or repeat preventive labs at your upcoming clinic visit.`,
    ];
  }

  if (patientNotes.trim()) {
    lines.push(
      `Acknowledged Patient Note: "${patientNotes.trim()}" — we will address these symptoms directly during your consultation.`
    );
  }

  return {
    followUpTimeframe,
    clinicalNote: lines.join('\n\n'),
  };
}

export const ExternalDoctorPortal: React.FC<ExternalDoctorPortalProps> = ({
  user,
  authReady,
  isSigningIn,
  authError,
  onSignIn,
  onSignOut,
  doctorProfile,
  doctorProfileLoading,
  onRegisterOrUpdateDoctor,
  doctorQueueHandoffs,
  activePatientReport,
  onPublishDoctorResponse,
  onClaimHandoffForReview,
  onPullActiveReportToMyQueue,
  onReturnToPatientView,
}) => {
  const [selectedHandoffId, setSelectedHandoffId] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Clinician registration / edit form state
  const [regName, setRegName] = useState('');
  const [regSpecialty, setRegSpecialty] = useState('Internal Medicine & Diagnostics');
  const [regClinic, setRegClinic] = useState('MediGuide Partner Clinic');
  const [regLicense, setRegLicense] = useState('');
  const [regAccepting, setRegAccepting] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Clinician response composer state
  const [followUpTimeframe, setFollowUpTimeframe] = useState('Within 1–2 weeks');
  const [clinicalNote, setClinicalNote] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [showNormalMarkers, setShowNormalMarkers] = useState(false);

  useEffect(() => {
    if (doctorProfile) {
      setRegName(doctorProfile.doctorName);
      setRegSpecialty(doctorProfile.specialty);
      setRegClinic(doctorProfile.clinicName);
      setRegLicense(doctorProfile.licenseNumber || '');
      setRegAccepting(doctorProfile.acceptingCases);
    } else if (user) {
      setRegName(
        user.displayName ? `Dr. ${user.displayName.replace(/^Dr\.?\s*/i, '')}` : 'Dr. Priya Nair, MD'
      );
    }
  }, [doctorProfile, user]);

  // Select the newest pending case automatically when queue changes
  useEffect(() => {
    if (doctorQueueHandoffs.length === 0) {
      setSelectedHandoffId(null);
      return;
    }
    const stillExists = doctorQueueHandoffs.some((h) => h.id === selectedHandoffId);
    if (!selectedHandoffId || !stillExists) {
      const pending = doctorQueueHandoffs.find((h) => h.handoffStatus !== 'completed');
      setSelectedHandoffId((pending || doctorQueueHandoffs[0]).id);
    }
  }, [doctorQueueHandoffs, selectedHandoffId]);

  const selectedCase =
    doctorQueueHandoffs.find((h) => h.id === selectedHandoffId) || null;

  useEffect(() => {
    if (selectedCase?.doctorResponse) {
      setFollowUpTimeframe(selectedCase.doctorResponse.followUpTimeframe);
      setClinicalNote(selectedCase.doctorResponse.clinicalNote);
    } else {
      setFollowUpTimeframe('Within 1–2 weeks');
      setClinicalNote('');
    }
  }, [selectedCase?.id, selectedCase?.doctorResponse]);

  const handleSaveDoctorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regSpecialty.trim() || !regClinic.trim() || !regLicense.trim()) {
      return;
    }
    setIsSavingProfile(true);
    try {
      await onRegisterOrUpdateDoctor({
        doctorName: regName,
        specialty: regSpecialty,
        clinicName: regClinic,
        licenseNumber: regLicense,
        acceptingCases: regAccepting,
      });
      setIsEditingProfile(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleFillSampleDoctor = () => {
    setRegName(
      user?.displayName
        ? `Dr. ${user.displayName.replace(/^Dr\.?\s*/i, '')}, MD`
        : 'Dr. Priya Nair, MD'
    );
    setRegSpecialty('Internal Medicine & Endocrinology');
    setRegClinic('Apex Care Medical Center');
    setRegLicense('MC-IND-48291');
    setRegAccepting(true);
  };

  const handleAutoFillNote = () => {
    if (!selectedCase || !doctorProfile) return;
    const generated = buildRealisticDoctorNote(
      selectedCase.title,
      selectedCase.recommendedSpecialist,
      selectedCase.numericMarkers,
      selectedCase.cultureFindings,
      selectedCase.patientNotes,
      doctorProfile
    );
    setFollowUpTimeframe(generated.followUpTimeframe);
    setClinicalNote(generated.clinicalNote);
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !doctorProfile || !clinicalNote.trim() || isSubmittingResponse) {
      return;
    }
    setIsSubmittingResponse(true);
    try {
      await onPublishDoctorResponse(selectedCase.id, {
        doctorName: doctorProfile.doctorName,
        specialty: doctorProfile.specialty,
        followUpTimeframe: followUpTimeframe.trim() || 'Within 1–2 weeks',
        clinicalNote: clinicalNote.trim(),
        respondedAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  // --- Gate 1: Loading auth ---
  if (!authReady) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-teal-700" aria-hidden="true" />
        <span>Verifying clinician portal session...</span>
      </div>
    );
  }

  // --- Gate 2: Doctor Sign-In Screen ---
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [accessCodeError, setAccessCodeError] = useState<string | null>(null);
  const AUTHORIZED_DOCTOR_ACCESS_CODE = 'MG-DOC-8899'; // Configurable clinician access code

  if (!user) {
    const handleSignInWithCode = async (e: React.FormEvent) => {
      e.preventDefault();
      setAccessCodeError(null);
      if (accessCodeInput.trim() !== AUTHORIZED_DOCTOR_ACCESS_CODE) {
        setAccessCodeError('Invalid clinician access code. Please contact the MediGuide administration team for your assigned code.');
        return;
      }
      await onSignIn();
    };

    return (
      <div className="max-w-xl mx-auto py-8">
        <form
          onSubmit={handleSignInWithCode}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Stethoscope className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-[11px] font-semibold text-teal-900 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Authorized Clinician Access Portal</span>
              </span>
              <h1 className="font-display text-xl font-bold text-slate-900">
                Doctor Sign-In &amp; Access Code Verification
              </h1>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                To access the clinical review portal, enter your authorized clinician access code and sign in with your verified Google account.
              </p>
            </div>
          </div>

          <div className="space-y-4 bg-slate-50 border border-slate-200/80 rounded-lg p-4">
            <div>
              <label
                htmlFor="doctor-access-code"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Authorized Doctor Access Code
              </label>
              <input
                id="doctor-access-code"
                type="password"
                required
                value={accessCodeInput}
                onChange={(e) => setAccessCodeInput(e.target.value)}
                placeholder="Enter clinician access code (e.g. MG-DOC-8899)"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-teal-600 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Demo access code for testing: <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">MG-DOC-8899</code>
              </p>
            </div>

            {accessCodeError && (
              <div
                role="alert"
                className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800"
              >
                {accessCodeError}
              </div>
            )}
          </div>

          {authError && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800"
            >
              {authError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isSigningIn}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isSigningIn ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{isSigningIn ? 'Verifying & signing in...' : 'Verify Code & Sign In with Google'}</span>
            </button>

            <button
              type="button"
              onClick={onReturnToPatientView}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Return to Patient View</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- Gate 3: Loading Doctor Profile ---
  if (doctorProfileLoading) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-teal-700" aria-hidden="true" />
        <span>Loading clinician profile...</span>
      </div>
    );
  }

  // --- Gate 4: Doctor Credential Onboarding / Edit Form ---
  if (!doctorProfile || isEditingProfile) {
    return (
      <div className="max-w-xl mx-auto py-6">
        <form
          onSubmit={handleSaveDoctorProfile}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7 space-y-5"
        >
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-[11px] font-semibold text-teal-900 mb-2">
                <BadgeCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Signed in as {user.email}</span>
              </div>
              <h1 className="font-display text-xl font-bold text-slate-900">
                {doctorProfile ? 'Update Clinician Credentials' : 'Complete Clinician Registration'}
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Register your physician details to appear in the patient handoff directory and review incoming lab cases.
              </p>
            </div>

            {!doctorProfile && (
              <button
                type="button"
                onClick={handleFillSampleDoctor}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Fill Sample</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-doc-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Physician Full Name &amp; Title
              </label>
              <input
                id="reg-doc-name"
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Dr. Priya Nair, MD"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-doc-specialty" className="block text-xs font-semibold text-slate-700 mb-1">
                Medical Specialty
              </label>
              <input
                id="reg-doc-specialty"
                type="text"
                required
                value={regSpecialty}
                onChange={(e) => setRegSpecialty(e.target.value)}
                placeholder="Endocrinology / Internal Medicine"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-doc-clinic" className="block text-xs font-semibold text-slate-700 mb-1">
                Clinic / Hospital Affiliation
              </label>
              <input
                id="reg-doc-clinic"
                type="text"
                required
                value={regClinic}
                onChange={(e) => setRegClinic(e.target.value)}
                placeholder="Apex Care Medical Center"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-doc-license" className="block text-xs font-semibold text-slate-700 mb-1">
                Medical License ID (Private)
              </label>
              <input
                id="reg-doc-license"
                type="text"
                required
                minLength={2}
                value={regLicense}
                onChange={(e) => setRegLicense(e.target.value)}
                placeholder="MC-IND-48291"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-mono text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={regAccepting}
              onChange={(e) => setRegAccepting(e.target.checked)}
              className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            />
            <span>List my profile in the patient directory as accepting external lab reviews</span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              {doctorProfile && (
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={onReturnToPatientView}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Back to Patient View
              </button>
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isSavingProfile && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>{doctorProfile ? 'Save Changes' : 'Activate Doctor Portal'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- Gate 5: Active Clinician Workspace ---
  const pendingCount = doctorQueueHandoffs.filter((h) => h.handoffStatus !== 'completed').length;
  const abnormalMarkers = selectedCase
    ? selectedCase.numericMarkers.filter((m) => m.status !== 'normal')
    : [];
  const normalMarkers = selectedCase
    ? selectedCase.numericMarkers.filter((m) => m.status === 'normal')
    : [];
  const isSelectedCompleted = selectedCase?.handoffStatus === 'completed';

  return (
    <div className="space-y-6">
      {/* Clinician Identity & Workspace Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-900">
                <BadgeCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Verified Clinician Portal</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                <Building2 className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>{doctorProfile.clinicName}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                <span>{pendingCount} Pending Cases</span>
              </span>
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900 pt-1">
              {doctorProfile.doctorName} · {doctorProfile.specialty}
            </h1>
            <p className="text-xs text-slate-500">
              Signed in as {user.email} · {doctorProfile.acceptingCases ? 'Accepting external reviews' : 'Not listed in public directory'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsEditingProfile(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Edit Credentials</span>
            </button>
            <button
              type="button"
              onClick={onReturnToPatientView}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Patient View</span>
            </button>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </section>

      {/* Incoming Handoff Queue Selector */}
      <section
        aria-label="Incoming Review Queue"
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">
              Assigned Clinical Review Queue ({doctorQueueHandoffs.length})
            </h2>
            <p className="text-xs text-slate-500">
              Cases routed to your clinician account from MediGuide patients
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onPullActiveReportToMyQueue()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-900 hover:bg-teal-100/70 transition-colors cursor-pointer"
          >
            <Inbox className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Pull Active Report ({activePatientReport.title}) to Queue</span>
          </button>
        </div>

        {doctorQueueHandoffs.length === 0 ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-6 text-center space-y-2">
            <Inbox className="w-6 h-6 text-teal-700 mx-auto" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-900">Your review queue is clear</p>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Patients can assign reports directly to you from the Patient Portal, or click &ldquo;Pull Active Report to Queue&rdquo; above to review the active report now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {doctorQueueHandoffs.map((item) => {
              const isSelected = item.id === selectedCase?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedHandoffId(item.id)}
                  className={`text-left rounded-lg border p-3.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-teal-50/70 border-teal-600'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {item.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        item.handoffStatus === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.handoffStatus === 'under_review'
                          ? 'bg-teal-100 text-teal-900'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.handoffStatus === 'completed'
                        ? 'Completed'
                        : item.handoffStatus === 'under_review'
                        ? 'Under Review'
                        : 'New Case'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                    <span>{item.patientLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.reportDate}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        item.priority === 'Prompt Doctor Review'
                          ? 'text-red-700 font-semibold'
                          : 'text-slate-600'
                      }
                    >
                      {item.priority}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Selected Case Rapid Triage & Response Composer */}
      {selectedCase && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Abnormal Labs, Culture Findings & Patient Notes */}
          <div className="lg:col-span-7 space-y-5">
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Case: {selectedCase.title}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedCase.patientLabel} · {selectedCase.reportDate} · Triaged for {selectedCase.recommendedSpecialist}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCase.attachment && (
                    <a
                      href={selectedCase.attachment.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-teal-800 hover:bg-teal-50/70 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Original File: {selectedCase.attachment.fileName}</span>
                    </a>
                  )}
                  {selectedCase.handoffStatus === 'sent' && (
                    <button
                      type="button"
                      onClick={() => void onClaimHandoffForReview(selectedCase.id)}
                      className="px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-900 hover:bg-teal-100 transition-colors cursor-pointer"
                    >
                      Mark Under Review
                    </button>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-700 mb-1.5">
                  Patient Symptom &amp; Context Notes
                </div>
                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 leading-relaxed">
                  {selectedCase.patientNotes.trim()
                    ? selectedCase.patientNotes
                    : 'No additional symptom notes entered by patient.'}
                </p>
              </div>
            </section>

            {/* Flagged Numeric Values */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Flagged &amp; Abnormal Lab Values ({abnormalMarkers.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Filtered automatically for rapid clinical triage
                  </p>
                </div>
                {normalMarkers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNormalMarkers((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {showNormalMarkers
                        ? 'Hide Normal Markers'
                        : `Show Normal (${normalMarkers.length})`}
                    </span>
                  </button>
                )}
              </div>

              {abnormalMarkers.length === 0 ? (
                <div className="p-5 text-sm text-emerald-800 bg-emerald-50/50">
                  No abnormal numeric markers flagged in this panel.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-2.5 px-4">Test / Category</th>
                        <th className="py-2.5 px-4 text-right">Patient Value</th>
                        <th className="py-2.5 px-4 text-right">Reference</th>
                        <th className="py-2.5 px-4 text-right">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {abnormalMarkers.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{m.name}</div>
                            <div className="text-xs text-slate-500">{m.category}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                            {m.value}{' '}
                            <span className="text-xs font-normal text-slate-500">
                              {m.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                            {m.referenceRangeText}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap ${
                                m.status === 'out_of_range'
                                  ? 'bg-red-50 border-red-200 text-red-800'
                                  : 'bg-amber-50 border-amber-200 text-amber-800'
                              }`}
                            >
                              {m.status === 'out_of_range' ? (
                                <AlertCircle className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                              )}
                              <span>
                                {m.status === 'out_of_range' ? 'Out of Range' : 'Borderline'}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showNormalMarkers && normalMarkers.length > 0 && (
                <div className="border-t border-slate-200 bg-slate-50/50 p-4">
                  <div className="text-xs font-semibold text-slate-500 mb-2">
                    Normal Baseline Markers
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {normalMarkers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-3 py-2 text-xs"
                      >
                        <span className="text-slate-700 font-medium truncate pr-2">
                          {m.name}
                        </span>
                        <span className="font-mono tabular-nums text-emerald-700 font-semibold shrink-0">
                          {m.value} {m.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Culture Findings */}
            {selectedCase.cultureFindings.length > 0 && (
              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Microscope className="w-4 h-4 text-teal-700" aria-hidden="true" />
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Microbiology &amp; Culture Findings
                  </h2>
                </div>

                {selectedCase.cultureFindings.map((c) => (
                  <div key={c.id} className="space-y-3">
                    <div className="rounded-lg bg-red-50/70 border border-red-200 p-3.5">
                      <div className="text-xs text-slate-600">
                        {c.specimenType} · {c.incubationTime}
                      </div>
                      <div className="font-display text-sm font-bold text-red-900 mt-0.5">
                        Organism: {c.organismDetected}
                      </div>
                    </div>

                    {c.antibiotics.length > 0 && (
                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                              <th className="py-2 px-3">Agent</th>
                              <th className="py-2 px-3 text-right">MIC / Zone</th>
                              <th className="py-2 px-3 text-right">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {c.antibiotics.map((abx) => (
                              <tr key={abx.antibiotic}>
                                <td className="py-2 px-3 font-medium text-slate-900">
                                  {abx.antibiotic}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                                  {abx.micOrZone}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold">
                                  <span
                                    className={
                                      abx.interpretation === 'Susceptible'
                                        ? 'text-emerald-700'
                                        : abx.interpretation === 'Intermediate'
                                        ? 'text-amber-700'
                                        : 'text-red-700'
                                    }
                                  >
                                    {abx.interpretation}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>

          {/* Right: Clinician Response Composer */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleSubmitResponse}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 lg:sticky lg:top-20"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Clinician Review Response
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Signed by {doctorProfile.doctorName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAutoFillNote}
                  disabled={isSelectedCompleted}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-200/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Auto-Fill Note</span>
                </button>
              </div>

              <div>
                <label
                  htmlFor="doc-timeframe"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Recommended Follow-Up Timeframe
                </label>
                <input
                  id="doc-timeframe"
                  type="text"
                  disabled={isSelectedCompleted}
                  value={followUpTimeframe}
                  onChange={(e) => setFollowUpTimeframe(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none disabled:opacity-70"
                />
              </div>

              <div>
                <label
                  htmlFor="doc-note"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Clinical Assessment &amp; Next Steps
                </label>
                <textarea
                  id="doc-note"
                  rows={8}
                  disabled={isSelectedCompleted}
                  value={clinicalNote}
                  onChange={(e) => setClinicalNote(e.target.value)}
                  placeholder="Write clinical observations, confirmatory lab recommendations, and follow-up plan..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 focus:outline-none leading-relaxed disabled:opacity-70"
                />
              </div>

              <button
                type="submit"
                disabled={!clinicalNote.trim() || isSelectedCompleted || isSubmittingResponse}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isSubmittingResponse ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="w-4 h-4" aria-hidden="true" />
                )}
                <span>
                  {isSelectedCompleted
                    ? 'Verified Clinical Response Published'
                    : isSubmittingResponse
                    ? 'Publishing...'
                    : 'Publish Verified Doctor Response'}
                </span>
              </button>

              {isSelectedCompleted && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-emerald-900">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>Response published to Patient Portal.</span>
                  </span>
                  <button
                    type="button"
                    onClick={onReturnToPatientView}
                    className="font-semibold underline underline-offset-2 hover:text-emerald-950 cursor-pointer shrink-0"
                  >
                    View Patient Banner
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
