const DEFAULT_STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
];

const parseTurnUrls = (value) => {
    if (!value || typeof value !== 'string') {
        return [];
    }

    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
};

export const getIceServers = () => {
    const servers = [...DEFAULT_STUN_SERVERS];

    const turnUrls = parseTurnUrls(process.env.TURN_URL);
    const turnUsername = process.env.TURN_USERNAME?.trim();
    const turnCredential = process.env.TURN_CREDENTIAL?.trim();

    if (turnUrls.length > 0 && turnUsername && turnCredential) {
        servers.push({
            urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
            username: turnUsername,
            credential: turnCredential
        });
    }

    return servers;
};

export const getIceTransportPolicy = () => (
    process.env.ICE_TRANSPORT_POLICY === 'relay' ? 'relay' : 'all'
);

export const isTurnConfigured = () => {
    const turnUrls = parseTurnUrls(process.env.TURN_URL);
    return Boolean(
        turnUrls.length > 0
        && process.env.TURN_USERNAME?.trim()
        && process.env.TURN_CREDENTIAL?.trim()
    );
};
