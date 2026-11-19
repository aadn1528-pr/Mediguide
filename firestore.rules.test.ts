/**
 * Dirty Dozen Security Rule Verification Harness (MediGuide AI)
 * Verifies adversarial payloads across Reports, Doctor Registration, and Clinical Handoffs.
 */
import assert from 'node:assert/strict';

const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

interface AuthContext {
  uid: string;
  email: string;
  emailVerified: boolean;
}

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

function canCreateReport(
  auth: AuthContext | null,
  userId: string,
  reportId: string,
  payload: Record<string, unknown>,
  userProfileExists: boolean,
  serverTimeSentinel: symbol
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.emailVerified) return 'PERMISSION_DENIED';
  if (!isValidId(userId) || !isValidId(reportId)) return 'PERMISSION_DENIED';
  const required = [
    'ownerId', 'presetKey', 'title', 'reportDate', 'patientLabel',
    'summaryBullets', 'priority', 'priorityReason', 'recommendedSpecialist',
    'specialistRationale', 'numericMarkers', 'cultureFindings',
    'rawReportText', 'sourceType', 'patientNotes', 'handoffStatus',
    'createdAt', 'updatedAt',
  ];
  const allowed = new Set([...required, 'doctorResponse', 'attachment']);
  const keys = Object.keys(payload);
  if (!required.every((k) => keys.includes(k))) return 'PERMISSION_DENIED';
  if (!keys.every((k) => allowed.has(k))) return 'PERMISSION_DENIED';
  if ('attachment' in payload) {
    const att = payload.attachment as Record<string, unknown>;
    if (
      !att ||
      typeof att.storagePath !== 'string' ||
      !att.storagePath.startsWith(`users/${auth.uid}/reports/`)
    ) {
      return 'PERMISSION_DENIED';
    }
  }
  if (auth.uid !== userId || payload.ownerId !== auth.uid) return 'PERMISSION_DENIED';
  if (payload.handoffStatus !== 'idle') return 'PERMISSION_DENIED';
  if ('doctorResponse' in payload) return 'PERMISSION_DENIED';
  if (payload.createdAt !== serverTimeSentinel || payload.updatedAt !== serverTimeSentinel) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.rawReportText !== 'string' || payload.rawReportText.length > 50000) {
    return 'PERMISSION_DENIED';
  }
  if (!Array.isArray(payload.numericMarkers) || payload.numericMarkers.length > 60) {
    return 'PERMISSION_DENIED';
  }
  if (!userProfileExists) return 'PERMISSION_DENIED';
  return 'ALLOW';
}

function canCreateDoctorProfile(
  auth: AuthContext | null,
  doctorId: string,
  payload: Record<string, unknown>,
  hasDirectoryAfter: boolean,
  serverTimeSentinel: symbol
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.emailVerified) return 'PERMISSION_DENIED';
  if (!isValidId(doctorId) || auth.uid !== doctorId) return 'PERMISSION_DENIED';
  const required = [
    'uid', 'doctorName', 'specialty', 'clinicName',
    'licenseNumber', 'acceptingCases', 'createdAt', 'updatedAt',
  ];
  const keys = Object.keys(payload);
  if (!required.every((k) => keys.includes(k)) || keys.length !== required.length) {
    return 'PERMISSION_DENIED';
  }
  if (payload.uid !== auth.uid) return 'PERMISSION_DENIED';
  if (payload.createdAt !== serverTimeSentinel || payload.updatedAt !== serverTimeSentinel) {
    return 'PERMISSION_DENIED';
  }
  if (!hasDirectoryAfter) return 'PERMISSION_DENIED';
  return 'ALLOW';
}

