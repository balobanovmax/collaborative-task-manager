import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads/task-drawings');

export const getTaskDrawingPublicPath = (filename) => `/uploads/task-drawings/${filename}`;

export const deleteTaskDrawingFile = (filePath) => {
    if (!filePath || !filePath.startsWith('/uploads/task-drawings/')) {
        return;
    }

    const filename = path.basename(filePath);
    const absolutePath = path.join(uploadsDir, filename);

    if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
    }
};
