import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads/avatars');

export const getAvatarPublicPath = (filename) => `/uploads/avatars/${filename}`;

export const deleteAvatarFile = (profilePictureUrl) => {
    if (!profilePictureUrl || !profilePictureUrl.startsWith('/uploads/avatars/')) {
        return;
    }

    const filename = path.basename(profilePictureUrl);
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};
