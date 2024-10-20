import { removeBackground } from '@imgly/background-removal-node';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors({
  origin: '*', // Allow requests from any origin
}));

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

app.get('/ping', logRequest, (req: Request, res: Response) => {
  res.send('Pong!!');
});

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const validateRequest = (req: Request, res: any, next: NextFunction) => {
  const apiKey = req.headers['pango-api-key']; // Get API key from headers
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  next();
};

app.post('/remove-background', logRequest, validateRequest, async (req: any, res: any) => {
  upload.single('image')(req, res, async (err: any) => {
    try {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            console.log('❗File size exceeds 10MB limit');
            return res.status(400).json({ error: 'File size exceeds 10MB limit' });
          }
        } else {
          console.error('❗', err);
          throw err;
        }
      }

      // Validate file
      if (!req.file) {
        console.log('❗No file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filetypes = /jpeg|jpg|png/; // Allowed file types
      const mimetype = filetypes.test(req.file.mimetype);
      if (!mimetype) {
        console.log('❗Invalid file type');
        return res.status(400).json({
          error: `Invalid file type '${req.file.mimetype}'. Only jpg, jpeg, png are allowed.`,
        });
      }

      console.log(`📁 File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
      console.time('⏱️ RemoveBackgroundProcess');
      const blobData = new Blob([req.file.buffer], { type: req.file.mimetype });

      return removeBackground(blobData).then(async (blob: any) => {
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.timeEnd('⏱️ RemoveBackgroundProcess');

        // Convert buffer to Base64 and send in JSON response
        const base64Image = buffer.toString('base64');
        res.set({
          'Content-Type': 'application/json',
        });

        res.status(200).json({
          image: `data:image/png;base64,${base64Image}`,
        });

        console.log('✅ Background removed successfully');
      });
    } catch (error: any) {
      console.error('❗Error removing background:', error);
      res.status(500).json({ error: 'Failed to remove background' });
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

module.exports = app;
