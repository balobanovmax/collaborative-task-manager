import { verifyToken, extractTokenFromHeader } from '../config/jwt.js';


export const requireAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                error: 'Access denied. No token provided.',
                message: 'Please login to access this resource'
            });
        }
        const token = extractTokenFromHeader(authHeader);
        
        if (!token) {
            return res.status(401).json({
                error: 'Access denied. Invalid token format.',
                message: 'Token must be in format: Bearer <token>'
            });
        }
        const decoded = verifyToken(token);
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.tokenData = decoded;
        next();
        
    } catch (error) {
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

export default requireAuth;
