import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads/voice-messages');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const allowedMimeTypes = new Set([
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'video/webm'
]);

const extensionByMime = {
    'audio/webm': '.webm',
    'video/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/mp4': '.m4a',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav'
};

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const groupId = req.body?.group_id || 'group';
        const extension = extensionByMime[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.webm';
        cb(null, `voice-${groupId}-user-${req.userId}-${Date.now()}${extension}`);
    }
});

const fileFilter = (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
        cb(null, true);
        return;
    }

    cb(new Error('Unsupported audio format. Please record using a supported browser.'));
};

export const uploadVoiceMessage = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 8 * 1024 * 1024
    }
});
