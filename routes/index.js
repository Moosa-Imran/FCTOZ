const express = require('express');
const router = express.Router();

// Route for the landing page
router.get('/', (req, res) => {
    const topLeadersData = [
        { rank: 1, name: 'CryptoKing', country: 'ae', payout: 25450.00 },
        { rank: 2, name: 'TradingWhiz', country: 'us', payout: 22100.50 },
        { rank: 3, name: 'GoldMiner', country: 'za', payout: 19870.00 },
    ];
    res.render('landing', { 
        title: 'FCTOZ - Funding Crypto Organization',
        topLeaders: topLeadersData 
    });
});

module.exports = router;
