# Supabase connection (backend)

The backend connects to Supabase using env-based config. No credentials are in code.

## Env variables

Create or edit **`apps/backend/.env.local`** (or `.env`) and set:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL, e.g. `https://xxxxxxxxxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (backend-only; bypasses RLS). Prefer this for Nest. |
| `SUPABASE_ANON_KEY` | Optional. Used if `SUPABASE_SERVICE_ROLE_KEY` is not set (respects RLS). |

Get these in the Supabase dashboard: **Project Settings → API** (`Project URL`, `service_role` and `anon` keys).

Example:

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Test the connection

### 1. Standalone script (no server)

From repo root:

```bash
pnpm --filter @ledgerterminal/backend test:supabase
```

Or from the backend app:

```bash
cd apps/backend
pnpm test:supabase
```

- If you see **`OK – Connected to Supabase`**, env and connectivity are fine.
- If you see **`Missing env: set SUPABASE_URL and ...`**, add the vars to `apps/backend/.env.local` (or `.env`).
- If you see a Supabase/network error, check the URL and key and that the project is running.

### 2. Via GraphQL (with server running)

Start the backend, then open `http://localhost:4000/graphql` and run:

```graphql
query {
  supabaseHealth {
    ok
    error
  }
}
```

- `ok: true` and `error: null` means the connection is working.
- `ok: false` and `error: "..."` means env is missing or Supabase returned an error.

## Using Supabase in the app

Inject `SupabaseService` and use `this.supabaseService.client` for queries:

```ts
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SomeService {
  constructor(private readonly supabase: SupabaseService) {}

  async getThings() {
    const { data, error } = await this.supabase.client
      .from('your_table')
      .select('*');
    if (error) throw new Error(error.message);
    return data;
  }
}
```

Keep `SUPABASE_SERVICE_ROLE_KEY` only on the server and never expose it to the frontend.
