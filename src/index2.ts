import { removeBackground } from '@imgly/background-removal-node';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

// Reusable responseJson function with TypeScript
const responseJson = (
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data: any = null
): void => {
  res.status(statusCode).json({
    success,
    message,
    data,
  });
};

// Middleware for CORS
app.use(cors({
  origin: '*', // Allow requests from any origin
}));

// Middleware to log requests
const logRequest = (req: Request, res: Response, next: NextFunction) => {
  const requestAt = new Date().toISOString();
  const userAgent = req.headers['user-agent'];
  const host = req.headers.host;
  const ip = req.ip || req.ips;

  console.log(`=============================================\n🕒 Request at: ${requestAt}`);
  console.log(`💻 User Agent: ${userAgent}`);
  console.log(`🌐 Host: ${host}`);
  console.log(`📍 IP: ${ip}`);

  next();
};

// Middleware to measure the time of the entire API process
const measureTime = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now(); // Record start time
  res.on('finish', () => {
    const endTime = Date.now();
    const timeTaken = endTime - startTime;
    console.log(`⏱️ Time taken for API call: ${timeTaken} ms`);
  });
  next();
};

app.get('/ping', logRequest, (req: Request, res: Response) => {
  responseJson(res, 200, true, 'Pong!!');
});

// Set up storage configuration for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads'); // Set your uploads directory
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir); // Save files in the uploads directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // Unique file name
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Middleware to validate requests
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['pango-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return responseJson(res, 401, false, 'Unauthorized: Invalid API key');
  }
  next();
};

// Apply rate limiting specifically to the remove-background route
const removeBgLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per windowMs
  handler: (req: Request, res: Response) => {
    responseJson(res, 429, false, 'Too many requests');
  },
});
// app.set('trust proxy', true);

// Endpoint to remove background from image
app.post('/remove-background', logRequest, measureTime, validateRequest, removeBgLimiter, (req: any, res: Response) => {
  upload.single('image')(req, res, async (err: any) => {
    try {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            console.log('❗File size exceeds 10MB limit');
            return responseJson(res, 400, false, 'File size exceeds 10MB limit');
          }
        } else {
          console.error('❗', err);
          throw err;
        }
      }

      if (!req.file) {
        console.log('❗No file uploaded');
        return responseJson(res, 400, false, 'No file uploaded');
      }

      const filetypes = /jpeg|jpg|png/;
      const mimetype = filetypes.test(req.file.mimetype);
      if (!mimetype) {
        console.log('❗Invalid file type');
        return responseJson(res, 400, false, `Invalid file type '${req.file.mimetype}'. Only jpg, jpeg, png are allowed.`);
      }

      console.log(`📁 File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);

      const blobData = new Blob([fs.readFileSync(req.file.path)], { type: req.file.mimetype });

      return removeBackground(blobData).then(async (blob: any) => {
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Convert buffer to Base64 and send in JSON response
        const base64Image = buffer.toString('base64');
        responseJson(res, 200, true, 'Background removed successfully', {
          image: `data:image/png;base64,${base64Image}`,
        });

        console.log('✅ Background removed successfully');
      });
    } catch (error: any) {
      console.error('❗Error removing background:', error);
      responseJson(res, 500, false, 'Failed to remove background');
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

module.exports = app;
