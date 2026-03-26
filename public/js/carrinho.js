/* =============================================
   PÁGINA DO CARRINHO
   ============================================= */

renderCart();

function renderCart() {
  const section = document.getElementById('cart-section');
  const cart = getCart();

  if (!cart.length) {
    section.innerHTML = `
      <div class="empty-state" style="padding:5rem 1rem;">
        <div style="width:80px;height:80px;border-radius:50%;background:var(--green-dim);border:2px solid var(--green-border);display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="1.5" width="36" height="36">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
        </div>
        <h3 style="font-size:1.2rem;margin-bottom:0.5rem;color:var(--text-heading);">Carrinho vazio</h3>
        <p style="color:var(--text-muted);margin-bottom:1.5rem;">Você ainda não adicionou nenhum item ao carrinho.</p>
        <a href="/loja.html" class="btn btn-primary" style="margin:0 auto;">
          Explorar Produtos
        </a>
      </div>`;
    return;
  }

  const total = getCartTotal();

  const itemsHtml = cart.map(item => {
    const subtotal = item.price * item.quantity;
    const imgEl = item.productImage
      ? `<img src="${escapeHtml(item.productImage)}" alt="${escapeHtml(item.productName)}" class="cart-item-img">`
      : `<div class="cart-item-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg></div>`;

    return `
      <div class="cart-item"
        data-product="${escapeHtml(item.productId)}"
        data-lot="${escapeHtml(item.lotId)}"
        data-variant="${escapeHtml(item.variantId || '')}">
        <div class="cart-item-product">
          ${imgEl}
          <div>
            <div class="cart-item-name">${escapeHtml(item.productName)}</div>
            <div class="cart-item-variant">${escapeHtml(item.lotName)}${item.variantName ? ' – ' + escapeHtml(item.variantName) : ''}${item.shirtSize ? ' · Tam. <strong>' + escapeHtml(item.shirtSize) + '</strong>' : ''}</div>
          </div>
        </div>
        <div class="cart-item-price">${formatBRL(item.price)}</div>
        <div class="cart-item-qty">
          <button class="cart-qty-btn" data-action="minus">−</button>
          <span>${item.quantity}</span>
          <button class="cart-qty-btn" data-action="plus">+</button>
        </div>
        <div class="cart-item-subtotal">${formatBRL(subtotal)}</div>
        <button class="cart-remove-btn" title="Remover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </button>
      </div>`;
  }).join('');

  section.innerHTML = `
    <div class="cart-layout">
      <div>
        <div class="cart-table">
          <div class="cart-table-header">
            <span>Produto</span>
            <span>Preço</span>
            <span>Qtd</span>
            <span>Subtotal</span>
            <span></span>
          </div>
          ${itemsHtml}
        </div>

        <div class="checkout-form-card">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Dados do Participante
          </h3>
          <div id="checkout-msg"></div>
          <form id="checkoutForm" novalidate>
            <div class="checkout-grid-2">
              <div class="form-group">
                <label for="c-nome">Nome completo *</label>
                <input type="text" id="c-nome" class="form-control" placeholder="Seu nome completo" required>
              </div>
              <div class="form-group">
                <label for="c-email">E-mail *</label>
                <input type="email" id="c-email" class="form-control" placeholder="seu@email.com" required>
              </div>
              <div class="form-group">
                <label for="c-phone">WhatsApp / Telefone *</label>
                <input type="tel" id="c-phone" class="form-control" placeholder="(86) 99999-9999" required>
              </div>
              <div class="form-group">
                <label for="c-chapter">Nome do Capítulo *</label>
                <input type="text" id="c-chapter" class="form-control" placeholder="Ex: Cap. Dom Pedro II" required>
              </div>
            </div>
            <div class="form-group">
              <label for="c-notes">Observações (opcional)</label>
              <textarea id="c-notes" class="form-control" rows="2" placeholder="Alguma informação adicional..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary" id="checkoutBtn" style="width:100%;justify-content:center;font-size:1rem;padding:0.9rem;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Confirmar Pedido
            </button>
          </form>
        </div>
      </div>

      <div>
        <div class="cart-summary">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="color:var(--green);">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            Resumo do Pedido
          </h3>
          ${cart.map(i => `
            <div class="cart-summary-row">
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(i.productName)} <strong style="color:var(--text-heading);">×${i.quantity}</strong></span>
              <span style="margin-left:0.75rem;">${formatBRL(i.price * i.quantity)}</span>
            </div>`).join('')}
          <div class="cart-summary-total cart-summary-row">
            <span>Total</span>
            <span>${formatBRL(total)}</span>
          </div>
          <div style="margin-top:1.25rem;font-size:0.78rem;color:var(--text-muted);line-height:1.5;padding:0.75rem;background:var(--bg-section);border-radius:var(--radius);border:1px solid var(--border);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="color:var(--gold);vertical-align:-2px;margin-right:0.3rem;">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Preencha seus dados e confirme o pedido. As instruções de pagamento serão exibidas após a confirmação.
          </div>
        </div>
      </div>
    </div>`;

  attachCartEvents();
}

