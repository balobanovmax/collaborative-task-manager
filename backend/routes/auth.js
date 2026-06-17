import express from 'express';
import { createUser, verifyUserPassword, emailExists, usernameExists } from '../models/User.js';
import { generateToken } from '../config/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ 
                error: 'Username, email, and password are required' 
            });
        }
        
        const usernameExistsResult = await usernameExists(username);
        if (usernameExistsResult) {
            return res.status(400).json({ 
                error: 'Username already exists' 
            });
        }
        
        const emailExistsResult = await emailExists(email);
        if (emailExistsResult) {
            return res.status(400).json({ 
                error: 'Email already exists' 
            });
        }
        
        const newUser = await createUser(username, email, password);
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: newUser
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.message.includes('Validation failed')) {
            return res.status(400).json({ error: error.message });
        }
        
        if (error.message.includes('already exists')) {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Registration failed due to server error' 
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email and password are required' 
            });
        }
        
        const user = await verifyUserPassword(email, password);
        
        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }
        
        const token = generateToken(user.id, user.email);
        
        res.json({
            success: true,
            message: 'Login successful',
            user: user,
            token: token
        });
        
    } catch (error) {
        console.error('Login error:', error);
        
        if (error.message.includes('required') || error.message.includes('Invalid')) {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: 'Login failed due to server error' 
        });
    }
});

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

router.get('/profile', requireAuth, (req, res) => {
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
