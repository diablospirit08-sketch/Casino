/* VOLT — on-chain cashier bridge (BSC / VoltVault) via Web3Modal AppKit.
   Supports MetaMask, WalletConnect, Coinbase Wallet, Trust Wallet, and 300+ more. */
import { createAppKit } from 'https://esm.sh/@reown/appkit@1.6.8';
import { WagmiAdapter } from 'https://esm.sh/@reown/appkit-adapter-wagmi@1.6.8';
import { bsc, bscTestnet } from 'https://esm.sh/@reown/appkit/networks';
import { reconnect, getAccount, watchAccount, sendTransaction, getPublicClient } from 'https://esm.sh/@wagmi/core@2.16.7';
import { parseEther, encodeFunctionData } from 'https://esm.sh/viem@2.21.54';

const PROJECT_ID = '93a532199ac4f47fc5e2e12f6b87dd7e';
const API = 'https://casino-production-2759.up.railway.app';

/* ── ABI helpers ─────────────────────────────────────────────────────────── */
function pad32(hex){return hex.replace(/^0x/,'').padStart(64,'0');}
const WITHDRAW_SELECTOR='0xfe55892d';
function encodeWithdraw(amount,nonce,deadline,signature){
  const sig=signature.replace(/^0x/,'');
  const sigLen=sig.length/2;
  const sigPadded=sig.padEnd(Math.ceil(sigLen/32)*64,'0');
  return WITHDRAW_SELECTOR
    +pad32(BigInt(amount).toString(16))
    +pad32(BigInt(nonce).toString(16))
    +pad32(BigInt(deadline).toString(16))
    +pad32((0x80).toString(16))
    +pad32(sigLen.toString(16))
    +sigPadded;
}

/* ── Wagmi + AppKit setup ────────────────────────────────────────────────── */
const networks = [bsc, bscTestnet];

const wagmiAdapter = new WagmiAdapter({
  projectId: PROJECT_ID,
  networks,
});

const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId: PROJECT_ID,
  networks,
  defaultNetwork: bscTestnet,
  metadata: {
    name: 'VOLT Casino',
    description: 'Crypto Casino',
    url: location.origin,
    icons: ['https://volt.casino/icon.png'],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#41f0a4',
    '--w3m-border-radius-master': '10px',
  },
});

/* ── state ───────────────────────────────────────────────────────────────── */
let account = null, vaultAddr = null, chainIdHex = null;
const nativeW = window.WALLETS.find(w => w.c === 'BNB');

function setLedgerBnb(amt) {
  if (!nativeW) return;
  nativeW.amt = amt;
  nativeW.fiat = amt * (nativeW.rate || 0);
  renderWallet();
  if (window.gvCurSync) gvCurSync();
}

/* ── backend API ─────────────────────────────────────────────────────────── */
function voltFetch(path, opts) {
  return window.voltApi._fetch(path, opts)
    .then(r => r.json())
    .then(j => { if (j.error) throw new Error(j.error); return j; });
}

function refreshBalance() {
  return voltFetch('/api/wallet/balance/BNB')
    .then(j => setLedgerBnb(parseFloat(j.balance) || 0));
}

/* ── fetch vault config ──────────────────────────────────────────────────── */
async function fetchVaultConfig() {
  if (vaultAddr) return;
  const cfg = await fetch(API + '/api/config').then(r => r.json());
  vaultAddr = cfg.vaultAddress;
  chainIdHex = '0x' + cfg.chainId.toString(16);
  if (!vaultAddr) throw new Error('Vault not configured on backend');
}

/* ── save wallet address to backend ─────────────────────────────────────── */
async function saveWalletAddress(addr) {
  try {
    const j = await voltFetch('/api/wallet/connect-wallet-message?address=' + addr);
    const { signMessage } = await import('https://esm.sh/@wagmi/core@2.16.7');
    const sig = await signMessage(wagmiAdapter.wagmiConfig, { message: j.message, account: addr });
    await voltFetch('/api/wallet/connect-wallet', {
      method: 'POST',
      body: JSON.stringify({ address: addr, network: 'bsc_testnet', signature: sig }),
    });
  } catch (e) {
    console.warn('saveWalletAddress:', e.message);
  }
}

