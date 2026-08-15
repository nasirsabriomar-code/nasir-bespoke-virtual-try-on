# Contributing

## Before opening a change

Read:

- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- SECURITY.md
- ROADMAP.md
- AI_AGENT_GUIDE.md

## Local setup

    npm ci
    cp .env.example .env.local
    npm run dev

Do not put real credentials in commits, issues, pull requests, screenshots, or chat.

## Validation requirements

Run the complete suite before requesting review:

    npm run lint
    npm run typecheck
    npm test
    npm run build

## Change expectations

- Keep changes scoped and explain why they are needed.
- Preserve server-only OpenAI access.
- Preserve authentication, rate limits, origin checks, and upload validation.
- Update .env.example and documentation when configuration changes.
- Add tests for new validation, catalog, prompt, auth, or API behavior.
- Do not perform a paid generation to validate a code-only change.
- Do not deploy directly from an unreviewed branch.

## Pull requests

Every pull request should state:

1. What changed.
2. Why it changed.
3. Files/components affected.
4. Security or privacy impact.
5. Tests and build commands run.
6. Any manual Vercel, OpenAI, or Upstash action required.
7. Any remaining limitation.
