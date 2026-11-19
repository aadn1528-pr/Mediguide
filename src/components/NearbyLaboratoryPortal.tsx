/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Flame,
  Home,
  Inbox,
  Link as LinkIcon,
  LocateFixed,
  MapPin,
  Microscope,
  Navigation,
  Phone,
  Printer,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  TestTube2,
  User,
} from 'lucide-react';
import {
  DEFAULT_NEARBY_LABS,
  GMP_ATTRIBUTION_ID,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
  NearbyLaboratory,
} from '../lib/mapsConfig';
import type { AnalyzedLabReport, Language } from '../types/lab';

export interface TransmittedLabReportRecord {
  id: string;
  labId: string;
  labName: string;
  accessionNumber: string;
  transmittedAt: string;
  verifyingPathologist: string;
  status: 'released' | 'preliminary';
  report: AnalyzedLabReport;
  clinicalNotes?: string;
}

interface NearbyLaboratoryPortalProps {
  activeReport: AnalyzedLabReport;
  language: Language;
  linkedLab: NearbyLaboratory | null;
  onLinkLab: (lab: NearbyLaboratory) => void;
  onUnlinkLab: () => void;
  onReturnToPatientView: () => void;
  onAccessReport: (report: AnalyzedLabReport) => void;
  transmittedReports: TransmittedLabReportRecord[];
  onTransmitNewReport: (record: TransmittedLabReportRecord) => Promise<void>;
}

