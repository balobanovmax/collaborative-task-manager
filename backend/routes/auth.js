import express from 'express';
import { createUser, verifyUserPassword, emailExists, usernameExists } from '../models/User.js';
import { generateToken } from '../config/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register - Create new account
router.post('/register', async (req, res) => {
    try {
        // Extract data from request body
        const { username, email, password } = req.body;
        
        // Basic input validation
        if (!username || !email || !password) {
            return res.status(400).json({ 
                error: 'Username, email, and password are required' 
            });
        }
        
        // Check if username already exists
        const usernameExistsResult = await usernameExists(username);
        if (usernameExistsResult) {
            return res.status(400).json({ 
                error: 'Username already exists' 
            });
        }
        
        // Check if email already exists
        const emailExistsResult = await emailExists(email);
        if (emailExistsResult) {
            return res.status(400).json({ 
                error: 'Email already exists' 
            });
        }
        
        // Create the user (this handles validation, hashing, and database insertion)
        const newUser = await createUser(username, email, password);
        
        // Return success response (password_hash is already excluded by createUser)
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: newUser
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle validation errors from createUser
        if (error.message.includes('Validation failed')) {
            return res.status(400).json({ error: error.message });
        }
        
        // Handle duplicate errors (backup check)
        if (error.message.includes('already exists')) {
            return res.status(400).json({ error: error.message });
        }
        
        // Generic server error
        res.status(500).json({ 
            error: 'Registration failed due to server error' 
        });
    }
});

// POST /api/auth/login - Sign in user
router.post('/login', async (req, res) => {
    try {
        // Extract data from request body
        const { email, password } = req.body;
        
        // Basic input validation
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email and password are required' 
            });
        }
        
        // Verify user credentials (this handles email lookup and password verification)
        const user = await verifyUserPassword(email, password);
        
        // Check if login was successful
        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }
        
        // Generate JWT token for authenticated user
        const token = generateToken(user.id, user.email);
        
        // Return success response with token (password_hash is already excluded by verifyUserPassword)
        res.json({
            success: true,
            message: 'Login successful',
            user: user,
            token: token
        });
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Handle validation errors
        if (error.message.includes('required') || error.message.includes('Invalid')) {
            return res.status(400).json({ error: error.message });
        }
        
        // Generic server error
        res.status(500).json({ 
            error: 'Login failed due to server error' 
        });
    }
});

// GET /api/auth/check-username/:username - Check if username is available
router.get('/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        if (!username) {
            return res.status(400).json({ 
                error: 'Username is required' 
            });
        }
        
        const exists = await usernameExists(username);
        
        res.json({
            available: !exists,
            message: exists ? 'Username is already taken' : 'Username is available'
        });
        
    } catch (error) {
        console.error('Username check error:', error);
        res.status(500).json({ 
            error: 'Failed to check username availability' 
        });
    }
});

// GET /api/auth/check-email/:email - Check if email is available
router.get('/check-email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        if (!email) {
            return res.status(400).json({ 
                error: 'Email is required' 
            });
        }
        
        const exists = await emailExists(email);
        
        res.json({
            available: !exists,
            message: exists ? 'Email is already registered' : 'Email is available'
        });
        
    } catch (error) {
        console.error('Email check error:', error);
        res.status(500).json({ 
            error: 'Failed to check email availability' 
        });
    }
});

// TEST ROUTE: Protected endpoint to test authentication middleware
// URL: GET /api/auth/profile (requires valid JWT token)
router.get('/profile', requireAuth, (req, res) => {
    // This route is protected - only users with valid JWT tokens can access
    res.json({
        message: 'Access granted! You are authenticated.',
        user: {
            id: req.userId,
            email: req.userEmail
        },
        tokenData: req.tokenData
    });
});

export default router;
