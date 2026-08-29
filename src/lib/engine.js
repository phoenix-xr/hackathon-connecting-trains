"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_INDIAN_JUNCTIONS = void 0;
exports.formatDuration = formatDuration;
exports.timeToMinutes = timeToMinutes;
exports.minutesToTime = minutesToTime;
exports.getStationCodesForLocation = getStationCodesForLocation;
exports.isJunctionStation = isJunctionStation;
exports.findJourneys = findJourneys;
exports.determineCorridorHubs = determineCorridorHubs;
exports.determineCorridorHub = determineCorridorHub;
exports.getRecoveryOptions = getRecoveryOptions;
var stations_1 = require("@/data/stations");
var trains_1 = require("@/data/trains");
var station_topology_1 = require("@/data/station_topology");
// ==========================================
// Time & Format Helpers
// ==========================================
function timeToMinutes(t) {
    if (!t || !t.includes(":"))
        return 0;
    var _a = t.split(":").map(Number), h = _a[0], m = _a[1];
    return (h || 0) * 60 + (m || 0);
}
function minutesToTime(min) {
    var normalized = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(normalized / 60);
    var m = normalized % 60;
    return "".concat(String(h).padStart(2, "0"), ":").concat(String(m).padStart(2, "0"));
}
function formatDuration(min) {
    var h = Math.floor(min / 60);
    var m = min % 60;
    if (h === 0)
        return "".concat(m, "m");
    if (m === 0)
        return "".concat(h, "h");
    return "".concat(h, "h ").concat(m, "m");
}
// ==========================================
// Phase 1: Spatial Bounding — Haversine + Forward Progress Vector
// ==========================================
/** Haversine distance between two lat/lng points in kilometers */
function haversineDistance(lat1, lng1, lat2, lng2) {
    var R = 6371; // Earth radius in km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
/** Check if junction J is on a valid forward path from O to D using dot product */
function isForwardProgress(oLat, oLng, jLat, jLng, dLat, dLng) {
    // Vector O→J
    var ojLat = jLat - oLat;
    var ojLng = jLng - oLng;
    // Vector O→D
    var odLat = dLat - oLat;
    var odLng = dLng - oLng;
    // Vector J→D
    var jdLat = dLat - jLat;
    var jdLng = dLng - jLng;
    // Dot products: O→J must roughly align with O→D, and J→D must too
    var dotOJOD = ojLat * odLat + ojLng * odLng;
    var dotJDOD = jdLat * odLat + jdLng * odLng;
    return dotOJOD > 0 && dotJDOD > 0;
}
/**
 * Detour Factor: κ = 1.35
 * Any junction J where dist(O,J) + dist(J,D) > κ × dist(O,D) is pruned.
 */
var DETOUR_FACTOR = 1.35;
/**
 * Phase 1: Filter candidate junctions using the Ellipsoid Bounding Filter.
 * Returns a Set of station IDs that pass both:
 *   1. Ellipsoid: dist(O,J) + dist(J,D) ≤ κ × dist(O,D)
 *   2. Forward Progress: dot(V_OJ, V_OD) > 0 AND dot(V_JD, V_OD) > 0
 *
 * Falls back to all junctions if coordinates are unavailable.
 */
function filterCandidateJunctions(originCodes, destCodes) {
    // Get coordinates for origin and destination
    var oCoords = null;
    var dCoords = null;
    for (var _i = 0, originCodes_1 = originCodes; _i < originCodes_1.length; _i++) {
        var code = originCodes_1[_i];
        oCoords = (0, stations_1.getStationCoordinates)(code);
        if (oCoords)
            break;
    }
    for (var _a = 0, destCodes_1 = destCodes; _a < destCodes_1.length; _a++) {
        var code = destCodes_1[_a];
        dCoords = (0, stations_1.getStationCoordinates)(code);
        if (dCoords)
            break;
    }
    var validJunctions = new Set();
    // If we have both coordinates, apply spatial bounding
    if (oCoords && dCoords) {
        var odDist = haversineDistance(oCoords.lat, oCoords.lng, dCoords.lat, dCoords.lng);
        var maxDetour = DETOUR_FACTOR * odDist;
        for (var _b = 0, ALL_INDIAN_JUNCTIONS_1 = exports.ALL_INDIAN_JUNCTIONS; _b < ALL_INDIAN_JUNCTIONS_1.length; _b++) {
            var jCode = ALL_INDIAN_JUNCTIONS_1[_b];
            // Don't filter out origin/destination stations
            if (originCodes.has(jCode) || destCodes.has(jCode))
                continue;
            var jCoords = (0, stations_1.getStationCoordinates)(jCode);
            if (!jCoords) {
                // No coordinates — include it (benefit of doubt)
                validJunctions.add(jCode);
                continue;
            }
            // Ellipsoid filter
            var ojDist = haversineDistance(oCoords.lat, oCoords.lng, jCoords.lat, jCoords.lng);
            var jdDist = haversineDistance(jCoords.lat, jCoords.lng, dCoords.lat, dCoords.lng);
            if (ojDist + jdDist > maxDetour)
                continue;
            // Forward progress vector
            if (!isForwardProgress(oCoords.lat, oCoords.lng, jCoords.lat, jCoords.lng, dCoords.lat, dCoords.lng)) {
                continue;
            }
            validJunctions.add(jCode);
        }
    }
    else {
        // No coordinates available — include all junctions (fallback)
        for (var _c = 0, ALL_INDIAN_JUNCTIONS_2 = exports.ALL_INDIAN_JUNCTIONS; _c < ALL_INDIAN_JUNCTIONS_2.length; _c++) {
            var jCode = ALL_INDIAN_JUNCTIONS_2[_c];
            validJunctions.add(jCode);
        }
    }
    return validJunctions;
}
// ==========================================
// Station & Alias Resolution
// ==========================================
// Canonical city & region aliases for robust railway searching
var CANONICAL_CITY_ALIASES = {
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
function getStationCodesForLocation(st, queryText) {
    var codes = new Set();
    if (st === null || st === void 0 ? void 0 : st.code)
        codes.add(st.code.toUpperCase());
    if (st === null || st === void 0 ? void 0 : st.id)
        codes.add(st.id.toUpperCase());
    var check = function (str) {
        if (!str)
            return;
        var lower = str.toLowerCase().trim();
        for (var _i = 0, _a = Object.entries(CANONICAL_CITY_ALIASES); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], aliasList = _b[1];
            if (lower === key || lower.includes(key) || key.includes(lower)) {
                aliasList.forEach(function (c) { return codes.add(c); });
            }
        }
    };
    check(queryText);
    check(st === null || st === void 0 ? void 0 : st.name);
    check(st === null || st === void 0 ? void 0 : st.city);
    check(st === null || st === void 0 ? void 0 : st.state);
    return codes;
}
// ==========================================
// Comprehensive All-India Railway Junction Network
// ==========================================
exports.ALL_INDIAN_JUNCTIONS = [
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
function isJunctionStation(stationId) {
    if (exports.ALL_INDIAN_JUNCTIONS.includes(stationId.toUpperCase()))
        return true;
    var st = (0, stations_1.getStation)(stationId);
    if (!st || !st.name)
        return false;
    var lower = st.name.toLowerCase();
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
function computeConnectionSafety(usableBuffer, t1Reliability, t1AvgDelay, requiresStationChange) {
    // Estimate p90 delay from avgDelay and reliability
    // Higher avgDelay + lower reliability → higher p90
    var p90Delay = Math.round(t1AvgDelay * (2.0 + (100 - t1Reliability) / 40));
    var mct = requiresStationChange ? 75 : 40;
    var requiredP90 = mct + p90Delay;
    // Probability of delay exceeding usable buffer (simplified log-normal CDF)
    // P(delay > usableBuffer) ≈ based on avgDelay and reliability spread
    var delayProb;
    if (usableBuffer > requiredP90 + 30) {
        delayProb = Math.max(2, Math.round(5 * (100 - t1Reliability) / 100));
    }
    else if (usableBuffer > requiredP90) {
        delayProb = Math.round(10 + (requiredP90 + 30 - usableBuffer) * 0.4);
    }
    else if (usableBuffer > mct + t1AvgDelay) {
        delayProb = Math.round(20 + (requiredP90 - usableBuffer) * 0.5);
    }
    else {
        delayProb = Math.min(85, Math.round(40 + (mct + t1AvgDelay - usableBuffer) * 0.7));
    }
    delayProb = Math.min(95, Math.max(2, delayProb));
    // Classification
    var safety;
    var badge;
    if (usableBuffer >= requiredP90 && delayProb <= 15) {
        safety = "safe";
        badge = "\uD83D\uDFE2 Safe Connection (+".concat(formatDuration(usableBuffer), " buffer)");
    }
    else if (usableBuffer >= mct + t1AvgDelay && delayProb <= 40) {
        safety = "moderate";
        badge = "\uD83D\uDFE1 Moderate Buffer (+".concat(formatDuration(usableBuffer), ") \u2014 ").concat(delayProb, "% delay risk");
    }
    else {
        safety = "risky";
        badge = "\uD83D\uDD34 Tight Connection (+".concat(formatDuration(usableBuffer), ") \u2014 ").concat(delayProb, "% delay risk");
    }
    return { safety: safety, badge: badge, delayProb: delayProb, requiredP90: requiredP90 };
}
/**
 * Buffer Quality Scoring Curve
 * Rewards the flight-style sweet spot of 50–135 minutes
 */
function computeBufferScore(usableBuffer) {
    if (usableBuffer < 35)
        return 20;
    if (usableBuffer >= 50 && usableBuffer <= 135)
        return 100; // Peak sweet spot
    if (usableBuffer > 135 && usableBuffer <= 190)
        return 85;
    if (usableBuffer > 190 && usableBuffer <= 250)
        return 65;
    return 40; // Too long
}
// ==========================================
// Phase 2: Round-Based Timetable Scan (Rail-RAPTOR)
// ==========================================
function calculateSegmentDuration(depTime, depDay, arrTime, arrDay) {
    var depMin = timeToMinutes(depTime) + depDay * 1440;
    var arrMin = timeToMinutes(arrTime) + arrDay * 1440;
    if (arrMin < depMin)
        arrMin += 1440;
    return arrMin - depMin;
}
// Maximum Layover Time limits (MLT)
var MLT_SAME_STATION = 270; // 4.5 hours max same-station layover
var MLT_CROSS_STATION = 330; // 5.5 hours max cross-station layover
/**
 * Build a Transfer object between two stops with MCT/MLT enforcement
 * and connection safety scoring.
 */
function buildTransferBetweenStops(t1, arr1, day1, station1, t2, dep2, day2, station2, fromPlatform, toPlatform) {
    var arrTotal = timeToMinutes(arr1) + day1 * 1440;
    var depTotal = timeToMinutes(dep2) + day2 * 1440;
    // Ensure T2 departs after T1 arrives (possibly next day)
    while (depTotal < arrTotal) {
        depTotal += 1440;
    }
    var rawBuffer = depTotal - arrTotal;
    var requiresStationChange = station1.id !== station2.id && !(0, station_topology_1.isSameCity)(station1.id, station2.id) === false
        ? station1.id !== station2.id
        : station1.id !== station2.id;
    // Use topology-based MCT
    var mct = requiresStationChange
        ? (0, station_topology_1.getCrossStationMCT)(station1.id, station2.id)
        : (0, station_topology_1.getIntraStationMCT)(station1.id);
    var mlt = requiresStationChange ? MLT_CROSS_STATION : MLT_SAME_STATION;
    var usable = rawBuffer - (requiresStationChange ? (0, station_topology_1.getCrossStationMCT)(station1.id, station2.id) : (0, station_topology_1.getStationTransferProfile)(station1.id).minIntraStationWalkMinutes);
    // MCT/MLT enforcement
    if (rawBuffer < mct || rawBuffer > mlt) {
        return {
            fromStationId: station1.id,
            toStationId: station2.id,
            requiresStationChange: requiresStationChange,
            requiredWalkingMinutes: requiresStationChange ? (0, station_topology_1.getCrossStationMCT)(station1.id, station2.id) : (0, station_topology_1.getStationTransferProfile)(station1.id).minIntraStationWalkMinutes,
            durationMinutes: rawBuffer,
            usableBuffer: usable,
            risk: "invalid",
            riskLabel: "Not possible",
            reason: rawBuffer > mlt ? "Layover too long (>".concat(formatDuration(mlt), ")") : "Connection too short (<".concat(formatDuration(mct), ")"),
            connectionSafety: "risky",
            safetyBadge: "⛔ Connection not feasible",
            platformGuidance: "",
        };
    }
    // Connection safety scoring
    var _a = computeConnectionSafety(usable, t1.reliability || 80, t1.avgDelay || 20, requiresStationChange), safety = _a.safety, badge = _a.badge, delayProb = _a.delayProb, requiredP90 = _a.requiredP90;
    // Legacy risk mapping (backwards compat)
    var risk;
    if (safety === "safe")
        risk = "low";
    else if (safety === "moderate")
        risk = "medium";
    else
        risk = "high";
    // Platform guidance
    var platformGuidanceText = (0, station_topology_1.getPlatformGuidance)(station1.id, station2.id, fromPlatform, toPlatform);
    var transfer = {
        fromStationId: station1.id,
        toStationId: station2.id,
        requiresStationChange: requiresStationChange,
        stationChangeTransferMinutes: requiresStationChange ? (0, station_topology_1.getCrossStationMCT)(station1.id, station2.id) : undefined,
        requiredWalkingMinutes: requiresStationChange ? (0, station_topology_1.getCrossStationMCT)(station1.id, station2.id) : (0, station_topology_1.getStationTransferProfile)(station1.id).minIntraStationWalkMinutes,
        durationMinutes: rawBuffer,
        usableBuffer: usable,
        risk: risk,
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
        if (safety === "safe")
            transfer.reason = "Cross-station road transfer with comfortable ".concat(formatDuration(rawBuffer), " buffer.");
        else if (safety === "moderate")
            transfer.reason = "Road transfer between stations \u2014 connection is moderately tight.";
        else
            transfer.reason = "Very tight road transfer between stations \u2014 not recommended.";
    }
    else {
        if (safety === "safe")
            transfer.reason = "Same station with ".concat(formatDuration(rawBuffer), " buffer \u2014 plenty of time for platform change and luggage.");
        else if (safety === "moderate")
            transfer.reason = "Same station connection, but tighter buffer in case of delays.";
        else
            transfer.reason = "Same station but minimal recovery margin.";
    }
    return transfer;
}
// ==========================================
// Main Routing Engine: findJourneys (Rail-RAPTOR 3-Phase Pipeline)
// ==========================================
function findJourneys(fromName, toName, date, preference) {
    var _a, _b;
    var origin = (0, stations_1.getStationByName)(fromName);
    var dest = (0, stations_1.getStationByName)(toName);
    if (!origin || !dest || origin.id === dest.id)
        return [];
    var originCodes = getStationCodesForLocation(origin, fromName);
    var destCodes = getStationCodesForLocation(dest, toName);
    var candidates = [];
    var seenIds = new Set();
    // Robust origin/dest matchers with city & alias support
    var matchesOrigin = function (stId) {
        var code = stId.toUpperCase();
        if (originCodes.has(code))
            return true;
        var st = (0, stations_1.getStation)(stId);
        if (originCodes.has(st.code.toUpperCase()))
            return true;
        return Boolean(origin.city && st.city && origin.city.toLowerCase() === st.city.toLowerCase());
    };
    var matchesDest = function (stId) {
        var code = stId.toUpperCase();
        if (destCodes.has(code))
            return true;
        var st = (0, stations_1.getStation)(stId);
        if (destCodes.has(st.code.toUpperCase()))
            return true;
        return Boolean(dest.city && st.city && dest.city.toLowerCase() === st.city.toLowerCase());
    };
    // ═══════════════════════════════════════════
    // PHASE 1: Spatial Bounding (Ellipsoid + Forward Progress)
    // ═══════════════════════════════════════════
    var validJunctions = filterCandidateJunctions(originCodes, destCodes);
    var _loop_1 = function (t) {
        var origStopIdx = t.stops.findIndex(function (s) { return matchesOrigin(s.stationId); });
        var destStopIdx = t.stops.findIndex(function (s, idx) { return idx > origStopIdx && matchesDest(s.stationId); });
        if (origStopIdx !== -1 && destStopIdx !== -1) {
            var origStop = t.stops[origStopIdx];
            var destStop = t.stops[destStopIdx];
            var dep = origStop.departure || t.departure;
            var arr = destStop.arrival || t.arrival;
            var actualOrigin = (0, stations_1.getStation)(origStop.stationId);
            var actualDest = (0, stations_1.getStation)(destStop.stationId);
            var dur = calculateSegmentDuration(dep, origStop.day, arr, destStop.day);
            var journeyId = "j-dir-".concat(t.number);
            if (!seenIds.has(journeyId)) {
                seenIds.add(journeyId);
                candidates.push({
                    id: journeyId,
                    origin: actualOrigin,
                    destination: actualDest,
                    date: date,
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
                        "".concat(t.name, " (").concat(t.number, ")"),
                        "".concat(t.reliability, "% on-time reliability")
                    ],
                });
            }
        }
    };
    // ═══════════════════════════════════════════
    // PHASE 2 — ROUND 0: Direct Train Search
    // ═══════════════════════════════════════════
    for (var _i = 0, trains_2 = trains_1.trains; _i < trains_2.length; _i++) {
        var t = trains_2[_i];
        _loop_1(t);
    }
    // ═══════════════════════════════════════════
    // PHASE 2 — ROUND 1: 1-Interchange Layover Scan
    // ═══════════════════════════════════════════
    for (var _c = 0, trains_3 = trains_1.trains; _c < trains_3.length; _c++) {
        var t1 = trains_3[_c];
        var origIdx = t1.stops.findIndex(function (s) { return matchesOrigin(s.stationId); });
        if (origIdx === -1 || origIdx === t1.stops.length - 1)
            continue;
        var origStop = t1.stops[origIdx];
        var actualOrigin = (0, stations_1.getStation)(origStop.stationId);
        var dep1 = origStop.departure || t1.departure;
        var _loop_2 = function (i) {
            var layoverStop1 = t1.stops[i];
            var layoverStation1 = (0, stations_1.getStation)(layoverStop1.stationId);
            var arr1 = layoverStop1.arrival || t1.arrival;
            // Filter: Skip immediate suburban stops (<35 mins away)
            var timeFromOrigin = calculateSegmentDuration(dep1, origStop.day, arr1, layoverStop1.day);
            if (timeFromOrigin < 35)
                return "continue";
            // SPATIAL FILTER: Check if this station passes Phase 1 bounding
            var stationCode = layoverStop1.stationId.toUpperCase();
            if (!validJunctions.has(stationCode) && !isJunctionStation(stationCode)) {
                return "continue";
            }
            // Get platform of T1's arrival
            var t1Platform = layoverStop1.platform;
            // Find all T2 candidates departing from this junction (or same-city cluster) to destination
            var clusterStations = (0, station_topology_1.getClusterStations)(layoverStation1.id);
            var _loop_3 = function (t2) {
                if (t2.id === t1.id)
                    return "continue";
                // Filter: If T2 also serves origin directly, skip (redundant transfer)
                if (t2.stops.some(function (s) { return matchesOrigin(s.stationId); }))
                    return "continue";
                // Find T2's stop at the layover station (or same-city cluster station)
                var layoverIdx2 = t2.stops.findIndex(function (s) {
                    return clusterStations.includes(s.stationId) ||
                        s.stationId === layoverStation1.id ||
                        (Boolean((0, stations_1.getStation)(s.stationId).city && layoverStation1.city && (0, stations_1.getStation)(s.stationId).city.toLowerCase() === layoverStation1.city.toLowerCase()));
                });
                if (layoverIdx2 === -1 || layoverIdx2 === t2.stops.length - 1)
                    return "continue";
                var layoverStop2 = t2.stops[layoverIdx2];
                var layoverStation2 = (0, stations_1.getStation)(layoverStop2.stationId);
                // Find T2's destination stop
                var destIdx2 = t2.stops.findIndex(function (s, idx) { return idx > layoverIdx2 && matchesDest(s.stationId); });
                if (destIdx2 === -1)
                    return "continue";
                var destStop2 = t2.stops[destIdx2];
                var actualDest = (0, stations_1.getStation)(destStop2.stationId);
                var dep2 = layoverStop2.departure || t2.departure;
                var arr2 = destStop2.arrival || t2.arrival;
                // Get platform of T2's departure
                var t2Platform = layoverStop2.platform;
                // Build transfer with MCT/MLT enforcement and safety scoring
                var transfer = buildTransferBetweenStops(t1, arr1, layoverStop1.day, layoverStation1, t2, dep2, layoverStop2.day, layoverStation2, t1Platform, t2Platform);
                if (transfer.risk === "invalid")
                    return "continue";
                var leg1Dur = calculateSegmentDuration(dep1, origStop.day, arr1, layoverStop1.day);
                var leg2Dur = calculateSegmentDuration(dep2, layoverStop2.day, arr2, destStop2.day);
                var totalDur = leg1Dur + transfer.durationMinutes + leg2Dur;
                var totalCost = (((_a = t1.fare) === null || _a === void 0 ? void 0 : _a.ac3) || 1200) + (((_b = t2.fare) === null || _b === void 0 ? void 0 : _b.ac3) || 1200);
                // Quality scoring (combines buffer quality + reliability + station convenience)
                var bufferScore = computeBufferScore(transfer.usableBuffer);
                var reliabilityScore = (t1.reliability + t2.reliability) / 2;
                var stationScore = transfer.requiresStationChange ? 50 : 95;
                var safety = Math.round(bufferScore * 0.45 + reliabilityScore * 0.35 + stationScore * 0.2);
                var journeyId = "j-".concat(t1.number, "-").concat(layoverStation1.id, "-").concat(t2.number);
                if (!seenIds.has(journeyId)) {
                    seenIds.add(journeyId);
                    candidates.push({
                        id: journeyId,
                        origin: actualOrigin,
                        destination: actualDest,
                        date: date,
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
                                transfer: transfer,
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
                        totalCost: totalCost,
                        interchangeCount: 1,
                        riskyTransfer: transfer,
                        riskLevel: transfer.risk,
                        safetyScore: safety,
                        speedScore: Math.max(10, Math.round(100 - (totalDur / 3000) * 80)),
                        costScore: Math.max(10, Math.round(100 - (totalCost / 5000) * 80)),
                        reasons: [
                            "1 Change at ".concat(layoverStation1.name),
                            transfer.requiresStationChange ? "Transfer to ".concat(layoverStation2.name) : "Same station interchange",
                            "".concat(formatDuration(transfer.durationMinutes), " connection layover"),
                            transfer.safetyBadge,
                        ],
                        whyNotFaster: transfer.connectionSafety === "safe"
                            ? "Selected for optimal ".concat(formatDuration(transfer.usableBuffer), " transfer buffer.")
                            : undefined,
                    });
                }
            };
            for (var _d = 0, trains_4 = trains_1.trains; _d < trains_4.length; _d++) {
                var t2 = trains_4[_d];
                _loop_3(t2);
            }
        };
        // Scan all downstream stops as potential interchange junctions
        for (var i = origIdx + 1; i < t1.stops.length; i++) {
            _loop_2(i);
        }
    }
    // If no direct or single-connection route found, generate fallback
    if (candidates.length === 0) {
        return generateFallbackConnectingJourney(origin, dest, date);
    }
    // ═══════════════════════════════════════════
    // PHASE 3: Hub Diversity + Pareto Pruning + Journey Tags
    // ═══════════════════════════════════════════
    var ranked = rankJourneys(candidates, preference);
    return assignJourneyTags(ranked).slice(0, 6);
}
// ==========================================
// Phase 3: Hub Diversity & Intelligent Ranking
// ==========================================
function rankJourneys(journeys, pref) {
    var directJourneys = journeys.filter(function (j) { return j.interchangeCount === 0; });
    var connectingJourneys = journeys.filter(function (j) { return j.interchangeCount > 0; });
    // Group connecting journeys by interchange junction hub
    var byHub = new Map();
    for (var _i = 0, connectingJourneys_1 = connectingJourneys; _i < connectingJourneys_1.length; _i++) {
        var c = connectingJourneys_1[_i];
        var tr = c.legs.find(function (l) { return l.type === "transfer"; });
        var hubId = tr ? tr.transfer.fromStationId : "OTHER";
        if (!byHub.has(hubId))
            byHub.set(hubId, []);
        byHub.get(hubId).push(c);
    }
    // Pick the single best journey for each unique hub (HUB DIVERSITY)
    var bestPerHub = [];
    for (var _a = 0, _b = byHub.entries(); _a < _b.length; _a++) {
        var _c = _b[_a], hubJourneys = _c[1];
        var sortedHub = sortList(hubJourneys, pref);
        bestPerHub.push(sortedHub[0]);
    }
    // Combine direct journeys with diverse hub journeys
    var combined = __spreadArray(__spreadArray([], directJourneys, true), bestPerHub, true);
    // Detour Filter: filter out excessive detours (>1.40x min duration)
    if (combined.length > 0) {
        var minDur_1 = Math.min.apply(Math, combined.map(function (j) { return j.totalDurationMinutes; }));
        var nonDetour = combined.filter(function (j) { return j.interchangeCount === 0 || j.totalDurationMinutes <= minDur_1 * 1.40; });
        var pool = nonDetour.length >= 3 ? nonDetour : combined;
        return sortList(pool, pref);
    }
    return sortList(combined, pref);
}
function sortList(list, pref) {
    return __spreadArray([], list, true).sort(function (a, b) {
        if (pref === "fastest")
            return a.totalDurationMinutes - b.totalDurationMinutes;
        if (pref === "cheapest")
            return a.totalCost - b.totalCost;
        // "easy": Direct first, then balanced comfort score
        if (a.interchangeCount === 0 && b.interchangeCount > 0)
            return -1;
        if (b.interchangeCount === 0 && a.interchangeCount > 0)
            return 1;
        // Reward high safety score while penalizing unnecessary extra travel hours
        var scoreA = a.safetyScore * 1.5 - (a.totalDurationMinutes / 60) * 1.8;
        var scoreB = b.safetyScore * 1.5 - (b.totalDurationMinutes / 60) * 1.8;
        return scoreB - scoreA;
    });
}
/**
 * Assign flight-style journey tags based on Pareto analysis.
 * Each journey gets exactly one tag: fastest, safest, cheapest, alternative, or recommended.
 */
function assignJourneyTags(journeys) {
    if (journeys.length === 0)
        return journeys;
    // Find the Pareto winners
    var fastestIdx = 0;
    var safestIdx = 0;
    var cheapestIdx = 0;
    for (var i = 1; i < journeys.length; i++) {
        if (journeys[i].totalDurationMinutes < journeys[fastestIdx].totalDurationMinutes)
            fastestIdx = i;
        if (journeys[i].safetyScore > journeys[safestIdx].safetyScore)
            safestIdx = i;
        if (journeys[i].totalCost < journeys[cheapestIdx].totalCost)
            cheapestIdx = i;
    }
    // Assign tags (priority: recommended > fastest > safest > cheapest > alternative)
    var tagged = journeys.map(function (j, idx) {
        var tag;
        if (idx === 0)
            tag = "recommended";
        else if (idx === fastestIdx && fastestIdx !== 0)
            tag = "fastest";
        else if (idx === safestIdx && safestIdx !== 0 && safestIdx !== fastestIdx)
            tag = "safest";
        else if (idx === cheapestIdx && cheapestIdx !== 0 && cheapestIdx !== fastestIdx && cheapestIdx !== safestIdx)
            tag = "cheapest";
        else
            tag = "alternative";
        return __assign(__assign({}, j), { journeyTag: tag });
    });
    return tagged;
}
// ==========================================
// Corridor Hubs (Fallback)
// ==========================================
function determineCorridorHubs(origin, dest) {
    var origCodes = getStationCodesForLocation(origin);
    var destCodes = getStationCodesForLocation(dest);
    var isGoaOrKonkan = function (s, codes) { var _a; return codes.has("MAO") || codes.has("KRMI") || codes.has("THVM") || codes.has("VSG") || (((_a = s.state) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === "goa") || s.name.toLowerCase().includes("goa"); };
    var isNorth = function (s, codes) {
        var _a;
        return codes.has("NDLS") || codes.has("NZM") || codes.has("DLI") || codes.has("CDG") || codes.has("ASR") || codes.has("CNB") ||
            ["delhi", "punjab", "haryana", "uttar pradesh", "rajasthan", "himachal pradesh", "jammu & kashmir"].includes(((_a = s.state) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "");
    };
    var isWest = function (s, codes) {
        var _a;
        return codes.has("MMCT") || codes.has("CSMT") || codes.has("ADI") || codes.has("PUNE") || codes.has("ST") || codes.has("BRC") ||
            ["maharashtra", "gujarat"].includes(((_a = s.state) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "");
    };
    var isSouth = function (s, codes) {
        var _a;
        return codes.has("SBC") || codes.has("MAS") || codes.has("HYB") || codes.has("ERS") ||
            ["karnataka", "tamil nadu", "kerala", "andhra pradesh", "telangana"].includes(((_a = s.state) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "");
    };
    var isEast = function (s, codes) {
        var _a;
        return codes.has("HWH") || codes.has("SDAH") || codes.has("PNBE") || codes.has("GHY") || codes.has("PURI") ||
            ["west bengal", "bihar", "jharkhand", "odisha", "assam"].includes(((_a = s.state) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "");
    };
    var isCentral = function (s, codes) { var _a, _b; return codes.has("BPL") || codes.has("ET") || codes.has("JBP") || codes.has("NGP") || (((_a = s.state) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === "madhya pradesh") || (((_b = s.state) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === "chhattisgarh"); };
    if ((isNorth(origin, origCodes) && isGoaOrKonkan(dest, destCodes)) || (isGoaOrKonkan(origin, origCodes) && isNorth(dest, destCodes))) {
        return [(0, stations_1.getStation)("BRC"), (0, stations_1.getStation)("KOTA"), (0, stations_1.getStation)("RTM"), (0, stations_1.getStation)("PNVL"), (0, stations_1.getStation)("ET")].filter(Boolean);
    }
    if ((isNorth(origin, origCodes) && isSouth(dest, destCodes)) || (isSouth(origin, origCodes) && isNorth(dest, destCodes))) {
        return [(0, stations_1.getStation)("ET"), (0, stations_1.getStation)("NGP"), (0, stations_1.getStation)("BZA"), (0, stations_1.getStation)("VGLJ") || (0, stations_1.getStation)("JHS"), (0, stations_1.getStation)("SC"), (0, stations_1.getStation)("BPL")].filter(Boolean);
    }
    if ((isWest(origin, origCodes) && isSouth(dest, destCodes)) || (isSouth(origin, origCodes) && isWest(dest, destCodes))) {
        return [(0, stations_1.getStation)("PUNE"), (0, stations_1.getStation)("DD"), (0, stations_1.getStation)("SUR"), (0, stations_1.getStation)("GTL"), (0, stations_1.getStation)("UBL"), (0, stations_1.getStation)("WADI")].filter(Boolean);
    }
    if ((isWest(origin, origCodes) && isEast(dest, destCodes)) || (isEast(origin, origCodes) && isWest(dest, destCodes))) {
        return [(0, stations_1.getStation)("BSL"), (0, stations_1.getStation)("MMR"), (0, stations_1.getStation)("NGP"), (0, stations_1.getStation)("BSP"), (0, stations_1.getStation)("R"), (0, stations_1.getStation)("KGP")].filter(Boolean);
    }
    if ((isNorth(origin, origCodes) && isEast(dest, destCodes)) || (isEast(origin, origCodes) && isNorth(dest, destCodes))) {
        return [(0, stations_1.getStation)("CNB"), (0, stations_1.getStation)("PRYJ"), (0, stations_1.getStation)("DDU"), (0, stations_1.getStation)("BSB"), (0, stations_1.getStation)("PNBE"), (0, stations_1.getStation)("ASN")].filter(Boolean);
    }
    if ((isEast(origin, origCodes) && isSouth(dest, destCodes)) || (isSouth(origin, origCodes) && isEast(dest, destCodes))) {
        return [(0, stations_1.getStation)("BZA"), (0, stations_1.getStation)("VSKP"), (0, stations_1.getStation)("BBS"), (0, stations_1.getStation)("KUR"), (0, stations_1.getStation)("RU")].filter(Boolean);
    }
    if ((isNorth(origin, origCodes) && isWest(dest, destCodes)) || (isWest(origin, origCodes) && isNorth(dest, destCodes))) {
        return [(0, stations_1.getStation)("KOTA"), (0, stations_1.getStation)("RTM"), (0, stations_1.getStation)("BRC"), (0, stations_1.getStation)("JP"), (0, stations_1.getStation)("AII"), (0, stations_1.getStation)("ST")].filter(Boolean);
    }
    if ((isCentral(origin, origCodes) && isSouth(dest, destCodes)) || (isSouth(origin, origCodes) && isCentral(dest, destCodes))) {
        return [(0, stations_1.getStation)("ET"), (0, stations_1.getStation)("NGP"), (0, stations_1.getStation)("KZJ"), (0, stations_1.getStation)("BZA")].filter(Boolean);
    }
    return [(0, stations_1.getStation)("ET"), (0, stations_1.getStation)("CNB"), (0, stations_1.getStation)("BZA"), (0, stations_1.getStation)("BRC"), (0, stations_1.getStation)("NGP")].filter(Boolean);
}
function determineCorridorHub(origin, dest) {
    var hubs = determineCorridorHubs(origin, dest);
    return hubs[0] || (0, stations_1.getStation)("ET") || (0, stations_1.getStation)("BRC") || (0, stations_1.getStation)("NDLS");
}
// ==========================================
// Fallback: Generate connecting journeys when no real trains match
// ==========================================
function generateFallbackConnectingJourney(origin, dest, date) {
    var hubs = determineCorridorHubs(origin, dest);
    var results = [];
    var createOption = function (hub, idx, depTime, arrTime1, dep2Time, arr2Time, dur1, dur2, buffer, label) {
        var t1 = {
            id: "syn-".concat(12945 + idx), number: "".concat(12945 + idx),
            name: "".concat(origin.city || origin.name, " - ").concat(hub.city || hub.name, " Superfast"),
            originId: origin.id, destinationId: hub.id,
            departure: depTime, arrival: arrTime1, durationMinutes: dur1,
            fare: { sleeper: 480 + idx * 30, ac3: 1280 + idx * 70, ac2: 1790 + idx * 90 },
            classes: ["SL", "3A", "2A", "1A"], days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            reliability: 88 - idx * 2, avgDelay: 14 + idx * 3,
            stops: [
                { stationId: origin.id, arrival: null, departure: depTime, day: 0, platform: "2" },
                { stationId: hub.id, arrival: arrTime1, departure: null, day: 0, platform: "3" },
            ],
        };
        var t2 = {
            id: "syn-".concat(12460 + idx), number: "".concat(12460 + idx),
            name: "".concat(hub.city || hub.name, " - ").concat(dest.city || dest.name, " Express"),
            originId: hub.id, destinationId: dest.id,
            departure: dep2Time, arrival: arr2Time, durationMinutes: dur2,
            fare: { sleeper: 520 + idx * 30, ac3: 1350 + idx * 70, ac2: 1880 + idx * 90 },
            classes: ["SL", "3A", "2A", "1A"], days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            reliability: 85 - idx * 2, avgDelay: 16 + idx * 3,
            stops: [
                { stationId: hub.id, arrival: null, departure: dep2Time, day: 0, platform: "4" },
                { stationId: dest.id, arrival: arr2Time, departure: null, day: 1, platform: "1" },
            ],
        };
        var _a = computeConnectionSafety(buffer - 10, t1.reliability, t1.avgDelay, false), safety = _a.safety, badge = _a.badge, delayProb = _a.delayProb, requiredP90 = _a.requiredP90;
        var transfer = {
            fromStationId: hub.id, toStationId: hub.id,
            requiresStationChange: false, requiredWalkingMinutes: 10,
            durationMinutes: buffer, usableBuffer: buffer - 10,
            risk: safety === "safe" ? "low" : safety === "moderate" ? "medium" : "high",
            riskLabel: safety === "safe" ? "Low risk" : safety === "moderate" ? "Moderate risk" : "High risk",
            reason: "Same station connection at ".concat(hub.name, " with ").concat(formatDuration(buffer), " buffer."),
            connectionSafety: safety, safetyBadge: badge,
            platformGuidance: (0, station_topology_1.getPlatformGuidance)(hub.id, hub.id, "3", "4"),
            delayProbability: delayProb, requiredBufferP90: requiredP90,
        };
        results.push({
            id: "j-".concat(origin.code, "-").concat(dest.code, "-").concat(label),
            origin: origin,
            destination: dest,
            date: date,
            legs: [
                { type: "train", train: t1, from: origin, to: hub, departure: depTime, arrival: arrTime1, dayOffset: 0 },
                { type: "transfer", transfer: transfer, from: hub, to: hub },
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
            reasons: ["1 Interchange at ".concat(hub.name), "Same station platform transfer", "".concat(formatDuration(buffer), " connection buffer")],
            whyNotFaster: idx === 0 ? "Selected for optimal connection buffer and reliability." : undefined,
            journeyTag: idx === 0 ? "recommended" : idx === 1 ? "fastest" : "cheapest",
        });
    };
    var hub1 = hubs[0] || (0, stations_1.getStation)("BRC");
    var hub2 = hubs[1] || (0, stations_1.getStation)("KOTA") || (0, stations_1.getStation)("NGP");
    var hub3 = hubs[2] || (0, stations_1.getStation)("PNVL") || (0, stations_1.getStation)("SC");
    createOption(hub1, 0, "07:30", "16:45", "18:45", "06:30", 555, 705, 120, "rec");
    createOption(hub2, 1, "09:15", "17:15", "18:30", "05:15", 480, 645, 75, "fast");
    createOption(hub3, 2, "06:00", "15:30", "17:45", "05:45", 570, 720, 135, "cheap");
    return results;
}
// ==========================================
// Delay Recovery Simulator Engine
// ==========================================
function getRecoveryOptions(journey, delayMinutes) {
    if (journey.legs.length < 3)
        return [];
    var transferLeg = journey.legs[1];
    var interchange = (0, stations_1.getStation)(transferLeg.transfer.fromStationId);
    var dest = journey.destination;
    var firstTrainArrivalMin = timeToMinutes(journey.legs[0].arrival);
    var actualArrival = firstTrainArrivalMin + delayMinutes;
    var walk = transferLeg.transfer.requiredWalkingMinutes;
    var matchingTrains = trains_1.trains.filter(function (t) { return t.originId === interchange.id || t.stops.some(function (s) { return s.stationId === interchange.id; }); });
    var later = matchingTrains
        .map(function (t) {
        var _a;
        var depStr = ((_a = t.stops.find(function (s) { return s.stationId === interchange.id; })) === null || _a === void 0 ? void 0 : _a.departure) || t.departure;
        var dep = timeToMinutes(depStr);
        if (dep < actualArrival)
            dep += 1440;
        var buffer = dep - actualArrival - walk;
        var risk = buffer < 0 ? "invalid" : buffer < 60 ? "medium" : "low";
        return { t: t, buffer: buffer, risk: risk, depStr: depStr };
    })
        .filter(function (c) { return c.buffer >= 20 && c.buffer <= 300; })
        .sort(function (a, b) { return a.buffer - b.buffer; })
        .slice(0, 3);
    return later.map(function (c) {
        var safetyResult = computeConnectionSafety(c.buffer, c.t.reliability || 80, c.t.avgDelay || 20, false);
        var newTransfer = {
            fromStationId: interchange.id, toStationId: interchange.id,
            requiresStationChange: false, requiredWalkingMinutes: walk,
            durationMinutes: c.buffer + walk, usableBuffer: c.buffer,
            risk: c.risk,
            riskLabel: c.risk === "low" ? "Low risk" : c.risk === "medium" ? "Moderate risk" : "High risk",
            reason: c.risk === "low" ? "Comfortable buffer even after delay." : "Tighter connection, but feasible.",
            connectionSafety: safetyResult.safety,
            safetyBadge: safetyResult.badge,
            platformGuidance: (0, station_topology_1.getPlatformGuidance)(interchange.id, interchange.id),
            delayProbability: safetyResult.delayProb,
            requiredBufferP90: safetyResult.requiredP90,
        };
        var recJourney = __assign(__assign({}, journey), { id: journey.id + "-rec-".concat(c.t.number), legs: [
                journey.legs[0],
                { type: "transfer", transfer: newTransfer, from: interchange, to: interchange },
                { type: "train", train: c.t, from: interchange, to: dest, departure: c.depStr, arrival: c.t.arrival, dayOffset: 1 },
            ], totalDurationMinutes: journey.totalDurationMinutes + delayMinutes + (c.buffer - transferLeg.transfer.durationMinutes) });
        return { journey: recJourney, buffer: c.buffer + walk, risk: c.risk };
    });
}
