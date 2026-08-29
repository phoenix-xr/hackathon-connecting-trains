/**
 * Station Topology Data
 * 
 * City cluster definitions for multi-station metropolitan areas,
 * intra-station transfer speeds, and cross-station road transfer times.
 * 
 * Used by the Rail-RAPTOR engine for Minimum Connecting Time (MCT) calculations.
 */

export type CityCluster = {
  cityCode: string;
  cityName: string;
  stations: string[];
  /** Road transfer time in minutes between station pairs */
  roadTransferMatrix: Record<string, number>;
};

export type StationTransferProfile = {
  /** Minimum time to walk between platforms within the station (minutes) */
  minIntraStationWalkMinutes: number;
  /** Extra time multiplier for passengers with heavy luggage (1.0 = no extra) */
  luggageMultiplier: number;
  /** Number of platforms */
  platforms: number;
  /** Whether elevators/escalators are available */
  hasElevator: boolean;
};

// ==========================================
// City Cluster Definitions
// ==========================================
// Multi-station metropolitan areas where cross-station road transfers are possible

const CITY_CLUSTERS: CityCluster[] = [
  {
    cityCode: "DELHI",
    cityName: "Delhi NCR",
    stations: ["NDLS", "NZM", "DLI", "ANVT", "DEE", "DEC"],
    roadTransferMatrix: {
      "NDLS-NZM": 25, "NZM-NDLS": 25,
      "NDLS-DLI": 15, "DLI-NDLS": 15,
      "NDLS-ANVT": 35, "ANVT-NDLS": 35,
      "NDLS-DEE": 20, "DEE-NDLS": 20,
      "NZM-ANVT": 20, "ANVT-NZM": 20,
      "NZM-DLI": 30, "DLI-NZM": 30,
      "DLI-ANVT": 25, "ANVT-DLI": 25,
    },
  },
  {
    cityCode: "MUMBAI",
    cityName: "Mumbai Metropolitan",
    stations: ["MMCT", "CSMT", "BDTS", "DDR", "LTT", "PNVL"],
    roadTransferMatrix: {
      "MMCT-CSMT": 30, "CSMT-MMCT": 30,
      "MMCT-DDR": 20, "DDR-MMCT": 20,
      "MMCT-BDTS": 25, "BDTS-MMCT": 25,
      "MMCT-LTT": 35, "LTT-MMCT": 35,
      "CSMT-DDR": 25, "DDR-CSMT": 25,
      "CSMT-LTT": 15, "LTT-CSMT": 15,
      "CSMT-BDTS": 40, "BDTS-CSMT": 40,
      "DDR-BDTS": 30, "BDTS-DDR": 30,
      "PNVL-CSMT": 50, "CSMT-PNVL": 50,
      "PNVL-MMCT": 55, "MMCT-PNVL": 55,
      "PNVL-LTT": 40, "LTT-PNVL": 40,
    },
  },
  {
    cityCode: "KOLKATA",
    cityName: "Kolkata Metropolitan",
    stations: ["HWH", "SDAH", "KOAA", "SHM"],
    roadTransferMatrix: {
      "HWH-SDAH": 25, "SDAH-HWH": 25,
      "HWH-KOAA": 20, "KOAA-HWH": 20,
      "SDAH-KOAA": 30, "KOAA-SDAH": 30,
      "HWH-SHM": 35, "SHM-HWH": 35,
    },
  },
  {
    cityCode: "BANGALORE",
    cityName: "Bengaluru",
    stations: ["SBC", "YPR", "SMVB"],
    roadTransferMatrix: {
      "SBC-YPR": 25, "YPR-SBC": 25,
      "SBC-SMVB": 15, "SMVB-SBC": 15,
      "YPR-SMVB": 30, "SMVB-YPR": 30,
    },
  },
  {
    cityCode: "CHENNAI",
    cityName: "Chennai",
    stations: ["MAS", "MS", "TBM"],
    roadTransferMatrix: {
      "MAS-MS": 15, "MS-MAS": 15,
      "MAS-TBM": 20, "TBM-MAS": 20,
      "MS-TBM": 10, "TBM-MS": 10,
    },
  },
  {
    cityCode: "HYDERABAD",
    cityName: "Hyderabad / Secunderabad",
    stations: ["SC", "HYB", "KCG"],
    roadTransferMatrix: {
      "SC-HYB": 20, "HYB-SC": 20,
      "SC-KCG": 15, "KCG-SC": 15,
      "HYB-KCG": 25, "KCG-HYB": 25,
    },
  },
];

