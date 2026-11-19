import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  deleteLabReportFile,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutFirebase,
  uploadLabReportFile,
} from '../lib/firebase';
import {
  clampRawString,
  clampString,
  MAX_CHAT_CONTENT_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_PATIENT_NOTES_LENGTH,
  MAX_PHOTO_URL_LENGTH,
  MAX_TIMESTAMP_LABEL_LENGTH,
  sanitizeDoctorProfileInput,
  sanitizeDoctorResponse,
  sanitizeId,
  sanitizeLanguage,
  sanitizeReportPayload,
} from '../lib/validation';
import type {
  AnalyzedLabReport,
  ChatMessage,
  ClinicalHandoffRecord,
  DoctorProfile,
  DoctorResponse,
  HandoffStatus,
  LabFileAttachment,
  Language,
  SavedReportRecord,
} from '../types/lab';

interface DoctorRegistrationInput {
  doctorName: string;
  specialty: string;
  clinicName: string;
  licenseNumber: string;
  acceptingCases: boolean;
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  authError: string | null;
  isSigningIn: boolean;
  savedReports: SavedReportRecord[];
  reportsLoading: boolean;
  activeSavedReportId: string | null;
  setActiveSavedReportId: (id: string | null) => void;
  savedMessages: ChatMessage[];
  doctorProfile: DoctorProfile | null;
  doctorProfileLoading: boolean;
  doctorDirectory: DoctorProfile[];
  patientHandoffs: ClinicalHandoffRecord[];
  doctorQueueHandoffs: ClinicalHandoffRecord[];
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  storageError: string | null;
  isUploadingFile: boolean;
  clearStorageError: () => void;
  saveReport: (
    report: AnalyzedLabReport,
    initialWelcome?: ChatMessage,
    uploadedFile?: { data: string; mimeType: string; name: string }
  ) => Promise<string | null>;
  attachFileToSavedReport: (reportId: string, file: File) => Promise<void>;
  deleteSavedReport: (reportId: string) => Promise<void>;
  submitHandoff: (
    report: AnalyzedLabReport,
    patientNotes: string,
    assignedDoctorUid?: string
  ) => Promise<string | null>;
  advanceHandoffToReview: (reportId: string, handoffId?: string) => Promise<void>;
  publishDoctorResponse: (
    handoffId: string,
    response: DoctorResponse,
    ownReportId?: string
  ) => Promise<void>;
  registerOrUpdateDoctorProfile: (input: DoctorRegistrationInput) => Promise<void>;
  appendChatMessage: (reportId: string, message: ChatMessage) => Promise<void>;
  resetReportChat: (reportId: string, welcomeMessage: ChatMessage) => Promise<void>;
  syncLanguagePreference: (language: Language) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  return Date.now();
}

