# Signal Alerts

## [SIGNAL INFO] 2026-05-12T18:59:08Z — new signups
1 new user(s) in the last 12 hours. Most recent: 2026-05-12T10:36:31Z. Total users: 4.
---

## [SIGNAL YELLOW] 2026-05-13T05:14:03Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.39s / 0.44s).
**Why this severity:** 4xx confirmed as Vercel deployment protection — project `live=false`, latest deploy READY. Not an outage; site is intentionally access-controlled pre-launch.
**Recommended action:** Verify deployment protection is intentional. No action needed if pre-launch gating is deliberate.
**Raw data:** multi=403/0.39s, navy=403/0.44s; deploy dpl_Cu4qPUwr9XoDRRf5Y1aGQwwp4UNc READY; 0 runtime errors in last 6h.
---

## [SIGNAL INFO] 2026-05-13T05:14:03Z — new signups
1 new in last 12 hours. Emails: dpgorman+ob1@gmail.com (Daniel alias). Total users: 5.
---

## [SIGNAL YELLOW] 2026-05-13T11:28:34Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.34s / 0.31s).
**Why this severity:** 4xx confirmed as Vercel deployment protection — project `live=false`, latest deploy READY. Not an outage; site is intentionally access-controlled pre-launch. Same condition as previous check.
**Recommended action:** No action needed if pre-launch gating is deliberate; verify if this should remain protected or open before launch.
**Raw data:** multi=403/0.34s, navy=403/0.31s; deploy dpl_Cu4qPUwr9XoDRRf5Y1aGQwwp4UNc READY; 0 runtime errors in last 6h; total-users=5.
---

## [SIGNAL YELLOW] 2026-05-14T05:07:07Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.24s / 0.34s). Recurring pattern — 4th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW; cross-check confirms all Vercel deploys READY (latest: 80e188f "calendar: completed todos stay visible"). This is Vercel Deployment Protection, not an outage.
**Recommended action:** No action needed. This YELLOW is a known pre-launch baseline. Consider suppressing in future runs if protection is a permanent pre-launch setting.
**Raw data:** multi=403/0.24s, navy=403/0.34s; deploy dpl_Cu4qPUwr9XoDRRf5Y1aGQwwp4UNc READY; 0 runtime errors in last 6h; new-signups=0; total-users=5; last-commit=80e188f 36h41m ago (fully deployed).
---
