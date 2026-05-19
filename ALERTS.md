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

## [SIGNAL YELLOW] 2026-05-14T11:05:05Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.638s / 0.263s). 5th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW. Cross-check: most recent deploy dpl_Cu4qPUwr9XoDRRf5Y1aGQwwp4UNc is READY (commit 80e188f); fast sub-second 403s confirm Vercel Deployment Protection, not an app failure. No runtime errors in last 6h; DB healthy.
**Recommended action:** No action needed — known pre-launch baseline. If repetitive YELLOW noise is undesirable, suppress 403=deployment-protection checks once protection is confirmed intentional.
**Raw data:** multi=403/0.638s, navy=403/0.263s; deploy dpl_Cu4qPUwr9XoDRRf5Y1aGQwwp4UNc READY; 0 runtime errors in last 6h; new-signups=0; total-users=5; last-commit=80e188f ~43h ago (fully deployed, in sync).
---

## [SIGNAL YELLOW] 2026-05-15T05:04:32Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.32s / 0.43s). 6th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW. Cross-check: project `live=false`, most recent deploy dpl_Cu4qPUwr9XoDRRf5Y1aGQwwp4UNc is READY (commit 80e188f); fast sub-second 403s confirm Vercel Deployment Protection, not an app failure. No runtime errors in last 6h; DB healthy.
**Recommended action:** No action needed — known pre-launch baseline. Protection is intentional.
**Raw data:** multi=403/0.32s, navy=403/0.43s; deploy dpl_Cu4qPUwr9XoDRRf5Y1aGQwwp4UNc READY; 0 runtime errors in last 6h; new-signups=0; total-users=5; last-commit=80e188f 60h38m ago (fully deployed, in sync).
---

## [SIGNAL YELLOW] 2026-05-15T11:05:47Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.37s / 0.61s). 7th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW. Cross-check: project `live=false`, latest deploy dpl_98u6Wad5rFRZQTLNuUjss3pk8SsV READY (da009dd); fast sub-second 403s confirm Vercel Deployment Protection, not an app failure. 0 runtime errors; DB healthy.
**Recommended action:** No action needed — known pre-launch baseline. Notable: new model migration deployed (sonnet-4-6 → opus-4-6, Anthropic retiring sonnet-4-6); deploy appears successful.
**Raw data:** multi=403/0.37s, navy=403/0.61s; deploy dpl_98u6Wad5rFRZQTLNuUjss3pk8SsV READY (da009dd "ai: migrate sonnet-4-6 to opus-4-6"); 1 benign DEP0169 deprecation warning on /api/activation (200 OK); new-signups=0; total-users=5; last-commit=da009dd 1h41m ago, deploy followed immediately.
---

## [SIGNAL YELLOW] 2026-05-16T05:02:49Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.22s / 0.19s). 8th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW. Cross-check: latest deploy dpl_Fn5J6WAxsKNFuDLMAmP1hmJWuGq6 READY (commit 1573786 "fix: auth on /api/voicecard/generate"); fast sub-second 403s confirm Vercel Deployment Protection, not an app failure. 0 runtime 5xx errors in last 6h.
**Recommended action:** No action needed — known pre-launch baseline. Active development: 8 deploys shipped since last check (~18h); latest voicecard auth fix live. Note: sonnet-4-6 was briefly migrated to opus-4-6 then reverted to sonnet-4-6 same day (cost decision).
**Raw data:** multi=403/0.22s, navy=403/0.19s; latest deploy dpl_Fn5J6WAxsKNFuDLMAmP1hmJWuGq6 READY (1573786 "voicecard auth fix", 11min ago at check time); runtime logs (6h): 0 5xx, 2×401 on /api/voicecard/generate at 04:52 UTC (benign — 1min post-deploy test traffic, not server errors); new-signups=0; total-users=5; last-commit=1573786 11min ago, fully deployed.
---

## [SIGNAL YELLOW] 2026-05-16T11:02:53Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.32s / 0.75s). 9th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW. Cross-check: latest deploy dpl_3UNfxpX9k4ni3CzU6UgFefDmLzdF READY (commit 1011679 "feat: desktop multi-round clarifying-question UI"); fast sub-second 403s confirm Vercel Deployment Protection, not an app failure. 0 runtime errors in last 6h.
**Recommended action:** No action needed — known pre-launch baseline. Very active dev session: 11 deploys since last check (6h), including full app.jsx componentization (waves 1–5), classifier integration, LibraryView filters, CATEGORIES extension, ai_observations writer, and multi-round clarifying-question UI.
**Raw data:** multi=403/0.32s, navy=403/0.75s; latest deploy dpl_3UNfxpX9k4ni3CzU6UgFefDmLzdF READY (1011679 "multi-round clarifying-question UI", 1h27m ago); runtime logs (6h): no entries; new-signups=0; total-users=5; last-commit=1011679 1h27m ago, fully deployed.
---

