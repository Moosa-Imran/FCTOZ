const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

// 1. Create a transporter object using Namecheap's SMTP settings
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * A generic function to send an email.
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} template - The name of the EJS template file (e.g., 'challenge-status').
 * @param {object} data - The data to pass to the EJS template.
 */
const sendEmail = async (to, subject, template, data) => {
    try {
        // Render the EJS template to an HTML string
        const html = await ejs.renderFile(
            path.join(__dirname, `../views/emails/${template}.ejs`), 
            data
        );

        // 2. Define the email options
        const mailOptions = {
            from: `"FCTOZ" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html,
        };

        // 3. Send the email
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}`);

    } catch (error) {
        console.error('Error sending email:', error);
    }
};

module.exports = sendEmail;
