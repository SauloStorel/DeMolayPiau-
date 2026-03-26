#!/usr/bin/env node
/**
 * test-site.js — Suite de testes automatizados para o site DeMolay Piauí
 * Uso: node test-site.js [BASE_URL]
 * Ex:  node test-site.js http://localhost:3000
 */

const http  = require('http');
const https = require('https');

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const IS_HTTPS = BASE.startsWith('https');

// ID real de produto/lote existente no banco (evita criar produto só para teste)
const REAL_PRODUCT_ID = 'c6e4c90e-fcb0-42f9-8eb3-70b21ef68895';
const REAL_LOT_ID     = 'l_1774400472047';
const REAL_VARIANT_ID = 'v_P';

let passed = 0, failed = 0;
let sessionCookie = '';

// ─── helpers ───────────────────────────────────────────────────────────────

function req(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url  = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname : url.hostname,
      port     : url.port || (IS_HTTPS ? 443 : 80),
      path     : url.pathname + url.search,
      method,
      headers  : {
        'Content-Type'  : 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
        ...extraHeaders,
      },
    };

    const transport = IS_HTTPS ? https : http;
    const r = transport.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let body;
        try { body = JSON.parse(raw); } catch { body = raw; }
        // captura cookie de sessão
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          const sid = setCookie.find(c => c.startsWith('connect.sid'));
          if (sid) sessionCookie = sid.split(';')[0];
        }
        resolve({ status: res.status || res.statusCode, body, raw });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function bodyStr(body) {
  if (body === undefined || body === null) return '(empty)';
  if (typeof body === 'string') return body.slice(0, 120);
  return JSON.stringify(body).slice(0, 120);
}

function ok(label, pass, r, extra = '') {
  if (pass) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    const detail = r ? ` | HTTP ${r.status} | ${bodyStr(r.body)}` : '';
    console.log(`  ❌ ${label}${detail}${extra ? ' | ' + extra : ''}`);
    failed++;
  }
}

// ─── grupos de testes ───────────────────────────────────────────────────────

async function testPublicPages() {
  console.log('\n📄 Páginas públicas');

  // A SPA serve tudo por "/" — rotas como /sobre são hash-based no client
  const r = await req('GET', '/');
  ok('GET / retorna 200', r.status === 200, r);
  ok('/ retorna HTML', typeof r.body === 'string' && r.body.includes('<!DOCTYPE'), r);

  const assets = [
    '/css/main.css',
    '/css/shop.css',
    '/css/admin.css',
    '/js/carrinho.js',
  ];
  for (const a of assets) {
    const ra = await req('GET', a);
    ok(`Estático ${a} existe`, ra.status === 200, ra);
  }
}

async function testShopPublicApi() {
  console.log('\n🛒 API pública — loja');

  const rProd = await req('GET', '/api/shop/products');
  ok('GET /api/shop/products retorna 200', rProd.status === 200, rProd);
  ok('Resposta é array', Array.isArray(rProd.body), rProd);

  const rOne = await req('GET', `/api/shop/products/${REAL_PRODUCT_ID}`);
  ok('GET /api/shop/products/:id retorna 200', rOne.status === 200, rOne);
  ok('Produto tem campo "name"', rOne.body && typeof rOne.body.name === 'string', rOne);

  const rMiss = await req('GET', '/api/shop/products/id-que-nao-existe');
  ok('GET produto inexistente retorna 404', rMiss.status === 404, rMiss);

  const rCfg = await req('GET', '/api/shop/config');
  ok('GET /api/shop/config retorna 200', rCfg.status === 200, rCfg);
  ok('Config tem pixKey', rCfg.body && 'pixKey' in rCfg.body, rCfg);
  ok('Config tem whatsapp', rCfg.body && 'whatsapp' in rCfg.body, rCfg);
}

async function testDocsPublicApi() {
  console.log('\n📂 API pública — documentos');
  const cats = ['gabinete', 'grande-conselho', 'prestacao'];
  for (const c of cats) {
    const r = await req('GET', `/api/docs/${c}`);
    ok(`GET /api/docs/${c} retorna 200`, r.status === 200, r);
    ok(`Resposta é array (${c})`, Array.isArray(r.body), r);
  }

  // categoria inválida deve retornar 404 ou array vazio
  const rInv = await req('GET', '/api/docs/categoria-invalida');
  ok('Categoria inválida retorna 404', rInv.status === 404, rInv);
}

