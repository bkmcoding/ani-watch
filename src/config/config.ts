const config = {
  baseurl: process.env.BASE_URL || process.env.HIANIME_BASE_URL || 'https://hianime.lu',
  baseurl2: process.env.BASE_URL_2 || process.env.BASE_URL || process.env.HIANIME_BASE_URL || 'https://hianime.lu',
  origin: process.env.CORS_ORIGIN || '*',
  port: Number(process.env.PORT) || 5000,

  headers: {
    'User-Agent':
      process.env.SCRAPE_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  },

  logLevel: 'INFO',
  enableLogging: process.env.ENABLE_LOGGING === 'true',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isVercel: Boolean(process.env.VERCEL),
};

export default config;
