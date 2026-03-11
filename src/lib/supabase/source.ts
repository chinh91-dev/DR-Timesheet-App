// Client for reading from the SOURCE time-team-tracker Supabase project
import { createClient } from '@supabase/supabase-js'

export function createSourceClient() {
  const url = process.env.SOURCE_SUPABASE_URL
  const key = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SOURCE_SUPABASE_URL and SOURCE_SUPABASE_SERVICE_ROLE_KEY are required')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