async function testOrderValidation() {
  console.log('\n📦 Validação de pedido (público)');

  // sem campos
  const r1 = await req('POST', '/api/shop/orders', {});
  if (r1.status === 429) { console.log('  ⚠️  Rate limit ativo — pulando validações de pedido'); return; }
  ok('Pedido sem dados retorna 400', r1.status === 400, r1);

  // sem telefone
  const r2 = await req('POST', '/api/shop/orders', {
    customer: { name: 'Teste', email: 'a@b.com', chapter: 'Cap' },
    items: [{ productId: REAL_PRODUCT_ID, lotId: REAL_LOT_ID, quantity: 1 }],
  });
  ok('Pedido sem phone retorna 400', r2.status === 400, r2);

  // email inválido
  const r3 = await req('POST', '/api/shop/orders', {
    customer: { name: 'Teste', email: 'nao-e-email', phone: '86999990000', chapter: 'Cap' },
    items: [{ productId: REAL_PRODUCT_ID, lotId: REAL_LOT_ID, quantity: 1 }],
  });
  ok('Pedido com e-mail inválido retorna 400', r3.status === 400, r3);

  // quantidade inválida (0)
  const r4 = await req('POST', '/api/shop/orders', {
    customer: { name: 'Teste', email: 'a@b.com', phone: '86999990000', chapter: 'Cap' },
    items: [{ productId: REAL_PRODUCT_ID, lotId: REAL_LOT_ID, quantity: 0 }],
  });
  ok('Pedido com quantidade 0 retorna 400', r4.status === 400, r4);

  // produto inexistente
  const r5 = await req('POST', '/api/shop/orders', {
    customer: { name: 'Teste', email: 'a@b.com', phone: '86999990000', chapter: 'Cap' },
    items: [{ productId: 'id-falso', lotId: 'lote-falso', quantity: 1 }],
  });
  if (r5.status === 429) { console.log('  ⚠️  Rate limit ativo — pulando teste "produto inexistente"'); }
  else ok('Pedido com produto inexistente retorna 400', r5.status === 400, r5);
}

async function testOrderCreation() {
  console.log('\n📦 Criação de pedido (com produto real)');

  const validOrder = {
    customer: {
      name   : 'Teste Automatizado',
      email  : 'teste@demolay.org',
      phone  : '86999990000',
      chapter: 'Capítulo Teste Automatizado',
    },
    items: [{
      productId  : REAL_PRODUCT_ID,
      lotId      : REAL_LOT_ID,
      variantId  : REAL_VARIANT_ID,
      productName: 'Camisa do GE',
      variantName: 'P',
      quantity   : 1,
      price      : 60,
    }],
    total: 60,
  };

  const rOk = await req('POST', '/api/shop/orders', validOrder);

  // Rate limit entre execuções consecutivas — não conta como falha real
  if (rOk.status === 429) {
    console.log('  ⚠️  Rate limit ativo (429) — aguarde ~1min entre execuções para testar criação');
    return;
  }

  ok('Pedido válido retorna 200/201', rOk.status === 200 || rOk.status === 201, rOk);

  const order = rOk.body && rOk.body.order;
  if (order) {
    ok('Resposta tem campo order', true, rOk);
    ok('orderNumber segue formato DMPI########',
       /^DMPI\d{8}$/.test(order.orderNumber || ''), rOk,
       `got: ${order.orderNumber}`);
    ok('Pedido tem id UUID', typeof order.id === 'string' && order.id.length > 10, rOk);
    ok('Status inicial é "pending"', order.status === 'pending', rOk);
    globalThis._testOrderId = order.id;
  } else {
    ok('Resposta tem campo order', false, rOk);
    ok('orderNumber segue formato DMPI########', false, rOk, 'pedido não criado');
    ok('Pedido tem id UUID', false, rOk);
    ok('Status inicial é "pending"', false, rOk);
  }
}

