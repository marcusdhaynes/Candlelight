import {test,expect} from '@playwright/test';
import {isolateExternalFeeds} from './market-fixtures';
test.beforeEach(async({page})=>{await isolateExternalFeeds(page);});

test('malformed layout, drawing and watchlist preferences recover without a crash',async({page})=>{
  const errors:string[]=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto('./');
  await page.evaluate(()=>{
    localStorage.setItem('tv_saved_chart_layouts',JSON.stringify({notAnArray:true}));
    localStorage.setItem('tv_drawings_by_market_v1',JSON.stringify({'BTCUSD|Kraken|spot':{bad:true}}));
    localStorage.setItem('tv_chart_window_states',JSON.stringify('not-windows'));
    localStorage.setItem('tv_watchlist_details_collapsed','invalid-json');
  });
  await page.reload();
  await expect(page.locator('#tradingview-app-root')).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>localStorage.getItem('candlelight_invalid_pref_backup_tv_saved_chart_layouts'))).toBeTruthy();
  expect(await page.evaluate(()=>localStorage.getItem('candlelight_invalid_pref_backup_tv_drawings_by_market_v1'))).toBeTruthy();
  expect(await page.evaluate(()=>localStorage.getItem('candlelight_invalid_pref_backup_tv_chart_window_states'))).toBeTruthy();
});

test('broken paper ledger remains untouched and exposes a recovery backup',async({page})=>{
  const errors:string[]=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto('./');
  const damaged='{"accounts":[{"id":"broken","portfolio":{"account":{},"settings":{"startingBalance":-50}}}]}';
  await page.evaluate(value=>localStorage.setItem('candlelight_paper_accounts_v3',value),damaged);
  await page.reload();
  await expect(page.locator('#tradingview-app-root')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('candlelight_paper_accounts_v3'))).toBe(damaged);
  expect(await page.evaluate(()=>localStorage.getItem('candlelight_paper_accounts_corrupt_backup_v1'))).toBe(damaged);
  await page.getByRole('button',{name:/Paper Trading/}).first().click();
  await expect(page.getByRole('button',{name:'Export recovery backup'})).toBeVisible();
  expect(errors).toEqual([]);
});
