import {test,expect} from '@playwright/test';

test('workspace renders without uncaught errors and chart-scale controls respond',async ({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('#tradingview-app-root')).toBeVisible();
  await expect(page.locator('#tradingview-right-icon-bar')).toBeVisible();
  for(const id of ['percent-scale-toggle','log-scale-toggle']){
    const button=page.locator('#'+id);
    await expect(button).toBeVisible();
    const before=await button.getAttribute('class');
    await button.click();
    await expect.poll(()=>button.getAttribute('class')).not.toBe(before);
    await button.click();
    await expect.poll(()=>button.getAttribute('class')).toBe(before);
  }
  await page.locator('#fit-chart-content-btn').click();
  expect(errors,'Unexpected client-side exceptions').toEqual([]);
});

test('symbol search, indicators and chart layout menus open and close',async ({page})=>{
  await page.goto('./');
  await page.getByTitle('Quick Search').click();
  await expect(page.locator('#symbol-search-modal-window')).toBeVisible();
  await page.locator('#symbol-search-input').fill('BTC');
  await page.locator('#close-symbol-search-modal').click();
  await expect(page.locator('#symbol-search-modal-window')).toHaveCount(0);

  await page.locator('#open-indicators-modal-btn').click();
  await expect(page.locator('#indicators-modal-window')).toBeVisible();
  await page.locator('#search-indicators-input').fill('RSI');
  await page.locator('#close-indicators-modal-btn').click();
  await expect(page.locator('#indicators-modal-window')).toHaveCount(0);

  await page.getByTitle('Select Chart Layout Grid').click();
  await expect(page.locator('#layout-picker-popover')).toBeVisible();
});

test('price alerts are real saved records, not seeded fake alert history',async ({page})=>{
  await page.goto('./');
  await page.locator('#open-alerts-modal-btn').click();
  await expect(page.locator('#alerts-modal-window')).toBeVisible();
  await page.locator('#alert-target-price-input').fill('123.456');
  await page.locator('#alert-condition-select').selectOption('cross_above');
  await page.locator('#create-alert-submit-btn').click();
  await expect(page.locator('#alerts-modal-window')).toContainText('123.456');
  await page.locator('#close-alerts-modal-btn').click();
  await page.reload();
  await page.locator('#open-alerts-modal-btn').click();
  await expect(page.locator('#alerts-modal-window')).toContainText('123.456');
});

test('paper trading panel opens and permits independent account creation',async ({page})=>{
  await page.goto('./');
  const collapsed=page.getByRole('button',{name:/Paper Trading/}).first();
  await collapsed.click();
  const picker=page.getByRole('button',{name:'Select Paper Trading account'});
  await expect(picker).toBeVisible();
  await picker.click();
  await page.getByRole('button',{name:/Create account/}).click();
  const dialog=page.getByRole('dialog',{name:'Create Paper Trading account'});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Account name').fill('Browser Regression Account');
  await dialog.getByLabel('Starting balance').fill('5000');
  await dialog.getByRole('button',{name:'Create',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Select Paper Trading account'})).toContainText('Browser Regression Account');
});
