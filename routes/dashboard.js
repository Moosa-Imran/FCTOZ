const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const isAuthenticated = require('../middleware/isAuthenticated');
const sendEmail = require('../utils/emailService'); // Import the email service

// Route for the dashboard page
router.get('/dashboard', isAuthenticated, (req, res) => {
  const userData = {
    name: req.user.fullName,
    email: req.user.email,
    userId: req.user.userId,
    verificationStatus: 'Verified',
    accountBalance: 54329,
    profitShare: 80,
    winRate: 62.5,
    activeChallenge: {
      name: '$50k Aggressive',
      progress: 75
    },
    recentActivity: [
      { type: 'Challenge Start', details: 'Your <strong>$50k Aggressive Challenge</strong> has been activated.', time: '5 minutes ago', icon: 'rocket', color: 'blue' },
      { type: 'Payout', details: 'Payout of <strong>$1,250.00</strong> has been processed to your USDT address.', time: '1 hour ago', icon: 'check-circle-2', color: 'green' },
    ],
    transactions: [
      { id: '#FCTZ-9876', type: 'Payout', date: 'Jul 1, 2025', amount: '$1,250.00', status: 'Completed' },
      { id: '#FCTZ-9875', type: 'Deposit', date: 'Jun 28, 2025', amount: '$500.00', status: 'Completed' },
    ]
  };
  const success = req.session.success || null;
  delete req.session.success;
  res.render('dashboard', { title: 'FCTOZ Customer Panel', user: userData, success });
});

// Route for the "My Challenges" page
router.get('/challenges', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user.userId;

        const semiActiveChallenges = await db.collection('transactions').find({
            userId: userId,
            status: { $in: ['awaiting_credentials', 'credentials_pending', 'credentials_rejected'] }
        }).sort({ createdAt: -1 }).toArray();
        
        const pendingChallenges = await db.collection('transactions').find({ 
            userId: userId, 
            status: 'pending' 
        }).sort({ createdAt: -1 }).toArray();

        const userChallenges = await db.collection('challenges').aggregate([
            { $match: { userId: userId } }, { $sort: { startDate: -1 } },
            { $lookup: { from: 'plans', localField: 'planId', foreignField: '_id', as: 'planDetails' } },
            { $unwind: '$planDetails' }
        ]).toArray();
        
        const activeChallenges = [];
        const pastChallenges = [];
        userChallenges.forEach(challenge => {
            if (challenge.status === 'active' || challenge.status === 'passed') {
                const plan = challenge.planDetails;
                const accountSize = plan.accountSize;
                const totalProfitTarget = (plan.profitTarget * plan.minTradingDays / 100) * accountSize;
                const profitTargetMet = challenge.totalProfit >= totalProfitTarget;
                const minDaysMet = challenge.tradingDays >= plan.minTradingDays;
                let progressPercentage = totalProfitTarget > 0 ? (challenge.totalProfit / totalProfitTarget) * 100 : 0;
                if (profitTargetMet && !minDaysMet && challenge.status === 'active') { progressPercentage = 99; }
                challenge.progressPercentage = Math.min(progressPercentage, 100).toFixed(2);
                challenge.isPayoutEligible = challenge.status === 'passed';
                const maxTradingDays = plan.timeLimit || plan.minTradingDays;
                challenge.metrics = [
                    { name: 'Profit Target', current: `$${challenge.totalProfit.toLocaleString('en-US', {minimumFractionDigits: 2})}`, value: `$${totalProfitTarget.toLocaleString('en-US', {minimumFractionDigits: 2})}` },
                    { name: challenge.tradingDays >= plan.minTradingDays ? 'Trading Days' : 'Min. Trading Days', current: `${challenge.tradingDays}`, value: `${challenge.tradingDays >= plan.minTradingDays ? maxTradingDays : plan.minTradingDays} Days`, isPending: profitTargetMet && !minDaysMet }
                ];
                activeChallenges.push(challenge);
            } else {
                pastChallenges.push(challenge);
            }
        });

        const rejectedTransactions = await db.collection('transactions').find({ userId: userId, status: 'rejected' }).sort({ createdAt: -1 }).toArray();
        const finalPastChallenges = [...pastChallenges, ...rejectedTransactions].sort((a, b) => new Date(b.completionDate || b.createdAt) - new Date(a.completionDate || a.createdAt));

        res.render('challenges', { 
            title: 'My Challenges - FCTOZ',
            semiActiveChallenges,
            pendingChallenges,
            activeChallenges,
            pastChallenges: finalPastChallenges
        });
    } catch (error) {
        console.error("Error fetching user challenges:", error);
        res.status(500).send("Internal Server Error");
    }
});