// Built-in verified laboratory transmission templates
const PRESET_TRANSMISSIONS: Array<{
  id: string;
  title: string;
  labName: string;
  labId: string;
  accessionNumber: string;
  verifyingPathologist: string;
  description: string;
  report: AnalyzedLabReport;
  clinicalNotes: string;
}> = [
  {
    id: 'trans-apex-metabolic-followup',
    title: 'Apex Diagnostics · Confirmatory Metabolic & Lipid Panel',
    labName: 'Apex Diagnostic & Reference Pathology',
    labId: 'lab-apex-diag',
    accessionNumber: 'APX-2026-98214',
    verifyingPathologist: 'Dr. K. Ramanathan, MD (Pathology), Lab Director',
    description: 'Post-intervention fasting glucose, HbA1c, and full lipid fractionation showing normalized parameters.',
    clinicalNotes: 'Specimen collected at 07:15 AM after 10 hours fasting. Specimen non-hemolyzed, non-lipemic. Confirmatory testing shows significant improvement in lipid fractions and fasting glucose.',
    report: {
      id: 'report-apex-confirmatory-98214',
      presetKey: 'apex-metabolic-confirm',
      title: 'Apex Diagnostics · Confirmatory Metabolic & Lipid Panel',
      reportDate: '19 Nov 2026 (10:30 AM)',
      patientLabel: 'Apex Diag Acc #APX-98214 · Fasting Specimen',
      priority: 'Routine',
      priorityReason: {
        en: 'Fasting glucose, triglycerides, and total cholesterol have normalized within standard reference intervals.',
        ta: 'வெறும் வயிற்று சர்க்கரை மற்றும் கொலஸ்ட்ரால் அளவுகள் இயல்பான அளவிற்கு திரும்பியுள்ளன.',
        hi: 'खाली पेट शुगर और कोलेस्ट्रॉल सामान्य संदर्भ सीमा में वापस आ गए हैं।',
      },
      recommendedSpecialist: 'General Physician or Endocrinologist',
      specialistRationale: {
        en: 'Continue routine 6-month preventive monitoring with your physician to sustain these improved cardiometabolic levels.',
        ta: 'இந்த முன்னேற்றத்தைத் தொடர உங்கள் மருத்துவரிடம் 6 மாதங்களுக்கு ஒருமுறை வழக்கமான பரிசோதனை செய்து கொள்ளவும்.',
        hi: 'इस सुधार को बनाए रखने के लिए अपने डॉक्टर के साथ हर 6 महीने में नियमित जांच जारी रखें।',
      },
      summaryBullets: {
        en: [
          'Excellent progress: Fasting blood glucose (94 mg/dL) and Triglycerides (138 mg/dL) have returned to healthy normal reference ranges.',
          'HbA1c has improved to 6.0% (down from previous 6.8%), indicating positive response to dietary moderation and regular physical activity.',
          'Next focus: Maintain current balanced nutrition and schedule routine preventive labs in 6 months.',
        ],
        ta: [
          'சிறந்த முன்னேற்றம்: வெறும் வயிற்று சர்க்கரை (94 mg/dL) மற்றும் ட்ரைகிளிசரைடுகள் இயல்பான அளவிற்கு வந்துள்ளன.',
          'HbA1c அளவு 6.0% ஆக குறைந்துள்ளது, இது உணவு முறை மாற்றங்களின் பயனை காட்டுகிறது.',
          'அடுத்த படி: தற்போதைய ஆரோக்கியமான உணவுப் பழக்கத்தைத் தொடரவும்.',
        ],
        hi: [
          'उत्कृष्ट सुधार: खाली पेट शुगर (94 mg/dL) और ट्राइग्लिसराइड्स सामान्य सीमा में आ गए हैं।',
          'HbA1c घटकर 6.0% हो गया है, जो सकारात्मक परिणाम दर्शाता है।',
          'अगला कदम: संतुलित आहार जारी रखें और 6 महीने बाद नियमित जांच कराएं।',
        ],
      },
      numericMarkers: [
        {
          id: 'm-fbs-apex',
          category: 'Blood Sugar & Diabetes',
          name: 'Fasting Blood Glucose (FBS)',
          value: 94,
          unit: 'mg/dL',
          referenceRangeText: '70 - 99 mg/dL (Normal)',
          refMin: 70,
          refMax: 99,
          displayMin: 50,
          displayMax: 160,
          status: 'normal',
          explanation: {
            en: 'Your fasting blood glucose measured 94 mg/dL, which is inside the healthy normal range.',
            ta: 'உங்கள் வெறும் வயிற்று சர்க்கரை 94 mg/dL ஆக உள்ளது, இது முற்றிலும் இயல்பான அளவு.',
            hi: 'आपकी खाली पेट शुगर 94 mg/dL है, जो सामान्य और स्वस्थ सीमा में है।',
          },
        },
        {
          id: 'm-hba1c-apex',
          category: 'Blood Sugar & Diabetes',
          name: 'HbA1c (Glycated Hemoglobin)',
          value: 6.0,
          unit: '%',
          referenceRangeText: '< 5.7 % (Normal), 5.7 - 6.4 % (Prediabetes)',
          refMin: 4.0,
          refMax: 5.6,
          displayMin: 4.0,
          displayMax: 9.0,
          status: 'borderline',
          explanation: {
            en: 'Your HbA1c is 6.0%, showing marked improvement from previous elevated baseline.',
            ta: 'உங்கள் HbA1c 6.0% ஆக குறைந்துள்ளது.',
            hi: 'आपका HbA1c 6.0% है, जो पहले की तुलना में बेहतर है।',
          },
        },
        {
          id: 'm-chol-apex',
          category: 'Heart & Cholesterol',
          name: 'Total Cholesterol',
          value: 178,
          unit: 'mg/dL',
          referenceRangeText: '< 200 mg/dL (Desirable)',
          refMin: 0,
          refMax: 200,
          displayMin: 100,
          displayMax: 260,
          status: 'normal',
          explanation: {
            en: 'Total cholesterol is 178 mg/dL, within the desirable heart-healthy range.',
            ta: 'மொத்த கொலஸ்ட்ரால் 178 mg/dL, இயல்பான அளவில் உள்ளது.',
            hi: 'कुल कोलेस्ट्रॉल 178 mg/dL है, जो सामान्य है।',
          },
        },
        {
          id: 'm-ldl-apex',
          category: 'Heart & Cholesterol',
          name: 'LDL ("Bad") Cholesterol',
          value: 108,
          unit: 'mg/dL',
          referenceRangeText: '< 100 mg/dL (Optimal), 100 - 129 mg/dL (Near optimal)',
          refMin: 0,
          refMax: 100,
          displayMin: 40,
          displayMax: 180,
          status: 'borderline',
          explanation: {
            en: 'LDL cholesterol is 108 mg/dL, near optimal and well-controlled.',
            ta: 'LDL கொலஸ்ட்ரால் 108 mg/dL, கட்டுப்பாட்டில் உள்ளது.',
            hi: 'LDL कोलेस्ट्रॉल 108 mg/dL है, जो नियंत्रण में है।',
          },
        },
        {
          id: 'm-hdl-apex',
          category: 'Heart & Cholesterol',
          name: 'HDL ("Protective") Cholesterol',
          value: 48,
          unit: 'mg/dL',
          referenceRangeText: '> 40 mg/dL (Protective)',
          refMin: 40,
          refMax: 80,
          displayMin: 20,
          displayMax: 90,
          status: 'normal',
          explanation: {
            en: 'Protective HDL cholesterol is 48 mg/dL, exceeding minimum protective thresholds.',
            ta: 'நல்ல கொலஸ்ட்ரால் 48 mg/dL, பாதுகாப்பான அளவில் உள்ளது.',
            hi: 'सुरक्षात्मक HDL कोलेस्ट्रॉल 48 mg/dL है।',
          },
        },
        {
          id: 'm-trig-apex',
          category: 'Heart & Cholesterol',
          name: 'Triglycerides',
          value: 138,
          unit: 'mg/dL',
          referenceRangeText: '< 150 mg/dL (Normal)',
          refMin: 0,
          refMax: 150,
          displayMin: 50,
          displayMax: 250,
          status: 'normal',
          explanation: {
            en: 'Triglycerides have normalized to 138 mg/dL.',
            ta: 'ட்றைகிளிசரைடுகள் 138 mg/dL ஆக இயல்பு நிலைக்கு வந்துள்ளது.',
            hi: 'ट्राइग्लिसराइड्स 138 mg/dL होकर सामान्य हो गए हैं।',
          },
        },
      ],
      cultureFindings: [],
      rawReportText: 'Apex Diagnostic & Reference Pathology\nAcc: APX-2026-98214\nPatient: Outpatient Adult\nFasting Blood Glucose: 94 mg/dL (70-99)\nHbA1c: 6.0% (<5.7)\nTotal Cholesterol: 178 mg/dL (<200)\nLDL: 108 mg/dL (<100)\nHDL: 48 mg/dL (>40)\nTriglycerides: 138 mg/dL (<150)',
      sourceType: 'text',
    },
  },
  {
    id: 'trans-pathocare-culture',
    title: 'PathoCare · 48h Blood Culture & MIC Antibiotic Susceptibility',
    labName: 'PathoCare Clinical Pathology & Microbiology',
    labId: 'lab-pathocare-clinic',
    accessionNumber: 'PTC-2026-44091',
    verifyingPathologist: 'Dr. Sunita Mehta, MD (Medical Microbiology)',
    description: 'Automated BACTEC blood culture grew Staphylococcus aureus with full automated VITEK-2 MIC susceptibility table.',
    clinicalNotes: 'CRITICAL VALUE ALERT: Positive bacterial isolate confirmed. Susceptible to Vancomycin and Linezolid. Resistant to Oxacillin/Methicillin. Immediate clinical review advised.',
    report: {
      id: 'report-pathocare-culture-44091',
      presetKey: 'pathocare-culture-confirm',
      title: 'PathoCare · 48h Blood Culture & MIC Antibiotic Susceptibility',
      reportDate: '19 Nov 2026 (08:45 AM)',
      patientLabel: 'PathoCare Acc #PTC-44091 · Blood Specimen x2 Sets',
      priority: 'Prompt Doctor Review',
      priorityReason: {
        en: 'Blood culture grew Staphylococcus aureus. Targeted antibiotic sensitivities are confirmed.',
        ta: 'இரத்த வளர்ப்பில் பாக்டீரியா வளர்ச்சி கண்டறியப்பட்டுள்ளது. உடனடி மருத்துவ ஆலோசனை தேவை.',
        hi: 'रक्त संवर्धन में बैक्टीरिया की पुष्टि हुई है। तत्काल चिकित्सक समीक्षा आवश्यक है।',
      },
      recommendedSpecialist: 'Infectious Disease Specialist or Attending Physician',
      specialistRationale: {
        en: 'An Infectious Disease specialist can select the appropriate IV or oral antibiotic based on the in vitro MIC susceptibility results.',
        ta: 'பாக்டீரியா எதிர்ப்பு மருந்து அட்டவணையின் அடிப்படையில் சரியான சிகிச்சையை தேர்வு செய்ய தொற்றுநோய் மருத்துவர் உதவ முடியும்.',
        hi: 'संक्रामक रोग विशेषज्ञ इस एंटीबायोटिक संवेदनशीलता रिपोर्ट के आधार पर सही दवा का चयन कर सकते हैं।',
      },
      summaryBullets: {
        en: [
          'Organism Confirmed: Staphylococcus aureus grew from blood culture bottles within 24 hours of incubation.',
          'Susceptibility Table: Isolate is susceptible in vitro to Vancomycin (MIC <= 1 ug/mL), Linezolid, and Daptomycin.',
          'Critical next step: Present this report immediately to your physician or infectious disease specialist to receive targeted antibiotic treatment.',
        ],
        ta: [
          'இரத்த வளர்ப்பு முடிவு: Staphylococcus aureus பாக்டீரியா 24 மணி நேரத்திற்குள் வளர்ந்துள்ளது.',
          'மருந்து எதிர்ப்புத் திறன்: Vancomycin மற்றும் Linezolid மருந்துகளுக்கு இந்த பாக்டீரியா கட்டுப்படுகிறது.',
          'அடுத்த கட்ட நடவடிக்கை: உங்கள் மருத்துவரை உடனடியாக அணுகி சிகிச்சை பெறவும்.',
        ],
        hi: [
          'बैक्टीरिया की पुष्टि: 24 घंटे में Staphylococcus aureus बैक्टीरिया विकसित हुआ।',
          'एंटीबायोटिक संवेदनशीलता: यह बैक्टीरिया Vancomycin और Linezolid दवाओं के प्रति संवेदनशील है।',
          'महत्वपूर्ण कदम: तुरंत अपने डॉक्टर से मिलकर उचित एंटीबायोटिक उपचार शुरू करें।',
        ],
      },
      numericMarkers: [
        {
          id: 'm-wbc-patho',
          category: 'Blood Cells',
          name: 'Total Leukocyte Count (WBC)',
          value: 12800,
          unit: '/uL',
          referenceRangeText: '4,000 - 11,000 /uL',
          refMin: 4000,
          refMax: 11000,
          displayMin: 2000,
          displayMax: 20000,
          status: 'out_of_range',
          explanation: {
            en: 'White blood cells are elevated at 12,800 /uL in response to the bacterial infection.',
            ta: 'பாக்டீரியா தொற்று காரணமாக வெள்ளை இரத்த அணுக்கள் 12,800 /uL ஆக உயர்ந்துள்ளன.',
            hi: 'संक्रमण के कारण श्वेत रक्त कोशिकाएं 12,800 /uL तक बढ़ गई हैं।',
          },
        },
        {
          id: 'm-crp-patho',
          category: 'Organ & Vitamin Health',
          name: 'C-Reactive Protein (hs-CRP)',
          value: 28.4,
          unit: 'mg/L',
          referenceRangeText: '< 5.0 mg/L (Normal)',
          refMin: 0,
          refMax: 5.0,
          displayMin: 0,
          displayMax: 60,
          status: 'out_of_range',
          explanation: {
            en: 'CRP inflammatory marker is significantly elevated at 28.4 mg/L.',
            ta: 'உடலில் ஏற்பட்டுள்ள அழற்சி காரணமாக CRP 28.4 mg/L ஆக உள்ளது.',
            hi: 'शरीर में सूजन/संक्रमण के कारण CRP 28.4 mg/L तक बढ़ा हुआ है।',
          },
        },
      ],
      cultureFindings: [
        {
          id: 'c-patho-saureus',
          category: 'Microbiology / Bacteria Culture',
          specimenType: 'Blood Culture (Dual Sets)',
          collectionSite: 'Peripheral Venipuncture x 2',
          incubationTime: '48 hours (Growth at 22 hours)',
          organismDetected: 'Staphylococcus aureus',
          isGrowthDetected: true,
          status: 'out_of_range',
          sensitivityNotes: {
            en: 'Positive for Staphylococcus aureus. Susceptible to Vancomycin and Linezolid. Resistant to Oxacillin/Cefazolin.',
            ta: 'Staphylococcus aureus பாக்டீரியா கண்டறியப்பட்டது. Vancomycin மருந்துக்கு கட்டுப்படுகிறது.',
            hi: 'Staphylococcus aureus पाया गया। Vancomycin के प्रति संवेदनशील।',
          },
          antibiotics: [
            { antibiotic: 'Vancomycin', micOrZone: '<= 1 ug/mL', interpretation: 'Susceptible' },
            { antibiotic: 'Linezolid', micOrZone: '<= 2 ug/mL', interpretation: 'Susceptible' },
            { antibiotic: 'Daptomycin', micOrZone: '0.5 ug/mL', interpretation: 'Susceptible' },
            { antibiotic: 'Rifampin', micOrZone: '<= 1 ug/mL', interpretation: 'Susceptible' },
            { antibiotic: 'Oxacillin', micOrZone: '>= 4 ug/mL', interpretation: 'Resistant' },
            { antibiotic: 'Cefazolin', micOrZone: '>= 16 ug/mL', interpretation: 'Resistant' },
            { antibiotic: 'Ampicillin', micOrZone: '>= 8 ug/mL', interpretation: 'Resistant' },
          ],
        },
      ],
      rawReportText: 'PathoCare Clinical Microbiology\nAcc: PTC-2026-44091\nBlood Culture: Staphylococcus aureus detected\nAST Table:\nVancomycin: Susceptible (<=1)\nLinezolid: Susceptible (<=2)\nDaptomycin: Susceptible (0.5)\nOxacillin: Resistant (>=4)\nWBC: 12,800 /uL\nCRP: 28.4 mg/L',
      sourceType: 'text',
    },
  },
  {
    id: 'trans-metropolis-hematology',
    title: 'Metropolis Care · Complete Blood Count & Serum Ferritin',
    labName: 'Metropolis Care Molecular Lab & Phlebotomy',
    labId: 'lab-metropolis-care',
    accessionNumber: 'MTR-2026-77312',
    verifyingPathologist: 'Dr. A. Sengupta, MD (Hematopathology)',
    description: 'Comprehensive automated hematology panel with red cell indices and serum ferritin evaluation.',
    clinicalNotes: 'Blood sample non-hemolyzed. Microcytic red cell indices noted alongside low serum ferritin.',
    report: {
      id: 'report-metropolis-cbc-77312',
      presetKey: 'metropolis-hematology',
      title: 'Metropolis Care · Complete Blood Count & Serum Ferritin',
      reportDate: '18 Nov 2026 (04:15 PM)',
      patientLabel: 'Metropolis Care Acc #MTR-77312 · EDTA Whole Blood',
      priority: 'Follow-Up Recommended',
      priorityReason: {
        en: 'Hemoglobin and Serum Ferritin indicate mild iron depletion that is easily treatable.',
        ta: 'ஹீமோகுளோபின் மற்றும் ஃபெரிட்டின் அளவு சற்று குறைவாக உள்ளதால் இரும்புச்சத்து ஆலோசனை பரிந்துரைக்கப்படுகிறது.',
        hi: 'हीमोग्लोबिन और फेरिटिन का स्तर हल्का कम है, डॉक्टर से परामर्श लें।',
      },
      recommendedSpecialist: 'Hematologist or General Physician',
      specialistRationale: {
        en: 'A physician can advise on dietary iron sources and whether oral iron supplementation is appropriate.',
        ta: 'இரும்புச்சத்து நிறைந்த உணவுகள் மற்றும் மருந்துகள் குறித்து மருத்துவர் ஆலோசனை வழங்குவார்.',
        hi: 'डॉक्टर आयरन युक्त आहार और सप्लीमेंट्स पर सलाह दे सकते हैं।',
      },
      summaryBullets: {
        en: [
          'Platelets (260,000 /uL) and White Blood Cell counts (6,200 /uL) are completely normal.',
          'Hemoglobin is mildly low at 11.2 g/dL and Serum Ferritin is 12 ng/mL, consistent with low iron reserves.',
          'Next focus: Review nutrition with your clinician to safely replenish iron stores.',
        ],
        ta: [
          'இரத்த தட்டணுக்கள் மற்றும் வெள்ளை அணுக்கள் இயல்பான அளவில் உள்ளன.',
          'ஹீமோகுளோபின் (11.2 g/dL) மற்றும் ஃபெரிட்டின் (12 ng/mL) சற்று குறைவாக உள்ளன.',
          'அடுத்த படி: இரும்புச்சத்து நிறைந்த உணவுகளை உணவில் சேர்த்துக் கொள்ளவும்.',
        ],
        hi: [
          'प्लेटलेट्स और श्वेत रक्त कोशिकाएं पूरी तरह सामान्य हैं।',
          'हीमोग्लोबिन (11.2 g/dL) और सीरम फेरिटिन (12 ng/mL) थोड़ा कम है।',
          'अगला कदम: डॉक्टर से मिलकर आयरन की कमी दूर करने के उपाय जानें।',
        ],
      },
      numericMarkers: [
        {
          id: 'm-hb-metro',
          category: 'Blood Cells',
          name: 'Hemoglobin (Hb)',
          value: 11.2,
          unit: 'g/dL',
          referenceRangeText: '12.0 - 15.5 g/dL',
          refMin: 12.0,
          refMax: 15.5,
          displayMin: 8.0,
          displayMax: 18.0,
          status: 'borderline',
          explanation: {
            en: 'Hemoglobin measured 11.2 g/dL, mildly below target range.',
            ta: 'ஹீமோகுளோபின் 11.2 g/dL ஆக உள்ளது.',
            hi: 'हीमोग्लोबिन 11.2 g/dL है, जो सामान्य से थोड़ा कम है।',
          },
        },
        {
          id: 'm-ferritin-metro',
          category: 'Organ & Vitamin Health',
          name: 'Serum Ferritin (Iron Storage)',
          value: 12,
          unit: 'ng/mL',
          referenceRangeText: '20 - 200 ng/mL',
          refMin: 20,
          refMax: 200,
          displayMin: 0,
          displayMax: 250,
          status: 'out_of_range',
          explanation: {
            en: 'Serum Ferritin is 12 ng/mL, indicating low iron reserves.',
            ta: 'ஃபெரிட்டின் அளவு 12 ng/mL, இரும்பு இருப்பு குறைவாக இருப்பதைக் காட்டுகிறது.',
            hi: 'सीरम फेरिटिन 12 ng/mL है, जो कम आयरन स्टोर को दर्शाता है।',
          },
        },
        {
          id: 'm-wbc-metro',
          category: 'Blood Cells',
          name: 'White Blood Cells (WBC)',
          value: 6200,
          unit: '/uL',
          referenceRangeText: '4,000 - 11,000 /uL',
          refMin: 4000,
          refMax: 11000,
          displayMin: 2000,
          displayMax: 15000,
          status: 'normal',
          explanation: {
            en: 'White blood cells are healthy at 6,200 /uL.',
            ta: 'வெள்ளை இரத்த அணுக்கள் 6,200 /uL என இயல்பாக உள்ளன.',
            hi: 'श्वेत रक्त कोशिकाएं 6,200 /uL के साथ सामान्य हैं।',
          },
        },
        {
          id: 'm-plt-metro',
          category: 'Blood Cells',
          name: 'Platelet Count',
          value: 260000,
          unit: '/uL',
          referenceRangeText: '150,000 - 450,000 /uL',
          refMin: 150000,
          refMax: 450000,
          displayMin: 100000,
          displayMax: 500000,
          status: 'normal',
          explanation: {
            en: 'Platelet count is optimal at 260,000 /uL.',
            ta: 'இரத்த தட்டணுக்கள் 260,000 /uL என இயல்பாக உள்ளன.',
            hi: 'प्लेटलेट काउंट 260,000 /uL के साथ पूरी तरह सामान्य है।',
          },
        },
      ],
      cultureFindings: [],
      rawReportText: 'Metropolis Care Molecular Lab\nAcc: MTR-2026-77312\nHemoglobin: 11.2 g/dL (12.0-15.5)\nSerum Ferritin: 12 ng/mL (20-200)\nWBC: 6,200 /uL (4000-11000)\nPlatelets: 260,000 /uL (150000-450000)',
      sourceType: 'text',
    },
  },
];

