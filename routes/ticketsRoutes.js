const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const isAuthenticated = require('../middleware/isAuthenticated');

// --- USER-FACING TICKET ROUTES ---

// GET /tickets - Display the user's tickets page
router.get('/', isAuthenticated, async (req, res) => {
    const db = req.app.locals.db;
    try {
        const tickets = await db.collection('tickets').find({ userId: req.user.userId }).sort({ lastReplyAt: -1 }).toArray();
        res.render('tickets', { title: 'Support Tickets', tickets });
    } catch (error) {
        console.error("Error fetching user tickets:", error);
        res.status(500).send("Error fetching tickets.");
    }
});

// GET /tickets/:id - Fetch details for a single ticket (for modal)
router.get('/:id', isAuthenticated, async (req, res) => {
    const db = req.app.locals.db;
    try {
        const ticket = await db.collection('tickets').findOne({ _id: new ObjectId(req.params.id), userId: req.user.userId });
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        res.json(ticket);
    } catch (error) {
        console.error("Error fetching ticket details:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /tickets/create - Create a new ticket
router.post('/create', isAuthenticated, (req, res) => {
    const upload = req.app.locals.upload;
    upload.single('attachment')(req, res, async (err) => {
        if (err) { return res.status(500).send("File upload error."); }
        
        const { subject, message } = req.body;
        const db = req.app.locals.db;

        const newTicket = {
            userId: req.user.userId,
            subject: subject,
            status: 'open',
            createdAt: new Date(),
            lastReplyAt: new Date(),
            messages: [{
                sender: 'user',
                senderId: req.user.userId,
                text: message,
                image: req.file ? req.file.filename : null,
                timestamp: new Date()
            }]
        };

        try {
            await db.collection('tickets').insertOne(newTicket);
            res.redirect('/tickets');
        } catch (error) {
            console.error("Error creating ticket:", error);
            res.status(500).send("Error creating ticket.");
        }
    });
});

// POST /tickets/reply - Add a reply to a ticket and reopen if closed
router.post('/reply', isAuthenticated, (req, res) => {
    const upload = req.app.locals.upload;
    upload.single('attachment')(req, res, async (err) => {
        if (err) { return res.status(500).send("File upload error."); }

        const { ticketId, message } = req.body;
        const db = req.app.locals.db;

        const newMessage = {
            sender: 'user',
            senderId: req.user.userId,
            text: message,
            image: req.file ? req.file.filename : null,
            timestamp: new Date()
        };

        try {
            const ticket = await db.collection('tickets').findOne({ _id: new ObjectId(ticketId), userId: req.user.userId });
            if (!ticket) {
                return res.status(404).send("Ticket not found.");
            }

            const updateQuery = {
                $push: { messages: newMessage },
                $set: { 
                    lastReplyAt: new Date(), 
                    status: 'open' // Always set to open on user reply
                } 
            };

            await db.collection('tickets').updateOne({ _id: new ObjectId(ticketId) }, updateQuery);
            res.redirect('/tickets');
        } catch (error) {
            console.error("Error replying to ticket:", error);
            res.status(500).send("Error replying to ticket.");
        }
    });
});

module.exports = router;
