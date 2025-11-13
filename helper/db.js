import { readFile, writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.jsonl');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

// Ensure directories exist
async function ensureDirs() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(IMAGES_DIR)) {
    await mkdir(IMAGES_DIR, { recursive: true });
  }
}

/**
 * Get the next job ID by reading the last line of jobs.jsonl
 * @returns {Promise<number>} Next ID (starts at 1 if file is empty)
 */
export async function getNextId() {
  await ensureDirs();
  
  if (!existsSync(JOBS_FILE)) {
    return 1;
  }

  try {
    const content = await readFile(JOBS_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return 1;
    }

    const lastLine = lines[lines.length - 1];
    const lastJob = JSON.parse(lastLine);
    return (lastJob.id || 0) + 1;
  } catch (error) {
    // If file exists but is malformed, start fresh
    return 1;
  }
}

/**
 * Append a job to jobs.jsonl
 * @param {Object} jobData - Job data to save
 */
export async function appendJob(jobData) {
  await ensureDirs();
  const line = JSON.stringify(jobData) + '\n';
  await appendFile(JOBS_FILE, line, 'utf-8');
}


/**
 * Save an image file
 * @param {number} id - Job ID
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} originalExtension - Original file extension (e.g., 'jpg', 'png')
 * @returns {Promise<string>} Filename that was saved
 */
export async function saveImage(id, imageBuffer, originalExtension) {
  await ensureDirs();
  const filename = `${id}.${originalExtension}`;
  const filepath = path.join(IMAGES_DIR, filename);
  await writeFile(filepath, imageBuffer);
  return filename;
}

/**
 * Get all jobs from jobs.jsonl
 * @returns {Promise<Array>} Array of job objects
 */
export async function getAllJobs() {
  await ensureDirs();
  
  if (!existsSync(JOBS_FILE)) {
    return [];
  }

  try {
    const content = await readFile(JOBS_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    return lines.map(line => JSON.parse(line));
  } catch (error) {
    console.error('Error reading jobs:', error);
    return [];
  }
}

