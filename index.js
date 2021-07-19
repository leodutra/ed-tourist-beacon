// https://docs.google.com/spreadsheets/d/1eu30UyjpQrWexAglwD1Ax_GaDz4d7l8KD76kSzX4DEk/edit#gid=0

// XLSX
// https://docs.google.com/spreadsheets/d/1eu30UyjpQrWexAglwD1Ax_GaDz4d7l8KD76kSzX4DEk/export?format=xlsx

// CSV
// https://docs.google.com/spreadsheets/d/{key}/gviz/tq?tqx=out:csv&sheet={sheet_name}

import got from 'got'
import fs, { createWriteStream } from 'fs'
import stream from 'stream'
import { promisify } from 'util'

const pipeline = promisify(stream.pipeline)

const BEACON_DATA_SRC_REMOTE = 'https://docs.google.com/spreadsheets/d/1eu30UyjpQrWexAglwD1Ax_GaDz4d7l8KD76kSzX4DEk/gviz/tq?tqx=out:csv&sheet=Beacons'
const BEACON_DATA_SRC_LOCAL = 'tmp/tourist-beacon.csv'

async function downloadFile(fileName, url) {
  const downloadStream = got.stream(url);
  const fileWriterStream = createWriteStream(fileName);
  
  downloadStream.on("downloadProgress", ({ transferred, total, percent }) => {
    const percentage = Math.round(percent * 100);
    console.error(`"${fileName}" progress: ${transferred}/${total} (${percentage}%)`);
  })

  try {
    await pipeline(downloadStream, fileWriterStream);
    console.log(`File downloaded to ${fileName}`);
  } catch (error) {
    console.error(`Something went wrong. ${error.message}`);
  }
}

(async () => {
  await fs.promises.mkdir('tmp',  { recursive: true })
  await downloadFile(BEACON_DATA_SRC_LOCAL, BEACON_DATA_SRC_REMOTE)
})()
