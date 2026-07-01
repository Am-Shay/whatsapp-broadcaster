const path = require('path');

module.exports = {
  plugins: [
    {
      name: 'visitor-email-alert-smtp',
      enabled: false,
      disabledMessage: 'visitor-email-alert-smtp is disabled — replaced by Resend integration',
      path: path.join(__dirname, '../plugins/visitor-email-alert-smtp'),
    },
  ],
};
