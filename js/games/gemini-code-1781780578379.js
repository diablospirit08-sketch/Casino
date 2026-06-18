/* --- Improved Dice Module --- */
ORIGINALS['originals-dice'] = {
  rtp: '99%', auto: true, chance: 50, over: true, busy: false, _raf: 0,
  mult() { return 99 / this.chance; },
  
  mount() {
    engFields.innerHTML = `
      <div class="gv-field"><label>Win Chance <span id="diLbl"></span></label>
        <input type="range" class="eng-range" id="diChance" min="2" max="98" step="1" value="${this.chance}" aria-label="Win chance"/></div>
      <div class="gv-field"><label>Roll Mode</label>
        <div class="auto-segs" id="diMode" role="radiogroup">
          <button class="auto-seg${this.over ? ' active' : ''}" data-v="1">Roll Over</button>
          <button class="auto-seg${this.over ? '' : ' active'}" data-v="0">Roll Under</button>
        </div></div>
      <div class="eng-readout"><span>Payout</span><b id="diPay"></b></div>
      <div class="eng-readout"><span>Profit on Win</span><b id="diProf"></b></div>`;
      
    gvStage.innerHTML = `
      <div class="dice-wrap">
        <div class="dice-roll idle" id="diRoll">—</div>
        <div class="dice-track"><div class="dice-fill" id="diFill"></div><div class="dice-pin" id="diPin">0</div></div>
        <div class="dice-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
      </div>`;

    $id('diChance').addEventListener('input', (e) => {
      this.chance = +e.target.value;
      this.sync();
    });

    $id('diMode').addEventListener('click', (e) => {
      const b = e.target.closest('.auto-seg');
      if (!b || b.classList.contains('active')) return;
      this.over = b.dataset.v === '1';
      Array.from($id('diMode').children).forEach(x => x.classList.toggle('active', x === b));
      this.sync();
    });

    this.sync();
  },

  sync() {
    const lbl = $id('diLbl');
    if (!lbl) return;
    const t = this.over ? 100 - this.chance : this.chance;
    const w = curW(), b = parseFloat(gvBetIn.value) || 0;
    
    lbl.textContent = `${this.chance}% — ${this.over ? 'Over' : 'Under'} ${t.toFixed(0)}`;
    $id('diPay').textContent = `${this.mult().toFixed(2)}×`;
    $id('diProf').textContent = `${fmtW(w, b * (this.mult() - 1))} ${w.c}`;
    
    const f = $id('diFill'), pin = $id('diPin');
    f.style.left = this.over ? `${t}%` : '0';
    f.style.right = this.over ? '0' : `${100 - t}%`;
    pin.classList.remove('show');
  },

  async roll(done) {
    if (this.busy) return;
    const st = debitBet();
    if (!st) { if (done) stopAuto(); return; }
    
    this.busy = true;
    window._sbActive = true;
    gvBetBtn.disabled = true;
    
    const rollEl = $id('diRoll'), pin = $id('diPin');
    rollEl.className = 'dice-roll';
    pin.classList.remove('show');

    let spinning = true;
    const spinFn = () => { if (spinning) { rollEl.textContent = rnd(0, 100).toFixed(2); this._raf = requestAnimationFrame(spinFn); } };
    this._raf = requestAnimationFrame(spinFn);

    try {
      const res = await placeBet({ game: 'dice', currency: st.w.c, wager: st.b, params: { chance: this.chance, over: this.over } });
      spinning = false;
      cancelAnimationFrame(this._raf);
      
      const { roll: r, outcome, multiplier } = res;
      rollEl.textContent = r.toFixed(2);
      rollEl.classList.add(outcome === 'win' ? 'win' : 'lose');
      
      pin.style.left = `${r}%`;
      pin.textContent = r.toFixed(0);
      pin.classList.add('show');
      
      serverSettleBet(st, outcome === 'win' ? multiplier : 0, res.new_balance);
      if (done) done(outcome === 'win', st.b * (outcome === 'win' ? multiplier - 1 : -1));
    } catch (err) {
      spinning = false;
      cancelAnimationFrame(this._raf);
      st.w.amt += st.b; renderWallet();
      showToast({ icon: '⚠', title: 'Bet failed', sub: err.message });
      if (done) stopAuto();
    } finally {
      this.busy = false;
      window._sbActive = false;
      gvBetBtn.disabled = false;
      this.sync();
    }
  },

  unmount() {
    cancelAnimationFrame(this._raf);
    this.busy = false;
  }
};