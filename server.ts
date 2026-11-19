import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const VALID_CATEGORIES = [
  'Blood Sugar & Diabetes',
  'Heart & Cholesterol',
  'Blood Cells',
  'Microbiology / Bacteria Culture',
  'Organ & Vitamin Health',
] as const;

const VALID_STATUSES = ['normal', 'borderline', 'out_of_range'] as const;
const VALID_PRIORITIES = ['Routine', 'Follow-Up Recommended', 'Prompt Doctor Review'] as const;
const VALID_SUSCEPTIBILITIES = ['Susceptible', 'Intermediate', 'Resistant'] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];
type ValidStatus = (typeof VALID_STATUSES)[number];
type ValidPriority = (typeof VALID_PRIORITIES)[number];
type ValidSusceptibility = (typeof VALID_SUSCEPTIBILITIES)[number];

class HttpAppError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpAppError(
      500,
      'Gemini API key is not configured. Please verify your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ParsedGeminiError {
  statusCode: number;
  statusText: string;
  message: string;
  isTransient: boolean;
}

function parseGeminiError(err: unknown): ParsedGeminiError {
  if (err instanceof HttpAppError) {
    return {
      statusCode: err.statusCode,
      statusText: 'APP_ERROR',
      message: err.message,
      isTransient: err.statusCode === 503 || err.statusCode === 429,
    };
  }

  let rawMessage = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  let statusCode = 500;
  let statusText = '';

  const errObj = err as Record<string, unknown> | null;
  if (errObj && typeof errObj === 'object') {
    if (typeof errObj.status === 'number') statusCode = errObj.status;
    if (typeof errObj.statusCode === 'number') statusCode = errObj.statusCode;
  }

  // Unwrap nested JSON SDK error payloads like {"error":{"code":503,"message":"...","status":"UNAVAILABLE"}}
  if (rawMessage.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMessage);
      const inner = parsed?.error ?? parsed;
      if (typeof inner?.code === 'number') statusCode = inner.code;
      if (typeof inner?.status === 'string') statusText = inner.status;
      if (typeof inner?.message === 'string') rawMessage = inner.message;
    } catch {
      // Keep original string if not valid JSON
    }
  }

  const upper = `${statusText} ${rawMessage}`.toUpperCase();

  if (statusCode === 400 && (upper.includes('API_KEY') || upper.includes('API KEY'))) {
    return {
      statusCode: 400,
      statusText: 'API_KEY_INVALID',
      message:
        'The configured Gemini API key appears invalid. Please check your API key in the Settings > Secrets panel.',
      isTransient: false,
    };
  }

  if (statusCode === 403 || upper.includes('PERMISSION_DENIED')) {
    return {
      statusCode: 403,
      statusText: 'PERMISSION_DENIED',
      message:
        'Access to the Gemini API was denied. Please check your API key permissions in the Settings > Secrets panel.',
      isTransient: false,
    };
  }

  if (statusCode === 404 || upper.includes('NOT_FOUND')) {
    return {
      statusCode: 404,
      statusText: 'NOT_FOUND',
      message: 'The requested AI model endpoint was not found or is temporarily unavailable.',
      isTransient: false,
    };
  }

  if (statusCode === 429 || upper.includes('RESOURCE_EXHAUSTED') || upper.includes('QUOTA')) {
    return {
      statusCode: 429,
      statusText: 'RESOURCE_EXHAUSTED',
      message:
        'AI request quota was temporarily reached. Please wait a moment and try again, or verify your API tier in Settings > Secrets.',
      isTransient: true,
    };
  }

  if (
    statusCode === 503 ||
    statusCode === 502 ||
    statusCode === 504 ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED') ||
    upper.includes('ETIMEDOUT') ||
    upper.includes('ECONNRESET')
  ) {
    return {
      statusCode: 503,
      statusText: 'UNAVAILABLE',
      message:
        'The AI service is currently experiencing high demand. Please retry in a few seconds.',
      isTransient: true,
    };
  }

  if (statusCode === 400) {
    return {
      statusCode: 400,
      statusText: statusText || 'BAD_REQUEST',
      message:
        rawMessage ||
        'Could not process that file or text format. Try a clearer PNG/JPG/PDF or paste the report text.',
      isTransient: false,
    };
  }

  return {
    statusCode: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    statusText: statusText || 'INTERNAL_ERROR',
    message: rawMessage || 'Unexpected error while analyzing the lab report.',
    isTransient: false,
  };
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: {
    contents: unknown;
    config?: Record<string, unknown>;
    primaryThinkingLevel?: ThinkingLevel;
  }
) {
  const maxAttemptsPrimary = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttemptsPrimary; attempt++) {
    try {
      const primaryConfig = {
        ...(params.config ?? {}),
        ...(params.primaryThinkingLevel
          ? { thinkingConfig: { thinkingLevel: params.primaryThinkingLevel } }
          : {}),
      };
      return await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: params.contents as never,
        config: primaryConfig as never,
      });
    } catch (err) {
      lastErr = err;
      const parsed = parseGeminiError(err);
      console.warn(
        `Gemini primary model (${PRIMARY_MODEL}) attempt ${attempt}/${maxAttemptsPrimary} failed [${parsed.statusCode} ${parsed.statusText}]: ${parsed.message}`
      );
      if (!parsed.isTransient) {
        throw err;
      }
      if (attempt < maxAttemptsPrimary) {
        const delayMs = 700 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
        await sleep(delayMs);
      }
    }
  }

  // Fallback once to free-tier lite model if primary failed strictly due to transient overload
  const parsedLast = parseGeminiError(lastErr);
  if (parsedLast.isTransient) {
    try {
      console.warn(`Falling back to ${FALLBACK_MODEL} after transient unavailability.`);
      return await ai.models.generateContent({
        model: FALLBACK_MODEL,
        contents: params.contents as never,
        config: (params.config ?? {}) as never,
      });
    } catch (fallbackErr) {
      lastErr = fallbackErr;
    }
  }

  throw lastErr;
}

function stripJsonCodeFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  const cleaned = val.trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLen);
}

function normalizeLocalizedText(
  input: unknown,
  fallbackEn: string,
  maxLen = 2500
): { en: string; ta: string; hi: string } {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const en = clampStr(obj.en, maxLen, fallbackEn);
  const ta = clampStr(obj.ta, maxLen, en);
  const hi = clampStr(obj.hi, maxLen, en);
  return { en, ta, hi };
}

function normalizeSummaryBullets(
  input: unknown,
  markersCount: number,
  culturesCount: number
): { en: string[]; ta: string[]; hi: string[] } {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const cleanArr = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .slice(0, 10)
      .map((item) => clampStr(item, 600, ''))
      .filter((s) => s.length > 0);
  };

  let en = cleanArr(obj.en);
  if (en.length === 0) {
    en = [
      `Reviewed ${markersCount} numeric marker(s)${culturesCount > 0 ? ` and ${culturesCount} culture finding(s)` : ''} from your lab report.`,
      'Review any Amber (Borderline) or Red (Out of Range) cards below alongside your laboratory reference intervals.',
      'Share this summary and your symptoms with your doctor so they can advise next steps.',
    ];
  }
  let ta = cleanArr(obj.ta);
  if (ta.length === 0) ta = en;
  let hi = cleanArr(obj.hi);
  if (hi.length === 0) hi = en;
  return { en, ta, hi };
}

function roundClean(num: number): number {
  if (!Number.isFinite(num)) return 0;
  if (Math.abs(num) >= 100) return Math.round(num);
  if (Math.abs(num) >= 10) return Math.round(num * 10) / 10;
  return Math.round(num * 100) / 100;
}

function toValidId(prefix: string, index: number, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `${prefix}-${index + 1}-${slug || 'item'}`.slice(0, 128);
}

function normalizeCategory(raw: unknown): ValidCategory {
  if (typeof raw === 'string') {
    const exact = VALID_CATEGORIES.find((c) => c === raw);
    if (exact) return exact;
    const lower = raw.toLowerCase();
    if (lower.includes('sugar') || lower.includes('diabet') || lower.includes('glucose')) {
      return 'Blood Sugar & Diabetes';
    }
    if (
      lower.includes('heart') ||
      lower.includes('lipid') ||
      lower.includes('cholesterol') ||
      lower.includes('cardio')
    ) {
      return 'Heart & Cholesterol';
    }
    if (
      lower.includes('blood cell') ||
      lower.includes('cbc') ||
      lower.includes('hemat') ||
      lower.includes('rbc') ||
      lower.includes('wbc')
    ) {
      return 'Blood Cells';
    }
    if (lower.includes('micro') || lower.includes('culture') || lower.includes('bacter')) {
      return 'Microbiology / Bacteria Culture';
    }
  }
  return 'Organ & Vitamin Health';
}

