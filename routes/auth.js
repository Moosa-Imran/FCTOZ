const express = require('express');
const router = express.Router();
const passport = require('passport');
const generateUniqueId = require('../utils/generateUniqueId');
const sendEmail = require('../utils/emailService');

// --- Helper Functions ---

/**
 * Checks password strength.
 * @param {string} password - The password to check.
 * @returns {number} A score from 0 to 4.
 */
function checkPasswordStrength(password) {
    let score = 0;
    if (!password) return score;
    // Award a point if password is long enough
    if (password.length >= 8) score++;
    // Award a point for having both upper and lower case letters
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    // Award a point for having numbers
    if (/[0-9]/.test(password)) score++;
    // Award a point for having special characters
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
}


// --- AUTH ROUTES (all prefixed with /auth) ---

// GET /auth/login
router.get('/login', (req, res) => {
    // If user is already logged in, redirect to the dashboard
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    const errors = req.session.errors || [];
    const success = req.session.success || null;
    delete req.session.errors;
    delete req.session.success;
    res.render('login', { title: 'Login - FCTOZ', errors, success });
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
    const { email, password } = req.body;
    const db = req.app.locals.db;
    try {
        const user = await db.collection('users').findOne({ email: email.toLowerCase() });
        
        if (user && user.googleId && !user.password) {
            req.session.errors = [{ msg: 'This account was created with Google. Please use "Continue with Google" to sign in.' }];
            return res.redirect('/auth/login');
        }

        if (user && user.password === password) {
            // Use passport's login function to establish a session
            req.login(user, (err) => {
                if (err) { return next(err); }
                return res.redirect('/dashboard');
            });
        } else {
            req.session.errors = [{ msg: 'Invalid email or password. Please try again.' }];
            res.redirect('/auth/login');
        }
    } catch (error) {
        console.error('Login Error:', error);
        req.session.errors = [{ msg: 'An internal server error occurred.' }];
        res.redirect('/auth/login');
    }
});

// GET /auth/signup
router.get('/signup', (req, res) => {
    // If user is already logged in, redirect to the dashboard
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    const errors = req.session.errors || [];
    delete req.session.errors;
    res.render('signup', { title: 'Sign Up - FCTOZ', errors });
});

// POST /auth/send-otp - Step 1 of Signup
router.post('/send-otp', async (req, res) => {
    const { 'full-name': fullName, email, password, confirmPassword } = req.body;
    const db = req.app.locals.db;
    let errors = [];

    if (password !== confirmPassword) {
        errors.push({ msg: 'Passwords do not match.' });
    }
    if (checkPasswordStrength(password) < 3) {
        errors.push({ msg: 'Password is too weak.' });
    }

    try {
        const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
        if (existingUser) {
            errors.push({ msg: 'An account with this email already exists.' });
        }
        
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        req.session.otpData = {
            fullName,
            email: email.toLowerCase(),
            password,
            otp,
            otpExpires
        };

        const subject = "Your FCTOZ Verification Code";
        await sendEmail(email.toLowerCase(), subject, 'email-otp', {
            subject,
            userName: fullName,
            otp
        });

        res.status(200).json({ message: 'OTP sent successfully.' });

    } catch (error) {
        console.error('Send OTP Error:', error);
        res.status(500).json({ errors: [{ msg: 'An internal server error occurred.' }] });
    }
});

// POST /auth/verify-otp - Step 2 of Signup
router.post('/verify-otp', async (req, res) => {
    const { otp } = req.body;
    const db = req.app.locals.db;

    if (!req.session.otpData) {
        return res.status(400).json({ errors: [{ msg: 'OTP session expired. Please sign up again.' }] });
    }

    const { fullName, email, password, otp: sessionOtp, otpExpires } = req.session.otpData;

    if (new Date() > new Date(otpExpires)) {
        return res.status(400).json({ errors: [{ msg: 'OTP has expired. Please sign up again.' }] });
    }

    if (otp !== sessionOtp) {
        return res.status(400).json({ errors: [{ msg: 'Invalid OTP. Please try again.' }] });
    }

    try {
        const userId = await generateUniqueId(db);
        const newUser = {
            userId: userId,
            googleId: null,
            fullName: fullName,
            email: email,
            password: password,
            verified: false, // New field
            kycId: null,     // New field
            createdAt: new Date()
        };

        await db.collection('users').insertOne(newUser);
        
        // Send welcome email
        const subject = "Welcome to FCTOZ!";
        sendEmail(email, subject, 'welcome-email', {
            subject: subject,
            userName: fullName
        });
        
        delete req.session.otpData;

        req.session.success = { msg: 'Account created successfully! Please log in.' };
        res.status(200).json({ redirectUrl: '/auth/login' });

    } catch (error) {
        console.error('Verify OTP & Signup Error:', error);
        res.status(500).json({ errors: [{ msg: 'An internal server error occurred during signup.' }] });
    }
});


// POST /auth/logout
router.post('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        req.session.destroy(err => {
            if (err) {
                console.error('Session destroy error:', err);
                return res.redirect('/dashboard');
            }
            res.clearCookie('connect.sid');
            res.redirect('/');
        });
    });
});

// --- GOOGLE AUTH ROUTES ---

// GET /auth/google
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

// GET /auth/google/callback
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/auth/login' }), (req, res) => {
    // Successful authentication, redirect to dashboard.
    res.redirect('/dashboard');
});

module.exports = router;
