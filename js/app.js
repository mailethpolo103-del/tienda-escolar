/* ===== TIENDA ESCOLAR INTELIGENTE - APP PRINCIPAL ===== */

// ─────────────── ESTADO GLOBAL ───────────────
const STATE = {
  products: [],
  cart: [],
  favorites: [],
  orders: [],
  user: null,
  currentCategory: 'all',
  currentSection: 'home',
  selectedPayment: 'qr-nequi',
  currentProduct: null,
  modalQty: 1,
  couponApplied: null,
  theme: localStorage.getItem('theme') || 'light',
  notifications: [],
  isPolling: false,
  currentOrderNum: null,       // número de pedido en curso
  generatedVoucherB64: null,   // comprobante generado en base64
  uploadedProofB64: null       // comprobante subido por el usuario
};

const CATEGORIES = [
  { name: 'Todos',            icon: '🛍️', key: 'all' },
  { name: 'Bebidas',          icon: '🥤', key: 'Bebidas' },
  { name: 'Helados',          icon: '🍦', key: 'Helados' },
  { name: 'Snacks',           icon: '🍟', key: 'Snacks' },
  { name: 'Panadería',        icon: '🥐', key: 'Panadería' },
  { name: 'Comidas rápidas',  icon: '🍔', key: 'Comidas rápidas' },
  { name: 'Útiles escolares', icon: '📚', key: 'Útiles escolares' }
];

const PAYMENT_LABELS = {
  'qr-nequi':       { name: 'Nequi',       icon: '📱', color: '#8b008b' },
  'qr-daviplata':   { name: 'Daviplata',    icon: '💜', color: '#6a0dad' },
  'qr-bancolombia': { name: 'Bancolombia',  icon: '🟡', color: '#f0a500' },
  'efectivo':       { name: 'Efectivo',     icon: '💵', color: '#2e7d32' }
};

const SAMPLE_REVIEWS = {
  positive: ['¡Excelente producto! Lo recomiendo 😍','Muy rico y fresco 👌','Siempre lo pido 🔥','El mejor de la tienda ⭐','Rápido y delicioso 😋'],
  neutral:  ['Bueno, pero podría mejorar','Está bien por el precio','Normal, nada especial']
};

function formatCurrency(n) { return '$' + Number(n).toLocaleString('es-CO'); }

function generateOrderNumber() {
  // Turno secuencial basado en hora + random para evitar colisiones
  const base = Math.floor(Date.now() / 1000) % 9000 + 1000;
  return '#' + base;
}

function generateStars(rating) {
  const full = Math.floor(rating), half = rating - full >= 0.5;
  let s = '';
  for (let i = 0; i < full; i++) s += '★';
  if (half) s += '½';
  for (let i = full + (half ? 1 : 0); i < 5; i++) s += '☆';
  return s;
}

function nowDateStr() {
  return new Date().toLocaleString('es-CO', {
    weekday:'long', year:'numeric', month:'long',
    day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit'
  });
}

// ─────────────── TEMA ───────────────
function initTheme() {
  document.documentElement.setAttribute('data-theme', STATE.theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.querySelector('.theme-icon').textContent = STATE.theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', STATE.theme);
  initTheme();
  showToast('Tema cambiado', STATE.theme === 'dark' ? '🌙 Modo oscuro' : '☀️ Modo claro', 'info', 2000);
}

// ─────────────── PRODUCTOS ───────────────
async function loadProducts() {
  try {
    const res = await fetch('tables/products?limit=100');
    const data = await res.json();
    STATE.products = data.data || [];
    renderHome();
    renderCatalog();
  } catch (err) {
    console.error('Error cargando productos', err);
    showToast('Error', 'No se pudieron cargar los productos', 'error');
  }
}

// ─────────────── HOME ───────────────
function renderHome() {
  renderCategoryChips('homeCategories', true);
  const featured = STATE.products.filter(p => p.featured && p.available);
  const topSales = [...STATE.products].filter(p => p.available).sort((a,b) => b.sales_count - a.sales_count).slice(0,6);
  document.getElementById('featuredGrid').innerHTML = featured.slice(0,6).map(renderProductCard).join('');
  document.getElementById('topSalesGrid').innerHTML = topSales.map(renderProductCard).join('');
}

function renderCategoryChips(containerId, includeAll = true) {
  const cats = includeAll ? CATEGORIES : CATEGORIES.slice(1);
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = cats.map(cat => `
    <div class="cat-chip ${STATE.currentCategory === cat.key ? 'active' : ''}"
         onclick="filterCategory('${cat.key}', '${containerId}')">
      <span class="cat-icon">${cat.icon}</span>${cat.name}
    </div>
  `).join('');
}

function filterCategory(key, sourceId) {
  STATE.currentCategory = key;
  ['homeCategories','catalogCategories'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll('.cat-chip').forEach(c => {
      const catObj = CATEGORIES.find(x => x.key === key);
      c.classList.toggle('active', catObj && c.textContent.trim().includes(catObj.name));
    });
  });
  renderCatalog();
  if (sourceId === 'homeCategories' && key !== 'all') showSection('catalog');
}

