/* =============================================
   ADMIN PANEL
   ============================================= */

let currentCategory = 'gabinete';

const categoryLabels = {
  'gabinete':        { title: 'Gabinete Estadual',       desc: 'Gerencie os documentos do Gabinete Estadual' },
  'grande-conselho': { title: 'Grande Conselho Estadual', desc: 'Gerencie os documentos do Grande Conselho Estadual' },
  'prestacao':       { title: 'Prestação de Contas',      desc: 'Gerencie os documentos de Prestação de Contas' }
};

// ── Autenticação ──────────────────────────────
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/check');
    if (!res.ok) window.location.href = '/admin/index.html';
  } catch {
    window.location.href = '/admin/index.html';
  }
}

// ── Logout ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth().then(() => {
    loadCategory(currentCategory);
    initUI();
  });
});

function initUI() {
  // Sidebar navigation
  document.getElementById('sidebarNav').addEventListener('click', e => {
    const link = e.target.closest('[data-cat]');
    if (!link) return;
    e.preventDefault();
    document.querySelectorAll('#sidebarNav [data-cat]').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    currentCategory = link.dataset.cat;
    const labels = categoryLabels[currentCategory] || {};
    document.getElementById('panelTitle').textContent = labels.title || '';
    document.getElementById('panelDesc').textContent = labels.desc || '';
    loadCategory(currentCategory);
    resetForm();
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/index.html';
  });

  // Upload tabs
  document.querySelectorAll('.upload-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.upload-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Dropzone — mostra nome do arquivo selecionado
  const fileInput = document.getElementById('fileInput');
  const selectedFile = document.getElementById('selectedFile');
  const selectedFileName = document.getElementById('selectedFileName');

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      selectedFileName.textContent = fileInput.files[0].name;
      selectedFile.classList.add('show');
    } else {
      selectedFile.classList.remove('show');
    }
  });

  // Drag and drop
  const dropzone = document.getElementById('dropzone');
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      fileInput.files = e.dataTransfer.files;
      selectedFileName.textContent = file.name;
      selectedFile.classList.add('show');
    }
  });

  // Upload form
  document.getElementById('uploadForm').addEventListener('submit', handleUpload);
}

// ── Carregar documentos ───────────────────────
async function loadCategory(category) {
  const list = document.getElementById('admin-docs-list');
  const countEl = document.getElementById('admin-docs-count');
  list.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  try {
    const res = await fetch(`/api/docs/${category}`);
    if (!res.ok) throw new Error();
    const docs = await res.json();

    countEl.textContent = `${docs.length} doc(s)`;

    if (docs.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="padding:2rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>Nenhum documento publicado nesta categoria.</p>
        </div>`;
      return;
    }

    list.innerHTML = docs.map(doc => {
      const href = doc.type === 'upload' ? `/uploads/${doc.filename}` : doc.url;
      const date = new Date(doc.uploadedAt).toLocaleDateString('pt-BR');
      return `
        <div class="admin-doc-item">
          <div class="admin-doc-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="admin-doc-info">
            <strong>${escapeHtml(doc.title)}</strong>
            <span>${date} · ${doc.type === 'upload' ? 'Upload' : 'Link externo'}</span>
          </div>
          <div class="admin-doc-actions">
            <a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline" title="Visualizar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </a>
            <button class="btn btn-danger" data-id="${doc.id}" onclick="handleDelete('${escapeHtml(doc.id)}', '${escapeHtml(doc.title)}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Remover
            </button>
          </div>
        </div>`;
    }).join('');

  } catch {
    list.innerHTML = '<p class="text-muted" style="padding:1rem;">Erro ao carregar documentos.</p>';
  }
}

// ── Upload ────────────────────────────────────
async function handleUpload(e) {
  e.preventDefault();
  const btn = document.getElementById('uploadBtn');
  const msgEl = document.getElementById('upload-msg');

  const activeTab = document.querySelector('.upload-tab.active')?.dataset.tab;
  const title = document.getElementById('doc-title').value.trim();
  const fileInput = document.getElementById('fileInput');
  const url = document.getElementById('doc-url').value.trim();

  if (!title) {
    showMsg(msgEl, 'error', 'O título é obrigatório.');
    return;
  }

  if (activeTab === 'file' && !fileInput.files[0]) {
    showMsg(msgEl, 'error', 'Selecione um arquivo PDF.');
    return;
  }

  if (activeTab === 'link' && !url) {
    showMsg(msgEl, 'error', 'Informe o link do documento.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Publicando...';
  msgEl.innerHTML = '';

  try {
    const formData = new FormData();
    formData.append('title', title);

    if (activeTab === 'file') {
      formData.append('file', fileInput.files[0]);
    } else {
      formData.append('url', url);
    }

    const res = await fetch(`/api/admin/docs/${currentCategory}`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (res.ok) {
      showMsg(msgEl, 'success', 'Documento publicado com sucesso!');
      resetForm();
      loadCategory(currentCategory);
    } else {
      showMsg(msgEl, 'error', data.error || 'Erro ao publicar documento.');
    }
  } catch {
    showMsg(msgEl, 'error', 'Erro de conexão. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      Publicar Documento`;
  }
}

// ── Delete ────────────────────────────────────
async function handleDelete(id, title) {
  const confirmed = await adminConfirm(`Remover "${title}"? Esta ação não pode ser desfeita.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/admin/docs/${currentCategory}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadCategory(currentCategory);
    } else {
      const data = await res.json();
      adminToast(data.error || 'Erro ao remover documento.', 'error');
    }
  } catch {
    adminToast('Erro de conexão. Tente novamente.', 'error');
  }
}

// ── Modal de confirmação programático ─────────
function adminConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    overlay.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.75rem;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.35);">
        <div style="display:flex;align-items:center;gap:0.85rem;margin-bottom:1.25rem;">
          <div style="width:40px;height:40px;border-radius:50%;background:rgba(220,53,69,0.12);border:1px solid var(--danger);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" width="18" height="18"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </div>
          <p style="margin:0;font-size:0.9rem;color:var(--text-muted);">${escapeHtml(message)}</p>
        </div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
          <button id="_adminCancel" class="btn btn-outline" style="font-size:0.88rem;">Cancelar</button>
          <button id="_adminConfirm" class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);font-size:0.88rem;">Remover</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = (val) => { overlay.remove(); resolve(val); };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
    overlay.querySelector('#_adminCancel').addEventListener('click', () => close(false));
    overlay.querySelector('#_adminConfirm').addEventListener('click', () => close(true));
  });
}

function adminToast(msg, type = 'error') {
  let t = document.getElementById('_admin-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_admin-toast';
    t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9998;padding:0.75rem 1.25rem;border-radius:var(--radius);color:#fff;font-size:0.9rem;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.25);transition:opacity 0.3s;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = type === 'error' ? 'var(--danger)' : '#1b7a3e';
  t.style.opacity = '1';
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// ── Helpers ───────────────────────────────────
function showMsg(el, type, text) {
  el.innerHTML = `<div class="alert alert-${type === 'error' ? 'error' : 'success'}">${escapeHtml(text)}</div>`;
  setTimeout(() => { if (el) el.innerHTML = ''; }, 5000);
}

function resetForm() {
  document.getElementById('uploadForm').reset();
  document.getElementById('selectedFile').classList.remove('show');
  document.getElementById('upload-msg').innerHTML = '';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}