## [SIGNAL YELLOW] 2026-05-17T05:08:08Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.26s / 0.29s). 10th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW. Cross-check: latest deploy dpl_FYdqPzzSVvvk3yiuzvAjf3a2K81h READY (df1a99f "capture-mode prompt rewired against AI Behavior Spec v1"); fast sub-second 403s confirm Vercel Deployment Protection, not an app failure. 0 runtime errors in last 6h.
**Recommended action:** No action needed — known pre-launch baseline. Note: 1 ERROR deploy in batch (dpl_Bn3P5p6AYrLEiWGUfAvB2E874Ygz, "feat: Incoming tab — triage surface for non-creative captures"), since superseded by 3 successful READY deploys; no user impact.
**Raw data:** multi=403/0.26s, navy=403/0.29s; latest deploy dpl_FYdqPzzSVvvk3yiuzvAjf3a2K81h READY (df1a99f, ~4h ago at check time); 8 new deploys since last check; 1 ERROR deploy (Incoming tab, recovered); runtime logs (6h): no entries; new-signups=0; total-users=5; last-commit=df1a99f 4h ago, fully deployed.
---

## [SIGNAL YELLOW] 2026-05-17T11:02:58Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.22s / 0.34s). 11th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW. Cross-check: latest deploy dpl_FYdqPzzSVvvk3yiuzvAjf3a2K81h READY (df1a99f "feat: capture-mode prompt rewired against AI Behavior Spec v1"); fast sub-second 403s confirm Vercel Deployment Protection, not an app failure. 0 runtime errors in last 6h. Quiet session — no new deploys since the 05:08Z check.
**Recommended action:** No action needed — known pre-launch baseline.
**Raw data:** multi=403/0.22s, navy=403/0.34s; latest deploy dpl_FYdqPzzSVvvk3yiuzvAjf3a2K81h READY (df1a99f, 9h55m ago); no new deploys since last check; runtime logs (6h): no entries; new-signups=0; total-users=5; last-commit=df1a99f 9h55m ago, fully deployed.
---

## [SIGNAL YELLOW] 2026-05-18T05:09:21Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.46s / 0.31s). 12th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW. Cross-check: latest deploy dpl_FYdqPzzSVvvk3yiuzvAjf3a2K81h READY (df1a99f "feat: capture-mode prompt rewired against AI Behavior Spec v1"); fast sub-second 403s confirm Vercel Deployment Protection, not an app failure. 0 runtime errors in last 6h. No new deploys since the prior check (~18h).
**Recommended action:** No action needed — known pre-launch baseline.
**Raw data:** multi=403/0.46s, navy=403/0.31s; latest deploy dpl_FYdqPzzSVvvk3yiuzvAjf3a2K81h READY (df1a99f, 28h ago); no new deploys since last check; runtime logs (6h): no entries; new-signups=0; total-users=5; last-commit=df1a99f 28h ago, fully deployed.
---

## [SIGNAL YELLOW] 2026-05-18T11:11:17Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.66s / 0.50s). 13th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW. Cross-check: latest deploy dpl_FYdqPzzSVvvk3yiuzvAjf3a2K81h READY (df1a99f "feat: capture-mode prompt rewired against AI Behavior Spec v1"); fast sub-second 403s confirm Vercel Deployment Protection, not an app failure. 0 runtime errors in last 6h.
**Recommended action:** No action needed — known pre-launch baseline.
**Raw data:** multi=403/0.66s, navy=403/0.50s; latest deploy dpl_FYdqPzzSVvvk3yiuzvAjf3a2K81h READY (df1a99f, ~34h ago); no new deploys since last check (~6h); runtime logs (6h): 1 entry — GET /api/refresh-voicecards 200 (cron, healthy); new-signups=0; total-users=5; last-commit=df1a99f 34h ago, fully deployed.
---

## [SIGNAL YELLOW] 2026-05-19T05:10:48Z
**What's off:** Both signal-multi and signal-navy-five returning HTTP 403 (0.44s / 0.72s). 14th consecutive check with same result.
**Why this severity:** Protocol classifies 4xx as YELLOW. Cross-check: latest deploy dpl_FYdqPzzSVvvk3yiuzvAjf3a2K81h READY (df1a99f "feat: capture-mode prompt rewired against AI Behavior Spec v1"); fast sub-second 403s confirm Vercel Deployment Protection, not an app failure. 0 runtime errors in last 6h. No new deploys since last check (~18h).
**Recommended action:** No action needed — known pre-launch baseline.
**Raw data:** multi=403/0.44s, navy=403/0.72s; latest deploy dpl_FYdqPzzSVvvk3yiuzvAjf3a2K81h READY (df1a99f, ~52h ago); no new deploys since last check; runtime logs (6h): no entries; new-signups=0; total-users=5; last-commit=df1a99f 52h ago, fully deployed.
---
