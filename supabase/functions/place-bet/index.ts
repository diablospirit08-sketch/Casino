import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

/* ── provably fair: HMAC-SHA256(serverSeed, clientSeed:nonce:index) → float [0,1) ── */
async function hmacFloat(serverSeed: string, clientSeed: string, nonce: number, index: number): Promise<number> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(serverSeed),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${clientSeed}:${nonce}:${index}`)
  )
  const b = new Uint8Array(sig)
  return ((b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0) / 0x100000000
}

async function sha256hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('')
}

function randHex(n: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map(b => b.toString(16).padStart(2,'0')).join('')
}

/* ── plinko multiplier tables ── */
const PLINKO: Record<string, Record<number, number[]>> = {
  low:    { 8:[5.6,2.1,1.1,1,0.5,1,1.1,2.1,5.6], 12:[10,3,1.6,1.4,1.1,1,0.5,1,1.1,1.4,1.6,3,10], 16:[16,9,2,1.4,1.4,1.2,1.1,1,0.5,1,1.1,1.2,1.4,1.4,2,9,16] },
  medium: { 8:[13,3,1.3,0.7,0.4,0.7,1.3,3,13],   12:[33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33],   16:[110,41,10,5,3,1.5,1,0.5,0.3,0.5,1,1.5,3,5,10,41,110] },
  high:   { 8:[29,4,1.5,0.3,0.2,0.3,1.5,4,29],   12:[170,24,8.1,2,0.7,0.2,0.2,0.2,0.7,2,8.1,24,170], 16:[1000,130,26,9,4,2,0.2,0.2,0.2,0.2,0.2,2,4,9,26,130,1000] },
}

/* ── keno payout tables ── */
const KENO: Record<string, Record<number, number[]>> = {
  low:    { 1:[0.7,1.85], 2:[0,2,3.8], 3:[0,1.1,1.38,26], 4:[0,0,2.2,7.9,90], 5:[0,0,1.5,4.2,13,300], 6:[0,0,1.1,2,6.2,100,700], 7:[0,0,1.1,1.6,3.5,15,225,700], 8:[0,0,1.1,1.5,2,5.5,39,100,800], 9:[0,0,1.1,1.3,1.7,2.5,7.5,50,250,1000], 10:[0,0,1.1,1.2,1.3,1.8,3.5,13,50,250,1000] },
  medium: { 1:[0.4,2.75], 2:[0,1.8,5.1], 3:[0,0,2.8,50], 4:[0,0,1.7,10,100], 5:[0,0,1.4,4,14,390], 6:[0,0,0,3,9,180,710], 7:[0,0,0,2,7,30,400,800], 8:[0,0,0,2,4,11,67,400,900], 9:[0,0,0,2,2.5,5,15,100,500,1000], 10:[0,0,0,1.6,2,4,7,26,100,500,1000] },
  high:   { 1:[0,3.96], 2:[0,0,17.1], 3:[0,0,0,81.5], 4:[0,0,0,10,259], 5:[0,0,0,4.5,48,450], 6:[0,0,0,0,11,350,710], 7:[0,0,0,0,7,90,400,800], 8:[0,0,0,0,5,20,270,600,900], 9:[0,0,0,0,4,11,56,500,800,1000], 10:[0,0,0,0,3.5,8,13,63,500,800,1000] },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    /* ── auth ── */
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user }, error: ae } = await supabase.auth.getUser(token)
    if (ae || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    const { game, currency, wager, params = {}, clientSeed: rawClient, nonce: rawNonce } = await req.json()
    if (!game || !currency || !wager || wager <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid parameters' }), { status: 400, headers: CORS })
    }

    /* ── provably fair seeds ── */
    const serverSeed   = randHex(32)
    const serverSeedHash = await sha256hex(serverSeed)
    const clientSeed   = String(rawClient || randHex(8))
    const nonce        = Math.max(0, Math.floor(Number(rawNonce) || 0))

    /* shorthand for this bet's HMAC float */
    const rnd = (i: number) => hmacFloat(serverSeed, clientSeed, nonce, i)

    /* ── server-side outcome generation ── */
    let multiplier: number
    let outcome: string
    let gameData: Record<string, unknown> = {}

    switch (game) {

      case 'dice': {
        const chance = Math.max(2, Math.min(98, Number(params.chance) || 50))
        const over   = Boolean(params.over ?? true)
        const roll   = +(await rnd(0) * 100).toFixed(2)
        const target = over ? 100 - chance : chance
        const win    = over ? roll > target : roll < target
        multiplier   = win ? 99 / chance : 0
        outcome      = win ? 'win' : 'loss'
        gameData     = { roll, target, over }
        break
      }

      case 'coinflip': {
        const side   = String(params.side || 'don')
        const result = (await rnd(0)) < 0.5 ? 'don' : 'snitch'
        const win    = result === side
        multiplier   = win ? 1.98 : 0
        outcome      = win ? 'win' : 'loss'
        gameData     = { result, side }
        break
      }

      case 'plinko': {
        const rows = Math.max(8, Math.min(16, Number(params.rows) || 12))
        const risk = ['low','medium','high'].includes(params.risk) ? params.risk : 'medium'
        const tbl  = PLINKO[risk]?.[rows] ?? PLINKO.medium[12]
        let pos = 0
        const path: number[] = []
        for (let i = 0; i < rows; i++) {
          pos += (await rnd(i)) < 0.5 ? 0 : 1
          path.push(pos)
        }
        multiplier = tbl[pos] ?? 1
        outcome    = multiplier > 1 ? 'win' : multiplier === 1 ? 'push' : 'loss'
        gameData   = { path, pos, rows, risk }
        break
      }

      case 'keno': {
        const picks = Array.isArray(params.picks) ? params.picks.map(Number) : []
        const diff  = ['low','medium','high'].includes(params.diff) ? params.diff : 'medium'
        if (!picks.length || picks.length > 10) {
          return new Response(JSON.stringify({ error: 'Invalid picks' }), { status: 400, headers: CORS })
        }
        const pool = Array.from({ length: 40 }, (_, i) => i + 1)
        const draws: number[] = []
        for (let i = 0; i < 10; i++) {
          const idx = Math.floor((await rnd(i)) * pool.length)
          draws.push(pool.splice(idx, 1)[0])
        }
        const hits = picks.filter(p => draws.includes(p)).length
        const tbl  = KENO[diff]?.[picks.length]
        multiplier  = tbl?.[hits] ?? 0
        outcome     = multiplier > 1 ? 'win' : multiplier === 1 ? 'push' : 'loss'
        gameData    = { picks, draws, hits, diff }
        break
      }

      case 'crash': {
        const cashout = Number(params.cashout) || 0
        const r       = await rnd(0)
        const bust    = Math.min(1000, Math.max(1, 0.99 / Math.max(1e-9, r)))
        const win     = cashout > 1 && cashout <= bust
        multiplier    = win ? cashout : 0
        outcome       = win ? 'win' : 'loss'
        gameData      = { bust: +bust.toFixed(2), cashout }
        break
      }

      case 'mines': {
        const action     = String(params.action || 'cashout')
        const minesCount = Math.max(1, Math.min(24, Math.floor(Number(params.mines) || 3)))
        const k          = Math.max(0, Math.min(25 - minesCount, Math.floor(Number(params.k) || 0)))
        if (action === 'cashout' && k > 0) {
          // Recompute multiplier server-side — client cannot inflate it
          let f = 1
          for (let i = 0; i < k; i++) f *= (25 - i) / (25 - minesCount - i)
          multiplier = parseFloat((0.99 * f).toFixed(6))
          outcome    = 'win'
        } else {
          multiplier = 0
          outcome    = 'loss'
        }
        gameData = { action, mines: minesCount, k }
        break
      }

      case 'blackjack': {
        const bj_outcome = String(params.outcome || 'push')
        const clientMult = Number(params.multiplier) || 0
        // Snap to nearest known-valid multiplier to prevent client inflation
        const VALID      = [0, 1, 1.5, 1.98, 2, 2.5, 3]
        multiplier       = VALID.reduce((a, b) => Math.abs(b - clientMult) < Math.abs(a - clientMult) ? b : a)
        outcome          = bj_outcome === 'win' ? 'win' : bj_outcome === 'lose' ? 'loss' : 'push'
        gameData         = {
          outcome: bj_outcome,
          dealer:  String(params.dealer || ''),
          hands:   String(params.hands  || ''),
          insBet:  Number(params.insBet || 0),
        }
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown game: ${game}` }), { status: 400, headers: CORS })
    }

    /* ── atomic settlement ── */
    const profit = wager * (multiplier - 1)

    const { data: settled, error: se } = await supabase.rpc('settle_bet', {
      p_user_id:    user.id,
      p_currency:   currency,
      p_wager:      wager,
      p_profit:     profit,
      p_game:       game,
      p_outcome:    outcome,
      p_multiplier: multiplier,
      p_game_data:  { ...gameData, serverSeed, serverSeedHash, clientSeed, nonce },
    })

    if (se) return new Response(JSON.stringify({ error: se.message }), { status: 400, headers: CORS })

    return new Response(
      JSON.stringify({ ...settled, multiplier, outcome, gameData, serverSeed, serverSeedHash, clientSeed, nonce }),
      { headers: CORS }
    )

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }),
      { status: 500, headers: CORS }
    )
  }
})