function canPublishDoctorHandoff(
  auth: AuthContext | null,
  existingStatus: string,
  assignedDoctorUid: string,
  isRegisteredDoctor: boolean,
  hasDoctorResponse: boolean
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.emailVerified) return 'PERMISSION_DENIED';
  if (existingStatus === 'completed') return 'PERMISSION_DENIED';
  if (auth.uid !== assignedDoctorUid) return 'PERMISSION_DENIED';
  if (!isRegisteredDoctor) return 'PERMISSION_DENIED';
  if (!hasDoctorResponse) return 'PERMISSION_DENIED';
  return 'ALLOW';
}

const SERVER_TIME = Symbol('request.time');
const validAuth: AuthContext = { uid: 'u1', email: 'patient@example.com', emailVerified: true };
const doctorAuth: AuthContext = { uid: 'doc1', email: 'dr.priya@clinic.org', emailVerified: true };

const baseReport = () => ({
  ownerId: 'u1',
  presetKey: 'diabetes-lipids',
  title: 'Diabetes & Lipids Panel',
  reportDate: '18 Nov 2026',
  patientLabel: 'Adult Lab Panel',
  summaryBullets: { en: ['a'], ta: ['a'], hi: ['a'] },
  priority: 'Follow-Up Recommended',
  priorityReason: { en: 'r', ta: 'r', hi: 'r' },
  recommendedSpecialist: 'Endocrinologist',
  specialistRationale: { en: 's', ta: 's', hi: 's' },
  numericMarkers: [{}],
  cultureFindings: [],
  rawReportText: 'HbA1c 6.8%',
  sourceType: 'preset',
  patientNotes: '',
  handoffStatus: 'idle',
  createdAt: SERVER_TIME,
  updatedAt: SERVER_TIME,
});

const baseDoctor = () => ({
  uid: 'doc1',
  doctorName: 'Dr. Priya Nair, MD',
  specialty: 'Endocrinology',
  clinicName: 'City Care Medical Center',
  licenseNumber: 'MC-94821',
  acceptingCases: true,
  createdAt: SERVER_TIME,
  updatedAt: SERVER_TIME,
});

// Report checks
assert.equal(canCreateReport(null, 'u1', 'r1', baseReport(), true, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateReport({ ...validAuth, emailVerified: false }, 'u1', 'r1', baseReport(), true, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateReport(validAuth, 'u1', 'r1', { ...baseReport(), ownerId: 'victim' }, true, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateReport(validAuth, 'u1', 'r1', { ...baseReport(), isVerifiedDoctor: true }, true, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateReport(validAuth, 'u1', 'bad id/1', baseReport(), true, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateReport(validAuth, 'u1', 'r1', { ...baseReport(), handoffStatus: 'completed', doctorResponse: {} }, true, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateReport(validAuth, 'u1', 'r1', { ...baseReport(), createdAt: '2020-01-01' }, true, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateReport(validAuth, 'u1', 'r1', { ...baseReport(), rawReportText: 'x'.repeat(50001) }, true, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateReport(validAuth, 'u1', 'r1', baseReport(), false, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateReport(validAuth, 'u1', 'r1', baseReport(), true, SERVER_TIME), 'ALLOW');

// Doctor profile & handoff RBAC checks
assert.equal(canCreateDoctorProfile(doctorAuth, 'doc1', baseDoctor(), false, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateDoctorProfile(doctorAuth, 'doc1', { ...baseDoctor(), isSuperAdmin: true }, true, SERVER_TIME), 'PERMISSION_DENIED');
assert.equal(canCreateDoctorProfile(doctorAuth, 'doc1', baseDoctor(), true, SERVER_TIME), 'ALLOW');

assert.equal(canPublishDoctorHandoff(validAuth, 'sent', 'doc1', true, true), 'PERMISSION_DENIED');
assert.equal(canPublishDoctorHandoff(doctorAuth, 'sent', 'doc1', false, true), 'PERMISSION_DENIED');
assert.equal(canPublishDoctorHandoff(doctorAuth, 'completed', 'doc1', true, true), 'PERMISSION_DENIED');
assert.equal(canPublishDoctorHandoff(doctorAuth, 'under_review', 'doc1', true, true), 'ALLOW');
