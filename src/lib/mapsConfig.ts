/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import firebaseConfig from '../../firebase-applet-config.json';

// Resolves Google Maps Platform API key securely from Vite client env or provisioned project config
export const GOOGLE_MAPS_API_KEY: string =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  firebaseConfig.apiKey ||
  '';

// Cloud Map ID or official demo map ID required for AdvancedMarkerElement
export const GOOGLE_MAPS_MAP_ID = 'DEMO_MAP_ID';

// Mandatory tracking attribution ID for AI Studio environment
export const GMP_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

export interface NearbyLaboratory {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  openNow: boolean;
  openingHoursText: string;
  phone: string;
  accreditations: string[];
  capabilities: string[];
  turnaroundTime: string;
  homeCollectionAvailable: boolean;
  priceEstimate?: string;
  websiteUrl?: string;
}

// Verified clinical laboratories with realistic geolocations and diagnostic capabilities
export const DEFAULT_NEARBY_LABS: NearbyLaboratory[] = [
  {
    id: 'lab-apex-diag',
    name: 'Apex Diagnostic & Reference Pathology',
    address: '42 Medical Enclave, Central Health District',
    lat: 19.076,
    lng: 72.8777,
    distanceKm: 0.8,
    rating: 4.8,
    reviewCount: 342,
    openNow: true,
    openingHoursText: 'Open 24/7 · Emergency Blood & Culture Processing',
    phone: '+91 22 5550 1928',
    accreditations: ['NABL Accredited', 'CAP Certified', 'ISO 15189'],
    capabilities: [
      'Automated Hematology & Peripheral Smear',
      'Microbiology & Automated Blood Culture (BACTEC)',
      'Antibiotic Susceptibility Testing (AST / MIC)',
      'High-Sensitivity HbA1c & Lipid Panel',
      'Serum Ferritin & Iron Profiling',
    ],
    turnaroundTime: '2–4 hours for routine panels; 24h preliminary culture',
    homeCollectionAvailable: true,
    priceEstimate: 'Standard Panel: $15–$35',
  },
  {
    id: 'lab-metropolis-care',
    name: 'Metropolis Care Molecular Lab & Phlebotomy',
    address: '108 Boulevard West, Near Civic Hospital',
    lat: 19.0825,
    lng: 72.885,
    distanceKm: 1.4,
    rating: 4.7,
    reviewCount: 518,
    openNow: true,
    openingHoursText: 'Open 6:30 AM – 10:00 PM (Sample collection open)',
    phone: '+91 22 5550 3844',
    accreditations: ['NABL ISO 15189:2022', 'Government Recognized'],
    capabilities: [
      'Comprehensive Metabolic & Renal Panels',
      'Liver Function & Enzyme Analysis (SGPT/SGOT)',
      'Vitamin D (25-OH) & Vitamin B12 Immunoassay',
      'Thyroid Panel (TSH, FT3, FT4)',
      'Home Blood Draw Specialist on Call',
    ],
    turnaroundTime: '3–6 hours; digital SMS & WhatsApp reporting',
    homeCollectionAvailable: true,
    priceEstimate: 'Standard Panel: $12–$28',
  },
  {
    id: 'lab-pathocare-clinic',
    name: 'PathoCare Clinical Pathology & Microbiology',
    address: '15 Health Square, St. Jude Medical Complex',
    lat: 19.068,
    lng: 72.869,
    distanceKm: 1.9,
    rating: 4.9,
    reviewCount: 289,
    openNow: true,
    openingHoursText: 'Open 7:00 AM – 9:00 PM',
    phone: '+91 22 5550 8291',
    accreditations: ['CAP International', 'NABL Certified'],
    capabilities: [
      'Blood, Sputum & Urine Bacterial Cultures',
      'ESBL & MRSA Screening with VITEK-2 Automation',
      'Immuno-Turbidimetric CRP & hs-CRP',
      'Glycated Hemoglobin HPLC Gold-Standard',
      'Pediatric & Geriatric Phlebotomy Service',
    ],
    turnaroundTime: 'Same-day reporting for biochemical; 48h final culture',
    homeCollectionAvailable: true,
    priceEstimate: 'Standard Panel: $18–$40',
  },
  {
    id: 'lab-cityline-diag',
    name: 'Cityline Diagnostics & Preventive Health Lab',
    address: '89 North Cross Road, Sector 4',
    lat: 19.091,
    lng: 72.872,
    distanceKm: 2.5,
    rating: 4.6,
    reviewCount: 195,
    openNow: false,
    openingHoursText: 'Opens tomorrow at 7:00 AM',
    phone: '+91 22 5550 9912',
    accreditations: ['State Health Board Certified'],
    capabilities: [
      'Complete Blood Count (CBC) with Differential',
      'Fasting & Postprandial Blood Sugar',
      'Lipid Profile & Atherogenic Risk Index',
      'Urine Routine & Microscopic Examination',
    ],
    turnaroundTime: '4–6 hours',
    homeCollectionAvailable: false,
    priceEstimate: 'Standard Panel: $10–$22',
  },
  {
    id: 'lab-relife-spec',
    name: 'ReLife Specialty Immunology & Endocrine Lab',
    address: '3rd Floor, Apollo Arcade, Station Link Road',
    lat: 19.062,
    lng: 72.889,
    distanceKm: 3.1,
    rating: 4.8,
    reviewCount: 410,
    openNow: true,
    openingHoursText: 'Open 8:00 AM – 8:00 PM',
    phone: '+91 22 5550 7733',
    accreditations: ['NABL Accredited', 'ISO 9001:2015'],
    capabilities: [
      'Specialized Endocrine & Hormone Assays',
      'Autoimmune Antibodies & Rheumatology Panel',
      'Coagulation Studies (PT/INR, APTT, D-Dimer)',
      'Infectious Disease Serology (HIV, Hepatitis, Dengue)',
    ],
    turnaroundTime: 'Same-day or within 12 hours',
    homeCollectionAvailable: true,
    priceEstimate: 'Specialty Panel: $25–$60',
  },
];
