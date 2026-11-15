import {test,expect} from '@playwright/test';

test('paper position close requires confirmation and permits partial execution',async ({page})=>{
  await page.addInitScript(()=>{
    // A verified Binance trade stream is provided by this isolated browser test.
    class MockTradeSocket {
      onopen:((event:any)=>void)|null=null;
      onmessage:((event:any)=>void)|null=null;
      onclose:((event:any)=>void)|null=null;
      private timer:number|undefined;
      constructor(private url:string){
        setTimeout(()=>{
          this.onopen?.({});
          if(url.includes('binance'))this.timer=window.setInterval(()=>
            this.onmessage?.({data:JSON.stringify({e:'trade',p:'105',q:'1',m:false})}),120);
        },25);
      }
      send(){}
      close(){if(this.timer!==undefined)window.clearInterval(this.timer);}
    }
    Object.defineProperty(window,'WebSocket',{configurable:true,value:MockTradeSocket});
    localStorage.setItem('tv_active_symbol','BTCUSDT');
    localStorage.setItem('candlelight_active_source','Binance');
    localStorage.setItem('candlelight_active_market_type','spot');
    const now=Date.now();
    const settings={
      currency:'USDT',startingBalance:10000,marginControl:false,
      leverages:{stocks:1,futures:20,forex:50,crypto:10,others:50},
      commission:{enabled:false,mode:'fixed',amount:0},
      futuresOptions:{enabled:false,perContract:0},
    };
    const portfolio={
      settings,
      account:{name:'Position QA',balance:10000,equity:10020,realizedPnL:0,
        unrealizedPnL:20,accountMargin:400,availableFunds:9620,ordersMargin:0,marginBuffer:100},
      positions:[{
        id:'browser-qa-position',symbol:'BTCUSDT',exchange:'Binance',
        side:'Long',qty:4,leverage:1,category:'crypto',marketType:'spot',
        entryPrice:100,currentPrice:105,unrealizedPnL:20,unrealizedPnLPct:5,
        openedAt:now-10000,lastMarkedAt:now,
      }],
      fills:[{
        id:'qa-open-fill',positionId:'browser-qa-position',symbol:'BTCUSDT',
        exchange:'Binance',side:'Buy',quantity:4,price:100,
        fee:0,realizedPnL:0,timestamp:now-10000,note:'Open (simulated market fill)',
      }],
      pendingOrders:[],orderEvents:[],
    };
    localStorage.setItem('candlelight_paper_accounts_v3',JSON.stringify({
      activeId:'qa-account',accounts:[{id:'qa-account',portfolio,orders:[]}],
    }));
    localStorage.setItem('candlelight_paper_one_click_v1','false');
  });
  await page.goto('./');
  await page.getByRole('button',{name:/Paper Trading/}).first().click();
  await expect(page.getByRole('button',{name:'Select Paper Trading account'})).toContainText('Position QA');
  await expect(page.getByRole('button',{name:'Create order'})).toBeEnabled();
  await expect(page.getByText(/Live reference 105/)).toBeVisible();
  await page.getByTitle('Close at latest verified price').click();
  const dialog=page.getByRole('dialog',{name:'Review paper position close'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Close quantity')).toHaveValue('4');
  await dialog.getByLabel('Close quantity').fill('2');
  await dialog.getByRole('button',{name:'Confirm close'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('tbody').first()).toContainText('2');
  await page.getByRole('button',{name:'Trade history'}).click();
  await expect(page.getByText('Partial close')).toBeVisible();
  await page.getByRole('button',{name:'Balance history'}).click();
  await expect(page.getByText('Starting cash balance')).toBeVisible();
  await page.getByRole('button',{name:'Activity log'}).click();
  await expect(page.getByText(/PARTIAL CLOSE/)).toBeVisible();
});