// POST route for submitting credentials
router.post('/challenges/submit-credentials', isAuthenticated, async (req, res) => {
    const { transactionId, tradingViewEmail, tradingViewPassword } = req.body;
    const db = req.app.locals.db;
    const userId = req.user.userId;

    if (!transactionId || !tradingViewEmail || !tradingViewPassword || !ObjectId.isValid(transactionId)) {
        return res.status(400).send("Invalid data provided.");
    }

    try {
        await db.collection('transactions').updateOne(
            { _id: new ObjectId(transactionId), userId: userId },
            {
                $set: {
                    status: 'credentials_pending',
                    tradingViewEmail: tradingViewEmail,
                    tradingViewPassword: tradingViewPassword,
                    updatedAt: new Date()
                }
            }
        );
        res.redirect('/challenges');
    } catch (error) {
        console.error("Error submitting credentials:", error);
        res.status(500).send("Internal Server Error");
    }
});

// GET Route for the "P&L Reports" page
router.get('/reports', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user.userId;
        let activeChallenges = await db.collection('challenges').aggregate([
            { $match: { userId: userId, status: 'active' } },
            { $lookup: { from: 'plans', localField: 'planId', foreignField: '_id', as: 'planDetails' } },
            { $unwind: '$planDetails' }
        ]).toArray();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        activeChallenges = activeChallenges.map(challenge => {
            const lastUpdate = new Date(challenge.lastUserUpdate);
            lastUpdate.setHours(0, 0, 0, 0);
            return {
                ...challenge,
                submittedToday: lastUpdate.getTime() === today.getTime()
            };
        });
        const reportHistory = await db.collection('reports').aggregate([
            { $match: { userId: userId } }, { $sort: { createdAt: -1 } },
            { $lookup: { from: 'challenges', localField: 'challengeId', foreignField: '_id', as: 'challengeDetails' } },
            { $unwind: { path: '$challengeDetails', preserveNullAndEmptyArrays: true } }
        ]).toArray();
        res.render('reports', {
            title: 'P&L Reports - FCTOZ',
            activeChallenges: activeChallenges,
            reports: reportHistory
        });
    } catch (error) {
        console.error("Error fetching reports page data:", error);
        res.status(500).send("Internal Server Error");
    }
});