// Helper to center the map when user location or selected lab changes
function MapRecenterController({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.panTo(center);
    }
  }, [map, center]);
  return null;
}

export const NearbyLaboratoryPortal: React.FC<NearbyLaboratoryPortalProps> = ({
  activeReport,
  language,
  linkedLab,
  onLinkLab,
  onUnlinkLab,
  onReturnToPatientView,
  onAccessReport,
  transmittedReports,
  onTransmitNewReport,
}) => {
  // Navigation mode within Laboratory Portal
  const [activeTab, setActiveTab] = useState<'locator' | 'inbox' | 'dispatch'>('locator');

  // Geolocation state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({
    lat: 19.076,
    lng: 72.8777,
  });
  const [locationLabel, setLocationLabel] = useState('Current Region (Detected)');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Labs list & selection
  const [laboratories, setLaboratories] = useState<NearbyLaboratory[]>(DEFAULT_NEARBY_LABS);
  const [selectedLabId, setSelectedLabId] = useState<string>(
    linkedLab?.id || DEFAULT_NEARBY_LABS[0].id
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [filterOpenNow, setFilterOpenNow] = useState(false);
  const [filterHomeCollection, setFilterHomeCollection] = useState(false);
  const [filterMicrobiology, setFilterMicrobiology] = useState(false);

  // Quota exceeded state
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Home sample request modal state
  const [bookingLab, setBookingLab] = useState<NearbyLaboratory | null>(null);
  const [bookingDate, setBookingDate] = useState('Tomorrow Morning (7:00 AM – 9:00 AM)');
  const [bookingAddress, setBookingAddress] = useState('Residence, Patient Location');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Transmission Desk State
  const [selectedPresetTemplateId, setSelectedPresetTemplateId] = useState<string>(
    PRESET_TRANSMISSIONS[0].id
  );
  const [dispatchLabName, setDispatchLabName] = useState(
    linkedLab?.name || DEFAULT_NEARBY_LABS[0].name
  );
  const [dispatchAccession, setDispatchAccession] = useState(
    `LAB-${Date.now().toString().slice(-6)}`
  );
  const [dispatchPathologist, setDispatchPathologist] = useState(
    'Dr. K. Ramanathan, MD (Pathology)'
  );
  const [dispatchNotes, setDispatchNotes] = useState(
    'Specimen analyzed on automated analyzer. Results verified against quality controls and transmitted to patient app.'
  );
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmissionSuccessMsg, setTransmissionSuccessMsg] = useState<string | null>(null);

  // Sync dispatch lab name if linkedLab changes
  useEffect(() => {
    if (linkedLab) {
      setDispatchLabName(linkedLab.name);
    }
  }, [linkedLab]);

  // Listen to global gmp-quota-exceeded event
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Request browser geolocation on mount
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newCoords = { lat: latitude, lng: longitude };
        setUserLocation(newCoords);
        setLocationLabel('My GPS Location');
        setIsLocating(false);

        // Recalculate realistic distances from user's actual coordinates
        setLaboratories((prev) =>
          prev
            .map((lab, idx) => {
              const latDiff = (lab.lat - latitude) * 111;
              const lngDiff = (lab.lng - longitude) * 111 * Math.cos((latitude * Math.PI) / 180);
              const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
              const distanceKm = Math.max(0.4, Math.round((dist || (idx + 1) * 0.9) * 10) / 10);
              return {
                ...lab,
                distanceKm,
              };
            })
            .sort((a, b) => a.distanceKm - b.distanceKm)
        );
      },
      (err) => {
        setIsLocating(false);
        setLocationError(`Location request: ${err.message}. Using default medical center area.`);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  // Filter laboratories based on active search and toggles
  const filteredLabs = useMemo(() => {
    return laboratories.filter((lab) => {
      if (filterOpenNow && !lab.openNow) return false;
      if (filterHomeCollection && !lab.homeCollectionAvailable) return false;
      if (
        filterMicrobiology &&
        !lab.capabilities.some((c) => /culture|microbiology|ast|susceptibility/i.test(c))
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = lab.name.toLowerCase().includes(q);
        const matchAddress = lab.address.toLowerCase().includes(q);
        const matchCap = lab.capabilities.some((c) => c.toLowerCase().includes(q));
        return matchName || matchAddress || matchCap;
      }
      return true;
    });
  }, [laboratories, filterOpenNow, filterHomeCollection, filterMicrobiology, searchQuery]);

  const selectedLab = useMemo(() => {
    return (
      filteredLabs.find((l) => l.id === selectedLabId) ||
      laboratories.find((l) => l.id === selectedLabId) ||
      filteredLabs[0] ||
      laboratories[0]
    );
  }, [filteredLabs, laboratories, selectedLabId]);

  // Derive recommended laboratory follow-up tests based on active report anomalies
  const flaggedMarkers = useMemo(() => {
    return activeReport.numericMarkers.filter((m) => m.status !== 'normal');
  }, [activeReport]);

  const cultureAnomalies = useMemo(() => {
    return activeReport.cultureFindings.filter((c) => c.isGrowthDetected);
  }, [activeReport]);

  const recommendedRequisitions = useMemo(() => {
    const list: string[] = [];
    if (cultureAnomalies.length > 0) {
      list.push(
        `Repeat Blood Culture x 2 sets (Aerobic & Anaerobic) for ${cultureAnomalies[0].organismDetected}`
      );
      list.push('Automated Antibiotic Susceptibility Testing (MIC Confirmation)');
    }
    const hasMetabolic = flaggedMarkers.some((m) => m.category === 'Blood Sugar & Diabetes');
    if (hasMetabolic) {
      list.push('Fasting Blood Glucose (FBS) & Postprandial Glucose (PPBS)');
      list.push('High-Performance Liquid Chromatography (HPLC) HbA1c');
    }
    const hasLipid = flaggedMarkers.some((m) => m.category === 'Heart & Cholesterol');
    if (hasLipid) {
      list.push('Comprehensive Lipid Profile (Cholesterol, HDL, LDL, Triglycerides)');
    }
    const hasBloodCells = flaggedMarkers.some((m) => m.category === 'Blood Cells');
    if (hasBloodCells) {
      list.push('Complete Blood Count (CBC) with Automated Differential');
      list.push('Peripheral Blood Smear (PBS) Examination & Serum Ferritin');
    }
    const hasOrgan = flaggedMarkers.some((m) => m.category === 'Organ & Vitamin Health');
    if (hasOrgan) {
      list.push('Renal Function Test (eGFR, Serum Creatinine, Blood Urea)');
      list.push('Liver Function Panel (ALT/SGPT, AST/SGOT, Bilirubin, Alkaline Phosphatase)');
      list.push('25-Hydroxy Vitamin D & Serum Vitamin B12 Immunoassay');
    }

    if (list.length === 0) {
      list.push('Routine Preventive Health Checkup Panel (CBC, FBS, Lipid Profile)');
      list.push('Confirmatory Baseline Organ Health Screening');
    }
    return list;
  }, [flaggedMarkers, cultureAnomalies]);

  // Handle Lab Transmission Dispatch
  const handleDispatchReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTransmitting(true);
    setTransmissionSuccessMsg(null);

    const template =
      PRESET_TRANSMISSIONS.find((t) => t.id === selectedPresetTemplateId) ||
      PRESET_TRANSMISSIONS[0];

    const customizedReport: AnalyzedLabReport = {
      ...template.report,
      id: `lab-report-${Date.now()}`,
      title: `${dispatchLabName} · ${template.report.title.split('·')[1]?.trim() || template.report.title}`,
      patientLabel: `${dispatchLabName} Acc #${dispatchAccession} · Verified Specimen`,
      reportDate: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    };

    const newRecord: TransmittedLabReportRecord = {
      id: `trans-${Date.now()}`,
      labId: selectedLab?.id || 'lab-custom',
      labName: dispatchLabName,
      accessionNumber: dispatchAccession,
      transmittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      verifyingPathologist: dispatchPathologist,
      status: 'released',
      report: customizedReport,
      clinicalNotes: dispatchNotes,
    };

    try {
      await onTransmitNewReport(newRecord);
      setTransmissionSuccessMsg(
        `Digital Lab Report #${dispatchAccession} from "${dispatchLabName}" successfully transmitted! Access it below or load it into your patient dashboard.`
      );
      setActiveTab('inbox');
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Required Google Maps Quota Warning Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Header & Navigation Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-900">
                <Microscope className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Realtime Diagnostic Laboratory Network</span>
              </span>
              {linkedLab ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Linked Lab: {linkedLab.name}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>{filteredLabs.length} Accredited Centers Near You</span>
                </span>
              )}
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900 pt-1">
              Diagnostic Laboratory Portal &amp; Results Transmission
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Find nearby certified pathology centers, schedule home blood collections, and access official diagnostic reports sent directly from your laboratory into MediGuide AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-900 hover:bg-teal-100/70 transition-colors cursor-pointer"
            >
              <LocateFixed className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>{isLocating ? 'Detecting Location...' : 'Use My GPS Location'}</span>
            </button>
            <button
              type="button"
              onClick={onReturnToPatientView}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Patient View</span>
            </button>
          </div>
        </div>

        {locationError && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            {locationError}
          </div>
        )}

        {/* 3-Section Navigation Bar within Laboratory Portal */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('locator')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'locator'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>1. Find &amp; Link Nearby Labs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>2. Transmitted Lab Reports ({transmittedReports.length})</span>
            {transmittedReports.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dispatch')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'dispatch'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>3. Lab Transmission Desk (Simulate Lab Dispatch)</span>
          </button>
        </div>
      </section>

      {/* Success Notification Banner */}
      {transmissionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>{transmissionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setTransmissionSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: Realtime Map & Nearby Laboratory Locator */}
      {activeTab === 'locator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive Map & Search Filters (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Filter Controls */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by lab name, test type, or neighborhood..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setFilterOpenNow((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      filterOpenNow
                        ? 'bg-teal-700 border-teal-700 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Open Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterHomeCollection((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      filterHomeCollection
                        ? 'bg-teal-700 border-teal-700 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Home Phlebotomy
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMicrobiology((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      filterMicrobiology
                        ? 'bg-teal-700 border-teal-700 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Cultures / AST
                  </button>
                </div>
              </div>
            </div>

            {/* Google Maps Container */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <div className="h-[380px] sm:h-[430px] w-full rounded-lg overflow-hidden relative border border-slate-200">
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                  <Map
                    defaultCenter={userLocation}
                    defaultZoom={13}
                    mapId={GOOGLE_MAPS_MAP_ID}
                    internalUsageAttributionIds={[GMP_ATTRIBUTION_ID]}
                    className="w-full h-full"
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                  >
                    <MapRecenterController center={userLocation} />

                    {/* Patient Current Location Marker */}
                    <AdvancedMarker position={userLocation} title="Your Location">
                      <div className="relative flex items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75" />
                        <div className="relative w-6 h-6 rounded-full bg-blue-600 text-white border-2 border-white shadow-md flex items-center justify-center">
                          <User className="w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                      </div>
                    </AdvancedMarker>

                    {/* Laboratory Markers */}
                    {filteredLabs.map((lab) => {
                      const isSelected = lab.id === selectedLab?.id;
                      const isLinked = lab.id === linkedLab?.id;

                      return (
                        <AdvancedMarker
                          key={lab.id}
                          position={{ lat: lab.lat, lng: lab.lng }}
                          onClick={() => setSelectedLabId(lab.id)}
                          title={lab.name}
                        >
                          <div
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-md transition-all cursor-pointer ${
                              isLinked
                                ? 'bg-emerald-700 text-white border-white ring-3 ring-emerald-300 scale-110 z-20'
                                : isSelected
                                ? 'bg-teal-800 text-white border-white ring-2 ring-teal-300 scale-105 z-10'
                                : lab.openNow
                                ? 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            <Microscope className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span className="text-[11px] font-bold truncate max-w-[120px]">
                              {lab.name.split(' ')[0]}
                            </span>
                            <span className="text-[10px] opacity-80 tabular-nums">
                              {lab.distanceKm}km
                            </span>
                          </div>
                        </AdvancedMarker>
                      );
                    })}

                    {/* Info Window for Selected Lab */}
                    {selectedLab && (
                      <InfoWindow
                        position={{ lat: selectedLab.lat, lng: selectedLab.lng }}
                        onCloseClick={() => {}}
                      >
                        <div className="p-1 max-w-[240px] text-slate-900 font-sans">
                          <div className="text-xs font-bold">{selectedLab.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{selectedLab.address}</div>
                          <div className="flex items-center gap-2 text-[11px] mt-1.5 font-medium">
                            <span className={selectedLab.openNow ? 'text-emerald-700' : 'text-slate-500'}>
                              {selectedLab.openNow ? 'Open Now' : 'Closed'}
                            </span>
                            <span>·</span>
                            <span className="tabular-nums font-semibold">{selectedLab.distanceKm} km</span>
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </Map>
                </APIProvider>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2.5 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                  <span>Your Location ({locationLabel})</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-800 inline-block" />
                  <span>Selected Laboratory</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                  <span>Linked Laboratory</span>
                </span>
              </div>
            </div>

            {/* Laboratory Cards List */}
            <div className="space-y-3">
              <h2 className="font-display text-sm font-bold text-slate-900 px-1">
                Available Centers ({filteredLabs.length})
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredLabs.map((lab) => {
                  const isSelected = lab.id === selectedLab?.id;
                  const isLinked = lab.id === linkedLab?.id;

                  return (
                    <div
                      key={lab.id}
                      onClick={() => setSelectedLabId(lab.id)}
                      className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-display text-xs font-bold text-slate-900">
                          {lab.name}
                        </div>
                        {isLinked && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                            Linked
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {lab.address}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                        <span className="font-semibold text-slate-700 tabular-nums">
                          {lab.distanceKm} km away
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold tabular-nums">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{lab.rating}</span>
                          <span className="text-slate-400 text-[10px]">({lab.reviewCount})</span>
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className={lab.openNow ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                          {lab.openNow ? 'Open Now' : 'Closed'}
                        </span>
                        {lab.homeCollectionAvailable && (
                          <span className="text-teal-800 font-medium">Home Phlebotomy</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Selected Lab Details & Requisition Card (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {selectedLab && (
              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-[10px] font-bold text-teal-900 uppercase">
                        {selectedLab.accreditations[0] || 'Certified'}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 tabular-nums">
                        {selectedLab.distanceKm} km from you
                      </span>
                    </div>
                    <h2 className="font-display text-base font-bold text-slate-900 mt-1">
                      {selectedLab.name}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">{selectedLab.address}</p>
                  </div>
                </div>

                {/* Lab Highlights */}
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span>{selectedLab.openingHoursText}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <a
                      href={`tel:${selectedLab.phone}`}
                      className="text-teal-700 font-semibold hover:underline"
                    >
                      {selectedLab.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span>Turnaround: {selectedLab.turnaroundTime}</span>
                  </div>
                </div>

                {/* Lab Accreditations */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-800">Accreditations &amp; Quality:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLab.accreditations.map((acc) => (
                      <span
                        key={acc}
                        className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700"
                      >
                        {acc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Capabilities */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-800">Diagnostic Capabilities:</div>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {selectedLab.capabilities.map((cap) => (
                      <li key={cap} className="flex items-start gap-1.5">
                        <span className="text-teal-600 font-bold">•</span>
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Buttons: Link Lab, Home Collection, Directions */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  {linkedLab?.id === selectedLab.id ? (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>Linked as Primary Diagnostic Lab</span>
                      </div>
                      <button
                        type="button"
                        onClick={onUnlinkLab}
                        className="text-xs text-emerald-800 hover:text-emerald-950 underline font-semibold cursor-pointer"
                      >
                        Unlink
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onLinkLab(selectedLab)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 transition-colors shadow-xs cursor-pointer"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Link This Lab to My Profile &amp; Case</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        `${selectedLab.name}, ${selectedLab.address}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5 text-teal-700" />
                      <span>Directions</span>
                    </a>

                    {selectedLab.homeCollectionAvailable ? (
                      <button
                        type="button"
                        onClick={() => {
                          setBookingLab(selectedLab);
                          setBookingConfirmed(false);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-teal-200 bg-teal-50 text-xs font-semibold text-teal-900 hover:bg-teal-100 transition-colors cursor-pointer"
                      >
                        <Home className="w-3.5 h-3.5 text-teal-700" />
                        <span>Home Draw</span>
                      </button>
                    ) : (
                      <a
                        href={`tel:${selectedLab.phone}`}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>Call Lab</span>
                      </a>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Diagnostic Requisition Voucher Card */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <TestTube2 className="w-4 h-4 text-teal-700" aria-hidden="true" />
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Follow-Up Lab Requisition Voucher
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Printer className="w-3 h-3 text-slate-500" />
                  <span>Print</span>
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Based on the flagged anomalies in your report (<strong>{activeReport.title}</strong>), present this pre-compiled requisition at {selectedLab?.name || 'the laboratory'} for targeted testing:
              </p>

              <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Targeted Follow-Up Panels
                </div>
                <ul className="space-y-1.5 text-xs text-slate-800">
                  {recommendedRequisitions.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="text-[11px] text-slate-500 bg-teal-50/50 border border-teal-100 rounded-lg p-2.5">
                💡 <strong>Clinician Tip:</strong> Ask the phlebotomist for Fasting guidelines if ordering Glucose/Lipids, or ensure repeat blood cultures are drawn prior to starting new antibiotic regimens.
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: Transmitted Lab Reports Inbox */}
      {activeTab === 'inbox' && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-5">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <Inbox className="w-5 h-5 text-teal-700" />
                <span>Transmitted Laboratory Reports Inbox</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Reports received directly from accredited diagnostic centers into your MediGuide account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('dispatch')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-900 hover:bg-teal-100 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-teal-700" />
              <span>Simulate New Lab Transmission</span>
            </button>
          </div>

          {transmittedReports.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
              <Microscope className="w-8 h-8 text-teal-700 mx-auto" />
              <h3 className="font-display text-sm font-bold text-slate-900">
                No Transmitted Lab Reports Yet
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                When an accredited diagnostic laboratory (such as Apex Diagnostics or PathoCare) finishes processing your samples, they can transmit your digital report directly here.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('dispatch')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Try a Sample Lab Transmission</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {transmittedReports.map((rec) => {
                const flaggedCount =
                  rec.report.numericMarkers.filter((m) => m.status !== 'normal').length +
                  rec.report.cultureFindings.filter((c) => c.status !== 'normal').length;

                return (
                  <div
                    key={rec.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs hover:border-teal-400 transition-colors flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-900">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Direct Lab Transmission</span>
                        </span>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {rec.transmittedAt}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-display text-sm font-bold text-slate-900 line-clamp-2">
                          {rec.report.title}
                        </h3>
                        <div className="text-xs text-teal-800 font-medium mt-0.5">
                          {rec.labName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Accession: {rec.accessionNumber}
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-[11px] text-slate-600 space-y-1">
                        <div>
                          <strong>Verified by:</strong> {rec.verifyingPathologist}
                        </div>
                        <div>
                          <strong>Findings:</strong> {rec.report.numericMarkers.length} markers ({flaggedCount} flagged)
                        </div>
                        {rec.clinicalNotes && (
                          <div className="text-slate-500 line-clamp-2 italic pt-1 border-t border-slate-200/60">
                            &ldquo;{rec.clinicalNotes}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onAccessReport(rec.report)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 transition-colors cursor-pointer"
                      >
                        <span>Access This Report</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: Laboratory Transmission Desk (Simulate Lab Transmission) */}
      {activeTab === 'dispatch' && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Laboratory Dispatch &amp; Transmission Desk
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                This simulated interface represents the Laboratory Information Management System (LIMS) used by certified pathology centers to release official test results directly into a patient&apos;s MediGuide AI dashboard.
              </p>
            </div>
          </div>

          <form onSubmit={handleDispatchReport} className="space-y-5">
            {/* Template Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                Select Pre-Configured Laboratory Results Template:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PRESET_TRANSMISSIONS.map((template) => {
                  const isSelected = selectedPresetTemplateId === template.id;
                  return (
                    <div
                      key={template.id}
                      onClick={() => {
                        setSelectedPresetTemplateId(template.id);
                        setDispatchLabName(template.labName);
                        setDispatchAccession(template.accessionNumber);
                        setDispatchPathologist(template.verifyingPathologist);
                        setDispatchNotes(template.clinicalNotes);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/50 shadow-xs'
                          : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">{template.title}</div>
                      <div className="text-[11px] text-teal-800 font-semibold mt-1">
                        {template.labName}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        {template.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Verification Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transmitting Laboratory Name
                </label>
                <input
                  type="text"
                  required
                  value={dispatchLabName}
                  onChange={(e) => setDispatchLabName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Accession / Sample Barcode #
                </label>
                <input
                  type="text"
                  required
                  value={dispatchAccession}
                  onChange={(e) => setDispatchAccession(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verifying Pathologist / Lab Director
                </label>
                <input
                  type="text"
                  required
                  value={dispatchPathologist}
                  onChange={(e) => setDispatchPathologist(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Clinical Lab Notes &amp; Specimen Quality Comments
              </label>
              <textarea
                rows={2}
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                🔒 Transmission utilizes TLS 1.3 encrypted digital lab handoff protocol.
              </span>
              <button
                type="submit"
                disabled={isTransmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 disabled:opacity-60 transition-colors shadow-xs cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isTransmitting ? 'Transmitting...' : 'Dispatch Digital Report to Patient'}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Home Sample Booking Modal */}
      {bookingLab && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-teal-700 uppercase">
                  Home Phlebotomy Dispatch
                </span>
                <h3 className="font-display text-base font-bold text-slate-900 mt-0.5">
                  Request Blood Collection
                </h3>
                <p className="text-xs text-slate-500">{bookingLab.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setBookingLab(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {bookingConfirmed ? (
              <div className="space-y-4 py-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-display text-base font-bold text-slate-900">
                    Home Draw Request Transmitted!
                  </h4>
                  <p className="text-xs text-slate-600 max-w-xs mx-auto">
                    {bookingLab.name} has received your request for {bookingDate}. A licensed phlebotomist will call your contact number to confirm fasting requirements.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingLab(null)}
                  className="w-full py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setBookingConfirmed(true);
                }}
                className="space-y-3.5 text-xs text-slate-700"
              >
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Preferred Time Slot
                  </label>
                  <select
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option>Tomorrow Morning (6:30 AM – 8:00 AM Fasting)</option>
                    <option>Tomorrow Morning (8:00 AM – 10:00 AM)</option>
                    <option>Tomorrow Afternoon (1:00 PM – 3:00 PM)</option>
                    <option>Same-Day Urgent (Within 2 hours)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Pickup Address / Apartment
                  </label>
                  <input
                    type="text"
                    required
                    value={bookingAddress}
                    onChange={(e) => setBookingAddress(e.target.value)}
                    placeholder="Street address, building, apartment number"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-[11px]">
                  <div className="font-semibold text-slate-800">Included Requisition Tests:</div>
                  <div className="text-slate-600 truncate">{recommendedRequisitions.slice(0, 2).join(', ')}</div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setBookingLab(null)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 transition-colors cursor-pointer"
                  >
                    Confirm Home Blood Draw
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
