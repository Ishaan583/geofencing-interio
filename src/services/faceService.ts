import * as faceapi from 'face-api.js';

let modelsLoaded = false;

/**
 * Loads the face-api.js models from the public directory.
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  
  try {
    const MODEL_URL = '/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('Face-api models loaded successfully');
  } catch (error) {
    console.error('Error loading face-api models:', error);
    throw error;
  }
}

/**
 * Interface representing a detected face.
 */
export interface DetectionResult {
  descriptor: Float32Array;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Detects a single face in an HTMLVideoElement or HTMLCanvasElement and extracts its descriptor.
 */
export async function detectFaceDescriptor(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<DetectionResult | null> {
  await loadFaceModels();

  // Use TinyFaceDetector with more lenient options for low lighting/angles
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 160,
    scoreThreshold: 0.3,
  });

  const detection = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  return {
    descriptor: detection.descriptor,
    box: detection.detection.box,
  };
}

/**
 * Checks if a face is present in the frame. Fast and lightweight (does not calculate landmarks/descriptors).
 */
export async function detectFacePresence(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<boolean> {
  await loadFaceModels();

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 160,
    scoreThreshold: 0.3,
  });

  const detection = await faceapi.detectSingleFace(input, options);
  return !!detection;
}

/**
 * Compares two face descriptors and returns the distance.
 * Distance is typically between 0 (identical) and 1.5. A distance of <= 0.6 is considered a match.
 */
export function compareFaceDescriptors(
  desc1: number[] | Float32Array,
  desc2: number[] | Float32Array
): { distance: number; isMatch: boolean; confidence: number } {
  const d1 = desc1 instanceof Float32Array ? desc1 : new Float32Array(desc1);
  const d2 = desc2 instanceof Float32Array ? desc2 : new Float32Array(desc2);

  const distance = faceapi.euclideanDistance(d1, d2);
  const threshold = 0.6;
  const isMatch = distance <= threshold;

  // Convert Euclidean distance to a user-friendly match percentage
  // 0 distance -> 100% match
  // 0.6 distance (threshold) -> 75% match
  // >= 1.2 distance -> 0% match
  let confidence = 0;
  if (distance === 0) {
    confidence = 100;
  } else if (isMatch) {
    // scale from 75% to 99%
    confidence = Math.round(75 + ((threshold - distance) / threshold) * 24);
  } else {
    // scale from 0% to 74%
    confidence = Math.round(Math.max(0, ((1.2 - distance) / (1.2 - threshold)) * 74));
  }

  return {
    distance,
    isMatch,
    confidence,
  };
}
