# Contributing to HookTrials

Thank you for helping make webhook integrations more reliable.

## Before opening a pull request

1. Open or reference an issue for behavior changes.
2. Keep the service boundaries described in `docs/architecture.md`.
3. Add tests for scenario-engine and security-sensitive behavior.
4. Run `pnpm check`.
5. Do not commit payload samples containing personal data, credentials or real signatures.
6. Do not add environment files or private notes.

## Commit scope

Prefer focused commits with a clear reason. Generated database migrations must be committed with
the schema change that produced them.

## Security

Do not publicly disclose an exploitable vulnerability. Follow SECURITY.md.
