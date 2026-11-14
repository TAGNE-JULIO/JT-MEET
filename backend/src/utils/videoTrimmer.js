import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

// Priority: environment variable > common Windows paths > PATH
const findFfmpeg = () => {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  const commonPaths = [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
    'ffmpeg', // fallback: rely on PATH
  ];

  for (const p of commonPaths) {
    if (p === 'ffmpeg') return 'ffmpeg'; // let OS resolve from PATH
    if (fs.existsSync(p)) return p;
  }

  return 'ffmpeg';
};

const FFMPEG_BIN = findFfmpeg();

/**
 * Check if ffmpeg is available on this system
 * @returns {Promise<boolean>}
 */
export const isFfmpegAvailable = () => {
  return new Promise((resolve) => {
    execFile(FFMPEG_BIN, ['-version'], { timeout: 5000 }, (err) => {
      resolve(!err);
    });
  });
};

/**
 * Trim a video file between startTime and startTime+duration
 * @param {string} inputPath  - Absolute path to source video
 * @param {string} outputPath - Absolute path for the output clip
 * @param {number} startTime  - Start time in seconds
 * @param {number} duration   - Clip length in seconds
 * @returns {Promise<boolean>}
 */
export const trimVideo = (inputPath, outputPath, startTime, duration) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Input file not found: ${inputPath}`));
    }

    // -ss before -i = fast seek; -t = duration; -c copy = no re-encode = instant
    const args = [
      '-y',
      '-ss', String(Math.max(0, startTime)),
      '-i', inputPath,
      '-t', String(Math.max(1, duration)),
      '-c', 'copy',
      '-movflags', '+faststart',
      outputPath
    ];

    execFile(FFMPEG_BIN, args, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('❌ FFmpeg clip error:', stderr || err.message);
        return reject(new Error(stderr || err.message));
      }
      console.log('✅ Clip created:', outputPath);
      resolve(true);
    });
  });
};

export default { trimVideo, isFfmpegAvailable };
