/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Droplets,
  HeartPulse,
  Inbox,
  MapPin,
  Microscope,
  ShieldPlus,
} from 'lucide-react';
import { SAMPLE_REPORTS, SamplePresetMeta } from './data/sampleReports';
import {
  AnalyzedLabReport,
  ChatMessage,
  DemoView,
  DoctorResponse,
  HandoffStatus,
  LabCategory,
  Language,
  SavedReportRecord,
} from './types/lab';
import { useFirebase } from './context/FirebaseContext';
import { TopNav } from './components/TopNav';
import { ReportInputBar } from './components/ReportInputBar';
import { SavedReportsBar } from './components/SavedReportsBar';
import { VerifiedDoctorBanner } from './components/VerifiedDoctorBanner';
import { BigPictureSummary } from './components/BigPictureSummary';
import { NumericMarkerCard } from './components/NumericMarkerCard';
import { CulturePathogenCard } from './components/CulturePathogenCard';
import { DoctorHandoffCard } from './components/DoctorHandoffCard';
import { AiCareSidebar } from './components/AiCareSidebar';
import { ExternalDoctorPortal } from './components/ExternalDoctorPortal';
import {
  NearbyLaboratoryPortal,
  TransmittedLabReportRecord,
} from './components/NearbyLaboratoryPortal';
import type { NearbyLaboratory } from './lib/mapsConfig';

const CATEGORY_ORDER: LabCategory[] = [
  'Microbiology / Bacteria Culture',
  'Blood Sugar & Diabetes',
  'Heart & Cholesterol',
  'Blood Cells',
  'Organ & Vitamin Health',
];

function getCategoryIcon(category: LabCategory) {
  switch (category) {
    case 'Blood Sugar & Diabetes':
      return <Activity className="w-4 h-4 text-teal-700" aria-hidden="true" />;
    case 'Heart & Cholesterol':
      return <HeartPulse className="w-4 h-4 text-teal-700" aria-hidden="true" />;
    case 'Blood Cells':
      return <Droplets className="w-4 h-4 text-teal-700" aria-hidden="true" />;
    case 'Microbiology / Bacteria Culture':
      return <Microscope className="w-4 h-4 text-teal-700" aria-hidden="true" />;
    case 'Organ & Vitamin Health':
      return <ShieldPlus className="w-4 h-4 text-teal-700" aria-hidden="true" />;
  }
}

