/* ================================================================
   NAU HCC27 - Shared JS
   ================================================================ */

(function () {
  'use strict';

  /* Nav scroll effect */
  const nav = document.querySelector('nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Active nav link */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href').split('/').pop();
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  /* Reveal on scroll */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    revealEls.forEach(el => observer.observe(el));
  }

  /* Hero stagger on load */
  const heroEls = document.querySelectorAll('.hero-anim');
  heroEls.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(28px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.9s cubic-bezier(0.22,1,0.36,1), transform 0.9s cubic-bezier(0.22,1,0.36,1)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 120 + i * 110);
  });

  /* Dynamic year */
  document.querySelectorAll('.current-year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  /* Home cards navigate */
  document.querySelectorAll('[data-href]').forEach(el => {
    if (el.classList.contains('doc-card')) return; // document cards are gated by admin.js
    el.addEventListener('click', () => {
      window.location.href = el.dataset.href;
    });
  });

  /* Image placeholders
     Every <img> on the site points at a placeholder path (images/...).
     Until a real file is dropped at that path, show a labeled placeholder
     that names the exact file to add. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function placeholderFor(src) {
    const label = String(src || 'image').split('/').slice(-3).join('/');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="800" height="600" fill="#e8edf5"/>' +
      '<path d="M0 430 L170 270 L300 370 L460 210 L800 440 L800 600 L0 600Z" fill="#c7d1e0"/>' +
      '<circle cx="610" cy="170" r="46" fill="#ffc72c" opacity=".85"/>' +
      '<text x="400" y="340" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="24" fill="#5b6b82">' + esc(label) + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function swapIfBroken(img) {
    if (img.dataset.placeholder) return;
    img.dataset.placeholder = '1';
    img.dataset.missingSrc = img.getAttribute('src') || '';
    img.src = placeholderFor(img.dataset.missingSrc);
  }
  document.querySelectorAll('img').forEach(img => {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) swapIfBroken(img);
    else img.addEventListener('error', () => swapIfBroken(img));
  });

})();
