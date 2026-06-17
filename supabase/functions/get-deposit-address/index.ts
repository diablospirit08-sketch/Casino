import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { HDNodeWallet, Mnemonic } from 'npm:ethers@6';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_IDS: Record<string, string> = {
  ETH:  'ALCHEMY_WEBHOOK_ID_ETH',
  USDT: 'ALCHEMY_WEBHOOK_ID_ETH',
  BNB:  'ALCHEMY_WEBHOOK_ID_BNB',
};

async function addAddressToWebhook(address: string, currency: string) {
  const secretKey = WEBHOOK_IDS[currency] ?? 'ALCHEMY_WEBHOOK_ID_ETH';
  const webhookId = Deno.env.get(secretKey);
  if (!webhookId) return;
  await fetch('https://dashboard.alchemy.com/api/update-webhook-addresses', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Alchemy-Token': Deno.env.get('ALCHEMY_AUTH_TOKEN')!,
    },
    body: JSON.stringify({
      webhook_id: webhookId,
      addresses_to_add: [address],
      addresses_to_remove: [],
    }),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const jwt = req.headers.get('authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS });

    const url = new URL(req.url);
    const currency = url.searchParams.get('currency') || 'ETH';

    if (!['ETH', 'USDT', 'BNB'].includes(currency)) {
      return new Response(JSON.stringify({ error: 'Currency not supported yet' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    /* return existing address if already generated */
    const { data: existing } = await supabase
      .from('deposit_addresses')
      .select('address')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ address: existing.address }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    /* Atomically claim the next HD index (advisory lock inside the RPC
       ensures concurrent requests for the same currency get distinct slots). */
    const { data: claimedIndex, error: slotErr } = await supabase.rpc('claim_deposit_address_slot', {
      p_user_id:  user.id,
      p_currency: currency,
    });
    if (slotErr) throw slotErr;

    const index = claimedIndex as number;

    const mnemonic = Mnemonic.fromPhrase(Deno.env.get('MASTER_MNEMONIC')!);
    const address = HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`).address;

    /* Fill in the real address on the placeholder row the RPC created */
    await supabase
      .from('deposit_addresses')
      .update({ address })
      .eq('user_id', user.id)
      .eq('currency', currency)
      .eq('address_index', index);

    /* register with Alchemy so it starts watching this address */
    await addAddressToWebhook(address, currency);

    return new Response(JSON.stringify({ address }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('get-deposit-address error:', err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
});