function attachCartEvents() {
  // Remover itens
  document.querySelectorAll('.cart-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.cart-item');
      removeFromCart(row.dataset.product, row.dataset.lot, row.dataset.variant || null);
      renderCart();
    });
  });

  // Qty +/-
  document.querySelectorAll('.cart-qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.cart-item');
      const cart = getCart();
      const item = cart.find(i =>
        i.productId === row.dataset.product &&
        i.lotId === row.dataset.lot &&
        (i.variantId||'') === (row.dataset.variant||'')
      );
      if (!item) return;
      const newQty = btn.dataset.action === 'plus' ? item.quantity + 1 : item.quantity - 1;
      updateCartQty(row.dataset.product, row.dataset.lot, row.dataset.variant || null, newQty);
      renderCart();
    });
  });

  // Checkout
  document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckout);

  // Remove estado de erro ao digitar no campo
  document.querySelectorAll('#checkoutForm .form-control').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('is-invalid'));
  });
}

async function handleCheckout(e) {
  e.preventDefault();
  const btn = document.getElementById('checkoutBtn');
  const msgEl = document.getElementById('checkout-msg');
  btn.disabled = true;
  btn.textContent = 'Processando...';
  msgEl.innerHTML = '';

  const cart = getCart();
  const customer = {
    name: document.getElementById('c-nome').value.trim(),
    email: document.getElementById('c-email').value.trim(),
    phone: document.getElementById('c-phone').value.trim(),
    chapter: document.getElementById('c-chapter').value.trim()
  };
  const notes = document.getElementById('c-notes').value.trim();

  // Limpa estados de erro anteriores
  document.querySelectorAll('.form-control.is-invalid').forEach(el => el.classList.remove('is-invalid'));

  // Validação de campos obrigatórios
  const fieldMap = { name: 'c-nome', email: 'c-email', phone: 'c-phone', chapter: 'c-chapter' };
  let firstInvalid = null;
  for (const [key, id] of Object.entries(fieldMap)) {
    if (!customer[key]) {
      const el = document.getElementById(id);
      el.classList.add('is-invalid');
      firstInvalid = firstInvalid || el;
    }
  }
  if (firstInvalid) {
    msgEl.innerHTML = `<div class="alert alert-error">Preencha todos os campos obrigatórios.</div>`;
    firstInvalid.focus();
    btn.disabled = false;
    btn.textContent = 'Confirmar Pedido';
    return;
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(customer.email)) {
    document.getElementById('c-email').classList.add('is-invalid');
    document.getElementById('c-email').focus();
    msgEl.innerHTML = `<div class="alert alert-error">Informe um e-mail válido.</div>`;
    btn.disabled = false;
    btn.textContent = 'Confirmar Pedido';
    return;
  }

  const total = getCartTotal();

  const items = cart.map(i => ({
    productId: i.productId,
    productName: i.productName,
    lotId: i.lotId,
    lotName: i.lotName,
    variantId: i.variantId,
    variantName: i.variantName,
    shirtSize: i.shirtSize || null,
    price: i.price,
    quantity: i.quantity
  }));

  try {
    const res = await fetch('/api/shop/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer, items, total, notes })
    });

    const data = await res.json();

    if (!res.ok) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Erro ao processar pedido.')}</div>`;
      btn.disabled = false;
      btn.textContent = 'Confirmar Pedido';
      return;
    }

    // Limpa carrinho e mostra modal de confirmação
    clearCart();
    showSuccessModal(data.order, customer, total);

  } catch {
    msgEl.innerHTML = `<div class="alert alert-error">Erro de conexão. Tente novamente.</div>`;
    btn.disabled = false;
    btn.textContent = 'Confirmar Pedido';
  }
}

