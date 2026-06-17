import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getIceServers, getIceTransportPolicy } from '../config/iceServers.js';

const router = express.Router();

router.get('/ice-servers', requireAuth, (req, res) => {
    const iceServers = getIceServers();
    const hasTurn = iceServers.some((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url) => String(url).startsWith('turn'));
    });

    res.json({
        iceServers,
        iceTransportPolicy: getIceTransportPolicy(),
        turnEnabled: hasTurn
    });
});

export default router;
