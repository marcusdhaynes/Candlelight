import type {Page} from '@playwright/test';

/** Browser UI tests should not depend on third-party exchange CORS or uptime.
 * Deliberately supply NO MARKET DATA. Accuracy of real feeds is tested separately.
 */
export async function isolateExternalFeeds(page:Page):Promise<void>{
  const headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  await page.route('https://candlelight-market-api.vercel.app/**',route=>
    route.fulfill({status:200,headers,body:JSON.stringify({candles:[]})}));
  await page.route('https://futures.kraken.com/**',route=>
    route.fulfill({status:200,headers,body:JSON.stringify({tickers:[]})}));
}
