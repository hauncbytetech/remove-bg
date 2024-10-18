"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const background_removal_node_1 = require("@imgly/background-removal-node");
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const multer_1 = __importStar(require("multer"));
dotenv_1.default.config(); // Load environment variables
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Set up multer for file uploads with a 5MB limit
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});
// Middleware to log request information with emojis
const logRequestInfo = (req, res, next) => {
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
const checkApiKey = (req, res, next) => {
    const apiKey = req.headers['pango-api-key']; // Get API key from headers
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
    next(); // Proceed to the next middleware or route handler
};
app.get('/ping', logRequestInfo, (req, res) => {
    res.send('Pong!!');
});
// API endpoint to remove background
app.post('/remove-background', logRequestInfo, checkApiKey, upload.single('image'), async (req, res) => {
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
        return (0, background_removal_node_1.removeBackground)(blobData).then(async (blob) => {
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
    }
    catch (error) {
        console.error('❗Error removing background:', error);
        res.status(500).json({ error: 'Failed to remove background' });
    }
});
// Error handler for file size limit
app.use((err, req, res, next) => {
    if (err instanceof multer_1.MulterError) {
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
