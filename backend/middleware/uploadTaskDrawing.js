import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads/task-drawings');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const taskId = req.params.id || 'task';
        cb(null, `drawing-${taskId}-user-${req.userId}-${Date.now()}.png`);
    }
});

const fileFilter = (_req, file, cb) => {
    if (file.mimetype === 'image/png') {
        cb(null, true);
        return;
    }

    cb(new Error('Drawings must be saved as PNG images.'));
};

export const uploadTaskDrawing = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});
