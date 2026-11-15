import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'allow'});
test('installed app shell survives a real offline reload without market-data caching',async({page,context,browserName})=>{
 test.skip(browserName!=='chromium','Chromium installation and offline shell verification');
 await page.goto('./');
 await expect(page.locator('#tradingview-app-root')).toBeVisible();
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload(); // acquire worker control while still online
 await expect(page.locator('#tradingview-app-root')).toBeVisible();
 await context.setOffline(true);
 await page.reload();
 await expect(page.locator('#tradingview-app-root')).toBeVisible();
 await expect(page.getByText(/Offline: cached workspace may be visible/)).toBeVisible();
 await context.setOffline(false);
});