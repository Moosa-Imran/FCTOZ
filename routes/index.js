const express = require('express');
const router = express.Router();

// Route for the landing page
router.get('/', (req, res) => {
  res.render('landing', { title: 'FCTOZ - Funding Crypto Organization' });
});

// Route for the dashboard page
router.get('/dashboard', (req, res) => {
  const userData = {
    name: 'Hamza Crypto',
    email: 'hamza@example.com',
    userId: 'FCTZ-A8X4K2',
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

// NEW: Route for the "My Challenges" page
router.get('/challenges', (req, res) => {
  const challengeData = {
    activeChallenge: {
      id: 'CHL-ACTIVE-001',
      name: '$50k Aggressive Challenge',
      accountSize: 50000,
      status: 'Active',
      startDate: 'June 15, 2025',
      endDate: 'July 15, 2025',
      progress: 75,
      metrics: [
        { name: 'Profit Target', value: '$5,000', current: '$3,750', status: 'on-track' },
        { name: 'Max Daily Loss', value: '$2,500', current: '$850', status: 'safe' },
        { name: 'Max Overall Loss', value: '$5,000', current: '$1,200', status: 'safe' },
        { name: 'Minimum Trading Days', value: '10 days', current: '12 days', status: 'complete' }
      ]
    },
    pastChallenges: [
      {
        id: 'CHL-PAST-002',
        name: '$25k Standard Challenge',
        accountSize: 25000,
        status: 'Passed',
        completionDate: 'May 10, 2025',
        payout: 1850.75
      },
      {
        id: 'CHL-PAST-001',
        name: '$10k Evaluation',
        accountSize: 10000,
        status: 'Failed',
        completionDate: 'April 5, 2025',
        reason: 'Max overall loss exceeded.'
      }
    ]
  };
  res.render('challenges', { title: 'My Challenges - FCTOZ', challenges: challengeData });
});

// NEW: Route for the "P&L Reports" page
router.get('/reports', (req, res) => {
  const reportData = {
    submissions: [
      { date: 'July 1, 2025', submittedPL: 450.25, status: 'Approved', remarks: 'Good risk management.' },
      { date: 'June 30, 2025', submittedPL: -150.80, status: 'Approved', remarks: '' },
      { date: 'June 29, 2025', submittedPL: 2050.10, status: 'Rejected', remarks: 'Unusual trade volume. Please provide trade history for review.' },
      { date: 'June 28, 2025', submittedPL: 300.00, status: 'Pending', remarks: '' },
    ]
  };
  res.render('reports', { title: 'P&L Reports - FCTOZ', reports: reportData });
});

// NEW: Route for the "Payouts" page
router.get('/payouts', (req, res) => {
  const payoutData = {
    payoutAddresses: [
      { id: 'PA-1', type: 'USDT (TRC20)', address: 'TXYZ...abcd', dateAdded: 'June 15, 2025', isPrimary: true },
      { id: 'PA-2', type: 'BTC', address: 'bc1q...wxyz', dateAdded: 'May 20, 2025', isPrimary: false },
      { id: 'PA-3', type: 'Binance ID', address: '123456789', dateAdded: 'April 10, 2025', isPrimary: false },
    ],
    payoutHistory: [
      { id: 'PO-123', date: 'July 1, 2025', amount: 1250.00, address: 'TXYZ...abcd', status: 'Completed' },
      { id: 'PO-122', date: 'June 1, 2025', amount: 980.50, address: 'TXYZ...abcd', status: 'Completed' },
      { id: 'PO-121', date: 'May 1, 2025', amount: 1850.75, address: 'TXYZ...abcd', status: 'Completed' },
    ]
  };
  res.render('payouts', { title: 'Payouts - FCTOZ', payouts: payoutData });
});

// NEW: Route for the "Leaderboard" page
router.get('/leaderboard', (req, res) => {
  const leaderboardData = [
    { rank: 1, name: 'CryptoKing', country: 'AE', payout: 25450.00 },
    { rank: 2, name: 'TradingWhiz', country: 'US', payout: 22100.50 },
    { rank: 3, name: 'Hamza Crypto', country: 'PK', payout: 19870.00 },
    { rank: 4, name: 'ScalperPro', country: 'GB', payout: 18500.00 },
    { rank: 5, name: 'LunaQueen', country: 'KR', payout: 17950.25 },
    { rank: 6, name: 'BitcoinBULL', country: 'DE', payout: 16200.00 },
    { rank: 7, name: 'EthEvangelist', country: 'CA', payout: 15150.80 },
    { rank: 8, name: 'TheOracle', country: 'IN', payout: 14900.00 },
    { rank: 9, name: 'ProfitProphet', country: 'AU', payout: 13500.00 },
    { rank: 10, name: 'MarginMaster', country: 'JP', payout: 12800.75 },
  ];
  res.render('leaderboard', { title: 'Leaderboard - FCTOZ', leaders: leaderboardData });
});

// NEW: Route for the "FCTOZ Academy" page
router.get('/academy', (req, res) => {
    const academyData = {
        categories: ['Blockchain Education', 'Risk Management', 'Web3', 'NFTs', 'Success Stories'],
        articles: [
            { 
                id: 'A1',
                title: 'Mastering Risk: The Key to Consistent Profits', 
                category: 'Risk Management', 
                author: 'Admin', 
                date: 'June 28, 2025', 
                readTime: '8 min read',
                imageUrl: 'https://placehold.co/600x400/a16207/white?text=Risk+Mgmt'
            },
            { 
                id: 'A2',
                title: 'An Introduction to Decentralized Finance (DeFi)', 
                category: 'Blockchain Education', 
                author: 'Admin', 
                date: 'June 25, 2025', 
                readTime: '12 min read',
                imageUrl: 'https://placehold.co/600x400/1d4ed8/white?text=DeFi'
            },
            { 
                id: 'A3',
                title: 'From $1k to $50k: A Trader\'s Journey', 
                category: 'Success Stories', 
                author: 'Admin', 
                date: 'June 22, 2025', 
                readTime: '6 min read',
                imageUrl: 'https://placehold.co/600x400/166534/white?text=Success'
            },
        ]
    };
    res.render('academy', { title: 'FCTOZ Academy', academy: academyData });
});

// NEW: Route for the "Support Tickets" page
router.get('/tickets', (req, res) => {
    const ticketData = {
        activeTickets: [
            { id: 'TKT-78901', subject: 'Question about payout schedule', status: 'Active', lastUpdate: '2 hours ago', responseTime: '8-12 hours' }
        ],
        closedTickets: [
            { id: 'TKT-78900', subject: 'KYC Verification Delay', status: 'Resolved', lastUpdate: '3 days ago' },
            { id: 'TKT-78899', subject: 'Failed Deposit', status: 'Closed', lastUpdate: '1 week ago' },
        ]
    };
    res.render('tickets', { title: 'Support Tickets - FCTOZ', tickets: ticketData });
});

// NEW: Route for the "Account Settings" page
router.get('/settings', (req, res) => {
    const settingsData = {
        user: {
            name: 'Hamza Crypto',
            email: 'hamza@example.com',
            userId: 'FCTZ-A8X4K2',
            isVerified: true,
            twoFactorEnabled: false
        }
    };
    res.render('settings', { title: 'Account Settings - FCTOZ', settings: settingsData });
});


module.exports = router;
