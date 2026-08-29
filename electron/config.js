const { app } = require('electron');

const isProduction = app.isPackaged || process.env.NODE_ENV === 'production';
const developmentApiUrl = process.env.SUPER_OPTIMIZADOR_DEV_API_URL || 'http://127.0.0.1:3000';
const productionApiUrl = process.env.SUPER_OPTIMIZADOR_API_URL || '';

module.exports = Object.freeze({
  environment: isProduction ? 'production' : 'development',
  isProduction,
  apiBaseUrl: isProduction ? productionApiUrl : developmentApiUrl,
  features: Object.freeze({
    remoteApi: Boolean(isProduction ? productionApiUrl : developmentApiUrl)
  })
});