// ─────────────── CATÁLOGO ───────────────
function renderCatalog(products) {
  renderCategoryChips('catalogCategories', true);
  let list = products || STATE.products;
  const q = document.getElementById('searchInput')?.value.toLowerCase().trim();
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
  if (STATE.currentCategory !== 'all') list = list.filter(p => p.category === STATE.currentCategory);
  const sort = document.getElementById('sortSelect')?.value;
  if (sort === 'price-asc')  list = [...list].sort((a,b) => a.price - b.price);
  if (sort === 'price-desc') list = [...list].sort((a,b) => b.price - a.price);
  if (sort === 'rating')     list = [...list].sort((a,b) => b.rating - a.rating);
  if (sort === 'sales')      list = [...list].sort((a,b) => b.sales_count - a.sales_count);
  const grid = document.getElementById('catalogGrid');
  const empty = document.getElementById('catalogEmpty');
  if (list.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; }
  else { grid.innerHTML = list.map(renderProductCard).join(''); empty.style.display = 'none'; }
}

function renderProductCard(p) {
  const isFav = STATE.favorites.includes(p.id);
  const soldOut = !p.available || p.stock === 0;
  const bgColor = p.image_color || '#e0e0e0';
  return `
    <div class="product-card" onclick="openProductModal('${p.id}')">
      <div class="product-img" style="background:${bgColor}22">
        <span>${p.image_emoji || '🛍️'}</span>
        ${p.featured ? '<span class="product-badge badge-featured">⭐ Destacado</span>' : ''}
        ${soldOut ? '<span class="product-badge badge-sold-out">Agotado</span>' : ''}
        <button class="product-fav-btn ${isFav ? 'active' : ''}"
                onclick="event.stopPropagation(); toggleFavorite('${p.id}')"
                title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
          ${isFav ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="product-body">
        <div class="product-subcategory">${p.subcategory || p.category}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.description || ''}</div>
        <div class="product-rating">
          <span class="stars">${generateStars(p.rating || 4.5)}</span>
          <span class="rating-num">${(p.rating||4.5).toFixed(1)}</span>
        </div>
        <div class="product-footer">
          <div class="product-price"><span class="currency">$</span>${Number(p.price).toLocaleString('es-CO')}</div>
          <button class="btn-add-cart" ${soldOut ? 'disabled' : ''}
                  onclick="event.stopPropagation(); quickAddToCart('${p.id}')"
                  title="Agregar al carrito">+</button>
        </div>
      </div>
    </div>
  `;
}

// ─────────────── MODAL PRODUCTO ───────────────
function openProductModal(id) {
  const p = STATE.products.find(x => x.id === id);
  if (!p) return;
  STATE.currentProduct = p;
  STATE.modalQty = 1;
  const bgColor = p.image_color || '#e0e0e0';
  document.getElementById('modalProductImg').style.background = bgColor + '22';
  document.getElementById('modalProductImg').textContent = p.image_emoji || '🛍️';
  document.getElementById('modalSubcat').textContent = p.subcategory || p.category;
  document.getElementById('modalProductName').textContent = p.name;
  document.getElementById('modalProductDesc').textContent = p.description || '';
  document.getElementById('modalProductPrice').textContent = formatCurrency(p.price);
  document.getElementById('modalStars').textContent = generateStars(p.rating || 4.5);
  document.getElementById('modalRatingNum').textContent = `${(p.rating||4.5).toFixed(1)} (${p.sales_count||0} ventas)`;
  document.getElementById('modalQty').textContent = 1;
  const soldOut = !p.available || p.stock === 0;
  document.getElementById('modalStockInfo').textContent = soldOut ? '❌ Agotado' : `✅ Disponible (${p.stock||'En stock'})`;
  document.getElementById('modalAddBtn').disabled = soldOut;
  document.getElementById('modalAddBtn').textContent = soldOut ? '❌ Agotado' : '🛒 Agregar al carrito';
  const isFav = STATE.favorites.includes(p.id);
  document.getElementById('modalFavBtn').textContent = isFav ? '❤️ En favoritos' : '🤍 Favorito';
  const reviews = [
    { user: 'Carlos M.', text: SAMPLE_REVIEWS.positive[Math.floor(Math.random()*SAMPLE_REVIEWS.positive.length)], rating: 5 },
    { user: 'Ana P.',    text: SAMPLE_REVIEWS.positive[Math.floor(Math.random()*SAMPLE_REVIEWS.positive.length)], rating: 4 },
    { user: 'Luis R.',   text: SAMPLE_REVIEWS.neutral[Math.floor(Math.random()*SAMPLE_REVIEWS.neutral.length)],  rating: 4 },
  ];
  document.getElementById('modalReviews').innerHTML = reviews.map(r =>
    `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">
      <strong>${r.user}</strong> <span style="color:var(--accent)">★${r.rating}</span>
      <br><span>${r.text}</span>
    </div>`).join('');
  openModal('productModal');
}
function closeProductModal() { closeModal('productModal'); STATE.currentProduct = null; }
function changeModalQty(delta) {
  STATE.modalQty = Math.max(1, Math.min(STATE.modalQty + delta, STATE.currentProduct?.stock || 10));
  document.getElementById('modalQty').textContent = STATE.modalQty;
}
function addToCartFromModal() {
  if (!STATE.currentProduct) return;
  addToCart(STATE.currentProduct, STATE.modalQty);
  closeProductModal();
}
function toggleFavModal() {
  if (!STATE.currentProduct) return;
  toggleFavorite(STATE.currentProduct.id);
  const isFav = STATE.favorites.includes(STATE.currentProduct.id);
  document.getElementById('modalFavBtn').textContent = isFav ? '❤️ En favoritos' : '🤍 Favorito';
}

