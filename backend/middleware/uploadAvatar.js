import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads/avatars');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `user-${req.userId}-${Date.now()}${extension}`);
    }
});

const fileFilter = (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
        return;
    }

    cb(new Error('Avatar must be a JPEG, PNG, GIF, or WebP image.'));
};

export const uploadAvatar = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024
    }
});
