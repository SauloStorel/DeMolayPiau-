/**
 * Renderizador genérico de documentos.
 * Lê o atributo data-category do elemento #docs-container e busca da API.
 */

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str == null ? '' : str);
  return d.innerHTML;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

function getYear(iso) {
  return new Date(iso).getFullYear();
}

function pdfIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>`;
}

function buildDocCard(doc) {
  const href = doc.type === 'upload' ? `/uploads/${doc.filename}` : doc.url;
  return `
    <div class="doc-card">
      <div class="doc-icon">${pdfIcon()}</div>
      <div class="doc-info">
        <h3 title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</h3>
        <div class="doc-meta">
          <span class="doc-date">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${formatDate(doc.uploadedAt)}
          </span>
          ${doc.type === 'link' ? '<span class="badge badge-blue">Link externo</span>' : ''}
        </div>
      </div>
      <div class="doc-actions">
        <a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Baixar / Abrir
        </a>
      </div>
    </div>`;
}

async function loadDocuments() {
  const container = document.getElementById('docs-container');
  if (!container) return;

  const category = container.dataset.category;
  if (!category) return;

  try {
    const res = await fetch(`/api/docs/${category}`);
    if (!res.ok) throw new Error('Falha na API');
    const docs = await res.json();

    // Atualiza contador
    const countEl = document.getElementById('docs-count');
    if (countEl) countEl.textContent = docs.length;

    if (docs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>Nenhum documento publicado ainda.</p>
        </div>`;
      return;
    }

    // Agrupa por ano
    const byYear = {};
    docs.forEach(doc => {
      const year = getYear(doc.uploadedAt);
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(doc);
    });

    const years = Object.keys(byYear).sort((a, b) => b - a);

    // Botões de filtro
    const filtersEl = document.getElementById('year-filters');
    if (filtersEl) {
      filtersEl.innerHTML = `<button class="year-btn active" data-year="all">Todos</button>` +
        years.map(y => `<button class="year-btn" data-year="${y}">${y}</button>`).join('');

      filtersEl.addEventListener('click', e => {
        const btn = e.target.closest('.year-btn');
        if (!btn) return;
        filtersEl.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterDocs(btn.dataset.year);
      });
    }

    // Renderiza todos os grupos
    container.innerHTML = years.map(year => `
      <div class="year-group" data-year-group="${year}">
        <div class="year-group-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${year}
        </div>
        <div class="docs-list">
          ${byYear[year].map(buildDocCard).join('')}
        </div>
      </div>`).join('');

  } catch (err) {
    container.innerHTML = '<p class="text-muted text-center" style="padding:2rem;">Erro ao carregar documentos. Tente novamente mais tarde.</p>';
  }
}

function filterDocs(year) {
  document.querySelectorAll('.year-group').forEach(el => {
    el.style.display = (year === 'all' || el.dataset.yearGroup === year) ? '' : 'none';
  });
}

loadDocuments();
