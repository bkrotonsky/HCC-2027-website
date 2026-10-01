/* ================================================================
   ENTRIES.JS — Vertical accordion for About & Challenges pages
   ================================================================ */
(function () {
  'use strict';

  document.querySelectorAll('.entry-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const targetId = trigger.dataset.target;
      const item = document.getElementById(targetId);
      if (!item) return;

      const isOpen = item.classList.contains('active');

      // Close all items
      document.querySelectorAll('.entry-item').forEach(el => el.classList.remove('active'));

      // If it wasn't open, open it and scroll to it
      if (!isOpen) {
        item.classList.add('active');
        setTimeout(() => {
          const top = item.getBoundingClientRect().top + window.scrollY - 90;
          window.scrollTo({ top, behavior: 'smooth' });
        }, 60);
      }
    });
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.entry-item').forEach(el => el.classList.remove('active'));
    }
  });

})();
