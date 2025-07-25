const GoogleStrategy = require('passport-google-oauth20').Strategy;
const generateUniqueId = require('../utils/generateUniqueId');
const sendEmail = require('../utils/emailService'); // Import email service

// This entire file is now a function that gets exported
module.exports = (passport, db) => {
    // --- Check for Environment Variables ---
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! ERROR: Google OAuth credentials not found in .env file. !!!');
        console.error('!!! Please check your .env file and Google Cloud Console setup. !!!');
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    } else {
        console.log('Google OAuth credentials loaded successfully.');
    }

    passport.serializeUser((user, done) => {
        // We serialize the user's custom ID into the session
        done(null, user.userId);
    });

    passport.deserializeUser(async (id, done) => {
        // Find the user by their custom ID using the passed db instance
        const user = await db.collection('users').findOne({ userId: id });
        done(null, user);
    });

    passport.use(
        new GoogleStrategy({
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: '/auth/google/callback'
        }, async (accessToken, refreshToken, profile, done) => {
            const usersCollection = db.collection('users');
            const googleEmail = profile.emails[0].value;

            try {
                // 1. Check if user already exists with this Google ID
                let user = await usersCollection.findOne({ googleId: profile.id });
                if (user) {
                    // User found with Google ID, log them in
                    return done(null, user);
                }

                // 2. If no user with Google ID, check if an account exists with the same email
                user = await usersCollection.findOne({ email: googleEmail });
                if (user) {
                    // User found with the same email, link the Google ID to this account
                    await usersCollection.updateOne(
                        { email: googleEmail },
                        { $set: { googleId: profile.id } }
                    );
                    // Fetch the updated user to pass to done()
                    const updatedUser = await usersCollection.findOne({ email: googleEmail });
                    console.log(`Linked Google ID to existing email account: ${googleEmail}`);
                    return done(null, updatedUser);
                }

                // 3. If no account exists with this Google ID or email, create a new user
                const userId = await generateUniqueId(db);
                const newUser = {
                    userId: userId,
                    googleId: profile.id,
                    fullName: profile.displayName,
                    email: googleEmail,
                    password: null, // No password for Google signups initially
                    verified: false, // New field
                    kycId: null,     // New field
                    createdAt: new Date()
                };
                await usersCollection.insertOne(newUser);
                console.log(`Created new user via Google: ${googleEmail}`);

                // Send welcome email
                const subject = "Welcome to FCTOZ!";
                sendEmail(googleEmail, subject, 'welcome-email', {
                    subject: subject,
                    userName: newUser.fullName
                });

                return done(null, newUser);

            } catch (err) {
                console.error("Passport Google Strategy Error:", err);
                return done(err);
            }
        })
    );
};
