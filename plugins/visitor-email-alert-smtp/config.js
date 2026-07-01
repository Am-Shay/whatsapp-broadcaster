module.exports = {
  enabled: true,
  adminEmail: process.env.ADMIN_EMAIL,
  emailFrom: process.env.EMAIL_FROM,
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};
