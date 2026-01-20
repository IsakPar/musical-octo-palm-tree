---
name: docker
description: Containerize applications with Docker. Use when working on Dockerfiles, docker-compose, or container deployments.
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Docker

## Dockerfile Best Practices

### Multi-Stage Builds
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Layer Optimization
```dockerfile
# Bad: Invalidates cache on any file change
COPY . .
RUN npm install

# Good: Cache dependencies separately
COPY package*.json ./
RUN npm ci
COPY . .
```

### Security
```dockerfile
# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Don't include secrets in image
# Use .dockerignore for sensitive files
```

## Common Dockerfiles

### Node.js
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### Go
```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o main .

FROM alpine:latest
COPY --from=builder /app/main /main
EXPOSE 8080
CMD ["/main"]
```

### Python
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
```

## Docker Compose

### Basic Setup
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Development vs Production
```yaml
# docker-compose.yml (base)
services:
  app:
    build: .

# docker-compose.dev.yml (override for dev)
services:
  app:
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev

# Run: docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Common Commands

```bash
# Build
docker build -t myapp .

# Run
docker run -p 3000:3000 myapp

# Run with env file
docker run --env-file .env -p 3000:3000 myapp

# Interactive shell
docker run -it myapp /bin/sh

# Compose commands
docker-compose up -d          # Start detached
docker-compose down           # Stop and remove
docker-compose logs -f app    # Follow logs
docker-compose exec app sh    # Shell into running container
```

## .dockerignore
```
node_modules
.git
.env
.env.local
*.log
dist
.DS_Store
```

## Docker Checklist

- [ ] Multi-stage build for smaller images
- [ ] Dependencies cached separately
- [ ] Running as non-root user
- [ ] No secrets in image
- [ ] .dockerignore configured
- [ ] Health checks defined
- [ ] Proper signal handling (tini, dumb-init)
