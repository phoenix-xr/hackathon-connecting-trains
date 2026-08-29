import { Station } from "@/lib/types";
import allStationsData from "./all_stations.json";

export const stations: Station[] = allStationsData as Station[];

// ==========================================
// Geographic Coordinates for Key Junction Stations
// Used by the Rail-RAPTOR spatial bounding filter (ellipsoid + forward progress)
// ==========================================
export const STATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Major termini & origin/destination cities
  "NDLS": { lat: 28.6424, lng: 77.2195 },  // New Delhi
  "NZM":  { lat: 28.5846, lng: 77.2538 },  // Hazrat Nizamuddin
  "DLI":  { lat: 28.6618, lng: 77.2264 },  // Old Delhi
  "ANVT": { lat: 28.5481, lng: 77.2437 },  // Anand Vihar Terminal
  "MMCT": { lat: 19.0537, lng: 72.8406 },  // Mumbai Central
  "CSMT": { lat: 18.9398, lng: 72.8347 },  // Chhatrapati Shivaji Maharaj Terminus
  "BDTS": { lat: 19.1880, lng: 72.8465 },  // Bandra Terminus
  "DDR":  { lat: 19.0010, lng: 72.8424 },  // Dadar
  "LTT":  { lat: 19.0698, lng: 72.8798 },  // Lokmanya Tilak Terminus
  "HWH":  { lat: 22.5838, lng: 88.3407 },  // Howrah
  "SDAH": { lat: 22.5845, lng: 88.3820 },  // Sealdah
  "KOAA": { lat: 22.5700, lng: 88.3630 },  // Kolkata
  "SBC":  { lat: 12.9786, lng: 77.5688 },  // Bengaluru City
  "YPR":  { lat: 13.0365, lng: 77.5539 },  // Yesvantpur
  "MAS":  { lat: 13.0827, lng: 80.2707 },  // Chennai Central
  "MS":   { lat: 13.0484, lng: 80.2574 },  // Chennai Egmore
  "SC":   { lat: 17.4337, lng: 78.5010 },  // Secunderabad
  "HYB":  { lat: 17.3850, lng: 78.4867 },  // Hyderabad Deccan
  "ADI":  { lat: 23.0225, lng: 72.5714 },  // Ahmedabad
  "PUNE": { lat: 18.5286, lng: 73.8745 },  // Pune
  "JP":   { lat: 26.9196, lng: 75.7879 },  // Jaipur
  "LKO":  { lat: 26.8467, lng: 80.9462 },  // Lucknow
  "PNBE": { lat: 25.6073, lng: 85.1379 },  // Patna
  "BSB":  { lat: 25.3176, lng: 83.0165 },  // Varanasi
  "CDG":  { lat: 30.6877, lng: 76.8446 },  // Chandigarh
  "MAO":  { lat: 15.2899, lng: 73.9479 },  // Madgaon (Goa)
  "KRMI": { lat: 15.4399, lng: 73.8881 },  // Karmali (Goa)
  "THVM": { lat: 15.5375, lng: 73.9283 },  // Thivim (Goa)
  "TVC":  { lat: 8.5001, lng: 76.9473 },   // Thiruvananthapuram Central
  "ERS":  { lat: 9.9687, lng: 76.2864 },   // Ernakulam Junction
  "BBS":  { lat: 20.2604, lng: 85.8392 },  // Bhubaneswar

  // Central & West-Central backbone junctions
  "ET":   { lat: 22.6128, lng: 77.7656 },  // Itarsi Junction
  "BPL":  { lat: 23.2687, lng: 77.4124 },  // Bhopal Junction
  "BINA": { lat: 24.1770, lng: 78.1225 },  // Bina Junction
  "JBP":  { lat: 23.1710, lng: 79.9463 },  // Jabalpur Junction
  "KTE":  { lat: 23.8299, lng: 80.3909 },  // Katni Junction
  "KNW":  { lat: 21.8245, lng: 76.3527 },  // Khandwa Junction
  "GWL":  { lat: 26.2183, lng: 78.1828 },  // Gwalior Junction

  // North & North-Central
  "VGLJ": { lat: 25.4423, lng: 78.5681 },  // Jhansi Junction
  "JHS":  { lat: 25.4423, lng: 78.5681 },  // Jhansi (alias)
  "AGC":  { lat: 27.1592, lng: 78.0131 },  // Agra Cantt
  "MTJ":  { lat: 27.4841, lng: 77.6761 },  // Mathura Junction
  "CNB":  { lat: 26.4499, lng: 80.3319 },  // Kanpur Central
  "PRYJ": { lat: 25.4281, lng: 81.8782 },  // Prayagraj Junction
  "DDU":  { lat: 25.2801, lng: 83.1123 },  // Pt. Deen Dayal Upadhyaya Junction
  "UMB":  { lat: 30.3782, lng: 76.7770 },  // Ambala Cantt
  "MB":   { lat: 28.8386, lng: 78.7733 },  // Moradabad

  // Western & Konkan
  "KOTA": { lat: 25.1764, lng: 75.8568 },  // Kota Junction
  "RTM":  { lat: 23.3260, lng: 75.0423 },  // Ratlam Junction
  "NAD":  { lat: 23.4548, lng: 75.3925 },  // Nagda Junction
  "SWM":  { lat: 26.0230, lng: 76.3540 },  // Sawai Madhopur Junction
  "BRC":  { lat: 22.3098, lng: 73.1812 },  // Vadodara Junction
  "ST":   { lat: 21.2046, lng: 72.8362 },  // Surat
  "ANND": { lat: 22.5645, lng: 72.9289 },  // Anand Junction
  "PNVL": { lat: 18.9936, lng: 73.1127 },  // Panvel Junction
  "BSR":  { lat: 19.3623, lng: 72.8440 },  // Vasai Road

  // Maharashtra & Deccan
  "BSL":  { lat: 21.0453, lng: 75.7851 },  // Bhusawal Junction
  "MMR":  { lat: 20.3855, lng: 74.3320 },  // Manmad Junction
  "DD":   { lat: 18.4625, lng: 74.5687 },  // Daund Junction
  "SUR":  { lat: 17.6661, lng: 75.9010 },  // Solapur Junction
  "MRJ":  { lat: 16.8265, lng: 74.5565 },  // Miraj Junction
  "NGP":  { lat: 21.1497, lng: 79.0806 },  // Nagpur Junction
  "WR":   { lat: 20.7230, lng: 78.5839 },  // Wardha Junction
  "AK":   { lat: 20.7153, lng: 77.0079 },  // Akola Junction

  // Eastern & East Coast
  "R":    { lat: 21.2514, lng: 81.6296 },  // Raipur Junction
  "BSP":  { lat: 22.0796, lng: 82.1409 },  // Bilaspur Junction
  "ROU":  { lat: 22.2604, lng: 84.8536 },  // Rourkela Junction
  "TATA": { lat: 22.7947, lng: 86.1836 },  // Tatanagar Junction
  "KGP":  { lat: 22.3332, lng: 87.3236 },  // Kharagpur Junction
  "ASN":  { lat: 23.6838, lng: 86.9525 },  // Asansol Junction
  "GAYA": { lat: 24.7914, lng: 85.0002 },  // Gaya Junction
  "DHN":  { lat: 23.7957, lng: 86.4304 },  // Dhanbad Junction
  "KUR":  { lat: 20.2040, lng: 85.8403 },  // Khurda Road Junction
  "VSKP": { lat: 17.7215, lng: 83.2875 },  // Visakhapatnam Junction

  // South & South-Central
  "BZA":  { lat: 16.5193, lng: 80.6305 },  // Vijayawada Junction
  "KZJ":  { lat: 18.0611, lng: 79.5823 },  // Kazipet Junction
  "WL":   { lat: 17.9689, lng: 79.5941 },  // Warangal
  "GTL":  { lat: 15.1758, lng: 77.3495 },  // Guntakal Junction
  "RU":   { lat: 13.6330, lng: 79.5123 },  // Renigunta Junction
  "GDR":  { lat: 14.1530, lng: 79.8523 },  // Gudur Junction
  "KPD":  { lat: 12.9289, lng: 79.1323 },  // Katpadi Junction
  "JTJ":  { lat: 12.5830, lng: 78.5573 },  // Jolarpettai Junction
  "ED":   { lat: 11.3410, lng: 77.7172 },  // Erode Junction
  "SA":   { lat: 11.6643, lng: 78.1460 },  // Salem Junction
  "SRR":  { lat: 10.7618, lng: 75.9393 },  // Shoranur Junction
  "QLN":  { lat: 8.8932, lng: 76.5960 },   // Kollam Junction
  "UBL":  { lat: 15.4589, lng: 75.0096 },  // Hubballi Junction
  "WADI": { lat: 17.0580, lng: 76.9900 },  // Wadi Junction

  // North-Western
  "AII":  { lat: 26.4536, lng: 74.6360 },  // Ajmer Junction
  "FL":   { lat: 26.8746, lng: 75.2324 },  // Phulera Junction
  "ABR":  { lat: 24.4817, lng: 72.7836 },  // Abu Road
  "JU":   { lat: 26.2860, lng: 73.0213 },  // Jodhpur Junction
};

