// cbBTC/USDC minute-bar bot: rides a sharp three-minute impulse with a take-profit and a stop.
//
// The replay is long only and a round trip costs about 26 bps once fees, pool fee and slippage are
// paid, so the bot only buys when the last three minutes rose more than 50 bps, takes 200 bps when
// the move continues, and cuts a trade that goes 80 bps against it. Otherwise it sits in cash.

import { runBars, type BarsState } from './vendor/makefun-bars.ts';

const SYM = 'CBBTC';
const K = 3;            // minutes the impulse is measured over
const UP = 50;          // bps of rise required to buy
const TAKE = 200;       // bps of profit that closes the trade
const STOP = 80;        // bps of loss that closes it
const SLIP = 100;

const hist: number[] = [];
let entry = 0;

function onBatch(state: BarsState): unknown {
  const raw = state.close(SYM);
  if (raw === null) return [];
  const c = Number(raw);
  hist.push(c);
  if (hist.length > 600) hist.shift();

  const held = state.positions.get(SYM);
  const qty = held ? Number(held.qty) : 0;

  if (qty > 0 && entry > 0) {
    const change = (c / entry - 1) * 10000;
    if (change >= TAKE || change <= -STOP) {
      entry = 0;
      return [{ side: 'sell' as const, symbol: SYM, qty: held!.qty.toString(), max_slippage_bps: SLIP }];
    }
    return [];
  }

  if (hist.length <= K) return [];
  const back = hist[hist.length - 1 - K];
  const rise = (c / back - 1) * 10000;
  if (rise > UP && Number(state.cash) > 2_000_000) {
    entry = c;
    const spend = Math.floor(Number(state.cash) * 0.98);
    return [{ side: 'buy' as const, symbol: SYM, notional_quote_units: String(spend), max_slippage_bps: SLIP }];
  }
  return [];
}

runBars({ onBatch });
