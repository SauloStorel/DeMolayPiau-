require('dotenv').config();
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { google } = require('googleapis');

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

// ─────────────────────────────────────────────
// E-MAIL (nodemailer)
// ─────────────────────────────────────────────

const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: smtpSecure,
  ...(smtpSecure ? {} : { requireTLS: true }),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }
});

// ─────────────────────────────────────────────
// GOOGLE SHEETS
// ─────────────────────────────────────────────

let sheetsApi = null;
let driveApi  = null;

(function initSheets() {
  const keyB64 = process.env.GOOGLE_SHEETS_KEY;
  if (!keyB64) return;
  try {
    const creds = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf8'));
    const auth = new google.auth.JWT(
      creds.client_email, null, creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets',
       'https://www.googleapis.com/auth/drive.file']
    );
    sheetsApi = google.sheets({ version: 'v4', auth });
    driveApi  = google.drive({ version: 'v3', auth });
    console.log('[SHEETS] Google Sheets integração ativa.');
  } catch (err) {
    console.error('[SHEETS] Falha ao inicializar:', err.message);
  }
})();

const SHEETS_CONFIG_FILE = path.join(DATA_DIR, 'sheets-config.json');
const STATUS_PT = { pending: 'Aguardando', paid: 'Pago', cancelled: 'Cancelado' };
const SHEET_HEADERS = [
  'N. Pedido','Nome','E-mail','Telefone','Capítulo',
  'Produto','Lote','Variante','Tam. Camisa','Qtd',
  'Preço Unit. (R$)','Total Pedido (R$)','Status','Data'
];

async function syncOrdersToSheets() {
  if (!sheetsApi) throw new Error('Google Sheets não configurado. Adicione GOOGLE_SHEETS_KEY no .env');

  const orders   = readJSON('orders.json');
  const products = readJSON('products.json');

  // Obtém ou cria spreadsheet
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(SHEETS_CONFIG_FILE, 'utf8')); } catch {}

  if (!cfg.spreadsheetId) {
    const created = await driveApi.files.create({
      requestBody: { name: 'Pedidos — DeMolay Piauí', mimeType: 'application/vnd.google-apps.spreadsheet' },
      fields: 'id'
    });
    cfg.spreadsheetId = created.data.id;
    fs.writeFileSync(SHEETS_CONFIG_FILE, JSON.stringify(cfg, null, 2));
  }

  const { spreadsheetId } = cfg;

  // Monta abas: "Todos" + uma por produto
  const tabMap = new Map(); // tabName -> rows[]
  tabMap.set('Todos os Pedidos', []);

  orders.forEach(o => {
    const date = new Date(o.createdAt).toLocaleString('pt-BR');
    (o.items || []).forEach(item => {
      const row = [
        o.orderNumber || o.id.slice(0,8).toUpperCase(),
        o.customer?.name  || '',
        o.customer?.email || '',
        o.customer?.phone || '',
        o.customer?.chapter || '',
        item.productName  || '',
        item.lotName      || '',
        item.variantName  || '',
        item.shirtSize    || '',
        item.quantity     || 1,
        item.price        || 0,
        o.total           || 0,
        STATUS_PT[o.status] || o.status,
        date
      ];
      tabMap.get('Todos os Pedidos').push(row);
      if (!tabMap.has(item.productName)) tabMap.set(item.productName, []);
      tabMap.get(item.productName).push(row);
    });
  });

  // Garante que cada aba existe
  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(meta.data.sheets.map(s => s.properties.title));
  const toCreate = [...tabMap.keys()].filter(t => !existingTitles.has(t));

  if (toCreate.length) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: toCreate.map(title => ({ addSheet: { properties: { title } } })) }
    });
  }

  // Limpa e reescreve cada aba
  const ranges = [...tabMap.keys()].map(t => `'${t}'!A:Z`);
  await sheetsApi.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges } });

  await sheetsApi.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [...tabMap.entries()].map(([title, rows]) => ({
        range: `'${title}'!A1`,
        values: [SHEET_HEADERS, ...rows]
      }))
    }
  });

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

