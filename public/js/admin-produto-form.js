/* =============================================
   FORMULÁRIO DE PRODUTO (Admin)
   ============================================= */

fetch('/api/auth/check').then(r => { if (!r.ok) location.href = '/admin/index.html'; });

document.getElementById('logoutBtn').addEventListener('click', async e => {
  e.preventDefault();
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = '/admin/index.html';
});

const params = new URLSearchParams(location.search);
const editId = params.get('id');
let variants = [];   // [{id, name}]
let lots = [];       // [{id, name, availableFrom, availableUntil, price, variantPrices:{}, maxQuantity}]
let lotCounter = 0;
let productType = 'event'; // 'event' | 'clothing' | 'event_with_shirt'
let selectedSizes = new Set();

const SIZE_ORDER = ['PP','P','M','G','GG','XG','2XG','3XG'];
const CAT_ORDER  = [
  'DeMolay Ativo – Com Kit', 'DeMolay Ativo – Sem Kit',
  'Sênior/Maçom – Com Kit',  'Sênior/Maçom – Sem Kit',
  'Convidado – Com Kit',     'Convidado – Sem Kit',
];

let selectedEventCats  = new Set(); // categorias selecionadas para event_with_shirt
let selectedEventSizes = new Set(); // tamanhos de camisa para event_with_shirt
let selectedEventBaseCats = new Set(); // categorias para evento sem camisa

// ── Tipo de produto ───────────────────────────
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    productType = btn.dataset.type;
    document.getElementById('p-type').value = productType;
    applyProductType(true);
  });
});

function applyProductType(switching = false) {
  const isClothing   = productType === 'clothing';
  const isEventShirt = productType === 'event_with_shirt';
  const isEvent      = productType === 'event';

  document.getElementById('event-cats-section').style.display     = isEvent      ? 'block' : 'none';
  document.getElementById('clothing-sizes-section').style.display = isClothing   ? 'block' : 'none';
  document.getElementById('event-shirt-section').style.display    = isEventShirt ? 'block' : 'none';
  document.getElementById('variants-card').style.display          = isEvent      ? 'block' : 'none';

  if (switching) {
    if (isEvent) {
      selectedEventBaseCats = new Set();
      document.querySelectorAll('.ec-cat-btn').forEach(b => b.classList.remove('selected'));
      variants = [];
      renderVariants();
      renderAllLots();
    } else if (isClothing) {
      variants = [];
      selectedSizes = new Set();
      document.querySelectorAll('.size-toggle-btn').forEach(b => b.classList.remove('selected'));
      syncSizesToVariants();
    } else if (isEventShirt) {
      // Começa sem nada selecionado — admin escolhe o que quer
      if (!editId) {
        selectedEventCats  = new Set();
        selectedEventSizes = new Set();
        document.querySelectorAll('.ews-cat-btn, .ews-size-btn').forEach(b => b.classList.remove('selected'));
      }
      syncEventShirt();
    } else {
      variants = [];
      renderVariants();
      renderAllLots();
    }
  }
}

// ── Seletor de tamanhos (vestimenta) ──────────
document.querySelectorAll('.size-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const size = btn.dataset.size;
    if (selectedSizes.has(size)) {
      selectedSizes.delete(size);
      btn.classList.remove('selected');
    } else {
      selectedSizes.add(size);
      btn.classList.add('selected');
    }
    syncSizesToVariants();
  });
});

function syncSizesToVariants() {
  const existing = new Map(variants.map(v => [v.name, v.id]));
  variants = SIZE_ORDER
    .filter(s => selectedSizes.has(s))
    .map(s => ({ id: existing.get(s) || ('v_' + s), name: s }));
  renderVariants();
  renderAllLots();
}

// ── Evento sem Camisa: categorias ─────────────
const EC_CAT_ORDER = ['DeMolay Ativo', 'Sênior/Maçom', 'Convidado'];

document.querySelectorAll('.ec-cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.dataset.ecat;
    if (selectedEventBaseCats.has(cat)) {
      selectedEventBaseCats.delete(cat);
      btn.classList.remove('selected');
    } else {
      selectedEventBaseCats.add(cat);
      btn.classList.add('selected');
    }
    syncEventBaseCats();
  });
});

function syncEventBaseCats() {
  // Mantém variantes manuais (não pré-definidas) e sincroniza as pré-definidas
  const manualVariants = variants.filter(v => !EC_CAT_ORDER.includes(v.name));
  const existing = new Map(variants.map(v => [v.name, v.id]));
  const toggledVariants = EC_CAT_ORDER
    .filter(c => selectedEventBaseCats.has(c))
    .map(c => ({ id: existing.get(c) || ('v_ec_' + c.replace(/\s/g,'')), name: c }));
  variants = [...toggledVariants, ...manualVariants];
  renderVariants();
  renderAllLots();
}

