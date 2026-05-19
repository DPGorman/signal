# Signal Health Log

| Timestamp (UTC) | Status | multi | navy | deploy | errors | new-signups | total-users | last-commit | summary |
|---|---|---|---|---|---|---|---|---|---|
| 2026-05-12T18:59:08Z | GREEN | 403/0.24s | 403/0.24s | READY | 0 | 1 | 4 | 2h33m | all checks pass; 403s=vercel-deployment-protection (not outage); 1 new signup |
| 2026-05-13T05:14:03Z | YELLOW | 403/0.39s | 403/0.44s | READY | 0 | 1 | 5 | 12h48m | 403s=deployment-protection confirmed (live=false, deploy READY); 0 runtime errors; 1 new signup dpgorman+ob1 |
| 2026-05-13T11:28:34Z | YELLOW | 403/0.34s | 403/0.31s | READY | 0 | 0 | 5 | 19h2m | 403s=deployment-protection (live=false, deploy READY); 0 runtime errors; no new signups |
| 2026-05-14T05:07:07Z | YELLOW | 403/0.24s | 403/0.34s | READY | 0 | 0 | 5 | 36h41m | 403s=deployment-protection confirmed (deploy READY, 80e188f); 0 runtime errors; no new signups |
| 2026-05-14T11:05:05Z | YELLOW | 403/0.638s | 403/0.263s | READY | 0 | 0 | 5 | 43h | 403s=deployment-protection (5th consecutive check, deploy READY, 80e188f); 0 runtime errors; no new signups |
| 2026-05-15T05:04:32Z | YELLOW | 403/0.32s | 403/0.43s | READY | 0 | 0 | 5 | 60h38m | 403s=deployment-protection (6th consecutive check, deploy READY, 80e188f); 0 runtime errors; no new signups |
| 2026-05-15T11:05:47Z | YELLOW | 403/0.37s | 403/0.61s | READY | 0 | 0 | 5 | 1h41m | 403s=deployment-protection (7th consecutive, live=false); NEW deploy da009dd "opus-4-6 migration" READY 1h41m ago; 0 runtime errors |
| 2026-05-16T05:02:49Z | YELLOW | 403/0.22s | 403/0.19s | READY | 0 | 0 | 5 | 11min | 403s=deployment-protection (8th consecutive, READY confirmed); active dev — 8 deploys since last check; latest 1573786 "voicecard auth fix" 11min ago; 2×401 on voicecard post-fix (benign); 0 5xx |
| 2026-05-16T11:02:53Z | YELLOW | 403/0.32s | 403/0.75s | READY | 0 | 0 | 5 | 1h27m | 403s=deployment-protection (9th consecutive, READY confirmed); active dev — 11 deploys since last check; latest 1011679 "multi-round clarifying-question UI" READY 1h27m ago; 0 runtime errors |
| 2026-05-17T05:08:08Z | YELLOW | 403/0.26s | 403/0.29s | READY | 0 | 0 | 5 | 4h0m | 403s=deployment-protection (10th consecutive, READY confirmed); active dev — 8 new deploys since last check incl. 1 ERROR (Incoming tab, recovered); latest df1a99f "capture-mode prompt rewired against AI Behavior Spec v1" READY 4h ago; 0 runtime errors |
| 2026-05-17T11:02:58Z | YELLOW | 403/0.22s | 403/0.34s | READY | 0 | 0 | 5 | 9h55m | 403s=deployment-protection (11th consecutive, deploy READY); no new deploys since last check; 0 runtime errors; no new signups |
| 2026-05-18T05:09:21Z | YELLOW | 403/0.46s | 403/0.31s | READY | 0 | 0 | 5 | 28h | 403s=deployment-protection (12th consecutive, deploy READY); no new deploys since last check; 0 runtime errors; no new signups |
| 2026-05-18T11:11:17Z | YELLOW | 403/0.66s | 403/0.50s | READY | 0 | 0 | 5 | 34h | 403s=deployment-protection (13th consecutive, deploy READY); no new deploys since last check (~6h); 1 cron hit /api/refresh-voicecards 200; 0 runtime errors; no new signups |
| 2026-05-19T05:10:48Z | YELLOW | 403/0.44s | 403/0.72s | READY | 0 | 0 | 5 | 52h | 403s=deployment-protection (14th consecutive, deploy READY); no new deploys since last check (~18h); 0 runtime errors; no new signups |
| 2026-05-19T11:09:33Z | YELLOW | 403/0.32s | 403/0.31s | READY | 0 | 0 | 5 | 1h | 403s=deployment-protection (15th consecutive, deploy READY); 2 new deploys since last check (7a3e117 "studio+pulse prompts rewired against AI Behavior Spec v1"); 2×/api/ai 200; 0 runtime errors |
