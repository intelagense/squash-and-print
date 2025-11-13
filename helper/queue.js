// queue.js - Simple fire-and-forget print queue
import { printThis } from './print.js';
import { getAllJobs } from './db.js';

// Queue to process prints sequentially
let printQueue = [];
let isProcessing = false;

// Queue processor - prints jobs one at a time
async function processQueue() {
  if (isProcessing) return;
  
  isProcessing = true;
  
  try {
    while (printQueue.length > 0) {
      const job = printQueue.shift(); // Remove from queue immediately
      
      try {
        console.log(`Printing job ${job.id}...`);
        await printThis(job.id, job.payload);
        console.log(`Job ${job.id} printed successfully`);
      } catch (error) {
        console.error(`Print error for job ${job.id}:`, error.message);
        // Job is already removed from queue, so it won't retry
        // User can restart server with this ID as argument if needed
      }
    }
  } catch (error) {
    console.error('[Queue] Unexpected error in processQueue:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Add a job to the print queue
 * @param {Object} job - Job object with id and payload
 * @param {number} job.id - Job ID
 * @param {Object} job.payload - Print payload (name, email, message, imageBuffer)
 * @returns {number} Queue position (1-indexed)
 */
export function addJob(job) {
  const queuePosition = printQueue.length + (isProcessing ? 1 : 0);
  printQueue.push(job);
  
  // Start processing queue if not already running
  processQueue().catch(error => {
    console.error('Queue processing error:', error);
    isProcessing = false;
  });
  
  return queuePosition;
}

/**
 * Load jobs from jobs.jsonl starting from a specific ID
 * @param {number} startFromId - Job ID to start from (inclusive)
 * @returns {Promise<number>} Number of jobs queued
 */
export async function loadJobsFromId(startFromId) {
  console.log(`Loading jobs from ID ${startFromId}...`);
  
  try {
    const allJobs = await getAllJobs();
    
    // Find the job with the given ID
    const startIndex = allJobs.findIndex(job => job.id === startFromId);
    
    if (startIndex === -1) {
      console.log(`Job ID ${startFromId} not found in jobs.jsonl, ignoring...`);
      return 0;
    }
    
    // Get all jobs from this ID to the end
    const jobsToPrint = allJobs.slice(startIndex);
    
    if (jobsToPrint.length === 0) {
      console.log(`No jobs found starting from ID ${startFromId}`);
      return 0;
    }
    
    // Load images and add to queue
    const { readFile } = await import('fs/promises');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    for (const job of jobsToPrint) {
      const imagePath = join(__dirname, '..', 'data', 'images', job.imageFile);
      
      try {
        const imageBuffer = await readFile(imagePath);
        printQueue.push({
          id: job.id,
          payload: {
            name: job.name,
            email: job.email,
            message: job.message,
            imageBuffer
          }
        });
      } catch (error) {
        console.error(`Failed to load image for job ${job.id}:`, error.message);
      }
    }
    
    console.log(`Added ${printQueue.length} job(s) to queue`);
    
    // Start processing
    processQueue().catch(error => {
      console.error('Queue processing error:', error);
      isProcessing = false;
    });
    
    return printQueue.length;
  } catch (error) {
    console.error('Error loading jobs:', error);
    throw error;
  }
}

/**
 * Get current queue status
 * @returns {Object} Status object with queueLength, isProcessing
 */
export function getStatus() {
  return {
    queueLength: printQueue.length,
    isProcessing
  };
}

/**
 * Clear the print queue
 * @returns {number} Number of jobs cleared
 */
export function clearQueue() {
  const count = printQueue.length;
  printQueue = [];
  isProcessing = false;
  console.log(`Queue cleared: ${count} job(s) removed`);
  return count;
}