// Pre-built lookup: station code -> cluster
const stationToCluster = new Map<string, CityCluster>();
for (const cluster of CITY_CLUSTERS) {
  for (const stationCode of cluster.stations) {
    stationToCluster.set(stationCode, cluster);
  }
}

/**
 * Get the city cluster that a station belongs to.
 * Returns null if the station is standalone (not part of a multi-station metro).
 */
export function getCityCluster(stationId: string): CityCluster | null {
  return stationToCluster.get(stationId.toUpperCase()) || null;
}

/**
 * Get all station codes in the same city cluster as the given station.
 * Returns a single-element array [stationId] if no cluster exists.
 */
export function getClusterStations(stationId: string): string[] {
  const cluster = getCityCluster(stationId);
  return cluster ? cluster.stations : [stationId];
}

/**
 * Check if two stations are in the same city cluster.
 */
export function isSameCity(stationId1: string, stationId2: string): boolean {
  if (stationId1 === stationId2) return true;
  const c1 = getCityCluster(stationId1);
  const c2 = getCityCluster(stationId2);
  return c1 !== null && c2 !== null && c1.cityCode === c2.cityCode;
}

// ==========================================
// Intra-Station Transfer Profiles
// ==========================================

const STATION_TRANSFER_PROFILES: Record<string, StationTransferProfile> = {
  // Major termini with complex layouts
  "NDLS": { minIntraStationWalkMinutes: 12, luggageMultiplier: 1.4, platforms: 16, hasElevator: true },
  "NZM":  { minIntraStationWalkMinutes: 10, luggageMultiplier: 1.3, platforms: 7, hasElevator: true },
  "MMCT": { minIntraStationWalkMinutes: 10, luggageMultiplier: 1.3, platforms: 7, hasElevator: true },
  "CSMT": { minIntraStationWalkMinutes: 12, luggageMultiplier: 1.4, platforms: 18, hasElevator: true },
  "HWH":  { minIntraStationWalkMinutes: 12, luggageMultiplier: 1.4, platforms: 23, hasElevator: true },
  "SBC":  { minIntraStationWalkMinutes: 10, luggageMultiplier: 1.3, platforms: 10, hasElevator: true },
  "MAS":  { minIntraStationWalkMinutes: 10, luggageMultiplier: 1.3, platforms: 12, hasElevator: true },
  "SC":   { minIntraStationWalkMinutes: 10, luggageMultiplier: 1.3, platforms: 10, hasElevator: true },
  "ADI":  { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 12, hasElevator: true },
  // Key corridor junctions
  "ET":   { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 7, hasElevator: false },
  "BPL":  { minIntraStationWalkMinutes: 10, luggageMultiplier: 1.3, platforms: 6, hasElevator: true },
  "NGP":  { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 8, hasElevator: true },
  "BRC":  { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.2, platforms: 6, hasElevator: true },
  "CNB":  { minIntraStationWalkMinutes: 10, luggageMultiplier: 1.3, platforms: 10, hasElevator: true },
  "PRYJ": { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 10, hasElevator: true },
  "DDU":  { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 8, hasElevator: false },
  "BSB":  { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 9, hasElevator: true },
  "LKO":  { minIntraStationWalkMinutes: 10, luggageMultiplier: 1.3, platforms: 9, hasElevator: true },
  "BZA":  { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 10, hasElevator: true },
  "VGLJ": { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.2, platforms: 7, hasElevator: false },
  "KOTA": { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "RTM":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "PUNE": { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 6, hasElevator: true },
  "JP":   { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 6, hasElevator: true },
  "PNBE": { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 10, hasElevator: true },
  "KGP":  { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 12, hasElevator: false },
  "ASN":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 6, hasElevator: false },
  "BSL":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "DD":   { minIntraStationWalkMinutes: 5, luggageMultiplier: 1.2, platforms: 4, hasElevator: false },
  "SUR":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "GTL":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "MMR":  { minIntraStationWalkMinutes: 5, luggageMultiplier: 1.2, platforms: 4, hasElevator: false },
  "BSP":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "R":    { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 6, hasElevator: false },
  "TATA": { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 6, hasElevator: false },
  "ROU":  { minIntraStationWalkMinutes: 5, luggageMultiplier: 1.2, platforms: 4, hasElevator: false },
  "VSKP": { minIntraStationWalkMinutes: 8, luggageMultiplier: 1.3, platforms: 8, hasElevator: true },
  "PNVL": { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "ST":   { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: true },
  "UBL":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "GWL":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "AGC":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "MTJ":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 7, hasElevator: false },
  "GAYA": { minIntraStationWalkMinutes: 5, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "DHN":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 6, hasElevator: false },
  "SWM":  { minIntraStationWalkMinutes: 5, luggageMultiplier: 1.2, platforms: 3, hasElevator: false },
  "BBS":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 6, hasElevator: true },
  "KUR":  { minIntraStationWalkMinutes: 5, luggageMultiplier: 1.2, platforms: 5, hasElevator: false },
  "ERS":  { minIntraStationWalkMinutes: 6, luggageMultiplier: 1.2, platforms: 6, hasElevator: true },
};

