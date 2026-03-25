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

    // Preço do lote atual para a variante selecionada
    const currentPrice = getLotPrice(activeLot, selectedVariantId);
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

    // Variantes
    let variantsHtml = '';
    if (product.variants?.length > 0) {
      variantsHtml = `
        <div class="produto-variants">
          <label>Tipo de ingresso / Categoria</label>
          <div class="variant-options">
            ${product.variants.map(v => {
              const price = activeLot ? getLotPrice(activeLot, v.id) : null;
              const priceStr = price != null ? ` – ${formatBRL(price)}` : '';
              return `<button class="variant-btn ${selectedVariantId === v.id ? 'selected' : ''}"
                data-variant="${v.id}">${escapeHtml(v.name)}${priceStr}</button>`;
            }).join('')}
          </div>
        </div>`;
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
        <button class="btn btn-primary w-full" id="addToCartBtn" style="justify-content:center;font-size:1rem;padding:0.85rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          Adicionar ao Carrinho
        </button>
        <a href="/carrinho.html" class="btn btn-outline w-full mt-2" style="justify-content:center;">
          Ver Carrinho
        </a>`;
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

          // Preços por variante
          let priceCells = '';
          if (product.variants?.length > 0 && lot.variantPrices) {
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
    attachEvents(activeLot, canBuy);
  }

  function attachEvents(activeLot, canBuy) {
    // Variantes
    section.querySelectorAll('.variant-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedVariantId = btn.dataset.variant;
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

    // Adicionar ao carrinho
    document.getElementById('addToCartBtn')?.addEventListener('click', () => {
      const price = getLotPrice(activeLot, selectedVariantId);
      if (price == null) return alert('Selecione uma categoria.');

      const variantName = product.variants?.find(v => v.id === selectedVariantId)?.name || null;
      const imgSrc = getProductImage(product);

      addToCart({
        productId: product.id,
        productName: product.name,
        productImage: imgSrc,
        lotId: activeLot.id,
        lotName: activeLot.name,
        variantId: selectedVariantId,
        variantName,
        price,
        quantity
      });

      // Feedback visual
      const btn = document.getElementById('addToCartBtn');
      const original = btn.innerHTML;
      btn.innerHTML = '✔ Adicionado ao Carrinho!';
      btn.style.background = 'var(--piaui-green)';
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = original;
        btn.style.background = '';
        btn.disabled = false;
      }, 2000);

      updateCartBadge();
    });
  }
})();
