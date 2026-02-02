# CLAUDE.md - AI Assistant Guide for LedgerTerminal

This document provides comprehensive guidance for AI assistants working with the LedgerTerminal codebase.

## Project Overview

**LedgerTerminal** is a SaaS application for helping solopreneurs and small organizations manage budgets, calculate tax deductions, and handle expense management using AI.

- **Stage**: Early MVP/boilerplate phase
- **Architecture**: Monorepo with Turborepo
- **Backend**: NestJS 11 + GraphQL (Apollo Server)
- **Frontend**: Next.js 15 + React 18
- **Databases**: MongoDB (primary), Supabase (PostgreSQL alternative)

## Repository Structure

```
/
├── apps/
│   ├── backend/              # NestJS GraphQL API (@ledgerterminal/backend)
│   │   ├── src/
│   │   │   ├── main.ts       # Application entry point
│   │   │   ├── modules/
│   │   │   │   ├── app.module.ts    # Root module
│   │   │   │   └── health/          # Health check module
│   │   │   └── supabase/            # Supabase integration
│   │   └── scripts/                 # Utility scripts
│   └── frontend/             # Next.js app (@ledgerterminal/frontend)
│       └── app/              # App Router pages
├── packages/                 # Shared libraries (empty, reserved)
├── turbo.json               # Turborepo pipeline config
├── pnpm-workspace.yaml      # Monorepo workspace definition
└── package.json             # Root workspace scripts
```

## Quick Reference Commands

### Development

```bash
# Run entire monorepo in dev mode
pnpm dev

# Run specific app
pnpm --filter @ledgerterminal/backend start:dev
pnpm --filter @ledgerterminal/frontend dev
```

### Building

```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter @ledgerterminal/backend build
pnpm --filter @ledgerterminal/frontend build
```

### Testing

```bash
# Run all tests
pnpm test

# Backend tests only
pnpm --filter @ledgerterminal/backend test

# Test Supabase connection
pnpm --filter @ledgerterminal/backend test:supabase
```

### Linting

```bash
# Lint all apps
pnpm lint

# Lint specific app
pnpm --filter @ledgerterminal/backend lint
pnpm --filter @ledgerterminal/frontend lint
```

## Technology Stack

### Backend (`apps/backend`)

| Category | Technology | Version |
|----------|------------|---------|
| Framework | NestJS | ^11.0.0 |
| GraphQL | Apollo Server + @nestjs/graphql | ^13.0.0 |
| Database | Mongoose (MongoDB) | ^8.0.0 |
| Alt Database | Supabase | ^2.45.0 |
| Caching | ioredis | ^5.4.1 |
| Payments | Stripe | ^16.0.0 |
| Email | SendGrid | ^8.1.0 |
| Auth | Passport (Google, Apple OAuth) | ^0.7.0 |
| Validation | class-validator, class-transformer | ^0.14.1, ^0.5.1 |

### Frontend (`apps/frontend`)

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js | 15.0.0 |
| React | React | 18.3.1 |
| TypeScript | TypeScript | ^5.7.0 |

### Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| pnpm | 9.0.0 | Package manager |
| Turborepo | ^2.0.0 | Build orchestration |
| Node.js | >=18.0.0 | Runtime |
| Jest | ^29.7.0 | Testing |
| ESLint | ^9.0.0 | Linting |
| Prettier | ^3.2.0 | Formatting |

## Code Patterns & Conventions

### Backend (NestJS)

**Module Structure**:
```typescript
// modules are organized by feature
// apps/backend/src/modules/{feature}/
//   - {feature}.module.ts
//   - {feature}.resolver.ts (GraphQL)
//   - {feature}.service.ts
//   - entities/ (Mongoose schemas)
//   - dto/ (Input types)
```

**GraphQL Resolvers**:
```typescript
@Resolver()
export class ExampleResolver {
  constructor(private readonly exampleService: ExampleService) {}

  @Query(() => Example)
  async example(): Promise<Example> {
    return this.exampleService.findOne();
  }
}
```

**Services**:
```typescript
@Injectable()
export class ExampleService {
  constructor(
    @InjectModel(Example.name) private exampleModel: Model<Example>,
    private configService: ConfigService,
  ) {}
}
```

**Configuration Access**:
```typescript
// Use ConfigService for environment variables
const value = this.configService.get<string>('ENV_VAR_NAME');
```

**Global Modules**:
```typescript
// Use @Global() for services needed everywhere
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
```

### Frontend (Next.js)

