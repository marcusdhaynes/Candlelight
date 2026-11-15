import {test,expect} from '@playwright/test';

test('legacy watchlist changes migrate once and persist across reloads',async ({page})=>{
  await page.goto('./');
  await page.evaluate(()=>{
    localStorage.setItem('tv_watchlists',JSON.stringify([{
      id:'round01-legacy',name:'Round 01 Persisted',symbols:['BTCUSD'],isCustom:true,
    }]));
    localStorage.removeItem('tv_watchlists_v4');
  });
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(
    localStorage.getItem('tv_watchlists_v4')||'[]')[0]?.name)).toBe('Round 01 Persisted');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('tv_watchlists'))).toBeNull();
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(
    localStorage.getItem('tv_watchlists_v4')||'[]')[0]?.name)).toBe('Round 01 Persisted');
});

test('replay is visibly unavailable rather than an inert working-looking button',async ({page})=>{
  await page.goto('./');
  await expect(page.getByRole('button',{name:'Bar replay unavailable'})).toBeDisabled();
});

test('new alerts are scoped to the exact market venue',async ({page})=>{
  await page.goto('./');
  await page.locator('#open-alerts-modal-btn').click();
  const modal=page.locator('#alerts-modal-window');
  await modal.locator('#alert-target-price-input').fill('123.321');
  await modal.locator('#create-alert-submit-btn').click();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tv_alerts')||'[]'));
  expect(stored[0]?.exchange).toBeTruthy();
  expect(stored[0]?.marketType).toBeTruthy();
});
