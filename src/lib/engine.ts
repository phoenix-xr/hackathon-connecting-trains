import { getStation, getStationByName, getStationCoordinates } from "@/data/stations";
import { trains } from "@/data/trains";
import { Journey, Transfer, Preference, Station, ConnectionSafety, Train } from "./types";
import {
  getIntraStationMCT,
  getCrossStationMCT,
  getClusterStations,
  isSameCity,
  getPlatformGuidance,
  getStationTransferProfile,
} from "@/data/station_topology";

// ==========================================
// Time & Format Helpers
// ==========================================
function timeToMinutes(t: string): number {
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(min: number): string {
  const normalized = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export { formatDuration, timeToMinutes, minutesToTime };

// ==========================================
// Phase 1: Spatial Bounding — Haversine + Forward Progress Vector
// ==========================================

/** Haversine distance between two lat/lng points in kilometers */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Check if junction J is on a valid forward path from O to D using dot product */
function isForwardProgress(
  oLat: number, oLng: number,
  jLat: number, jLng: number,
  dLat: number, dLng: number
): boolean {
  // Vector O→J
  const ojLat = jLat - oLat;
  const ojLng = jLng - oLng;
  // Vector O→D
  const odLat = dLat - oLat;
  const odLng = dLng - oLng;
  // Vector J→D
  const jdLat = dLat - jLat;
  const jdLng = dLng - jLng;

  // Dot products: O→J must roughly align with O→D, and J→D must too
  const dotOJOD = ojLat * odLat + ojLng * odLng;
  const dotJDOD = jdLat * odLat + jdLng * odLng;

  return dotOJOD > 0 && dotJDOD > 0;
}

/**
 * Detour Factor: κ = 1.35
 * Any junction J where dist(O,J) + dist(J,D) > κ × dist(O,D) is pruned.
 */
const DETOUR_FACTOR = 1.35;

/**
 * Phase 1: Filter candidate junctions using the Ellipsoid Bounding Filter.
 * Returns a Set of station IDs that pass both:
 *   1. Ellipsoid: dist(O,J) + dist(J,D) ≤ κ × dist(O,D)
 *   2. Forward Progress: dot(V_OJ, V_OD) > 0 AND dot(V_JD, V_OD) > 0
 *
 * Falls back to all junctions if coordinates are unavailable.
 */
function filterCandidateJunctions(
  originCodes: Set<string>,
  destCodes: Set<string>
): Set<string> {
  // Get coordinates for origin and destination
  let oCoords: { lat: number; lng: number } | null = null;
  let dCoords: { lat: number; lng: number } | null = null;

  for (const code of originCodes) {
    oCoords = getStationCoordinates(code);
    if (oCoords) break;
  }
  for (const code of destCodes) {
    dCoords = getStationCoordinates(code);
    if (dCoords) break;
  }

  const validJunctions = new Set<string>();

  // If we have both coordinates, apply spatial bounding
  if (oCoords && dCoords) {
    const odDist = haversineDistance(oCoords.lat, oCoords.lng, dCoords.lat, dCoords.lng);
    const maxDetour = DETOUR_FACTOR * odDist;

    for (const jCode of ALL_INDIAN_JUNCTIONS) {
      // Don't filter out origin/destination stations
      if (originCodes.has(jCode) || destCodes.has(jCode)) continue;

      const jCoords = getStationCoordinates(jCode);
      if (!jCoords) {
        // No coordinates — include it (benefit of doubt)
        validJunctions.add(jCode);
        continue;
      }

      // Ellipsoid filter
      const ojDist = haversineDistance(oCoords.lat, oCoords.lng, jCoords.lat, jCoords.lng);
      const jdDist = haversineDistance(jCoords.lat, jCoords.lng, dCoords.lat, dCoords.lng);
      if (ojDist + jdDist > maxDetour) continue;

      // Forward progress vector
      if (!isForwardProgress(oCoords.lat, oCoords.lng, jCoords.lat, jCoords.lng, dCoords.lat, dCoords.lng)) {
        continue;
      }

      validJunctions.add(jCode);
    }
  } else {
    // No coordinates available — include all junctions (fallback)
    for (const jCode of ALL_INDIAN_JUNCTIONS) {
      validJunctions.add(jCode);
    }
  }

  return validJunctions;
}

// ==========================================
// Station & Alias Resolution
// ==========================================

// Canonical city & region aliases for robust railway searching
const CANONICAL_CITY_ALIASES: Record<string, string[]> = {
  goa: ["MAO", "KRMI", "THVM", "VSG", "QLM"],
  madgaon: ["MAO", "KRMI", "THVM", "VSG"],
  karmali: ["KRMI", "MAO", "THVM"],
  thivim: ["THVM", "KRMI", "MAO"],
  delhi: ["NDLS", "NZM", "DLI", "ANVT", "DEE"],
  "new delhi": ["NDLS", "NZM", "DLI", "ANVT", "DEE"],
  mumbai: ["MMCT", "CSMT", "BDTS", "DDR", "LTT"],
  bombay: ["MMCT", "CSMT", "BDTS", "DDR", "LTT"],
  kolkata: ["HWH", "SDAH", "KOAA", "SHM"],
  calcutta: ["HWH", "SDAH", "KOAA", "SHM"],
  howrah: ["HWH", "SDAH", "KOAA"],
  bangalore: ["SBC", "YPR", "SMVB"],
  bengaluru: ["SBC", "YPR", "SMVB"],
  chennai: ["MAS", "MS", "TBM"],
  madras: ["MAS", "MS", "TBM"],
  hyderabad: ["SC", "HYB", "KCG"],
  secunderabad: ["SC", "HYB", "KCG"],
  ahmedabad: ["ADI", "SBT"],
  pune: ["PUNE", "SVJR"],
  jaipur: ["JP", "GADJ"],
  varanasi: ["BSB", "DDU"],
  patna: ["PNBE", "RJPB", "DNR"],
  lucknow: ["LKO", "LJN"],
  chandigarh: ["CDG"],
  bhopal: ["BPL", "RKMP"],
  kanpur: ["CNB"],
  agra: ["AGC", "AF"],
  gwalior: ["GWL"],
  nagpur: ["NGP"],
  surat: ["ST"],
  vadodara: ["BRC"],
  kota: ["KOTA"],
};

export function getStationCodesForLocation(st: Station, queryText?: string): Set<string> {
  const codes = new Set<string>();
  if (st?.code) codes.add(st.code.toUpperCase());
  if (st?.id) codes.add(st.id.toUpperCase());

  const check = (str?: string) => {
    if (!str) return;
    const lower = str.toLowerCase().trim();
    for (const [key, aliasList] of Object.entries(CANONICAL_CITY_ALIASES)) {
      if (lower === key || lower.includes(key) || key.includes(lower)) {
        aliasList.forEach(c => codes.add(c));
      }
    }
  };

  check(queryText);
  check(st?.name);
  check(st?.city);
  check(st?.state);

  return codes;
}

// ==========================================
// Comprehensive All-India Railway Junction Network
// ==========================================
export const ALL_INDIAN_JUNCTIONS = [
  // Central & West-Central
  "ET", "BPL", "BINA", "JBP", "KTE", "KNW", "GWL",
  // North & North-Central
  "VGLJ", "JHS", "AGC", "MTJ", "CNB", "PRYJ", "DDU", "BSB", "LKO", "UMB", "MB",
  // Western & Konkan
  "KOTA", "RTM", "NAD", "SWM", "BRC", "ST", "ADI", "ANND", "PNVL", "BSR",
  // Maharashtra & Deccan
  "BSL", "MMR", "PUNE", "DD", "SUR", "MRJ", "NGP", "WR", "AK",
  // Eastern & East Coast
  "R", "BSP", "ROU", "TATA", "KGP", "HWH", "ASN", "PNBE", "GAYA", "DHN", "BBS", "KUR", "VSKP",
  // South & South-Central
  "BZA", "KZJ", "WL", "SC", "GTL", "RU", "GDR", "KPD", "JTJ", "ED", "SA", "SRR", "ERS", "QLN", "UBL", "WADI",
  // North-Western
  "JP", "AII", "FL", "ABR", "JU",
];

export function isJunctionStation(stationId: string): boolean {
  if (ALL_INDIAN_JUNCTIONS.includes(stationId.toUpperCase())) return true;
  const st = getStation(stationId);
  if (!st || !st.name) return false;
  const lower = st.name.toLowerCase();
  return lower.includes("junction") || lower.includes(" jn") || lower.includes(" cantt") || lower.includes(" central") || lower.includes(" terminus");
}

// ==========================================
// Connection Safety Scoring
// ==========================================

/**
 * Compute flight-style connection safety classification.
 * 
 * Uses a probabilistic model based on train reliability to estimate
 * the probability that Train 1's delay will exceed the usable buffer.
 */
function computeConnectionSafety(
  usableBuffer: number,
  t1Reliability: number,
  t1AvgDelay: number,
  requiresStationChange: boolean,
): { safety: ConnectionSafety; badge: string; delayProb: number; requiredP90: number } {
  // Estimate p90 delay from avgDelay and reliability
  // Higher avgDelay + lower reliability → higher p90
  const p90Delay = Math.round(t1AvgDelay * (2.0 + (100 - t1Reliability) / 40));
  const mct = requiresStationChange ? 75 : 40;
  const requiredP90 = mct + p90Delay;

  // Probability of delay exceeding usable buffer (simplified log-normal CDF)
  // P(delay > usableBuffer) ≈ based on avgDelay and reliability spread
  let delayProb: number;
  if (usableBuffer > requiredP90 + 30) {
    delayProb = Math.max(2, Math.round(5 * (100 - t1Reliability) / 100));
  } else if (usableBuffer > requiredP90) {
    delayProb = Math.round(10 + (requiredP90 + 30 - usableBuffer) * 0.4);
  } else if (usableBuffer > mct + t1AvgDelay) {
    delayProb = Math.round(20 + (requiredP90 - usableBuffer) * 0.5);
  } else {
    delayProb = Math.min(85, Math.round(40 + (mct + t1AvgDelay - usableBuffer) * 0.7));
  }
  delayProb = Math.min(95, Math.max(2, delayProb));

  // Classification
  let safety: ConnectionSafety;
  let badge: string;

  if (usableBuffer >= requiredP90 && delayProb <= 15) {
    safety = "safe";
    badge = `🟢 Safe Connection (+${formatDuration(usableBuffer)} buffer)`;
  } else if (usableBuffer >= mct + t1AvgDelay && delayProb <= 40) {
    safety = "moderate";
    badge = `🟡 Moderate Buffer (+${formatDuration(usableBuffer)}) — ${delayProb}% delay risk`;
  } else {
    safety = "risky";
    badge = `🔴 Tight Connection (+${formatDuration(usableBuffer)}) — ${delayProb}% delay risk`;
  }

  return { safety, badge, delayProb, requiredP90 };
}

/**
 * Buffer Quality Scoring Curve
 * Rewards the flight-style sweet spot of 50–135 minutes
 */
function computeBufferScore(usableBuffer: number): number {
  if (usableBuffer < 35) return 20;
  if (usableBuffer >= 50 && usableBuffer <= 135) return 100; // Peak sweet spot
  if (usableBuffer > 135 && usableBuffer <= 190) return 85;
  if (usableBuffer > 190 && usableBuffer <= 250) return 65;
  return 40; // Too long
}

// ==========================================
// Phase 2: Round-Based Timetable Scan (Rail-RAPTOR)
// ==========================================

function calculateSegmentDuration(depTime: string, depDay: number, arrTime: string, arrDay: number): number {
  const depMin = timeToMinutes(depTime) + depDay * 1440;
  let arrMin = timeToMinutes(arrTime) + arrDay * 1440;
  if (arrMin < depMin) arrMin += 1440;
  return arrMin - depMin;
}

// Maximum Layover Time limits (MLT)
const MLT_SAME_STATION = 270;  // 4.5 hours max same-station layover
const MLT_CROSS_STATION = 330; // 5.5 hours max cross-station layover

/**
 * Build a Transfer object between two stops with MCT/MLT enforcement
 * and connection safety scoring.
 */
function buildTransferBetweenStops(
  t1: any, arr1: string, day1: number, station1: Station,
  t2: any, dep2: string, day2: number, station2: Station,
  fromPlatform?: string, toPlatform?: string,
): Transfer {
  const arrTotal = timeToMinutes(arr1) + day1 * 1440;
  let depTotal = timeToMinutes(dep2) + day2 * 1440;

  // Ensure T2 departs after T1 arrives (possibly next day)
  while (depTotal < arrTotal) {
    depTotal += 1440;
  }

  const rawBuffer = depTotal - arrTotal;
  const requiresStationChange = station1.id !== station2.id && !isSameCity(station1.id, station2.id) === false
    ? station1.id !== station2.id
    : station1.id !== station2.id;

  // Use topology-based MCT
  const mct = requiresStationChange
    ? getCrossStationMCT(station1.id, station2.id)
    : getIntraStationMCT(station1.id);

  const mlt = requiresStationChange ? MLT_CROSS_STATION : MLT_SAME_STATION;
  const usable = rawBuffer - (requiresStationChange ? getCrossStationMCT(station1.id, station2.id) : getStationTransferProfile(station1.id).minIntraStationWalkMinutes);

  // MCT/MLT enforcement
  if (rawBuffer < mct || rawBuffer > mlt) {
    return {
      fromStationId: station1.id,
      toStationId: station2.id,
      requiresStationChange,
      requiredWalkingMinutes: requiresStationChange ? getCrossStationMCT(station1.id, station2.id) : getStationTransferProfile(station1.id).minIntraStationWalkMinutes,
      durationMinutes: rawBuffer,
      usableBuffer: usable,
      risk: "invalid",
      riskLabel: "Not possible",
      reason: rawBuffer > mlt ? `Layover too long (>${formatDuration(mlt)})` : `Connection too short (<${formatDuration(mct)})`,
      connectionSafety: "risky",
      safetyBadge: "⛔ Connection not feasible",
      platformGuidance: "",
    };
  }

  // Connection safety scoring
  const { safety, badge, delayProb, requiredP90 } = computeConnectionSafety(
    usable,
    t1.reliability || 80,
    t1.avgDelay || 20,
    requiresStationChange,
  );

  // Legacy risk mapping (backwards compat)
  let risk: Transfer["risk"];
  if (safety === "safe") risk = "low";
  else if (safety === "moderate") risk = "medium";
  else risk = "high";

  // Platform guidance
  const platformGuidanceText = getPlatformGuidance(station1.id, station2.id, fromPlatform, toPlatform);

  const transfer: Transfer = {
    fromStationId: station1.id,
    toStationId: station2.id,
    requiresStationChange,
    stationChangeTransferMinutes: requiresStationChange ? getCrossStationMCT(station1.id, station2.id) : undefined,
    requiredWalkingMinutes: requiresStationChange ? getCrossStationMCT(station1.id, station2.id) : getStationTransferProfile(station1.id).minIntraStationWalkMinutes,
    durationMinutes: rawBuffer,
    usableBuffer: usable,
    risk,
    riskLabel: risk === "low" ? "Low risk" : risk === "medium" ? "Moderate risk" : "High risk",
    reason: "",
    connectionSafety: safety,
    safetyBadge: badge,
    platformGuidance: platformGuidanceText,
    delayProbability: delayProb,
    requiredBufferP90: requiredP90,
  };

  // Generate human-readable reason
  if (requiresStationChange) {
    if (safety === "safe") transfer.reason = `Cross-station road transfer with comfortable ${formatDuration(rawBuffer)} buffer.`;
    else if (safety === "moderate") transfer.reason = `Road transfer between stations — connection is moderately tight.`;
    else transfer.reason = `Very tight road transfer between stations — not recommended.`;
  } else {
    if (safety === "safe") transfer.reason = `Same station with ${formatDuration(rawBuffer)} buffer — plenty of time for platform change and luggage.`;
    else if (safety === "moderate") transfer.reason = `Same station connection, but tighter buffer in case of delays.`;
    else transfer.reason = `Same station but minimal recovery margin.`;
  }

  return transfer;
}

// ==========================================
// Main Routing Engine: findJourneys (Rail-RAPTOR 3-Phase Pipeline)
// ==========================================

declare var globalThis: { _trainsByStation?: Map<string, Train[]> };

export function findJourneys(fromName: string, toName: string, date: string, preference: Preference): Journey[] {
  const origin = getStationByName(fromName);
  const dest = getStationByName(toName);

  if (!origin || !dest || origin.id === dest.id) return [];

  // Optimization: Lazy-build O(1) station index if not already built
  if (globalThis._trainsByStation === undefined) {
    globalThis._trainsByStation = new Map<string, Train[]>();
    for (const t of trains) {
      for (const s of t.stops) {
        const id = s.stationId;
        if (!globalThis._trainsByStation.has(id)) globalThis._trainsByStation.set(id, []);
        globalThis._trainsByStation.get(id)!.push(t);
      }
    }
  }
  const trainsByStation = globalThis._trainsByStation;

  const originCodes = getStationCodesForLocation(origin, fromName);
  const destCodes = getStationCodesForLocation(dest, toName);

  const candidates: Journey[] = [];
  const seenIds = new Set<string>();

  const originMatchCache = new Map<string, boolean>();
  const matchesOrigin = (stId: string) => {
    if (originMatchCache.has(stId)) return originMatchCache.get(stId)!;
    const code = stId.toUpperCase();
    if (originCodes.has(code)) { originMatchCache.set(stId, true); return true; }
    const st = getStation(stId);
    if (originCodes.has(st.code.toUpperCase())) { originMatchCache.set(stId, true); return true; }
    const isMatch = Boolean(origin.city && st.city && origin.city.toLowerCase() === st.city.toLowerCase());
    originMatchCache.set(stId, isMatch);
    return isMatch;
  };

  const destMatchCache = new Map<string, boolean>();
  const matchesDest = (stId: string) => {
    if (destMatchCache.has(stId)) return destMatchCache.get(stId)!;
    const code = stId.toUpperCase();
    if (destCodes.has(code)) { destMatchCache.set(stId, true); return true; }
    const st = getStation(stId);
    if (destCodes.has(st.code.toUpperCase())) { destMatchCache.set(stId, true); return true; }
    const isMatch = Boolean(dest.city && st.city && dest.city.toLowerCase() === st.city.toLowerCase());
    destMatchCache.set(stId, isMatch);
    return isMatch;
  };

  // ═══════════════════════════════════════════
  // PHASE 1: Spatial Bounding (Ellipsoid + Forward Progress)
  // ═══════════════════════════════════════════
  const validJunctions = filterCandidateJunctions(originCodes, destCodes);

  // ═══════════════════════════════════════════
  // PHASE 2 — ROUND 0: Direct Train Search
  // ═══════════════════════════════════════════
  for (const t of trains) {
    const origStopIdx = t.stops.findIndex(s => matchesOrigin(s.stationId));
    const destStopIdx = t.stops.findIndex((s, idx) => idx > origStopIdx && matchesDest(s.stationId));

    if (origStopIdx !== -1 && destStopIdx !== -1) {
      const origStop = t.stops[origStopIdx];
      const destStop = t.stops[destStopIdx];
      const dep = origStop.departure || t.departure;
      const arr = destStop.arrival || t.arrival;

      const actualOrigin = getStation(origStop.stationId);
      const actualDest = getStation(destStop.stationId);

      const dur = calculateSegmentDuration(dep, origStop.day, arr, destStop.day);
      const journeyId = `j-dir-${t.number}`;

      if (!seenIds.has(journeyId)) {
        seenIds.add(journeyId);
        candidates.push({
          id: journeyId,
          origin: actualOrigin,
          destination: actualDest,
          date,
          legs: [
            {
              type: "train",
              train: t,
              from: actualOrigin,
              to: actualDest,
              departure: dep,
              arrival: arr,
              dayOffset: destStop.day - origStop.day,
            }
          ],
          totalDurationMinutes: dur,
          totalCost: t.fare.ac3,
          interchangeCount: 0,
          riskyTransfer: null,
          riskLevel: "low",
          safetyScore: Math.min(99, Math.round(t.reliability * 1.05 + 5)),
          speedScore: Math.max(20, Math.round(100 - (dur / 2600) * 60)),
          costScore: Math.max(20, Math.round(100 - (t.fare.ac3 / 3500) * 50)),
          reasons: [
            "Direct train — No interchange required",
            `${t.name} (${t.number})`,
            `${t.reliability}% on-time reliability`
          ],
        });
      }
    }
  }

  // ═══════════════════════════════════════════
  // PHASE 2 — ROUND 1: 1-Interchange Layover Scan
  // ═══════════════════════════════════════════
  for (const t1 of trains) {
    const origIdx = t1.stops.findIndex(s => matchesOrigin(s.stationId));
    if (origIdx === -1 || origIdx === t1.stops.length - 1) continue;

    const origStop = t1.stops[origIdx];
    const actualOrigin = getStation(origStop.stationId);
    const dep1 = origStop.departure || t1.departure;

    // Scan all downstream stops as potential interchange junctions
    for (let i = origIdx + 1; i < t1.stops.length; i++) {
      const layoverStop1 = t1.stops[i];
      const layoverStation1 = getStation(layoverStop1.stationId);
      const arr1 = layoverStop1.arrival || t1.arrival;

      // Filter: Skip immediate suburban stops (<35 mins away)
      const timeFromOrigin = calculateSegmentDuration(dep1, origStop.day, arr1, layoverStop1.day);
      if (timeFromOrigin < 35) continue;

      // SPATIAL FILTER: Check if this station passes Phase 1 bounding
      const stationCode = layoverStop1.stationId.toUpperCase();
      if (!validJunctions.has(stationCode) && !isJunctionStation(stationCode)) {
        // Allow non-junction stations that are in valid junctions (from spatial filter)
        // But skip non-junction stations that are outside the ellipsoid
        continue;
      }

      // Get platform of T1's arrival
      const t1Platform = layoverStop1.platform;

      // Find all T2 candidates departing from this junction (or same-city cluster) to destination
      const clusterStations = getClusterStations(layoverStation1.id);

      // Collect unique T2 candidates from the index instead of looping over all 11,000 trains
      const t2Candidates = new Set<Train>();
      for (const stId of clusterStations) {
        const matchingTrains = trainsByStation.get(stId) || [];
        for (const t of matchingTrains) {
          t2Candidates.add(t);
        }
      }

      for (const t2 of t2Candidates) {
        if (t2.id === t1.id) continue;

        // Filter: If T2 also serves origin directly, skip (redundant transfer)
        if (t2.stops.some((s: any) => matchesOrigin(s.stationId))) continue;

        // Find T2's stop at the layover station (or same-city cluster station)
        const layoverIdx2 = t2.stops.findIndex((s: any) =>
          clusterStations.includes(s.stationId) ||
          s.stationId === layoverStation1.id ||
          (Boolean(getStation(s.stationId).city && layoverStation1.city && getStation(s.stationId).city.toLowerCase() === layoverStation1.city.toLowerCase()))
        );

        if (layoverIdx2 === -1 || layoverIdx2 === t2.stops.length - 1) continue;

        const layoverStop2 = t2.stops[layoverIdx2];
        const layoverStation2 = getStation(layoverStop2.stationId);

        // Find T2's destination stop
        const destIdx2 = t2.stops.findIndex((s: any, idx: any) => idx > layoverIdx2 && matchesDest(s.stationId));
        if (destIdx2 === -1) continue;

        const destStop2 = t2.stops[destIdx2];
        const actualDest = getStation(destStop2.stationId);
        const dep2 = layoverStop2.departure || t2.departure;
        const arr2 = destStop2.arrival || t2.arrival;

        // Get platform of T2's departure
        const t2Platform = layoverStop2.platform;

        // Build transfer with MCT/MLT enforcement and safety scoring
        const transfer = buildTransferBetweenStops(
          t1, arr1, layoverStop1.day, layoverStation1,
          t2, dep2, layoverStop2.day, layoverStation2,
          t1Platform, t2Platform,
        );
        if (transfer.risk === "invalid") continue;

        const leg1Dur = calculateSegmentDuration(dep1, origStop.day, arr1, layoverStop1.day);
        const leg2Dur = calculateSegmentDuration(dep2, layoverStop2.day, arr2, destStop2.day);
        const totalDur = leg1Dur + transfer.durationMinutes + leg2Dur;
        const totalCost = (t1.fare?.ac3 || 1200) + (t2.fare?.ac3 || 1200);

        // Quality scoring (combines buffer quality + reliability + station convenience)
        const bufferScore = computeBufferScore(transfer.usableBuffer);
        const reliabilityScore = (t1.reliability + t2.reliability) / 2;
        const stationScore = transfer.requiresStationChange ? 50 : 95;
        const safety = Math.round(bufferScore * 0.45 + reliabilityScore * 0.35 + stationScore * 0.2);

        const journeyId = `j-${t1.number}-${layoverStation1.id}-${t2.number}`;
        if (!seenIds.has(journeyId)) {
          seenIds.add(journeyId);
          candidates.push({
            id: journeyId,
            origin: actualOrigin,
            destination: actualDest,
            date,
            legs: [
              {
                type: "train",
                train: t1,
                from: actualOrigin,
                to: layoverStation1,
                departure: dep1,
                arrival: arr1,
                dayOffset: layoverStop1.day - origStop.day,
              },
              {
                type: "transfer",
                transfer,
                from: layoverStation1,
                to: layoverStation2,
              },
              {
                type: "train",
                train: t2,
                from: layoverStation2,
                to: actualDest,
                departure: dep2,
                arrival: arr2,
                dayOffset: destStop2.day - layoverStop2.day,
              }
            ],
            totalDurationMinutes: totalDur,
            totalCost,
            interchangeCount: 1,
            riskyTransfer: transfer,
            riskLevel: transfer.risk,
            safetyScore: safety,
            speedScore: Math.max(10, Math.round(100 - (totalDur / 3000) * 80)),
            costScore: Math.max(10, Math.round(100 - (totalCost / 5000) * 80)),
            reasons: [
              `1 Change at ${layoverStation1.name}`,
              transfer.requiresStationChange ? `Transfer to ${layoverStation2.name}` : `Same station interchange`,
              `${formatDuration(transfer.durationMinutes)} connection layover`,
              transfer.safetyBadge,
            ],
            whyNotFaster: transfer.connectionSafety === "safe"
              ? `Selected for optimal ${formatDuration(transfer.usableBuffer)} transfer buffer.`
              : undefined,
          });
        }
      }
    }
  }

  // If no direct or single-connection route found, generate fallback
  if (candidates.length === 0) {
    return generateFallbackConnectingJourney(origin, dest, date);
  }

  // ═══════════════════════════════════════════
  // PHASE 3: Hub Diversity + Pareto Pruning + Journey Tags
  // ═══════════════════════════════════════════
  const ranked = rankJourneys(candidates, preference);
  return assignJourneyTags(ranked).slice(0, 6);
}

// ==========================================
// Phase 3: Hub Diversity & Intelligent Ranking
// ==========================================

function rankJourneys(journeys: Journey[], pref: Preference): Journey[] {
  const directJourneys = journeys.filter(j => j.interchangeCount === 0);
  const connectingJourneys = journeys.filter(j => j.interchangeCount > 0);

  // Group connecting journeys by interchange junction hub
  const byHub = new Map<string, Journey[]>();
  for (const c of connectingJourneys) {
    const tr = c.legs.find(l => l.type === "transfer") as any;
    const hubId = tr ? tr.transfer.fromStationId : "OTHER";
    if (!byHub.has(hubId)) byHub.set(hubId, []);
    byHub.get(hubId)!.push(c);
  }

  // Pick the single best journey for each unique hub (HUB DIVERSITY)
  const bestPerHub: Journey[] = [];
  for (const [, hubJourneys] of byHub.entries()) {
    const sortedHub = sortList(hubJourneys, pref);
    bestPerHub.push(sortedHub[0]);
  }

  // Combine direct journeys with diverse hub journeys
  const combined = [...directJourneys, ...bestPerHub];

  // Detour Filter: filter out excessive detours (>1.40x min duration)
  if (combined.length > 0) {
    const minDur = Math.min(...combined.map(j => j.totalDurationMinutes));
    const nonDetour = combined.filter(j => j.interchangeCount === 0 || j.totalDurationMinutes <= minDur * 1.40);
    const pool = nonDetour.length >= 3 ? nonDetour : combined;
    return sortList(pool, pref);
  }

  return sortList(combined, pref);
}

function sortList(list: Journey[], pref: Preference): Journey[] {
  return [...list].sort((a, b) => {
    if (pref === "fastest") return a.totalDurationMinutes - b.totalDurationMinutes;
    if (pref === "cheapest") return a.totalCost - b.totalCost;

    // "easy": Direct first, then balanced comfort score
    if (a.interchangeCount === 0 && b.interchangeCount > 0) return -1;
    if (b.interchangeCount === 0 && a.interchangeCount > 0) return 1;

    // Reward high safety score while penalizing unnecessary extra travel hours
    const scoreA = a.safetyScore * 1.5 - (a.totalDurationMinutes / 60) * 1.8;
    const scoreB = b.safetyScore * 1.5 - (b.totalDurationMinutes / 60) * 1.8;
    return scoreB - scoreA;
  });
}

/**
 * Assign flight-style journey tags based on Pareto analysis.
 * Each journey gets exactly one tag: fastest, safest, cheapest, alternative, or recommended.
 */
function assignJourneyTags(journeys: Journey[]): Journey[] {
  if (journeys.length === 0) return journeys;

  // Find the Pareto winners
  let fastestIdx = 0;
  let safestIdx = 0;
  let cheapestIdx = 0;

  for (let i = 1; i < journeys.length; i++) {
    if (journeys[i].totalDurationMinutes < journeys[fastestIdx].totalDurationMinutes) fastestIdx = i;
    if (journeys[i].safetyScore > journeys[safestIdx].safetyScore) safestIdx = i;
    if (journeys[i].totalCost < journeys[cheapestIdx].totalCost) cheapestIdx = i;
  }

  // Assign tags (priority: recommended > fastest > safest > cheapest > alternative)
  const tagged = journeys.map((j, idx) => {
    let tag: Journey["journeyTag"];
    if (idx === 0) tag = "recommended";
    else if (idx === fastestIdx && fastestIdx !== 0) tag = "fastest";
    else if (idx === safestIdx && safestIdx !== 0 && safestIdx !== fastestIdx) tag = "safest";
    else if (idx === cheapestIdx && cheapestIdx !== 0 && cheapestIdx !== fastestIdx && cheapestIdx !== safestIdx) tag = "cheapest";
    else tag = "alternative";

    return { ...j, journeyTag: tag };
  });

  return tagged;
}

// ==========================================
// Corridor Hubs (Fallback)
// ==========================================

export function determineCorridorHubs(origin: Station, dest: Station): Station[] {
  const origCodes = getStationCodesForLocation(origin);
  const destCodes = getStationCodesForLocation(dest);

  const isGoaOrKonkan = (s: Station, codes: Set<string>) =>
    codes.has("MAO") || codes.has("KRMI") || codes.has("THVM") || codes.has("VSG") || (s.state?.toLowerCase() === "goa") || s.name.toLowerCase().includes("goa");

  const isNorth = (s: Station, codes: Set<string>) =>
    codes.has("NDLS") || codes.has("NZM") || codes.has("DLI") || codes.has("CDG") || codes.has("ASR") || codes.has("CNB") ||
    ["delhi", "punjab", "haryana", "uttar pradesh", "rajasthan", "himachal pradesh", "jammu & kashmir"].includes(s.state?.toLowerCase() || "");

  const isWest = (s: Station, codes: Set<string>) =>
    codes.has("MMCT") || codes.has("CSMT") || codes.has("ADI") || codes.has("PUNE") || codes.has("ST") || codes.has("BRC") ||
    ["maharashtra", "gujarat"].includes(s.state?.toLowerCase() || "");

  const isSouth = (s: Station, codes: Set<string>) =>
    codes.has("SBC") || codes.has("MAS") || codes.has("HYB") || codes.has("ERS") ||
    ["karnataka", "tamil nadu", "kerala", "andhra pradesh", "telangana"].includes(s.state?.toLowerCase() || "");

  const isEast = (s: Station, codes: Set<string>) =>
    codes.has("HWH") || codes.has("SDAH") || codes.has("PNBE") || codes.has("GHY") || codes.has("PURI") ||
    ["west bengal", "bihar", "jharkhand", "odisha", "assam"].includes(s.state?.toLowerCase() || "");

  const isCentral = (s: Station, codes: Set<string>) =>
    codes.has("BPL") || codes.has("ET") || codes.has("JBP") || codes.has("NGP") || (s.state?.toLowerCase() === "madhya pradesh") || (s.state?.toLowerCase() === "chhattisgarh");

  if ((isNorth(origin, origCodes) && isGoaOrKonkan(dest, destCodes)) || (isGoaOrKonkan(origin, origCodes) && isNorth(dest, destCodes))) {
    return [getStation("BRC"), getStation("KOTA"), getStation("RTM"), getStation("PNVL"), getStation("ET")].filter(Boolean);
  }
  if ((isNorth(origin, origCodes) && isSouth(dest, destCodes)) || (isSouth(origin, origCodes) && isNorth(dest, destCodes))) {
    return [getStation("ET"), getStation("NGP"), getStation("BZA"), getStation("VGLJ") || getStation("JHS"), getStation("SC"), getStation("BPL")].filter(Boolean);
  }
  if ((isWest(origin, origCodes) && isSouth(dest, destCodes)) || (isSouth(origin, origCodes) && isWest(dest, destCodes))) {
    return [getStation("PUNE"), getStation("DD"), getStation("SUR"), getStation("GTL"), getStation("UBL"), getStation("WADI")].filter(Boolean);
  }
  if ((isWest(origin, origCodes) && isEast(dest, destCodes)) || (isEast(origin, origCodes) && isWest(dest, destCodes))) {
    return [getStation("BSL"), getStation("MMR"), getStation("NGP"), getStation("BSP"), getStation("R"), getStation("KGP")].filter(Boolean);
  }
  if ((isNorth(origin, origCodes) && isEast(dest, destCodes)) || (isEast(origin, origCodes) && isNorth(dest, destCodes))) {
    return [getStation("CNB"), getStation("PRYJ"), getStation("DDU"), getStation("BSB"), getStation("PNBE"), getStation("ASN")].filter(Boolean);
  }
  if ((isEast(origin, origCodes) && isSouth(dest, destCodes)) || (isSouth(origin, origCodes) && isEast(dest, destCodes))) {
    return [getStation("BZA"), getStation("VSKP"), getStation("BBS"), getStation("KUR"), getStation("RU")].filter(Boolean);
  }
  if ((isNorth(origin, origCodes) && isWest(dest, destCodes)) || (isWest(origin, origCodes) && isNorth(dest, destCodes))) {
    return [getStation("KOTA"), getStation("RTM"), getStation("BRC"), getStation("JP"), getStation("AII"), getStation("ST")].filter(Boolean);
  }
  if ((isCentral(origin, origCodes) && isSouth(dest, destCodes)) || (isSouth(origin, origCodes) && isCentral(dest, destCodes))) {
    return [getStation("ET"), getStation("NGP"), getStation("KZJ"), getStation("BZA")].filter(Boolean);
  }

  return [getStation("ET"), getStation("CNB"), getStation("BZA"), getStation("BRC"), getStation("NGP")].filter(Boolean);
}

export function determineCorridorHub(origin: Station, dest: Station): Station {
  const hubs = determineCorridorHubs(origin, dest);
  return hubs[0] || getStation("ET") || getStation("BRC") || getStation("NDLS");
}

// ==========================================
// Fallback: Generate connecting journeys when no real trains match
// ==========================================

function generateFallbackConnectingJourney(origin: Station, dest: Station, date: string): Journey[] {
  const hubs = determineCorridorHubs(origin, dest);
  const results: Journey[] = [];

  const createOption = (hub: Station, idx: number, depTime: string, arrTime1: string, dep2Time: string, arr2Time: string, dur1: number, dur2: number, buffer: number, label: string) => {
    const t1 = {
      id: `syn-${12945 + idx}`, number: `${12945 + idx}`,
      name: `${origin.city || origin.name} - ${hub.city || hub.name} Superfast`,
      originId: origin.id, destinationId: hub.id,
      departure: depTime, arrival: arrTime1, durationMinutes: dur1,
      fare: { sleeper: 480 + idx * 30, ac3: 1280 + idx * 70, ac2: 1790 + idx * 90 },
      classes: ["SL", "3A", "2A", "1A"], days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      reliability: 88 - idx * 2, avgDelay: 14 + idx * 3,
      stops: [
        { stationId: origin.id, arrival: null, departure: depTime, day: 0, platform: "2" },
        { stationId: hub.id, arrival: arrTime1, departure: null, day: 0, platform: "3" },
      ],
    } as any;

    const t2 = {
      id: `syn-${12460 + idx}`, number: `${12460 + idx}`,
      name: `${hub.city || hub.name} - ${dest.city || dest.name} Express`,
      originId: hub.id, destinationId: dest.id,
      departure: dep2Time, arrival: arr2Time, durationMinutes: dur2,
      fare: { sleeper: 520 + idx * 30, ac3: 1350 + idx * 70, ac2: 1880 + idx * 90 },
      classes: ["SL", "3A", "2A", "1A"], days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      reliability: 85 - idx * 2, avgDelay: 16 + idx * 3,
      stops: [
        { stationId: hub.id, arrival: null, departure: dep2Time, day: 0, platform: "4" },
        { stationId: dest.id, arrival: arr2Time, departure: null, day: 1, platform: "1" },
      ],
    } as any;

    const { safety, badge, delayProb, requiredP90 } = computeConnectionSafety(buffer - 10, t1.reliability, t1.avgDelay, false);

    const transfer: Transfer = {
      fromStationId: hub.id, toStationId: hub.id,
      requiresStationChange: false, requiredWalkingMinutes: 10,
      durationMinutes: buffer, usableBuffer: buffer - 10,
      risk: safety === "safe" ? "low" : safety === "moderate" ? "medium" : "high",
      riskLabel: safety === "safe" ? "Low risk" : safety === "moderate" ? "Moderate risk" : "High risk",
      reason: `Same station connection at ${hub.name} with ${formatDuration(buffer)} buffer.`,
      connectionSafety: safety, safetyBadge: badge,
      platformGuidance: getPlatformGuidance(hub.id, hub.id, "3", "4"),
      delayProbability: delayProb, requiredBufferP90: requiredP90,
    };

    results.push({
      id: `j-${origin.code}-${dest.code}-${label}`,
      origin, destination: dest, date,
      legs: [
        { type: "train", train: t1, from: origin, to: hub, departure: depTime, arrival: arrTime1, dayOffset: 0 },
        { type: "transfer", transfer, from: hub, to: hub },
        { type: "train", train: t2, from: hub, to: dest, departure: dep2Time, arrival: arr2Time, dayOffset: 1 },
      ],
      totalDurationMinutes: dur1 + buffer + dur2,
      totalCost: t1.fare.ac3 + t2.fare.ac3,
      interchangeCount: 1,
      riskyTransfer: transfer,
      riskLevel: transfer.risk === "invalid" ? "high" : transfer.risk,
      safetyScore: 92 - idx * 4,
      speedScore: 82 + idx * 6,
      costScore: 82 + idx * 7,
      reasons: [`1 Interchange at ${hub.name}`, "Same station platform transfer", `${formatDuration(buffer)} connection buffer`],
      whyNotFaster: idx === 0 ? "Selected for optimal connection buffer and reliability." : undefined,
      journeyTag: idx === 0 ? "recommended" : idx === 1 ? "fastest" : "cheapest",
    });
  };

  const hub1 = hubs[0] || getStation("BRC");
  const hub2 = hubs[1] || getStation("KOTA") || getStation("NGP");
  const hub3 = hubs[2] || getStation("PNVL") || getStation("SC");

  createOption(hub1, 0, "07:30", "16:45", "18:45", "06:30", 555, 705, 120, "rec");
  createOption(hub2, 1, "09:15", "17:15", "18:30", "05:15", 480, 645, 75, "fast");
  createOption(hub3, 2, "06:00", "15:30", "17:45", "05:45", 570, 720, 135, "cheap");

  return results;
}

// ==========================================
// Delay Recovery Simulator Engine
// ==========================================
export function getRecoveryOptions(journey: Journey, delayMinutes: number): { journey: Journey; buffer: number; risk: string }[] {
  if (journey.legs.length < 3) return [];
  const transferLeg = journey.legs[1] as any;
  const interchange = getStation(transferLeg.transfer.fromStationId);
  const dest = journey.destination;

  const firstTrainArrivalMin = timeToMinutes((journey.legs[0] as any).arrival);
  const actualArrival = firstTrainArrivalMin + delayMinutes;
  const walk = transferLeg.transfer.requiredWalkingMinutes;

  const matchingTrains = trains.filter(t => t.originId === interchange.id || t.stops.some(s => s.stationId === interchange.id));

  const later = matchingTrains
    .map(t => {
      const depStr = t.stops.find(s => s.stationId === interchange.id)?.departure || t.departure;
      let dep = timeToMinutes(depStr);
      if (dep < actualArrival) dep += 1440;
      const buffer = dep - actualArrival - walk;
      const risk = buffer < 0 ? "invalid" : buffer < 60 ? "medium" : "low";
      return { t, buffer, risk, depStr };
    })
    .filter(c => c.buffer >= 20 && c.buffer <= 300)
    .sort((a, b) => a.buffer - b.buffer)
    .slice(0, 3);

  return later.map(c => {
    const safetyResult = computeConnectionSafety(c.buffer, c.t.reliability || 80, c.t.avgDelay || 20, false);

    const newTransfer: Transfer = {
      fromStationId: interchange.id, toStationId: interchange.id,
      requiresStationChange: false, requiredWalkingMinutes: walk,
      durationMinutes: c.buffer + walk, usableBuffer: c.buffer,
      risk: c.risk as any,
      riskLabel: c.risk === "low" ? "Low risk" : c.risk === "medium" ? "Moderate risk" : "High risk",
      reason: c.risk === "low" ? "Comfortable buffer even after delay." : "Tighter connection, but feasible.",
      connectionSafety: safetyResult.safety,
      safetyBadge: safetyResult.badge,
      platformGuidance: getPlatformGuidance(interchange.id, interchange.id),
      delayProbability: safetyResult.delayProb,
      requiredBufferP90: safetyResult.requiredP90,
    };
    const recJourney: Journey = {
      ...journey,
      id: journey.id + `-rec-${c.t.number}`,
      legs: [
        journey.legs[0],
        { type: "transfer", transfer: newTransfer, from: interchange, to: interchange },
        { type: "train", train: c.t, from: interchange, to: dest, departure: c.depStr, arrival: c.t.arrival, dayOffset: 1 },
      ],
      totalDurationMinutes: journey.totalDurationMinutes + delayMinutes + (c.buffer - transferLeg.transfer.durationMinutes),
    };
    return { journey: recJourney, buffer: c.buffer + walk, risk: c.risk };
  });
}