// ─────────────── CARRITO ───────────────
function quickAddToCart(id) { const p = STATE.products.find(x => x.id === id); if (p) addToCart(p, 1); }

function addToCart(product, qty = 1) {
  const existing = STATE.cart.find(i => i.id === product.id);
  if (existing) existing.qty = Math.min(existing.qty + qty, product.stock || 20);
  else STATE.cart.push({ ...product, qty });
  saveCart(); renderCart();
  showToast('Agregado al carrito', `${product.image_emoji} ${product.name}`, 'success', 2500);
  animateCartIcon();
}
function removeFromCart(id) { STATE.cart = STATE.cart.filter(i => i.id !== id); saveCart(); renderCart(); }
function changeCartQty(id, delta) {
  const item = STATE.cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  if (item.qty === 0) { removeFromCart(id); return; }
  saveCart(); renderCart();
}
function clearCart() {
  if (!STATE.cart.length) return;
  STATE.cart = []; STATE.couponApplied = null;
  saveCart(); renderCart();
}
function saveCart() { localStorage.setItem('cart', JSON.stringify(STATE.cart)); }
function loadCart() { try { STATE.cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch { STATE.cart = []; } }

function getCartTotals() {
  const subtotal = STATE.cart.reduce((s,i) => s + i.price * i.qty, 0);
  let discount = 0;
  if (STATE.couponApplied) {
    const c = STATE.couponApplied;
    if (subtotal >= c.min_purchase)
      discount = c.discount_type === 'percentage' ? subtotal * c.discount_value / 100 : c.discount_value;
  }
  return { subtotal, discount, total: subtotal - discount };
}

function renderCart() {
  const list = document.getElementById('cartItemsList');
  const badge = document.getElementById('cartBadge');
  const bottomBadge = document.getElementById('bottomCartBadge');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const totalItems = STATE.cart.reduce((s,i) => s + i.qty, 0);
  if (totalItems > 0) {
    badge.textContent = totalItems; badge.style.display = 'flex';
    bottomBadge.textContent = totalItems; bottomBadge.style.display = 'flex';
  } else { badge.style.display = 'none'; bottomBadge.style.display = 'none'; }
  if (!STATE.cart.length) {
    list.innerHTML = `<div class="empty-state" style="padding:40px 20px"><div class="empty-state-icon">🛒</div><h3>Tu carrito está vacío</h3><p>Agrega productos para comenzar</p></div>`;
    checkoutBtn.disabled = true;
    document.getElementById('cartSubtotal').textContent = '$0';
    document.getElementById('cartTotal').textContent = '$0';
    document.getElementById('discountRow').style.display = 'none';
    return;
  }
  list.innerHTML = STATE.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img" style="background:${item.image_color||'#e0e0e0'}22">${item.image_emoji||'🛍️'}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatCurrency(item.price * item.qty)}</div>
      </div>
      <div class="cart-qty-ctrl">
        <button class="qty-btn" onclick="changeCartQty('${item.id}',-1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeCartQty('${item.id}',1)">+</button>
        <button class="qty-btn" onclick="removeFromCart('${item.id}')" style="color:var(--danger)">🗑</button>
      </div>
    </div>
  `).join('');
  const { subtotal, discount, total } = getCartTotals();
  document.getElementById('cartSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('cartTotal').textContent = formatCurrency(total);
  if (discount > 0) {
    document.getElementById('cartDiscount').textContent = `-${formatCurrency(discount)}`;
    document.getElementById('discountRow').style.display = 'flex';
  } else document.getElementById('discountRow').style.display = 'none';
  checkoutBtn.disabled = false;
}

function toggleCart(open) {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  const state = open !== undefined ? open : !drawer.classList.contains('open');
  drawer.classList.toggle('open', state);
  overlay.classList.toggle('open', state);
  document.body.style.overflow = state ? 'hidden' : '';
}
function animateCartIcon() {
  const btn = document.getElementById('cartBtn');
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => btn.style.transform = '', 300);
}

// ─────────────── CUPONES ───────────────
async function applyCoupon() {
  const code = document.getElementById('couponInput').value.trim().toUpperCase();
  if (!code) return;
  try {
    const res = await fetch(`tables/coupons?search=${code}&limit=10`);
    const data = await res.json();
    const coupon = (data.data||[]).find(c => c.code.toUpperCase() === code && c.active && c.uses_left > 0);
    if (coupon) {
      const { subtotal } = getCartTotals();
      if (subtotal < coupon.min_purchase) { showToast('Cupón no válido', `Compra mínima de ${formatCurrency(coupon.min_purchase)} requerida`, 'warning'); return; }
      STATE.couponApplied = coupon; renderCart();
      const savings = coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : formatCurrency(coupon.discount_value);
      showToast('¡Cupón aplicado!', `Descuento de ${savings} activado 🎉`, 'success');
    } else showToast('Cupón inválido', 'El código no es válido o ya fue usado', 'error');
  } catch { showToast('Error', 'No se pudo verificar el cupón', 'error'); }
}

// ─────────────── CHECKOUT ───────────────
function openCheckout() {
  if (!STATE.cart.length) return;
  const { total } = getCartTotals();
  document.getElementById('checkoutItemsPreview').innerHTML =
    STATE.cart.map(i => `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span>${i.image_emoji} ${i.name} x${i.qty}</span>
        <span style="font-weight:700">${formatCurrency(i.price * i.qty)}</span>
      </div>`).join('') +
    `<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800">
       <span>Total</span><span style="color:var(--primary)">${formatCurrency(total)}</span>
     </div>`;
  document.getElementById('checkoutTotal').textContent = formatCurrency(total);
  document.getElementById('checkoutStep1').style.display = 'block';
  document.getElementById('checkoutStep2').style.display = 'none';
  // Limpiar estado del comprobante anterior
  STATE.generatedVoucherB64 = null;
  STATE.uploadedProofB64 = null;
  const va = document.getElementById('voucherArea');
  if (va) va.style.display = 'none';
  const gvb = document.getElementById('generateVoucherBtn');
  if (gvb) { gvb.style.display = ''; gvb.disabled = false; gvb.textContent = '🧾 Generar comprobante de pago'; }
  toggleCart(false);
  openModal('checkoutModal');
}

function selectPayment(btn) {
  document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  STATE.selectedPayment = btn.dataset.method;
}

function goToPayment() {
  const { total } = getCartTotals();
  STATE.currentOrderNum = generateOrderNumber();
  document.getElementById('checkoutStep1').style.display = 'none';
  document.getElementById('checkoutStep2').style.display = 'block';
  const pm = PAYMENT_LABELS[STATE.selectedPayment] || { name: STATE.selectedPayment, icon: '💳', color: '#6c3fc5' };
  document.getElementById('qrPaymentName').textContent = `${pm.icon} ${pm.name}`;

  if (STATE.selectedPayment === 'efectivo') {
    document.getElementById('qrCodeDisplay').innerHTML =
      `<div style="font-size:56px;text-align:center;padding:20px">💵<br>
       <small style="font-size:14px;color:#666;font-weight:600">Pago en efectivo</small></div>`;
  } else {
    const qrData = encodeURIComponent(
      `Tienda Escolar Inteligente\nPago: ${formatCurrency(total)}\nMétodo: ${pm.name}\nPedido: ${STATE.currentOrderNum}`
    );
    document.getElementById('qrCodeDisplay').innerHTML =
      `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrData}&bgcolor=ffffff&color=3d1a8e&margin=8"
            style="border-radius:10px;width:100%;height:100%;object-fit:contain" alt="QR de pago">`;
  }
  document.getElementById('qrTotalDisplay').textContent = formatCurrency(total);
}

function backToStep1() {
  document.getElementById('checkoutStep1').style.display = 'block';
  document.getElementById('checkoutStep2').style.display = 'none';
}

// ─────────────── GENERAR COMPROBANTE CON CANVAS ───────────────
async function generateVoucher() {
  const btn = document.getElementById('generateVoucherBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Generando...';

  const { subtotal, discount, total } = getCartTotals();
  const user    = STATE.user;
  const pm      = PAYMENT_LABELS[STATE.selectedPayment] || { name: STATE.selectedPayment, icon: '💳', color: '#6c3fc5' };
  const orderNum = STATE.currentOrderNum;
  const dateStr  = nowDateStr();
  const items    = STATE.cart;

  // Dimensiones del canvas
  const W = 480, PADDING = 28;
  const rowH = 28, headerH = 160, footerH = 120;
  const itemsH = items.length * rowH + 20;
  const H = headerH + itemsH + footerH + 40;

  const canvas = document.getElementById('hiddenVoucherCanvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ─ Fondo
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // ─ Barra superior degradada
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#6c3fc5');
  grad.addColorStop(1, '#ff6b35');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 10);

  // ─ Logo / título
  ctx.fillStyle = '#6c3fc5';
  ctx.font = 'bold 20px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎒 Tienda Escolar Inteligente', W / 2, 44);

  ctx.fillStyle = '#888';
  ctx.font = '12px Inter, Arial, sans-serif';
  ctx.fillText('Comprobante de Pago', W / 2, 62);

  // ─ Línea divisoria
  ctx.strokeStyle = '#e8e0f5';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PADDING, 74); ctx.lineTo(W - PADDING, 74); ctx.stroke();

  // ─ Número de pedido (caja destacada)
  ctx.fillStyle = '#f3f0ff';
  roundRect(ctx, PADDING, 82, W - PADDING * 2, 54, 10);
  ctx.fill();
  ctx.fillStyle = '#6c3fc5';
  ctx.font = 'bold 13px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Número de pedido', PADDING + 14, 102);
  ctx.font = 'bold 22px Inter, Arial, sans-serif';
  ctx.fillStyle = '#3d1a8e';
  ctx.fillText(orderNum, PADDING + 14, 124);

  // Fecha a la derecha
  ctx.fillStyle = '#888';
  ctx.font = '11px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, W - PADDING - 14, 108);

  // ─ Info del cliente y método de pago
  let y = 154;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#444';
  ctx.font = '12px Inter, Arial, sans-serif';
  ctx.fillText(`👤 Cliente: ${user?.name || 'Invitado'}`, PADDING, y); y += 18;
  ctx.fillText(`📧 ${user?.email || 'invitado@tienda.edu'}`, PADDING, y); y += 18;
  ctx.fillText(`${pm.icon} Método de pago: ${pm.name}`, PADDING, y); y += 18;
  ctx.fillText(`✅ Estado: Pago registrado`, PADDING, y); y += 22;

  // ─ Línea
  ctx.strokeStyle = '#e8e0f5'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PADDING, y); ctx.lineTo(W - PADDING, y); ctx.stroke(); y += 14;

  // ─ Cabecera de tabla
  ctx.fillStyle = '#6c3fc5';
  ctx.font = 'bold 11px Inter, Arial, sans-serif';
  ctx.fillText('Producto', PADDING, y);
  ctx.textAlign = 'center';
  ctx.fillText('Cant.', W / 2, y);
  ctx.textAlign = 'right';
  ctx.fillText('Valor', W - PADDING, y);
  y += 6;
  ctx.strokeStyle = '#6c3fc5'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PADDING, y); ctx.lineTo(W - PADDING, y); ctx.stroke(); y += 14;

  // ─ Ítems del carrito
  items.forEach((item, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#faf8ff' : '#ffffff';
    ctx.fillRect(PADDING - 4, y - 14, W - PADDING * 2 + 8, rowH);
    ctx.fillStyle = '#333';
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    const name = item.name.length > 24 ? item.name.slice(0, 22) + '…' : item.name;
    ctx.fillText(`${item.image_emoji} ${name}`, PADDING, y);
    ctx.textAlign = 'center';
    ctx.fillText(`x${item.qty}`, W / 2, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6c3fc5';
    ctx.font = 'bold 12px Inter, Arial, sans-serif';
    ctx.fillText(formatCurrency(item.price * item.qty), W - PADDING, y);
    y += rowH;
  });

  // ─ Separador antes de totales
  y += 4;
  ctx.strokeStyle = '#e8e0f5'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PADDING, y); ctx.lineTo(W - PADDING, y); ctx.stroke(); y += 14;

  // ─ Subtotal
  ctx.fillStyle = '#888'; ctx.font = '12px Inter, Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Subtotal', PADDING, y);
  ctx.textAlign = 'right'; ctx.fillText(formatCurrency(subtotal), W - PADDING, y); y += 20;

  if (discount > 0) {
    ctx.fillStyle = '#22c55e';
    ctx.fillText('Descuento', PADDING, y); ctx.textAlign = 'right';
    ctx.fillText(`-${formatCurrency(discount)}`, W - PADDING, y); y += 20;
    ctx.textAlign = 'left';
  }

  // ─ Total (caja destacada)
  y += 2;
  const grad2 = ctx.createLinearGradient(PADDING, y, W - PADDING, y);
  grad2.addColorStop(0, '#6c3fc5'); grad2.addColorStop(1, '#ff6b35');
  ctx.fillStyle = grad2;
  roundRect(ctx, PADDING, y, W - PADDING * 2, 44, 10); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Inter, Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('TOTAL PAGADO', PADDING + 14, y + 27);
  ctx.font = 'bold 20px Inter, Arial, sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(formatCurrency(total), W - PADDING - 14, y + 27);
  y += 60;

  // ─ Pie del comprobante
  ctx.fillStyle = '#aaa'; ctx.font = '10px Inter, Arial, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Gracias por tu compra 💜 · Muéstrale este comprobante al vendedor', W / 2, y);
  y += 15;
  ctx.fillText('Tienda Escolar Inteligente · ' + new Date().getFullYear(), W / 2, y);

  // ─ Barra inferior degradada
  const grad3 = ctx.createLinearGradient(0, 0, W, 0);
  grad3.addColorStop(0, '#6c3fc5'); grad3.addColorStop(1, '#ff6b35');
  ctx.fillStyle = grad3;
  ctx.fillRect(0, H - 8, W, 8);

  // ─ Copiar al canvas visible
  const visCanvas = document.getElementById('voucherCanvas');
  visCanvas.width  = canvas.width;
  visCanvas.height = canvas.height;
  visCanvas.getContext('2d').drawImage(canvas, 0, 0);

  // ─ Guardar base64
  STATE.generatedVoucherB64 = canvas.toDataURL('image/png');

  // ─ Mostrar área
  document.getElementById('voucherArea').style.display = 'block';
  btn.style.display = 'none';

  showToast('Comprobante listo', '📄 El comprobante fue generado y se adjuntará al pedido', 'success', 4000);
}

// Función auxiliar: rectángulo redondeado
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function downloadVoucher() {
  if (!STATE.generatedVoucherB64) return;
  const a = document.createElement('a');
  a.href = STATE.generatedVoucherB64;
  a.download = `comprobante-${STATE.currentOrderNum || 'pago'}.png`;
  a.click();
}

async function shareVoucher() {
  if (!STATE.generatedVoucherB64) return;
  try {
    const blob = await (await fetch(STATE.generatedVoucherB64)).blob();
    const file = new File([blob], `comprobante-${STATE.currentOrderNum}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'Comprobante de pago - Tienda Escolar', files: [file] });
    } else {
      downloadVoucher();
      showToast('Descargado', 'El comprobante fue guardado en tu dispositivo', 'info');
    }
  } catch { downloadVoucher(); }
}