/**
 * Get geographic coordinates for a station.
 * Returns null if coordinates are not available.
 */
export function getStationCoordinates(stationId: string): { lat: number; lng: number } | null {
  return STATION_COORDINATES[stationId.toUpperCase()] || null;
}

// Pre-built index maps for fast O(1) lookups
const stationMapByCode = new Map<string, Station>();
const stationMapByName = new Map<string, Station>();
const stationMapByCity = new Map<string, Station[]>();

for (const s of stations) {
  stationMapByCode.set(s.code.toUpperCase(), s);
  stationMapByName.set(s.name.toLowerCase(), s);
  
  if (s.city) {
    const c = s.city.toLowerCase();
    if (!stationMapByCity.has(c)) {
      stationMapByCity.set(c, []);
    }
    stationMapByCity.get(c)!.push(s);
  }
}

const POPULAR_CITY_MAP: Record<string, string> = {
  goa: "MAO",
  madgaon: "MAO",
  karmali: "KRMI",
  thivim: "THVM",
  vasco: "VSG",
  delhi: "NDLS",
  "new delhi": "NDLS",
  mumbai: "MMCT",
  bombay: "MMCT",
  bangalore: "SBC",
  bengaluru: "SBC",
  kolkata: "HWH",
  calcutta: "HWH",
  chennai: "MAS",
  madras: "MAS",
  hyderabad: "SC",
  secunderabad: "SC",
  ahmedabad: "ADI",
  pune: "PUNE",
  jaipur: "JP",
  varanasi: "BSB",
  patna: "PNBE",
  lucknow: "LKO",
  chandigarh: "CDG",
  bhopal: "BPL",
  kanpur: "CNB",
  agra: "AGC",
  kochi: "ERS",
  cochin: "ERS",
};