/* ── connect (open Web3Modal picker) ────────────────────────────────────── */
async function connect() {
  await fetchVaultConfig();
  await modal.open();
  // wait for user to connect
  return new Promise((resolve, reject) => {
    const unsub = watchAccount(wagmiAdapter.wagmiConfig, {
      onChange(acc) {
        if (acc.address) {
          unsub();
          account = acc.address;
          afterConnect().then(resolve).catch(reject);
        }
      },
    });
    // timeout after 5 min
    setTimeout(() => { unsub(); reject(new Error('Connection timed out')); }, 300000);
  });
}

async function afterConnect() {
  await saveWalletAddress(account);
  await refreshBalance();
  if (!document.body.classList.contains('authed')) setAuth(true);
  if (window.voltCur !== 'BNB') {
    window.voltCur = 'BNB';
    localStorage.setItem(window.LS_CUR, 'BNB');
    renderWallet();
    if (window.gvCurSync) gvCurSync();
  }
}

/* ── watch for account changes ───────────────────────────────────────────── */
watchAccount(wagmiAdapter.wagmiConfig, {
  onChange(acc) {
    if (acc.address && acc.address !== account) {
      account = acc.address;
      saveWalletAddress(account).then(() => refreshBalance());
      if (window.bscCashier) window.bscCashier._onAccountChange();
    } else if (!acc.address && account) {
      account = null;
      if (window.bscCashier) window.bscCashier._onAccountChange();
    }
  },
});

/* restore session on page load */
reconnect(wagmiAdapter.wagmiConfig).then(() => {
  const acc = getAccount(wagmiAdapter.wagmiConfig);
  if (acc.address) {
    account = acc.address;
    fetchVaultConfig().then(() => refreshBalance()).catch(() => {});
    if (window.bscCashier) window.bscCashier._onAccountChange();
  }
}).catch(() => {});

/* ── deposit ─────────────────────────────────────────────────────────────── */
async function depositEth(amountEth) {
  await fetchVaultConfig();
  const hash = await sendTransaction(wagmiAdapter.wagmiConfig, {
    to: vaultAddr,
    value: parseEther(String(amountEth)),
    chainId: parseInt(chainIdHex, 16),
  });
  await waitForReceipt(hash);
  const j = await voltFetch('/api/deposits/verify-tx', {
    method: 'POST',
    body: JSON.stringify({ txHash: hash, network: 'bsc_testnet' }),
  });
  setLedgerBnb(parseFloat(j.balance) || 0);
}

/* ── cash out ────────────────────────────────────────────────────────────── */
async function cashOut(amountEth) {
  await fetchVaultConfig();
  const v = await voltFetch('/api/wallet/sign-withdrawal', {
    method: 'POST',
    body: JSON.stringify({ amountBnb: amountEth, playerAddress: account, network: 'bsc_testnet' }),
  });
  const data = encodeWithdraw(v.amountWei, v.nonce, v.deadline, v.signature);
  const hash = await sendTransaction(wagmiAdapter.wagmiConfig, {
    to: vaultAddr,
    data,
    chainId: parseInt(chainIdHex, 16),
  });
  const receipt = await waitForReceipt(hash);
  if (receipt.status !== 'success') throw new Error('Withdrawal transaction reverted');
  await refreshBalance();
}

/* ── wait for tx receipt ─────────────────────────────────────────────────── */
async function waitForReceipt(hash) {
  const client = getPublicClient(wagmiAdapter.wagmiConfig);
  return client.waitForTransactionReceipt({ hash });
}

/* ── BSC sections injected into deposit / withdraw modal views ───────────── */
const BSC_DEP_ID = 'bscDepSection';
const BSC_WD_ID  = 'bscWdSection';

function short(a) { return a.slice(0, 6) + '…' + a.slice(-4); }

