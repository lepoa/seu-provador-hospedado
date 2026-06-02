/* Admin panel — vanilla JS, no framework needed */
(function(){
  const LIMITS = window.PRIZE_LIMITS;
  const PALETTE = window.SLOT_PALETTE;

  // populate limits in the info strip
  document.getElementById("lim-label").textContent = LIMITS.label;
  document.getElementById("lim-sub").textContent   = LIMITS.sub;
  document.getElementById("lim-code").textContent  = LIMITS.code;
  document.getElementById("lim-valid").textContent = LIMITS.valid;

  // ====== Auth via Supabase Auth ======
  const SB_URL  = window.SB_URL  || "https://deibjfkveiyogvtscyeh.supabase.co";
  const SB_ANON = window.SB_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlaWJqZmt2ZWl5b2d2dHNjeWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDA3MzMsImV4cCI6MjA4NjE3NjczM30.eYGXOHLLJq6wpRT605kxSc8t_qS15_ux174d0rUOmfY";
  const sb = window.supabase.createClient(SB_URL, SB_ANON);

  // ====== State (must be before auth check) ======
  let prizes = window.loadPrizes();        // active working copy
  let original = JSON.stringify(prizes);   // for dirty-check
  let dirty = false;

  const loginEl = document.getElementById("login");
  const adminEl = document.getElementById("admin");

  function showAuthedUI(){
    loginEl.style.display = "none";
    adminEl.classList.add("visible");
    renderAll();
  }
  function showLoginUI(){
    loginEl.style.display = "flex";
    adminEl.classList.remove("visible");
  }

  sb.auth.getSession().then(({ data: { session } }) => {
    if (session) showAuthedUI(); else showLoginUI();
  });

  document.getElementById("login-form").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const email = document.getElementById("lg-user").value.trim().toLowerCase();
    const pass  = document.getElementById("lg-pass").value;
    const err   = document.getElementById("lg-err");
    err.textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) { err.textContent = "Email ou senha inválidos."; return; }
    showAuthedUI();
  });
  document.getElementById("btn-logout").addEventListener("click", async ()=>{
    await sb.auth.signOut(); showLoginUI();
  });

  function markDirty(d){
    dirty = d;
    const st = document.getElementById("save-status");
    const btn = document.getElementById("btn-save");
    if (d){
      st.textContent = "Alterações não salvas";
      st.className = "save-status dirty";
      btn.disabled = false;
    } else {
      st.textContent = "Tudo salvo";
      st.className = "save-status saved";
      btn.disabled = true;
    }
  }

  function checkDirty(){
    markDirty(JSON.stringify(prizes) !== original);
  }

  // ====== Toast ======
  let toastTimer;
  function toast(msg, kind){
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast show" + (kind === "err" ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.className = "toast", 2400);
  }

  // ====== Helpers ======
  function totalWeight(){ return prizes.filter(p=>p.enabled !== false).reduce((s,p)=>s+(+p.weight||0),0); }

  // ====== Render: summary ======
  function renderSummary(){
    const active = prizes.filter(p=>p.enabled !== false);
    const rarest = active.slice().sort((a,b)=>a.weight-b.weight)[0];
    const common = active.slice().sort((a,b)=>b.weight-a.weight)[0];
    const total = totalWeight();
    document.getElementById("summary").innerHTML = `
      <div class="stat">
        <div class="lbl">Prêmios ativos</div>
        <div class="val">${active.length}<em>/${prizes.length}</em></div>
        <div class="note">desativados somem da roleta</div>
      </div>
      <div class="stat">
        <div class="lbl">Mais provável</div>
        <div class="val" style="font-size:20px">${common ? escape(common.label) : "—"}</div>
        <div class="note">${common ? Math.round((common.weight/total)*100)+"% de chance" : ""}</div>
      </div>
      <div class="stat">
        <div class="lbl">Mais raro</div>
        <div class="val" style="font-size:20px">${rarest ? escape(rarest.label) : "—"}</div>
        <div class="note">${rarest ? Math.round((rarest.weight/total)*100)+"% de chance" : ""}</div>
      </div>
      <div class="stat">
        <div class="lbl">Peso total</div>
        <div class="val">${total}</div>
        <div class="note">soma das raridades</div>
      </div>
    `;
  }

  function escape(s){ return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

  // ====== Render: prize cards ======
  function renderGrid(){
    const grid = document.getElementById("grid");
    grid.innerHTML = "";
    prizes.forEach((p, i) => grid.appendChild(prizeCard(p, i)));
  }

  function prizeCard(p, i){
    const pal = PALETTE[i % PALETTE.length];
    const total = totalWeight();
    const chance = p.enabled !== false ? Math.round(((+p.weight||0)/Math.max(total,1))*100) : 0;

    const card = document.createElement("div");
    card.className = "prize-card" + (p.enabled === false ? " disabled" : "");

    card.innerHTML = `
      <div class="pc-head">
        <div class="slot-chip" style="background:${pal.color};color:${pal.text}">${i+1}</div>
        <div class="slot-label">Fatia ${i+1}</div>
        ${p.enabled === false ? '<span class="disabled-tag">Desativado</span>' : ''}
        <div class="toggle ${p.enabled !== false ? "on" : ""}" data-act="toggle" title="Ativar/desativar"></div>
      </div>

      <div class="pc-row big">
        <label>
          <span>Prêmio (grande)</span>
          <span class="count" data-counter="label">${(p.label||"").length}/${LIMITS.label}</span>
        </label>
        <input type="text" data-field="label" maxlength="${LIMITS.label}" value="${escape(p.label||"")}" />
      </div>

      <div class="pc-row sub">
        <label>
          <span>Descrição (pequeno)</span>
          <span class="count" data-counter="sub">${(p.sub||"").length}/${LIMITS.sub}</span>
        </label>
        <input type="text" data-field="sub" maxlength="${LIMITS.sub}" value="${escape(p.sub||"")}" />
      </div>

      <div class="pc-row-split">
        <div class="pc-row code">
          <label>
            <span>Código cupom</span>
            <span class="count" data-counter="code">${(p.code||"").length}/${LIMITS.code}</span>
          </label>
          <input type="text" data-field="code" maxlength="${LIMITS.code}" value="${escape(p.code||"")}" />
        </div>
        <div class="pc-row">
          <label>
            <span>Validade</span>
            <span class="count" data-counter="valid">${(p.valid||"").length}/${LIMITS.valid}</span>
          </label>
          <input type="text" data-field="valid" maxlength="${LIMITS.valid}" value="${escape(p.valid||"")}" />
        </div>
      </div>

      <div class="pc-row">
        <label>
          <span>Raridade (peso)</span>
          <span class="count">${chance}% de chance</span>
        </label>
        <input type="number" min="0" max="100" step="1" data-field="weight" value="${+p.weight||0}" />
      </div>

      <div class="preview" style="background:${pal.color};color:${pal.text}">
        <div class="hint-chip">Prévia</div>
        <div class="big" data-preview="label">${escape(p.label||"")}</div>
        <div class="small" data-preview="sub">${escape(p.sub||"")}</div>
      </div>

      <div class="prob">
        <span>${chance}%</span>
        <div class="bar"><span style="width:${chance}%"></span></div>
      </div>
    `;

    // inputs
    card.querySelectorAll("input[data-field]").forEach(inp=>{
      inp.addEventListener("input", ()=>{
        const f = inp.getAttribute("data-field");
        let v = inp.value;
        if (f === "code") v = v.toUpperCase();
        if (f === "weight") v = Math.max(0, Math.min(100, parseInt(v)||0));
        prizes[i][f] = v;
        if (f === "code") inp.value = v;

        // update counter
        if (["label","sub","code","valid"].includes(f)){
          const c = card.querySelector(`[data-counter="${f}"]`);
          const len = String(v).length;
          const lim = LIMITS[f];
          c.textContent = `${len}/${lim}`;
          c.className = "count" + (len >= lim ? " warn" : "") + (len > lim ? " over" : "");
        }
        // live preview
        if (f === "label" || f === "sub"){
          const pv = card.querySelector(`[data-preview="${f}"]`);
          if (pv) pv.textContent = v;
        }

        // weight affects chance
        if (f === "weight"){
          // re-render summary + this card's chance + mini wheel
          renderSummary();
          const t = totalWeight();
          const ch = Math.round((((+prizes[i].weight)||0)/Math.max(t,1))*100);
          card.querySelector(".prob span:first-child").textContent = ch + "%";
          card.querySelector(".prob .bar span").style.width = ch + "%";
          renderMiniWheel();
        }

        checkDirty();
      });
    });

    // toggle
    card.querySelector('[data-act="toggle"]').addEventListener("click", ()=>{
      prizes[i].enabled = prizes[i].enabled === false ? true : false;
      checkDirty();
      renderAll();
    });

    return card;
  }

  // ====== Mini wheel preview ======
  function renderMiniWheel(){
    const svg = document.getElementById("mini-wheel");
    if (!svg) return;
    const cx = 100, cy = 100, r = 92;
    const active = prizes.filter(p=>p.enabled !== false);
    const n = active.length || 1;
    const seg = 360 / n;
    const parts = [];
    active.forEach((p, i) => {
      const startA = -90 - seg/2 + i*seg;
      const endA = startA + seg;
      const sx = cx + r*Math.cos(startA*Math.PI/180);
      const sy = cy + r*Math.sin(startA*Math.PI/180);
      const ex = cx + r*Math.cos(endA*Math.PI/180);
      const ey = cy + r*Math.sin(endA*Math.PI/180);
      const large = seg > 180 ? 1 : 0;
      const pal = PALETTE[prizes.indexOf(p) % PALETTE.length];
      parts.push(`<path d="M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z" fill="${pal.color}" stroke="rgba(43,50,32,0.3)" stroke-width="0.6"/>`);
    });
    svg.innerHTML = parts.join("");
  }

  // ====== Actions ======
  document.getElementById("btn-save").addEventListener("click", ()=>{
    // validate: at least 2 active, all labels non-empty
    const active = prizes.filter(p=>p.enabled !== false);
    if (active.length < 2){
      toast("Deixe ao menos 2 prêmios ativos", "err"); return;
    }
    for (const p of prizes){
      if (p.enabled !== false){
        if (!p.label.trim()){ toast("Prêmio sem nome detectado", "err"); return; }
        if (!p.code.trim()){  toast("Cupom vazio detectado", "err"); return; }
      }
    }
    window.savePrizes(prizes);
    original = JSON.stringify(prizes);
    markDirty(false);
    toast("Roleta atualizada ✓");
  });

  document.getElementById("btn-reset").addEventListener("click", ()=>{
    if (!confirm("Restaurar os prêmios para o padrão da Le.Poá? As edições não salvas serão perdidas.")) return;
    window.resetPrizes();
    prizes = window.loadPrizes();
    original = JSON.stringify(prizes);
    markDirty(false);
    renderAll();
    toast("Padrão restaurado");
  });

  // warn on unload if dirty
  window.addEventListener("beforeunload", (e)=>{
    if (dirty){ e.preventDefault(); e.returnValue = ""; }
  });

  // ====== Render all ======
  function renderAll(){
    renderSummary();
    renderGrid();
    renderMiniWheel();
  }

  // ====== TABS ======
  document.querySelectorAll('.adm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      document.getElementById('tab-' + target).classList.add('active');
      if (target === 'leads') loadLeads();
    });
  });

  // ====== LEADS ======
  const SUPABASE_URL = "https://deibjfkveiyogvtscyeh.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlaWJqZmt2ZWl5b2d2dHNjeWVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwMDczMywiZXhwIjoyMDg2MTc2NzMzfQ.GXI0RzBXTnqdGQ-u-yoJeQwVulZwhvlFY3QY-szsDHE";

  async function loadLeads() {
    const container = document.getElementById('leads-container');
    container.innerHTML = '<div class="leads-loading">Carregando leads...</div>';
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/roleta_leads?order=created_at.desc&limit=200`,
        {
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      if (!resp.ok) throw new Error("Erro " + resp.status);
      const leads = await resp.json();
      renderLeads(leads);
    } catch (e) {
      container.innerHTML = `<div class="leads-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>Erro ao carregar leads: ${escape(e.message)}</div>
      </div>`;
    }
  }

  function renderLeads(leads) {
    const container = document.getElementById('leads-container');
    const countEl = document.getElementById('leads-count');
    countEl.textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''} cadastrado${leads.length !== 1 ? 's' : ''}`;

    if (leads.length === 0) {
      container.innerHTML = `<div class="leads-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        <div>Nenhum lead ainda.<br/>Quando as clientes girarem a roleta, elas aparecerão aqui.</div>
      </div>`;
      return;
    }

    let html = `<table class="leads-table">
      <thead><tr>
        <th>Nome</th>
        <th>WhatsApp</th>
        <th>Prêmio</th>
        <th>Cupom</th>
        <th>Data</th>
      </tr></thead><tbody>`;

    leads.forEach(l => {
      const dt = new Date(l.created_at);
      const dateStr = dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
      const timeStr = dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      const whatsFormatted = formatWhatsApp(l.whatsapp);
      const hasPrize = l.prize_label && l.prize_label !== '';
      html += `<tr>
        <td><strong>${escape(l.name)}</strong></td>
        <td class="mono"><a href="https://wa.me/55${l.whatsapp}" target="_blank" rel="noopener" style="color:var(--olive-700);text-decoration:none">${whatsFormatted}</a></td>
        <td>${hasPrize ? `<span class="badge won">${escape(l.prize_label)}</span>` : `<span class="badge pending">Aguardando</span>`}</td>
        <td class="mono">${hasPrize ? escape(l.prize_code || '-') : '-'}</td>
        <td style="white-space:nowrap;font-size:12px">${dateStr}<br/><span style="opacity:0.6">${timeStr}</span></td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function formatWhatsApp(raw) {
    if (!raw) return '-';
    const d = raw.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return d;
  }

  document.getElementById('btn-refresh-leads').addEventListener('click', () => loadLeads());

})();
