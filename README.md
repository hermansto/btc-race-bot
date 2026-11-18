# btc-race-bot

A minute-bar trading bot for cbBTC/USDC on make.fun's [Race a BTC trading bot live for 24 hours](https://make.fun/bounty/btc-race-24h-20261118-1444).

[![make.fun · btc-race](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/hermansto/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/hermansto/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard)

## What it does

Long only, one position, no leverage. It measures the last three minutes of closes and buys when
they rose more than 30 bps, then closes the position when the same measure turns negative by 20 bps
or the trade is 80 bps under its fill. A full round trip costs about 26 bps in fees, pool fee and
slippage, so the entry threshold is set above that cost and the bot sits in cash the rest of the
time — on the published dev window, where cbBTC fell 2.8% over 24 hours, buy-and-hold loses about
30 USDC while this stays close to flat.

`main.ts` is the whole bot, run by the harness as `node /bot/main.ts`. `vendor/makefun-bars.ts` is
the kit's protocol shim, copied byte for byte.
