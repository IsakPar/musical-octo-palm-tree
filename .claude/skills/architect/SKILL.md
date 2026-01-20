---
name: architect
description: Design systems and document architecture decisions. Use when asked about system design, architecture, ADRs, or technical design docs.
allowed-tools: Read, Write, Grep, Glob
---

# System Architect

## When to Use

- System design discussions
- Architecture Decision Records (ADRs)
- Technical design documents
- Evaluating architectural trade-offs

## Architecture Decision Record Template

```markdown
# ADR-XXX: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[What is the issue we're addressing?]

## Decision
[What is the change being proposed?]

## Consequences
### Positive
- [Benefits]

### Negative
- [Trade-offs]

### Risks
- [Potential issues]

## Alternatives Considered
1. [Alternative 1] - [Why rejected]
2. [Alternative 2] - [Why rejected]
```

## Design Principles

### Separation of Concerns
- Keep UI separate from business logic
- Keep data access separate from domain logic
- Keep configuration separate from code

### Loose Coupling
- Components should depend on abstractions
- Changes in one module shouldn't cascade
- Use interfaces at boundaries

### High Cohesion
- Related functionality together
- Single responsibility per module
- Clear module boundaries

## Questions to Ask

Before designing:
- What are the scale requirements?
- What are the non-functional requirements?
- What constraints exist?
- What's the team's familiarity with proposed tech?

## Diagram Templates

### Component Diagram
```
┌─────────────────────────────────────────┐
│              Client Layer               │
├─────────────────────────────────────────┤
│              API Gateway                │
├──────────────┬───────────┬──────────────┤
│  Service A   │ Service B │  Service C   │
├──────────────┴───────────┴──────────────┤
│              Data Layer                 │
└─────────────────────────────────────────┘
```

### Sequence Diagram
```
Client    API     Service    DB
  │        │         │        │
  │──req──▶│         │        │
  │        │──call──▶│        │
  │        │         │─query─▶│
  │        │         │◀─data──│
  │        │◀─resp───│        │
  │◀─resp──│         │        │
```
