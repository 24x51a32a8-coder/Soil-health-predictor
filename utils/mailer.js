const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
}

async function sendWelcomeEmail(to, fullName) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Welcome to Soil Health Predictor 🌱',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <h2 style="color:#1b5e20;">Welcome to Soil Health Predictor, ${fullName}!</h2>
        <p>Your account has been created successfully.</p>
        <p style="color:#4e342e;"><strong>Predict. Grow. Profit.</strong></p>
        <p>You can now log in and start analyzing your soil and tracking nutrient health
        with clear, science-based fertilizer recommendations.</p>
        <p>Happy farming!<br/>— The Soil Health Predictor Team</p>
      </div>
    `
  });
}

async function sendPasswordResetEmail(to, resetLink) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Soil Health Predictor - Reset Your Password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <h2 style="color:#1b5e20;">Password Reset Request</h2>
        <p>We received a request to reset your Soil Health Predictor password.</p>
        <p><a href="${resetLink}" style="background:#2e7d32;color:#fff;padding:10px 20px;
           border-radius:6px;text-decoration:none;">Reset Password</a></p>
        <p>This link expires in 30 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `
  });
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
