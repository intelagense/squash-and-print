import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getNextId, appendJob, saveImage } from './helper/db.js';
import { addJob, getStatus, clearQueue, loadJobsFromId } from './helper/queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 58008;

// Configure multer for memory storage (we process images immediately)
// Since images are processed client-side (384px max, grayscale), they should be small (~50-200KB)
// 5MB limit is generous for processed images
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max (plenty for processed images)
});

// Sharp can handle many formats, so accept common image types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/avif',
  'image/heic',
  'image/heif'
];

export function validateInput({ name, email, message }) {
  const errors = [];
  
  if (!name || name.trim().length === 0) errors.push('Name is required');
  if (name && name.length > 30) errors.push('Name must be 30 characters or less');
  
  if (!email || email.trim().length === 0) errors.push('Email is required');
  if (email && email.length > 45) errors.push('Email must be 45 characters or less');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) errors.push('Invalid email format');
  
  if (!message || message.trim().length === 0) errors.push('Message is required');
  if (message && message.length > 256) errors.push('Message must be 256 characters or less');
  
  return errors;
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/thanks', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'thanks.html'));
});

app.post('/submit', upload.single('image'), async (req, res) => {
  try {
    // Validate inputs
    const { name, email, message } = req.body;
    const validationErrors = validateInput({ name, email, message });
    
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, errors: validationErrors });
    }

    // Validate image
    if (!req.file) {
      return res.status(400).json({ success: false, errors: ['Image is required'] });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        success: false, 
        errors: ['Image must be a supported format (JPEG, PNG, WebP, GIF, etc.)'] 
      });
    }

    // Get next ID and save data
    const id = await getNextId();
    
    // Get file extension from mimetype or originalname
    const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 
                req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 
                'jpg';
    
    // Save image
    const imageFile = await saveImage(id, req.file.buffer, ext);
    
    // Save job data to JSONL
    const jobData = {
      id,
      timestamp: new Date().toISOString(),
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      imageFile
    };
    await appendJob(jobData);

    // Add to print queue (queue processor will handle printing automatically)
    const queuePosition = addJob({
      id, // Store ID for marking as printed later
      payload: {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        imageBuffer: req.file.buffer
      }
    });
    
    // Return immediately - don't wait for print
    res.json({ 
      success: true,
      id,
      queuePosition: queuePosition + 1,
      message: `Saved and queued at position ${queuePosition + 1}. Print job will process automatically.` 
    });

  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

// Error handler for Multer file size errors
app.use((error, req, res, next) => {
  if (error && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        errors: ['Image file is too large. Maximum size is 5MB. If you see this error, the image processing may have failed - please try a smaller image.']
      });
  }
  next(error);
});

// Health check endpoint
app.get('/health', (req, res) => {
  const status = getStatus();
  res.json({ 
    status: 'ok', 
    ...status
  });
});

// Clear queue endpoint (for testing/debugging)
app.post('/queue/clear', (req, res) => {
  const count = clearQueue();
  res.json({ 
    success: true, 
    message: `Queue cleared: ${count} job(s) removed` 
  });
});

app.listen(PORT, 'localhost', async () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server limping on port ${PORT}`);
  console.log(`Ctrl + click: ${url}`);
  
  // Check for command line argument (start from specific ID)
  const startFromId = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  
  if (startFromId && !isNaN(startFromId)) {
    console.log(`\nStarting from job ID ${startFromId}...`);
    await loadJobsFromId(startFromId);
  } else {
    console.log('\nNo start ID provided - assuming last job in jobs.jsonl was printed.');
    console.log('Server ready to accept new jobs.');
  }
});
