---
name: repo-initializer
description: Set up new projects with proper structure. Use when starting a new project, scaffolding, or bootstrapping a repo.
allowed-tools: Read, Write, Bash, Glob
---

# Repository Initializer

## Project Setup Checklist

### 1. Initialize Version Control
```bash
git init
echo "node_modules/\n.env\n.env.local\ndist/\n.DS_Store" > .gitignore
```

### 2. Package Configuration
Create `package.json` with:
- Name, version, description
- Scripts (dev, build, test, lint)
- Dependencies

### 3. Code Quality Tools
- ESLint/Prettier for formatting
- TypeScript for type checking
- Husky for git hooks

### 4. Directory Structure

#### JavaScript/TypeScript Project
```
project/
├── src/
│   ├── index.ts
│   ├── components/
│   ├── utils/
│   └── types/
├── tests/
├── .github/
│   └── workflows/
├── .claude/
│   └── CLAUDE.md
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

#### Go Project
```
project/
├── cmd/
│   └── app/
│       └── main.go
├── internal/
│   ├── handlers/
│   └── models/
├── pkg/
├── .github/
│   └── workflows/
├── .claude/
│   └── CLAUDE.md
├── go.mod
├── .gitignore
└── README.md
```

#### Python Project
```
project/
├── src/
│   └── package_name/
│       ├── __init__.py
│       └── main.py
├── tests/
├── .github/
│   └── workflows/
├── .claude/
│   └── CLAUDE.md
├── pyproject.toml
├── .gitignore
└── README.md
```

## Essential Files

### .gitignore
```gitignore
# Dependencies
node_modules/
vendor/
venv/
__pycache__/

# Build
dist/
build/
*.egg-info/

# Environment
.env
.env.local
.env*.local

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db
```

### README.md
- Project name and description
- Quick start instructions
- Development setup
- Usage examples

### .claude/CLAUDE.md
- Project-specific instructions for Claude
- Build/test commands
- Code conventions

## Setup by Framework

### React (Vite)
```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
```

### Next.js
```bash
npx create-next-app@latest my-app --typescript --tailwind --eslint
```

### Express API
```bash
mkdir my-api && cd my-api
npm init -y
npm install express cors helmet
npm install -D typescript @types/node @types/express ts-node
```

### Go API
```bash
mkdir my-api && cd my-api
go mod init github.com/user/my-api
```

## Questions to Ask

Before scaffolding:
- What type of project? (web app, API, CLI, library)
- What language/framework?
- What package manager? (npm, pnpm, yarn)
- Need CI/CD setup?
- Need Docker setup?
