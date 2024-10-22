import { removeBackground } from '@imgly/background-removal-node';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Buffer } from 'buffer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

// Parse incoming JSON requests
app.use(express.json({ limit: '10mb' }));

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

  console.log(`=============================================\n🕒Request at: ${requestAt}`);
  console.log(`💻User Agent: ${userAgent || 'Unknown'}`);
  console.log(`📥URL: ${req.method}${req.url}`);

  next();
};
app.use(logRequest);

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

// Endpoint to remove background from image (Base64 input)
app.post('/remove-background', measureTime, validateRequest, removeBgLimiter, async (req: Request, res: Response) => {
  try {
    const { base64Image } = req.body;

    if (!base64Image) {
      console.log('❗No base64 image data provided');
      return responseJson(res, 400, false, 'No base64 image data provided');
    }

    // Decode base64 string
    const matches = base64Image.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!matches) {
      console.log('❗Invalid base64 image format');
      return responseJson(res, 400, false, 'Invalid base64 image format. Must be a valid image.');
    }

    const imageType = matches[1]; // png or jpeg
    const imageData = matches[2]; // Actual base64 data

    // Convert base64 data to buffer
    const buffer = Buffer.from(imageData, 'base64');
    const blobData = new Blob([buffer], { type: `image/${imageType}` });

    // Remove background using the buffer data
    const blob = await removeBackground(blobData);

    const arrayBuffer = await blob.arrayBuffer();
    const resultBuffer = Buffer.from(arrayBuffer);

    // Convert the result to base64 and return
    const resultBase64 = resultBuffer.toString('base64');
    const resultImage = `data:image/png;base64,${resultBase64}`;

    responseJson(res, 200, true, 'Background removed successfully', { base64Image: resultImage });

    console.log('✅Background removed successfully');
  } catch (error: any) {
    console.error('❗Error removing background:', error);
    responseJson(res, 500, false, 'Failed to remove background');
  }
});

app.get('/ping', logRequest, (req: Request, res: Response) => {
  responseJson(res, 200, true, 'Pong!!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

module.exports = app;