// ── Evento com Camisa: categorias e tamanhos ──
document.querySelectorAll('.ews-cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.dataset.cat;
    if (selectedEventCats.has(cat)) {
      selectedEventCats.delete(cat);
      btn.classList.remove('selected');
    } else {
      selectedEventCats.add(cat);
      btn.classList.add('selected');
    }
    syncEventShirt();
  });
});

document.querySelectorAll('.ews-size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sz = btn.dataset.ewsSize;
    if (selectedEventSizes.has(sz)) {
      selectedEventSizes.delete(sz);
      btn.classList.remove('selected');
    } else {
      selectedEventSizes.add(sz);
      btn.classList.add('selected');
    }
    // availableSizes atualizado via selectedEventSizes — sem re-render de lotes
  });
});

function syncEventShirt() {
  const existing = new Map(variants.map(v => [v.name, v.id]));
  variants = CAT_ORDER
    .filter(c => selectedEventCats.has(c))
    .map(c => ({ id: existing.get(c) || ('v_cat_' + c.replace(/\s/g,'')), name: c }));
  renderVariants();
  renderAllLots();
}

// ── Init ─────────────────────────────────────
if (editId) {
  document.getElementById('form-title').textContent = 'Editar Produto';
  loadProduct();
} else {
  document.getElementById('form-title').textContent = 'Novo Produto';
  addLot(); // começa com 1 lote
}

async function loadProduct() {
  try {
    const product = await fetch(`/api/shop/products/${editId}`).then(r => r.json());
    document.getElementById('p-name').value = product.name || '';
    document.getElementById('p-desc').value = product.description || '';
    document.getElementById('p-active').checked = product.active;
    if (product.availableFrom) document.getElementById('p-from').value = toDateTimeLocal(product.availableFrom);
    if (product.availableUntil) document.getElementById('p-until').value = toDateTimeLocal(product.availableUntil);
    if (product.imageUrl) document.getElementById('p-imgurl').value = product.imageUrl;
    if (product.imageType === 'upload' && product.image) {
      document.getElementById('img-preview').src = `/uploads/${product.image}`;
      document.getElementById('current-img-preview').style.display = 'block';
    }

    // Restaura tipo de produto
    productType = product.productType || 'event';
    document.getElementById('p-type').value = productType;
    document.querySelectorAll('.type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === productType);
    });

    variants = product.variants || [];

    if (productType === 'event') {
      variants.forEach(v => {
        if (EC_CAT_ORDER.includes(v.name)) selectedEventBaseCats.add(v.name);
      });
      document.querySelectorAll('.ec-cat-btn').forEach(btn => {
        if (selectedEventBaseCats.has(btn.dataset.ecat)) btn.classList.add('selected');
      });
    } else if (productType === 'clothing') {
      variants.forEach(v => selectedSizes.add(v.name));
      document.querySelectorAll('.size-toggle-btn').forEach(btn => {
        if (selectedSizes.has(btn.dataset.size)) btn.classList.add('selected');
      });
    } else if (productType === 'event_with_shirt') {
      variants.forEach(v => selectedEventCats.add(v.name));
      document.querySelectorAll('.ews-cat-btn').forEach(btn => {
        if (selectedEventCats.has(btn.dataset.cat)) btn.classList.add('selected');
      });
      (product.availableSizes || []).forEach(s => selectedEventSizes.add(s));
      document.querySelectorAll('.ews-size-btn').forEach(btn => {
        if (selectedEventSizes.has(btn.dataset.ewsSize)) btn.classList.add('selected');
      });
      if (product.kitDeadline) {
        document.getElementById('p-kit-deadline').value = toDateTimeLocal(product.kitDeadline);
      }
    }

    applyProductType(false);
    renderVariants();

    lots = (product.lots || []).map(l => ({ ...l }));
    renderAllLots();
  } catch {
    document.getElementById('form-msg').innerHTML = '<div class="alert alert-error">Erro ao carregar produto.</div>';
  }
}