// Vista previa al subir imagen propia
function previewUploadedProof(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    STATE.uploadedProofB64 = e.target.result;
    const preview = document.getElementById('uploadedProofPreview');
    document.getElementById('uploadedProofImg').src = e.target.result;
    preview.style.display = 'block';
    showToast('Imagen cargada', '📸 Comprobante listo para enviar', 'success', 2500);
  };
  reader.readAsDataURL(file);
}

// ─────────────── COLOCAR PEDIDO ───────────────
async function placeOrder() {
  const { total } = getCartTotals();
  const orderNum = STATE.currentOrderNum || generateOrderNumber();
  const user = STATE.user;
  const items = JSON.stringify(STATE.cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, emoji: i.image_emoji })));
  const estimatedTime = Math.floor(Math.random() * 10) + 10;

  // Comprobante: preferir el generado, luego el subido
  const proofB64 = STATE.generatedVoucherB64 || STATE.uploadedProofB64 || '';

  const orderData = {
    order_number: orderNum,
    user_id:      user?.id || 'guest',
    user_name:    user?.name || 'Invitado',
    user_email:   user?.email || 'invitado@tienda.edu',
    items,
    total,
    status:             'received',
    payment_method:     STATE.selectedPayment,
    payment_proof:      proofB64,           // ← imagen base64 del comprobante
    payment_validated:  false,              // El admin debe validar
    estimated_time:     estimatedTime,
    notes:              document.getElementById('orderNotes')?.value || ''
  };

  // Deshabilitar botón para evitar doble envío
  const confirmBtn = document.getElementById('confirmOrderBtn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '⏳ Enviando...'; }

  try {
    const res = await fetch('tables/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    if (res.ok) {
      const newOrder = await res.json();
      STATE.orders.unshift(newOrder);
      clearCart();
      STATE.generatedVoucherB64 = null;
      STATE.uploadedProofB64 = null;
      closeModal('checkoutModal');

      document.getElementById('confirmedOrderNum').textContent = orderNum;
      document.getElementById('confirmedOrderTime').textContent = `⏱️ Tiempo estimado: ${estimatedTime} min`;
      openModal('orderConfirmedModal');

      updateOrdersCount();
      showToast('¡Pedido realizado!', `${orderNum} – Tiempo estimado: ${estimatedTime} min`, 'order');
      startOrderPolling(newOrder.id);
    } else throw new Error('Error al crear pedido');
  } catch {
    showToast('Error', 'No se pudo procesar el pedido. Intenta de nuevo', 'error');
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '✅ Confirmar pedido'; }
  }
}

