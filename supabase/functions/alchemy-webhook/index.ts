import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'node:crypto'

serve(async (req) => {
  try {
    const rawBody = await req.text()

    // Verify Alchemy HMAC signature — require at least one signing key to be configured
    const signingKeys = [
      Deno.env.get('ALCHEMY_SIGNING_KEY_ETH'),
      Deno.env.get('ALCHEMY_SIGNING_KEY_BNB'),
      Deno.env.get('ALCHEMY_SIGNING_KEY'), // legacy fallback
    ].filter(Boolean) as string[]

    if (signingKeys.length === 0) {
      console.error('[alchemy-webhook] no signing keys configured — rejecting request')
      return new Response('Forbidden', { status: 403 })
    }

    const alchemySig = req.headers.get('x-alchemy-signature') ?? ''
    const valid = signingKeys.some(key =>
      createHmac('sha256', key).update(rawBody).digest('hex') === alchemySig
    )
    if (!valid) {
      console.error('[alchemy-webhook] bad signature')
      return new Response('Forbidden', { status: 403 })
    }

    return await handlePayload(JSON.parse(rawBody))
  } catch (e) {
    console.error('[alchemy-webhook] error:', e)
    return new Response('Internal error', { status: 500 })
  }
})

async function handlePayload(payload: any) {
  console.log('[alchemy-webhook] payload keys:', Object.keys(payload ?? {}))
  console.log('[alchemy-webhook] event keys:', Object.keys(payload?.event ?? {}))
  console.log('[alchemy-webhook] activity length:', payload?.event?.activity?.length ?? 'undefined')
  console.log('[alchemy-webhook] raw sample:', JSON.stringify(payload).slice(0, 500))

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const vaultAddr = (Deno.env.get('VAULT_ADDRESS') ?? '').toLowerCase()

  const activity: any[] = payload?.event?.activity ?? []

  for (const act of activity) {
    const toAddr    = act.toAddress?.toLowerCase()
    const fromAddr  = act.fromAddress?.toLowerCase()
    const amountBnb = parseFloat(act.value) || 0
    const txHash    = act.hash ?? null
    const category  = act.category

    console.log('[alchemy-webhook] activity:', category, fromAddr, '->', toAddr, amountBnb, 'BNB')

    if (toAddr !== vaultAddr) continue
    if (amountBnb <= 0) continue
    if (category !== 'external' && category !== 'internal') continue

    // Drop activity with no tx hash — can't deduplicate safely
    if (!txHash) {
      console.warn('[alchemy-webhook] skipping activity with no txHash')
      continue
    }

    const playerAddr = fromAddr

    console.log('[alchemy-webhook] Deposited:', playerAddr, amountBnb, 'BNB tx:', txHash)

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('wallet_address', playerAddr)
      .single()

    if (!profile) {
      console.warn('[alchemy-webhook] no user for wallet:', playerAddr)
      continue
    }

    // Skip duplicate transactions
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('tx_hash', txHash)
      .eq('type', 'deposit')
      .maybeSingle()

    if (existing) {
      console.log('[alchemy-webhook] duplicate tx, skipping:', txHash)
      continue
    }

    // Credit balance atomically
    const { error: balErr } = await supabase.rpc('add_balance', {
      p_user_id:  profile.id,
      p_currency: 'BNB',
      p_amount:   amountBnb,
    })
    if (balErr) {
      console.error('[alchemy-webhook] add_balance error:', balErr.message)
      // Return 500 so Alchemy retries this webhook delivery
      return new Response('Internal error', { status: 500 })
    }

    // Record completed deposit
    await supabase.from('transactions').insert({
      user_id:  profile.id,
      type:     'deposit',
      currency: 'BNB',
      amount:   amountBnb,
      status:   'completed',
      tx_hash:  txHash,
      address:  playerAddr,
    })

    console.log('[alchemy-webhook] credited', amountBnb, 'BNB to user', profile.id)
  }

  return new Response('ok', { status: 200 })
}
