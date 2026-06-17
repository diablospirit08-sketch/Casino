import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
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

async function minePositions(serverSeed: string, minesCount: number): Promise<number[]> {
  const tiles = Array.from({ length: 25 }, (_, i) => i)
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = (await hmacUint32(serverSeed, `m:${i}`)) % (i + 1)
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles.slice(0, minesCount)
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

    const body = await req.json()
    const roundId   = String(body.roundId || '')
    const tileIndex = Math.floor(Number(body.tile))

    if (!roundId || tileIndex < 0 || tileIndex > 24) {
      return new Response(JSON.stringify({ error: 'Invalid parameters' }), { status: 400, headers: CORS })
    }

    /* Fetch the round — must belong to this user and still be active */
    const { data: round, error: re } = await supabase
      .from('mines_rounds')
      .select('id, server_seed, mines_count, safe_tiles')
      .eq('id', roundId)
      .eq('user_id', user.id)
      .single()

    if (re || !round) {
      return new Response(JSON.stringify({ error: 'Round not found or already settled' }), { status: 404, headers: CORS })
    }

    /* Reject duplicate picks */
    const safeTiles: number[] = round.safe_tiles ?? []
    if (safeTiles.includes(tileIndex)) {
      return new Response(JSON.stringify({ error: 'Tile already picked' }), { status: 400, headers: CORS })
    }

    const mines = await minePositions(round.server_seed, round.mines_count)
    const isMine = mines.includes(tileIndex)

    if (isMine) {
      /* Bust — delete the round so place-bet can't be called again */
      await supabase.from('mines_rounds').delete().eq('id', roundId)
      return new Response(
        JSON.stringify({ result: 'mine', serverSeed: round.server_seed, mines }),
        { headers: CORS }
      )
    }

    /* Safe — record the pick */
    const newSafeTiles = [...safeTiles, tileIndex]
    await supabase
      .from('mines_rounds')
      .update({ safe_tiles: newSafeTiles })
      .eq('id', roundId)

    return new Response(
      JSON.stringify({ result: 'safe', safeCount: newSafeTiles.length }),
      { headers: CORS }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }),
      { status: 500, headers: CORS }
    )
  }
})
