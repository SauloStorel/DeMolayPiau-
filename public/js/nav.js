/* Carrega nav e footer via fetch e ativa comportamentos */
document.addEventListener('DOMContentLoaded', async () => {
  initPageTransitions();
  initScrollTop();
  initCounters();
  initScrollReveal();
  // Injeta nav
  const navPlaceholder = document.getElementById('nav-placeholder');
  const footerPlaceholder = document.getElementById('footer-placeholder');

  try {
    if (navPlaceholder) {
      const res = await fetch('/partials/nav.html');
      navPlaceholder.innerHTML = await res.text();
      initNav();
      updateCartBadgeNav();
    }
    if (footerPlaceholder) {
      const res = await fetch('/partials/footer.html');
      footerPlaceholder.innerHTML = await res.text();
    }
  } catch (e) {
    console.warn('Erro ao carregar partials:', e);
  }
});

function updateCartBadgeNav() {
  const CART_KEY = 'demolay_cart';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch {}

  const count = cart.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const total = cart.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 0), 0);
  const totalFmt = total > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)
    : '';

  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
  document.querySelectorAll('.cart-total-nav').forEach(el => {
    el.textContent = totalFmt;
  });
}

// Sincroniza badge quando outro tab altera o localStorage
window.addEventListener('storage', (e) => {
  if (e.key === 'demolay_cart') updateCartBadgeNav();
});

function initScrollTop() {
  window.addEventListener('scroll', () => {
    const btn = document.getElementById('scroll-top');
    if (btn) btn.classList.toggle('visible', window.scrollY > 300);
  });
}

function initCounters() {
  const targets = document.querySelectorAll('.stat-item h3[data-target]');
  if (!targets.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const duration = 1200;
      const start = performance.now();
      observer.unobserve(el);

      function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });

  targets.forEach(el => observer.observe(el));
}

function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children');
  if (!revealEls.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => observer.observe(el));
}

function initNav() {
  const nav = document.getElementById('site-nav');
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  if (!nav) return;

  // Marca link ativo
  const currentPath = window.location.pathname;
  nav.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
      a.classList.add('active');
    }
  });

  // Scroll effect
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });

  // Hamburguer
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      links.classList.toggle('open');
    });
  }

  // Dropdown mobile: clique abre/fecha
  nav.querySelectorAll('.nav-dropdown > a').forEach(a => {
    a.addEventListener('click', (e) => {
      if (window.innerWidth <= 900) {
        e.preventDefault();
        a.closest('.nav-dropdown').classList.toggle('open');
      }
    });
  });

  // Fecha menu ao clicar num link (mobile)
  nav.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', () => {
      if (window.innerWidth <= 900 && !a.closest('.nav-dropdown > a')) {
        toggle.classList.remove('open');
        links.classList.remove('open');
      }
    });
  });
}

function initPageTransitions() {
  // Intercepta cliques em links internos e anima a saída
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;

    const href = a.getAttribute('href');
    // Ignora: externos, âncoras, admin, javascript:, target=_blank
    if (
      !href ||
      href.startsWith('http') ||
      href.startsWith('//') ||
      href.startsWith('#') ||
      href.startsWith('javascript') ||
      href.startsWith('mailto') ||
      a.target === '_blank' ||
      href.startsWith('/admin')
    ) return;

    // Mesma página — ignora
    const dest = new URL(href, window.location.href);
    if (dest.pathname === window.location.pathname && !dest.search) return;

    e.preventDefault();
    document.body.classList.add('page-exit');
    setTimeout(() => { window.location.href = href; }, 280);
  });
}