// ─────────────── PEDIDOS USUARIO ───────────────
async function loadOrders() {
  const userId = STATE.user?.id || 'guest';
  try {
    const res = await fetch(`tables/orders?limit=100&sort=created_at`);
    const data = await res.json();
    STATE.orders = (data.data || []).filter(o => o.user_id === userId || o.user_id === 'guest').reverse();
    renderOrders(STATE.orders);
    updateOrdersCount();
  } catch {
    document.getElementById('ordersList').innerHTML =
      `<div class="empty-state"><div class="empty-state-icon">📦</div><h3>Sin pedidos aún</h3><p>Realiza tu primer pedido</p></div>`;
  }
}

function renderOrders(orders) {
  const list = document.getElementById('ordersList');
  if (!orders.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><h3>Sin pedidos aún</h3><p>¡Realiza tu primera compra!</p></div>`;
    return;
  }
  const statusInfo = {
    received:  { icon: '🟡', label: 'Pedido recibido',   cls: 'status-received' },
    preparing: { icon: '🟠', label: 'En preparación',     cls: 'status-preparing' },
    ready:     { icon: '🟢', label: 'Listo para recoger', cls: 'status-ready' },
    delivered: { icon: '✅', label: 'Entregado',          cls: 'status-delivered' }
  };
  list.innerHTML = orders.map(o => {
    let items = [];
    try { items = JSON.parse(o.items || '[]'); } catch {}
    const si = statusInfo[o.status] || statusInfo.received;
    const date = new Date(o.created_at);
    const dateStr = date.toLocaleDateString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    const payInfo = PAYMENT_LABELS[o.payment_method] || { name: o.payment_method, icon: '💳' };
    return `
      <div class="order-card" id="orderCard-${o.id}">
        <div class="order-header">
          <div>
            <div class="order-number">${o.order_number || '#' + o.id?.slice(0,6)}</div>
            <div class="order-date">${dateStr} · ${payInfo.icon} ${payInfo.name}</div>
          </div>
          <span class="order-status-badge ${si.cls}">${si.icon} ${si.label}</span>
        </div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">
          ${items.map(i => `${i.emoji||'•'} ${i.name} x${i.qty}`).join(' · ')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div style="font-size:16px;font-weight:800;color:var(--primary)">${formatCurrency(o.total)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${o.payment_validated
              ? `<span style="font-size:11px;font-weight:700;color:var(--success);background:#d4edda;padding:3px 10px;border-radius:999px">✅ Pago validado</span>`
              : `<span style="font-size:11px;font-weight:700;color:#856404;background:#fff3cd;padding:3px 10px;border-radius:999px">⏳ Validando pago</span>`}
            ${o.status === 'received' || o.status === 'preparing'
              ? `<span style="font-size:12px;color:var(--text-muted)">⏱️ ${o.estimated_time||15} min aprox.</span>` : ''}
            ${o.status === 'ready'
              ? `<span style="font-size:12px;font-weight:800;color:var(--success)">🟢 ¡Ve a recoger!</span>` : ''}
          </div>
        </div>
        ${o.payment_proof
          ? `<details style="margin-top:10px;font-size:12px">
               <summary style="cursor:pointer;font-weight:600;color:var(--primary)">📄 Ver comprobante enviado</summary>
               <img src="${o.payment_proof}" style="width:100%;border-radius:8px;margin-top:8px;border:1.5px solid var(--border)" alt="Comprobante">
             </details>` : ''}
      </div>
    `;
  }).join('');
}

function filterOrders(filter, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = filter === 'all' ? STATE.orders : STATE.orders.filter(o => o.status === filter);
  renderOrders(filtered);
}

function updateOrdersCount() {
  const active = STATE.orders.filter(o => o.status !== 'delivered').length;
  const el = document.getElementById('ordersCount');
  if (el) { el.textContent = active; el.style.display = active > 0 ? '' : 'none'; }
}

// ─────────────── POLLING DE ESTADO ───────────────
let pollIntervals = {};

function startOrderPolling(orderId) {
  if (pollIntervals[orderId]) return;
  let prevStatus = 'received';
  pollIntervals[orderId] = setInterval(async () => {
    try {
      const res = await fetch(`tables/orders/${orderId}`);
      const order = await res.json();
      if (order.status !== prevStatus) {
        prevStatus = order.status;
        const idx = STATE.orders.findIndex(o => o.id === orderId);
        if (idx !== -1) STATE.orders[idx] = order;
        renderOrders(STATE.orders);
        updateOrdersCount();
        if (order.status === 'ready') {
          notifyOrderReady(order.order_number || orderId);
          clearInterval(pollIntervals[orderId]); delete pollIntervals[orderId];
        } else if (order.status === 'delivered') {
          clearInterval(pollIntervals[orderId]); delete pollIntervals[orderId];
        }
      }
    } catch {}
  }, 10000);
}

function notifyOrderReady(orderNum) {
  const msg = `Hola. Tu pedido ${orderNum} ya está listo para recoger en la tienda escolar. ¡Gracias por tu compra!`;
  document.getElementById('orderReadyMessage').textContent = msg;
  openModal('orderReadyModal');
  showToast('🟢 ¡Pedido listo!', msg.slice(0, 80) + '...', 'order', 8000);
  playNotificationSound();
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Tienda Escolar – Pedido listo', { body: msg });
  }
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
  } catch {}
}

// ─────────────── FAVORITOS ───────────────
function loadFavorites() { try { STATE.favorites = JSON.parse(localStorage.getItem('favorites') || '[]'); } catch { STATE.favorites = []; } }
function saveFavorites() { localStorage.setItem('favorites', JSON.stringify(STATE.favorites)); }
function toggleFavorite(id) {
  if (STATE.favorites.includes(id)) { STATE.favorites = STATE.favorites.filter(f => f !== id); showToast('Eliminado', 'Quitado de favoritos', 'info', 2000); }
  else { STATE.favorites.push(id); showToast('Favorito', '❤️ Guardado en favoritos', 'success', 2000); }
  saveFavorites(); renderHome(); renderCatalog(); renderFavorites(); updateFavCount();
}
function renderFavorites() {
  const grid = document.getElementById('favoritesGrid');
  const empty = document.getElementById('favoritesEmpty');
  const favProducts = STATE.products.filter(p => STATE.favorites.includes(p.id));
  if (!favProducts.length) { grid.innerHTML = ''; empty.style.display = 'block'; }
  else { grid.innerHTML = favProducts.map(renderProductCard).join(''); empty.style.display = 'none'; }
}
function updateFavCount() { document.getElementById('profileFavCount').textContent = STATE.favorites.length; }

// ─────────────── PERFIL ───────────────
function loadProfile() {
  try { STATE.user = JSON.parse(localStorage.getItem('user') || 'null'); } catch { STATE.user = null; }
  if (STATE.user) {
    const initial = STATE.user.name?.charAt(0).toUpperCase() || '👤';
    document.getElementById('userAvatarText').textContent = initial;
    document.getElementById('profileName').textContent = STATE.user.name || 'Usuario';
    document.getElementById('profileEmail').textContent = STATE.user.email || '';
    document.getElementById('profileAvatarBig').textContent = initial;
    document.getElementById('editName').value = STATE.user.name || '';
    document.getElementById('editEmail').value = STATE.user.email || '';
    document.getElementById('editStudentId').value = STATE.user.student_id || '';
    document.getElementById('profileTotalOrders').textContent = STATE.orders.length;
  }
}
function saveProfile() {
  const name = document.getElementById('editName').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const studentId = document.getElementById('editStudentId').value.trim();
  if (!name) { showToast('Error', 'El nombre es requerido', 'error'); return; }
  STATE.user = { ...STATE.user, name, email, student_id: studentId, id: STATE.user?.id || 'user-' + Date.now() };
  localStorage.setItem('user', JSON.stringify(STATE.user));
  loadProfile();
  showToast('Perfil actualizado', '✅ Tus datos han sido guardados', 'success');
}

// ─────────────── LOGIN ───────────────
function openLogin() { openModal('loginModal'); }
function switchLoginTab(tab, btn) {
  document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
}
function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showToast('Error', 'Completa todos los campos', 'error'); return; }
  const name = email.split('@')[0].replace(/\./g,' ').replace(/\b\w/g, c => c.toUpperCase());
  STATE.user = { id: 'user-' + Date.now(), name, email, role: 'student', student_id: '' };
  localStorage.setItem('user', JSON.stringify(STATE.user));
  closeModal('loginModal'); loadProfile();
  showToast('¡Bienvenido!', `Hola ${name} 👋`, 'success');
}
function doRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const studentId = document.getElementById('regStudentId').value.trim();
  const role = document.getElementById('regRole').value;
  const password = document.getElementById('regPassword').value;
  if (!name || !email || !password) { showToast('Error', 'Completa todos los campos', 'error'); return; }
  if (password.length < 6) { showToast('Error', 'Contraseña mínimo 6 caracteres', 'error'); return; }
  STATE.user = { id: 'user-' + Date.now(), name, email, student_id: studentId, role };
  localStorage.setItem('user', JSON.stringify(STATE.user));
  closeModal('loginModal'); loadProfile();
  showToast('¡Cuenta creada!', `Bienvenido ${name} 🎉`, 'success');
}
function loginWithGoogle() {
  STATE.user = { id: 'google-' + Date.now(), name: 'Estudiante Google', email: 'estudiante@gmail.com', role: 'student' };
  localStorage.setItem('user', JSON.stringify(STATE.user));
  closeModal('loginModal'); loadProfile();
  showToast('¡Conectado con Google!', '✅ Sesión iniciada', 'success');
}
function showForgotPassword() { showToast('Recuperar contraseña', '📧 Se enviará un correo de recuperación', 'info', 4000); }

// ─────────────── NAVEGACIÓN ───────────────
function showSection(name) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${name}`)?.classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.sidebar-item[data-section="${name}"]`)?.classList.add('active');
  document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.bottom-nav-item[data-section="${name}"]`)?.classList.add('active');
  STATE.currentSection = name;
  window.scrollTo(0, 0);
  if (window.innerWidth <= 900) closeSidebar();
  if (name === 'orders')    loadOrders();
  if (name === 'favorites') renderFavorites();
  if (name === 'profile')   loadProfile();
}
function filterByCategory(cat) { STATE.currentCategory = cat; showSection('catalog'); renderCatalog(); }

// ─────────────── MODALES ───────────────
function openModal(id)  { const el = document.getElementById(id); if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; } }
function closeModal(id) { const el = document.getElementById(id); if (el) { el.classList.remove('open'); document.body.style.overflow = ''; } }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
});

