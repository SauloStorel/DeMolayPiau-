/* =============================================
   SHOP UTILITIES — compartilhado entre todas as páginas da loja
   ============================================= */

// ── Formatação ────────────────────────────────
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}

// ── Imagem do produto ─────────────────────────
function getProductImage(product) {
  if (!product) return null;
  if (product.imageType === 'upload' && product.image) return `/uploads/${product.image}`;
  if (product.imageType === 'url' && product.imageUrl) return product.imageUrl;
  return null;
}

// ── Lote ativo ────────────────────────────────
function getActiveLot(product) {
  const now = new Date();
  return (product.lots || []).find(lot => {
    const from = lot.availableFrom ? new Date(lot.availableFrom) : null;
    const until = lot.availableUntil ? new Date(lot.availableUntil) : null;
    if (from && now < from) return false;
    if (until && now > until) return false;
    return true;
  }) || null;
}

function getLotStatus(lot) {
  const now = new Date();
  const from = lot.availableFrom ? new Date(lot.availableFrom) : null;
  const until = lot.availableUntil ? new Date(lot.availableUntil) : null;
  if (until && now > until) return 'ended';
  if (from && now < from) return 'soon';
  return 'active';
}

function getLotPrice(lot, variantId) {
  if (!lot) return null;
  if (variantId && lot.variantPrices && lot.variantPrices[variantId] != null) {
    return lot.variantPrices[variantId];
  }
  return lot.price ?? null;
}

function isLotSoldOut(lot) {
  if (!lot) return false;
  if (lot.maxQuantity == null) return false;
  return (lot.soldQuantity || 0) >= lot.maxQuantity;
}

// ── Carrinho (localStorage) ───────────────────
const CART_KEY = 'demolay_cart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(item) {
  const cart = getCart();
  // Verifica se já existe item igual (mesmo produto + lote + variante)
  const idx = cart.findIndex(i =>
    i.productId === item.productId &&
    i.lotId === item.lotId &&
    i.variantId === item.variantId
  );
  if (idx >= 0) {
    cart[idx].quantity += item.quantity;
  } else {
    cart.push(item);
  }
  saveCart(cart);
}

function removeFromCart(productId, lotId, variantId) {
  const cart = getCart().filter(i =>
    !(i.productId === productId && i.lotId === lotId && i.variantId === variantId)
  );
  saveCart(cart);
}

const CART_MAX_QTY = 20;

function updateCartQty(productId, lotId, variantId, qty) {
  const cart = getCart();
  const idx = cart.findIndex(i =>
    i.productId === productId && i.lotId === lotId && i.variantId === variantId
  );
  if (idx >= 0) {
    if (qty <= 0) {
      cart.splice(idx, 1);
    } else {
      cart[idx].quantity = Math.min(qty, CART_MAX_QTY);
    }
    saveCart(cart);
  }
}

function getCartTotal() {
  return getCart().reduce((sum, i) => sum + i.price * i.quantity, 0);
}

function getCartCount() {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

// ── Badge do carrinho na nav ──────────────────
function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? '' : 'none';
  });
  document.querySelectorAll('.cart-total-nav').forEach(el => {
    el.textContent = count > 0 ? formatBRL(getCartTotal()) : '';
  });
}

// Atualiza badge sempre que o script carrega
document.addEventListener('DOMContentLoaded', () => {
  // Aguarda nav carregar
  setTimeout(updateCartBadge, 300);
});
