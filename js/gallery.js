/* ================================================================
   GALLERY.JS - Article-style gallery

   TO PUBLISH A NEW POST: add an object to the POSTS list below.
     date    : 'YYYY-MM-DD'
     title   : headline
     excerpt : a short paragraph
     cover   : path to the cover image (drop the file in images/gallery/)
     alt     : short description of the image
     link    : (optional) URL for a "Read more" link
   Posts sort themselves newest first and group by month.

   Load this script BEFORE main.js so the scroll reveal picks up the posts.
   ================================================================ */
(function () {
  'use strict';

  var POSTS = [
    {
      date: '2026-10-24',
      title: 'Kickoff at NLR',
      excerpt: 'Placeholder excerpt. Summarize this activity in a few sentences: what the team did, who was involved, and what comes next.',
      cover: 'images/gallery/nlr-kickoff.jpeg',
      alt: 'The HCC27 team at the NLR kickoff'
    },
    {
      date: '2026-10-19',
      title: 'Ponderosa High School Outreach',
      excerpt: 'Placeholder excerpt. Summarize this activity in a few sentences: what the team did, who was involved, and what comes next.',
      cover: 'images/gallery/ponderosa-outreach.jpg',
      alt: 'Team at Ponderosa High School for a hydropower outreach activity'
    },
    {
      date: '2026-09-22',
      title: 'Power Your Future Career Expo (ASU)',
      excerpt: 'Placeholder excerpt. Summarize this activity in a few sentences: what the team did, who was involved, and what comes next.',
      cover: 'images/gallery/asu-career-expo.jpeg',
      alt: 'The HCC27 team at the Power Your Future Career Expo at ASU'
    }
  ];

  var feed = document.getElementById('gallery-feed');
  if (!feed) return;

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function parts(d) { var p = String(d).split('-'); return { y: +p[0], m: +p[1] - 1, d: +(p[2] || 1) }; }
  function pretty(d) { var p = parts(d); return MONTHS[p.m] + ' ' + p.d + ', ' + p.y; }

  /* build */
  var posts = POSTS.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  if (!posts.length) {
    feed.innerHTML = '<p class="gallery-empty">No posts yet. Check back soon.</p>';
    return;
  }

  var groups = [], byKey = {};
  posts.forEach(function (post) {
    var key = post.date.slice(0, 7);
    if (!byKey[key]) { byKey[key] = { key: key, posts: [] }; groups.push(byKey[key]); }
    byKey[key].posts.push(post);
  });

  feed.innerHTML = groups.map(function (g) {
    var p = parts(g.key + '-01');
    return '<section class="gallery-month">' +
      '<div class="month-rail"><div class="month-label"><div class="m">' + MONTHS[p.m] + '</div><div class="y">' + p.y + '</div></div></div>' +
      '<div class="month-posts">' +
      g.posts.map(function (post) {
        return '<article class="post reveal">' +
          '<div class="post-cover"><img src="' + esc(post.cover) + '" alt="' + esc(post.alt || post.title) + '" loading="lazy" /></div>' +
          '<time class="post-date" datetime="' + esc(post.date) + '">' + pretty(post.date) + '</time>' +
          '<h2>' + esc(post.title) + '</h2>' +
          '<p>' + esc(post.excerpt) + '</p>' +
          (post.link ? '<a class="post-link" href="' + esc(post.link) + '" target="_blank" rel="noopener">Read more</a>' : '') +
          '</article>';
      }).join('') +
      '</div></section>';
  }).join('');

  /* scroll progress bar + gentle cover parallax */
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var covers = Array.prototype.map.call(feed.querySelectorAll('.post-cover'), function (box) {
    return { box: box, img: box.querySelector('img') };
  });
  var ticking = false;

  function update() {
    ticking = false;
    var vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
    if (reduce) return;
    covers.forEach(function (c) {
      var r = c.box.getBoundingClientRect();
      if (r.bottom < -60 || r.top > vh + 60) return;
      var p = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2);
      p = Math.max(-1, Math.min(1, p));
      c.img.style.transform = 'translate3d(0,' + (-p * 0.07 * r.height).toFixed(1) + 'px,0)';
    });
  }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
})();