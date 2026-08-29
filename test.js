"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var engine_1 = require("./src/lib/engine");
var FROM = "CPU";
var TO = "NJP";
var DATE = "2026-09-03";
var PREF = "easy";
var res = (0, engine_1.findJourneys)(FROM, TO, DATE, PREF);
console.log(JSON.stringify(res.map(function (j) { return ({
    id: j.id,
    dur: j.totalDurationMinutes,
    hubs: j.legs.filter(function (l) { return l.type === 'transfer'; }).map(function (l) { return l.transfer.fromStationId; }),
    tags: j.journeyTag
}); }), null, 2));
