# btc-race-bot

A minute-bar trading bot for cbBTC/USDC on make.fun's [Race a BTC trading bot live for 24 hours](https://make.fun/bounty/btc-race-24h-20261118-1444).

[![make.fun · btc-race](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/hermansto/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/hermansto/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard)

## What it does

Long only, one position at a time, no leverage, and it never reads the clock: every decision comes
from the closed bars the harness hands it. Entry is momentum — when the last three 1m closes of cbBTC
rose more than 50 bps, it buys with 98% of its cash (slippage tolerance 100 bps). The position is
closed in full when the close is 200 bps above the price its buy filled at, or 80 bps below it, and
the bot then sits in cash until the next 50 bps run shows up. Orders decided on one bar fill at the
next bar's open, so the bot only makes a new decision after the previous order's fill has come back;
a fill closes its pending slot whatever its status, which keeps one rejected order from wedging the
bot.

On the published dev window (1 symbol, 1440 bars) this takes 2 trades, pays 0.79 USDC in fees, and
nets +17.527956 USDC with 0 rejected orders.

`main.ts` is the whole bot, run by the harness as `node /bot/main.ts`. `vendor/makefun-bars.ts` is
the kit's protocol shim, copied byte for byte.
