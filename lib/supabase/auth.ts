import type { User } from '@supabase/supabase-js';
import { cache } from 'react';
import type { HeaderAuthState } from '../auth/header.ts';
import {
  getAccountAvatarLetter,
  readDisplayName,
} from '../auth/display-name.ts';
import { createServerSupabaseClient } from './server.ts';

export const getVerifiedServerUser = cache(async (): Promise<{
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: User | null;
}> => {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  return { client, user: error ? null : data.user };
});

export async function loadHeaderAuthState(): Promise<HeaderAuthState> {
  try {
    const { user } = await getVerifiedServerUser();
    if (!user) return { authenticated: false };

    const displayName = readDisplayName(user.user_metadata);
    return {
      authenticated: true,
      displayName,
      avatarLetter: getAccountAvatarLetter(displayName, user.email),
    };
  } catch {
    return { authenticated: false };
  }
}
