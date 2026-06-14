import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const activity: any[] = body?.event?.activity ?? [];

    for (const tx of activity) {
      const toAddr: string = tx.toAddress?.toLowerCase();
      const fromAddr: string = tx.fromAddress?.toLowerCase();
      const asset: string = tx.asset;
      const value: number = parseFloat(tx.value) || 0;

      if (!toAddr || value <= 0) continue;

      /* skip contract interactions that aren't transfers */
      if (tx.category !== 'external' && tx.category !== 'erc20') continue;

      /* determine currency */
      let currency: string | null = null;
      if (asset === 'ETH' && tx.category === 'external') currency = 'ETH';
      if (asset === 'BNB' && tx.category === 'external') currency = 'BNB';
      if (asset === 'USDT' && tx.rawContract?.address?.toLowerCase() === USDT_CONTRACT.toLowerCase()) currency = 'USDT';
      if (!currency) continue;

      /* find user by deposit address */
      const { data: depRow } = await supabase
        .from('deposit_addresses')
        .select('user_id')
        .eq('address', toAddr)
        .eq('currency', currency)
        .single();

      if (!depRow) continue;

      const userId = depRow.user_id;

      /* record the deposit */
      const { error: insertErr } = await supabase.from('deposits').insert({
        user_id: userId,
        currency,
        amount: value,
        tx_hash: tx.hash,
        from_address: fromAddr,
      });

      /* skip duplicate tx */
      if (insertErr?.code === '23505') continue;

      /* credit the balance */
      await supabase.from('balances').upsert(
        { user_id: userId, currency, amount: value },
        { onConflict: 'user_id,currency' }
      );

      /* use rpc to atomically add (not overwrite) */
      await supabase.rpc('add_balance', { p_user_id: userId, p_currency: currency, p_amount: value });
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(err.message, { status: 500 });
  }
});
