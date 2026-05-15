# Contributing to Cerebra

Thank you for your interest in contributing! Cerebra is an open-source project and we welcome contributions of all kinds — bug fixes, new features, documentation improvements, and plugin examples.

Please read this guide before opening a pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Workflow](#workflow)
- [Commit Messages](#commit-messages)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Please report unacceptable behaviour to the maintainers.

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/cerebra-backend.git
   cd cerebra-backend
   ```
3. **Add the upstream remote** so you can pull in future changes:
   ```bash
   git remote add upstream https://github.com/your-org/cerebra-backend.git
   ```

---

## Development Setup

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20+ |
| npm | 9+ |
| PostgreSQL | 14+ |
| Redis | 7+ |

### Install dependencies

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env
# Edit .env with your local credentials
```

### Set up the database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### Start the development server

```bash
npm run dev
```

The server starts on `http://localhost:3000` with hot reload via `ts-node-dev`.

### Verify the build compiles

```bash
npm run build
```

This must pass with zero TypeScript errors before you open a PR.

---

## Project Structure

```
src/
├── services/       # Core business logic — touch these carefully
├── routes/         # Express route handlers — thin, delegate to services
├── middleware/      # Auth, validation
├── queues/         # BullMQ workers and scheduler
├── plugins/        # Plugin registry and example plugins
├── ws/             # WebSocket manager
├── lib/            # Singletons (Prisma, Redis)
├── types/          # Shared TypeScript interfaces
└── utils/          # Logger and small helpers
```

Keep each layer focused on its responsibility. Routes should not contain business logic. Services should not import from routes.

---

## Workflow

1. **Sync with upstream** before starting work:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create a branch** from `main` using a descriptive name:
   ```bash
   git checkout -b feat/dca-plugin        # new feature
   git checkout -b fix/treasury-sync-race # bug fix
   git checkout -b docs/plugin-guide      # documentation
   ```

3. **Make your changes.** Keep commits small and focused.

4. **Build and verify** before pushing:
   ```bash
   npm run build
   ```

5. **Push your branch** and open a pull request against `main`.

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Build process, dependency updates, tooling |
| `perf` | Performance improvement |

**Examples:**

```
feat(plugins): add DCA strategy plugin
fix(treasury): handle missing balance field on new accounts
docs(api): document WebSocket event payload schema
chore(deps): bump @stellar/stellar-sdk to 12.4.0
```

---

## Pull Request Guidelines

- **One concern per PR.** Don't bundle unrelated changes.
- **Fill in the PR template** — describe what changed, why, and how to test it.
- **Link related issues** using `Closes #123` or `Fixes #123` in the description.
- **Keep PRs small.** Large PRs are harder to review and slower to merge.
- **Do not push directly to `main`.** All changes go through PRs.
- **Respond to review comments** promptly. PRs with no activity for 14 days may be closed.

### PR Title Format

Use the same Conventional Commits format as commit messages:

```
feat(agent-engine): support price-based triggers
```

---

## Code Standards

### TypeScript

- Strict mode is enabled (`"strict": true` in `tsconfig.json`). All code must compile without errors.
- Prefer explicit types over `any`. Use `unknown` when the type is genuinely unknown.
- Use `async/await` over raw Promises.
- Export only what is needed. Avoid barrel re-exports unless necessary.

### Style

- 2-space indentation.
- Single quotes for strings.
- Trailing commas in multi-line objects and arrays.
- No unused variables or imports.

### Services

- Services are plain objects with async methods — no classes unless there is a clear reason.
- Services must not import from route handlers.
- All database access goes through Prisma — no raw SQL unless absolutely necessary.

### Error Handling

- Throw descriptive errors. Catch at the route level and return appropriate HTTP status codes.
- Never swallow errors silently. At minimum, log them with `logger.error`.

### Security

- Never log secrets, private keys, or wallet addresses at `debug` level in production.
- Validate all incoming request bodies with Zod before using them.
- See [SECURITY.md](SECURITY.md) for the full security model.

---

## Testing

There is currently no test suite in the repository. If you are adding a significant feature, we strongly encourage you to include tests. We recommend [Vitest](https://vitest.dev/) for unit tests and [Supertest](https://github.com/ladjs/supertest) for integration tests.

When a test suite is established, all PRs will be required to pass tests before merging.

---

## Reporting Bugs

Before opening a bug report, please:

1. Search [existing issues](https://github.com/your-org/cerebra-backend/issues) to avoid duplicates.
2. Reproduce the bug on the latest `main` branch.

When opening an issue, include:

- A clear, descriptive title.
- Steps to reproduce the problem.
- Expected behaviour vs. actual behaviour.
- Relevant logs or error messages.
- Your environment (Node.js version, OS, Stellar network).

---

## Suggesting Features

Open a [GitHub Discussion](https://github.com/your-org/cerebra-backend/discussions) or issue with the `enhancement` label. Describe:

- The problem you are trying to solve.
- Your proposed solution.
- Any alternatives you considered.

Large features should be discussed before implementation to avoid wasted effort.

---

Thank you for helping make Cerebra better. 🧠
