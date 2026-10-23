import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'.',
  testMatch:'**/*.spec.ts',
  timeout:30000,
  expect:{timeout:10000},
  fullyParallel:false,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?'github':'list',
  use:{
    ...devices['Desktop Chrome'],
    channel:'chrome',
    baseURL:'http://127.0.0.1:4173/Candlelight/',
    viewport:{width:1600,height:900},
    screenshot:'only-on-failure',
    trace:'retain-on-failure',
  },
  webServer:{
    command:'pnpm run preview -- --host 127.0.0.1 --port 4173',
    env:{GITHUB_PAGES:'true'},
    cwd:'../..',
    url:'http://127.0.0.1:4173/Candlelight/',
    reuseExistingServer:!process.env.CI,
    timeout:120000,
  },
});
