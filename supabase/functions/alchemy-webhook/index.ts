import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'node:crypto'

// keccak256("Deposited(address,uint256)") — VoltVault event topic
const DEPOSITED_TOPIC = '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c'

serve(async (req) => {
  try {
    const rawBody = await req.text()

    // Verify Alchemy HMAC signature when signing key is configured
    const signingKey = Deno.env.get('ALCHEMY_SIGNING_KEY')
    if (signingKey) {
      const alchemySig = req.headers.get('x-alchemy-signature') ?? ''
      const expected   = createHmac('sha256', signingKey).update(rawBody).digest('hex')
      if (alchemySig !== expected) {
        console.error('[alchemy-webhook] bad signature')
        return new Response('Forbidden', { status: 403 })
      }
    }

    return await handlePayload(JSON.parse(rawBody))
  } catch (e) {
    console.error('[alchemy-webhook] error:', e)
    return new Response('Internal error', { status: 500 })
  }
})

async function handlePayload(payload: any) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const vaultAddr = (Deno.env.get('VAULT_ADDRESS') ?? '').toLowerCase()

  // Alchemy "Address Activity" webhook — logs live in event.activity[].log
  // or inside event.data.block.logs depending on webhook type
  const activity: any[] = payload?.event?.activity ?? []

  for (const act of activity) {
    const log = act?.log ?? act
    if (!log?.topics) continue

    if (
      log.address?.toLowerCase() !== vaultAddr ||
      log.topics[0] !== DEPOSITED_TOPIC
    ) continue

    // player is topics[1]: 32-byte padded address → take last 20 bytes
    const playerAddr = ('0x' + log.topics[1].slice(26)).toLowerCase()
    const amountWei  = BigInt(log.data ?? '0x0')
    const amountBnb  = Number(amountWei) / 1e18
    const txHash     = log.transactionHash ?? act.hash ?? null

    console.log('[alchemy-webhook] Deposited:', playerAddr, amountBnb, 'BNB tx:', txHash)

    if (amountBnb <= 0) continue

    // Find Supabase user by wallet address (case-insensitive)
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
      continue
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
