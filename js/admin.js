/**
 * USE MODA CLARA — PAINEL ADMINISTRATIVO (ADMIN.JS)
 * Gerenciamento na nuvem via Supabase com upload de fotos e publicação instantânea.
 */
(function () {
  'use strict';

  const $ = (s, e = document) => e.querySelector(s);
  const $$ = (s, e = document) => [...e.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY_DRAFT = 'umc_admin_draft_v2';
  const KEY_AUTH = 'umc_admin_auth_v1';
  const ADMIN_PASS = 'modaclara'; // Senha padrão de acesso

  let D = null;
  let dirty = false;
  let tab = 'produtos';
  let q = '';

  /* --------------------------------------------------------------------------
     01. Controle de Acesso (Senha)
     -------------------------------------------------------------------------- */
  function checkAuth() {
    if (sessionStorage.getItem(KEY_AUTH) === 'true') {
      $('#authOverlay').classList.remove('on');
      initAdmin();
    } else {
      $('#authOverlay').classList.add('on');
      $('#authPass').focus();
    }
  }

  $('#authBtn').onclick = () => {
    const val = $('#authPass').value.trim();
    if (val === ADMIN_PASS) {
      sessionStorage.setItem(KEY_AUTH, 'true');
      $('#authOverlay').classList.remove('on');
      initAdmin();
    } else {
      $('#authErr').style.display = 'block';
      $('#authPass').value = '';
      $('#authPass').focus();
    }
  };

  $('#authPass').onkeydown = e => {
    if (e.key === 'Enter') $('#authBtn').click();
  };

  /* --------------------------------------------------------------------------
     02. Carregamento dos Dados (Supabase ou Fallback)
     -------------------------------------------------------------------------- */
  async function initAdmin() {
    $('#stat').innerHTML = '⏳ Carregando dados do site na nuvem…';

    // 1. Tenta carregar do Supabase
    if (window.sbClient) {
      try {
        const { data, error } = await window.sbClient
          .from('loja_config')
          .select('dados')
          .eq('id', 1)
          .single();
        if (data && data.dados) {
          D = data.dados;
        }
      } catch (err) {
        console.warn('Erro ao carregar do Supabase:', err);
      }
    }

    // 2. Se não carregou, tenta rascunho local ou dados.js
    if (!D) {
      try {
        const dr = localStorage.getItem(KEY_DRAFT);
        if (dr) {
          D = JSON.parse(dr);
          dirty = true;
        }
      } catch (e) {}
    }
    if (!D) D = JSON.parse(JSON.stringify(window.LOJA || {}));

    D.frete = D.frete || { regioes: {} };
    D.textos = D.textos || {};
    D.categorias = D.categorias || [];
    D.produtos = D.produtos || [];

    status();
    render();
  }

  const persistDraft = () => {
    dirty = true;
    try {
      localStorage.setItem(KEY_DRAFT, JSON.stringify(D));
    } catch (e) {}
    status();
  };

  function status() {
    const el = $('#stat');
    if (dirty) {
      el.innerHTML = '<span class="dirty">● Alterações pendentes.</span> Clique em <b>Salvar no Site</b> para atualizar a loja online.';
    } else {
      el.innerHTML = '<span class="saved">✔ Site atualizado e sincronizado na nuvem.</span>';
    }
  }

  const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('c' + Date.now());
  const brl = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const ph = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 78'><rect width='64' height='78' fill='#e2b0ab'/><text x='32' y='46' font-family='Georgia' font-size='26' fill='white' text-anchor='middle'>MC</text></svg>");

  $('#tabs').onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    tab = b.dataset.t;
    $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    render();
  };

  function render() {
    if (!D) return;
    const m = $('#main');
    if (tab === 'produtos') m.innerHTML = vProdutos();
    if (tab === 'categorias') m.innerHTML = vCategorias();
    if (tab === 'frete') m.innerHTML = vFrete();
    if (tab === 'loja') m.innerHTML = vLoja();
    bind();
    status();
  }

  /* --------------------------------------------------------------------------
     Aba 1: Produtos
     -------------------------------------------------------------------------- */
  function vProdutos() {
    const list = D.produtos.filter(p => !q || (p.nome || '').toLowerCase().includes(q.toLowerCase()));
    return `
      <div class="card">
        <div class="bar">
          <h2>Produtos (${D.produtos.length})</h2>
          <div class="acts">
            <input id="q" placeholder="Buscar peça…" value="${esc(q)}" style="width:180px">
            <button class="btn p" id="addP">+ Nova peça</button>
          </div>
        </div>
        <div class="plist" style="margin-top:1rem">
          ${list.map(p => `
            <div class="pi">
              <img src="${(p.imagens && p.imagens[0]) || ph}" alt="">
              <div>
                <b>${esc(p.nome)}</b>
                <small>${brl(p.preco)} · ${esc((D.categorias.find(c => c.id === p.categoria) || {}).nome || 'Sem categoria')}</small>
                <div style="margin-top:.3rem">
                  ${p.destaque ? '<span class="pill">Destaque</span>' : ''}
                  ${p.esgotado ? '<span class="pill out">Esgotado</span>' : ''}
                </div>
              </div>
              <div class="acts">
                <button class="btn g s" data-a="ed" data-id="${esc(p.id)}">Editar</button>
                <button class="btn g s" data-a="so" data-id="${esc(p.id)}">${p.esgotado ? 'Voltar ao estoque' : 'Marcar esgotado'}</button>
                <button class="btn d s" data-a="rm" data-id="${esc(p.id)}">Excluir</button>
              </div>
            </div>
          `).join('') || '<p class="hint">Nenhuma peça encontrada.</p>'}
        </div>
      </div>
    `;
  }

  function openForm(id) {
    const isNew = !id;
    const p = isNew
      ? { id: 'p' + Date.now(), categoria: (D.categorias[0] || {}).id || '', nome: '', preco: 0, descricao: '', tamanhos: ['P', 'M', 'G'], cores: [], imagens: [], destaque: false, esgotado: false }
      : JSON.parse(JSON.stringify(D.produtos.find(x => x.id === id)));

    const mod = $('#mod');
    const draw = () => {
      mod.innerHTML = `
        <h2 style="font-size:1.8rem;margin-bottom:1rem">${isNew ? 'Nova peça' : 'Editar peça'}</h2>
        <div class="stack">
          <div class="g2">
            <label>Nome<input id="f-nome" value="${esc(p.nome)}"></label>
            <label>Categoria
              <select id="f-cat">${D.categorias.map(c => `<option value="${esc(c.id)}" ${c.id === p.categoria ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
            </label>
          </div>
          <div class="g2">
            <label>Preço (R$)<input id="f-preco" inputmode="decimal" value="${String(p.preco).replace('.', ',')}"></label>
            <label>Tamanhos (separe por vírgula)<input id="f-tam" value="${esc((p.tamanhos || []).join(', '))}" placeholder="P, M, G"></label>
          </div>
          <label>Cores (separe por vírgula)<input id="f-cor" value="${esc((p.cores || []).join(', '))}" placeholder="Rosé, Areia"></label>
          <label>Descrição<textarea id="f-desc" rows="3">${esc(p.descricao)}</textarea></label>
          <div>
            <div class="hint" style="margin-bottom:.4rem">FOTOS — toque no botão abaixo para adicionar fotos direto do celular ou computador:</div>
            <div class="drop" id="drop">📷 Toque para escolher fotos (upload automático para a nuvem)<input type="file" id="f-file" accept="image/*" multiple hidden></div>
            <div class="imgs" id="f-imgs">
              ${(p.imagens || []).map((s, i) => `
                <div class="im">
                  <img src="${s}" alt="">
                  <button data-x="${i}" title="Remover">×</button>
                  ${i === 0 ? '<i>principal</i>' : `<i data-main="${i}" style="cursor:pointer">tornar principal</i>`}
                </div>
              `).join('')}
            </div>
          </div>
          <div class="acts" style="justify-content:flex-start;gap:1.4rem">
            <label class="chk"><input type="checkbox" id="f-dest" ${p.destaque ? 'checked' : ''}> Destaque na página inicial</label>
            <label class="chk"><input type="checkbox" id="f-out" ${p.esgotado ? 'checked' : ''}> Esgotado</label>
          </div>
          <div class="acts">
            <button class="btn g" id="f-cancel">Cancelar</button>
            <button class="btn p" id="f-save">Confirmar peça</button>
          </div>
        </div>
      `;

      const grab = () => {
        p.nome = $('#f-nome').value.trim();
        p.categoria = $('#f-cat').value;
        p.preco = parseFloat(String($('#f-preco').value).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
        p.tamanhos = $('#f-tam').value.split(',').map(s => s.trim()).filter(Boolean);
        p.cores = $('#f-cor').value.split(',').map(s => s.trim()).filter(Boolean);
        p.descricao = $('#f-desc').value.trim();
        p.destaque = $('#f-dest').checked;
        p.esgotado = $('#f-out').checked;
      };

      $('#drop').onclick = () => $('#f-file').click();

      $('#f-file').onchange = async e => {
        grab();
        const files = [...e.target.files];
        if (!files.length) return;

        const dropEl = $('#drop');
        dropEl.classList.add('uploading');
        dropEl.textContent = '⏳ Enviando fotos para a nuvem… aguarde…';

        for (const file of files) {
          try {
            // Upload direto para o Supabase Storage
            if (window.sbClient) {
              const ext = file.name.split('.').pop() || 'jpg';
              const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
              const { data: upData, error: upErr } = await window.sbClient.storage
                .from('produtos')
                .upload(fileName, file, { cacheControl: '3600', upsert: false });

              if (upData) {
                const publicUrl = `https://scqrviyzekjsignjtmmj.supabase.co/storage/v1/object/public/produtos/${fileName}`;
                p.imagens.push(publicUrl);
              } else {
                throw upErr;
              }
            } else {
              p.imagens.push(await compressLocal(file));
            }
          } catch (err) {
            console.error('Falha no upload da foto:', err);
            // Fallback para compressão local se falhar conexão
            try { p.imagens.push(await compressLocal(file)); } catch (_) {}
          }
        }
        draw();
      };

      $$('.im button', mod).forEach(b => b.onclick = () => {
        grab();
        p.imagens.splice(+b.dataset.x, 1);
        draw();
      });

      $$('.im i[data-main]', mod).forEach(b => b.onclick = () => {
        grab();
        const [x] = p.imagens.splice(+b.dataset.main, 1);
        p.imagens.unshift(x);
        draw();
      });

      $('#f-cancel').onclick = closeOv;

      $('#f-save').onclick = () => {
        grab();
        if (!p.nome) { alert('Dê um nome para a peça.'); return; }
        if (!p.categoria) { alert('Crie uma categoria primeiro.'); return; }
        if (isNew) D.produtos.push(p);
        else D.produtos[D.produtos.findIndex(x => x.id === p.id)] = p;
        persistDraft();
        closeOv();
        render();
      };
    };

    draw();
    $('#ov').classList.add('on');
  }

  function compressLocal(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = rej;
      r.onload = () => {
        const im = new Image();
        im.onerror = rej;
        im.onload = () => {
          const M = 900;
          const k = Math.min(1, M / Math.max(im.width, im.height));
          const c = document.createElement('canvas');
          c.width = Math.round(im.width * k);
          c.height = Math.round(im.height * k);
          const x = c.getContext('2d');
          x.fillStyle = '#fff';
          x.fillRect(0, 0, c.width, c.height);
          x.drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.8));
        };
        im.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  function closeOv() {
    $('#ov').classList.remove('on');
  }

  $('#ov').addEventListener('click', e => {
    if (e.target.id === 'ov') closeOv();
  });

  /* --------------------------------------------------------------------------
     Aba 2: Categorias
     -------------------------------------------------------------------------- */
  function vCategorias() {
    return `
      <div class="card">
        <h2>Categorias (abas do site)</h2>
        <p class="hint">Cada categoria vira uma aba no menu da loja.</p>
        <div class="stack">
          ${D.categorias.map((c, i) => `
            <div class="pi" style="grid-template-columns:1fr auto">
              <input data-cn="${i}" value="${esc(c.nome)}">
              <div class="acts">
                <button class="btn g s" data-a="up" data-i="${i}">↑</button>
                <button class="btn g s" data-a="dn" data-i="${i}">↓</button>
                <button class="btn d s" data-a="rc" data-i="${i}">Excluir</button>
              </div>
            </div>
          `).join('')}
          <div class="acts" style="justify-content:flex-start">
            <input id="nc" placeholder="Nova categoria (ex.: Acessórios)" style="max-width:320px">
            <button class="btn p" id="addC">+ Adicionar</button>
          </div>
        </div>
      </div>
    `;
  }

  /* --------------------------------------------------------------------------
     Aba 3: Frete
     -------------------------------------------------------------------------- */
  function vFrete() {
    const F = D.frete, reg = F.regioes || {};
    return `
      <div class="card">
        <h2>Frete para o Brasil todo</h2>
        <p class="hint">O cliente digita o CEP, o site descobre o estado e aplica o valor da região abaixo. Valor = tarifa da região + adicional por peça extra.</p>
        <div class="g3">
          <label>UF de origem (onde você envia)<input id="fr-uf" maxlength="2" value="${esc(F.origemUF || 'PB')}" style="text-transform:uppercase"></label>
          <label>Frete grátis acima de (R$) — 0 desliga<input id="fr-g" inputmode="decimal" value="${String(F.gratisAcima || 0).replace('.', ',')}"></label>
          <label>Adicional por peça extra (R$)<input id="fr-a" inputmode="decimal" value="${String(F.adicionalPorPeca || 0).replace('.', ',')}"></label>
        </div>
        <table style="margin-top:1rem">
          <tr><th>Região</th><th>Valor (R$)</th><th>Prazo exibido</th></tr>
          ${Object.keys(reg).map(k => `
            <tr>
              <td><b>${esc(k)}</b></td>
              <td><input data-rv="${esc(k)}" inputmode="decimal" value="${String(reg[k].valor).replace('.', ',')}" style="max-width:110px"></td>
              <td><input data-rp="${esc(k)}" value="${esc(reg[k].prazo)}"></td>
            </tr>
          `).join('')}
        </table>
        <p class="hint" style="margin-top:.8rem">Dica: "Local" vale para o estado de origem; as demais regiões seguem o mapa do Brasil.</p>
      </div>
    `;
  }

  const num = v => parseFloat(String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

  /* --------------------------------------------------------------------------
     Aba 4: Dados da Loja e Textos
     -------------------------------------------------------------------------- */
  function vLoja() {
    const T = D.textos;
    const f = (id, l, v, ta) => `
      <label>${l}${ta ? `<textarea id="${id}" rows="3">${esc(v)}</textarea>` : `<input id="${id}" value="${esc(v)}">`}</label>
    `;
    return `
      <div class="card">
        <h2>Dados da loja</h2>
        <div class="stack">
          <div class="g2">${f('l-nome', 'Nome da loja', D.nome)}${f('l-slogan', 'Slogan', D.slogan)}</div>
          <div class="g2">${f('l-wa', 'WhatsApp que recebe os pedidos (com 55 + DDD)', D.whatsapp)}${f('l-ig', 'Instagram (sem @)', D.instagram)}</div>
          <p class="hint">Exemplo de WhatsApp: 5583991836572 — somente números.</p>
        </div>
      </div>
      <div class="card">
        <h2>Textos do site</h2>
        <div class="stack">
          ${f('t-ht', 'Título da capa', T.heroTitulo)}
          ${f('t-hx', 'Texto da capa', T.heroTexto, 1)}
          ${f('t-st', 'Título "Sobre"', T.sobreTitulo)}
          ${f('t-sx', 'Texto "Sobre a loja"', T.sobreTexto, 1)}
          <div class="g2">${f('t-hr', 'Horário de atendimento', T.horario)}${f('t-en', 'Endereço / atendimento', T.endereco)}</div>
        </div>
      </div>
    `;
  }

  /* --------------------------------------------------------------------------
     Manipulação de Eventos
     -------------------------------------------------------------------------- */
  function bind() {
    const m = $('#main');
    if (tab === 'produtos') {
      $('#addP').onclick = () => {
        if (!D.categorias.length) { alert('Crie uma categoria primeiro (aba Categorias).'); return; }
        openForm();
      };
      $('#q').oninput = e => {
        q = e.target.value;
        const pos = e.target.selectionStart;
        render();
        const n = $('#q');
        n.focus();
        n.setSelectionRange(pos, pos);
      };
      $$('[data-a]', m).forEach(b => b.onclick = () => {
        const id = b.dataset.id, p = D.produtos.find(x => x.id === id);
        if (b.dataset.a === 'ed') openForm(id);
        if (b.dataset.a === 'so') { p.esgotado = !p.esgotado; persistDraft(); render(); }
        if (b.dataset.a === 'rm' && confirm('Excluir "' + p.nome + '"?')) { D.produtos = D.produtos.filter(x => x.id !== id); persistDraft(); render(); }
      });
    }

    if (tab === 'categorias') {
      $$('[data-cn]', m).forEach(i => i.onchange = () => {
        const v = i.value.trim();
        if (v) { D.categorias[+i.dataset.cn].nome = v; persistDraft(); }
      });
      $('#addC').onclick = () => {
        const v = $('#nc').value.trim();
        if (!v) return;
        let id = slug(v);
        while (D.categorias.some(c => c.id === id)) id += '-2';
        D.categorias.push({ id, nome: v });
        persistDraft();
        render();
      };
      $$('[data-a]', m).forEach(b => b.onclick = () => {
        const i = +b.dataset.i, a = b.dataset.a;
        if (a === 'up' && i > 0) [D.categorias[i - 1], D.categorias[i]] = [D.categorias[i], D.categorias[i - 1]];
        if (a === 'dn' && i < D.categorias.length - 1) [D.categorias[i + 1], D.categorias[i]] = [D.categorias[i], D.categorias[i + 1]];
        if (a === 'rc') {
          const c = D.categorias[i], n = D.produtos.filter(p => p.categoria === c.id).length;
          if (n) { alert('Essa categoria ainda tem ' + n + ' peça(s). Mova ou exclua as peças antes.'); return; }
          if (!confirm('Excluir a categoria "' + c.nome + '"?')) return;
          D.categorias.splice(i, 1);
        }
        persistDraft();
        render();
      });
    }

    if (tab === 'frete') {
      const F = D.frete;
      $('#fr-uf').onchange = e => {
        const uf = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'PB';
        const old = 'Local (' + (F.origemUF || 'PB') + ')';
        const n = {};
        for (const k of Object.keys(F.regioes)) n[k === old ? 'Local (' + uf + ')' : k] = F.regioes[k];
        F.regioes = n;
        F.origemUF = uf;
        persistDraft();
        render();
      };
      $('#fr-g').onchange = e => { F.gratisAcima = num(e.target.value); persistDraft(); };
      $('#fr-a').onchange = e => { F.adicionalPorPeca = num(e.target.value); persistDraft(); };
      $$('[data-rv]', m).forEach(i => i.onchange = () => { F.regioes[i.dataset.rv].valor = num(i.value); persistDraft(); });
      $$('[data-rp]', m).forEach(i => i.onchange = () => { F.regioes[i.dataset.rp].prazo = i.value; persistDraft(); });
    }

    if (tab === 'loja') {
      const map = {
        'l-nome': v => D.nome = v,
        'l-slogan': v => D.slogan = v,
        'l-wa': v => D.whatsapp = v.replace(/\D/g, ''),
        'l-ig': v => D.instagram = v.replace('@', '').trim(),
        't-ht': v => D.textos.heroTitulo = v,
        't-hx': v => D.textos.heroTexto = v,
        't-st': v => D.textos.sobreTitulo = v,
        't-sx': v => D.textos.sobreTexto = v,
        't-hr': v => D.textos.horario = v,
        't-en': v => D.textos.endereco = v
      };
      for (const id in map) {
        const el = $('#' + id);
        el.onchange = () => { map[id](el.value); persistDraft(); };
      }
    }
  }

  /* --------------------------------------------------------------------------
     03. Publicar no Supabase (O botão mágico que sua amiga vai usar)
     -------------------------------------------------------------------------- */
  $('#btnSaveCloud').onclick = async () => {
    const btn = $('#btnSaveCloud');
    btn.disabled = true;
    btn.textContent = '⏳ Salvando no site…';

    try {
      if (!window.sbClient) throw new Error('Conexão com a nuvem não inicializada.');

      const { error } = await window.sbClient
        .from('loja_config')
        .upsert({
          id: 1,
          dados: D,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      dirty = false;
      try { localStorage.removeItem(KEY_DRAFT); } catch (_) {}
      status();
      alert('🎉 Sucesso! As alterações já estão disponíveis online no site para todos os clientes!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar na nuvem: ' + (err.message || 'Verifique a conexão.'));
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 Salvar no Site';
    }
  };

  /* --------------------------------------------------------------------------
     04. Backup & Ajuda
     -------------------------------------------------------------------------- */
  $('#btnBackup').onclick = () => {
    const out = '/* USE MODA CLARA — backup dos dados da loja em ' + new Date().toLocaleString('pt-BR') + ' */\nwindow.LOJA = ' + JSON.stringify(D, null, 2) + ';\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out], { type: 'text/javascript' }));
    a.download = 'dados.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  $('#btnHelp').onclick = () => {
    $('#mod').innerHTML = `
      <h2 style="font-size:1.8rem;margin-bottom:.8rem">Como usar o Painel</h2>
      <div class="steps">
        <ol>
          <li><b>Adicionar ou editar peças:</b> Troque fotos, preços, tamanhos e cores na aba <i>Produtos</i>.</li>
          <li><b>Fotos:</b> As fotos são enviadas automaticamente para a nuvem.</li>
          <li><b>Publicar:</b> Quando terminar de editar, basta clicar no botão verde <b>"Salvar no Site"</b> no rodapé.</li>
          <li><b>Pronto!</b> Os clientes já verão tudo atualizado no mesmo instante.</li>
        </ol>
      </div>
      <div class="acts" style="margin-top:1.4rem"><button class="btn p" id="okh">Entendi</button></div>
    `;
    $('#ov').classList.add('on');
    $('#okh').onclick = closeOv;
  };

  checkAuth();
})();
