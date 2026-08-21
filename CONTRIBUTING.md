# Contributing to ShardNote

Thank you for helping improve ShardNote.

## Setup

1. Fork and clone the repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and use a disposable test vault.
4. Run `npm run dev` for localhost or `npm run dev:lan` on a trusted network.

Never test destructive or migration behavior against your only copy of a real vault.

## Pull requests

- Keep filesystem operations behind `src/lib/vault.ts`.
- Add tests for path, authentication, or data-integrity changes.
- Do not commit personal notes, `.env` files, secrets, build outputs, or `.shardnote` recovery data.
- Run `npm run check` and `git diff --check` before submitting.
- Document behavior and configuration changes.

ShardNote is independent and must not reuse third-party brand assets.
