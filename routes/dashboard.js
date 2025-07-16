const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const isAuthenticated = require('../middleware/isAuthenticated');

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
        const pendingChallenges = await db.collection('transactions').find({ userId: userId, status: 'pending' }).sort({ createdAt: -1 }).toArray();
        const userChallenges = await db.collection('challenges').aggregate([
            { $match: { userId: userId } }, { $sort: { startDate: -1 } },
            { $lookup: { from: 'plans', localField: 'planId', foreignField: '_id', as: 'planDetails' } },
            { $unwind: '$planDetails' }
        ]).toArray();
        const rejectedTransactions = await db.collection('transactions').find({ userId: userId, status: 'rejected' }).sort({ createdAt: -1 }).toArray();
        const activeChallenges = [];
        const pastChallenges = [];
        userChallenges.forEach(challenge => {
            const plan = challenge.planDetails;
            const accountSize = plan.accountSize;
            const totalProfitTarget = (plan.profitTarget * plan.minTradingDays / 100) * accountSize;
            if (challenge.status === 'active' || challenge.status === 'passed') {
                const profitTargetMet = challenge.totalProfit >= totalProfitTarget;
                const minDaysMet = challenge.tradingDays >= plan.minTradingDays;
                let progressPercentage = totalProfitTarget > 0 ? (challenge.totalProfit / totalProfitTarget) * 100 : 0;
                if (profitTargetMet && !minDaysMet && challenge.status === 'active') { progressPercentage = 99; }
                challenge.progressPercentage = Math.min(progressPercentage, 100).toFixed(2);
                challenge.isPayoutEligible = challenge.status === 'passed';
                const maxTradingDays = parseInt(plan.timeLimit, 10) || plan.minTradingDays;
                challenge.metrics = [
                    { name: 'Profit Target', current: `$${challenge.totalProfit.toLocaleString('en-US', {minimumFractionDigits: 2})}`, value: `$${totalProfitTarget.toLocaleString('en-US', {minimumFractionDigits: 2})}` },
                    { name: challenge.tradingDays >= plan.minTradingDays ? 'Trading Days' : 'Min. Trading Days', current: `${challenge.tradingDays}`, value: `${challenge.tradingDays >= plan.minTradingDays ? maxTradingDays : plan.minTradingDays} Days` }
                ];
                activeChallenges.push(challenge);
            } else { pastChallenges.push(challenge); }
        });
        const finalPastChallenges = [...pastChallenges, ...rejectedTransactions].sort((a, b) => new Date(b.completionDate || b.createdAt) - new Date(a.completionDate || a.createdAt));
        res.render('challenges', { title: 'My Challenges - FCTOZ', activeChallenges, pendingChallenges, pastChallenges: finalPastChallenges });
    } catch (error) {
        console.error("Error fetching user challenges:", error);
        res.status(500).send("Internal Server Error");
    }
});

// GET Route for the "P&L Reports" page
router.get('/reports', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user.userId;
        const activeChallenges = await db.collection('challenges').aggregate([
            { $match: { userId: userId, status: 'active' } },
            { $lookup: { from: 'plans', localField: 'planId', foreignField: '_id', as: 'planDetails' } },
            { $unwind: '$planDetails' }
        ]).toArray();
        const reportHistory = await db.collection('reports').find({ userId: userId }).sort({ createdAt: -1 }).toArray();
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
        if (err) {
            return res.status(500).send("File upload error.");
        }
        if (!req.file) {
            return res.status(400).send("Screenshot is required.");
        }

        const { reportType, pnlAmount, challengeId, notes } = req.body;
        const db = req.app.locals.db;
        const userId = req.user.userId;

        if (!reportType || !challengeId || !ObjectId.isValid(challengeId)) {
            return res.status(400).send("Invalid form data.");
        }

        const amount = reportType === 'no-gain' ? 0 : parseFloat(pnlAmount);
        if (isNaN(amount)) {
            return res.status(400).send("Invalid P&L amount.");
        }

        try {
            const newReport = {
                userId: userId,
                challengeId: new ObjectId(challengeId),
                reportType: reportType,
                pnlAmount: amount,
                notes: notes || '',
                screenshotFile: req.file.filename,
                status: 'pending',
                createdAt: new Date()
            };
            await db.collection('reports').insertOne(newReport);

            // Update only the lastUserUpdate field in the corresponding challenge
            await db.collection('challenges').updateOne(
                { _id: new ObjectId(challengeId), userId: userId },
                {
                    $set: { lastUserUpdate: new Date() }
                }
            );

            req.session.success = { msg: "Your P&L report has been submitted successfully." };
            res.redirect('/reports');

        } catch (error) {
            console.error("Error submitting P&L report:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});

// Other routes
router.get('/payouts', isAuthenticated, (req, res) => {
  const payoutData = {
    payoutAddresses: [ { id: 'PA-1', type: 'USDT (TRC20)', address: 'TXYZ...abcd', dateAdded: 'June 15, 2025', isPrimary: true }, ],
    payoutHistory: [ { id: 'PO-123', date: 'July 1, 2025', amount: 1250.00, address: 'TXYZ...abcd', status: 'Completed' }, ]
  };
  res.render('payouts', { title: 'Payouts - FCTOZ', payouts: payoutData });
});
router.get('/leaderboard', isAuthenticated, (req, res) => {
  const leaderboardData = [ { rank: 1, name: 'CryptoKing', country: 'ae', payout: 25450.00 }, { rank: 2, name: 'TradingWhiz', country: 'us', payout: 22100.50 }, ];
  const currentUserData = { rank: 121, name: req.user.fullName, country: 'pk', payout: 8500.00 };
  res.render('leaderboard', { title: 'Leaderboard - FCTOZ', leaders: leaderboardData, currentUser: currentUserData });
});
router.get('/academy', isAuthenticated, (req, res) => {
    const academyData = { featuredArticle: { id: 'A1', title: 'Mastering Risk', category: 'Risk Management', author: 'Admin', date: 'July 4, 2025', readTime: '8 min read', imageUrl: 'https://placehold.co/800x400/a16207/white?text=Mastering+Risk', excerpt: '...' }, articles: [] };
    res.render('academy', { title: 'FCTOZ Academy', academy: academyData });
});
router.get('/tickets', isAuthenticated, (req, res) => {
    const ticketData = { activeTickets: [{ id: 'TKT-78901', subject: 'Question about payout schedule', status: 'Active', lastUpdate: '2 hours ago', responseTime: '8-12 hours' }], closedTickets: [] };
    res.render('tickets', { title: 'Support Tickets - FCTOZ', tickets: ticketData });
});
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
            await db.collection('transactions').insertOne(newTransaction);
            req.session.success = { msg: "Your payment proof has been submitted successfully and is under review." };
            res.redirect('/challenges');
        } catch (error) {
            console.error("Error submitting transaction:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});

module.exports = router;
