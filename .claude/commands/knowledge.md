# Knowledge Command

Generate a codebase knowledge file for AI agents.

$ARGUMENTS

## Instructions

1. **Analyze the codebase**:
   - Identify project type (language, framework)
   - Map directory structure
   - Find key files and entry points
   - Extract commands from package.json/Makefile/etc.

2. **Generate claude_knowledge.md**:

```markdown
# Project Knowledge

## Overview
[Brief description of what this project does]

## Tech Stack
- Language: [e.g., TypeScript]
- Framework: [e.g., Next.js]
- Database: [e.g., PostgreSQL]
- Other: [key dependencies]

## Directory Structure
```
src/
├── components/   # React components
├── pages/        # Next.js pages
├── lib/          # Utilities
└── api/          # API routes
```

## Key Files
- `src/index.ts` - Entry point
- `src/config.ts` - Configuration
- [other important files]

## Commands
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm test         # Run tests
```

## Architecture Notes
[Key architectural decisions, patterns used]

## Development Workflow
[How to make changes, run locally, test]
```

3. **Save to project root** as `claude_knowledge.md`

## Guidelines

- Keep it concise but comprehensive
- Focus on what an AI agent needs to know
- Update when project structure changes
- Include any gotchas or non-obvious patterns
