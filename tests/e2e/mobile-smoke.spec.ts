import {test,expect} from '@playwright/test';

test('narrow-screen application launches without a fatal browser exception',async ({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('#tradingview-app-root')).toBeVisible();
  await expect(page.locator('#tradingview-right-icon-bar')).toBeAttached();
  expect(errors).toEqual([]);
});
