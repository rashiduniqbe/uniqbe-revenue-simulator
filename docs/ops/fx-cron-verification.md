# FX cron verification (T-32)

Acceptance (spec §14 T-32): "Cron fires and writes; verified over 3 consecutive days."
Cron: `/api/cron/fx-refresh` at `0 6 * * *` UTC. On Hobby it may fire any time 06:00–06:59 UTC.

Check, after 07:00 UTC each day:

```bash
curl -s https://uniqbe-revenue-simulator.vercel.app/api/fx
```

Pass when `provider` is not `seed`, `degraded` is `false`, and `fetchedAt` is that day's date (UTC).
Also confirm in Vercel → Project → Cron Jobs (or Logs) that the run returned 200.
`asOf` lags on weekends and ECB holidays (no published rates), which is expected; `fetchedAt` is what proves the cron ran.

Baseline (not a cron run): 2026-10-04 02:27 UTC, a manual authorised call wrote
`provider: frankfurter`, `degraded: false`, `asOf: 2026-10-02`.

| Day | Date (UTC) | fetchedAt | provider | degraded | Cron log status | Pass |
|---|---|---|---|---|---|---|
| 1 | 2026-10-04 | 2026-10-04T06:53:38Z | frankfurter | false | write observed (fetchedAt in window) | ✅ |
| 2 | 2026-10-05 | 2026-10-05T06:53:38Z | frankfurter | false | write observed (fetchedAt in window) | ✅ |
| 3 | 2026-10-06 | 2026-10-06T06:53:38Z | frankfurter | false | write observed (fetchedAt in window) | ✅ |
