/**
 * USE MODA CLARA — APLICAÇÃO PRINCIPAL (APP.JS)
 * Catálogo virtual, rotas, carrinho, cálculo de frete e integração WhatsApp.
 */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     01. Variáveis Globais e Utilitários
     -------------------------------------------------------------------------- */
  let L = window.LOJA || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const digits = s => String(s || '').replace(/\D/g, '');

  const maskCEP = v => {
    v = digits(v).slice(0, 8);
    return v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v;
  };

  const maskTel = v => {
    v = digits(v).slice(0, 11);
    if (v.length > 6) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    if (v.length > 2) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    return v;
  };

  function fmtPhone(n) {
    const d = digits(n);
    if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`;
    return n;
  }

  const waLink = txt => `https://wa.me/${digits(L.whatsapp)}${txt ? '?text=' + encodeURIComponent(txt) : ''}`;

  /* --------------------------------------------------------------------------
     02. Estado Local (Carrinho e Cliente)
     -------------------------------------------------------------------------- */
  const LS = 'umc_cart_v1';
  const LC = 'umc_cli_v1';

  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem(LS) || '[]');
  } catch (e) {}

  let cli = {};
  try {
    cli = JSON.parse(localStorage.getItem(LC) || '{}');
  } catch (e) {}

  let frete = null; // { uf, regiao, valor, prazo, cep, gratis }

  const save = () => {
    try {
      localStorage.setItem(LS, JSON.stringify(cart));
      localStorage.setItem(LC, JSON.stringify(cli));
    } catch (e) {}
  };

  let cats = L.categorias || [];
  const prod = id => L.produtos.find(p => p.id === id);

  const placeholder = p => {
    const hues = {
      biquinis: ['#e2b0ab', '#b9707a'],
      maios: ['#d9c3a0', '#b99a78'],
      vestidos: ['#e8c9c0', '#c98a85'],
      saidas: ['#efe2c8', '#d2b48c']
    };
    const [a, b] = hues[p.categoria] || ['#e2b0ab', '#b9707a'];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='400' height='500' fill='url(#g)'/><text x='200' y='285' font-family='Georgia,serif' font-size='150' fill='white' fill-opacity='.85' text-anchor='middle' letter-spacing='-12'>MC</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };

  const imgs = p => (p.imagens && p.imagens.length) ? p.imagens : [placeholder(p)];

  /* --------------------------------------------------------------------------
     03. Cabeçalho e Navegação
     -------------------------------------------------------------------------- */
  function buildNav() {
    const links = [
      ['#/inicio', 'Início'],
      ...cats.map(c => ['#/cat/' + c.id, c.nome]),
      ['#/contato', 'Contato']
    ];
    $('#nav').innerHTML = links.map(([h, t]) => `<a href="${h}" data-h="${h}">${esc(t)}</a>`).join('');
  }

  function setActive(h) {
    $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.h === h));
    $('#nav').classList.remove('open');
    $('#burger').classList.remove('open');
  }

  $('#burger').onclick = () => {
    $('#nav').classList.toggle('open');
    $('#burger').classList.toggle('open');
  };

  window.addEventListener('scroll', () => {
    $('#hdr').classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });

  /* --------------------------------------------------------------------------
     04. Componentes e Templates de Visualização
     -------------------------------------------------------------------------- */
  const cardHTML = p => `
    <article class="card rv" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.nome)}">
      <div class="thumb">
        <img loading="lazy" src="${imgs(p)[0]}" alt="${esc(p.nome)}">
        ${p.esgotado ? '<span class="tag out">Esgotado</span>' : (p.destaque ? '<span class="tag">Destaque</span>' : '')}
        <span class="quick">Ver detalhes</span>
      </div>
      <div class="info">
        <h3>${esc(p.nome)}</h3>
        <div class="price">${brl(p.preco)}<small>${esc(cats.find(c => c.id === p.categoria)?.nome || '')}</small></div>
        <div class="dots">${(p.tamanhos || []).map(t => `<i>${esc(t)}</i>`).join('')}</div>
      </div>
    </article>
  `;

  function sobreHTML() {
    const t = L.textos;
    return `
      <section>
        <div class="wrap about">
          <div class="about-art rv logo-card">
            <img src="logo.png" alt="Logo Use Moda Clara" onerror="this.outerHTML='<b>M<i>C</i></b>'">
          </div>
          <div class="rv">
            <div class="eyebrow">Nossa história</div>
            <h2>${esc(t.sobreTitulo)}</h2>
            <p>${esc(t.sobreTexto)}</p>
            <div class="perks">
              <div class="perk"><b>Envio para todo o Brasil</b>Calcule o frete pelo CEP</div>
              <div class="perk"><b>Atendimento no WhatsApp</b>Pedido fácil e rápido</div>
              <div class="perk"><b>Peças selecionadas</b>Qualidade e caimento</div>
              <div class="perk"><b>Frete grátis</b>${L.frete.gratisAcima > 0 ? 'acima de ' + brl(L.frete.gratisAcima) : 'consulte condições'}</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function contatoHTML() {
    const t = L.textos;
    return `
      <section id="contato">
        <div class="wrap">
          <div class="contact rv">
            <div>
              <div class="eyebrow">Fale com a gente</div>
              <h2>Contato</h2>
              <p style="color:var(--brown)">Tem dúvida sobre tamanho, prazo ou disponibilidade? Chame no WhatsApp, respondemos com todo carinho.</p>
              <ul>
                <li><span>💬</span><div><b>WhatsApp</b><br>${esc(fmtPhone(L.whatsapp))}</div></li>
                ${L.instagram ? `<li><span>📸</span><div><b>Instagram</b><br><a href="https://instagram.com/${esc(L.instagram.replace('@', ''))}" target="_blank" rel="noopener" style="color:var(--rose3)">@${esc(L.instagram.replace('@', ''))}</a></div></li>` : ''}
                <li><span>🕘</span><div><b>Horário</b><br>${esc(t.horario)}</div></li>
                <li><span>📍</span><div><b>Atendimento</b><br>${esc(t.endereco)}</div></li>
              </ul>
              <a class="btn wa" target="_blank" rel="noopener" href="${waLink('Olá! Vim pelo site da Use Moda Clara e gostaria de mais informações.')}">Chamar no WhatsApp</a>
            </div>
            <div style="display:grid;place-items:center">
              <div class="hero-art" style="max-width:300px">
                <div class="arch" style="animation:none">
                  <div class="mc" style="font-size:6.5rem">M<i>C</i></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  const shellSVG = `<svg class="shell" viewBox="0 0 64 64" fill="none" stroke="#b99a78" stroke-width="2" stroke-linecap="round"><path fill="#f6e9d6" d="M32 8c-14 0-24 12-24 24 0 8 6 16 16 16h16c10 0 16-8 16-16 0-12-10-24-24-24z"/><path d="M32 8v40M32 48 14 22M32 48 50 22M32 48 8 36M32 48l24-12"/><path fill="#e8cfb0" stroke="none" d="M22 48h20l-3 8H25z"/></svg>`;
  const waveSVG = (c, o) => `<svg viewBox="0 0 1440 110" preserveAspectRatio="none"><path fill="${c}" fill-opacity="${o}" d="M0 60c120-40 240-40 360 0s240 40 360 0 240-40 360 0 240 40 360 0v50H0z"/></svg>`;

  function viewInicio() {
    const t = L.textos;
    const words = t.heroTitulo.split(' ').map((w, i) => `<span class="w" style="animation-delay:${0.1 + i * 0.12}s">${esc(w)}</span>`).join(' ');
    const dest = L.produtos.filter(p => p.destaque).slice(0, 8);
    const gradients = [
      'linear-gradient(135deg,#e8bcb6,#b9707a)',
      'linear-gradient(135deg,#e6d2b0,#b99a78)',
      'linear-gradient(135deg,#efc9bf,#c98a85)',
      'linear-gradient(135deg,#f0e3c8,#c9a97c)'
    ];
    const icons = ['👙', '🩱', '👗', '🌴'];

    return `
      <div class="hero">
        <div class="blob a"></div><div class="blob b"></div>
        <div class="wrap hero-grid">
          <div>
            <div class="eyebrow">${esc(L.slogan)}</div>
            <h1 class="grad-text">${words}</h1>
            <p class="lead">${esc(t.heroTexto)}</p>
            <div class="cta-row">
              <a class="btn primary" href="#/cat/${esc(cats[0]?.id || '')}">Ver coleção</a>
              <a class="btn ghost" href="#/contato">Fale conosco</a>
            </div>
          </div>
          <div class="hero-art">
            <div class="arch"><div class="mc">M<i>C</i></div></div>
            ${shellSVG}
            <div class="chip"><b>Todo o Brasil</b>Frete calculado pelo CEP</div>
          </div>
        </div>
        <div class="waves">${waveSVG('#e4d6bd', 1)}${waveSVG('#f6f2e8', 1)}</div>
      </div>
      <section style="background:var(--cream2);padding-top:3rem">
        <div class="wrap">
          <div class="sec-head rv">
            <div class="eyebrow">Coleções</div>
            <h2>Escolha seu verão</h2>
            <div class="divider">🐚</div>
          </div>
          <div class="cats">
            ${cats.map((c, i) => `
              <a class="cat rv" href="#/cat/${esc(c.id)}" style="--g:${gradients[i % 4]};transition-delay:${i * 0.08}s">
                <span class="ico">${icons[i % 4]}</span>
                <span>${esc(c.nome)}<small>${L.produtos.filter(p => p.categoria === c.id).length} peças</small></span>
              </a>
            `).join('')}
          </div>
        </div>
      </section>
      ${dest.length ? `
        <section>
          <div class="wrap">
            <div class="sec-head rv">
              <div class="eyebrow">Queridinhas</div>
              <h2>Peças em destaque</h2>
              <div class="divider">🐚</div>
            </div>
            <div class="grid">${dest.map(cardHTML).join('')}</div>
          </div>
        </section>
      ` : ''}
      ${sobreHTML()}
      ${contatoHTML()}
    `;
  }

  function viewCat(id) {
    const c = cats.find(x => x.id === id);
    if (!c) return viewInicio();
    const list = L.produtos.filter(p => p.categoria === id);
    return `
      <div class="wrap">
        <div class="page-head">
          <div class="eyebrow">Coleção</div>
          <h1 class="grad-text">${esc(c.nome)}</h1>
          <p>${list.length} ${list.length === 1 ? 'peça' : 'peças'} disponíveis</p>
        </div>
        <div class="filters" id="filters">
          <button class="on" data-f="all">Todas</button>
          <button data-f="dest">Destaques</button>
          <button data-f="asc">Menor preço</button>
          <button data-f="desc">Maior preço</button>
        </div>
        <div class="grid" id="plist">
          ${list.length ? list.map(cardHTML).join('') : '<p class="empty">Em breve novidades por aqui 🐚</p>'}
        </div>
      </div>
      <div style="height:4rem"></div>
    `;
  }

  function viewContato() {
    return `
      <div class="wrap">
        <div class="page-head">
          <div class="eyebrow">Atendimento</div>
          <h1 class="grad-text">Contato</h1>
        </div>
      </div>
      ${contatoHTML()}
      ${sobreHTML()}
    `;
  }

  /* --------------------------------------------------------------------------
     05. Sistema de Rotas
     -------------------------------------------------------------------------- */
  function route() {
    const h = location.hash || '#/inicio';
    const app = $('#app');
    let html, active = h;
    if (h.startsWith('#/cat/')) html = viewCat(h.slice(6));
    else if (h === '#/contato') html = viewContato();
    else { html = viewInicio(); active = '#/inicio'; }
    app.innerHTML = html;
    setActive(active);
    window.scrollTo({ top: 0, behavior: 'instant' });
    bindView(h);
    reveal();
  }

  function bindView(h) {
    $$('.card').forEach(c => {
      const open = () => openProduct(c.dataset.id);
      c.onclick = open;
      c.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      };
    });

    const fl = $('#filters');
    if (fl) {
      const id = h.slice(6);
      fl.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        $$('button', fl).forEach(x => x.classList.toggle('on', x === b));
        let list = L.produtos.filter(p => p.categoria === id);
        if (b.dataset.f === 'dest') list = list.filter(p => p.destaque);
        if (b.dataset.f === 'asc') list.sort((a, b) => a.preco - b.preco);
        if (b.dataset.f === 'desc') list.sort((a, b) => b.preco - a.preco);
        $('#plist').innerHTML = list.length ? list.map(cardHTML).join('') : '<p class="empty">Nenhuma peça nesse filtro.</p>';
        bindView(h);
        reveal();
      };
    }
  }

  let io;
  function reveal() {
    if (io) io.disconnect();
    io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    $$('.rv').forEach((el, i) => {
      if (!el.style.transitionDelay && el.classList.contains('card')) {
        el.style.transitionDelay = ((i % 4) * 0.07) + 's';
      }
      io.observe(el);
    });
  }

  window.addEventListener('hashchange', route);

  /* --------------------------------------------------------------------------
     06. Modal de Produto
     -------------------------------------------------------------------------- */
  let sel = {};
  function openProduct(id) {
    const p = prod(id);
    if (!p) return;
    sel = { id, tam: (p.tamanhos || [])[0] || '', cor: (p.cores || [])[0] || '', qtd: 1, img: 0 };
    const list = imgs(p);
    const m = $('#modal');
    m.innerHTML = `
      <div class="m-card" role="dialog" aria-modal="true" aria-label="${esc(p.nome)}">
        <button class="x" id="mx" aria-label="Fechar">×</button>
        <div class="gal">
          <img class="main" id="mimg" src="${list[0]}" alt="${esc(p.nome)}">
          ${list.length > 1 ? `
            <div class="thumbs">
              ${list.map((s, i) => `<img src="${s}" data-i="${i}" class="${i === 0 ? 'on' : ''}" alt="">`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="m-info">
          <div>
            <div class="eyebrow" style="margin-bottom:.5rem">${esc(cats.find(c => c.id === p.categoria)?.nome || '')}</div>
            <h2>${esc(p.nome)}</h2>
          </div>
          <div class="price">${brl(p.preco)}</div>
          <p style="color:var(--brown)">${esc(p.descricao)}</p>
          ${(p.tamanhos || []).length ? `
            <div>
              <div class="lbl">Tamanho</div>
              <div class="opts" id="o-tam">
                ${p.tamanhos.map((t, i) => `<button data-v="${esc(t)}" class="${i === 0 ? 'on' : ''}">${esc(t)}</button>`).join('')}
              </div>
            </div>
          ` : ''}
          ${(p.cores || []).length ? `
            <div>
              <div class="lbl">Cor</div>
              <div class="opts" id="o-cor">
                ${p.cores.map((t, i) => `<button data-v="${esc(t)}" class="${i === 0 ? 'on' : ''}">${esc(t)}</button>`).join('')}
              </div>
            </div>
          ` : ''}
          <div>
            <div class="lbl">Quantidade</div>
            <div class="qty" style="margin:0">
              <button id="qm">−</button>
              <b id="qn" style="min-width:24px;text-align:center">1</b>
              <button id="qp">+</button>
            </div>
          </div>
          <button class="btn primary" id="madd" ${p.esgotado ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>
            ${p.esgotado ? 'Esgotado' : 'Adicionar ao carrinho'}
          </button>
        </div>
      </div>
    `;

    m.classList.add('on');
    $('#scrim').classList.add('on');
    scrimFor = 'modal';
    document.body.style.overflow = 'hidden';

    $('#mx').onclick = closeAll;
    $$('.thumbs img', m).forEach(t => {
      t.onclick = () => {
        $('#mimg').src = list[t.dataset.i];
        $$('.thumbs img', m).forEach(x => x.classList.toggle('on', x === t));
      };
    });

    ['tam', 'cor'].forEach(k => {
      const o = $('#o-' + k);
      if (o) {
        o.onclick = e => {
          const b = e.target.closest('button');
          if (!b) return;
          sel[k] = b.dataset.v;
          $$('button', o).forEach(x => x.classList.toggle('on', x === b));
        };
      }
    });

    $('#qm').onclick = () => {
      sel.qtd = Math.max(1, sel.qtd - 1);
      $('#qn').textContent = sel.qtd;
    };
    $('#qp').onclick = () => {
      sel.qtd = Math.min(20, sel.qtd + 1);
      $('#qn').textContent = sel.qtd;
    };
    $('#madd').onclick = () => {
      if (p.esgotado) return;
      addToCart(p, sel.tam, sel.cor, sel.qtd);
      closeAll();
      toast('Adicionado ao carrinho ✨');
      setTimeout(openCart, 350);
    };
  }

  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal') closeAll();
  });

  /* --------------------------------------------------------------------------
     07. Carrinho e Cálculo de Frete
     -------------------------------------------------------------------------- */
  function addToCart(p, tam, cor, qtd) {
    const key = [p.id, tam, cor].join('|');
    const it = cart.find(i => i.key === key);
    if (it) it.qtd += qtd;
    else cart.push({ key, id: p.id, tam, cor, qtd });
    save();
    updBadge();
  }

  const cartLines = () => cart.map(i => ({ ...i, p: prod(i.id) })).filter(i => i.p);
  const subtotal = () => cartLines().reduce((s, i) => s + i.p.preco * i.qtd, 0);
  const qtdTotal = () => cartLines().reduce((s, i) => s + i.qtd, 0);

  function updBadge() {
    const n = qtdTotal();
    const b = $('#badge');
    b.textContent = n;
    b.classList.toggle('show', n > 0);
  }

  const UFREG = {
    PB: 'Local (PB)', AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
    ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste', PR: 'Sul', RS: 'Sul', SC: 'Sul',
    DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste',
    AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte'
  };

  function regiaoDe(uf) {
    const origem = L.frete.origemUF || 'PB';
    if (uf === origem && L.frete.regioes['Local (' + origem + ')']) return 'Local (' + origem + ')';
    let r = UFREG[uf];
    if (!r) return null;
    if (r.startsWith('Local') && origem !== 'PB') r = 'Nordeste';
    return L.frete.regioes[r] ? r : null;
  }

  function calcFrete(uf) {
    const reg = regiaoDe(uf);
    if (!reg) return null;
    const cfg = L.frete.regioes[reg];
    const extra = Math.max(0, qtdTotal() - 1) * (L.frete.adicionalPorPeca || 0);
    let valor = cfg.valor + extra;
    const gratis = L.frete.gratisAcima > 0 && subtotal() >= L.frete.gratisAcima;
    if (gratis) valor = 0;
    return { uf, regiao: reg, valor, prazo: cfg.prazo, gratis };
  }

  async function buscaCEP(cep) {
    cep = digits(cep);
    if (cep.length !== 8) throw new Error('Digite um CEP com 8 números.');
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!r.ok) throw new Error('Não foi possível consultar o CEP agora.');
    const d = await r.json();
    if (d.erro) throw new Error('CEP não encontrado.');
    return d;
  }

  function renderCart() {
    const d = $('#drawer');
    const lines = cartLines();
    const sub = subtotal();
    if (frete) {
      const nf = calcFrete(frete.uf);
      if (nf) frete = { ...nf, cep: frete.cep };
    }
    const total = sub + (frete ? frete.valor : 0);
    const faltaGratis = L.frete.gratisAcima > 0 ? Math.max(0, L.frete.gratisAcima - sub) : 0;

    d.innerHTML = `
      <div class="d-head">
        <h3>Seu carrinho</h3>
        <button class="x" id="dx" aria-label="Fechar">×</button>
      </div>
      <div class="d-body">
        ${lines.length ? lines.map((i, idx) => `
          <div class="item" style="animation-delay:${idx * 0.05}s">
            <img src="${imgs(i.p)[0]}" alt="">
            <div>
              <h4>${esc(i.p.nome)}</h4>
              <small>${[i.tam && 'Tam. ' + esc(i.tam), i.cor && esc(i.cor)].filter(Boolean).join(' · ')}</small>
              <div class="qty">
                <button data-a="m" data-k="${esc(i.key)}">−</button>
                <b>${i.qtd}</b>
                <button data-a="p" data-k="${esc(i.key)}">+</button>
              </div>
            </div>
            <div style="text-align:right">
              <b>${brl(i.p.preco * i.qtd)}</b><br>
              <button class="rm" data-a="r" data-k="${esc(i.key)}">remover</button>
            </div>
          </div>
        `).join('') : `
          <div class="cart-empty">
            <div>🐚</div>
            <p>Seu carrinho está vazio.</p><br>
            <a class="btn primary" href="#/inicio" id="goshop">Ver peças</a>
          </div>
        `}

        ${lines.length ? `
          ${faltaGratis > 0 ? `<p style="font-size:.88rem;color:var(--brown);text-align:center">Faltam <b>${brl(faltaGratis)}</b> para ganhar <b>frete grátis</b> 🎁</p>` : (L.frete.gratisAcima > 0 ? '<p style="font-size:.88rem;text-align:center;color:#2f8f57"><b>Você ganhou frete grátis!</b> 🎉</p>' : '')}
          <div class="box">
            <h4>Calcular frete</h4>
            <div class="row">
              <input id="cep" inputmode="numeric" placeholder="Seu CEP" value="${esc(maskCEP(cli.cep || ''))}" maxlength="9">
              <button class="mini" id="calc">Calcular</button>
            </div>
            <div class="ship-res" id="ship">${frete ? `📦 <b>${esc(frete.regiao)}</b> (${esc(frete.uf)}): ${frete.valor === 0 ? '<b>Grátis</b>' : brl(frete.valor)} · ${esc(frete.prazo)}` : ''}</div>
          </div>
          <div class="box">
            <h4>Seus dados</h4>
            <div class="f">
              <div class="f2">
                <label>Nome completo<input id="c-nome" autocomplete="name" value="${esc(cli.nome || '')}"></label>
                <label>WhatsApp<input id="c-tel" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" value="${esc(cli.tel || '')}"></label>
              </div>
              <div class="f3">
                <label>Rua<input id="c-rua" autocomplete="address-line1" value="${esc(cli.rua || '')}"></label>
                <label>Nº<input id="c-num" value="${esc(cli.num || '')}"></label>
              </div>
              <div class="f2">
                <label>Complemento<input id="c-comp" value="${esc(cli.comp || '')}"></label>
                <label>Bairro<input id="c-bairro" value="${esc(cli.bairro || '')}"></label>
              </div>
              <div class="f3">
                <label>Cidade<input id="c-cidade" value="${esc(cli.cidade || '')}"></label>
                <label>UF<input id="c-uf" maxlength="2" style="text-transform:uppercase" value="${esc(cli.uf || '')}"></label>
              </div>
              <label>Forma de pagamento
                <select id="c-pag">${['Pix', 'Cartão de crédito', 'Cartão de débito', 'A combinar'].map(o => `<option ${cli.pag === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
              </label>
              <label>Observações
                <textarea id="c-obs" rows="2" placeholder="Ex.: prefiro entrega à tarde">${esc(cli.obs || '')}</textarea>
              </label>
            </div>
          </div>
          <div class="box">
            <div class="sum">
              <div><span>Subtotal (${qtdTotal()} ${qtdTotal() === 1 ? 'peça' : 'peças'})</span><span>${brl(sub)}</span></div>
              <div><span>Frete</span><span>${frete ? (frete.valor === 0 ? 'Grátis' : brl(frete.valor)) : 'calcule acima'}</span></div>
              <div class="tot"><span>Total</span><span>${brl(total)}</span></div>
            </div>
          </div>
        ` : ''}
      </div>
      ${lines.length ? `
        <div class="d-foot">
          <button class="btn wa" id="finish">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="#fff"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm-4 7.6c-.3 0-.7.1-1 .5-.4.4-1.3 1.3-1.3 3.1s1.3 3.6 1.5 3.9c.2.2 2.6 4.1 6.4 5.6 3.2 1.2 3.8 1 4.5.9.7-.1 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.1-.2-.4-.3-.8-.5s-2.2-1.1-2.5-1.2c-.4-.1-.6-.2-.9.2-.2.4-1 1.2-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7c.2-.2.2-.4.4-.6.1-.3.1-.5 0-.7l-1.2-2.9c-.3-.7-.6-.6-.9-.6z"/></svg>
            Finalizar pelo WhatsApp
          </button>
          <small>Você será direcionada(o) ao WhatsApp com o pedido pronto para enviar.</small>
        </div>
      ` : ''}
    `;
    bindCart();
  }

  function readForm() {
    const g = id => ($('#' + id) || {}).value || '';
    cli = {
      ...cli,
      cep: g('cep') || cli.cep,
      nome: g('c-nome'),
      tel: g('c-tel'),
      rua: g('c-rua'),
      num: g('c-num'),
      comp: g('c-comp'),
      bairro: g('c-bairro'),
      cidade: g('c-cidade'),
      uf: g('c-uf').toUpperCase(),
      pag: g('c-pag'),
      obs: g('c-obs')
    };
    save();
  }

  function bindCart() {
    $('#dx').onclick = closeAll;
    const gs = $('#goshop');
    if (gs) gs.onclick = closeAll;

    $$('#drawer [data-a]').forEach(b => {
      b.onclick = () => {
        readForm();
        const it = cart.find(i => i.key === b.dataset.k);
        if (!it) return;
        if (b.dataset.a === 'p') it.qtd = Math.min(20, it.qtd + 1);
        if (b.dataset.a === 'm') it.qtd = Math.max(1, it.qtd - 1);
        if (b.dataset.a === 'r') cart = cart.filter(i => i !== it);
        save();
        updBadge();
        renderCart();
      };
    });

    const cep = $('#cep');
    if (!cep) return;
    cep.oninput = () => { cep.value = maskCEP(cep.value); };
    cep.onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#calc').click();
      }
    };

    $('#c-tel').oninput = e => { e.target.value = maskTel(e.target.value); };
    $('#c-uf').oninput = e => { e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase(); };
    $('#c-uf').onchange = () => {
      const uf = $('#c-uf').value.toUpperCase();
      const f = calcFrete(uf);
      if (f && (!frete || frete.uf !== uf)) {
        readForm();
        frete = { ...f, cep: digits(cli.cep) };
        renderCart();
      }
    };

    $('#calc').onclick = async () => {
      const out = $('#ship');
      const btn = $('#calc');
      out.className = 'ship-res';
      out.textContent = 'Consultando…';
      btn.disabled = true;
      try {
        const d = await buscaCEP(cep.value);
        const f = calcFrete(d.uf);
        if (!f) throw new Error('Ainda não entregamos nessa região. Fale conosco no WhatsApp.');
        readForm();
        cli = { ...cli, cep: digits(cep.value), rua: d.logradouro || cli.rua, bairro: d.bairro || cli.bairro, cidade: d.localidade, uf: d.uf };
        frete = { ...f, cep: digits(cep.value) };
        save();
        renderCart();
      } catch (err) {
        out.className = 'ship-res err';
        out.textContent = err.message === 'Failed to fetch' ? 'Sem conexão para consultar o CEP. Tente novamente.' : err.message;
      } finally {
        btn.disabled = false;
      }
    };

    const fin = $('#finish');
    if (fin) fin.onclick = finalizar;
  }

  /* --------------------------------------------------------------------------
     08. Finalização do Pedido (Mensagem WhatsApp)
     -------------------------------------------------------------------------- */
  function finalizar() {
    readForm();
    const miss = [];
    if (!cli.nome.trim()) miss.push('nome');
    if (digits(cli.tel).length < 10) miss.push('WhatsApp');
    if (!cli.rua.trim() || !cli.num.trim()) miss.push('endereço');
    if (!cli.cidade.trim() || cli.uf.length !== 2) miss.push('cidade/UF');
    if (miss.length) {
      toast('Preencha: ' + miss.join(', '));
      return;
    }
    const f = calcFrete(cli.uf);
    if (!f) {
      toast('UF inválida. Confira o endereço.');
      return;
    }
    frete = { ...f, cep: digits(cli.cep) };
    const lines = cartLines(), sub = subtotal(), total = sub + f.valor;
    const sep = '──────────────────────────';
    const formatItem = i => {
      const specs = [i.tam ? `Tam: ${i.tam}` : '', i.cor ? `Cor: ${i.cor}` : ''].filter(Boolean).join(' | ');
      return `🛍️ *${i.qtd}x ${i.p.nome}*${specs ? `\n   ▫️ ${specs}` : ''}\n   ▫️ Valor: ${brl(i.p.preco * i.qtd)}`;
    };

    const msg = [
      `🌸 *NOVO PEDIDO — ${L.nome.toUpperCase()}* 🌸`,
      sep,
      '📦 *ITENS DO PEDIDO*',
      lines.map(formatItem).join('\n\n'),
      sep,
      '💳 *PAGAMENTO & VALORES*',
      `• Subtotal: ${brl(sub)}`,
      `• Frete (${f.regiao} • ${f.prazo}): ${f.valor === 0 ? 'Grátis' : brl(f.valor)}`,
      `• *TOTAL: ${brl(total)}*`,
      `• Forma de pagamento: *${cli.pag || 'A combinar'}*`,
      sep,
      '👤 *DADOS DA CLIENTE*',
      `• Nome: ${cli.nome}`,
      `• WhatsApp: ${cli.tel}`,
      sep,
      '📍 *ENDEREÇO DE ENTREGA*',
      `• Rua: ${cli.rua}, nº ${cli.num}`,
      cli.comp ? `• Complemento: ${cli.comp}` : '',
      cli.bairro ? `• Bairro: ${cli.bairro}` : '',
      `• Cidade/UF: ${cli.cidade}/${cli.uf}`,
      cli.cep ? `• CEP: ${maskCEP(cli.cep)}` : '',
      cli.obs ? `${sep}\n📝 *OBSERVAÇÕES:*\n${cli.obs}` : '',
      sep,
      '_Pedido gerado pelo site_'
    ].filter(Boolean).join('\n');

    const url = waLink(msg);
    const w = window.open(url, '_blank', 'noopener');
    if (!w) location.href = url;
    toast('Abrindo o WhatsApp… envie a mensagem para concluir ✅');
  }

  /* --------------------------------------------------------------------------
     09. Controle de Modais e Overlays
     -------------------------------------------------------------------------- */
  let scrimFor = '';
  function openCart() {
    closeAll(true);
    renderCart();
    $('#drawer').classList.add('on');
    $('#scrim').classList.add('on');
    scrimFor = 'cart';
    document.body.style.overflow = 'hidden';
  }

  function closeAll(keep) {
    $('#drawer').classList.remove('on');
    $('#modal').classList.remove('on');
    if (keep !== true) {
      $('#scrim').classList.remove('on');
      document.body.style.overflow = '';
    }
  }

  $('#scrim').onclick = () => closeAll();
  $('#cartBtn').onclick = openCart;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
  });

  let tt;
  function toast(t) {
    const el = $('#toast');
    el.textContent = t;
    el.classList.add('on');
    clearTimeout(tt);
    tt = setTimeout(() => el.classList.remove('on'), 3200);
  }

  /* --------------------------------------------------------------------------
     10. Inicialização
     -------------------------------------------------------------------------- */
  async function init() {
    if (window.sbClient) {
      try {
        const { data, error } = await window.sbClient
          .from('loja_config')
          .select('dados')
          .eq('id', 1)
          .single();
        if (data && data.dados) {
          window.LOJA = data.dados;
          L = window.LOJA;
          cats = L.categorias || [];
        }
      } catch (err) {
        console.warn('Usando dados de dados.js como fallback:', err);
      }
    }

    $('#logoMark').innerHTML = '<span class="logo-mark">M<i>C</i></span>';
    $('#yr').textContent = new Date().getFullYear();
    $('#waFloat').href = waLink('Olá! Vim pelo site da Use Moda Clara.');
    document.title = (L.nome || 'Use Moda Clara') + ' — Moda Praia';

    buildNav();
    updBadge();
    route();
  }

  init();
})();