const getStationCache = new Map<string, Station>();

export function getStation(id: string): Station {
  if (!id) {
    return { id: "NDLS", code: "NDLS", name: "New Delhi", city: "Delhi", state: "Delhi", transferMinutes: 12, complexity: "high" };
  }
  const cacheKey = id.trim().toLowerCase();
  if (getStationCache.has(cacheKey)) return getStationCache.get(cacheKey)!;

  const lower = cacheKey;
  if (POPULAR_CITY_MAP[lower]) {
    const canonical = stationMapByCode.get(POPULAR_CITY_MAP[lower]);
    if (canonical) {
      getStationCache.set(cacheKey, canonical);
      return canonical;
    }
  }

  const upper = id.trim().toUpperCase();
  const found = stationMapByCode.get(upper) || stations.find((s) => s.id === id || s.code === upper || s.name.toLowerCase() === lower);
  
  if (found) {
    getStationCache.set(cacheKey, found);
    return found;
  }

  const fallback: Station = {
    id: id,
    code: id.slice(0, 4).toUpperCase(),
    name: id,
    city: id,
    state: "",
    transferMinutes: 8,
    complexity: "low"
  };
  getStationCache.set(cacheKey, fallback);
  return fallback;
}

export function getStationName(id: string): string {
  const st = getStation(id);
  return st ? st.name : id;
}

