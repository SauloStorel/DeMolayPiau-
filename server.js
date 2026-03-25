require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Diretórios de dados
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Garante que os diretórios existam
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Inicializa arquivos JSON se não existirem
const categories = ['gabinete', 'grande-conselho', 'prestacao'];
categories.forEach(cat => {
  const file = path.join(DATA_DIR, `${cat}-docs.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf8');
});

const SHOP_FILES = ['products', 'orders', 'shop-config'];
SHOP_FILES.forEach(name => {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    const defaultVal = name === 'shop-config'
      ? JSON.stringify({ whatsapp: '', pixKey: '', pixType: 'email', pixName: '' }, null, 2)
      : '[]';
    fs.writeFileSync(file, defaultVal, 'utf8');
  }
});

// Multer — imagens de produto, máximo 5MB
const imgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `img-${uuidv4()}${ext}`);
  }
});
const uploadImage = multer({
  storage: imgStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype);
    cb(null, ok);
  }
});

// Multer — apenas PDFs, máximo 20MB
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(null, false);
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (!process.env.SESSION_SECRET) {
  console.warn('[AVISO] SESSION_SECRET não definido no .env — defina uma chave segura antes de ir para produção.');
}
app.use(session({
  secret: process.env.SESSION_SECRET || `dev-secret-${Date.now()}`,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}));


// Servir arquivos estáticos públicos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Não autorizado.' });
}

// Proteção das páginas admin (server-side)
['/admin/panel.html', '/admin/produtos.html', '/admin/produto-form.html', '/admin/pedidos.html'].forEach(route => {
  app.get(route, (req, res) => {
    if (!req.session?.isAdmin) return res.redirect('/admin/index.html');
    res.sendFile(path.join(__dirname, 'public', route.slice(1)));
  });
});

// ─────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (
    email === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Credenciais inválidas.' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/check', (req, res) => {
  if (req.session && req.session.isAdmin) return res.json({ authenticated: true });
  res.status(401).json({ authenticated: false });
});

// ─────────────────────────────────────────────
// DOCS ROUTES (leitura pública)
// ─────────────────────────────────────────────

app.get('/api/docs/:category', (req, res) => {
  const { category } = req.params;
  if (!categories.includes(category)) return res.status(404).json({ error: 'Categoria não encontrada.' });
  const file = path.join(DATA_DIR, `${category}-docs.json`);
  const docs = JSON.parse(fs.readFileSync(file, 'utf8'));
  res.json(docs);
});

// ─────────────────────────────────────────────
// ADMIN ROUTES (protegidos)
// ─────────────────────────────────────────────

// Adicionar documento
app.post('/api/admin/docs/:category', requireAuth, (req, res, next) => {
  const { category } = req.params;
  if (!categories.includes(category)) return res.status(404).json({ error: 'Categoria não encontrada.' });

  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { title, url } = req.body;
    if (!title || (!req.file && !url)) {
      return res.status(400).json({ error: 'Título e arquivo ou link são obrigatórios.' });
    }

    const file = path.join(DATA_DIR, `${category}-docs.json`);
    const docs = JSON.parse(fs.readFileSync(file, 'utf8'));

    const newDoc = {
      id: uuidv4(),
      title,
      uploadedAt: new Date().toISOString(),
    };

    if (req.file) {
      newDoc.type = 'upload';
      newDoc.filename = req.file.filename;
      newDoc.originalName = req.file.originalname;
    } else {
      newDoc.type = 'link';
      newDoc.url = url;
    }

    docs.unshift(newDoc);
    fs.writeFileSync(file, JSON.stringify(docs, null, 2), 'utf8');
    res.json({ success: true, doc: newDoc });
  });
});

// Remover documento
app.delete('/api/admin/docs/:category/:id', requireAuth, (req, res) => {
  const { category, id } = req.params;
  if (!categories.includes(category)) return res.status(404).json({ error: 'Categoria não encontrada.' });

  const file = path.join(DATA_DIR, `${category}-docs.json`);
  const docs = JSON.parse(fs.readFileSync(file, 'utf8'));
  const doc = docs.find(d => d.id === id);

  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

  // Remove arquivo físico se for upload
  if (doc.type === 'upload' && doc.filename) {
    const filePath = path.join(UPLOADS_DIR, doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  const newDocs = docs.filter(d => d.id !== id);
  fs.writeFileSync(file, JSON.stringify(newDocs, null, 2), 'utf8');
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// SHOP — PÚBLICO
// ─────────────────────────────────────────────

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch (err) {
    console.error(`[ERRO] Falha ao ler ${file}:`, err.message);
    return file === 'shop-config.json' ? {} : [];
  }
}
function writeJSON(file, data) {
  try {
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[ERRO] Falha ao escrever ${file}:`, err.message);
    throw err;
  }
}

