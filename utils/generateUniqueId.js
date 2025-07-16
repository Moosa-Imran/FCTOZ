const crypto = require('crypto');

/**
 * Generates a unique user ID in the format FCTZ-XXXXXX.
 * This function creates a short, random alphanumeric hash and ensures
 * that it does not already exist in the users collection in the database.
 * It will loop until a unique ID is successfully generated.
 * @param {Db} db - The MongoDB database instance from req.app.locals.db.
 * @returns {Promise<string>} A unique user ID (e.g., "FCTZ-A1B2C3").
 */
async function generateUniqueId(db) {
    let isUnique = false;
    let uniqueId;

    // Loop until a unique ID is found
    while (!isUnique) {
        // Generate a 6-character alphanumeric hash from random bytes
        const hash = crypto.randomBytes(3).toString('hex').toUpperCase();
        uniqueId = `FCTZ-${hash}`;

        // Check the database to see if a user with this ID already exists
        const existingUser = await db.collection('users').findOne({ userId: uniqueId });
        
        // If no user is found with this ID, it's unique
        if (!existingUser) {
            isUnique = true;
        }
    }
    return uniqueId;
}

module.exports = generateUniqueId;
