import {test,expect} from '@playwright/test';
import {isolateExternalFeeds} from './market-fixtures';
test.beforeEach(async({page})=>{await isolateExternalFeeds(page);});

test('paper trading is disabled when its financial ledger needs recovery',async({page})=>{
  await page.goto('./');
  const invalid='{"accounts":[{"id":"invalid","portfolio":{"account":{},"positions":[],"fills":[]}}]}';
  await page.evaluate(raw=>localStorage.setItem('candlelight_paper_accounts_v3',raw),invalid);
  await page.reload();
  await page.getByRole('button',{name:/Paper Trading/}).first().click();
  await expect(page.getByRole('button',{name:'Create order'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Export recovery backup'})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('candlelight_paper_accounts_v3'))).toBe(invalid);
  expect(await page.evaluate(()=>localStorage.getItem('candlelight_paper_accounts_corrupt_backup_v1'))).toBe(invalid);
});

test('corrupt journal cannot be edited or overwritten and recovery export is offered',async({page})=>{
  await page.goto('./');
  const malformed='[{"id":"valid-looking","symbol":"BTCUSD","netReturn":4},{"bad":true}]';
  await page.evaluate(raw=>localStorage.setItem('tradingview_journal_trades',raw),malformed);
  await page.reload();
  await page.locator('#right-tab-trade-journal').click();
  await expect(page.getByRole('button',{name:'Export original journal'})).toBeVisible();
  await expect(page.getByText(/Journal edits are locked/)).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('tradingview_journal_trades'))).toBe(malformed);
  expect(await page.evaluate(()=>localStorage.getItem('candlelight_journal_recovery_backup_v1'))).toBe(malformed);
});

test('watchlists quarantine all records rather than silently dropping malformed entries',async({page})=>{
  await page.goto('./');
  const broken='[{"id":"w1","name":"Main","symbols":["BTCUSD"]},{"id":42}]';
  await page.evaluate(raw=>localStorage.setItem('tv_watchlists_v4',raw),broken);
  await page.reload();
  await page.locator('#right-tab-watchlist').click();
  await expect(page.locator('#watchlist-panel')).toBeVisible();
  await expect(page.getByRole('button',{name:'Export backup'})).toBeVisible();
  await expect(page.locator('#add-symbol-to-watchlist-btn')).toBeDisabled();
  expect(await page.evaluate(()=>localStorage.getItem('tv_watchlists_v4'))).toBe(broken);
  expect(await page.evaluate(()=>localStorage.getItem('candlelight_watchlists_recovery_backup_v1'))).toBe(broken);
});
