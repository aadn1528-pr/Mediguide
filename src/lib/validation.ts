import type {
  AnalyzedLabReport,
  DoctorResponse,
  LabFileAttachment,
  Language,
  LocalizedBullets,
  LocalizedText,
} from '../types/lab';

// Constants synchronized verbatim with firebase-blueprint.json and firestore.rules
export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const MAX_ID_LENGTH = 128;
export const MAX_DISPLAY_NAME_LENGTH = 120;
export const MAX_PHOTO_URL_LENGTH = 500;
export const MAX_PRESET_KEY_LENGTH = 64;
export const MAX_TITLE_LENGTH = 200;
export const MAX_REPORT_DATE_LENGTH = 60;
export const MAX_PATIENT_LABEL_LENGTH = 120;
export const MAX_SPECIALIST_LENGTH = 120;
export const MAX_RAW_TEXT_LENGTH = 50000;
export const MAX_PATIENT_NOTES_LENGTH = 5000;
export const MAX_CHAT_CONTENT_LENGTH = 12000;
export const MAX_TIMESTAMP_LABEL_LENGTH = 40;
export const MAX_CLINICAL_NOTE_LENGTH = 8000;
export const MAX_LOCALIZED_TEXT_LENGTH = 2500;
export const MAX_BULLET_LENGTH = 600;
export const MAX_BULLETS_PER_LANG = 10;
export const MAX_NUMERIC_MARKERS = 60;
export const MAX_CULTURE_FINDINGS = 15;
export const MAX_CLINIC_NAME_LENGTH = 150;
export const MAX_LICENSE_LENGTH = 64;
export const MAX_FILE_NAME_LENGTH = 200;
export const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;
export const MAX_STORAGE_PATH_LENGTH = 500;
export const MAX_DOWNLOAD_URL_LENGTH = 2000;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;

export function sanitizeAttachment(att: LabFileAttachment): LabFileAttachment {
  const mimeType = ALLOWED_ATTACHMENT_MIME_TYPES.includes(att.mimeType)
    ? att.mimeType
    : 'application/pdf';
  return {
    fileName: clampString(att.fileName, MAX_FILE_NAME_LENGTH, 'lab-report'),
    mimeType,
    sizeBytes: Math.max(1, Math.min(MAX_FILE_SIZE_BYTES, Math.floor(att.sizeBytes || 1))),
    storagePath: clampString(att.storagePath, MAX_STORAGE_PATH_LENGTH, ''),
    downloadUrl: clampString(att.downloadUrl, MAX_DOWNLOAD_URL_LENGTH, ''),
  };
}

export function sanitizeDoctorProfileInput(input: {
  doctorName: string;
  specialty: string;
  clinicName: string;
  licenseNumber: string;
  acceptingCases: boolean;
}) {
  return {
    doctorName: clampString(input.doctorName, MAX_PATIENT_LABEL_LENGTH, 'Attending Physician'),
    specialty: clampString(input.specialty, MAX_SPECIALIST_LENGTH, 'Internal Medicine'),
    clinicName: clampString(input.clinicName, MAX_CLINIC_NAME_LENGTH, 'MediGuide Partner Clinic'),
    licenseNumber: clampString(input.licenseNumber, MAX_LICENSE_LENGTH, 'REG-0000').slice(0, MAX_LICENSE_LENGTH),
    acceptingCases: Boolean(input.acceptingCases),
  };
}

export function sanitizeId(raw: string, fallbackPrefix = 'doc'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, MAX_ID_LENGTH);
  if (cleaned.length > 0 && ID_PATTERN.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now()}`;
}

export function clampString(value: unknown, maxLen: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

export function clampRawString(value: unknown, maxLen: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maxLen);
}

export function sanitizeLocalizedText(input: LocalizedText | undefined): LocalizedText {
  return {
    en: clampRawString(input?.en, MAX_LOCALIZED_TEXT_LENGTH, ''),
    ta: clampRawString(input?.ta, MAX_LOCALIZED_TEXT_LENGTH, ''),
    hi: clampRawString(input?.hi, MAX_LOCALIZED_TEXT_LENGTH, ''),
  };
}

export function sanitizeLocalizedBullets(input: LocalizedBullets | undefined): LocalizedBullets {
  const cleanArr = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .slice(0, MAX_BULLETS_PER_LANG)
      .map((item) => clampRawString(item, MAX_BULLET_LENGTH, ''))
      .filter((s) => s.length > 0);
  };
  return {
    en: cleanArr(input?.en),
    ta: cleanArr(input?.ta),
    hi: cleanArr(input?.hi),
  };
}

export function sanitizeDoctorResponse(resp: DoctorResponse): DoctorResponse {
  return {
    doctorName: clampString(resp.doctorName, MAX_PATIENT_LABEL_LENGTH, 'Attending Physician'),
    specialty: clampString(resp.specialty, MAX_SPECIALIST_LENGTH, 'Internal Medicine'),
    respondedAt: clampString(resp.respondedAt, MAX_REPORT_DATE_LENGTH, 'Just now'),
    clinicalNote: clampString(resp.clinicalNote, MAX_CLINICAL_NOTE_LENGTH, 'Reviewed.'),
    followUpTimeframe: clampString(resp.followUpTimeframe, MAX_SPECIALIST_LENGTH, 'Within 1–2 weeks'),
  };
}

export function sanitizeLanguage(lang: unknown): Language {
  if (lang === 'ta' || lang === 'hi') return lang;
  return 'en';
}

export function sanitizeReportPayload(report: AnalyzedLabReport) {
  const allowedPriorities = ['Routine', 'Follow-Up Recommended', 'Prompt Doctor Review'] as const;
  const priority = allowedPriorities.includes(report.priority)
    ? report.priority
    : 'Follow-Up Recommended';

  const allowedSources = ['preset', 'text', 'file'] as const;
  const sourceType = allowedSources.includes(report.sourceType) ? report.sourceType : 'text';

  return {
    presetKey: clampRawString(report.presetKey ?? '', MAX_PRESET_KEY_LENGTH, ''),
    title: clampString(report.title, MAX_TITLE_LENGTH, 'Analyzed Lab Report'),
    reportDate: clampString(report.reportDate, MAX_REPORT_DATE_LENGTH, 'Today'),
    patientLabel: clampString(report.patientLabel, MAX_PATIENT_LABEL_LENGTH, 'Patient Lab Panel'),
    summaryBullets: sanitizeLocalizedBullets(report.summaryBullets),
    priority,
    priorityReason: sanitizeLocalizedText(report.priorityReason),
    recommendedSpecialist: clampString(
      report.recommendedSpecialist,
      MAX_SPECIALIST_LENGTH,
      'General Physician'
    ),
    specialistRationale: sanitizeLocalizedText(report.specialistRationale),
    numericMarkers: Array.isArray(report.numericMarkers)
      ? report.numericMarkers.slice(0, MAX_NUMERIC_MARKERS).map((m) => ({
          ...m,
          explanation: sanitizeLocalizedText(m.explanation),
        }))
      : [],
    cultureFindings: Array.isArray(report.cultureFindings)
      ? report.cultureFindings.slice(0, MAX_CULTURE_FINDINGS).map((c) => ({
          ...c,
          sensitivityNotes: sanitizeLocalizedText(c.sensitivityNotes),
        }))
      : [],
    rawReportText: clampRawString(report.rawReportText, MAX_RAW_TEXT_LENGTH, ''),
    sourceType,
  };
}
