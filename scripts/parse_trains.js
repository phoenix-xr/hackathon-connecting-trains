const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const inputFilePath = path.join(__dirname, '../Indian_railway1.csv');
const outputFilePath = path.join(__dirname, '../src/data/all_trains.json');

const trainsMap = new Map();

function parseTime(timeStr) {
  if (!timeStr || timeStr === '00:00:00' || timeStr === '0') return null;
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return null;
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h * 60) + m;
}

// Ensure pseudo-random but deterministic generation based on train number
function pseudoRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

fs.createReadStream(inputFilePath)
  .pipe(csv())
  .on('data', (row) => {
    // Train No,Train Name,SEQ,Station Code,Station Name,Arrival time,Departure Time,Distance,Source Station,Source Station Name,Destination Station,Destination Station Name
    const trainNo = row['Train No']?.trim();
    if (!trainNo) return;

    if (!trainsMap.has(trainNo)) {
      trainsMap.set(trainNo, {
        id: `t-${trainNo}`,
        number: trainNo,
        name: row['Train Name']?.trim() || `Train ${trainNo}`,
        originId: row['Source Station']?.trim(),
        destinationId: row['Destination Station']?.trim(),
        departure: '', // will be set later
        arrival: '',   // will be set later
        durationMinutes: 0, // will be calculated later
        fare: { sleeper: 0, ac3: 0, ac2: 0 },
        classes: ["SL", "3A", "2A"],
        days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        reliability: 75 + Math.floor(pseudoRandom(parseInt(trainNo) || 1) * 20),
        avgDelay: 10 + Math.floor(pseudoRandom((parseInt(trainNo) || 2) + 10) * 35),
        stops: []
      });
    }

    const train = trainsMap.get(trainNo);
    const seq = parseInt(row['SEQ']);
    
    // We parse HH:MM
    let arrTime = parseTime(row['Arrival time']);
    let depTime = parseTime(row['Departure Time']);
    
    // If it's the very first stop, arrival is null (or departure is null for last stop, handled later)
    if (seq === 1) {
      arrTime = null;
    }

    train.stops.push({
      seq: seq,
      stationId: row['Station Code']?.trim(),
      arrival: arrTime,
      departure: depTime,
      distance: parseInt(row['Distance']) || 0,
      platform: `${1 + Math.floor(pseudoRandom(seq * (parseInt(trainNo) || 3)) * 6)}`
    });
  })
  .on('end', () => {
    const allTrains = [];
    
    for (const train of trainsMap.values()) {
      // Sort stops by SEQ
      train.stops.sort((a, b) => a.seq - b.seq);
      
      // Fix last stop departure
      if (train.stops.length > 0) {
        train.stops[train.stops.length - 1].departure = null;
      }
      
      // Calculate days based on time progression
      let currentDay = 0;
      let lastMin = -1;
      let totalDist = 0;
      
      for (let i = 0; i < train.stops.length; i++) {
        const stop = train.stops[i];
        
        let arrMin = stop.arrival ? timeToMinutes(stop.arrival) : null;
        let depMin = stop.departure ? timeToMinutes(stop.departure) : null;
        
        // Handle arrival day
        if (arrMin !== null) {
          if (arrMin < lastMin) currentDay++;
          lastMin = arrMin;
        }
        stop.arrDay = currentDay;
        
        // Handle departure day
        if (depMin !== null) {
          if (depMin < lastMin) currentDay++;
          lastMin = depMin;
        }
        stop.day = currentDay;
        
        totalDist = Math.max(totalDist, stop.distance);
      }
      
      if (train.stops.length < 2) continue; // invalid train
      
      // Set train-level metadata
      const firstStop = train.stops[0];
      const lastStop = train.stops[train.stops.length - 1];
      
      // First stop might not have a departure time in some bad data, fallback to "00:00"
      train.departure = firstStop.departure || "00:00";
      // Last stop might not have an arrival time, fallback to departure of previous stop
      train.arrival = lastStop.arrival || train.stops[Math.max(0, train.stops.length - 2)].departure || "00:00";
      
      const startMin = timeToMinutes(train.departure);
      const endMin = timeToMinutes(train.arrival) + (lastStop.arrDay || lastStop.day) * 1440;
      train.durationMinutes = Math.max(1, endMin - startMin);
      
      // Calculate realistic mock fares based on distance
      const dist = totalDist > 0 ? totalDist : Math.max(100, train.durationMinutes * 0.8);
      train.fare = {
        sleeper: Math.round(dist * 0.6),
        ac3: Math.round(dist * 1.5),
        ac2: Math.round(dist * 2.2)
      };
      
      // Cleanup extra fields not in Train type
      train.stops = train.stops.map(s => ({
        stationId: s.stationId,
        arrival: s.arrival,
        departure: s.departure,
        day: s.day,
        platform: s.platform
      }));
      
      allTrains.push(train);
    }
    
    // Write out the JSON
    fs.writeFileSync(outputFilePath, JSON.stringify(allTrains, null, 2));
    console.log(`Successfully parsed ${allTrains.length} trains.`);
    console.log(`Written to ${outputFilePath} (${Math.round(fs.statSync(outputFilePath).size / 1024 / 1024)} MB)`);
  });
