# Agent instructions

This repo holds the docs, skills and lint rules that other Effect 4 projects install. Read [docs/WRITING.md](docs/WRITING.md) before you write a doc, a commit message or a reply.

- A rule or script never names a path of one project. It reads the path from `architecture.config.ts` through `config.js` or `lint/project.js`.
- Docs and skills use neutral examples, such as orders and invoices, never one project's nouns.
- Each rule has a fixture under `fixtures/` that a test lints. Add one with each new rule.
- Run `bun run test` and `bun run check` before you finish, and report failures as they are.