function renderBscDeposit() {
  const el = document.getElementById(BSC_DEP_ID);
  if (!el) return;
  if (!account) {
    el.innerHTML = '<hr style="border:none;border-top:1px solid var(--line-2);margin:16px 0">'
      + '<p class="dep-lbl" style="margin-top:0">Connect Wallet — Live BNB Deposit</p>'
      + '<button id="bscConnectBtn" class="auth-submit" style="margin-top:0">Connect Wallet</button>'
      + '<p id="bscMsg" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></p>';
    el.querySelector('#bscConnectBtn').addEventListener('click', () => {
      const btn = el.querySelector('#bscConnectBtn');
      btn.disabled = true; btn.textContent = 'Connecting…';
      connect().then(() => {
        renderBscDeposit();
        showToast({ icon: '🔗', title: 'Wallet connected', sub: 'BNB balance is live' });
      }).catch(e => {
        btn.disabled = false; btn.textContent = 'Connect Wallet';
        el.querySelector('#bscMsg').textContent = e.message;
      });
    });
  } else {
    const bnbBal = nativeW ? nativeW.amt : 0;
    el.innerHTML = '<hr style="border:none;border-top:1px solid var(--line-2);margin:16px 0">'
      + '<p class="dep-lbl" style="margin-top:0">Live BNB Deposit</p>'
      + '<p style="font-size:12px;color:var(--muted);margin-bottom:10px">Connected: <span style="color:var(--mint)">' + short(account) + '</span>'
      + ' <button id="bscDisconnect" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;text-decoration:underline">Disconnect</button></p>'
      + '<div class="gv-input" style="margin-bottom:10px">'
      + '<input id="bscDepAmt" type="number" min="0.001" step="0.001" placeholder="BNB amount" style="background:transparent;border:none;outline:none;color:var(--txt);font-family:inherit;font-size:14px;width:100%;padding:0"/>'
      + '<button class="mod" id="bscDepMax">Max</button>'
      + '</div>'
      + '<button id="bscDepBtn" class="auth-submit" style="margin-top:0">Deposit BNB</button>'
      + '<p id="bscMsg" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></p>';
    const amtEl = el.querySelector('#bscDepAmt');
    el.querySelector('#bscDepMax').addEventListener('click', () => { amtEl.value = bnbBal.toFixed(4); });
    el.querySelector('#bscDisconnect').addEventListener('click', () => { modal.disconnect(); });
    el.querySelector('#bscDepBtn').addEventListener('click', () => {
      const a = parseFloat(amtEl.value) || 0;
      if (a <= 0) { el.querySelector('#bscMsg').textContent = 'Enter a BNB amount'; return; }
      const btn = el.querySelector('#bscDepBtn');
      btn.disabled = true; btn.textContent = 'Sending…';
      depositEth(a).then(() => {
        btn.disabled = false; btn.textContent = 'Deposit BNB';
        amtEl.value = ''; el.querySelector('#bscMsg').textContent = '';
        showToast({ icon: '↙', title: 'Deposit confirmed', sub: 'BNB balance updated' });
      }).catch(e => {
        btn.disabled = false; btn.textContent = 'Deposit BNB';
        el.querySelector('#bscMsg').textContent = e.message;
      });
    });
  }
}

function renderBscWithdraw() {
  const el = document.getElementById(BSC_WD_ID);
  if (!el) return;
  if (!account) {
    el.innerHTML = '<hr style="border:none;border-top:1px solid var(--line-2);margin:16px 0">'
      + '<p class="dep-lbl" style="margin-top:0">Connect Wallet — Live BNB Withdrawal</p>'
      + '<button id="bscWdConnectBtn" class="auth-submit" style="margin-top:0">Connect Wallet</button>'
      + '<p id="bscWdMsg" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></p>';
    el.querySelector('#bscWdConnectBtn').addEventListener('click', () => {
      const btn = el.querySelector('#bscWdConnectBtn');
      btn.disabled = true; btn.textContent = 'Connecting…';
      connect().then(() => {
        renderBscWithdraw();
        showToast({ icon: '🔗', title: 'Wallet connected', sub: 'BNB balance is live' });
      }).catch(e => {
        btn.disabled = false; btn.textContent = 'Connect Wallet';
        el.querySelector('#bscWdMsg').textContent = e.message;
      });
    });
  } else {
    const bnbBal = nativeW ? nativeW.amt : 0;
    el.innerHTML = '<hr style="border:none;border-top:1px solid var(--line-2);margin:16px 0">'
      + '<p class="dep-lbl" style="margin-top:0">Live BNB Withdrawal</p>'
      + '<p style="font-size:12px;color:var(--muted);margin-bottom:10px">Connected: <span style="color:var(--mint)">' + short(account) + '</span>'
      + ' · Available: <b style="color:var(--txt)">' + bnbBal.toFixed(4) + ' BNB</b>'
      + ' <button id="bscWdDisconnect" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;text-decoration:underline">Disconnect</button></p>'
      + '<div class="gv-input" style="margin-bottom:10px">'
      + '<input id="bscWdAmt" type="number" min="0.001" step="0.001" placeholder="BNB amount" style="background:transparent;border:none;outline:none;color:var(--txt);font-family:inherit;font-size:14px;width:100%;padding:0"/>'
      + '<button class="mod" id="bscWdMax">Max</button>'
      + '</div>'
      + '<button id="bscWdBtn" class="auth-submit" style="margin-top:0">Cash Out BNB</button>'
      + '<p id="bscWdMsg" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></p>';
    const amtEl = el.querySelector('#bscWdAmt');
    el.querySelector('#bscWdMax').addEventListener('click', () => { amtEl.value = bnbBal.toFixed(4); });
    el.querySelector('#bscWdDisconnect').addEventListener('click', () => { modal.disconnect(); });
    el.querySelector('#bscWdBtn').addEventListener('click', () => {
      const a = Math.min(parseFloat(amtEl.value) || 0, bnbBal);
      if (a <= 0) { el.querySelector('#bscWdMsg').textContent = 'Enter a BNB amount'; return; }
      const btn = el.querySelector('#bscWdBtn');
      btn.disabled = true; btn.textContent = 'Processing…';
      cashOut(a).then(() => {
        btn.disabled = false; btn.textContent = 'Cash Out BNB';
        amtEl.value = ''; el.querySelector('#bscWdMsg').textContent = '';
        showToast({ icon: '↗', title: 'Withdrawal sent', sub: 'BNB sent to your wallet' });
      }).catch(e => {
        btn.disabled = false; btn.textContent = 'Cash Out BNB';
        el.querySelector('#bscWdMsg').textContent = e.message;
      });
    });
  }
}

