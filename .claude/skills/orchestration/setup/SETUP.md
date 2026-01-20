# Greenfield Setup Orchestration

A specialized workflow for starting projects from scratch. Ensures modern, stable framework versions and well-considered architectural decisions.

## Why This Exists

When starting from zero, AI assistants (including Claude) often:
- Use outdated package versions from training data
- Skip important architectural decisions
- Default to "safe" but suboptimal patterns
- Miss framework-specific best practices that have evolved

This workflow forces explicit research, version verification, and architectural planning BEFORE any code is written.

## The Setup Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  PHASE 0: RESEARCH (NEW!)                                                   │
│  ────────────────────────                                                   │
│  "What's current?"                                                          │
│  - Research latest stable versions of ALL frameworks                        │
│  - Check for breaking changes in recent versions                            │
│  - Identify deprecated patterns to avoid                                    │
│  - Output: Version manifest + "don't do this anymore" list                  │
│                                                                              │
│                         ↓                                                   │
│                                                                              │
│  PHASE 1: ARCHITECT (EXPANDED)                                              │
│  ─────────────────────────────                                              │
│  "What are we building AND how?"                                            │
│  - All standard architect tasks PLUS:                                       │
│  - Framework selection with justification                                   │
│  - Architecture pattern selection (monolith, microservices, etc.)           │
│  - Database selection with justification                                    │
│  - Hosting/deployment strategy                                              │
│  - Output: Specification + Architecture Decision Records (ADRs)             │
│                                                                              │
│                         ↓                                                   │
│                                                                              │
│  PHASE 2: SCAFFOLD PLANNER                                                  │
│  ─────────────────────────                                                  │
│  "What's the project structure?"                                            │
│  - Define folder structure                                                  │
│  - Define configuration files needed                                        │
│  - Define CI/CD pipeline structure                                          │
│  - Output: Scaffold spec + file tree                                        │
│                                                                              │
│                         ↓                                                   │
│                                                                              │
│  PHASE 3: DEPENDENCY AUDITOR                                                │
│  ───────────────────────────                                                │
│  "Are all versions correct?"                                                │
│  - Verify EVERY dependency version against npm/pypi/etc                     │
│  - Check compatibility between dependencies                                 │
│  - Flag any security advisories                                             │
│  - Output: Verified package.json/requirements.txt/etc                       │
│                                                                              │
│                         ↓                                                   │
│                                                                              │
│  PHASE 4: SCAFFOLD EXECUTOR                                                 │
│  ─────────────────────────                                                  │
│  "Create the foundation"                                                    │
│  - Create folder structure                                                  │
│  - Create all config files                                                  │
│  - Initialize packages with verified versions                               │
│  - Set up linting, formatting, testing                                      │
│  - Output: Working scaffold                                                 │
│                                                                              │
│                         ↓                                                   │
│                                                                              │
│  PHASE 5: SCAFFOLD VERIFIER                                                 │
│  ─────────────────────────                                                  │
│  "Does it actually work?"                                                   │
│  - Run install (npm install, pip install, etc.)                             │
│  - Run build                                                                │
│  - Run tests (should pass with 0 tests)                                     │
│  - Run lint                                                                 │
│  - Verify dev server starts                                                 │
│  - Output: Green checkmarks or fix list                                     │
│                                                                              │
│                         ↓                                                   │
│                                                                              │
│  PHASE 6: DOCUMENTATION                                                     │
│  ──────────────────────                                                     │
│  "Capture decisions for future"                                             │
│  - Generate CLAUDE.md for the project                                       │
│  - Document all architectural decisions                                     │
│  - Create README with setup instructions                                    │
│  - Output: Project documentation                                            │
│                                                                              │
│                         ↓                                                   │
│                                                                              │
│  → Ready for feature orchestration workflow                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Differences from Feature Orchestration

| Aspect | Feature Orchestration | Setup Orchestration |
|--------|----------------------|---------------------|
| Starting point | Existing codebase | Nothing |
| First step | Understand requirements | Research current versions |
| Critical risk | Wrong implementation | Wrong foundation |
| Version handling | Use what's in package.json | Verify every version |
| Architecture | Already decided | Must decide |
| Output | Working feature | Working scaffold |

## Agent Files

| Phase | Agent | File |
|-------|-------|------|
| 0 | Researcher | `setup-agents/researcher.md` |
| 1 | Architect | `setup-agents/architect-setup.md` |
| 2 | Scaffold Planner | `setup-agents/scaffold-planner.md` |
| 3 | Dependency Auditor | `setup-agents/dependency-auditor.md` |
| 4 | Scaffold Executor | `setup-agents/scaffold-executor.md` |
| 5 | Scaffold Verifier | `setup-agents/scaffold-verifier.md` |
| 6 | Documentation | `setup-agents/documentation.md` |

## Common Pitfalls This Prevents

### Version Drift
```
❌ AI defaults to: wrangler@3.5.2 (from training data)
✅ Research finds: wrangler@4.5.2 (current stable)
```

### Deprecated Patterns
```
❌ AI defaults to: getStaticProps in Next.js
✅ Research finds: App Router is now recommended
```

### Missing Modern Features
```
❌ AI defaults to: Manual TypeScript config
✅ Research finds: Framework now has built-in TS support
```

### Incompatible Combinations
```
❌ AI defaults to: React 18 + old testing library
✅ Auditor catches: Need @testing-library/react@14+ for React 18
```

## When to Use This vs Feature Orchestration

**Use Setup Orchestration when:**
- Starting a brand new project
- Major framework upgrade (e.g., Next.js 13 → 14)
- Adding a new major subsystem (e.g., adding a mobile app)
- Migrating to a new stack

**Use Feature Orchestration when:**
- Building on existing codebase
- Adding features to established project
- The foundation already exists and works
