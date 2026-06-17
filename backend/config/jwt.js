import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'fallback-secret-key-change-this') {
    process.exit(1);
}

export const generateToken = (userId, email = null) => {
    try {
        const payload = {
            userId: userId,
            iat: Math.floor(Date.now() / 1000),
        };

        if (email) {
            payload.email = email;
        }

        const token = jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN
        });

        console.log(`🔐 JWT token generated for user ${userId}`);
        return token;

    } catch (error) {
        console.error('Error generating JWT token:', error);
        throw new Error('Token generation failed');
    }
};

export const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        console.log(`✅ JWT token verified for user ${decoded.userId}`);
        return decoded;

    } catch (error) {
        console.error('JWT verification failed:', error.message);

        if (error.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        } else if (error.name === 'NotBeforeError') {
            throw new Error('Token not active yet');
        } else {
            throw new Error('Token verification failed');
        }
    }
};

export const extractTokenFromHeader = (authHeader) => {
    if (!authHeader) {
        return null;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }

    return parts[1];
};

export const jwtConfig = {
    secret: JWT_SECRET,
    expiresIn: JWT_EXPIRES_IN
};

if (process.env.NODE_ENV !== 'production') {
    console.log('🔑 JWT Configuration loaded:');
    console.log(`   - Secret: ${JWT_SECRET.substring(0, 10)}...`);
    console.log(`   - Expires in: ${JWT_EXPIRES_IN}`);
}
