import express from 'express';
import multer from 'multer';
import { removeBackground } from '@imgly/background-removal-node';

const app = express();
const PORT = process.env.PORT || 4001;

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware to log request information
const logRequestInfo = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`Received ${req.method} request for ${req.originalUrl}`);
  next(); // Call the next middleware or route handler
};

// Function to remove background
const processImage = async (file: Express.Multer.File): Promise<Buffer | null> => {
  try {
    const allowedTypes = ['image/jpeg', 'image/png'];

    // Validate file type
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type '${file.mimetype}'. Only JPEG and PNG are allowed.`);
    }

    // Perform background removal directly on the uploaded image buffer
    const blobData = new Blob([file.buffer], { type: file.mimetype });
    const processedBlob = await removeBackground(blobData); // Use the uploaded image buffer directly
    const arrayBuffer = await processedBlob.arrayBuffer();
    return Buffer.from(arrayBuffer); // Convert the result back to Buffer

  } catch (error) {
    console.error('Error during image processing:', error);
    throw error; // Propagate the error
  }
};

// API endpoint to remove background
app.post('/remove-background', logRequestInfo, upload.single('image'), async (req: any, res: any) => {
  try {
    console.time('total-time');

    // Check if a file was uploaded
    if (!req.file) {
      console.timeEnd('total-time');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.time('background-removal-time');
    const processedImage = await processImage(req.file);
    console.timeEnd('background-removal-time');

    // Set response headers and send the processed image
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': processedImage?.length || 0,
    });
    res.status(200).send(processedImage);

    console.timeEnd('total-time');

  } catch (error: any) {
    console.error('Error removing background:', error);
    console.timeEnd('total-time');
    return res.status(500).json({ error: 'Failed to remove background', details: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
