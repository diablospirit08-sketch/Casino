/* VOLT — avatar picker */

const AVATARS = [
  {id:'av1', name:'The Don',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#0d1a0d"/><ellipse cx="50" cy="60" rx="19" ry="22" fill="#d4a574"/><ellipse cx="50" cy="37" rx="19" ry="14" fill="#d4a574"/><ellipse cx="50" cy="30" rx="28" ry="7" fill="#1c0e02"/><rect x="26" y="10" width="48" height="24" rx="11" fill="#1c0e02"/><rect x="26" y="28" width="48" height="6" fill="#c8a020"/><ellipse cx="41" cy="57" rx="3.5" ry="3" fill="#111"/><ellipse cx="59" cy="57" rx="3.5" ry="3" fill="#111"/><path d="M38 68q6-4 12 0q6-4 12 0" stroke="#1c0e02" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`},

  {id:'av2', name:'The Dealer',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#1e0505"/><ellipse cx="50" cy="57" rx="18" ry="22" fill="#f0c898"/><ellipse cx="50" cy="33" rx="18" ry="13" fill="#f0c898"/><rect x="38" y="74" width="24" height="4" rx="2" fill="#f5f5f5"/><path d="M44 72 L50 78 L56 72" fill="#cc1111"/><ellipse cx="41" cy="53" rx="3.5" ry="3" fill="#1a1a1a"/><ellipse cx="59" cy="53" rx="3.5" ry="3" fill="#1a1a1a"/><text x="50" y="46" font-size="14" text-anchor="middle" fill="#cc1111" font-family="serif">♠</text><path d="M38 65q12 6 24 0" stroke="#c09070" stroke-width="1.5" fill="none"/></svg>`},

  {id:'av3', name:'The Shark',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#050f20"/><ellipse cx="50" cy="59" rx="19" ry="21" fill="#d4a87a"/><ellipse cx="50" cy="36" rx="19" ry="13" fill="#d4a87a"/><rect x="32" y="49" width="36" height="11" rx="5.5" fill="#c8a012"/><ellipse cx="41" cy="54" rx="4" ry="3" fill="#050f20"/><ellipse cx="59" cy="54" rx="4" ry="3" fill="#050f20"/><circle cx="42" cy="54" r="1.8" fill="#4af"/><circle cx="60" cy="54" r="1.8" fill="#4af"/><rect x="32" y="49" width="2" height="11" rx="1" fill="#e8b818"/><rect x="66" y="49" width="2" height="11" rx="1" fill="#e8b818"/><path d="M39 68q11 6 22 0" stroke="#b49060" stroke-width="1.5" fill="none"/></svg>`},

  {id:'av4', name:'Lucky',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#061a06"/><ellipse cx="50" cy="59" rx="19" ry="21" fill="#f5d090"/><ellipse cx="50" cy="37" rx="19" ry="13" fill="#f5d090"/><circle cx="50" cy="16" r="7" fill="#22aa44"/><circle cx="43" cy="23" r="7" fill="#22aa44"/><circle cx="57" cy="23" r="7" fill="#22aa44"/><circle cx="50" cy="30" r="7" fill="#22aa44"/><rect x="48" y="30" width="4" height="8" fill="#22aa44"/><circle cx="41" cy="55" r="4" fill="#1a1a1a"/><circle cx="59" cy="55" r="4" fill="#1a1a1a"/><circle cx="42.5" cy="53.5" r="1.5" fill="#fff"/><circle cx="60.5" cy="53.5" r="1.5" fill="#fff"/><path d="M38 66q12 8 24 0" stroke="#d4b060" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`},

  {id:'av5', name:'The Ember',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#1a0500"/><ellipse cx="50" cy="62" rx="18" ry="21" fill="#f0c090"/><ellipse cx="50" cy="41" rx="18" ry="17" fill="#f0c090"/><path d="M32 42 Q38 20 46 30 Q48 12 50 22 Q52 10 54 28 Q62 18 68 38 Q56 26 54 42 Q52 28 50 44 Q48 28 46 42 Q44 26 32 42Z" fill="#ff5500"/><path d="M36 38 Q41 24 46 32 Q48 18 50 28 Q52 16 54 30 Q59 22 64 36" fill="#ffaa00"/><ellipse cx="41" cy="58" rx="3.5" ry="3.5" fill="#111"/><ellipse cx="59" cy="58" rx="3.5" ry="3.5" fill="#111"/><path d="M39 70q11 6 22 0" stroke="#c09060" stroke-width="2" fill="none"/></svg>`},

  {id:'av6', name:'The Duchess',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#1a0510"/><ellipse cx="50" cy="59" rx="18" ry="21" fill="#f5c8b0"/><ellipse cx="50" cy="35" rx="20" ry="15" fill="#f5c8b0"/><path d="M30 36 Q30 10 50 10 Q70 10 70 36" fill="#4a1a35"/><ellipse cx="50" cy="13" rx="14" ry="9" fill="#4a1a35"/><path d="M34 11 Q34 4 50 3 Q66 4 66 11" fill="#3a1025"/><ellipse cx="42" cy="54" rx="3" ry="3.5" fill="#111"/><ellipse cx="58" cy="54" rx="3" ry="3.5" fill="#111"/><path d="M40 67 Q50 72 60 67" stroke="#c49080" stroke-width="1.5" fill="none"/><circle cx="44" cy="80" r="2.5" fill="#f0f0f0"/><circle cx="50" cy="82" r="2.5" fill="#f0f0f0"/><circle cx="56" cy="80" r="2.5" fill="#f0f0f0"/></svg>`},

  {id:'av7', name:'The Crown',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#100820"/><ellipse cx="50" cy="61" rx="19" ry="21" fill="#f0c890"/><ellipse cx="50" cy="40" rx="19" ry="16" fill="#f0c890"/><path d="M22 42 L32 24 L42 38 L50 18 L58 38 L68 24 L78 42Z" fill="#d4a010"/><rect x="22" y="40" width="56" height="7" rx="3.5" fill="#d4a010"/><circle cx="50" cy="20" r="3.5" fill="#ee4444"/><circle cx="32" cy="26" r="3" fill="#44aaee"/><circle cx="68" cy="26" r="3" fill="#44aaee"/><ellipse cx="41" cy="58" rx="3.5" ry="3" fill="#111"/><ellipse cx="59" cy="58" rx="3.5" ry="3" fill="#111"/><path d="M39 69 Q50 75 61 69" stroke="#c49070" stroke-width="2" fill="none"/></svg>`},

  {id:'av8', name:'The Ghost',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#020510"/><path d="M26 52 Q26 18 50 18 Q74 18 74 52 L74 84 L65 74 L56 84 L50 74 L44 84 L35 74 L26 84Z" fill="#bcd0e8" fill-opacity="0.88"/><ellipse cx="39" cy="50" rx="7" ry="9" fill="#020510"/><ellipse cx="61" cy="50" rx="7" ry="9" fill="#020510"/><circle cx="39" cy="49" r="3.5" fill="#88bbdd"/><circle cx="61" cy="49" r="3.5" fill="#88bbdd"/><path d="M42 68 Q50 73 58 68" stroke="#020510" stroke-width="2" fill="none"/></svg>`},

  {id:'av9', name:'The Volt',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#020818"/><ellipse cx="50" cy="59" rx="19" ry="21" fill="#d0e8f8"/><ellipse cx="50" cy="36" rx="19" ry="14" fill="#d0e8f8"/><path d="M44 10 L34 32 L47 32 L36 54 L62 24 L48 24 L58 10Z" fill="#41f0f0"/><ellipse cx="41" cy="56" rx="3.5" ry="3" fill="#020818"/><ellipse cx="59" cy="56" rx="3.5" ry="3" fill="#020818"/><circle cx="42" cy="55" r="1.5" fill="#41f0f0"/><circle cx="60" cy="55" r="1.5" fill="#41f0f0"/><path d="M39 68 Q50 73 61 68" stroke="#90c8e0" stroke-width="1.5" fill="none"/></svg>`},

  {id:'av10', name:'The Robot',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#080e14"/><rect x="26" y="30" width="48" height="48" rx="8" fill="#2a3a4a"/><rect x="34" y="20" width="32" height="14" rx="5" fill="#2a3a4a"/><rect x="48" y="14" width="4" height="8" rx="2" fill="#41f0a4"/><rect x="34" y="44" width="14" height="11" rx="3" fill="#080e14"/><rect x="52" y="44" width="14" height="11" rx="3" fill="#080e14"/><circle cx="41" cy="49.5" r="4" fill="#41f0a4"/><circle cx="59" cy="49.5" r="4" fill="#41f0a4"/><rect x="38" y="63" width="24" height="7" rx="3.5" fill="#080e14"/><rect x="42" cy="65" width="4" height="3" fill="#41f0a4"/><rect x="54" y="65" width="4" height="3" fill="#41f0a4"/><rect x="22" y="42" width="4" height="10" rx="2" fill="#3a4a5a"/><rect x="74" y="42" width="4" height="10" rx="2" fill="#3a4a5a"/></svg>`},

  {id:'av11', name:'The Hustler',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#050e0e"/><ellipse cx="50" cy="63" rx="19" ry="20" fill="#d4a87a"/><ellipse cx="50" cy="43" rx="19" ry="17" fill="#d4a87a"/><rect x="27" y="32" width="46" height="16" rx="8" fill="#1a2a1e"/><ellipse cx="50" cy="32" rx="21" ry="7" fill="#1a2a1e"/><ellipse cx="22" cy="38" rx="7" ry="4" fill="#1a2a1e"/><ellipse cx="41" cy="59" rx="3.5" ry="3" fill="#111"/><ellipse cx="59" cy="59" rx="3.5" ry="3" fill="#111"/><path d="M39 71 Q50 76 61 71" stroke="#b49060" stroke-width="2" fill="none"/></svg>`},

  {id:'av12', name:'The Shadow',
   svg:`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#06030e"/><ellipse cx="50" cy="59" rx="19" ry="21" fill="#c0a098"/><ellipse cx="50" cy="35" rx="19" ry="13" fill="#c0a098"/><path d="M28 50 Q28 42 41 42 Q54 42 54 50 Q54 42 58 42 Q72 42 72 50 Q72 58 58 58 Q54 58 54 50 Q54 58 41 58 Q28 58 28 50Z" fill="#7a12aa"/><ellipse cx="41" cy="50" rx="4" ry="4.5" fill="#dda0ff"/><ellipse cx="59" cy="50" rx="4" ry="4.5" fill="#dda0ff"/><circle cx="41" cy="50" r="2" fill="#300050"/><circle cx="59" cy="50" r="2" fill="#300050"/><path d="M40 70 Q50 75 60 70" stroke="#a09088" stroke-width="2" fill="none"/></svg>`},
];

const LS_AV = 'volt-avatar';
const DEFAULT_AVB_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.2 3.8-5 7-5s5.8 1.8 7 5"/></svg>`;
let _pendingAvId = null;

function applyAvatar(id) {
  const av = AVATARS.find(a => a.id === id);
  if (!av) return;
  const btn = $id('avatarBtn');
  if (!btn) return;
  btn.innerHTML = av.svg;
  btn.dataset.avId = id;
}

function resetAvatar() {
  const btn = $id('avatarBtn');
  if (!btn) return;
  btn.innerHTML = DEFAULT_AVB_SVG;
  delete btn.dataset.avId;
}

function renderAvGrid() {
  const current = localStorage.getItem(LS_AV) || '';
  _pendingAvId = current || null;
  $id('avGrid').innerHTML = AVATARS.map(av => `
    <div>
      <button class="av-opt${av.id === current ? ' sel' : ''}" data-id="${av.id}" title="${av.name}" aria-label="${av.name}">
        ${av.svg}
      </button>
      <div class="av-name">${av.name}</div>
    </div>`).join('');
  $id('avSaveBtn').disabled = true;
}

$id('avGrid').addEventListener('click', e => {
  const b = e.target.closest('.av-opt');
  if (!b) return;
  $id('avGrid').querySelectorAll('.av-opt').forEach(x => x.classList.remove('sel'));
  b.classList.add('sel');
  _pendingAvId = b.dataset.id;
  $id('avSaveBtn').disabled = false;
});

$id('avSaveBtn').addEventListener('click', async () => {
  if (!_pendingAvId || $id('avSaveBtn').disabled) return;
  $id('avSaveBtn').disabled = true;
  $id('avSaveBtn').textContent = 'Saving…';
  localStorage.setItem(LS_AV, _pendingAvId);
  applyAvatar(_pendingAvId);
  const { data: { user } } = await supa.auth.getUser();
  if (user) {
    await supa.from('profiles').update({ avatar_url: 'volt-av:' + _pendingAvId }).eq('id', user.id);
  }
  closeAvPick();
  $id('avSaveBtn').textContent = 'Save Avatar';
  const av = AVATARS.find(a => a.id === _pendingAvId);
  if (typeof showToast === 'function') showToast({ icon: '🎭', title: 'Avatar updated', sub: av?.name || '' });
});

function openAvPick() {
  if (typeof avatarWrap !== 'undefined') avatarWrap.classList.remove('open');
  renderAvGrid();
  $id('avatarPickOverlay').classList.add('open');
}
function closeAvPick() { $id('avatarPickOverlay').classList.remove('open'); }

$id('chooseAvatarBtn').addEventListener('click', openAvPick);
$id('avatarPickClose').addEventListener('click', closeAvPick);
$id('avatarPickOverlay').addEventListener('click', e => { if (e.target === $id('avatarPickOverlay')) closeAvPick(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $id('avatarPickOverlay').classList.contains('open')) { closeAvPick(); e.stopPropagation(); }
}, true);

async function loadAvatar() {
  const local = localStorage.getItem(LS_AV);
  if (local) applyAvatar(local);
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return;
  const { data } = await supa.from('profiles').select('avatar_url').eq('id', user.id).single();
  if (data?.avatar_url?.startsWith('volt-av:')) {
    const id = data.avatar_url.replace('volt-av:', '');
    localStorage.setItem(LS_AV, id);
    applyAvatar(id);
  }
}

supa.auth.onAuthStateChange((_, session) => {
  if (session) loadAvatar();
  else { resetAvatar(); localStorage.removeItem(LS_AV); }
});

loadAvatar();
