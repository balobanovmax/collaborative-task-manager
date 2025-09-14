import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Validate JWT configuration in production
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'fallback-secret-key-change-this') {
    process.exit(1);
}

/**
 * Generate a JWT token for a user
 * @param {number} userId - The user's ID
 * @param {string} email - The user's email (optional, for debugging)
 * @returns {string} JWT token
 */
export const generateToken = (userId, email = null) => {
    try {
        // Create payload (data to store in token)
        const payload = {
            userId: userId,
            iat: Math.floor(Date.now() / 1000), // Issued at (current timestamp)
        };
        
        // Optionally add email for debugging (don't add sensitive data)
        if (email) {
            payload.email = email;
        }
        
        // Generate token with secret and expiration
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

/**
 * Verify and decode a JWT token
 * @param {string} token - The JWT token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
    try {
        // Verify token with secret
        const decoded = jwt.verify(token, JWT_SECRET);
        
        console.log(`✅ JWT token verified for user ${decoded.userId}`);
        return decoded;
        
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        
        // Handle specific JWT errors
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

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
export const extractTokenFromHeader = (authHeader) => {
    if (!authHeader) {
        return null;
    }
    
    // Expected format: "Bearer eyJhbGciOiJIUzI1NiIsInR..."
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }
    
    return parts[1];
};

// Export configuration for use in other files
export const jwtConfig = {
    secret: JWT_SECRET,
    expiresIn: JWT_EXPIRES_IN
};

// Log configuration on startup (hide secret in production)
if (process.env.NODE_ENV !== 'production') {
    console.log('🔑 JWT Configuration loaded:');
    console.log(`   - Secret: ${JWT_SECRET.substring(0, 10)}...`);
    console.log(`   - Expires in: ${JWT_EXPIRES_IN}`);
}
