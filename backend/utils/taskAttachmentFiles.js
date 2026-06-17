import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads/task-attachments');

export const getTaskAttachmentPublicPath = (filename) => `/uploads/task-attachments/${filename}`;

export const deleteTaskAttachmentFile = (filePath) => {
    if (!filePath || !filePath.startsWith('/uploads/task-attachments/')) {
        return;
    }

    const filename = path.basename(filePath);
    const absolutePath = path.join(uploadsDir, filename);

    if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
    }
};