// POST Route to submit a new P&L Report
router.post('/reports/submit', isAuthenticated, (req, res) => {
    const upload = req.app.locals.upload;
    upload.single('pnl-screenshot')(req, res, async function (err) {
        if (err) { return res.status(500).send("File upload error."); }
        if (!req.file) { return res.status(400).send("Screenshot is required."); }

        const { reportType, pnlAmount, challengeId, notes } = req.body;
        const db = req.app.locals.db;
        const userId = req.user.userId;

        if (!reportType || !challengeId || !ObjectId.isValid(challengeId)) {
            return res.status(400).send("Invalid form data.");
        }

        const amount = reportType === 'no-gain' ? 0 : parseFloat(pnlAmount);
        if (isNaN(amount)) { return res.status(400).send("Invalid P&L amount."); }

        try {
            const challenge = await db.collection('challenges').findOne({ _id: new ObjectId(challengeId), userId: userId });
            if (!challenge) { return res.status(404).send("Active challenge not found."); }
            const plan = await db.collection('plans').findOne({ _id: challenge.planId });
            if (!plan) { return res.status(404).send("Challenge plan details not found."); }

            if (challenge.tradingDays + 1 > plan.timeLimit) {
                const newReport = { userId, challengeId: new ObjectId(challengeId), reportType, pnlAmount: amount, notes, screenshotFile: req.file.filename, status: 'approved', remarks: 'Time limit exceeded.', createdAt: new Date() };
                await db.collection('reports').insertOne(newReport);
                await db.collection('challenges').updateOne({ _id: new ObjectId(challengeId) }, { $set: { status: 'failed', reason: 'Time limit exceeded.', completionDate: new Date(), updatedAt: new Date(), lastUserUpdate: new Date() }, $inc: { totalProfit: amount, tradingDays: 1 } });
                req.session.error = { msg: "Challenge failed: You have exceeded the maximum time limit." };
                return res.redirect('/challenges');
            }

            if (reportType === 'loss') {
                const dailyLossLimit = (plan.dailyLoss / 100) * plan.accountSize;
                if (Math.abs(amount) > dailyLossLimit) {
                    const newReport = { userId, challengeId: new ObjectId(challengeId), reportType, pnlAmount: amount, notes, screenshotFile: req.file.filename, status: 'approved', remarks: 'Daily loss limit exceeded.', createdAt: new Date() };
                    await db.collection('reports').insertOne(newReport);
                    await db.collection('challenges').updateOne({ _id: new ObjectId(challengeId) }, { $set: { status: 'failed', reason: 'Daily loss limit hit.', completionDate: new Date(), updatedAt: new Date(), lastUserUpdate: new Date() }, $inc: { totalProfit: amount, tradingDays: 1 } });
                    req.session.error = { msg: "Challenge failed: Your submitted loss exceeded the daily loss limit." };
                    return res.redirect('/challenges');
                }
            }

            const newReport = { userId, challengeId: new ObjectId(challengeId), reportType, pnlAmount: amount, notes, screenshotFile: req.file.filename, status: 'pending', createdAt: new Date() };
            await db.collection('reports').insertOne(newReport);
            await db.collection('challenges').updateOne({ _id: new ObjectId(challengeId) }, { $set: { lastUserUpdate: new Date() } });
            req.session.success = { msg: "Your P&L report has been submitted successfully." };
            res.redirect('/reports');
        } catch (error) {
            console.error("Error submitting P&L report:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});

// Route for the "Payouts" page
router.get('/payouts', isAuthenticated, (req, res) => {
  const payoutData = {
    payoutAddresses: [ { id: 'PA-1', type: 'USDT (TRC20)', address: 'TXYZ...abcd', dateAdded: 'June 15, 2025', isPrimary: true }, ],
    payoutHistory: [ { id: 'PO-123', date: 'July 1, 2025', amount: 1250.00, address: 'TXYZ...abcd', status: 'Completed' }, ]
  };
  res.render('payouts', { title: 'Payouts - FCTOZ', payouts: payoutData });
});

// Route for the "Leaderboard" page
router.get('/leaderboard', isAuthenticated, (req, res) => {
  const leaderboardData = [ { rank: 1, name: 'CryptoKing', country: 'ae', payout: 25450.00 }, { rank: 2, name: 'TradingWhiz', country: 'us', payout: 22100.50 }, ];
  const currentUserData = { rank: 121, name: req.user.fullName, country: 'pk', payout: 8500.00 };
  res.render('leaderboard', { title: 'Leaderboard - FCTOZ', leaders: leaderboardData, currentUser: currentUserData });
});

// Route for the "FCTOZ Academy" page
router.get('/academy', isAuthenticated, (req, res) => {
    const academyData = { featuredArticle: { id: 'A1', title: 'Mastering Risk', category: 'Risk Management', author: 'Admin', date: 'July 4, 2025', readTime: '8 min read', imageUrl: 'https://placehold.co/800x400/a16207/white?text=Mastering+Risk', excerpt: '...' }, articles: [] };
    res.render('academy', { title: 'FCTOZ Academy', academy: academyData });
});

// Route for the Account Settings page
router.get('/settings', isAuthenticated, async (req, res) => {
    const db = req.app.locals.db;
    try {
        const userFromDb = await db.collection('users').findOne({ userId: req.user.userId });
        const settingsData = { user: { name: userFromDb.fullName, email: userFromDb.email, userId: userFromDb.userId, isVerified: true, twoFactorEnabled: false, hasPassword: !!userFromDb.password, isGoogleUser: !!userFromDb.googleId } };
        const errors = req.session.errors || [];
        const success = req.session.success || null;
        delete req.session.errors;
        delete req.session.success;
        res.render('settings', { title: 'Account Settings - FCTOZ', settings: settingsData, errors, success });
    } catch (error) {
        console.error("Error fetching user for settings:", error);
        res.redirect('/dashboard');
    }
});

// Handle password updates
router.post('/settings/password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const db = req.app.locals.db;
    const user = await db.collection('users').findOne({ userId: req.user.userId });
    let errors = [];
    if (user.password && user.password !== currentPassword) { errors.push({ msg: "Current password is incorrect." }); }
    if (!newPassword || newPassword !== confirmPassword) { errors.push({ msg: "New passwords do not match." }); }
    if(newPassword.length < 8) { errors.push({ msg: "New password must be at least 8 characters long."}) }
    if (errors.length > 0) {
        req.session.errors = errors;
        return res.redirect('/settings');
    }
    await db.collection('users').updateOne({ userId: req.user.userId }, { $set: { password: newPassword } });
    req.session.success = { msg: "Password updated successfully." };
    res.redirect('/settings');
});

// Route for the New Challenge page
router.get('/new-challenge', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const plansData = await db.collection('plans').find().sort({ price: 1 }).toArray();
        res.render('new_challenge', { title: 'Start New Challenge - FCTOZ', plans: plansData });
    } catch (error) {
        console.error("Error fetching challenge plans:", error);
        res.render('new_challenge', { title: 'Start New Challenge - FCTOZ', plans: [] });
    }
});

// GET route to display the checkout page
router.get('/checkout/:planId', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const planId = req.params.planId;
        if (!ObjectId.isValid(planId)) { return res.status(400).send('Invalid Plan ID'); }
        const plan = await db.collection('plans').findOne({ _id: new ObjectId(planId) });
        if (!plan) { return res.status(404).send('Plan not found'); }
        res.render('checkout', { title: 'Checkout - FCTOZ', plan: plan });
    } catch (error) {
        console.error("Error fetching plan for checkout:", error);
        res.status(500).send("Internal Server Error");
    }
});

// POST route to handle the checkout form submission
router.post('/checkout/submit', isAuthenticated, (req, res) => {
    const upload = req.app.locals.upload;
    upload.single('ss')(req, res, async function (err) {
        if (err) { console.error("File upload error:", err); return res.redirect('back'); }
        const { transactionHash, planId } = req.body;
        const db = req.app.locals.db;
        try {
            if (!ObjectId.isValid(planId)) { return res.status(400).send('Invalid Plan ID'); }
            const plan = await db.collection('plans').findOne({ _id: new ObjectId(planId) });
            if (!plan) { return res.status(404).send('Plan not found'); }
            const newTransaction = { userId: req.user.userId, planId: new ObjectId(planId), planName: plan.name, planAmount: plan.price, transactionHash: transactionHash, ss: req.file ? req.file.filename : null, status: 'pending', createdAt: new Date() };
            
            const result = await db.collection('transactions').insertOne(newTransaction);
            
            // --- SEND CONFIRMATION EMAIL ---
            const subject = 'Your FCTOZ Submission has been Received';
            const emailData = {
                subject: subject,
                userName: req.user.fullName,
                transactionId: result.insertedId.toString().slice(-6).toUpperCase(),
                planName: plan.name,
                amount: plan.price
            };
            await sendEmail(req.user.email, subject, 'submission-received', emailData);

            req.session.success = { msg: "Your payment proof has been submitted successfully and is under review." };
            res.redirect('/challenges');
        } catch (error) {
            console.error("Error submitting transaction:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});

module.exports = router;