async function testAdminAuth() {
  console.log('\n🔐 Autenticação admin');

  // reset cookie
  sessionCookie = '';

  // rota protegida sem sessão
  const rNoAuth = await req('GET', '/api/admin/shop/orders');
  ok('Rota protegida sem sessão retorna 401', rNoAuth.status === 401, rNoAuth);

  // login com senha errada
  const rWrong = await req('POST', '/api/auth/login', {
    email   : 'admin@demolaypiaui.org.br',
    password: 'senhaerrada__xyz',
  });
  ok('Login com senha errada retorna 401', rWrong.status === 401, rWrong);

  // checar status sem login
  const rCheck1 = await req('GET', '/api/auth/check');
  ok('/api/auth/check sem sessão retorna 401', rCheck1.status === 401, rCheck1);

  // login correto (campo é "email", não "username")
  const rLogin = await req('POST', '/api/auth/login', {
    email   : process.env.ADMIN_USER || 'admin@demolaypiaui.org.br',
    password: process.env.ADMIN_PASS || 'DeMolayPI1999CB',
  });
  ok('Login correto retorna 200', rLogin.status === 200, rLogin);

  // checar status após login
  const rCheck2 = await req('GET', '/api/auth/check');
  ok('/api/auth/check após login retorna 200', rCheck2.status === 200, rCheck2);

  // rota protegida deve funcionar
  const rAuth = await req('GET', '/api/admin/shop/orders');
  ok('Rota protegida com sessão retorna 200', rAuth.status === 200, rAuth);
}

async function testAdminOrders() {
  console.log('\n🗂️  Admin — pedidos');

  const rList = await req('GET', '/api/admin/shop/orders');
  ok('GET /api/admin/shop/orders retorna 200', rList.status === 200, rList);
  ok('Resposta é array', Array.isArray(rList.body), rList);

  if (globalThis._testOrderId) {
    const id = globalThis._testOrderId;

    // PATCH status inválido
    const rBad = await req('PATCH', `/api/admin/shop/orders/${id}/status`, { status: 'invalido' });
    ok('PATCH status inválido retorna 400', rBad.status === 400, rBad);

    // PATCH status válido
    const rPatch = await req('PATCH', `/api/admin/shop/orders/${id}/status`, { status: 'paid' });
    ok('PATCH status "paid" retorna 200', rPatch.status === 200, rPatch);

    // PATCH de pedido inexistente
    const rMissing = await req('PATCH', '/api/admin/shop/orders/id-inexistente/status', { status: 'paid' });
    ok('PATCH pedido inexistente retorna 404', rMissing.status === 404, rMissing);

    // DELETE pedido criado pelo teste
    const rDel = await req('DELETE', `/api/admin/shop/orders/${id}`);
    ok('DELETE pedido retorna 200', rDel.status === 200, rDel);

    // DELETE mesmo id novamente deve retornar 404
    const rDel2 = await req('DELETE', `/api/admin/shop/orders/${id}`);
    ok('DELETE pedido já excluído retorna 404', rDel2.status === 404, rDel2);
  } else {
    console.log('  ⚠️  Sem pedido de teste — pulando PATCH/DELETE');
  }
}

async function testAdminProducts() {
  console.log('\n📦 Admin — produtos');

  const rList = await req('GET', '/api/admin/shop/products');
  ok('GET /api/admin/shop/products retorna 200', rList.status === 200, rList);
  ok('Resposta é array', Array.isArray(rList.body), rList);
  // POST de produto usa multipart/form-data (multer) — não testável via JSON puro
}

async function testAdminDocs() {
  console.log('\n📂 Admin — documentos');

  // doc com URL inválida
  const rBadUrl = await req('POST', '/api/admin/docs/gabinete', {
    title: 'Teste',
    url  : 'isso-nao-e-url',
    date : '2024-01-01',
  });
  ok('Doc com URL inválida retorna 400', rBadUrl.status === 400, rBadUrl);

  // doc com URL válida
  const rGood = await req('POST', '/api/admin/docs/gabinete', {
    title: 'Doc de Teste Automatizado',
    url  : 'https://exemplo.com/doc-teste.pdf',
    date : '2024-01-01',
  });
  ok('Doc com URL válida retorna 200/201', rGood.status === 200 || rGood.status === 201, rGood);

  const docId = rGood.body && (rGood.body.id || (rGood.body.doc && rGood.body.doc.id));
  if ((rGood.status === 200 || rGood.status === 201) && docId) {
    const delR = await req('DELETE', `/api/admin/docs/gabinete/${docId}`);
    ok('DELETE doc de teste retorna 200', delR.status === 200, delR);
  } else {
    ok('DELETE doc de teste retorna 200', false, rGood, 'doc não foi criado');
  }

  // categoria inválida
  const rInv = await req('POST', '/api/admin/docs/categoria-invalida', {
    title: 'Teste', url: 'https://ex.com', date: '2024-01-01',
  });
  ok('POST em categoria inválida retorna 400/404', rInv.status === 400 || rInv.status === 404, rInv);
}

