import { z } from 'zod';
import { CrimeSeverity, InvestigationStatus, RiskBand, AlertType, AlertSeverity } from './enums.js';

export const IncidentSchema = z.object({
  fir_number: z.string().min(1),
  crime_type: z.string().min(1),
  incident_date: z.string(),
  incident_time: z.string().optional(),
  district: z.string().min(1),
  police_station: z.string().min(1),
  severity: z.nativeEnum(CrimeSeverity),
  status: z.nativeEnum(InvestigationStatus),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  description: z.string().optional(),
  modus_operandi: z.string().optional(),
});

export const PersonSchema = z.object({
  person_id: z.string().min(1),
  age: z.number().int().positive().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  vehicle: z.string().optional(),
});

export const IncidentPersonSchema = z.object({
  incident_id: z.string().min(1),
  person_id: z.string().min(1),
  role: z.enum(['OFFENDER', 'VICTIM', 'WITNESS']),
});

export const AlertSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(AlertType),
  title: z.string(),
  message: z.string(),
  severity: z.nativeEnum(AlertSeverity),
  district: z.string().optional(),
  policeStation: z.string().optional(),
  metrics: z.record(z.any()).optional(),
  evidence: z.array(z.any()).optional(),
  detectedAt: z.string(),
  reviewed: z.boolean().default(false),
});

export const RiskScoreSchema = z.object({
  score: z.number().min(0).max(100),
  band: z.nativeEnum(RiskBand),
  confidence: z.number().min(0).max(1),
  formulaVersion: z.string(),
  dataPeriod: z.object({
    start: z.string(),
    end: z.string(),
  }),
  factors: z.array(z.object({
    name: z.string(),
    value: z.number(),
    weight: z.number(),
    contribution: z.number(),
  })),
  limitations: z.array(z.string()),
  recordCount: z.number().int().nonnegative(),
  calculatedAt: z.string(),
});

export const HotspotSchema = z.object({
  id: z.string(),
  district: z.string(),
  policeStation: z.string().optional(),
  score: z.number().min(0).max(100),
  incidentCount: z.number(),
  growthRate: z.number(),
  avgSeverity: z.number(),
  repeatOffenderCount: z.number(),
  anomalyScore: z.number(),
  factors: z.array(z.object({ name: z.string(), value: z.number(), weight: z.number() })),
  confidence: z.number().min(0).max(1),
  dataPeriod: z.object({ start: z.string(), end: z.string() }),
  recordCount: z.number(),
  calculatedAt: z.string(),
});

export const DistrictIndicatorSchema = z.object({
  district: z.string(),
  population: z.number().optional(),
  literacyRate: z.number().optional(),
  unemploymentRate: z.number().optional(),
  policePresence: z.number().optional(),
  povertyRate: z.number().optional(),
  urbanizationRate: z.number().optional(),
});

export const AlertFilterSchema = z.object({
  type: z.nativeEnum(AlertType).optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
  district: z.string().optional(),
  reviewed: z.boolean().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const GlobalFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  districts: z.array(z.string()).optional(),
  policeStations: z.array(z.string()).optional(),
  crimeCategories: z.array(z.string()).optional(),
  status: z.nativeEnum(InvestigationStatus).optional(),
  severity: z.nativeEnum(CrimeSeverity).optional(),
  timeOfDay: z.string().optional(),
});
