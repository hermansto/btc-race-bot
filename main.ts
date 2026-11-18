// cbBTC/USDC minute-bar bot for agent-fun/bars-replay/v1.
//
// Long only, one position at a time, no leverage, no clock:
//   entry  - the last three 1m closes rose more than 50 bps -> buy with 98% of cash
//   exit   - close is 200 bps above the fill price (take profit) or 80 bps below it (stop)
// Orders decided on bar k fill at bar k + 1's open, so a decision is only made once the previous
// one has come back in `fills`; that is what pendingBuy / pendingSell guard.

import { runBars } from './vendor/makefun-bars.ts';
import type { Batch, BarsState, OrderInput } from './vendor/makefun-bars.ts';

const BPS = 10_000n;

const ENTRY_GAIN_BPS = 50n; // "3 minutes up more than 50 bps"
const TAKE_PROFIT_BPS = 200n; // sell at +200 bps from the fill price
const STOP_LOSS_BPS = 80n; // sell at -80 bps from the fill price
const LOOKBACK_BARS = 3; // 3 minutes on 1m bars
const CASH_NUM = 98n; // notional = 98% of cash (the rest pays the fee)
const CASH_DEN = 100n;
const MAX_SLIPPAGE_BPS = 100;
const MAX_HISTORY = 4096; // closes kept, enough for any window the harness runs
const PREFERRED_SYMBOL = 'CBBTC';

/** The symbol to trade: CBBTC when the universe has it, else the first BTC-ish ticker, else the first. */
function pickSymbol(state: BarsState): string | null {
  if (state.symbols.has(PREFERRED_SYMBOL)) return PREFERRED_SYMBOL;
  for (const ticker of state.symbols.keys()) if (ticker.includes('BTC')) return ticker;
  for (const ticker of state.symbols.keys()) return ticker;
  return null;
}

/** Average cost per unit from a position's cost (fees included), in the symbol's price scale. */
function costPrice(state: BarsState, symbol: string, qty: bigint, cost: bigint): bigint | null {
  const meta = state.symbols.get(symbol);
  if (meta === undefined || qty <= 0n) return null;
  const quoteScale = BigInt(state.hello.capital.quote_scale);
  const unitScale = 10n ** BigInt(meta.qty_scale + meta.price_scale);
  return (cost * unitScale) / (qty * 10n ** quoteScale);
}

async function main(): Promise<void> {
  const closes: bigint[] = [];
  let symbol: string | null = null;
  let entryPrice: bigint | null = null; // set by a filled buy, cleared by a filled sell
  let pendingBuy = false; // a buy is on the wire, its fill arrives next batch
  let pendingSell = false; // a sell is on the wire, its fill arrives next batch

  await runBars({
    onHello(state: BarsState): void {
      symbol = pickSymbol(state);
    },

    onBatch(state: BarsState, batch: Batch): OrderInput[] {
      if (symbol === null) symbol = pickSymbol(state);
      const sym = symbol;
      if (sym === null) return [];

      // 1. Fold in the fills of the decision made on the previous bar. Every fill answers the
      //    pending it belongs to and clears it whatever its status, so a rejected order can never
      //    leave pendingBuy / pendingSell stuck true; entryPrice moves only on a filled one, since
      //    a rejected buy never happened and a rejected sell still holds the position.
      for (const fill of batch.fills) {
        if (fill.symbol !== sym) continue;
        const filled = fill.status === 'filled';
        if (fill.side === 'buy') {
          pendingBuy = false;
          if (filled) entryPrice = BigInt(fill.price);
        } else {
          pendingSell = false;
          if (filled) entryPrice = null;
        }
      }

      // 2. No bar for this symbol and no close yet: nothing to trade on, don't touch state.
      const bar = batch.bars.find((b) => b.symbol === sym);
      if (bar === undefined && state.close(sym) === null) return [];

      // 3. Keep the close history (one close per bar the symbol traded).
      if (bar !== undefined) {
        closes.push(BigInt(bar.c));
        if (closes.length > MAX_HISTORY) closes.splice(0, closes.length - MAX_HISTORY);
      }

      const price = state.close(sym);
      if (price === null || state.warmingUp) return []; // nothing tradeable yet

      // 4. Holding: check take profit / stop loss against the entry price.
      const position = state.positions.get(sym);
      if (position !== undefined && position.qty > 0n) {
        if (entryPrice === null) entryPrice = costPrice(state, sym, position.qty, position.cost);
        if (pendingSell || entryPrice === null) return [];
        const entry = entryPrice;
        const takeProfit = entry + (entry * TAKE_PROFIT_BPS) / BPS;
        const stopLoss = entry - (entry * STOP_LOSS_BPS) / BPS;
        if (price >= takeProfit || price <= stopLoss) {
          pendingSell = true;
          return [{ side: 'sell', symbol: sym, qty: position.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
        return [];
      }

      // 5. Flat: momentum entry, only when the previous decision has settled.
      if (pendingBuy) return [];
      if (closes.length <= LOOKBACK_BARS) return [];
      const now = closes[closes.length - 1]!;
      const before = closes[closes.length - 1 - LOOKBACK_BARS]!;
      if (before <= 0n) return [];
      const gainBps = ((now - before) * BPS) / before;
      if (gainBps <= ENTRY_GAIN_BPS) return [];

      // 98% of cash, but never past the weight cap the market enforces.
      const budget = (state.cash * CASH_NUM) / CASH_DEN;
      const room = state.weightRoom(sym);
      const notional = budget < room ? budget : room;
      const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
      if (notional < minNotional || notional <= 0n) return [];

      pendingBuy = true;
      return [{ side: 'buy', symbol: sym, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    },
  });
}

await main();