function createWelcomeMessage(report: AnalyzedLabReport): ChatMessage {
  const flaggedCount =
    report.numericMarkers.filter((m) => m.status !== 'normal').length +
    report.cultureFindings.filter((c) => c.status !== 'normal').length;

  return {
    id: `welcome-${report.id}`,
    role: 'assistant',
    content: `I've reviewed your ${report.title} (${report.numericMarkers.length} numeric markers${
      report.cultureFindings.length > 0 ? ' and culture results' : ''
    }, with ${flaggedCount} flagged). Ask me to explain any number in simple words, suggest daily habits to discuss, or prepare questions for your doctor.`,
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export default function App() {
  const initialPreset = SAMPLE_REPORTS[0];

  const [demoView, setDemoView] = useState<DemoView>('patient');
  const [language, setLanguage] = useState<Language>('en');
  const [activeReport, setActiveReport] = useState<AnalyzedLabReport>(
    initialPreset.report
  );
  const [rawText, setRawText] = useState<string>(
    initialPreset.report.rawReportText
  );

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(initialPreset.report),
  ]);
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [patientNotes, setPatientNotes] = useState('');
  const [handoffStatus, setHandoffStatus] = useState<HandoffStatus>('idle');
  const [doctorResponse, setDoctorResponse] = useState<DoctorResponse | null>(
    null
  );

  const [linkedLab, setLinkedLab] = useState<NearbyLaboratory | null>(() => {
    try {
      const saved = localStorage.getItem('mediguide_linked_lab');
      return saved ? (JSON.parse(saved) as NearbyLaboratory) : null;
    } catch {
      return null;
    }
  });

  const handleLinkLab = (lab: NearbyLaboratory) => {
    setLinkedLab(lab);
    try {
      localStorage.setItem('mediguide_linked_lab', JSON.stringify(lab));
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleUnlinkLab = () => {
    setLinkedLab(null);
    try {
      localStorage.removeItem('mediguide_linked_lab');
    } catch {
      // Ignore localStorage errors
    }
  };

  const [transmittedReports, setTransmittedReports] = useState<TransmittedLabReportRecord[]>(() => {
    try {
      const saved = localStorage.getItem('mediguide_transmitted_reports');
      return saved ? (JSON.parse(saved) as TransmittedLabReportRecord[]) : [];
    } catch {
      return [];
    }
  });

  const handleTransmitNewReport = async (record: TransmittedLabReportRecord) => {
    setTransmittedReports((prev) => {
      const updated = [record, ...prev];
      try {
        localStorage.setItem('mediguide_transmitted_reports', JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });

    if (user) {
      void saveReport(record.report, createWelcomeMessage(record.report));
    }
  };

  const handleAccessReportFromLab = (report: AnalyzedLabReport) => {
    resetWorkflowForReport(report);
    setDemoView('patient');
  };

  const {
    user,
    authReady,
    authError,
    isSigningIn,
    savedReports,
    reportsLoading,
    activeSavedReportId,
    setActiveSavedReportId,
    savedMessages,
    doctorProfile,
    doctorProfileLoading,
    doctorDirectory,
    patientHandoffs,
    doctorQueueHandoffs,
    signIn,
    signOut,
    storageError,
    isUploadingFile,
    clearStorageError,
    saveReport,
    attachFileToSavedReport,
    deleteSavedReport,
    submitHandoff,
    advanceHandoffToReview,
    publishDoctorResponse,
    registerOrUpdateDoctorProfile,
    appendChatMessage,
    resetReportChat,
    syncLanguagePreference,
  } = useFirebase();

  const [isSavingReport, setIsSavingReport] = useState(false);
  const [selectedDoctorUid, setSelectedDoctorUid] = useState<string>('');

  useEffect(() => {
    if (user && !selectedDoctorUid) {
      setSelectedDoctorUid(user.uid);
    } else if (!user) {
      setSelectedDoctorUid('');
    }
  }, [user, selectedDoctorUid]);

  // Sync live Firestore messages when viewing a saved report
  useEffect(() => {
    if (user && activeSavedReportId && savedMessages.length > 0) {
      setChatMessages(savedMessages);
    }
  }, [user, activeSavedReportId, savedMessages]);

  // Sync live Firestore handoff status / doctor response from savedReports OR shared /handoffs
  useEffect(() => {
    if (!user || !activeSavedReportId) return;
    const matchReport = savedReports.find((r) => r.id === activeSavedReportId);
    const matchHandoff = patientHandoffs.find((h) => h.reportId === activeSavedReportId);

    if (matchHandoff) {
      setHandoffStatus(matchHandoff.handoffStatus);
      setDoctorResponse(matchHandoff.doctorResponse);
      setPatientNotes(matchHandoff.patientNotes);
    } else if (matchReport) {
      setHandoffStatus(matchReport.handoffStatus);
      setDoctorResponse(matchReport.doctorResponse);
      setPatientNotes(matchReport.patientNotes);
    }
  }, [user, activeSavedReportId, savedReports, patientHandoffs]);

  const resetWorkflowForReport = (nextReport: AnalyzedLabReport) => {
    setActiveSavedReportId(null);
    setActiveReport(nextReport);
    setRawText(nextReport.rawReportText);
    setChatMessages([createWelcomeMessage(nextReport)]);
    setChatError(null);
    setHandoffStatus('idle');
    setDoctorResponse(null);
    setPatientNotes('');
  };

  const handleLoadPreset = (preset: SamplePresetMeta) => {
    setAnalyzeError(null);
    resetWorkflowForReport(preset.report);
  };

  const handleSelectSavedReport = (record: SavedReportRecord) => {
    setAnalyzeError(null);
    setActiveSavedReportId(record.id);
    setActiveReport(record.report);
    setRawText(record.report.rawReportText);
    setPatientNotes(record.patientNotes);
    setHandoffStatus(record.handoffStatus);
    setDoctorResponse(record.doctorResponse);
    setChatError(null);
    setChatMessages([createWelcomeMessage(record.report)]);
  };

  const handleSaveCurrentReport = async () => {
    if (!user || isSavingReport) return;
    setIsSavingReport(true);
    try {
      const uniqueReport: AnalyzedLabReport = {
        ...activeReport,
        id: `${activeReport.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`,
      };
      const welcomeMsg = createWelcomeMessage(uniqueReport);
      const savedId = await saveReport(uniqueReport, welcomeMsg);
      if (savedId) {
        setActiveReport({ ...uniqueReport, id: savedId });
      }
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleAnalyze = async (payload: {
    text: string;
    file?: { data: string; mimeType: string; name: string };
  }): Promise<boolean> => {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch('/api/analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not analyze the lab report.');
      }

      const analyzed = data.report as AnalyzedLabReport;
      resetWorkflowForReport(analyzed);

      if (user) {
        const welcomeMsg = createWelcomeMessage(analyzed);
        await saveReport(analyzed, welcomeMsg, payload.file);
      }
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unable to analyze report.';
      setAnalyzeError(msg);
      return false;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendChatMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setIsChatSending(true);
    setChatError(null);

    if (user && activeSavedReportId) {
      void appendChatMessage(activeSavedReportId, userMsg);
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          report: activeReport,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI Care response failed.');
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setChatMessages((prev) => [...prev, assistantMsg]);

      if (user && activeSavedReportId) {
        void appendChatMessage(activeSavedReportId, assistantMsg);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Could not reach AI Care Guide.';
      setChatError(msg);
    } finally {
      setIsChatSending(false);
    }
  };

  const ensureSavedReportId = async (): Promise<string | null> => {
    if (!user) return null;
    if (activeSavedReportId) return activeSavedReportId;
    const uniqueReport: AnalyzedLabReport = {
      ...activeReport,
      id: `${activeReport.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`,
    };
    const savedId = await saveReport(uniqueReport, createWelcomeMessage(uniqueReport));
    if (savedId) {
      setActiveReport({ ...uniqueReport, id: savedId });
    }
    return savedId;
  };

  const handleSendToDoctor = async () => {
    setHandoffStatus('sent');
    if (user) {
      const targetId = await ensureSavedReportId();
      if (targetId) {
        const targetReport = { ...activeReport, id: targetId };
        const handoffId = await submitHandoff(
          targetReport,
          patientNotes,
          selectedDoctorUid || user.uid
        );
        window.setTimeout(() => {
          void advanceHandoffToReview(targetId, handoffId ?? undefined);
          setHandoffStatus((curr) => (curr === 'sent' ? 'under_review' : curr));
        }, 700);
        return;
      }
    }
    window.setTimeout(() => {
      setHandoffStatus((curr) => (curr === 'sent' ? 'under_review' : curr));
    }, 700);
  };

  const handlePullActiveReportToMyQueue = async (): Promise<string | null> => {
    if (!user) return null;
    const targetId = await ensureSavedReportId();
    if (!targetId) return null;
    const targetReport = { ...activeReport, id: targetId };
    const handoffId = await submitHandoff(targetReport, patientNotes, user.uid);
    if (handoffId) {
      await advanceHandoffToReview(targetId, handoffId);
    }
    setHandoffStatus('under_review');
    return handoffId;
  };

  const handlePublishDoctorResponse = async (
    handoffId: string,
    response: DoctorResponse
  ) => {
    await publishDoctorResponse(handoffId, response, activeSavedReportId ?? undefined);
    setDoctorResponse(response);
    setHandoffStatus('completed');
  };

  const handleChangeLanguage = (nextLang: Language) => {
    setLanguage(nextLang);
    if (user) {
      void syncLanguagePreference(nextLang);
    }
  };

  const groupedCategories = useMemo(() => {
    return CATEGORY_ORDER.map((category) => {
      const markers = activeReport.numericMarkers.filter(
        (m) => m.category === category
      );
      const cultures =
        category === 'Microbiology / Bacteria Culture'
          ? activeReport.cultureFindings
          : [];
      return { category, markers, cultures };
    }).filter((group) => group.markers.length > 0 || group.cultures.length > 0);
  }, [activeReport]);

  const doctorPendingCount = useMemo(
    () => doctorQueueHandoffs.filter((h) => h.handoffStatus !== 'completed').length,
    [doctorQueueHandoffs]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopNav
        demoView={demoView}
        onChangeDemoView={setDemoView}
        handoffStatus={handoffStatus}
        user={user}
        authReady={authReady}
        isSigningIn={isSigningIn}
        isRegisteredDoctor={Boolean(doctorProfile)}
        doctorPendingCount={doctorPendingCount}
        hasLinkedLab={Boolean(linkedLab)}
        onSignIn={signIn}
        onSignOut={signOut}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {demoView === 'patient' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left / Center Primary Lab Analyzer & Results Column */}
            <div className="lg:col-span-8 space-y-6">
              {/* Verified Doctor Note Banner (when doctor responds) */}
              {doctorResponse && (
                <VerifiedDoctorBanner response={doctorResponse} />
              )}

              {/* Universal Input & 4 Sample Preset Bar */}
              <ReportInputBar
                activePresetKey={activeReport.presetKey}
                rawText={rawText}
                onChangeRawText={setRawText}
                onLoadPreset={handleLoadPreset}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
                analyzeError={analyzeError}
              />

              {/* Persistent Cloud Lab History & File Storage */}
              <SavedReportsBar
                user={user}
                authReady={authReady}
                isSigningIn={isSigningIn}
                authError={authError}
                onSignIn={signIn}
                savedReports={savedReports}
                reportsLoading={reportsLoading}
                activeSavedReportId={activeSavedReportId}
                activeReport={activeReport}
                isSavingReport={isSavingReport}
                isUploadingFile={isUploadingFile}
                storageError={storageError}
                onClearStorageError={clearStorageError}
                onSaveCurrentReport={handleSaveCurrentReport}
                onSelectSavedReport={handleSelectSavedReport}
                onDeleteSavedReport={deleteSavedReport}
                onAttachFileToReport={attachFileToSavedReport}
              />

              {/* Plain-English Big Picture Summary + Language Switch */}
              {isAnalyzing ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 animate-pulse">
                  <div className="h-6 bg-slate-200 rounded w-1/2" />
                  <div className="h-4 bg-slate-100 rounded w-full" />
                  <div className="h-4 bg-slate-100 rounded w-5/6" />
                  <div className="h-4 bg-slate-100 rounded w-4/5" />
                </div>
              ) : (
                <>
                  <BigPictureSummary
                    report={activeReport}
                    language={language}
                    onChangeLanguage={handleChangeLanguage}
                  />

                  {/* Realtime Laboratory Link & Locator Bar */}
                  {linkedLab ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                          <Microscope className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                              Linked Diagnostic Partner
                            </span>
                            <span className="text-xs text-emerald-800 font-semibold tabular-nums">
                              {linkedLab.distanceKm} km away
                            </span>
                          </div>
                          <div className="text-sm font-bold text-slate-900 mt-0.5">{linkedLab.name}</div>
                          <div className="text-xs text-slate-600">
                            {linkedLab.address} · <span className={linkedLab.openNow ? 'text-emerald-700 font-medium' : 'text-slate-500'}>{linkedLab.openNow ? 'Open Now' : 'Closed'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setDemoView('laboratory')}
                          className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors cursor-pointer"
                        >
                          View Lab &amp; Requisitions
                        </button>
                        <button
                          type="button"
                          onClick={handleUnlinkLab}
                          className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-semibold text-emerald-900 hover:bg-emerald-100/50 cursor-pointer"
                        >
                          Unlink
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                          <Microscope className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-teal-900">
                            Link with a Realtime Certified Laboratory Near You
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Connect with nearby accredited pathology centers for confirmatory blood draws, repeat cultures, or home phlebotomy dispatch.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDemoView('laboratory')}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 transition-colors shrink-0 shadow-xs cursor-pointer w-full sm:w-auto"
                      >
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Find Nearby Laboratories</span>
                      </button>
                    </div>
                  )}

                  {/* Transmitted Reports from Linked Diagnostic Laboratory Notice */}
                  {transmittedReports.length > 0 && (
                    <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                          <Inbox className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-teal-900">
                            {transmittedReports.length} Official Digital Report{transmittedReports.length > 1 ? 's' : ''} Received from Laboratory
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Latest: {transmittedReports[0].labName} · Acc #{transmittedReports[0].accessionNumber}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDemoView('laboratory')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-800 text-white text-xs font-semibold hover:bg-teal-900 transition-colors shrink-0 cursor-pointer"
                      >
                        <span>Open Lab Inbox &amp; Access</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Dual-Mode Categorized Result Cards */}
                  <div className="space-y-6">
                    {groupedCategories.map((group) => (
                      <section
                        key={group.category}
                        aria-label={group.category}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(group.category)}
                            <h3 className="font-display text-base font-bold text-slate-900">
                              {group.category}
                            </h3>
                          </div>
                          <span className="text-xs font-medium text-slate-500 tabular-nums">
                            {group.markers.length + group.cultures.length}{' '}
                            {group.markers.length + group.cultures.length === 1
                              ? 'finding'
                              : 'findings'}
                          </span>
                        </div>

                        {group.cultures.length > 0 && (
                          <div className="space-y-4">
                            {group.cultures.map((culture) => (
                              <CulturePathogenCard
                                key={culture.id}
                                culture={culture}
                                language={language}
                              />
                            ))}
                          </div>
                        )}

                        {group.markers.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {group.markers.map((marker) => (
                              <NumericMarkerCard
                                key={marker.id}
                                marker={marker}
                                language={language}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    ))}
                  </div>

                  {/* External Doctor Review Handoff Card */}
                  <DoctorHandoffCard
                    report={activeReport}
                    language={language}
                    patientNotes={patientNotes}
                    onChangePatientNotes={setPatientNotes}
                    handoffStatus={handoffStatus}
                    onSendToDoctor={handleSendToDoctor}
                    onOpenDoctorPortal={() => setDemoView('doctor')}
                    isSignedIn={Boolean(user)}
                    currentUserUid={user?.uid}
                    doctorDirectory={doctorDirectory}
                    selectedDoctorUid={selectedDoctorUid || user?.uid || ''}
                    onChangeSelectedDoctorUid={setSelectedDoctorUid}
                  />
                </>
              )}
            </div>

            {/* Right Docked AI Care & Doctor Prep Guide */}
            <div className="lg:col-span-4">
              <AiCareSidebar
                report={activeReport}
                language={language}
                messages={chatMessages}
                isSending={isChatSending}
                chatError={chatError}
                onSendMessage={handleSendChatMessage}
                onResetChat={() => {
                  const welcome = createWelcomeMessage(activeReport);
                  setChatMessages([welcome]);
                  setChatError(null);
                  if (user && activeSavedReportId) {
                    void resetReportChat(activeSavedReportId, welcome);
                  }
                }}
              />
            </div>
          </div>
        ) : demoView === 'laboratory' ? (
          <NearbyLaboratoryPortal
            activeReport={activeReport}
            language={language}
            linkedLab={linkedLab}
            onLinkLab={handleLinkLab}
            onUnlinkLab={handleUnlinkLab}
            onReturnToPatientView={() => setDemoView('patient')}
            onAccessReport={handleAccessReportFromLab}
            transmittedReports={transmittedReports}
            onTransmitNewReport={handleTransmitNewReport}
          />
        ) : (
          <ExternalDoctorPortal
            user={user}
            authReady={authReady}
            isSigningIn={isSigningIn}
            authError={authError}
            onSignIn={signIn}
            onSignOut={signOut}
            doctorProfile={doctorProfile}
            doctorProfileLoading={doctorProfileLoading}
            onRegisterOrUpdateDoctor={registerOrUpdateDoctorProfile}
            doctorQueueHandoffs={doctorQueueHandoffs}
            activePatientReport={activeReport}
            activePatientNotes={patientNotes}
            activeHandoffStatus={handoffStatus}
            onPublishDoctorResponse={handlePublishDoctorResponse}
            onClaimHandoffForReview={async (handoffId) => {
              await advanceHandoffToReview(activeSavedReportId || activeReport.id, handoffId);
            }}
            onPullActiveReportToMyQueue={handlePullActiveReportToMyQueue}
            onReturnToPatientView={() => setDemoView('patient')}
          />
        )}
      </main>
    </div>
  );
}