// Retorna o lote ativo de um produto no momento atual
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

// Lista produtos ativos (com lote atual injetado)
app.get('/api/shop/products', (req, res) => {
  const now = new Date();
  const products = readJSON('products.json').filter(p => {
    if (!p.active) return false;
    if (p.availableFrom && new Date(p.availableFrom) > now) return false;
    if (p.availableUntil && new Date(p.availableUntil) < now) return false;
    return true;
  }).map(p => ({ ...p, activeLot: getActiveLot(p) }));
  res.json(products);
});

// Produto único (público)
app.get('/api/shop/products/:id', (req, res) => {
  const products = readJSON('products.json');
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
  res.json({ ...product, activeLot: getActiveLot(product) });
});

// Config pública (PIX, WhatsApp)
app.get('/api/shop/config', (req, res) => {
  const cfg = readJSON('shop-config.json');
  res.json({ whatsapp: cfg.whatsapp || '', pixKey: cfg.pixKey || '', pixType: cfg.pixType || 'email', pixName: cfg.pixName || '' });
});

// Criar pedido
app.post('/api/shop/orders', (req, res) => {
  const { customer, items, notes } = req.body;

  // Validação básica de dados do cliente
  if (!customer?.name || !customer?.email || !items?.length) {
    return res.status(400).json({ error: 'Dados do pedido incompletos.' });
  }
  // Validação de formato de email
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(customer.email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  // Validação de quantidade por item
  for (const item of items) {
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      return res.status(400).json({ error: 'Quantidade inválida em um dos itens.' });
    }
  }

  const products = readJSON('products.json');
  let calculatedTotal = 0;

  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    if (!product) return res.status(400).json({ error: `Produto não encontrado: ${item.productId}` });
    const lot = (product.lots || []).find(l => l.id === item.lotId);
    if (!lot) return res.status(400).json({ error: `Lote não encontrado: ${item.lotId}` });
    // Verifica se o lote ainda está ativo
    const activeLot = getActiveLot(product);
    if (!activeLot || activeLot.id !== lot.id) {
      return res.status(400).json({ error: `O lote "${lot.name}" não está mais disponível.` });
    }
    // Verifica estoque
    if (lot.maxQuantity !== null && lot.maxQuantity !== undefined) {
      if ((lot.soldQuantity || 0) + item.quantity > lot.maxQuantity) {
        return res.status(400).json({ error: `Estoque insuficiente para "${product.name}" – ${lot.name}.` });
      }
    }
    // Calcula preço real do servidor: variantPrice tem prioridade, depois lot.price
    let unitPrice = lot.price ?? 0;
    if (item.variantId && lot.variantPrices && lot.variantPrices[item.variantId] !== undefined) {
      unitPrice = lot.variantPrices[item.variantId];
    }
    calculatedTotal += unitPrice * item.quantity;
  }

  // Incrementa soldQuantity nos lotes
  for (const item of items) {
    const pIdx = products.findIndex(p => p.id === item.productId);
    const lIdx = products[pIdx].lots.findIndex(l => l.id === item.lotId);
    products[pIdx].lots[lIdx].soldQuantity = (products[pIdx].lots[lIdx].soldQuantity || 0) + item.quantity;
  }
  writeJSON('products.json', products);

  const order = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    customer,
    items,
    total: calculatedTotal, // total calculado no servidor, nunca confiado no cliente
    notes: notes || ''
  };
  const orders = readJSON('orders.json');
  orders.unshift(order);
  writeJSON('orders.json', orders);
  res.json({ success: true, order });
});

// ─────────────────────────────────────────────
// SHOP — ADMIN (protegido)
// ─────────────────────────────────────────────

