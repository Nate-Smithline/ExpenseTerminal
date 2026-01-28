import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private _client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  get client(): SupabaseClient {
    if (!this._client) {
      const url = this.config.get<string>('SUPABASE_URL');
      const key =
        this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
        this.config.get<string>('SUPABASE_ANON_KEY');
      if (!url || !key) {
        throw new Error(
          'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env.',
        );
      }
      this._client = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
    return this._client;
  }

  /** Check that env is set and Supabase is reachable. */
  async isConnected(): Promise<{ ok: boolean; error?: string }> {
    try {
      const url = this.config.get<string>('SUPABASE_URL');
      const key =
        this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
        this.config.get<string>('SUPABASE_ANON_KEY');
      if (!url || !key) {
        return {
          ok: false,
          error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are required.',
        };
      }
      const client = this.client;
      const { error } = await client.from('_connection_test').select('*').limit(1);
      if (error && error.code !== '42P01') {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message };
    }
  }
}
