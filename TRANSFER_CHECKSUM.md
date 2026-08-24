# Transfer checksum — Grok → Claude Code

Non-secret verification only. No env values.

| Field | Value |
|---|---|
| Project | nasir-bespoke-virtual-try-on |
| Branch | feature/split-outfit |
| origin/main | 160f71ce6d0d47a4709723be68cfe52062785c6f (untouched) |
| HEAD at docs freeze | 69ce2385a8e1eaf9547e91dfa24f690c83216eaa |
| origin/feature/split-outfit at docs freeze | 69ce2385a8e1eaf9547e91dfa24f690c83216eaa |
| Latest product implementation | be37eed90518e96a9cd3861ff15fff9257c5d109 (Phase 4F notes) |
| Latest completed product phase | 4F — Production Notes |
| Last operational acceptance | 4G incomplete (source green; live Preview blocked) |
| Test count | 505 pass (378 + 117 + 4 + 6) |
| Lint | PASS |
| Typecheck | PASS |
| Build | PASS |
| Migration `20260820120000_add_production_notes` | Applied by operator to shared Preview/dev. Do not re-run unless status shows pending on a new DB. Not on Production. |
| Production affected | NO |
| OpenAI called | NO |
| Next immediate action | Operator: Preview multi-role AUTH_USERS_JSON_BASE64 + Vercel Deployment Protection access + live 4D–4F QA. Claude: planning pass before any new product phase. |

After the return-handoff commit is pushed, HEAD and origin/feature/split-outfit must both be that commit. Confirm with `git rev-parse HEAD` and `git rev-parse origin/feature/split-outfit`.