function formatBRLServer(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

async function sendConfirmationEmail(order) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const itemsRows = (order.items || []).map(i => {
    const name = i.variantName ? `${i.productName} – ${i.variantName}` : i.productName;
    const size = i.shirtSize ? ` (Tamanho: ${i.shirtSize})` : '';
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e8e8e8;">${name}${size}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e8e8e8;text-align:center;">${i.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e8e8e8;text-align:right;">${formatBRLServer(i.price * i.quantity)}</td>
      </tr>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Cabeçalho -->
        <tr>
          <td style="background:#0b1f3a;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#c9a030;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Ordem DeMolay Piauiense</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;">Inscrição Confirmada!</h1>
          </td>
        </tr>

        <!-- Corpo -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#333;">Olá, <strong>${order.customer.name}</strong>!</p>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
              Temos o prazer de confirmar que seu pedido foi <strong style="color:#1b7a3e;">aprovado e registrado com sucesso</strong>.
              Bem-vindo(a) a mais este momento da fraternidade DeMolay!
            </p>

            <!-- Resumo do pedido -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#f7f7f7;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Produto</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Qtd</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Valor</th>
                </tr>
              </thead>
              <tbody>${itemsRows}</tbody>
              <tfoot>
                <tr style="background:#f7f7f7;">
                  <td colspan="2" style="padding:10px 12px;font-weight:bold;font-size:14px;">Total</td>
                  <td style="padding:10px 12px;text-align:right;font-weight:bold;font-size:15px;color:#c9a030;">${formatBRLServer(order.total)}</td>
                </tr>
              </tfoot>
            </table>

            <!-- Dados do participante -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:8px;">Dados do Participante</td>
              </tr>
              <tr>
                <td style="background:#f7f7f7;border-radius:6px;padding:14px 16px;font-size:14px;color:#555;line-height:1.8;">
                  <strong style="color:#333;">N° do Pedido:</strong> ${order.orderNumber || '#' + order.id.slice(0, 8).toUpperCase()}<br>
                  <strong style="color:#333;">E-mail:</strong> ${order.customer.email}<br>
                  <strong style="color:#333;">Telefone:</strong> ${order.customer.phone}<br>
                  ${order.customer.chapter ? `<strong style="color:#333;">Capítulo:</strong> ${order.customer.chapter}<br>` : ''}
                </td>
              </tr>
            </table>

            <p style="font-size:14px;color:#555;margin:0 0 8px;">
              Em caso de dúvidas, entre em contato com a jurisdição pelo WhatsApp ou responda este e-mail.
            </p>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td style="background:#0b1f3a;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#8899aa;font-size:12px;">
              Ordem DeMolay Piauiense — <a href="https://demolaypiaui.org.br" style="color:#c9a030;text-decoration:none;">demolaypiaui.org.br</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await mailer.sendMail({
    from: process.env.SMTP_FROM || `DeMolay Piauí <${process.env.SMTP_USER}>`,
    to: order.customer.email,
    subject: `✅ Inscrição confirmada — ${order.orderNumber || '#' + order.id.slice(0, 8).toUpperCase()}`,
    html,
  });
}

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

// Necessário para cookies secure funcionarem atrás do proxy do Render
app.set('trust proxy', 1);

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
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 horas
  }
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
// RATE LIMITERS
// ─────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5,
  message: { error: 'Muitas requisições. Aguarde um momento.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────

app.post('/api/auth/login', loginLimiter, (req, res) => {
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
    if (!req.file && url && !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'URL inválida. Use http:// ou https://.' });
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
app.post('/api/shop/orders', orderLimiter, (req, res) => {
  const { customer, items, notes } = req.body;

  // Validação básica de dados do cliente
  if (!customer?.name || !customer?.email || !customer?.phone || !customer?.chapter || !items?.length) {
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

  const orders = readJSON('orders.json');

  // Gera número sequencial DMPI00000001
  const lastNum = orders.reduce((max, o) => {
    const m = (o.orderNumber || '').match(/^DMPI(\d+)$/);
    return m ? Math.max(max, parseInt(m[1])) : max;
  }, 0);
  const orderNumber = 'DMPI' + String(lastNum + 1).padStart(8, '0');

  const order = {
    id: uuidv4(),
    orderNumber,
    createdAt: new Date().toISOString(),
    status: 'pending',
    customer,
    items,
    total: calculatedTotal,
    notes: notes || ''
  };
  orders.unshift(order);
  writeJSON('orders.json', orders);
  res.status(201).json({ success: true, order });
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
    const { name, description, active, availableFrom, availableUntil, variants, lots, imageUrl, productType, availableSizes, kitDeadline } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

    const products = readJSON('products.json');
    const newProduct = {
      id: uuidv4(),
      name,
      description: description || '',
      active: active === 'true',
      productType: productType || 'event',
      availableSizes: safeParseJSON(availableSizes, []),
      kitDeadline: kitDeadline || null,
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

    const { name, description, active, availableFrom, availableUntil, variants, lots, imageUrl, productType, availableSizes, kitDeadline } = req.body;
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
      productType: productType || old.productType || 'event',
      availableSizes: availableSizes ? safeParseJSON(availableSizes, old.availableSizes || []) : (old.availableSizes || []),
      kitDeadline: kitDeadline !== undefined ? (kitDeadline || null) : (old.kitDeadline || null),
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

app.patch('/api/admin/shop/orders/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['pending','paid','cancelled'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  const orders = readJSON('orders.json');
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Pedido não encontrado.' });

  const previousStatus = orders[idx].status;
  orders[idx].status = status;
  orders[idx].updatedAt = new Date().toISOString();
  writeJSON('orders.json', orders);

  // Envia e-mail de confirmação ao marcar como pago
  if (status === 'paid' && previousStatus !== 'paid') {
    sendConfirmationEmail(orders[idx]).catch(err =>
      console.error('[EMAIL] Falha ao enviar e-mail de confirmação:', err.message)
    );
  }

  // Sincroniza planilha automaticamente (se configurado)
  if (sheetsApi) {
    syncOrdersToSheets().catch(err =>
      console.error('[SHEETS] Auto-sync falhou:', err.message)
    );
  }

  res.json({ success: true });
});

// Google Sheets — sincronizar manualmente
app.post('/api/admin/shop/sync-sheets', requireAuth, async (req, res) => {
  try {
    const url = await syncOrdersToSheets();
    res.json({ success: true, url });
  } catch (err) {
    console.error('[SHEETS] Erro:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Google Sheets — URL da planilha atual
app.get('/api/admin/shop/sheets-url', requireAuth, (req, res) => {
  try {
    const cfg = JSON.parse(fs.readFileSync(SHEETS_CONFIG_FILE, 'utf8'));
    res.json({ url: cfg.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}` : null });
  } catch {
    res.json({ url: null });
  }
});

// Google Sheets — status da integração
app.get('/api/admin/shop/sheets-status', requireAuth, (req, res) => {
  res.json({ configured: !!sheetsApi });
});

// Deletar pedido
app.delete('/api/admin/shop/orders/:id', requireAuth, (req, res) => {
  const orders = readJSON('orders.json');
  const exists = orders.some(o => o.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Pedido não encontrado.' });
  writeJSON('orders.json', orders.filter(o => o.id !== req.params.id));
  res.json({ success: true });
});


// Teste de e-mail
app.post('/api/admin/test-email', requireAuth, async (req, res) => {
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || `DeMolay Piauí <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'Teste de e-mail — DeMolay Piauí',
      text: 'Se você recebeu este e-mail, o envio está funcionando corretamente.'
    });
    res.json({ success: true, message: 'E-mail enviado com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, code: err.code });
  }
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

// ── Financeiro ────────────────────────────────
const financeiroFile = path.join(DATA_DIR, 'financeiro.json');
if (!fs.existsSync(financeiroFile)) fs.writeFileSync(financeiroFile, '[]', 'utf8');

// Rota pública — sem autenticação
app.get('/api/financeiro', (req, res) => {
  res.json(readJSON('financeiro.json'));
});

app.get('/api/admin/financeiro', requireAuth, (req, res) => {
  res.json(readJSON('financeiro.json'));
});

app.post('/api/admin/financeiro', requireAuth, (req, res) => {
  const { data, categoria, descricao, valor, tipo } = req.body;
  if (!data || !categoria || !valor || !tipo)
    return res.status(400).json({ error: 'Campos obrigatórios: data, categoria, valor, tipo.' });
  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum <= 0)
    return res.status(400).json({ error: 'Valor inválido.' });
  if (!['debito', 'credito'].includes(tipo))
    return res.status(400).json({ error: 'Tipo inválido.' });
  const entries = readJSON('financeiro.json');
  const entry = {
    id: uuidv4(), data, categoria,
    descricao: descricao || '', valor: valorNum, tipo,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  entries.push(entry);
  writeJSON('financeiro.json', entries);
  res.status(201).json(entry);
});

app.patch('/api/admin/financeiro/:id', requireAuth, (req, res) => {
  const entries = readJSON('financeiro.json');
  const idx = entries.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lançamento não encontrado.' });
  const { data, categoria, descricao, valor, tipo } = req.body;
  if (valor !== undefined) {
    const v = parseFloat(valor);
    if (isNaN(v) || v <= 0) return res.status(400).json({ error: 'Valor inválido.' });
    entries[idx].valor = v;
  }
  if (data) entries[idx].data = data;
  if (categoria) entries[idx].categoria = categoria;
  if (descricao !== undefined) entries[idx].descricao = descricao;
  if (tipo && ['debito', 'credito'].includes(tipo)) entries[idx].tipo = tipo;
  entries[idx].updatedAt = new Date().toISOString();
  writeJSON('financeiro.json', entries);
  res.json(entries[idx]);
});

app.delete('/api/admin/financeiro/:id', requireAuth, (req, res) => {
  const entries = readJSON('financeiro.json');
  if (!entries.find(e => e.id === req.params.id))
    return res.status(404).json({ error: 'Lançamento não encontrado.' });
  writeJSON('financeiro.json', entries.filter(e => e.id !== req.params.id));
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`✔ Servidor rodando em http://localhost:${PORT}`);
  console.log(`  Admin: http://localhost:${PORT}/admin`);
});
