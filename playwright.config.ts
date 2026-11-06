import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/mobile',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      "node -e \"import('./build-vercel.mjs').then(()=>import('node:http')).then(async h=>{const {default:m}=await import('./api/index.js');h.createServer(m).listen(3000,()=>console.log('Ready on port 3000'));})\"",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'Pixel 7',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iPhone 14',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'Mobile Landscape',
      use: {
        viewport: { width: 844, height: 390 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
});