function mapHandoffDoc(id: string, d: Record<string, unknown>): ClinicalHandoffRecord {
  const statusVal =
    d.handoffStatus === 'completed' || d.handoffStatus === 'under_review'
      ? d.handoffStatus
      : 'sent';

  return {
    id,
    patientUid: String(d.patientUid || ''),
    assignedDoctorUid: String(d.assignedDoctorUid || ''),
    reportId: String(d.reportId || ''),
    title: String(d.title || 'Lab Report'),
    reportDate: String(d.reportDate || ''),
    patientLabel: String(d.patientLabel || 'Patient Lab Panel'),
    priority: (d.priority as ClinicalHandoffRecord['priority']) || 'Follow-Up Recommended',
    recommendedSpecialist: String(d.recommendedSpecialist || 'General Physician'),
    numericMarkers: Array.isArray(d.numericMarkers) ? d.numericMarkers : [],
    cultureFindings: Array.isArray(d.cultureFindings) ? d.cultureFindings : [],
    patientNotes: String(d.patientNotes || ''),
    handoffStatus: statusVal,
    doctorResponse: (d.doctorResponse as DoctorResponse) || null,
    attachment: (d.attachment as LabFileAttachment) || null,
    createdAtMs: toMillis(d.createdAt),
    updatedAtMs: toMillis(d.updatedAt),
  };
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [savedReports, setSavedReports] = useState<SavedReportRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [activeSavedReportId, setActiveSavedReportId] = useState<string | null>(null);
  const [savedMessages, setSavedMessages] = useState<ChatMessage[]>([]);

  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [doctorProfileLoading, setDoctorProfileLoading] = useState(false);
  const [doctorDirectory, setDoctorDirectory] = useState<DoctorProfile[]>([]);
  const [patientHandoffs, setPatientHandoffs] = useState<ClinicalHandoffRecord[]>([]);
  const [doctorQueueHandoffs, setDoctorQueueHandoffs] = useState<ClinicalHandoffRecord[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const clearStorageError = useCallback(() => setStorageError(null), []);

  const ensureUserProfile = useCallback(async (firebaseUser: User) => {
    const userPath = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          displayName: clampString(
            firebaseUser.displayName,
            MAX_DISPLAY_NAME_LENGTH,
            'MediGuide Patient'
          ),
          photoURL: clampRawString(
            firebaseUser.photoURL ?? '',
            MAX_PHOTO_URL_LENGTH,
            ''
          ),
          role: 'patient',
          preferredLanguage: 'en',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }, []);

  const loadDoctorProfile = useCallback(async (firebaseUser: User) => {
    const doctorPath = `doctors/${firebaseUser.uid}`;
    setDoctorProfileLoading(true);
    try {
      const snap = await getDoc(doc(db, 'doctors', firebaseUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        setDoctorProfile({
          uid: firebaseUser.uid,
          doctorName: String(d.doctorName || ''),
          specialty: String(d.specialty || ''),
          clinicName: String(d.clinicName || ''),
          licenseNumber: String(d.licenseNumber || ''),
          acceptingCases: Boolean(d.acceptingCases),
        });
      } else {
        setDoctorProfile(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, doctorPath);
    } finally {
      setDoctorProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        void ensureUserProfile(firebaseUser);
        void loadDoctorProfile(firebaseUser);
      } else {
        setSavedReports([]);
        setActiveSavedReportId(null);
        setSavedMessages([]);
        setDoctorProfile(null);
        setDoctorDirectory([]);
        setPatientHandoffs([]);
        setDoctorQueueHandoffs([]);
      }
    });
    return () => unsubscribe();
  }, [ensureUserProfile, loadDoctorProfile]);

  // Live listener for user's saved lab reports
  useEffect(() => {
    if (!authReady || !user) {
      setSavedReports([]);
      setReportsLoading(false);
      return;
    }

    setReportsLoading(true);
    const reportsPath = `users/${user.uid}/reports`;
    const q = query(
      collection(db, 'users', user.uid, 'reports'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: SavedReportRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const report: AnalyzedLabReport = {
            id: docSnap.id,
            presetKey: typeof d.presetKey === 'string' && d.presetKey ? d.presetKey : undefined,
            title: String(d.title || 'Lab Report'),
            reportDate: String(d.reportDate || ''),
            patientLabel: String(d.patientLabel || ''),
            summaryBullets: d.summaryBullets,
            priority: d.priority,
            priorityReason: d.priorityReason,
            recommendedSpecialist: String(d.recommendedSpecialist || 'General Physician'),
            specialistRationale: d.specialistRationale,
            numericMarkers: Array.isArray(d.numericMarkers) ? d.numericMarkers : [],
            cultureFindings: Array.isArray(d.cultureFindings) ? d.cultureFindings : [],
            rawReportText: String(d.rawReportText || ''),
            sourceType: d.sourceType || 'text',
          };

          return {
            id: docSnap.id,
            ownerId: String(d.ownerId || user.uid),
            report,
            patientNotes: String(d.patientNotes || ''),
            handoffStatus: (d.handoffStatus as HandoffStatus) || 'idle',
            doctorResponse: (d.doctorResponse as DoctorResponse) || null,
            attachment: (d.attachment as LabFileAttachment) || null,
            createdAtMs: toMillis(d.createdAt),
            updatedAtMs: toMillis(d.updatedAt),
          };
        });

        items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setSavedReports(items);
        setReportsLoading(false);
      },
      (error) => {
        setReportsLoading(false);
        handleFirestoreError(error, OperationType.LIST, reportsPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  // Live listener for active saved report's AI Care chat messages
  useEffect(() => {
    if (!authReady || !user || !activeSavedReportId) {
      setSavedMessages([]);
      return;
    }

    const safeReportId = sanitizeId(activeSavedReportId, 'report');
    const messagesPath = `users/${user.uid}/reports/${safeReportId}/messages`;
    const q = query(
      collection(db, 'users', user.uid, 'reports', safeReportId, 'messages'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              role: d.role === 'user' ? ('user' as const) : ('assistant' as const),
              content: String(d.content || ''),
              timestamp: String(d.timestampLabel || ''),
              createdAtMs: toMillis(d.createdAt),
            };
          })
          .sort((a, b) => a.createdAtMs - b.createdAtMs)
          .map(({ id, role, content, timestamp }) => ({
            id,
            role,
            content,
            timestamp,
          }));

        setSavedMessages(msgs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, messagesPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, user, activeSavedReportId]);

  // Live listener for non-PII Doctor Directory (acceptingCases == true)
  useEffect(() => {
    if (!authReady || !user) {
      setDoctorDirectory([]);
      return;
    }

    const dirPath = 'doctor_directory';
    const q = query(
      collection(db, 'doctor_directory'),
      where('acceptingCases', '==', true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            uid: String(d.uid || docSnap.id),
            doctorName: String(d.doctorName || 'Attending Physician'),
            specialty: String(d.specialty || 'Internal Medicine'),
            clinicName: String(d.clinicName || 'Partner Clinic'),
            acceptingCases: Boolean(d.acceptingCases),
          };
        });
        setDoctorDirectory(docs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, dirPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  // Live listener for handoffs submitted by the signed-in patient
  useEffect(() => {
    if (!authReady || !user) {
      setPatientHandoffs([]);
      return;
    }

    const handoffsPath = 'handoffs';
    const q = query(
      collection(db, 'handoffs'),
      where('patientUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs
          .map((docSnap) => mapHandoffDoc(docSnap.id, docSnap.data()))
          .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPatientHandoffs(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, handoffsPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  // Live listener for incoming cases assigned to the signed-in doctor
  useEffect(() => {
    if (!authReady || !user || !doctorProfile) {
      setDoctorQueueHandoffs([]);
      return;
    }

    const handoffsPath = 'handoffs';
    const q = query(
      collection(db, 'handoffs'),
      where('assignedDoctorUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs
          .map((docSnap) => mapHandoffDoc(docSnap.id, docSnap.data()))
          .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setDoctorQueueHandoffs(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, handoffsPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, user, doctorProfile]);

  const signIn = useCallback(async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Google sign-in could not be completed.';
      setAuthError(msg);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await signOutFirebase();
  }, []);

  const registerOrUpdateDoctorProfile = useCallback(
    async (input: DoctorRegistrationInput) => {
      if (!user) return;
      const clean = sanitizeDoctorProfileInput(input);
      const doctorRef = doc(db, 'doctors', user.uid);
      const directoryRef = doc(db, 'doctor_directory', user.uid);
      const doctorPath = `doctors/${user.uid}`;

      try {
        const existingSnap = await getDoc(doctorRef);
        const batch = writeBatch(db);

        if (!existingSnap.exists()) {
          batch.set(doctorRef, {
            uid: user.uid,
            ...clean,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batch.set(directoryRef, {
            uid: user.uid,
            doctorName: clean.doctorName,
            specialty: clean.specialty,
            clinicName: clean.clinicName,
            acceptingCases: clean.acceptingCases,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(doctorRef, {
            ...clean,
            updatedAt: serverTimestamp(),
          });
          batch.update(directoryRef, {
            doctorName: clean.doctorName,
            specialty: clean.specialty,
            clinicName: clean.clinicName,
            acceptingCases: clean.acceptingCases,
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        setDoctorProfile({
          uid: user.uid,
          ...clean,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, doctorPath);
      }
    },
    [user]
  );

  const saveReport = useCallback(
    async (
      report: AnalyzedLabReport,
      initialWelcome?: ChatMessage,
      uploadedFile?: { data: string; mimeType: string; name: string }
    ): Promise<string | null> => {
      if (!user) return null;
      await ensureUserProfile(user);

      const reportId = sanitizeId(report.id || `report-${Date.now()}`, 'report');
      const reportPath = `users/${user.uid}/reports/${reportId}`;
      const sanitized = sanitizeReportPayload(report);

      let attachment: LabFileAttachment | null = null;
      if (uploadedFile) {
        setIsUploadingFile(true);
        setStorageError(null);
        try {
          attachment = await uploadLabReportFile(user.uid, reportId, uploadedFile);
        } catch (err: unknown) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Could not upload lab file to Cloud Storage.';
          setStorageError(msg);
        } finally {
          setIsUploadingFile(false);
        }
      }

      try {
        await setDoc(doc(db, 'users', user.uid, 'reports', reportId), {
          ownerId: user.uid,
          ...sanitized,
          patientNotes: '',
          handoffStatus: 'idle',
          ...(attachment ? { attachment } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (initialWelcome) {
          const msgId = sanitizeId(initialWelcome.id || `welcome-${Date.now()}`, 'msg');
          await setDoc(doc(db, 'users', user.uid, 'reports', reportId, 'messages', msgId), {
            ownerId: user.uid,
            reportId,
            role: initialWelcome.role,
            content: clampString(initialWelcome.content, MAX_CHAT_CONTENT_LENGTH, 'Welcome!'),
            timestampLabel: clampString(initialWelcome.timestamp, MAX_TIMESTAMP_LABEL_LENGTH, 'Now'),
            createdAt: serverTimestamp(),
          });
        }

        setActiveSavedReportId(reportId);
        return reportId;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, reportPath);
      }
    },
    [user, ensureUserProfile]
  );

  const attachFileToSavedReport = useCallback(
    async (reportId: string, file: File) => {
      if (!user) return;
      const safeId = sanitizeId(reportId, 'report');
      const reportPath = `users/${user.uid}/reports/${safeId}`;
      setIsUploadingFile(true);
      setStorageError(null);

      try {
        const existingRecord = savedReports.find((r) => r.id === safeId);
        const attachment = await uploadLabReportFile(user.uid, safeId, file);

        await updateDoc(doc(db, 'users', user.uid, 'reports', safeId), {
          attachment,
          updatedAt: serverTimestamp(),
        });

        if (existingRecord?.attachment?.storagePath) {
          void deleteLabReportFile(existingRecord.attachment.storagePath);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.startsWith('{"error":')) {
          throw err;
        }
        const msg =
          err instanceof Error
            ? err.message
            : 'Cloud Storage upload failed. Please try again.';
        setStorageError(msg);
      } finally {
        setIsUploadingFile(false);
      }
    },
    [user, savedReports]
  );

  const deleteSavedReport = useCallback(
    async (reportId: string) => {
      if (!user) return;
      const safeId = sanitizeId(reportId, 'report');
      const reportPath = `users/${user.uid}/reports/${safeId}`;
      const existingRecord = savedReports.find((r) => r.id === safeId);
      try {
        if (existingRecord?.attachment?.storagePath) {
          await deleteLabReportFile(existingRecord.attachment.storagePath);
        }
        const msgsQuery = query(
          collection(db, 'users', user.uid, 'reports', safeId, 'messages'),
          where('ownerId', '==', user.uid)
        );
        const msgSnap = await getDocs(msgsQuery);
        if (!msgSnap.empty) {
          const batch = writeBatch(db);
          msgSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        await deleteDoc(doc(db, 'users', user.uid, 'reports', safeId));
        if (activeSavedReportId === safeId) {
          setActiveSavedReportId(null);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, reportPath);
      }
    },
    [user, activeSavedReportId, savedReports]
  );

  const submitHandoff = useCallback(
    async (
      report: AnalyzedLabReport,
      patientNotes: string,
      assignedDoctorUid?: string
    ): Promise<string | null> => {
      if (!user) return null;
      await ensureUserProfile(user);

      const safeReportId = sanitizeId(report.id, 'report');
      const reportPath = `users/${user.uid}/reports/${safeReportId}`;
      const handoffId = sanitizeId(`${user.uid}_${safeReportId}`, 'handoff');
      const handoffPath = `handoffs/${handoffId}`;
      const targetDoctorUid = sanitizeId(assignedDoctorUid || user.uid, 'doc');
      const sanitized = sanitizeReportPayload(report);
      const cleanNotes = clampRawString(patientNotes, MAX_PATIENT_NOTES_LENGTH, '');
      const savedMatch = savedReports.find((r) => r.id === safeReportId);
      const attachment = savedMatch?.attachment || null;

      try {
        await updateDoc(doc(db, 'users', user.uid, 'reports', safeReportId), {
          patientNotes: cleanNotes,
          handoffStatus: 'sent',
          updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'handoffs', handoffId), {
          patientUid: user.uid,
          assignedDoctorUid: targetDoctorUid,
          reportId: safeReportId,
          title: sanitized.title,
          reportDate: sanitized.reportDate,
          patientLabel: sanitized.patientLabel,
          priority: sanitized.priority,
          recommendedSpecialist: sanitized.recommendedSpecialist,
          numericMarkers: sanitized.numericMarkers,
          cultureFindings: sanitized.cultureFindings,
          patientNotes: cleanNotes,
          handoffStatus: 'sent',
          ...(attachment ? { attachment } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return handoffId;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `${reportPath} | ${handoffPath}`);
      }
    },
    [user, ensureUserProfile, savedReports]
  );

  const advanceHandoffToReview = useCallback(
    async (reportId: string, handoffId?: string) => {
      if (!user) return;
      const safeReportId = sanitizeId(reportId, 'report');
      const safeHandoffId = sanitizeId(handoffId || `${user.uid}_${safeReportId}`, 'handoff');
      const handoffPath = `handoffs/${safeHandoffId}`;
      try {
        const handoffRef = doc(db, 'handoffs', safeHandoffId);
        const handoffSnap = await getDoc(handoffRef);
        if (handoffSnap.exists() && handoffSnap.data().handoffStatus !== 'completed') {
          await updateDoc(handoffRef, {
            handoffStatus: 'under_review',
            updatedAt: serverTimestamp(),
          });
        }

        if (
          handoffSnap.exists() &&
          handoffSnap.data().patientUid === user.uid
        ) {
          const reportRef = doc(db, 'users', user.uid, 'reports', safeReportId);
          const reportSnap = await getDoc(reportRef);
          if (reportSnap.exists() && reportSnap.data().handoffStatus !== 'completed') {
            await updateDoc(reportRef, {
              handoffStatus: 'under_review',
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, handoffPath);
      }
    },
    [user]
  );

  const publishDoctorResponse = useCallback(
    async (handoffId: string, response: DoctorResponse, ownReportId?: string) => {
      if (!user) return;
      const safeHandoffId = sanitizeId(handoffId, 'handoff');
      const handoffPath = `handoffs/${safeHandoffId}`;
      const cleanResponse = sanitizeDoctorResponse(response);
      try {
        const handoffRef = doc(db, 'handoffs', safeHandoffId);
        const handoffSnap = await getDoc(handoffRef);

        if (handoffSnap.exists()) {
          await updateDoc(handoffRef, {
            handoffStatus: 'completed',
            doctorResponse: cleanResponse,
            updatedAt: serverTimestamp(),
          });
          const data = handoffSnap.data();
          if (data.patientUid === user.uid && typeof data.reportId === 'string') {
            await updateDoc(doc(db, 'users', user.uid, 'reports', data.reportId), {
              handoffStatus: 'completed',
              doctorResponse: cleanResponse,
              updatedAt: serverTimestamp(),
            });
          }
        } else if (ownReportId) {
          const safeReportId = sanitizeId(ownReportId, 'report');
          await updateDoc(doc(db, 'users', user.uid, 'reports', safeReportId), {
            handoffStatus: 'completed',
            doctorResponse: cleanResponse,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, handoffPath);
      }
    },
    [user]
  );

  const appendChatMessage = useCallback(
    async (reportId: string, message: ChatMessage) => {
      if (!user) return;
      const safeReportId = sanitizeId(reportId, 'report');
      const safeMsgId = sanitizeId(message.id || `msg-${Date.now()}`, 'msg');
      const msgPath = `users/${user.uid}/reports/${safeReportId}/messages/${safeMsgId}`;
      try {
        await setDoc(
          doc(db, 'users', user.uid, 'reports', safeReportId, 'messages', safeMsgId),
          {
            ownerId: user.uid,
            reportId: safeReportId,
            role: message.role,
            content: clampString(message.content, MAX_CHAT_CONTENT_LENGTH, '...'),
            timestampLabel: clampString(
              message.timestamp,
              MAX_TIMESTAMP_LABEL_LENGTH,
              'Now'
            ),
            createdAt: serverTimestamp(),
          }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, msgPath);
      }
    },
    [user]
  );

  const resetReportChat = useCallback(
    async (reportId: string, welcomeMessage: ChatMessage) => {
      if (!user) return;
      const safeReportId = sanitizeId(reportId, 'report');
      const msgsPath = `users/${user.uid}/reports/${safeReportId}/messages`;
      try {
        const msgsQuery = query(
          collection(db, 'users', user.uid, 'reports', safeReportId, 'messages'),
          where('ownerId', '==', user.uid)
        );
        const snap = await getDocs(msgsQuery);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        await appendChatMessage(safeReportId, welcomeMessage);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, msgsPath);
      }
    },
    [user, appendChatMessage]
  );

  const syncLanguagePreference = useCallback(
    async (language: Language) => {
      if (!user) return;
      const userPath = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          preferredLanguage: sanitizeLanguage(language),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    },
    [user]
  );

  return (
    <FirebaseContext.Provider
      value={{
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
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside a FirebaseProvider');
  }
  return ctx;
}
