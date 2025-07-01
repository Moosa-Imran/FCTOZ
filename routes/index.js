const express = require('express');
const router = express.Router();

// Route for the landing page
router.get('/', (req, res) => {
  res.render('landing', { title: 'FCTOZ - Funding Crypto Organization' });
});

// Route for the new dashboard page
router.get('/dashboard', (req, res) => {
  // All data is now defined here. The EJS template will assume every field exists.
  const userData = {
    name: 'Alex Turner',
    email: 'alex.turner@example.com',
    userId: 'FCTZ-A8X4K2',
    verificationStatus: 'Verified', // Can be 'Verified', 'Unverified', 'Pending'
    accountBalance: 54329,
    profitShare: 80, // in percent
    winRate: 62.5, // in percent
    activeChallenge: {
        name: '$50k Aggressive',
        progress: 75 // in percent
    },
    recentActivity: [
        { type: 'Challenge Start', details: 'Your <strong>$50k Aggressive Challenge</strong> has been activated.', time: '5 minutes ago', icon: 'rocket', color: 'blue' },
        { type: 'Payout', details: 'Payout of <strong>$1,250.00</strong> has been processed to your USDT address.', time: '1 hour ago', icon: 'check-circle-2', color: 'green' },
        { type: 'P&L Report', details: 'Your daily P&L report for July 1st was <strong>approved</strong>.', time: '3 hours ago', icon: 'file-check', color: 'indigo' },
        { type: 'Warning', details: 'You are close to your <strong>daily drawdown limit</strong>.', time: 'Yesterday', icon: 'alert-triangle', color: 'red' }
    ],
    transactions: [
      { id: '#FCTZ-9876', type: 'Payout', date: 'Jul 1, 2025', amount: '$1,250.00', status: 'Completed' },
      { id: '#FCTZ-9875', type: 'Deposit', date: 'Jun 28, 2025', amount: '$500.00', status: 'Completed' },
      { id: '#FCTZ-9874', type: 'Challenge Fee', date: 'Jun 28, 2025', amount: '$299.00', status: 'Completed' },
      { id: '#FCTZ-9873', type: 'Withdrawal', date: 'Jun 25, 2025', amount: '$150.00', status: 'Failed' },
      { id: '#FCTZ-9872', type: 'Deposit', date: 'Jun 20, 2025', amount: '$1,000.00', status: 'Pending' }
    ]
  };
  res.render('dashboard', { title: 'FCTOZ Customer Panel', user: userData });
});

module.exports = router;