function generatePixPayload(pixKey, pixName, amount, txid) {
  function tlv(id, value) {
    return id + String(value.length).padStart(2, '0') + value;
  }
  function crc16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  }

  const merchantAccount = tlv('26',
    tlv('00', 'br.gov.bcb.pix') +
    tlv('01', pixKey)
  );
  const addlData = tlv('62', tlv('05', (txid || '***').substring(0, 25)));
  const name = (pixName || 'DeMolay Piaui')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '').substring(0, 25);

  let payload =
    tlv('00', '01') +
    merchantAccount +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', Number(amount).toFixed(2)) +
    tlv('58', 'BR') +
    tlv('59', name) +
    tlv('60', 'Teresina') +
    addlData +
    '6304';

  return payload + crc16(payload);
}

async function showSuccessModal(order, customer, total) {
  let cfg = { pixKey: '', pixType: 'email', pixName: '', whatsapp: '' };
  try { cfg = await fetch('/api/shop/config').then(r => r.json()); } catch {}

  const pixPayload = cfg.pixKey
    ? generatePixPayload(cfg.pixKey, cfg.pixName, total, order.id.slice(0, 25))
    : null;

  const pixSection = cfg.pixKey ? `
    <div style="margin:1.25rem 0 0;">
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.75rem;">
        Realize o pagamento via <strong style="color:var(--green)">PIX</strong> e envie o comprovante pelo WhatsApp:
      </p>
      <div id="pix-qr-wrap" style="display:flex;justify-content:center;margin-bottom:0.75rem;">
        <div id="pix-qrcode" style="padding:10px;background:#fff;border-radius:10px;border:1px solid var(--border);display:inline-block;"></div>
      </div>
      <div class="pix-box">
        <div>
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.2rem;">
            Chave PIX (${escapeHtml(cfg.pixType)})
          </div>
          <code>${escapeHtml(cfg.pixKey)}</code>
          ${cfg.pixName ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem;">Favorecido: ${escapeHtml(cfg.pixName)}</div>` : ''}
        </div>
        <button class="copy-btn" id="pix-copy-btn">Copiar</button>
      </div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.5rem;">
        Valor a pagar: <strong style="color:var(--gold);font-size:1.1rem;">${formatBRL(total)}</strong>
      </p>
    </div>` : '';

  const waSection = cfg.whatsapp ? `
    <a href="https://wa.me/${escapeHtml(cfg.whatsapp)}?text=${encodeURIComponent(`Olá! Realizei uma inscrição no site DeMolay Piauí.\n\nPedido: ${order.orderNumber || '#' + order.id.slice(0,8).toUpperCase()}\nNome: ${customer.name}\nTotal: ${formatBRL(total)}\n\nSegue comprovante de pagamento.`)}"
      target="_blank" rel="noopener"
      class="btn btn-primary w-full mt-2" style="justify-content:center;background:var(--piaui-green);">
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      Enviar Comprovante via WhatsApp
    </a>` : '';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box text-center">
      <div class="modal-icon modal-icon-success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2 style="margin-bottom:0.5rem;">Pedido Confirmado!</h2>
      <p style="color:var(--text-muted);font-size:0.9rem;">
        Pedido <strong style="color:var(--gold)">${order.orderNumber || '#' + order.id.slice(0,8).toUpperCase()}</strong> registrado com sucesso.<br>
        Obrigado, <strong style="color:var(--text-heading)">${escapeHtml(customer.name)}</strong>!
      </p>
      ${pixSection}
      ${waSection}
      <a href="/loja.html" class="btn btn-outline w-full mt-2" style="justify-content:center;">
        Continuar na Loja
      </a>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => {
    if (e.target === modal) { modal.remove(); renderCart(); }
  });

  // Botão copiar PIX — usa addEventListener para evitar injeção via inline handler
  const copyBtn = document.getElementById('pix-copy-btn');
  if (copyBtn && cfg.pixKey) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(cfg.pixKey).then(() => {
        copyBtn.textContent = 'Copiado ✔';
        setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
      });
    });
  }

  if (pixPayload && window.QRCode) {
    new QRCode(document.getElementById('pix-qrcode'), {
      text: pixPayload,
      width: 200,
      height: 200,
      colorDark: '#1b7a3e',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }
}