function normalizeMarkerStatus(
  rawStatus: unknown,
  value: number,
  refMin: number,
  refMax: number
): ValidStatus {
  if (typeof rawStatus === 'string' && VALID_STATUSES.includes(rawStatus as ValidStatus)) {
    return rawStatus as ValidStatus;
  }
  if (value >= refMin && value <= refMax) return 'normal';
  return 'out_of_range';
}

function normalizeAnalyzedReport(
  parsed: Record<string, unknown>,
  rawInputText: string | undefined,
  fileName: string | undefined,
  hasFile: boolean
) {
  const rawMarkers = Array.isArray(parsed.numericMarkers) ? parsed.numericMarkers : [];
  const rawCultures = Array.isArray(parsed.cultureFindings) ? parsed.cultureFindings : [];

  const numericMarkers = rawMarkers
    .slice(0, 60)
    .map((item, idx) => {
      const m = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const value = typeof m.value === 'number' ? m.value : Number(String(m.value ?? '').replace(/,/g, ''));
      if (!Number.isFinite(value)) return null;

      let refMin = typeof m.refMin === 'number' ? m.refMin : Number(String(m.refMin ?? '').replace(/,/g, ''));
      let refMax = typeof m.refMax === 'number' ? m.refMax : Number(String(m.refMax ?? '').replace(/,/g, ''));

      if (!Number.isFinite(refMin) && Number.isFinite(refMax)) {
        refMin = Math.min(0, refMax);
      }
      if (!Number.isFinite(refMax) && Number.isFinite(refMin)) {
        refMax = Math.max(refMin * 1.5, refMin + 10);
      }
      if (!Number.isFinite(refMin) && !Number.isFinite(refMax)) {
        refMin = Math.min(0, value);
        refMax = Math.max(value * 1.25, refMin + 10);
      }
      if (refMin > refMax) {
        [refMin, refMax] = [refMax, refMin];
      }
      if (refMin === refMax) {
        const pad = Math.max(Math.abs(refMax) * 0.25, 1);
        refMax = roundClean(refMax + pad);
      }

      const lowEdge = Math.min(refMin, value);
      const highEdge = Math.max(refMax, value);
      const span = Math.max(highEdge - lowEdge, Math.abs(highEdge) * 0.2, 1);
      const padLow = roundClean(span * 0.15);
      const padHigh = roundClean(span * 0.15);

      let displayMin =
        typeof m.displayMin === 'number' && Number.isFinite(m.displayMin)
          ? m.displayMin
          : roundClean(lowEdge - padLow);
      let displayMax =
        typeof m.displayMax === 'number' && Number.isFinite(m.displayMax)
          ? m.displayMax
          : roundClean(highEdge + padHigh);

      if (displayMin >= lowEdge) {
        displayMin = roundClean(lowEdge - Math.max(padLow, 0.5));
      }
      if (refMin >= 0 && displayMin < 0 && value >= 0) {
        displayMin = 0;
        if (refMin === 0 && value === 0) {
          displayMin = -1;
        }
      }
      if (displayMax <= highEdge) {
        displayMax = roundClean(highEdge + Math.max(padHigh, 0.5));
      }

      const name = clampStr(m.name, 140, `Lab Marker ${idx + 1}`);
      const unit = clampStr(m.unit, 40, '');
      const referenceRangeText = clampStr(
        m.referenceRangeText,
        80,
        `${refMin} - ${refMax}${unit ? ` ${unit}` : ''}`
      );
      const status = normalizeMarkerStatus(m.status, value, refMin, refMax);

      return {
        id: toValidId('m', idx, name),
        category: normalizeCategory(m.category),
        name,
        value: roundClean(value),
        unit,
        referenceRangeText,
        refMin: roundClean(refMin),
        refMax: roundClean(refMax),
        displayMin: roundClean(displayMin),
        displayMax: roundClean(displayMax),
        status,
        explanation: normalizeLocalizedText(
          m.explanation,
          `${name} measured ${roundClean(value)} ${unit} compared to the reference range (${referenceRangeText}).`
        ),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const cultureFindings = rawCultures.slice(0, 15).map((item, idx) => {
    const c = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const organismDetected = clampStr(c.organismDetected, 180, 'No Growth');
    const isGrowthDetected =
      typeof c.isGrowthDetected === 'boolean'
        ? c.isGrowthDetected
        : !/no growth|sterile|negative/i.test(organismDetected);
    const status: ValidStatus = isGrowthDetected ? 'out_of_range' : 'normal';

    const rawAbx = Array.isArray(c.antibiotics) ? c.antibiotics : [];
    const antibiotics = rawAbx.slice(0, 40).map((abxItem, abxIdx) => {
      const a = (abxItem && typeof abxItem === 'object' ? abxItem : {}) as Record<string, unknown>;
      const rawInterp = String(a.interpretation ?? '').trim().toLowerCase();
      let interpretation: ValidSusceptibility = 'Susceptible';
      if (rawInterp.startsWith('r') || rawInterp.includes('resist')) {
        interpretation = 'Resistant';
      } else if (rawInterp.startsWith('i') || rawInterp.includes('inter')) {
        interpretation = 'Intermediate';
      } else if (VALID_SUSCEPTIBILITIES.includes(a.interpretation as ValidSusceptibility)) {
        interpretation = a.interpretation as ValidSusceptibility;
      }

      return {
        antibiotic: clampStr(a.antibiotic, 100, `Antibiotic ${abxIdx + 1}`),
        micOrZone: clampStr(a.micOrZone, 60, 'Reported'),
        interpretation,
      };
    });

    const specimenType = clampStr(c.specimenType, 100, 'Clinical Specimen');
    return {
      id: toValidId('c', idx, `${specimenType}_${organismDetected}`),
      category: 'Microbiology / Bacteria Culture' as const,
      specimenType,
      collectionSite: clampStr(c.collectionSite, 100, 'Laboratory Sample'),
      incubationTime: clampStr(c.incubationTime, 80, '48 hours'),
      organismDetected,
      isGrowthDetected,
      status,
      sensitivityNotes: normalizeLocalizedText(
        c.sensitivityNotes,
        isGrowthDetected
          ? `Organism identified (${organismDetected}). Share the susceptibility table with your doctor to choose targeted treatment.`
          : 'No bacterial growth was detected during incubation.'
      ),
      antibiotics,
    };
  });

  if (parsed.isValidLabReport === false || (numericMarkers.length === 0 && cultureFindings.length === 0)) {
    const reason = clampStr(
      parsed.rejectionReason,
      400,
      'No recognizable lab markers or culture results were found. Please upload a clearer photo or PDF of a medical lab report, or paste the test values directly.'
    );
    throw new HttpAppError(422, reason);
  }

  const hasGrowth = cultureFindings.some((c) => c.isGrowthDetected);
  const hasOutOfRange = numericMarkers.some((m) => m.status === 'out_of_range');
  const hasBorderline = numericMarkers.some((m) => m.status === 'borderline');

  const rawPriority = String(parsed.priority ?? '').trim();
  let priority: ValidPriority = VALID_PRIORITIES.includes(rawPriority as ValidPriority)
    ? (rawPriority as ValidPriority)
    : hasGrowth || hasOutOfRange
      ? 'Follow-Up Recommended'
      : 'Routine';

  if (hasGrowth && priority === 'Routine') {
    priority = 'Prompt Doctor Review';
  }
  if (!hasGrowth && !hasOutOfRange && !hasBorderline && priority !== 'Routine') {
    priority = 'Routine';
  }

  const fallbackPriorityReason =
    priority === 'Routine'
      ? 'All extracted markers appear within standard reference ranges.'
      : priority === 'Prompt Doctor Review'
        ? 'Significant out-of-range markers or positive culture findings should be reviewed promptly with a clinician.'
        : 'One or more markers are outside or near reference limits and are worth discussing at a follow-up visit.';

  const extractedText = clampStr(parsed.extractedText, 50000, '');
  const combinedRawText = clampStr(
    rawInputText?.trim() || extractedText || 'Extracted from uploaded lab report.',
    50000,
    'Extracted from uploaded lab report.'
  );

  return {
    id: `report-${Date.now()}`,
    title: clampStr(parsed.title, 200, 'Analyzed Lab Report'),
    reportDate: clampStr(
      parsed.reportDate,
      60,
      new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    ),
    patientLabel: clampStr(
      parsed.patientLabel,
      120,
      fileName ? `Uploaded · ${fileName}`.slice(0, 120) : 'Patient Lab Panel'
    ),
    summaryBullets: normalizeSummaryBullets(
      parsed.summaryBullets,
      numericMarkers.length,
      cultureFindings.length
    ),
    priority,
    priorityReason: normalizeLocalizedText(parsed.priorityReason, fallbackPriorityReason),
    recommendedSpecialist: clampStr(
      parsed.recommendedSpecialist,
      120,
      hasGrowth ? 'Infectious Disease Specialist / Physician' : 'General Physician'
    ),
    specialistRationale: normalizeLocalizedText(
      parsed.specialistRationale,
      'A clinician can interpret these results in the context of your symptoms, medications, and health history.'
    ),
    numericMarkers,
    cultureFindings,
    rawReportText: combinedRawText,
    sourceType: hasFile ? ('file' as const) : ('text' as const),
  };
}

const localizedTextSchema = {
  type: Type.OBJECT,
  properties: {
    en: { type: Type.STRING, description: 'Clear, empathetic plain-English text.' },
    ta: { type: Type.STRING, description: 'Natural Tamil translation of the same text.' },
    hi: { type: Type.STRING, description: 'Natural Hindi translation of the same text.' },
  },
  required: ['en', 'ta', 'hi'],
};

const analyzeReportSchema = {
  type: Type.OBJECT,
  properties: {
    isValidLabReport: {
      type: Type.BOOLEAN,
      description:
        'True if the image/PDF/text contains recognizable medical laboratory test results or microbiology culture findings; false if illegible, blank, or unrelated non-medical content.',
    },
    rejectionReason: {
      type: Type.STRING,
      description:
        'Empty string when isValidLabReport is true. Otherwise, a brief, polite message explaining why the file/text could not be parsed as a lab report.',
    },
    title: { type: Type.STRING, description: 'Concise report title, e.g. Comprehensive Metabolic Panel' },
    reportDate: { type: Type.STRING, description: 'Report date found in text or Today' },
    patientLabel: { type: Type.STRING, description: 'Short non-PII descriptor like Adult Lab Panel or Blood Sample (never include real patient name, phone, or ID numbers)' },
    priority: {
      type: Type.STRING,
      description: 'Must be exactly one of: "Routine", "Follow-Up Recommended", "Prompt Doctor Review"',
    },
    priorityReason: localizedTextSchema,
    recommendedSpecialist: {
      type: Type.STRING,
      description: 'Most appropriate specialist type, e.g. Endocrinologist, Cardiologist, General Physician, Hematologist, Nephrologist, or Infectious Disease Specialist',
    },
    specialistRationale: localizedTextSchema,
    summaryBullets: {
      type: Type.OBJECT,
      properties: {
        en: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Exactly 3 calm plain-English bullets: 1) what is normal, 2) what is out of range or culture flagged, 3) next focus.',
        },
        ta: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Tamil translation of the 3 summary bullets.',
        },
        hi: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Hindi translation of the 3 summary bullets.',
        },
      },
      required: ['en', 'ta', 'hi'],
    },
    numericMarkers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: {
            type: Type.STRING,
            description:
              'Must be one of: "Blood Sugar & Diabetes", "Heart & Cholesterol", "Blood Cells", "Microbiology / Bacteria Culture", "Organ & Vitamin Health"',
          },
          name: { type: Type.STRING },
          value: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          referenceRangeText: { type: Type.STRING },
          refMin: { type: Type.NUMBER, description: 'Lower bound of normal range (use 0 if upper-bound only like <100).' },
          refMax: { type: Type.NUMBER, description: 'Upper bound of normal range (use a sensible normal ceiling if lower-bound only like >60, e.g. 120 for eGFR).' },
          displayMin: { type: Type.NUMBER, description: 'Sensible chart minimum below refMin and value.' },
          displayMax: { type: Type.NUMBER, description: 'Sensible chart maximum above refMax and value.' },
          status: {
            type: Type.STRING,
            description: 'Must be exactly one of: "normal", "borderline", "out_of_range"',
          },
          explanation: localizedTextSchema,
        },
        required: [
          'id',
          'category',
          'name',
          'value',
          'unit',
          'referenceRangeText',
          'refMin',
          'refMax',
          'displayMin',
          'displayMax',
          'status',
          'explanation',
        ],
      },
    },
    cultureFindings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: { type: Type.STRING, description: 'Always "Microbiology / Bacteria Culture"' },
          specimenType: { type: Type.STRING },
          collectionSite: { type: Type.STRING },
          incubationTime: { type: Type.STRING },
          organismDetected: { type: Type.STRING, description: 'Bacteria/organism name or "No Growth"' },
          isGrowthDetected: { type: Type.BOOLEAN },
          status: { type: Type.STRING, description: '"normal" if No Growth, "out_of_range" if pathogen detected' },
          sensitivityNotes: localizedTextSchema,
          antibiotics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                antibiotic: { type: Type.STRING },
                micOrZone: { type: Type.STRING },
                interpretation: {
                  type: Type.STRING,
                  description: 'Must be one of: "Susceptible", "Intermediate", "Resistant"',
                },
              },
              required: ['antibiotic', 'micOrZone', 'interpretation'],
            },
          },
        },
        required: [
          'id',
          'category',
          'specimenType',
          'collectionSite',
          'incubationTime',
          'organismDetected',
          'isGrowthDetected',
          'status',
          'sensitivityNotes',
          'antibiotics',
        ],
      },
    },
    extractedText: {
      type: Type.STRING,
      description: 'Clean plain-text transcription of the lab test lines extracted from the source report (excluding personal patient identifiers).',
    },
  },
  required: [
    'isValidLabReport',
    'rejectionReason',
    'title',
    'reportDate',
    'patientLabel',
    'priority',
    'priorityReason',
    'recommendedSpecialist',
    'specialistRationale',
    'summaryBullets',
    'numericMarkers',
    'cultureFindings',
    'extractedText',
  ],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.post('/api/analyze-report', async (req, res) => {
    try {
      const { text, file } = req.body as {
        text?: string;
        file?: { data: string; mimeType: string; name?: string };
      };

      const cleanedText = typeof text === 'string' ? text.trim() : '';
      const hasFile = Boolean(file?.data && file?.mimeType);

      if (!cleanedText && !hasFile) {
        res.status(400).json({
          error: 'Please provide lab report text or upload an image/PDF file.',
        });
        return;
      }

      const ai = getAiClient();
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (hasFile && file) {
        const cleanBase64 = file.data.includes(',') ? file.data.split(',')[1] : file.data;
        parts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: cleanBase64,
          },
        });
      }

      const promptInstruction = `You are MediGuide AI, an educational medical lab report explainer.
Analyze the provided real-world medical lab report (photo, scanned PDF, multi-column table, or pasted text) and extract ALL numeric lab markers and any microbiology/bacteria culture & antibiotic sensitivity findings into the structured JSON schema.

CRITICAL REAL-WORLD EXTRACTION RULES:
1. Read carefully across multi-page PDFs, skewed camera photos, Indian/US/UK/EU laboratory formats, and shorthand names (e.g., Hb/Hgb, TLC/WBC, Plt, SGPT/ALT, SGOT/AST, FBS/PPBS, HbA1c, eGFR, TSH, FT3/FT4, Vit D 25-OH, Vit B12, CRP, ESR, Ferritin).
2. Protect privacy: DO NOT put personal patient names, addresses, phone numbers, or hospital MRN/IDs in patientLabel or extractedText. Use a generic non-PII descriptor like "Adult Outpatient Lab Panel" or "Blood & Lipid Panel".
3. Handle one-sided or special reference ranges accurately:
   - "< 200" or "<= 199" -> refMin: 0, refMax: 200 (keep "< 200" in referenceRangeText).
   - "> 60" (e.g., eGFR or HDL) -> refMin: 60, refMax: 120 (keep "> 60" in referenceRangeText).
   - Strip thousands commas in numbers (e.g., "1,45,000" or "250,000" -> 145000 or 250000).
   - Ensure displayMin < Math.min(refMin, value) and displayMax > Math.max(refMax, value) for clean visual range bars.
4. Categorize EVERY numeric marker strictly into one of:
   - "Blood Sugar & Diabetes"
   - "Heart & Cholesterol"
   - "Blood Cells"
   - "Microbiology / Bacteria Culture"
   - "Organ & Vitamin Health"
5. If microbiology culture or antibiotic susceptibility (S / I / R, MIC, zone diameter) is present, populate cultureFindings accurately.
6. Classify status strictly as "normal", "borderline", or "out_of_range".
7. Provide calm, empathetic, educational explanations in English (en), Tamil (ta), and Hindi (hi). Never prescribe specific medicines or dosages.
8. Set priority to "Prompt Doctor Review" if any bacterial pathogen grew in culture or any value is markedly abnormal, "Follow-Up Recommended" if mild/moderate abnormalities exist, or "Routine" if all markers are normal.
9. Provide 3 summaryBullets per language: 1) normal findings, 2) abnormal/flagged or culture findings, 3) practical next steps to discuss with a clinician.
10. If the input is blank, completely blurry/illegible, or clearly NOT a medical lab report (e.g., a landscape photo or random receipt), set isValidLabReport: false and explain politely in rejectionReason without inventing test values.
${cleanedText ? `\nPasted or supplementary report text:\n${cleanedText}` : ''}`;

      parts.push({ text: promptInstruction });

      const response = await generateContentWithRetry(ai, {
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: analyzeReportSchema,
        },
        primaryThinkingLevel: ThinkingLevel.MEDIUM,
      });

      const rawJson = stripJsonCodeFences(response.text ?? '{}');
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawJson);
      } catch (parseErr) {
        console.error('Failed to parse Gemini JSON output:', rawJson.slice(0, 500), parseErr);
        throw new HttpAppError(
          502,
          'The AI returned an incomplete structure while reading that report. Please retry.'
        );
      }

      const report = normalizeAnalyzedReport(parsed, cleanedText, file?.name, hasFile);
      res.json({ report });
    } catch (err: unknown) {
      const parsed = parseGeminiError(err);
      console.error('Analyze report error:', parsed.statusCode, parsed.statusText, parsed.message);
      res.status(parsed.statusCode).json({ error: parsed.message });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, report, language } = req.body as {
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        report: Record<string, unknown> | null;
        language?: 'en' | 'ta' | 'hi';
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Conversation messages are required.' });
        return;
      }

      const ai = getAiClient();

      const languageName =
        language === 'ta' ? 'Tamil (தமிழ்)' : language === 'hi' ? 'Hindi (हिन्दी)' : 'English';

      // Keep prompt lean by trimming massive rawReportText in chat context
      const compactReport =
        report && typeof report === 'object'
          ? {
              ...report,
              rawReportText:
                typeof report.rawReportText === 'string'
                  ? report.rawReportText.slice(0, 6000)
                  : '',
            }
          : report;

      const systemInstruction = `You are MediGuide AI's "AI Care & Doctor Prep Guide" — an empathetic, clear, and trustworthy Lab Report Explainer & Health Navigator.

STRICT SAFETY & COMMUNICATION RULES:
1. NEVER prescribe, recommend, or calculate specific medicines, antibiotics, supplements with clinical doses, or drug dosages. If a user asks what medicine or dose to take, gently remind them that only a licensed clinician who examines them and knows their full history/allergies can prescribe medications, and offer helpful questions they can ask their doctor.
2. NEVER claim to provide a medical diagnosis. Use supportive educational language like "often reflects", "can be associated with", "worth discussing with your clinician".
3. Ground every answer directly in the patient's active lab report data below (quote exact test names, values, units, and reference ranges when relevant).
4. Suggest practical, general evidence-based nutrition and lifestyle habits to discuss with a doctor (e.g., fiber-rich meals, regular walking, hydration, sleep).
5. Respond in ${languageName} unless the user explicitly requests a different language in their message. Keep formatting clean, scannable (short paragraphs or bullet points), and reassuring.

ACTIVE PATIENT LAB REPORT CONTEXT:
${JSON.stringify(compactReport, null, 2)}`;

      const conversationText = messages
        .slice(-20)
        .map((m) => `${m.role === 'user' ? 'Patient' : 'MediGuide AI'}: ${m.content}`)
        .join('\n\n');

      const response = await generateContentWithRetry(ai, {
        contents: conversationText,
        config: {
          systemInstruction,
        },
        primaryThinkingLevel: ThinkingLevel.LOW,
      });

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: 'Empty response received from Gemini AI. Please try again.' });
        return;
      }

      res.json({ reply });
    } catch (err: unknown) {
      const parsed = parseGeminiError(err);
      console.error('Chat error:', parsed.statusCode, parsed.statusText, parsed.message);
      res.status(parsed.statusCode).json({ error: parsed.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MediGuide AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
