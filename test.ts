import { findJourneys } from "./src/lib/engine";

const FROM = "CPU";
const TO = "NJP";
const DATE = "2026-09-03";
const PREF = "easy";

const res = findJourneys(FROM, TO, DATE, PREF as any);
console.log(JSON.stringify(res.map(j => ({
  id: j.id,
  dur: j.totalDurationMinutes,
  hubs: j.legs.filter(l => l.type === 'transfer').map((l: any) => l.transfer.fromStationId),
  tags: j.journeyTag
})), null, 2));