const DEFAULT_TRANSFER_PROFILE: StationTransferProfile = {
  minIntraStationWalkMinutes: 8,
  luggageMultiplier: 1.3,
  platforms: 4,
  hasElevator: false,
};

/**
 * Get the transfer profile for a station.
 */
export function getStationTransferProfile(stationId: string): StationTransferProfile {
  return STATION_TRANSFER_PROFILES[stationId.toUpperCase()] || DEFAULT_TRANSFER_PROFILE;
}

/**
 * Get the Minimum Connecting Time (MCT) for an intra-station transfer.
 * Accounts for platform walking time with luggage overhead.
 * Returns time in minutes.
 */
export function getIntraStationMCT(stationId: string): number {
  const profile = getStationTransferProfile(stationId);
  const raw = Math.ceil(profile.minIntraStationWalkMinutes * profile.luggageMultiplier);
  return Math.max(40, raw + 25); // +25 for platform finding, settling, contingency
}

/**
 * Get the Minimum Connecting Time (MCT) for a cross-station transfer.
 * Includes road transfer time between two stations in the same city.
 * Returns time in minutes.
 */
export function getCrossStationMCT(fromId: string, toId: string): number {
  if (fromId === toId) return getIntraStationMCT(fromId);
  
  const cluster = getCityCluster(fromId);
  if (!cluster) return 75;
  
  const key = `${fromId}-${toId}`;
  const roadTime = cluster.roadTransferMatrix[key];
  if (roadTime !== undefined) {
    // Road transfer + station exit (10m) + station entry (10m) + contingency (15m)
    return roadTime + 35;
  }
  
  return 75;
}

/**
 * Generate platform guidance text for a transfer.
 */
export function getPlatformGuidance(
  fromStationId: string,
  toStationId: string,
  fromPlatform?: string,
  toPlatform?: string
): string {
  const profile = getStationTransferProfile(fromStationId);
  const isSameStation = fromStationId === toStationId;
  
  if (isSameStation) {
    const elevatorText = profile.hasElevator ? " (Elevator available)" : " (Foot overbridge)";
    if (fromPlatform && toPlatform) {
      if (fromPlatform === toPlatform) {
        return `Same Station · Same Platform ${fromPlatform}`;
      }
      return `Same Station · Platform ${fromPlatform} → Platform ${toPlatform}${elevatorText}`;
    }
    return `Same Station · Platform change required${elevatorText}`;
  }
  
  const cluster = getCityCluster(fromStationId);
  if (cluster) {
    const key = `${fromStationId}-${toStationId}`;
    const roadTime = cluster.roadTransferMatrix[key];
    if (roadTime) {
      return `Cross-Station · ~${roadTime} min road transfer to ${toStationId}`;
    }
  }
  
  return `Cross-Station · Road transfer required`;
}