/* ── inject BSC sections into the deposit modal ──────────────────────────── */
(function injectSections() {
  const depView = document.getElementById('depView');
  const wdView  = document.getElementById('wdView');
  if (depView && !document.getElementById(BSC_DEP_ID)) {
    const sec = document.createElement('div');
    sec.id = BSC_DEP_ID;
    depView.appendChild(sec);
  }
  if (wdView && !document.getElementById(BSC_WD_ID)) {
    const sec = document.createElement('div');
    sec.id = BSC_WD_ID;
    wdView.appendChild(sec);
  }
})();

/* ── public API ──────────────────────────────────────────────────────────── */
window.bscCashier = {
  isConnected: () => !!account,
  getAccount:  () => account,
  connect, depositEth, cashOut, refreshBalance,
  openModal:   () => modal.open(),
  renderBscDeposit, renderBscWithdraw,
  _onAccountChange() { renderBscDeposit(); renderBscWithdraw(); },
};

/* ── wire BSC sections to coin selection & tab switches ──────────────────── */
function selectedCoinIn(id) {
  const sel = document.querySelector('#' + id + ' .dep-coin.sel');
  return sel ? sel.dataset.c : null;
}

document.getElementById('walletDep').addEventListener('click', () => {
  setTimeout(() => { if (selectedCoinIn('depCoins') === 'BNB') renderBscDeposit(); }, 50);
});

const depCoinsEl = document.getElementById('depCoins');
depCoinsEl && depCoinsEl.addEventListener('click', e => {
  const b = e.target.closest('.dep-coin'); if (!b) return;
  const sec = document.getElementById(BSC_DEP_ID);
  if (b.dataset.c === 'BNB') setTimeout(renderBscDeposit, 50);
  else if (sec) sec.innerHTML = '';
});

const wdCoinsEl = document.getElementById('wdCoins');
wdCoinsEl && wdCoinsEl.addEventListener('click', e => {
  const b = e.target.closest('.dep-coin'); if (!b) return;
  const sec = document.getElementById(BSC_WD_ID);
  if (b.dataset.c === 'BNB') setTimeout(renderBscWithdraw, 50);
  else if (sec) sec.innerHTML = '';
});

const depTabsEl = document.getElementById('depTabs');
depTabsEl && depTabsEl.addEventListener('click', e => {
  const t = e.target.closest('.auth-tab'); if (!t) return;
  setTimeout(() => {
    if (t.dataset.mode === 'dep' && selectedCoinIn('depCoins') === 'BNB') renderBscDeposit();
    if (t.dataset.mode === 'wd'  && selectedCoinIn('wdCoins')  === 'BNB') renderBscWithdraw();
  }, 50);
});
