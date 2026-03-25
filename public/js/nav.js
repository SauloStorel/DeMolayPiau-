/* Carrega nav e footer via fetch e ativa comportamentos */
document.addEventListener('DOMContentLoaded', async () => {
  // Injeta nav
  const navPlaceholder = document.getElementById('nav-placeholder');
  const footerPlaceholder = document.getElementById('footer-placeholder');

  try {
    if (navPlaceholder) {
      const res = await fetch('/partials/nav.html');
      navPlaceholder.innerHTML = await res.text();
      initNav();
    }
    if (footerPlaceholder) {
      const res = await fetch('/partials/footer.html');
      footerPlaceholder.innerHTML = await res.text();
    }
  } catch (e) {
    console.warn('Erro ao carregar partials:', e);
  }
});

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
