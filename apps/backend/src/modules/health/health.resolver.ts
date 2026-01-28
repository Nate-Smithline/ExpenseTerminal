import { ObjectType, Field, Query, Resolver } from '@nestjs/graphql';
import { SupabaseService } from '../../supabase/supabase.service';

@ObjectType()
export class SupabaseHealth {
  @Field(() => Boolean)
  ok!: boolean;

  @Field(() => String, { nullable: true })
  error!: string | null;
}

@Resolver()
export class HealthResolver {
  constructor(private readonly supabase: SupabaseService) {}

  @Query(() => String, { name: 'health' })
  health(): string {
    return 'ok';
  }

  @Query(() => SupabaseHealth)
  async supabaseHealth(): Promise<SupabaseHealth> {
    const result = await this.supabase.isConnected();
    return { ok: result.ok, error: result.error ?? null };
  }
}


