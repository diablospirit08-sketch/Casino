import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ethers } from 'https://esm.sh/ethers@6'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const VOUCHER_TTL = 3600 // 1 hour

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
    if (ae || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
    }

    const { walletAddress, amountWei } = await req.json()

    if (!ethers.isAddress(walletAddress)) {
      return new Response(JSON.stringify({ error: 'Invalid wallet address' }), { status: 400, headers: CORS })
    }

    const amount = BigInt(amountWei)
    if (amount <= 0n) {
      return new Response(JSON.stringify({ error: 'Amount must be greater than zero' }), { status: 400, headers: CORS })
    }

    /* wallets table stores native units (not wei) */
    const amountNative = Number(amount) / 1e18
    const currency     = Deno.env.get('VAULT_CURRENCY') || 'BNB'

    console.log('[create-withdrawal] userId:', user.id, 'currency:', currency, 'amountNative:', amountNative)

    /* ── atomic balance debit ── */
    const { data: withdrawn, error: we } = await supabase.rpc('create_withdrawal', {
      p_user_id:    user.id,
      p_currency:   currency,
      p_amount_eth: amountNative,
    })
    console.log('[create-withdrawal] rpc result:', JSON.stringify(withdrawn), 'error:', we?.message)
    if (we) {
      return new Response(JSON.stringify({ error: we.message }), { status: 400, headers: CORS })
    }

    /* ── EIP-712 voucher signing ── */
    const privateKey = Deno.env.get('CASHIER_PRIVATE_KEY')
    if (!privateKey) {
      return new Response(JSON.stringify({ error: 'Cashier signer not configured' }), { status: 500, headers: CORS })
    }
    const vaultAddr = Deno.env.get('VAULT_ADDRESS')
    if (!vaultAddr) {
      return new Response(JSON.stringify({ error: 'Vault address not configured' }), { status: 500, headers: CORS })
    }

    const signer  = new ethers.Wallet(privateKey)
    const chainId = parseInt(Deno.env.get('VAULT_CHAIN_ID') || '97') // BSC Testnet default

    console.log('[create-withdrawal] signerAddr:', signer.address)
    console.log('[create-withdrawal] vaultAddr:', vaultAddr)
    console.log('[create-withdrawal] chainId:', chainId)
    console.log('[create-withdrawal] amountWei:', amountWei)
    console.log('[create-withdrawal] walletAddress:', walletAddress)

    const domain = {
      name:              'VoltVault',
      version:           '1',
      chainId,
      verifyingContract: vaultAddr,
    }
    const types = {
      Withdrawal: [
        { name: 'player',   type: 'address' },
        { name: 'amount',   type: 'uint256' },
        { name: 'nonce',    type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    }

    const nonce    = BigInt(ethers.hexlify(ethers.randomBytes(16)))
    const deadline = Math.floor(Date.now() / 1000) + VOUCHER_TTL
    const voucher  = { player: walletAddress, amount, nonce, deadline }

    const signature = await signer.signTypedData(domain, types, voucher)

    // verify locally — if this fails the signing code itself is broken
    const recovered = ethers.verifyTypedData(domain, types, voucher, signature)
    console.log('[create-withdrawal] recovered:', recovered)
    console.log('[create-withdrawal] match:', recovered.toLowerCase() === signer.address.toLowerCase())

    return new Response(
      JSON.stringify({
        amount:      amount.toString(),
        nonce:       nonce.toString(),
        deadline,
        signature,
        new_balance: withdrawn?.new_balance ?? null,
      }),
      { headers: CORS }
    )

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }),
      { status: 500, headers: CORS }
    )
  }
})
