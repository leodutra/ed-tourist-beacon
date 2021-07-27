// https://docs.google.com/spreadsheets/d/1eu30UyjpQrWexAglwD1Ax_GaDz4d7l8KD76kSzX4DEk/edit#gid=0

// XLSX
// https://docs.google.com/spreadsheets/d/1eu30UyjpQrWexAglwD1Ax_GaDz4d7l8KD76kSzX4DEk/export?format=xlsx

// CSV
// ref: https://developers.google.com/chart/interactive/docs/spreadsheets
// ref:https://developers.google.com/chart/interactive/docs/dev/implementing_data_source#csv-response-format
// https://docs.google.com/spreadsheets/d/{key}/gviz/tq?tqx=out:csv&sheet={sheet_name}

import got from "got";
import fs, { createReadStream, createWriteStream } from "fs";
import stream from "stream";
import { promisify } from "util";
import csv from "csvtojson";

const CSV_SEPARATOR = ",";

const pipeline = promisify(stream.pipeline);

const TOURIST_BEACON_XLSX_REMOTE =
  "https://docs.google.com/spreadsheets/d/1eu30UyjpQrWexAglwD1Ax_GaDz4d7l8KD76kSzX4DEk/export?format=xlsx";
const TOURIST_BEACON_XLSX_LOCAL = "./tmp/tourist-beacon.xlsx";

const TOURIST_BEACON_CSV_REMOTE =
  "https://docs.google.com/spreadsheets/d/1eu30UyjpQrWexAglwD1Ax_GaDz4d7l8KD76kSzX4DEk/gviz/tq?tqx=out:csv&sheet=Beacons&range=A3:ZZ";
const TOURIST_BEACON_CSV_LOCAL = "./tmp/tourist-beacon.csv";

const TOURIST_BEACON_IMGS_CSV_REMOTE =
  "https://docs.google.com/spreadsheets/d/1eu30UyjpQrWexAglwD1Ax_GaDz4d7l8KD76kSzX4DEk/gviz/tq?tqx=out:csv&sheet=ImgLookup&range=A:Z";
const TOURIST_BEACON_IMGS_CSV_LOCAL = "./tmp/tourist-beacon-images.csv";

const TOURIST_BEACON_JSON_LOCAL = "./tmp/tourist-beacon.json";

async function downloadFile(fileName, url) {
  const downloadStream = got.stream(url);
  const fileWriterStream = createWriteStream(fileName);

  downloadStream.on("downloadProgress", ({ transferred, total, percent }) => {
    const percentage = Math.round(percent * 100);
    console.error(
      `"${fileName}" progress: ${transferred}/${total} (${percentage}%)`
    );
  });

  try {
    await pipeline(downloadStream, fileWriterStream);
    console.log(`File downloaded to ${fileName}`);
  } catch (error) {
    console.error(`Something went wrong. ${error.message}`);
  }
}

(async () => {
  await fs.promises.mkdir("tmp", { recursive: true });
  await Promise.all([
    downloadFile(TOURIST_BEACON_XLSX_LOCAL, TOURIST_BEACON_XLSX_REMOTE),
    downloadFile(TOURIST_BEACON_CSV_LOCAL, TOURIST_BEACON_CSV_REMOTE),
    downloadFile(TOURIST_BEACON_IMGS_CSV_LOCAL, TOURIST_BEACON_IMGS_CSV_REMOTE),
  ]);
  await generateBeaconJson();
})();

async function loadBeaconImgs() {
  return csv({
    noheader: true,
    headers: ["id", "name", "src"],
  }).fromFile(TOURIST_BEACON_IMGS_CSV_LOCAL);
}

const upper = (str) => str && str.trim().toUpperCase();

async function generateBeaconJson() {
  const readStream = createReadStream(TOURIST_BEACON_CSV_LOCAL);
  const writeStream = createWriteStream(TOURIST_BEACON_JSON_LOCAL);
  const imgs = await loadBeaconImgs();
  const imgsByName = new Map(imgs.map((x) => [upper(x.name), x]));
  const now = new Date(Date.now()).toISOString();

  const converter = csv({
    downstreamFormat: "array",
    headers: [
      "UUID",
      "No.",
      "Site Name",
      "System",
      "Distance",
      "Type",
      "Series",
      "Set",
      "Image",
      "Image 2",
      "Image 3",
      "Image 4",
      "Image 5",
      "Compl",
      "Text",
    ],
    ignoreColumns: /Compl/,
  });

  const removeEmptyLines = (line) => {
    const [, number, siteName] = line.split(CSV_SEPARATOR);
    return number !== '""' || siteName !== '""' ? line : "";
  };

  const resolveImagesMut = (jsonObj) => {
    const images = [
      imgsByName.get(upper(jsonObj["Image"])),
      imgsByName.get(upper(jsonObj["Image 2"])),
      imgsByName.get(upper(jsonObj["Image 3"])),
      imgsByName.get(upper(jsonObj["Image 4"])),
      imgsByName.get(upper(jsonObj["Image 5"])),
    ].filter((x) => x);
    delete jsonObj["Image"];
    delete jsonObj["Image 2"];
    delete jsonObj["Image 3"];
    delete jsonObj["Image 4"];
    delete jsonObj["Image 5"];

    jsonObj.images = images;
    jsonObj["Captured At"] = now;
  };

  const csvtojson = converter
    .preFileLine((line, index) => removeEmptyLines(line))
    .subscribe((jsonObj, index) => resolveImagesMut(jsonObj));

  await pipeline(readStream, csvtojson, writeStream); // CSV accepts GOT stream
}
