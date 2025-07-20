const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Load environment variables from .env file
require('dotenv').config(); 

const app = express();
const port = 3001;

// Use environment variables for configuration
const MONGO_URI = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;

const client = new MongoClient(MONGO_URI);

// --- Multer Storage Configuration ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Store both transaction screenshots and ticket uploads here
        cb(null, 'public/uploads'); 
    },
    filename: function (req, file, cb) {
        // Create a unique filename to prevent overwrites
        const uniqueSuffix = Date.now() + '-' + uuidv4();
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


async function startServer() {
    try {
        await client.connect();
        console.log('MongoDB connected successfully.');
        const db = client.db();

        // Make the database and upload objects available to all route handlers
        app.locals.db = db;
        app.locals.upload = upload;

        // Pass the passport and db instances to the configuration file
        require('./config/passport-setup')(passport, db);

        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        app.use(session({
            secret: SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({
                client: client,
                dbName: 'fctoz_db', // Optional: specify db name if not in URI
                collectionName: 'sessions',
                stringify: false,
            }),
            cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
        }));

        // --- Passport Middleware ---
        app.use(passport.initialize());
        app.use(passport.session());

        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, 'views'));
        app.use(express.static(path.join(__dirname, 'public')));
        
        app.use((req, res, next) => {
            res.locals.user = req.user; // Use req.user from Passport
            next();
        });

        // --- Import and Use Routers ---
        const mainRoutes = require('./routes/index');
        const authRoutes = require('./routes/auth');
        const dashboardRoutes = require('./routes/dashboard');
        const ticketsRoutes = require('./routes/ticketsRoutes'); // New tickets router

        // Mount routers correctly
        app.use('/', mainRoutes);
        app.use('/auth', authRoutes);
        app.use('/', dashboardRoutes);
        app.use('/tickets', ticketsRoutes); // Use the new tickets router

        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });

    } catch (err) {
        console.error('Failed to connect to MongoDB or start server', err);
        process.exit(1);
    }
}

startServer();
