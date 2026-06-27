const path = require('path');

module.exports = {
  plugins: [
    {
      name: 'visitor-email-alert',
      enabled: true,
      path: path.join(__dirname, '../plugins/visitor-email-alert'),
    },
  ],
};
