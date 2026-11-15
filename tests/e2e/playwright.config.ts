import {defineConfig,devices} from '@playwright/test';

const baseURL='http://127.0.0.1:4173/Candlelight/';
export default defineConfig({
  testDir:'.',
  testMatch:'**/*.spec.ts',
  timeout:40000,
  expect:{timeout:10000},
  fullyParallel:false,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?'github':'list',
  use:{
    baseURL,
    screenshot:'only-on-failure',
    trace:'retain-on-failure',
  },
  projects:[
    {name:'desktop-chrome',testIgnore:'**/mobile-smoke.spec.ts',
      use:{...devices['Desktop Chrome'],channel:'chrome',viewport:{width:1600,height:900}}},
    {name:'desktop-firefox',testIgnore:'**/mobile-smoke.spec.ts',
      use:{...devices['Desktop Firefox'],viewport:{width:1600,height:900}}},
    {name:'desktop-webkit',testIgnore:'**/mobile-smoke.spec.ts',
      use:{...devices['Desktop Safari'],viewport:{width:1600,height:900}}},
    {name:'mobile-chromium',testMatch:'**/mobile-smoke.spec.ts',
      use:{...devices['Pixel 7']}},
    {name:'mobile-webkit',testMatch:'**/mobile-smoke.spec.ts',
      use:{...devices['iPhone 13']}},
  ],
  webServer:{
    command:'pnpm run preview -- --host 127.0.0.1 --port 4173',
    env:{GITHUB_PAGES:'true'},
    cwd:'../..',
    url:baseURL,
    reuseExistingServer:!process.env.CI,
    timeout:120000,
  },
});
