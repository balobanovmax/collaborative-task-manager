import { verifyToken, extractTokenFromHeader } from '../config/jwt.js';

/**
 * Authentication middleware - protects routes that require login
 * 
 * How it works:
 * 1. Extracts JWT token from Authorization header
 * 2. Verifies token is valid and not expired
 * 3. Adds user info to request object
 * 4. Allows request to continue OR rejects with 401
 * 
 * Usage:
 * router.get('/protected-route', requireAuth, (req, res) => {
 *   // req.userId and req.userEmail are available here
 * });
 */
export const requireAuth = (req, res, next) => {
    try {
        // Step 1: Get Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                error: 'Access denied. No token provided.',
                message: 'Please login to access this resource'
            });
        }
        
        // Step 2: Extract token from "Bearer <token>" format
        const token = extractTokenFromHeader(authHeader);
        
        if (!token) {
            return res.status(401).json({
                error: 'Access denied. Invalid token format.',
                message: 'Token must be in format: Bearer <token>'
            });
        }
        
        // Step 3: Verify token is valid and not expired
        const decoded = verifyToken(token);
        
        // Step 4: Add user info to request object for use in route handlers
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.tokenData = decoded; // Full token payload if needed
        
        // Step 5: Allow request to continue to the actual route handler
        next();
        
    } catch (error) {
        // Handle specific JWT errors with helpful messages
        if (error.message === 'Token has expired') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Your session has expired. Please login again.'
            });
        } else if (error.message === 'Invalid token') {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Invalid authentication token. Please login again.'
            });
        } else {
            console.error('Authentication middleware error:', error);
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Unable to verify authentication. Please login again.'
            });
        }
    }
};

// TODO: 
// - optionalAuth (for public routes that can show personalized content)
// - requireRole (for admin-only features)  
// - rateLimitAuth (for preventing spam/abuse)
export default requireAuth;
