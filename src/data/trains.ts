import { Train } from "@/lib/types";
import fs from "fs";
import path from "path";

let allTrainsData: Train[] = [];
try {
  // Read dynamically at runtime so Webpack doesn't try to bundle the 31MB file
  const filePath = path.join(process.cwd(), "src", "data", "all_trains.json");
  allTrainsData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
} catch (e) {
  console.error("Failed to load all_trains.json:", e);
}

export const trains: Train[] = allTrainsData;
