import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function randHex(n: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('')
}

async function hmacUint32(seed: string, msg: string): Promise<number> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(seed),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  const b = new Uint8Array(sig)
  return ((b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0)
}

export async function buildDeck(serverSeed: string) {
  const suits = ['♠', '♥', '♦', '♣']
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
  const deck: { r: string; s: string; v: number }[] = []
  for (const s of suits)
    for (const r of ranks)
      deck.push({ r, s, v: r === 'A' ? 11 : ['J','Q','K','10'].includes(r) ? 10 : +r })

  // Fisher-Yates with HMAC-derived indices — same algorithm used in place-bet replay
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (await hmacUint32(serverSeed, `s:${i}`)) % (i + 1)
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user }, error: ae } = await supabase.auth.getUser(token)
    if (ae || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
    }

    const serverSeed     = randHex(32)
    const serverSeedHash = await sha256hex(serverSeed)
    const deck           = await buildDeck(serverSeed)

    const { data: round, error: re } = await supabase
      .from('bj_rounds')
      .insert({ user_id: user.id, server_seed: serverSeed })
      .select('id')
      .single()
    if (re || !round) throw new Error('Failed to store round')

    return new Response(
      JSON.stringify({ deckId: round.id, cards: deck, serverSeedHash }),
      { headers: CORS }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }),
      { status: 500, headers: CORS }
    )
  }
})
