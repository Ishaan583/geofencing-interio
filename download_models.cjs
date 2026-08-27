const fs = require('fs');
const path = require('path');
const https = require('https');

const dir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1'
];

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

function download(fileName) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(dir, fileName));
    const url = baseUrl + fileName;
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${fileName}: status code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${fileName}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(path.join(dir, fileName), () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('Downloading face-api.js models...');
  for (const file of files) {
    try {
      await download(file);
    } catch (e) {
      console.error(`Error downloading ${file}:`, e.message);
    }
  }
  console.log('All downloads completed!');
}

main();