function toDateTimeLocal(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Abas imagem ───────────────────────────────
document.querySelectorAll('.upload-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.upload-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// Dropzone imagem
const imgInput = document.getElementById('img-input');
imgInput.addEventListener('change', () => {
  if (imgInput.files[0]) {
    document.getElementById('img-filename').textContent = imgInput.files[0].name;
    document.getElementById('img-selected').classList.add('show');
  }
});

// ── Variantes ────────────────────────────────
document.getElementById('add-variant-btn').addEventListener('click', addVariant);
document.getElementById('variant-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addVariant(); } });

function addVariant() {
  const input = document.getElementById('variant-input');
  const name = input.value.trim();
  if (!name) return;
  if (variants.find(v => v.name.toLowerCase() === name.toLowerCase())) {
    input.value = '';
    return;
  }
  const id = 'v_' + Date.now();
  variants.push({ id, name });
  input.value = '';
  renderVariants();
  // Re-renderiza lotes para adicionar campo de preço da nova variante
  renderAllLots();
}

function removeVariant(id) {
  variants = variants.filter(v => v.id !== id);
  // Remove preço desta variante dos lotes
  lots.forEach(l => { if (l.variantPrices) delete l.variantPrices[id]; });
  renderVariants();
  renderAllLots();
}

function renderVariants() {
  const list = document.getElementById('variants-list');
  if (!variants.length) {
    list.innerHTML = '<span style="font-size:0.82rem;color:var(--text-muted);">Nenhuma variante — o lote terá preço único.</span>';
    return;
  }
  list.innerHTML = variants.map(v => `
    <span class="variant-tag">
      ${escapeHtml(v.name)}
      <button type="button" onclick="removeVariant('${v.id}')" title="Remover">×</button>
    </span>`).join('');
}

// ── Lotes ────────────────────────────────────
document.getElementById('add-lot-btn').addEventListener('click', () => addLot());

function addLot(data) {
  lotCounter++;
  const lot = data || {
    id: 'l_' + Date.now(),
    name: `${lotCounter}º Lote`,
    availableFrom: '',
    availableUntil: '',
    price: '',
    variantPrices: {},
    maxQuantity: ''
  };
  if (!lots.find(l => l.id === lot.id)) lots.push(lot);
  renderAllLots();
}

function removeLot(id) {
  lots = lots.filter(l => l.id !== id);
  renderAllLots();
}

function renderAllLots() {
  const builder = document.getElementById('lots-builder');
  if (!lots.length) {
    builder.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem;">Nenhum lote configurado.</p>';
    return;
  }
  builder.innerHTML = lots.map((lot, idx) => renderLotCard(lot, idx)).join('');

  // Adiciona listeners para os campos de cada lote
  lots.forEach(lot => {
    const card = document.querySelector(`[data-lot-id="${lot.id}"]`);
    if (!card) return;

    card.querySelector('.lot-name-input')?.addEventListener('input', e => {
      const l = lots.find(x => x.id === lot.id);
      if (l) l.name = e.target.value;
    });
    card.querySelector('.lot-from-input')?.addEventListener('change', e => {
      const l = lots.find(x => x.id === lot.id);
      if (l) l.availableFrom = e.target.value ? new Date(e.target.value).toISOString() : '';
    });
    card.querySelector('.lot-until-input')?.addEventListener('change', e => {
      const l = lots.find(x => x.id === lot.id);
      if (l) l.availableUntil = e.target.value ? new Date(e.target.value).toISOString() : '';
    });
    card.querySelector('.lot-maxqty-input')?.addEventListener('input', e => {
      const l = lots.find(x => x.id === lot.id);
      if (l) l.maxQuantity = e.target.value ? parseInt(e.target.value) : null;
    });

    if (variants.length > 0) {
      card.querySelectorAll('.variant-price-input').forEach(inp => {
        inp.addEventListener('input', e => {
          const l = lots.find(x => x.id === lot.id);
          if (!l.variantPrices) l.variantPrices = {};
          l.variantPrices[inp.dataset.variant] = parseFloat(e.target.value) || 0;
        });
      });
    } else {
      card.querySelector('.lot-single-price')?.addEventListener('input', e => {
        const l = lots.find(x => x.id === lot.id);
        if (l) l.price = parseFloat(e.target.value) || 0;
      });
    }
  });
}

function renderLotCard(lot, idx) {
  const fromVal = lot.availableFrom ? toDateTimeLocal(lot.availableFrom) : '';
  const untilVal = lot.availableUntil ? toDateTimeLocal(lot.availableUntil) : '';

  // Campos de preço
  let priceFields = '';
  if (productType === 'clothing') {
    // Vestimenta: preço único para todos os tamanhos
    priceFields = `
      <div class="form-group" style="margin:0;">
        <label>Preço único – todos os tamanhos (R$)</label>
        <input type="number" step="0.01" min="0" class="form-control lot-single-price"
          value="${lot.price ?? ''}" placeholder="0,00">
      </div>`;
  } else if (variants.length > 0) {
    // Evento / Evento com Camisa: preço por variante
    priceFields = variants.map(v => `
      <div class="form-group" style="margin:0;">
        <label>Preço – ${escapeHtml(v.name)} (R$)</label>
        <input type="number" step="0.01" min="0" class="form-control variant-price-input"
          data-variant="${v.id}"
          value="${lot.variantPrices?.[v.id] ?? ''}"
          placeholder="0,00">
      </div>`).join('');
  } else {
    priceFields = `
      <div class="form-group" style="margin:0;">
        <label>Preço único (R$)</label>
        <input type="number" step="0.01" min="0" class="form-control lot-single-price"
          value="${lot.price ?? ''}" placeholder="0,00">
      </div>`;
  }

  return `
    <div class="lot-item-card" data-lot-id="${lot.id}">
      <div class="lot-header">
        <span class="lot-title">Lote ${idx + 1}</span>
        <button type="button" class="btn btn-danger btn-sm" onclick="removeLot('${lot.id}')">Remover</button>
      </div>
      <div class="lot-grid">
        <div class="form-group" style="margin:0;grid-column:1/-1;">
          <label>Nome do Lote</label>
          <input type="text" class="form-control lot-name-input" value="${escapeHtml(lot.name)}" placeholder="Ex: 1º Lote">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Início do Lote</label>
          <input type="datetime-local" class="form-control lot-from-input" value="${fromVal}">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Fim do Lote</label>
          <input type="datetime-local" class="form-control lot-until-input" value="${untilVal}">
        </div>
        ${priceFields}
        <div class="form-group" style="margin:0;">
          <label>Limite de vagas (opcional)</label>
          <input type="number" min="1" class="form-control lot-maxqty-input"
            value="${lot.maxQuantity ?? ''}" placeholder="Sem limite">
        </div>
      </div>
    </div>`;
}

// ── Submit ────────────────────────────────────
document.getElementById('productForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('saveBtn');
  const msgEl = document.getElementById('save-msg');
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  msgEl.innerHTML = '';

  // Sincroniza lots com o estado atual dos inputs
  // (os listeners já fazem isso, mas garante limpeza)
  const useSinglePrice = productType === 'clothing' || variants.length === 0;
  const cleanLots = lots.map(l => ({
    id: l.id,
    name: l.name || '',
    availableFrom: l.availableFrom || null,
    availableUntil: l.availableUntil || null,
    price: useSinglePrice ? (parseFloat(l.price) || 0) : null,
    variantPrices: !useSinglePrice ? (l.variantPrices || {}) : {},
    maxQuantity: l.maxQuantity ? parseInt(l.maxQuantity) : null,
    soldQuantity: l.soldQuantity || 0
  }));

  const form = document.getElementById('productForm');
  const formData = new FormData(form);
  formData.set('active', document.getElementById('p-active').checked ? 'true' : 'false');
  formData.set('productType', productType);
  formData.set('variants', JSON.stringify(variants));
  const availableSizes = productType === 'event_with_shirt'
    ? SIZE_ORDER.filter(s => selectedEventSizes.has(s))
    : [];
  formData.set('availableSizes', JSON.stringify(availableSizes));
  const kitDeadlineVal = document.getElementById('p-kit-deadline').value;
  formData.set('kitDeadline', kitDeadlineVal ? new Date(kitDeadlineVal).toISOString() : '');
  formData.set('lots', JSON.stringify(cleanLots));

  // Se não selecionou arquivo de imagem, garante campo vazio
  const imgFile = document.getElementById('img-input').files[0];
  if (!imgFile) formData.delete('image');

  const url = editId ? `/api/admin/shop/products/${editId}` : '/api/admin/shop/products';
  const method = editId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, { method, body: formData });
    const data = await res.json();
    if (res.ok) {
      msgEl.innerHTML = '<div class="alert alert-success">Produto salvo com sucesso! Redirecionando...</div>';
      setTimeout(() => location.href = '/admin/produtos.html', 1200);
    } else {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Erro ao salvar.')}</div>`;
      btn.disabled = false;
      btn.textContent = 'Salvar Produto';
    }
  } catch {
    msgEl.innerHTML = '<div class="alert alert-error">Erro de conexão. Tente novamente.</div>';
    btn.disabled = false;
    btn.textContent = 'Salvar Produto';
  }
});

function escapeHtml(str) {
  const d = document.createElement('div'); d.textContent = String(str||''); return d.innerHTML;
}
