import {test,expect} from '@playwright/test';

test('order ticket tabs, order types, trailing exits, and account settings are interactive',async ({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  await page.locator('#trade-action-btn').click();
  const ticket=page.getByRole('dialog',{name:'Paper Trading order entry'});
  await expect(ticket).toBeVisible();
  await ticket.getByRole('button',{name:'DOM',exact:true}).click();
  await expect(ticket).toContainText('Market depth');
  await ticket.getByRole('button',{name:'Order',exact:true}).click();
  await ticket.getByRole('button',{name:'limit',exact:true}).click();
  await expect(ticket.getByRole('spinbutton',{name:'Entry price',exact:true})).toBeVisible();
  await ticket.getByRole('spinbutton',{name:'Entry price',exact:true}).fill('125.25');
  await ticket.getByRole('button',{name:'stop',exact:true}).click();
  await expect(ticket.getByRole('spinbutton',{name:'Entry price',exact:true})).toHaveValue('');
  await ticket.getByRole('button',{name:'stop-limit',exact:true}).click();
  await expect(ticket.getByLabel('Stop-limit limit price')).toBeVisible();
  await ticket.getByRole('button',{name:'% Available'}).click();
  await ticket.getByRole('button',{name:'Risk % Balance'}).click();
  await expect(ticket.getByRole('spinbutton',{name:'Order size'})).toBeVisible();
  await expect(ticket.getByLabel('One-click paper trading')).not.toBeChecked();
  await ticket.getByRole('button',{name:'market',exact:true}).click();
  const exits=ticket.getByRole('button',{name:/Exits/});
  await exits.click();
  await expect(ticket.getByRole('switch',{name:'Enable trailing stop loss'})).toHaveCount(0);
  await exits.click();
  const trailing=ticket.getByRole('switch',{name:'Enable trailing stop loss'});
  await trailing.click();
  await expect(trailing).toHaveAttribute('aria-checked','true');
  await expect(ticket.getByLabel('Trailing stop distance percent')).toBeEnabled();
  await trailing.click();
  await expect(ticket.getByLabel('Trailing stop distance percent')).toBeDisabled();
  await ticket.getByTitle('Account settings').click();
  await expect(page.getByRole('dialog',{name:'Paper Trading account settings'})).toBeVisible();
  await page.getByTitle('Close account dialog').click();
  await ticket.getByTitle('Close order panel').click();
  await expect(ticket).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('saved chart has functioning local save and restore',async ({page})=>{
  await page.goto('./');
  await page.locator('#save-chart-action-btn').click();
  const modal=page.getByRole('dialog',{name:'Save and restore charts'});
  await expect(modal).toBeVisible();
  await modal.getByLabel('Chart name').fill('Browser automation saved chart');
  await modal.getByRole('button',{name:'Save locally'}).click();
  await expect(modal).toContainText('Browser automation saved chart');
  await expect(modal.getByTitle('Restore saved chart')).toBeVisible();
  await modal.getByTitle('Restore saved chart').click();
  await expect(modal).toHaveCount(0);
  await page.locator('#save-chart-action-btn').click();
  await expect(page.getByRole('dialog',{name:'Save and restore charts'})).toContainText('Browser automation saved chart');
});

test('sidebars and chart ranges expose real states without fake news',async ({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  await page.locator('#right-tab-watchlist').click();
  await expect(page.locator('#watchlist-panel')).toBeVisible();
  await page.locator('#right-tab-news').click();
  await expect(page.locator('#right-sidebar-content-pane')).toContainText('No verified market-news feed is connected');
  await page.locator('#right-tab-orderbook').click();
  await expect(page.locator('#right-sidebar-content-pane')).toBeVisible();
  await page.locator('#right-tab-technicals').click();
  await expect(page.locator('#right-sidebar-content-pane')).toBeVisible();
  await page.locator('#right-tab-alerts').click();
  await expect(page.locator('#tradingview-alerts-panel')).toBeVisible();
  for(const range of ['1D','5D','1M','3M','6M','YTD','1Y','ALL']){
    await page.locator('#range-btn-'+range).click();
  }
  expect(errors).toEqual([]);
});
