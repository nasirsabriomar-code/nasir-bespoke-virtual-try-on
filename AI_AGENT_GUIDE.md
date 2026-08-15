# AI Agent Guide

This repository is intended to be continued by Codex, ChatGPT Work Mode, Claude Code, Gemini coding agents, and human developers.

## Before modifying code, always read

1. PROJECT_CONTEXT.md
2. ARCHITECTURE.md
3. SECURITY.md
4. ROADMAP.md
5. The relevant source files and tests

## Non-negotiable rules

- Do not expose secrets or print secret values.
- Never commit .env, .env.local, production tokens, passwords, hashes, session tokens, or private URLs.
- Do not modify production configuration or deploy without explicit approval.
- Preserve authentication, authorization, rate limiting, OpenAI server boundaries, image privacy, and history behavior.
- Do not replace the project with a new application or framework.
- Do not introduce women's fashion taxonomy; this is a men's bespoke system.
- Do not allow the browser to submit arbitrary prompts, model IDs, provider IDs, or remote reference URLs.
- Resolve catalog IDs and configuration on the server.
- Keep customer images and generated images private when storage is enabled.
- Use existing patterns before introducing new abstractions or dependencies.
- Make the smallest coherent change for the requested milestone.
- Add or update tests for behavior changes.
- Run lint, typecheck, tests, and production build before completion.
- Explain any intentional security, schema, or deployment trade-off.

## Safe working sequence

1. Inspect current code and tests.
2. Identify the owner of the behavior being changed.
3. Write a short implementation plan.
4. Make an isolated change.
5. Run focused tests.
6. Run the full validation suite.
7. Review the diff for secrets, unrelated changes, and regressions.
8. Report files changed, tests run, and remaining limitations.

## Source-of-truth rules

- Current source code is authoritative over old conversation notes.
- PROJECT_CONTEXT_HANDOFF.md is historical context, not an executable specification.
- lib/bespoke/engine.ts is authoritative for resolved bespoke configuration.
- lib/tryon/prompt.ts and the compiler are authoritative for hidden AI instructions.
- lib/try-on-handler.ts is authoritative for the server generation lifecycle.
- Tests describe important security and product invariants.

## Never do casually

- upgrade Next.js or the OpenAI SDK without checking current project guidance
- change model, quality, output format, or timeout without validating cost and API support
- add persistent image storage without a retention/deletion plan
- add a new environment variable without updating .env.example and documentation
- widen CORS or disable origin checks to make the app work
- make catalog images public if they contain proprietary Nasir designs