async function testAdminShopConfig() {
  console.log('\n⚙️  Admin — config da loja');

  const rGet = await req('GET', '/api/admin/shop/config');
  ok('GET /api/admin/shop/config retorna 200', rGet.status === 200, rGet);

  // mantém valores atuais para não corromper o banco
  const current = (rGet.status === 200 && rGet.body) ? rGet.body : {
    whatsapp: '86998155687',
    pixKey  : '04438958300',
    pixType : 'cpf',
    pixName : 'Teste',
  };

  const rPut = await req('PUT', '/api/admin/shop/config', current);
  ok('PUT /api/admin/shop/config retorna 200', rPut.status === 200, rPut);
}

async function testLogout() {
  console.log('\n🚪 Logout');

  const r = await req('POST', '/api/auth/logout');
  ok('Logout retorna 200', r.status === 200, r);

  const rAfter = await req('GET', '/api/admin/shop/orders');
  ok('Após logout rota protegida retorna 401', rAfter.status === 401, rAfter);
}

async function testSecurityAndEdgeCases() {
  console.log('\n🛡️  Segurança e casos de borda');

  // Rota inexistente
  const r404 = await req('GET', '/rota-que-nao-existe-xyzzy');
  ok('Rota inexistente retorna 404', r404.status === 404, r404);

  // /admin sem sessão deve redirecionar (301/302) ou bloquear (401/403)
  sessionCookie = '';
  const rAdmin = await req('GET', '/admin');
  const adminBlocked = [301, 302, 401, 403].includes(rAdmin.status);
  ok('/admin sem sessão redireciona ou bloqueia', adminBlocked, rAdmin);

  // XSS no customer name — servidor não deve executar script (nem crashar)
  const rXss = await req('POST', '/api/shop/orders', {
    customer: {
      name   : '<script>alert(1)</script>',
      email  : 'a@b.com',
      phone  : '86999990000',
      chapter: 'Cap',
    },
    items: [{ productId: REAL_PRODUCT_ID, lotId: REAL_LOT_ID, quantity: 1 }],
  });
  if (rXss.status === 429) { console.log('  ⚠️  Rate limit — pulando XSS test'); }
  else ok('POST com XSS no nome não causa 5xx', rXss.status < 500, rXss);

  // SQL Injection tentativa em query string
  const rSql = await req('GET', "/api/shop/products?id=1' OR '1'='1");
  ok('GET com SQL injection não causa 5xx', rSql.status < 500, rSql);
}

// ─── runner principal ───────────────────────────────────────────────────────

(async () => {
  console.log(`\n🧪 Suite de testes — ${BASE}`);
  console.log('='.repeat(55));

  try {
    await testPublicPages();
    await testShopPublicApi();
    await testDocsPublicApi();
    // Cria pedido ANTES dos testes de validação para não consumir o rate limit antes
    await testOrderCreation();
    await testOrderValidation();
    await testAdminAuth();
    await testAdminOrders();
    await testAdminProducts();
    await testAdminDocs();
    await testAdminShopConfig();
    await testLogout();
    await testSecurityAndEdgeCases();
  } catch (err) {
    console.error('\n💥 Erro inesperado no runner:', err.message, err.stack);
    failed++;
  }

  console.log('\n' + '='.repeat(55));
  console.log(`\n📊 Resultado: ${passed} passou, ${failed} falhou`);
  if (failed === 0) {
    console.log('🎉 Todos os testes passaram!\n');
  } else {
    console.log(`⚠️  ${failed} teste(s) falharam — veja os ❌ acima\n`);
  }
  process.exit(failed > 0 ? 1 : 0);
})();
