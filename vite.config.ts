import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function realTimeMarketApiPlugin(): Plugin {
  return {
    name: 'realtime-market-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        const urlObj = new URL(req.url, 'http://localhost:3000');

        // 1. Kraken Catalog endpoint (Spot + Perpetuals)
        if (urlObj.pathname === '/api/kraken/catalog') {
          try {
            const catalogPath = path.resolve('src/data/krakenCatalog.json');
            if (fs.existsSync(catalogPath)) {
              const fileData = fs.readFileSync(catalogPath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(fileData);
              return;
            }
          } catch (err: any) {
            console.error('Error reading Kraken catalog:', err.message);
          }
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify([]));
          return;
        }

        // 2. Kraken Futures Chart endpoint (Perpetuals)
        if (urlObj.pathname === '/api/kraken/futures-chart') {
          let rawSym = (urlObj.searchParams.get('symbol') || 'PF_ARBUSD').trim().toUpperCase();
          const resolution = urlObj.searchParams.get('resolution') || '1h';

          // Clean symbol format: PF_ARBUSD or PI_XBTUSD
          if (rawSym.endsWith('.P')) {
            rawSym = rawSym.replace('.P', '');
          }
          if (!rawSym.startsWith('PF_') && !rawSym.startsWith('PI_')) {
            if (rawSym === 'BTCUSD' || rawSym === 'XBTUSD') rawSym = 'PI_XBTUSD';
            else if (rawSym === 'ETHUSD') rawSym = 'PF_ETHUSD';
            else rawSym = `PF_${rawSym}`;
          }

          try {
            const krakenFuturesUrl = `https://futures.kraken.com/api/charts/v1/trade/${encodeURIComponent(rawSym)}/${encodeURIComponent(resolution)}`;
            const apiRes = await fetch(krakenFuturesUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'application/json',
              },
            });

            if (apiRes.ok) {
              const data: any = await apiRes.json();
              if (Array.isArray(data.candles) && data.candles.length > 0) {
                const candles = data.candles.map((c: any) => ({
                  time: Math.floor(Number(c.time) / 1000),
                  open: parseFloat(c.open),
                  high: parseFloat(c.high),
                  low: parseFloat(c.low),
                  close: parseFloat(c.close),
                  volume: Math.round(parseFloat(c.volume) || 0),
                }));

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true, count: candles.length, symbol: rawSym, candles }));
                return;
              }
            }
          } catch (err: any) {
            console.error('Kraken Futures chart error:', err.message);
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ success: false, candles: [] }));
          return;
        }

        // 3. Kraken Spot OHLC endpoint
        if (urlObj.pathname === '/api/kraken/ohlc') {
          let rawPair = (urlObj.searchParams.get('pair') || 'ARBUSD').trim().toUpperCase().replace('.P', '');
          const interval = urlObj.searchParams.get('interval') || '60';

          try {
            const krakenOhlcUrl = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(rawPair)}&interval=${encodeURIComponent(interval)}`;
            const apiRes = await fetch(krakenOhlcUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'application/json',
              },
            });

            if (apiRes.ok) {
              const data: any = await apiRes.json();
              if (data && data.result) {
                const keys = Object.keys(data.result).filter((k) => k !== 'last');
                const rawArr = keys.length > 0 ? data.result[keys[0]] : null;
                if (Array.isArray(rawArr) && rawArr.length > 0) {
                  const candles = rawArr.map((c: any) => ({
                    time: Number(c[0]),
                    open: parseFloat(c[1]),
                    high: parseFloat(c[2]),
                    low: parseFloat(c[3]),
                    close: parseFloat(c[4]),
                    volume: Math.round(parseFloat(c[6]) || 0),
                  }));

                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, count: candles.length, pair: rawPair, candles }));
                  return;
                }
              }
            }
          } catch (err: any) {
            console.error('Kraken Spot OHLC error:', err.message);
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ success: false, candles: [] }));
          return;
        }

        if (urlObj.pathname === '/api/market/chart') {
          const rawSymbol = (urlObj.searchParams.get('symbol') || 'BTCUSD').trim().toUpperCase();
          const timeframe = urlObj.searchParams.get('timeframe') || '1h';

          let yahooSymbol = rawSymbol;
          if (rawSymbol === 'BTCUSD' || rawSymbol === 'BTCUSDT') yahooSymbol = 'BTC-USD';
          else if (rawSymbol === 'ETHUSD' || rawSymbol === 'ETHUSDT') yahooSymbol = 'ETH-USD';
          else if (rawSymbol === 'SOLUSD' || rawSymbol === 'SOLUSDT') yahooSymbol = 'SOL-USD';
          else if (rawSymbol === 'ARBUSD') yahooSymbol = 'ARB-USD';
          else if (rawSymbol === 'DOGEUSD') yahooSymbol = 'DOGE-USD';
          else if (rawSymbol === 'XRPUSD') yahooSymbol = 'XRP-USD';
          else if (rawSymbol === 'EURUSD') yahooSymbol = 'EURUSD=X';
          else if (rawSymbol === 'GBPUSD') yahooSymbol = 'GBPUSD=X';
          else if (rawSymbol === 'USDJPY') yahooSymbol = 'JPY=X';
          else if (rawSymbol === 'XAUUSD' || rawSymbol === 'GOLD') yahooSymbol = 'GC=F';
          else if (rawSymbol === 'USOIL' || rawSymbol === 'CRUDE') yahooSymbol = 'CL=F';

          let interval = '1h';
          let range = '1mo';

          if (timeframe === '1s' || timeframe === '5s' || timeframe === '15s' || timeframe === '30s' || timeframe === '1m') {
            interval = '1m';
            range = '5d';
          } else if (timeframe === '3m' || timeframe === '5m') {
            interval = '5m';
            range = '5d';
          } else if (timeframe === '15m') {
            interval = '15m';
            range = '1mo';
          } else if (timeframe === '30m' || timeframe === '45m') {
            interval = '30m';
            range = '1mo';
          } else if (timeframe === '1h' || timeframe === '2h' || timeframe === '3h' || timeframe === '4h') {
            interval = '1h';
            range = '3mo';
          } else if (timeframe === '1D') {
            interval = '1d';
            range = '1y';
          } else if (timeframe === '1W') {
            interval = '1wk';
            range = '5y';
          } else if (timeframe === '1M' || timeframe === '3M' || timeframe === '12M') {
            interval = '1mo';
            range = 'max';
          }

          try {
            const fetchUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`;
            const apiRes = await fetch(fetchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'application/json',
              },
            });

            if (apiRes.ok) {
              const data: any = await apiRes.json();
              const result = data.chart?.result?.[0];
              if (result && result.timestamp && result.indicators?.quote?.[0]) {
                const quote = result.indicators.quote[0];
                const timestamps: number[] = result.timestamp;
                const opens = quote.open || [];
                const highs = quote.high || [];
                const lows = quote.low || [];
                const closes = quote.close || [];
                const volumes = quote.volume || [];

                const candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = [];
                for (let i = 0; i < timestamps.length; i++) {
                  const o = opens[i];
                  const h = highs[i];
                  const l = lows[i];
                  const c = closes[i];
                  const v = volumes[i] || 0;
                  if (o != null && h != null && l != null && c != null) {
                    candles.push({
                      time: timestamps[i],
                      open: Number(o.toFixed(rawSymbol === 'ARBUSD' || o < 2 ? 4 : 2)),
                      high: Number(h.toFixed(rawSymbol === 'ARBUSD' || h < 2 ? 4 : 2)),
                      low: Number(l.toFixed(rawSymbol === 'ARBUSD' || l < 2 ? 4 : 2)),
                      close: Number(c.toFixed(rawSymbol === 'ARBUSD' || c < 2 ? 4 : 2)),
                      volume: Math.round(v),
                    });
                  }
                }

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  symbol: rawSymbol,
                  yahooSymbol,
                  count: candles.length,
                  meta: result.meta,
                  candles,
                }));
                return;
              }
            }
          } catch (err: any) {
            console.error('Real-time market API error:', err.message);
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ success: false, candles: [] }));
          return;
        }

        if (urlObj.pathname === '/api/market/quote') {
          const rawSymbol = (urlObj.searchParams.get('symbol') || 'BTCUSD').trim().toUpperCase();
          let yahooSymbol = rawSymbol;
          if (rawSymbol === 'BTCUSD' || rawSymbol === 'BTCUSDT') yahooSymbol = 'BTC-USD';
          else if (rawSymbol === 'ETHUSD' || rawSymbol === 'ETHUSDT') yahooSymbol = 'ETH-USD';
          else if (rawSymbol === 'SOLUSD' || rawSymbol === 'SOLUSDT') yahooSymbol = 'SOL-USD';
          else if (rawSymbol === 'ARBUSD') yahooSymbol = 'ARB-USD';
          else if (rawSymbol === 'DOGEUSD') yahooSymbol = 'DOGE-USD';
          else if (rawSymbol === 'XRPUSD') yahooSymbol = 'XRP-USD';
          else if (rawSymbol === 'EURUSD') yahooSymbol = 'EURUSD=X';
          else if (rawSymbol === 'GBPUSD') yahooSymbol = 'GBPUSD=X';
          else if (rawSymbol === 'USDJPY') yahooSymbol = 'JPY=X';
          else if (rawSymbol === 'XAUUSD' || rawSymbol === 'GOLD') yahooSymbol = 'GC=F';
          else if (rawSymbol === 'USOIL' || rawSymbol === 'CRUDE') yahooSymbol = 'CL=F';

          try {
            const fetchUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d`;
            const apiRes = await fetch(fetchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'application/json',
              },
            });

            if (apiRes.ok) {
              const data: any = await apiRes.json();
              const meta = data.chart?.result?.[0]?.meta;
              if (meta) {
                const currentPrice = meta.regularMarketPrice || meta.chartPreviousClose;
                const prevClose = meta.previousClose || meta.chartPreviousClose || currentPrice;
                const change = currentPrice - prevClose;
                const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  symbol: rawSymbol,
                  price: currentPrice,
                  change24h: Number(change.toFixed(rawSymbol === 'ARBUSD' || currentPrice < 2 ? 4 : 2)),
                  changePercent24h: Number(changePct.toFixed(2)),
                  high24h: meta.regularMarketDayHigh || currentPrice,
                  low24h: meta.regularMarketDayLow || currentPrice,
                  volume24h: meta.regularMarketVolume,
                }));
                return;
              }
            }
          } catch (err: any) {
            // ignore
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ success: false }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), realTimeMarketApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
