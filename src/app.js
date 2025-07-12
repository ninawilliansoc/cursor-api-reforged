const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const app = express();

const config = require('./config/config');
const routes = require('./routes');

// Import models
const tokenModel = require('./models/token');
const adminModel = require('./models/admin');
const authCookieModel = require('./models/authCookie');
const cookieRotation = require('./services/cookieRotation');

// Ensure data directory and files exist
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory:', dataDir);
}

// Ensure authCookies.json file exists
const authCookiesFile = path.join(dataDir, 'authCookies.json');
if (!fs.existsSync(authCookiesFile)) {
    fs.writeFileSync(authCookiesFile, JSON.stringify([], null, 2));
    console.log('Created empty authCookies.json file');
    
    // If auth cookies are defined in environment variables, import them
    if (config.auth.cookies && config.auth.cookies.length > 0) {
        console.log(`Found ${config.auth.cookies.length} auth cookies in environment variables, importing...`);
        config.auth.cookies.forEach((cookieValue, index) => {
            try {
                const cookieName = `ENV_COOKIE_${index + 1}`;
                authCookieModel.createAuthCookie(
                    cookieName,
                    cookieValue,
                    'Imported from environment variables on startup',
                    true
                );
                console.log(`Imported cookie ${cookieName} from environment variables`);
            } catch (error) {
                console.error(`Error importing cookie from environment variables:`, error.message);
            }
        });
    }
}

// Import middleware creators
const createRateLimitMiddleware = require('./middleware/rateLimit');
const { createQueueMiddleware } = require('./services/queueService');
const { createAuthMiddleware } = require('./middleware/auth');

// Create middleware instances
const rateLimitMiddleware = createRateLimitMiddleware(tokenModel);
const queueMiddleware = createQueueMiddleware(tokenModel);
const authMiddleware = createAuthMiddleware(tokenModel);

// Initialize the owner account
const { ownerUser, ownerPassword } = config.admin;
adminModel.initializeOwner(ownerUser, ownerPassword);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(morgan(process.env.MORGAN_FORMAT ?? 'tiny'));

// Configure session middleware
const sessionSecret = process.env.SESSION_SECRET || 'cursor-proxy-secret-key';
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Apply API middleware to all routes except admin routes
app.use((req, res, next) => {
    if (!req.path.startsWith('/admin')) {
        // Apply API middleware in the correct order
        authMiddleware(req, res, (err) => {
            if (err) return next(err);
            rateLimitMiddleware(req, res, (err) => {
                if (err) return next(err);
                queueMiddleware(req, res, next);
            });
        });
    } else {
        next();
    }
});

app.use("/", routes);

app.listen(config.port, () => {
    console.log(`Server listening on port: ${config.port}`);
    console.log(`Admin panel available at: http://localhost:${config.port}/admin`);
    
    // Start the cookie rotation timer
    cookieRotation.startCookieRotationTimer();
    console.log('Cookie rotation timer started with 30-second interval');
});
