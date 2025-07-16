// middleware/isAuthenticated.js

/**
 * This middleware checks if a user is authenticated using Passport's req.isAuthenticated() method.
 * If the user is not logged in, they are redirected to the correct login page.
 */
const isAuthenticated = (req, res, next) => {
    // Use Passport's built-in method to check for an active session
    if (req.isAuthenticated()) {
        return next();
    }
    // If not logged in, redirect to the login page with the correct path
    res.redirect('/auth/login');
};

module.exports = isAuthenticated;
