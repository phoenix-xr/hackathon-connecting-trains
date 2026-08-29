import { NextRequest, NextResponse } from "next/server";
import { findJourneys } from "@/lib/engine";
import { Preference } from "@/lib/types";
import { getStation, getStationByName, searchStations } from "@/data/stations";

/**
 * Trains & Availability API Route
 *
 * GET /api/trains?from=NDLS&to=MAO&date=YYYY-MM-DD&pref=easy
 * POST /api/trains/availability (Mock & Live IRCTC proxy integration)
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || "NDLS";
  const to = searchParams.get("to") || "MAO";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const pref = (searchParams.get("pref") as Preference) || "easy";

  const originStation = getStationByName(from);
  const destStation = getStationByName(to);

  if (!originStation || !destStation) {
    return NextResponse.json(
      { error: "Invalid origin or destination station code" },
      { status: 400 }
    );
  }

  // Multi-leg journey routing & interchange computation
  const journeys = findJourneys(from, to, date, pref);

  return NextResponse.json({
    success: true,
    meta: {
      origin: originStation,
      destination: destStation,
      date,
      preference: pref,
      dataSource: "raasta-routing-engine",
      isSynthetic: true
    },
    count: journeys.length,
    journeys
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trainNumber, classType, date, fromStation, toStation } = body;

    if (!trainNumber) {
      return NextResponse.json(
        { error: "Missing required parameter 'trainNumber'" },
        { status: 400 }
      );
    }

    // Availability calculation strategy:
    // 1. If upstream live API key (e.g. RAPIDAPI_IRCTC_KEY) is configured in environment, call upstream.
    // 2. Otherwise provide high-fidelity realistic probability-based seat status.

    const apiKey = process.env.RAPIDAPI_IRCTC_KEY;
    if (apiKey) {
      try {
        const response = await fetch(
          `https://irctc1.p.rapidapi.com/api/v1/checkSeatAvailability?trainNo=${trainNumber}&classType=${classType || "3A"}&date=${date}&fromStationCode=${fromStation}&toStationCode=${toStation}&quota=GN`,
          {
            headers: {
              "X-RapidAPI-Key": apiKey,
              "X-RapidAPI-Host": "irctc1.p.rapidapi.com"
            }
          }
        );
        if (response.ok) {
          const liveData = await response.json();
          return NextResponse.json({ success: true, live: true, data: liveData });
        }
      } catch (upstreamErr) {
        console.warn("Upstream live availability fetch failed, falling back to engine:", upstreamErr);
      }
    }

    // Realistic probabilistic fallback availability
    const statuses = [
      { status: "AVAILABLE", seats: 42, probability: "HIGH", confirmationChance: 100 },
      { status: "RAC", seats: 14, probability: "MEDIUM", confirmationChance: 88 },
      { status: "WL 8", seats: 0, probability: "MEDIUM", confirmationChance: 74 }
    ];
    const picked = statuses[Math.floor(Math.random() * statuses.length)];

    return NextResponse.json({
      success: true,
      live: false,
      trainNumber,
      classType: classType || "3A",
      date,
      availability: picked,
      fare: {
        base: 1420,
        superfast: 45,
        gst: 73,
        total: 1538
      },
      disclaimer: "Simulated IRCTC availability. Configure RAPIDAPI_IRCTC_KEY for live data."
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
