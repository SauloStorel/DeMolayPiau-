/* =============================================
   PÁGINA DE DETALHE DO PRODUTO
   ============================================= */

(async function () {
  const params = new URLSearchParams(location.search);
  const productId = params.get('id');
  const section = document.getElementById('produto-section');

  if (!productId) {
    location.href = '/loja.html';
    return;
  }

  let product;
  try {
    const res = await fetch(`/api/shop/products/${productId}`);
    if (!res.ok) throw new Error();
    product = await res.json();
  } catch {
    section.innerHTML = '<div class="container"><p class="text-muted text-center">Produto não encontrado.</p></div>';
    return;
  }

  // Atualiza title
  document.title = `${product.name} – DeMolay Piauí`;

  // Estado local
  let selectedVariantId = product.variants?.length ? product.variants[0].id : null;
  let quantity = 1;
  let selectedShirtSize = null;

  const SHIRT_SIZES = ['PP','P','M','G','GG','XG','2XG','3XG'];

  function variantNeedsSize(variantId) {
    if (product.productType !== 'event_with_shirt') return false;
    const v = product.variants?.find(x => x.id === variantId);
    return v?.name.toLowerCase().includes('com kit');
  }

  render();

  function render() {
    const activeLot = getActiveLot(product);
    const imgSrc = getProductImage(product);
    const now = new Date();

    const imgEl = imgSrc
      ? `<img src="${imgSrc}" alt="${escapeHtml(product.name)}">`
      : `<div class="produto-main-img-placeholder" style="height:100%;min-height:300px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="60" height="60" opacity="0.3">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
        </div>`;

    // Detecta se produto é de tamanhos (clothing ou variantes que são todas sizes)
    const _sizeSet = new Set(['pp','p','m','g','gg','xg','2xg','3xg','xs','s','l','xl','xxl','xxxl']);
    const isSizing = product.productType === 'clothing'
      || (product.productType !== 'event_with_shirt'
          && (product.variants||[]).length > 0
          && (product.variants||[]).every(v => _sizeSet.has(v.name.trim().toLowerCase())));

    const currentPrice = isSizing
      ? (activeLot?.price ?? null)
      : getLotPrice(activeLot, selectedVariantId);
    const soldOut = isLotSoldOut(activeLot);
    const canBuy = activeLot && !soldOut;

    // Status do lote
    let lotStatusHtml = '';
    if (activeLot) {
      const until = activeLot.availableUntil ? ` — termina em ${formatDate(activeLot.availableUntil)}` : '';
      const rem = activeLot.maxQuantity ? ` · ${Math.max(0, activeLot.maxQuantity - (activeLot.soldQuantity||0))} vagas restantes` : '';
      if (soldOut) {
        lotStatusHtml = `<div class="produto-lot-status"><span class="dot dot-ended"></span> Esgotado</div>`;
      } else {
        lotStatusHtml = `<div class="produto-lot-status"><span class="dot dot-active"></span> ${escapeHtml(activeLot.name)} ativo${until}${rem}</div>`;
      }
    } else {
      const hasFuture = (product.lots||[]).some(l => l.availableFrom && new Date(l.availableFrom) > now);
      if (hasFuture) {
        const next = product.lots.filter(l => l.availableFrom && new Date(l.availableFrom) > now)
          .sort((a,b) => new Date(a.availableFrom) - new Date(b.availableFrom))[0];
        lotStatusHtml = `<div class="produto-lot-status"><span class="dot dot-soon"></span> Inscrições abrem em ${formatDate(next.availableFrom)}</div>`;
      } else {
        lotStatusHtml = `<div class="produto-lot-status"><span class="dot dot-ended"></span> Inscrições encerradas</div>`;
      }
    }

    // Variantes / Tamanhos
    let variantsHtml = '';
    if (product.variants?.length > 0) {
      const variantLabel = isSizing ? 'Escolha o tamanho' : 'Categoria / Ingresso';

      // Para evento com camisa: filtra "Com Kit" após o prazo
      const kitExpired = product.productType === 'event_with_shirt'
        && product.kitDeadline
        && new Date() > new Date(product.kitDeadline);
      const visibleVariants = kitExpired
        ? product.variants.filter(v => !v.name.toLowerCase().includes('com kit'))
        : product.variants;

      // Garante que selectedVariantId aponte para uma variante visível
      if (kitExpired && selectedVariantId) {
        const still = visibleVariants.find(v => v.id === selectedVariantId);
        if (!still && visibleVariants.length) selectedVariantId = visibleVariants[0].id;
      }

      variantsHtml = `
        ${kitExpired ? `<div style="display:flex;align-items:center;gap:0.5rem;background:rgba(201,160,48,0.1);border:1px solid var(--gold-dim);border-radius:var(--radius);padding:0.6rem 0.9rem;margin-bottom:1rem;font-size:0.82rem;color:var(--gold-dim);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Prazo para inscrições com kit encerrado. Disponível apenas inscrição <strong style="margin-left:0.2rem;">Sem Kit</strong>.
        </div>` : ''}
        <div class="produto-variants">
          <label>${variantLabel}</label>
          <div class="variant-options${isSizing ? ' variant-sizes' : ''}">
            ${visibleVariants.map(v => {
              const price = (!isSizing && activeLot) ? getLotPrice(activeLot, v.id) : null;
              const priceStr = price != null ? ` – ${formatBRL(price)}` : '';
              return `<button class="variant-btn ${selectedVariantId === v.id ? 'selected' : ''}"
                data-variant="${v.id}">${escapeHtml(v.name)}${priceStr}</button>`;
            }).join('')}
          </div>
          ${isSizing && activeLot ? `<div class="variant-price-display">
            <span style="font-size:0.82rem;color:var(--text-muted);">Preço:</span>
            <span style="font-weight:700;color:var(--green);font-family:var(--font-price);">
              ${currentPrice != null ? formatBRL(currentPrice) : '—'}
            </span>
          </div>` : ''}
        </div>`;

      // Seletor de tamanho de camisa (evento com camisa + "Com Kit" selecionado)
      if (variantNeedsSize(selectedVariantId)) {
        const sizes = product.availableSizes?.length ? product.availableSizes : SHIRT_SIZES;
        variantsHtml += `
          <div class="produto-variants" style="margin-top:1rem;">
            <label>Tamanho da Camisa <span style="color:var(--danger);font-size:0.8rem;">*</span></label>
            <div class="variant-options variant-sizes">
              ${sizes.map(s => `<button class="variant-btn${selectedShirtSize === s ? ' selected' : ''}"
                data-shirt-size="${s}">${s}</button>`).join('')}
            </div>
            ${!selectedShirtSize ? `<p style="font-size:0.78rem;color:var(--gold);margin-top:0.4rem;">Selecione o tamanho da camisa para continuar.</p>` : ''}
          </div>`;
      }
    }

    // Preço
    const priceHtml = activeLot
      ? `<div class="produto-price-box">
          <div class="produto-price-label">${escapeHtml(activeLot.name)}</div>
          <div class="produto-price-current" id="price-display">${currentPrice != null ? formatBRL(currentPrice) : '—'}</div>
          ${lotStatusHtml}
        </div>`
      : `<div class="produto-price-box">${lotStatusHtml}</div>`;

    // Botão de compra
    let buyHtml = '';
    if (canBuy) {
      buyHtml = `
        <div class="qty-control mb-2">
          <button class="qty-btn" id="qtyMinus">−</button>
          <input type="number" class="qty-input" id="qtyInput" value="${quantity}" min="1" max="20">
          <button class="qty-btn" id="qtyPlus">+</button>
        </div>
        <div id="buy-error" style="display:none;font-size:0.82rem;color:var(--danger);margin-bottom:0.4rem;"></div>
        <div class="buy-actions">
          <button class="btn btn-primary" id="addToCartBtn" style="justify-content:center;font-size:1rem;padding:0.85rem;flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            Adicionar
          </button>
          <button class="btn btn-buy-now" id="buyNowBtn" style="flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Comprar Agora
          </button>
        </div>`;
    }

    // Timeline dos lotes
    const lotsHtml = (product.lots||[]).length > 0 ? `
      <div class="lots-timeline">
        <h3>Tabela de Lotes</h3>
        ${product.lots.map(lot => {
          const status = getLotStatus(lot);
          const dotClass = status === 'active' ? 'dot-active' : status === 'soon' ? 'dot-soon' : 'dot-ended';
          const from = lot.availableFrom ? formatDate(lot.availableFrom) : '—';
          const until = lot.availableUntil ? formatDate(lot.availableUntil) : '—';
          const sold = lot.maxQuantity ? `${lot.soldQuantity||0}/${lot.maxQuantity} inscritos` : '';
          const soldOutBadge = isLotSoldOut(lot) ? ' <span style="color:var(--danger);font-size:0.75rem;">(Esgotado)</span>' : '';

          // Preços por variante (ou único para camisa)
          let priceCells = '';
          if (isSizing || !product.variants?.length) {
            priceCells = `<div style="font-size:0.95rem;font-weight:700;color:var(--gold)">${lot.price != null ? formatBRL(lot.price) : '—'}</div>`;
          } else if (product.variants?.length > 0 && lot.variantPrices) {
            priceCells = product.variants.map(v => {
              const p = lot.variantPrices[v.id];
              return `<div style="font-size:0.75rem;color:var(--text-muted)">${escapeHtml(v.name)}: <strong style="color:var(--gold)">${p != null ? formatBRL(p) : '—'}</strong></div>`;
            }).join('');
          } else {
            priceCells = `<div style="font-size:0.95rem;font-weight:700;color:var(--gold)">${lot.price != null ? formatBRL(lot.price) : '—'}</div>`;
          }

          return `
            <div class="lot-row ${status === 'active' ? 'lot-active' : ''} ${status === 'ended' ? 'lot-ended' : ''}">
              <span class="lot-row-indicator dot ${dotClass}"></span>
              <div class="lot-row-info">
                <div class="lot-row-name">${escapeHtml(lot.name)}${soldOutBadge}</div>
                <div class="lot-row-dates">${from} – ${until}${sold ? ' · ' + sold : ''}</div>
              </div>
              <div class="lot-row-price">${priceCells}</div>
            </div>`;
        }).join('')}
      </div>` : '';

    section.innerHTML = `
      <div class="container">
        <p class="breadcrumb mb-3" style="font-size:0.82rem;color:var(--text-muted);">
          <a href="/">Início</a> / <a href="/loja.html">Loja</a> / ${escapeHtml(product.name)}
        </p>
        <div class="produto-layout">
          <div class="produto-gallery">
            <div class="produto-main-img">${imgEl}</div>
          </div>
          <div class="produto-info">
            <h1>${escapeHtml(product.name)}</h1>
            ${product.description ? `<p style="color:var(--text-muted);margin-bottom:0">${escapeHtml(product.description)}</p>` : ''}
            ${priceHtml}
            ${variantsHtml}
            ${buyHtml}
            ${lotsHtml}
          </div>
        </div>
      </div>`;

    // Eventos
    attachEvents(activeLot, canBuy, isSizing);
  }

  function attachEvents(activeLot, canBuy, isSizing) {
    // Variantes de categoria
    section.querySelectorAll('.variant-btn[data-variant]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedVariantId = btn.dataset.variant;
        selectedShirtSize = null; // reset tamanho ao trocar categoria
        render();
      });
    });

    // Tamanho de camisa
    section.querySelectorAll('[data-shirt-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedShirtSize = btn.dataset.shirtSize;
        render();
      });
    });

    if (!canBuy) return;

    // Quantidade
    const qtyInput = document.getElementById('qtyInput');
    document.getElementById('qtyMinus')?.addEventListener('click', () => {
      quantity = Math.max(1, quantity - 1);
      qtyInput.value = quantity;
    });
    document.getElementById('qtyPlus')?.addEventListener('click', () => {
      quantity = Math.min(20, quantity + 1);
      qtyInput.value = quantity;
    });
    qtyInput?.addEventListener('change', () => {
      quantity = Math.max(1, Math.min(20, parseInt(qtyInput.value) || 1));
      qtyInput.value = quantity;
    });

    function buildCartItem() {
      const price = isSizing
        ? activeLot.price
        : getLotPrice(activeLot, selectedVariantId);
      if (price == null) return null;

      // Valida tamanho quando "Com Kit"
      if (variantNeedsSize(selectedVariantId) && !selectedShirtSize) {
        showBuyError('Selecione o tamanho da camisa para continuar.');
        return null;
      }

      return {
        productId: product.id,
        productName: product.name,
        productImage: getProductImage(product),
        lotId: activeLot.id,
        lotName: activeLot.name,
        variantId: selectedVariantId,
        variantName: product.variants?.find(v => v.id === selectedVariantId)?.name || null,
        shirtSize: variantNeedsSize(selectedVariantId) ? selectedShirtSize : null,
        price,
        quantity
      };
    }

    // Adicionar ao carrinho
    document.getElementById('addToCartBtn')?.addEventListener('click', () => {
      const item = buildCartItem();
      if (!item) return;
      addToCart(item);

      const btn = document.getElementById('addToCartBtn');
      const original = btn.innerHTML;
      btn.innerHTML = '✔ Adicionado!';
      btn.style.background = 'var(--piaui-green)';
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = original;
        btn.style.background = '';
        btn.disabled = false;
      }, 1800);

      updateCartBadge();
    });

    // Comprar Agora — adiciona e vai direto ao checkout
    document.getElementById('buyNowBtn')?.addEventListener('click', () => {
      const item = buildCartItem();
      if (!item) return;
      addToCart(item);
      location.href = '/carrinho.html';
    });
  }

  function showBuyError(msg) {
    const el = document.getElementById('buy-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3500);
  }
})();
