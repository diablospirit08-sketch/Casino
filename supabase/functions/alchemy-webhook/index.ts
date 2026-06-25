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
  console.log('[alchemy-webhook] activity count:', payload?.event?.activity?.length ?? 0)

  // Use service role key — bypasses RLS so we can write to Railway tables
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const activity: any[] = payload?.event?.activity ?? []

  for (const act of activity) {
    const toAddr    = act.toAddress?.toLowerCase()
    const fromAddr  = act.fromAddress?.toLowerCase()
    const amountRaw = parseFloat(act.value) || 0
    const txHash    = act.hash ?? null
    const category  = act.category
    const asset     = (act.asset || '').toUpperCase()

    console.log('[alchemy-webhook] activity:', category, asset, fromAddr, '->', toAddr, amountRaw)

    // Drop activity with no tx hash — can't deduplicate safely
    if (!txHash) {
      console.warn('[alchemy-webhook] skipping activity with no txHash')
      continue
    }

    if (amountRaw <= 0) continue

    // Determine the currency: use asset field for ERC-20, otherwise infer from context
    const currency = (category === 'erc20' || category === 'token') && asset
      ? asset
      : null  // will be filled from deposit_addresses lookup

    // Look up the deposit address in the Railway deposit_addresses table
    const { data: depositAddr } = await supabase
      .from('deposit_addresses')
      .select('user_id, currency, network')
      .ilike('address', toAddr)
      .maybeSingle()

    if (!depositAddr) {
      console.log('[alchemy-webhook] no deposit address record for:', toAddr, '— skipping')
      continue
    }

    const resolvedCurrency = currency || depositAddr.currency
    const { user_id, network } = depositAddr

    console.log('[alchemy-webhook] deposit:', resolvedCurrency, amountRaw, 'user:', user_id, 'tx:', txHash)

    // Idempotency: skip if already credited
    const { data: existing } = await supabase
      .from('deposits')
      .select('id')
      .eq('tx_hash', txHash)
      .eq('status', 'credited')
      .maybeSingle()

    if (existing) {
      console.log('[alchemy-webhook] duplicate tx, skipping:', txHash)
      continue
    }

    // Credit the Railway ledger table directly (same Supabase PostgreSQL)
    const { data: ledgerRow, error: ledgerErr } = await supabase
      .from('ledger')
      .insert({
        user_id,
        type: 'deposit',
        currency: resolvedCurrency,
        amount: amountRaw,
        ref_id: txHash,
        meta: { network, tx_hash: txHash, from: fromAddr },
      })
      .select('id')
      .single()

    if (ledgerErr) {
      console.error('[alchemy-webhook] ledger insert error:', ledgerErr.message)
      return new Response('Internal error', { status: 500 })
    }

    // Record in deposits table for history and idempotency
    await supabase.from('deposits').insert({
      user_id,
      currency: resolvedCurrency,
      network,
      amount: amountRaw,
      tx_hash: txHash,
      confirmations: 1,
      required_confs: 1,
      status: 'credited',
      credit_ledger_id: ledgerRow.id,
    })

    console.log('[alchemy-webhook] credited', amountRaw, resolvedCurrency, 'to user', user_id)
  }

  return new Response('ok', { status: 200 })
}
