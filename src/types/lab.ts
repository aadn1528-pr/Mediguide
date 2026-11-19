export type DemoView = 'patient' | 'doctor' | 'laboratory';

export type Language = 'en' | 'ta' | 'hi';

export type MarkerStatus = 'normal' | 'borderline' | 'out_of_range';

export type PriorityLevel = 'Routine' | 'Follow-Up Recommended' | 'Prompt Doctor Review';

export type LabCategory =
  | 'Blood Sugar & Diabetes'
  | 'Heart & Cholesterol'
  | 'Blood Cells'
  | 'Microbiology / Bacteria Culture'
  | 'Organ & Vitamin Health';

export interface LocalizedText {
  en: string;
  ta: string;
  hi: string;
}

export interface LocalizedBullets {
  en: string[];
  ta: string[];
  hi: string[];
}

export interface NumericMarker {
  id: string;
  category: LabCategory;
  name: string;
  value: number;
  unit: string;
  referenceRangeText: string;
  refMin: number;
  refMax: number;
  displayMin: number;
  displayMax: number;
  status: MarkerStatus;
  explanation: LocalizedText;
}

export type Susceptibility = 'Susceptible' | 'Intermediate' | 'Resistant';

export interface AntibioticSensitivity {
  antibiotic: string;
  micOrZone: string;
  interpretation: Susceptibility;
}

export interface CultureFinding {
  id: string;
  category: 'Microbiology / Bacteria Culture';
  specimenType: string;
  collectionSite: string;
  incubationTime: string;
  organismDetected: string;
  isGrowthDetected: boolean;
  status: MarkerStatus;
  sensitivityNotes: LocalizedText;
  antibiotics: AntibioticSensitivity[];
}

export interface AnalyzedLabReport {
  id: string;
  presetKey?: string;
  title: string;
  reportDate: string;
  patientLabel: string;
  summaryBullets: LocalizedBullets;
  priority: PriorityLevel;
  priorityReason: LocalizedText;
  recommendedSpecialist: string;
  specialistRationale: LocalizedText;
  numericMarkers: NumericMarker[];
  cultureFindings: CultureFinding[];
  rawReportText: string;
  sourceType: 'preset' | 'text' | 'file';
}

export type HandoffStatus = 'idle' | 'sent' | 'under_review' | 'completed';

export interface DoctorResponse {
  doctorName: string;
  specialty: string;
  respondedAt: string;
  clinicalNote: string;
  followUpTimeframe: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface LabFileAttachment {
  fileName: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
  sizeBytes: number;
  storagePath: string;
  downloadUrl: string;
}

export interface SavedReportRecord {
  id: string;
  ownerId: string;
  report: AnalyzedLabReport;
  patientNotes: string;
  handoffStatus: HandoffStatus;
  doctorResponse: DoctorResponse | null;
  attachment?: LabFileAttachment | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface DoctorProfile {
  uid: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  licenseNumber?: string;
  acceptingCases: boolean;
}

export interface ClinicalHandoffRecord {
  id: string;
  patientUid: string;
  assignedDoctorUid: string;
  reportId: string;
  title: string;
  reportDate: string;
  patientLabel: string;
  priority: PriorityLevel;
  recommendedSpecialist: string;
  numericMarkers: NumericMarker[];
  cultureFindings: CultureFinding[];
  patientNotes: string;
  handoffStatus: 'sent' | 'under_review' | 'completed';
  doctorResponse: DoctorResponse | null;
  attachment?: LabFileAttachment | null;
  createdAtMs: number;
  updatedAtMs: number;
}


