import {test,expect} from '@playwright/test';
import {isolateExternalFeeds} from './market-fixtures';
test('only one open browser tab may write paper trading data',async({page,context})=>{
  await isolateExternalFeeds(page);
  await page.goto('./');
  await page.getByRole('button',{name:/Paper Trading/}).first().click();
  await expect(page.getByRole('button',{name:'Create order'})).toBeEnabled();
  const second=await context.newPage();
  await isolateExternalFeeds(second);
  await second.goto('./');
  await second.getByRole('button',{name:/Paper Trading/}).first().click();
  await expect(second.getByRole('button',{name:'Create order'})).toBeDisabled();
  await page.close();
  await expect(second.getByRole('button',{name:'Create order'})).toBeEnabled({timeout:12000});
  await second.close();
});
