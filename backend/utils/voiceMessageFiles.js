import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads/voice-messages');

export const getVoiceMessagePublicPath = (filename) => `/uploads/voice-messages/${filename}`;

export const deleteVoiceMessageFile = (voiceUrl) => {
    if (!voiceUrl || !voiceUrl.startsWith('/uploads/voice-messages/')) {
        return;
    }

    const filename = path.basename(voiceUrl);
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

export const deleteVoiceMessageFiles = (voiceUrls = []) => {
    voiceUrls.forEach((voiceUrl) => deleteVoiceMessageFile(voiceUrl));
};
