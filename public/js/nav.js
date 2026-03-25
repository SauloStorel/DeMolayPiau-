/* Carrega nav e footer via fetch e ativa comportamentos */
document.addEventListener('DOMContentLoaded', async () => {
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
      if (typeof updateCartBadge === 'function') updateCartBadge();
    }
    if (footerPlaceholder) {
      const res = await fetch('/partials/footer.html');
      footerPlaceholder.innerHTML = await res.text();
    }
  } catch (e) {
    console.warn('Erro ao carregar partials:', e);
  }
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