// ─────────────── TOASTS ───────────────
function showToast(title, msg, type = 'info', duration = 4000) {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️', order:'🎉' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type]||'📢'}</div>
    <div class="toast-text"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, duration);
}

// ─────────────── SIDEBAR MÓVIL ───────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  if (!document.getElementById('sidebarOverlay')) {
    const ov = document.createElement('div');
    ov.className = 'cart-overlay open'; ov.id = 'sidebarOverlay'; ov.onclick = closeSidebar;
    document.body.appendChild(ov);
  }
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay')?.remove();
}

// ─────────────── BUSCADOR ───────────────
let searchTimeout;
document.getElementById('searchInput')?.addEventListener('input', e => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = e.target.value.trim();
    if (q && STATE.currentSection !== 'catalog') showSection('catalog');
    renderCatalog();
  }, 300);
});
document.getElementById('sortSelect')?.addEventListener('change', () => renderCatalog());

// ─────────────── RELOJ ───────────────
function updateClock() {
  const now = new Date();
  const h = now.getHours(), m = String(now.getMinutes()).padStart(2,'0');
  const el = document.getElementById('timeDisplay');
  if (el) el.textContent = `${h}:${m}`;
  const storeBar = document.getElementById('storeHoursBar');
  const isOpen = h >= 6 && h < 16 && now.getDay() >= 1 && now.getDay() <= 5;
  if (storeBar) {
    storeBar.querySelector('.store-open-dot').style.background = isOpen ? 'var(--success)' : 'var(--danger)';
    storeBar.querySelector('strong').textContent = isOpen ? 'Tienda Abierta' : 'Tienda Cerrada';
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}

// ─────────────── INIT ───────────────
async function init() {
  initTheme();
  loadFavorites();
  loadCart();
  loadProfile();
  await loadProducts();
  renderCart();
  updateFavCount();
  updateClock();
  setInterval(updateClock, 60000);
  requestNotificationPermission();
  document.getElementById('menuBtn')?.addEventListener('click', toggleSidebar);
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('cartBtn')?.addEventListener('click', () => toggleCart());
}

document.addEventListener('DOMContentLoaded', init);