// Lista todos os produtos (admin)
app.get('/api/admin/shop/products', requireAuth, (req, res) => {
  res.json(readJSON('products.json'));
});

// Criar produto
app.post('/api/admin/shop/products', requireAuth, (req, res) => {
  uploadImage.single('image')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    const { name, description, active, availableFrom, availableUntil, variants, lots, imageUrl } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

    const products = readJSON('products.json');
    const newProduct = {
      id: uuidv4(),
      name,
      description: description || '',
      active: active === 'true',
      availableFrom: availableFrom || null,
      availableUntil: availableUntil || null,
      variants: safeParseJSON(variants, []),
      lots: safeParseJSON(lots, []),
      image: req.file ? req.file.filename : null,
      imageUrl: !req.file ? (imageUrl || null) : null,
      imageType: req.file ? 'upload' : 'url',
      createdAt: new Date().toISOString()
    };
    products.unshift(newProduct);
    writeJSON('products.json', products);
    res.json({ success: true, product: newProduct });
  });
});

// Atualizar produto
app.put('/api/admin/shop/products/:id', requireAuth, (req, res) => {
  uploadImage.single('image')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    const products = readJSON('products.json');
    const idx = products.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado.' });

    const { name, description, active, availableFrom, availableUntil, variants, lots, imageUrl } = req.body;
    const old = products[idx];

    if (req.file && old.imageType === 'upload' && old.image) {
      const oldPath = path.join(UPLOADS_DIR, old.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    products[idx] = {
      ...old,
      name: name || old.name,
      description: description !== undefined ? description : old.description,
      active: active !== undefined ? active === 'true' : old.active,
      availableFrom: availableFrom !== undefined ? (availableFrom || null) : old.availableFrom,
      availableUntil: availableUntil !== undefined ? (availableUntil || null) : old.availableUntil,
      variants: variants ? safeParseJSON(variants, old.variants) : old.variants,
      lots: lots ? safeParseJSON(lots, old.lots) : old.lots,
      image: req.file ? req.file.filename : old.image,
      imageUrl: !req.file ? (imageUrl !== undefined ? imageUrl : old.imageUrl) : null,
      imageType: req.file ? 'upload' : old.imageType,
      updatedAt: new Date().toISOString()
    };
    writeJSON('products.json', products);
    res.json({ success: true, product: products[idx] });
  });
});

// Toggle ativo/inativo
app.patch('/api/admin/shop/products/:id/toggle', requireAuth, (req, res) => {
  const products = readJSON('products.json');
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado.' });
  products[idx].active = !products[idx].active;
  writeJSON('products.json', products);
  res.json({ success: true, active: products[idx].active });
});

// Deletar produto
app.delete('/api/admin/shop/products/:id', requireAuth, (req, res) => {
  const products = readJSON('products.json');
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
  if (product.imageType === 'upload' && product.image) {
    const imgPath = path.join(UPLOADS_DIR, product.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  writeJSON('products.json', products.filter(p => p.id !== req.params.id));
  res.json({ success: true });
});

// Pedidos (admin)
app.get('/api/admin/shop/orders', requireAuth, (req, res) => {
  res.json(readJSON('orders.json'));
});

app.patch('/api/admin/shop/orders/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['pending','paid','cancelled'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  const orders = readJSON('orders.json');
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Pedido não encontrado.' });
  orders[idx].status = status;
  orders[idx].updatedAt = new Date().toISOString();
  writeJSON('orders.json', orders);
  res.json({ success: true });
});

// Config da loja (admin)
app.get('/api/admin/shop/config', requireAuth, (req, res) => {
  res.json(readJSON('shop-config.json'));
});

app.put('/api/admin/shop/config', requireAuth, (req, res) => {
  const { whatsapp, pixKey, pixType, pixName } = req.body;
  writeJSON('shop-config.json', { whatsapp: whatsapp||'', pixKey: pixKey||'', pixType: pixType||'email', pixName: pixName||'' });
  res.json({ success: true });
});

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

app.listen(PORT, () => {
  console.log(`✔ Servidor rodando em http://localhost:${PORT}`);
  console.log(`  Admin: http://localhost:${PORT}/admin`);
});
