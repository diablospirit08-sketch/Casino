import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ethers } from 'https://esm.sh/ethers@6'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const HOUSE_WITHDRAW_ABI = [
  'function houseWithdraw(address to, uint256 amount) external',
]

const EVM_CURRENCIES = ['BNB', 'ETH', 'USDT', 'USDC']

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

    const { walletAddress, amountWei, currency } = await req.json()
    const cur = (currency || 'BNB').toUpperCase()

    if (!walletAddress || walletAddress.length < 10) {
      return new Response(JSON.stringify({ error: 'Invalid wallet address' }), { status: 400, headers: CORS })
    }

    if (EVM_CURRENCIES.includes(cur) && !ethers.isAddress(walletAddress)) {
      return new Response(JSON.stringify({ error: 'Invalid EVM wallet address' }), { status: 400, headers: CORS })
    }

    const amount = BigInt(amountWei ?? 0)
    if (amount <= 0n) {
      return new Response(JSON.stringify({ error: 'Amount must be greater than zero' }), { status: 400, headers: CORS })
    }

    const amountNative = Number(amount) / 1e18

    // Debit balance atomically before doing anything on-chain
    const { data: withdrawn, error: we } = await supabase.rpc('create_withdrawal', {
      p_user_id:    user.id,
      p_currency:   cur,
      p_amount_eth: amountNative,
    })
    if (we) {
      return new Response(JSON.stringify({ error: we.message }), { status: 400, headers: CORS })
    }

    // BNB: execute houseWithdraw on-chain from the vault
    if (cur === 'BNB') {
      const privateKey = Deno.env.get('CASHIER_PRIVATE_KEY')
      const vaultAddr  = Deno.env.get('VAULT_ADDRESS')
      const chainId    = parseInt(Deno.env.get('VAULT_CHAIN_ID') || '97')

      if (!privateKey || !vaultAddr) {
        console.error('[create-withdrawal] missing CASHIER_PRIVATE_KEY or VAULT_ADDRESS — queuing for manual processing')
        return new Response(JSON.stringify({
          status: 'pending',
          message: 'Withdrawal queued — will be processed within 24 hours.',
          new_balance: withdrawn?.new_balance ?? null,
        }), { headers: CORS })
      }

      const rpcUrl = chainId === 56
        ? 'https://bsc-dataseed.binance.org/'
        : 'https://data-seed-prebsc-1-s1.binance.org:8545/'

      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const signer   = new ethers.Wallet(privateKey, provider)
      const vault    = new ethers.Contract(vaultAddr, HOUSE_WITHDRAW_ABI, signer)

      console.log('[create-withdrawal] sending houseWithdraw to', walletAddress, amountNative, 'BNB')
      const tx = await vault.houseWithdraw(walletAddress, amount)
      const receipt = await tx.wait(1)
      console.log('[create-withdrawal] confirmed tx:', receipt.hash)

      await supabase.from('transactions').insert({
        user_id:  user.id,
        type:     'withdrawal',
        currency: cur,
        amount:   amountNative,
        status:   'completed',
        tx_hash:  receipt.hash,
        address:  walletAddress,
      })

      return new Response(JSON.stringify({
        status:      'completed',
        txHash:      receipt.hash,
        new_balance: withdrawn?.new_balance ?? null,
      }), { headers: CORS })
    }

    // All other currencies: record as pending for manual processing
    await supabase.from('transactions').insert({
      user_id:  user.id,
      type:     'withdrawal',
      currency: cur,
      amount:   amountNative,
      status:   'pending',
      address:  walletAddress,
    })

    return new Response(JSON.stringify({
      status:      'pending',
      message:     'Withdrawal submitted — will be processed within 24 hours.',
      new_balance: withdrawn?.new_balance ?? null,
    }), { headers: CORS })

  } catch (e) {
    console.error('[create-withdrawal] error:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }),
      { status: 500, headers: CORS }
    )
  }
})
