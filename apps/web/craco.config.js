const path = require('node:path');

const workspacePackages = path.resolve(__dirname, '../../packages');

module.exports = {
  webpack: {
    configure: (config) => {
      config.module.rules.unshift({
        test: /\.js$/,
        include: workspacePackages,
        resolve: { fullySpecified: false },
      });
      return config;
    },
  },
};