**App Router Structure**:
```typescript
// apps/frontend/app/page.tsx - Page component
export default function Page() { ... }

// apps/frontend/app/layout.tsx - Layout with metadata
export const metadata: Metadata = { ... };
export default function Layout({ children }) { ... }
```

**Component Style**: Functional components with TypeScript, inline styles (CSS framework not yet configured).

### General Conventions

1. **TypeScript**: Strict typing throughout, no `any` unless necessary
2. **Naming**: camelCase for variables/functions, PascalCase for classes/components
3. **Imports**: Absolute imports within apps, relative for nearby files
4. **Environment Variables**: Never hardcode secrets, use ConfigService/process.env
5. **Error Handling**: Use NestJS built-in exception filters
6. **Validation**: Use class-validator decorators for input validation

## Environment Variables

### Backend Required Variables

Create `apps/backend/.env.local`:

```env
# Database (Required)
MONGODB_URI=mongodb+srv://...

# Server
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000

# Supabase (Optional)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Redis (Optional)
REDIS_URL=redis://...

# Payments (When implementing)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (When implementing)
SENDGRID_API_KEY=SG....

# OAuth (When implementing)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...'
```

## API Endpoints

- **GraphQL Playground**: `http://localhost:4000/graphql`
- **Frontend**: `http://localhost:3000`

### Available GraphQL Queries

```graphql
# Health check
query {
  health
}

# Supabase health check
query {
  supabaseHealth {
    status
    message
    timestamp
  }
}
```

## Key Files Reference

| Purpose | File Path |
|---------|-----------|
| Backend entry | `apps/backend/src/main.ts` |
| Root module | `apps/backend/src/modules/app.module.ts` |
| Health resolver | `apps/backend/src/modules/health/health.resolver.ts` |
| Supabase service | `apps/backend/src/supabase/supabase.service.ts` |
| Frontend home | `apps/frontend/app/page.tsx` |
| Frontend layout | `apps/frontend/app/layout.tsx` |
| Turbo config | `turbo.json` |
| Workspace config | `pnpm-workspace.yaml` |

## Development Workflow

### Adding a New Backend Feature

1. Create module folder: `apps/backend/src/modules/{feature}/`
2. Create module, service, and resolver files
3. Register module in `app.module.ts`
4. Add Mongoose schema if needed (in `entities/` subfolder)
5. Create DTOs for input validation (in `dto/` subfolder)
6. Write tests

### Adding a New Frontend Page

1. Create page in `apps/frontend/app/{route}/page.tsx`
2. Add layout if needed: `apps/frontend/app/{route}/layout.tsx`
3. Use App Router conventions (loading.tsx, error.tsx, etc.)

### Adding Shared Packages

1. Create package in `packages/{package-name}/`
2. Add `package.json` with name `@ledgerterminal/{package-name}`
3. Import in apps using workspace protocol: `@ledgerterminal/{package-name}`

## What's Implemented vs Planned

### Implemented

- Monorepo structure with Turborepo
- NestJS with GraphQL (Apollo Server)
- MongoDB connection via Mongoose
- Supabase module with health check
- Basic Next.js frontend
- CORS configuration
- Request validation pipeline
- Environment configuration

### Not Yet Implemented (Planned)

- Domain models (User, Budget, Transaction, TaxProfile)
- Authentication/Authorization
- CRUD mutations
- File upload (Cloudflare R2 ready)
- Stripe webhook handlers
- SendGrid email service
- OAuth integration (Google, Apple)
- Frontend UI components
- Apollo Client for frontend
- Comprehensive test suite

## Important Notes for AI Assistants

1. **Monorepo Awareness**: Always use `pnpm --filter` to target specific apps
2. **Environment Files**: Backend uses `.env.local` or `.env` in `apps/backend/`
3. **GraphQL Schema**: Auto-generated at `apps/backend/schema.gql` - don't edit manually
4. **Type Safety**: Maintain strict TypeScript throughout
5. **No Hardcoded Secrets**: Always use environment variables
6. **Module Pattern**: Follow NestJS module/service/resolver pattern
7. **Validation**: Use class-validator decorators for all inputs
8. **Testing**: Write tests for new features using Jest
9. **Commit Style**: Descriptive commits explaining what and why

## Documentation

- **README.md**: Complete setup guide and service configuration
- **DEPLOY.md**: Deployment instructions for Vercel/Railway/Netlify
- **GIT_SETUP.md**: Git configuration guide
- **apps/backend/SUPABASE.md**: Supabase integration details