const ALIAS_MAP: Record<string, string> = {
  goa: "MAO",
  madgaon: "MAO",
  "vasco da gama": "VSG",
  "new delhi": "NDLS",
  delhi: "NDLS",
  mumbai: "MMCT",
  "mumbai central": "MMCT",
  bombay: "MMCT",
  kolkata: "HWH",
  howrah: "HWH",
  chennai: "MAS",
  bengaluru: "SBC",
  bangalore: "SBC",
  hyderabad: "HYB",
  pune: "PUNE",
  jaipur: "JP",
  ahmedabad: "ADI",
  lucknow: "LKO",
  varanasi: "BSB",
  patna: "PNBE",
};

export function getStationByName(query: string): Station {
  if (!query) return getStation("NDLS");
  const q = query.trim().toLowerCase();
  if (ALIAS_MAP[q]) return getStation(ALIAS_MAP[q]);

  const directMatch = stationMapByName.get(q);
  if (directMatch) return directMatch;

  const cityMatches = stationMapByCity.get(q);
  if (cityMatches && cityMatches.length > 0) {
    if (q === "goa") return getStation("MAO");
    return cityMatches[0];
  }

  const codeMatch = stationMapByCode.get(q.toUpperCase());
  if (codeMatch) return codeMatch;

  const found = stations.find((s) => 
    s.name.toLowerCase() === q || 
    s.code.toLowerCase() === q || 
    s.city.toLowerCase() === q
  );
  if (found) return found;

  return getStation(query);
}

export const POPULAR_STATIONS: Station[] = [
  getStation("NDLS"),
  getStation("MMCT"),
  getStation("CSMT"),
  getStation("HWH"),
  getStation("SBC"),
  getStation("MAS"),
  getStation("MAO"),
  getStation("PUNE"),
  getStation("JP"),
  getStation("ADI"),
  getStation("BSB"),
  getStation("HYB")
];

export function searchStations(query: string, limit = 50): Station[] {
  if (!query || query.trim() === "") {
    return POPULAR_STATIONS;
  }

  const q = query.trim().toLowerCase();
  const qUpper = query.trim().toUpperCase();

  const priorityStations: Station[] = [];
  if (POPULAR_CITY_MAP[q]) {
    const pSt = getStation(POPULAR_CITY_MAP[q]);
    if (pSt) priorityStations.push(pSt);
  }
  if (q === "goa") {
    ["MAO", "KRMI", "THVM", "VSG"].forEach((c) => {
      const s = getStation(c);
      if (s && !priorityStations.some((p) => p.id === s.id)) priorityStations.push(s);
    });
  }

  // Exact code match (if not an obscure code shadow of a city)
  let exactCode: Station | undefined;
  if (q !== "goa") {
    exactCode = stationMapByCode.get(qUpper);
  }
  
  const codePrefix: Station[] = [];
  const namePrefix: Station[] = [];
  const cityPrefix: Station[] = [];
  const substringMatches: Station[] = [];

  for (const s of stations) {
    if (priorityStations.some((p) => p.id === s.id)) continue;
    if (exactCode && s.code === exactCode.code) continue;

    const sCode = s.code.toLowerCase();
    const sName = s.name.toLowerCase();
    const sCity = s.city.toLowerCase();

    if (sCode.startsWith(q)) {
      codePrefix.push(s);
    } else if (sName.startsWith(q)) {
      namePrefix.push(s);
    } else if (sCity.startsWith(q)) {
      cityPrefix.push(s);
    } else if (sName.includes(q) || sCity.includes(q) || sCode.includes(q)) {
      substringMatches.push(s);
    }

    if (codePrefix.length + namePrefix.length + cityPrefix.length + substringMatches.length >= limit * 2) {
      break;
    }
  }

  const results: Station[] = [...priorityStations];
  if (exactCode && !results.some((r) => r.id === exactCode.id)) results.push(exactCode);
  results.push(...codePrefix, ...namePrefix, ...cityPrefix, ...substringMatches);

  return results.slice(0, limit);
}
