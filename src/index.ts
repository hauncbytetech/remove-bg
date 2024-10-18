import { removeBackground } from '@imgly/background-removal-node';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';

dotenv.config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 4001;

// Set up multer for file uploads with a 5MB limit
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// Middleware to log request information with emojis
const logRequestInfo = (req: Request, res: Response, next: NextFunction) => {
  const requestAt = new Date().toISOString();
  const userAgent = req.headers['user-agent'];
  const host = req.headers.host;
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`=============================================\n🕒 Request at: ${requestAt}`);
  console.log(`💻 User Agent: ${userAgent}`);
  console.log(`🌐 Host: ${host}`);
  console.log(`📍 IP: ${ip}`);

  next(); // Proceed to the next middleware or route handler
};

// Middleware to check API key
const checkApiKey = (req: Request, res: any, next: NextFunction) => {
  const apiKey = req.headers['pango-api-key']; // Get API key from headers
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  next(); // Proceed to the next middleware or route handler
};

app.get('/ping', logRequestInfo, (req: Request, res: Response) => {
  res.send('Pong!!');
});

// API endpoint to remove background
app.post('/remove-background', logRequestInfo, checkApiKey, upload.single('image'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      console.log('⚠️ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      console.log('❌ Invalid file type');
      return res.status(400).json({
        error: `Invalid file type '${req.file.mimetype}'. Only JPEG and PNG are allowed.`,
      });
    }

    // Log the start time for the background removal process
    console.time('⏱️ RemoveBackgroundProcess');

    const blobData = new Blob([req.file.buffer], { type: req.file.mimetype });

    return removeBackground(blobData).then(async (blob: any) => {
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Log the time taken for the removeBackground process
      console.timeEnd('⏱️ RemoveBackgroundProcess');

      // Set response headers and send the processed image
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': buffer.length,
      });

      res.status(200).send(buffer);
      console.log('✅ Background removed successfully');
    });
  } catch (error: any) {
    console.error('❗Error removing background:', error);
    res.status(500).json({ error: 'Failed to remove background' });
  }
});

// Error handler for file size limit
app.use((err: any, req: Request, res: any, next: NextFunction) => {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '❗File size exceeds 5MB limit' });
    }
  }
  next(err); // Pass other errors to the next error handler
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

module.exports = app;
