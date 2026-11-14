/* Jinny Hyunjin Kim — personal site. Plain JS, no build step.
   Data: data/study.json (minutes per subject per day, synced from YPT),
         logs/index.json (daily notes, built from logs/*.md),
         posts/index.json (blog posts, built from posts/*.md). */
(function () {
  'use strict';

  var REPO = 'philosophyofeducation/philosophyofeducation.github.io';
  var app = document.getElementById('app');
  var D = { study: null, logs: [], posts: [] };
  var LOGS = {};        // date -> log
  var SUBJ = {};        // slug -> name
  var logState = { mode: 'month', anchor: null };

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pd(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function monday(d) { var x = new Date(d); var w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fmtDate(k, withYear) { var d = pd(k); return WD[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate() + (withYear ? ', ' + d.getFullYear() : ''); }
  function hm(m) { m = Math.round(m || 0); var h = Math.floor(m / 60), r = m % 60; return h + 'h ' + String(r).padStart(2, '0') + 'm'; }
  function hrs(m) { return (m / 60).toFixed(m >= 6000 ? 0 : 1) + 'h'; }
  function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function subjName(slug) { return SUBJ[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function md(text) {
    if (window.marked && window.DOMPurify) return DOMPurify.sanitize(marked.parse(text || ''));
    return '<p>' + esc(text).replace(/\n\n/g, '</p><p>') + '</p>';
  }
  function goal() { return D.study.goalMinutes || 300; }
  function dayMin(k) { var d = D.study.days[k]; if (!d) return 0; var t = 0; for (var s in d) t += d[s]; return t; }
  function todayKey() { return key(new Date()); }
  function isOwner() { try { return localStorage.getItem('owner') === '1'; } catch (e) { return false; } }
  function ghNew(folder, filename, value) {
    return 'https://github.com/' + REPO + '/new/main/' + folder + '?filename=' + encodeURIComponent(filename) + '&value=' + encodeURIComponent(value);
  }
  function logTemplate(k) { return '---\ndate: ' + k + '\n---\n\n## Subject name\n- What I covered\n> My own thought\n'; }
  function postTemplate(k) { return '---\ntitle: \ndate: ' + k + '\ncategory: essay\nsubjects: []\nsummary: \n---\n\nWrite here.\n'; }
  function sumRange(startKey, endKey) {
    var by = {}, total = 0, days = 0, met = 0, studied = 0;
    for (var d = pd(startKey); key(d) <= endKey; d = addDays(d, 1)) {
      var k = key(d), row = D.study.days[k] || {}, t = 0;
      for (var s in row) { by[s] = (by[s] || 0) + row[s]; t += row[s]; }
      total += t; days++; if (t > 0) studied++; if (t >= goal()) met++;
    }
    return { by: by, total: total, days: days, met: met, studied: studied };
  }
  function allDayKeys() { return Object.keys(D.study.days).sort(); }
  function streak() {
    var k = todayKey(), n = 0, d = pd(k);
    if (dayMin(k) < goal()) d = addDays(d, -1);
    while (dayMin(key(d)) >= goal()) { n++; d = addDays(d, -1); }
    return n;
  }
  function lifetime() { var t = 0; allDayKeys().forEach(function (k) { t += dayMin(k); }); return t; }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; }

  // ---------- charts ----------
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, a) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function barChart(box, items, opt) {
    opt = opt || {};
    function draw() {
      box.innerHTML = '';
      var tip = document.createElement('div'); tip.className = 'tip'; box.appendChild(tip);
      var W = Math.max(280, box.clientWidth || 600), H = opt.height || (W < 520 ? 200 : 240);
      var m = { t: 14, r: 6, b: 26, l: 34 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
      var maxV = Math.max(opt.goal || 0, 60, Math.max.apply(null, items.map(function (i) { return i.value; })));
      var maxH = Math.ceil(maxV / 60); if (maxH > 8) maxH = Math.ceil(maxH / 2) * 2;
      var step = maxH > 10 ? Math.ceil(maxH / 5) : (maxH > 6 ? 2 : 1);
      var y = function (v) { return m.t + ih - (v / 60) / maxH * ih; };
      var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opt.label || 'Study hours chart' });
      for (var h = 0; h <= maxH; h += step) {
        svg.appendChild(sv('line', { x1: m.l, x2: W - m.r, y1: y(h * 60), y2: y(h * 60), stroke: h === 0 ? '#111' : '#e2e2e2' }));
        var t = sv('text', { x: m.l - 6, y: y(h * 60) + 4, 'text-anchor': 'end' }); t.textContent = h + 'h'; svg.appendChild(t);
      }
      var bw = iw / items.length, every = items.length > 16 ? Math.ceil(items.length / 10) : 1;
      items.forEach(function (it, i) {
        var x = m.l + i * bw + bw * 0.16, w = Math.max(2, bw * 0.68);
        var hit = opt.goal && it.value >= opt.goal;
        var r = sv('rect', { x: x, y: y(it.value), width: w, height: Math.max(it.value ? 1.5 : 0, y(0) - y(it.value)), fill: it.dim ? '#c9c9c9' : (hit ? '#e1ad01' : '#111'), tabindex: 0 });
        if (it.onClick) { r.style.cursor = 'pointer'; r.addEventListener('click', it.onClick); r.addEventListener('keydown', function (e) { if (e.key === 'Enter') it.onClick(); }); }
        var txt = it.tip || (it.label + ': ' + hm(it.value));
        r.setAttribute('aria-label', txt);
        function show() {
          tip.textContent = txt; tip.style.opacity = 1;
          var sc = box.clientWidth / W, bx = (x + w / 2) * sc, by = y(it.value) * sc;
          tip.style.left = Math.min(Math.max(0, bx - tip.offsetWidth / 2), box.clientWidth - tip.offsetWidth) + 'px';
          tip.style.top = Math.max(0, by - 34) + 'px';
        }
        function hide() { tip.style.opacity = 0; }
        r.addEventListener('mouseenter', show); r.addEventListener('focus', show); r.addEventListener('mouseleave', hide); r.addEventListener('blur', hide);
        r.addEventListener('touchstart', show, { passive: true });
        svg.appendChild(r);
        if (i % every === 0 || i === items.length - 1) {
          var lt = sv('text', { x: x + w / 2, y: H - 8, 'text-anchor': 'middle' }); lt.textContent = it.label; svg.appendChild(lt);
        }
      });
      if (opt.goal) {
        svg.appendChild(sv('line', { x1: m.l, x2: W - m.r, y1: y(opt.goal), y2: y(opt.goal), stroke: '#e1ad01', 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
        var gl = sv('text', { x: W - m.r, y: y(opt.goal) - 6, 'text-anchor': 'end' }); gl.textContent = (opt.goal / 60) + 'h goal'; gl.setAttribute('fill', '#7d5f00'); svg.appendChild(gl);
      }
      box.insertBefore(svg, tip);
    }
    draw();
    box._redraw = draw;
  }
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { document.querySelectorAll('.chart').forEach(function (c) { if (c._redraw) c._redraw(); }); }, 150); });

  function breakdownHTML(by) {
    var rows = Object.keys(by).filter(function (s) { return by[s] > 0; }).sort(function (a, b) { return by[b] - by[a]; });
    if (!rows.length) return '<div class="empty-state">No study time recorded for this period.</div>';
    var max = by[rows[0]];
    return '<div class="breakdown">' + rows.map(function (s) {
      return '<div class="brow"><a href="#subject-' + esc(s) + '">' + esc(subjName(s)) + '</a><div class="bar"><span style="width:' + (by[s] / max * 100).toFixed(1) + '%"></span></div><span class="num" style="text-align:right">' + hm(by[s]) + '</span></div>';
    }).join('') + '</div>';
  }

  // ---------- log rendering ----------
  function logHTML(log, opts) {
    opts = opts || {};
    var mins = dayMin(log.date);
    var secs = log.sections.filter(function (s) { return !opts.only || s.slug === opts.only; });
    var compact = !!opts.hideEmpty;
    return '<article class="log' + (compact ? ' compact' : '') + '" id="log-' + esc(log.date) + '"><div class="when"><a href="#day-' + esc(log.date) + '">' + esc(fmtDate(log.date)) + '</a>' +
      '<span class="num muted">' + (mins ? hm(mins) : '') + '</span>' + (mins >= goal() ? '<span><span class="pill goal">5h goal met</span></span>' : '') + '</div>' +
      '<div class="sections">' + (compact ? '' : '<div class="pair head"><span class="kicker">What I covered</span><span class="kicker">My thoughts</span></div>') +
      secs.map(function (s) {
        var left = '<div><a class="subject-name" href="#subject-' + esc(s.slug) + '">' + esc(s.name) + '</a>' +
          (s.covered.length ? '<ul>' + s.covered.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
        var right = s.thoughts.length ? '<div class="thoughts">' + s.thoughts.map(function (t) { return '<p class="thought">' + esc(t) + '</p>'; }).join('') + '</div>'
          : (compact ? '' : '<div class="thoughts"><p class="thought empty">My thought on this goes here.</p></div>');
        return compact ? left + right : '<div class="pair">' + left + right + '</div>';
      }).join('') + (log.intro ? '<p class="muted">' + esc(log.intro) + '</p>' : '') + '</div></article>';
  }

  // ---------- views ----------
  function viewHome() {
    var tk = todayKey(), tmin = dayMin(tk), g = goal();
    var wk = sumRange(key(monday(pd(tk))), tk);
    var last7 = sumRange(key(addDays(pd(tk), -6)), tk);
    var life = lifetime(), lg = (D.study.lifetimeGoalHours || 10000) * 60;
    var latestLog = D.logs[0], posts = D.posts.slice(0, 3);
    var html = '<div class="view">' +
      '<section class="hero"><div style="display:grid;gap:16px"><span class="kicker">PhD student · Philosophy of Education</span>' +
      '<h1>I study how <em>words wound</em>, and what education can do about it.</h1>' +
      '<p class="lede">This is my notebook: a daily study log, the thoughts I keep by subject, and longer writing about what I read.</p>' +
      '<div class="btn-row"><a class="btn primary" href="#studylog">Open my study log →</a><a class="btn" href="#subjects">Thoughts by subject</a><a class="btn" href="#blog">Read the blog</a></div></div>' +
      '<div class="today-card"><span class="kicker">Today · ' + esc(fmtDate(tk)) + '</span><span class="big">' + hm(tmin) + '</span>' +
      '<div class="bar goal"><span style="width:' + Math.min(100, tmin / g * 100).toFixed(1) + '%"></span></div>' +
      '<span class="muted">' + (tmin >= g ? 'Goal met. Well done.' : hm(g - tmin) + ' to the 5-hour goal') + '</span>' +
      '<div class="chips"><span class="pill ' + (streak() ? 'goal' : 'soft') + '">' + (streak() ? streak() + '-day 5h streak' : 'Start a 5h streak today') + '</span><a class="pill" href="#day-' + tk + '">See today →</a></div></div></section>' +
      '<section><div class="tiles">' +
      '<div class="tile"><span class="label">This week</span><span class="value">' + hm(wk.total) + '</span><span class="sub">since Monday</span></div>' +
      '<div class="tile"><span class="label">7-day average</span><span class="value">' + hm(last7.total / 7) + '</span><span class="sub">per day</span></div>' +
      '<div class="tile"><span class="label">Days at 5h+</span><span class="value">' + last7.met + ' / 7</span><span class="sub">in the last week</span></div>' +
      '<div class="tile hl"><span class="label">Toward 10,000 hours</span><span class="value">' + (life / 60).toFixed(1) + 'h</span><div class="bar goal"><span style="width:' + Math.max(0.6, life / lg * 100).toFixed(2) + '%"></span></div><span class="sub">' + (life / lg * 100).toFixed(2) + '% of my PhD goal</span></div>' +
      '</div></section>' +
      '<section><div class="sec-head"><h2>The last 14 days</h2><a class="more" href="#studylog">Day · Week · Month · Year →</a></div><div class="chart" id="home-chart"></div></section>' +
      '<section class="two"><div><div class="sec-head"><h2>Latest log</h2><a class="more" href="#studylog">All logs →</a></div>' +
      (latestLog ? '<div class="log-list">' + logHTML(latestLog, { hideEmpty: true }) + '</div>' : '<div class="empty-state">No logs yet.</div>') + '</div>' +
      '<div><div class="sec-head"><h2>Latest writing</h2><a class="more" href="#blog">All posts →</a></div>' +
      (posts.length ? '<div class="post-list">' + posts.map(postItemHTML).join('') + '</div>' : '<div class="empty-state">No posts yet.</div>') + '</div></section>' +
      '<section><div class="sec-head"><h2>Explore</h2></div><div class="grid-cards">' +
      navCard('#studylog', 'Study Log', 'Hours by day, week, month and year, with what I covered each day.') +
      navCard('#subjects', 'Subjects', 'My own thoughts, gathered subject by subject.') +
      navCard('#blog', 'Blog', 'Longer pieces on what I read and think about.') +
      navCard('#research', 'Research', 'Hate speech, linguistic injury, and the task of education.') +
      '</div></section></div>';
    app.innerHTML = html;
    var items = [];
    for (var i = 13; i >= 0; i--) { (function (k) { var d = pd(k); items.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), value: dayMin(k), tip: fmtDate(k) + ': ' + hm(dayMin(k)), onClick: function () { location.hash = 'day-' + k; } }); })(key(addDays(pd(tk), -i))); }
    barChart(document.getElementById('home-chart'), items, { goal: goal(), label: 'Study hours, last 14 days' });
  }
  function navCard(href, title, text) { return '<a class="card" href="' + href + '"><h3>' + esc(title) + ' →</h3><p class="muted" style="margin:0">' + esc(text) + '</p></a>'; }

  function viewStudyLog() {
    var lk = allDayKeys(), first = lk[0] || todayKey();
    if (!logState.anchor) logState.anchor = todayKey();
    var a = pd(logState.anchor), mode = logState.mode, label, start, end, prevA, nextA;
    if (mode === 'day') { start = end = key(a); label = fmtDate(key(a), true); prevA = addDays(a, -1); nextA = addDays(a, 1); }
    else if (mode === 'week') { var mo = monday(a); start = key(mo); end = key(addDays(mo, 6)); label = MON[mo.getMonth()] + ' ' + mo.getDate() + ' – ' + MON[addDays(mo, 6).getMonth()] + ' ' + addDays(mo, 6).getDate(); prevA = addDays(mo, -7); nextA = addDays(mo, 7); }
    else if (mode === 'month') { var f = new Date(a.getFullYear(), a.getMonth(), 1); start = key(f); end = key(new Date(a.getFullYear(), a.getMonth() + 1, 0)); label = MONL[a.getMonth()] + ' ' + a.getFullYear(); prevA = new Date(a.getFullYear(), a.getMonth() - 1, 1); nextA = new Date(a.getFullYear(), a.getMonth() + 1, 1); }
    else { start = a.getFullYear() + '-01-01'; end = a.getFullYear() + '-12-31'; label = String(a.getFullYear()); prevA = new Date(a.getFullYear() - 1, 0, 1); nextA = new Date(a.getFullYear() + 1, 0, 1); }
    var tk = todayKey(), effEnd = end > tk ? tk : end;
    var sum = sumRange(start, effEnd < start ? start : effEnd);
    var canPrev = start > first, canNext = end < tk;
    var owner = isOwner();
    var html = '<div class="view"><section style="display:grid;gap:14px"><span class="kicker">Study Log</span><h1>Hours, and what I did with them.</h1></section>' +
      '<section style="display:grid;gap:20px"><div class="period"><div class="seg" role="group" aria-label="Period">' +
      ['month', 'week', 'day', 'year'].map(function (m) { return '<button type="button" data-mode="' + m + '" aria-pressed="' + (m === mode) + '">' + m.charAt(0).toUpperCase() + m.slice(1) + '</button>'; }).join('') +
      '</div><div class="stepper"><button type="button" id="prev" aria-label="Previous" ' + (canPrev ? '' : 'disabled') + '>←</button><span class="label">' + esc(label) + '</span><button type="button" id="next" aria-label="Next" ' + (canNext ? '' : 'disabled') + '>→</button><button type="button" class="btn" id="jump-today" style="width:auto;height:34px;padding:0 12px">Today</button></div></div>';
    if (mode === 'day') {
      var dm = dayMin(start), lg = LOGS[start];
      html += '<div class="tiles"><div class="tile ' + (dm >= goal() ? 'hl' : '') + '"><span class="label">Studied</span><span class="value">' + hm(dm) + '</span><div class="bar goal"><span style="width:' + Math.min(100, dm / goal() * 100) + '%"></span></div><span class="sub">' + (dm >= goal() ? '5h goal met' : Math.round(dm / goal() * 100) + '% of the 5h goal') + '</span></div>' +
        '<div class="tile"><span class="label">Subjects</span><span class="value">' + Object.keys(sum.by).length + '</span><span class="sub">touched today</span></div>' +
        '<div class="tile"><span class="label">Thoughts written</span><span class="value">' + (lg ? lg.sections.reduce(function (n, s) { return n + s.thoughts.length; }, 0) : 0) + '</span><span class="sub">in this day\'s log</span></div></div>' +
        '<div><div class="sec-head"><h2>By subject</h2></div>' + breakdownHTML(sum.by) + '</div><div><div class="sec-head"><h2>Notes</h2>' + (owner ? '<a class="more" href="' + ghNew('logs', start + '.md', logTemplate(start)) + '" target="_blank" rel="noopener">Write this log ↗</a>' : '') + '</div>' +
        (lg ? '<div class="log-list">' + logHTML(lg) + '</div>' : '<div class="empty-state">No notes for this day yet.</div>') + '</div>';
    } else {
      var avgDays = Math.max(1, sumRange(start, effEnd < start ? start : effEnd).days);
      html += '<div class="tiles"><div class="tile"><span class="label">Total</span><span class="value">' + hm(sum.total) + '</span><span class="sub">' + esc(label) + '</span></div>' +
        '<div class="tile"><span class="label">Daily average</span><span class="value">' + hm(sum.total / avgDays) + '</span><span class="sub">over ' + avgDays + ' day' + (avgDays > 1 ? 's' : '') + '</span></div>' +
        '<div class="tile ' + (sum.met ? 'hl' : '') + '"><span class="label">Days at 5h+</span><span class="value">' + sum.met + '</span><span class="sub">goal days</span></div>' +
        '<div class="tile"><span class="label">Days studied</span><span class="value">' + sum.studied + '</span><span class="sub">at least one session</span></div></div>';
      html += '<div id="period-vis"></div><div class="legend"><span><i style="background:#111"></i>Study time</span><span><i style="background:#e1ad01"></i>5-hour goal met</span>' + (mode === 'year' ? '' : '<span>Tap a day to open it</span>') + '</div>';
      html += '<div><div class="sec-head"><h2>By subject</h2></div>' + breakdownHTML(sum.by) + '</div>';
    }
    html += '</section>';
    // logs in period
    var inRange = D.logs.filter(function (l) { return l.date >= start && l.date <= end; });
    if (mode !== 'day') {
      html += '<section><div class="sec-head"><h2>Daily notes</h2>' + (owner ? '<a class="more" href="' + ghNew('logs', tk + '.md', logTemplate(tk)) + '" target="_blank" rel="noopener">Write today\'s log ↗</a>' : '') + '</div>' +
        (inRange.length ? '<div class="log-list">' + inRange.map(function (l) { return logHTML(l); }).join('') + '</div>' : '<div class="empty-state">No notes in this period.</div>') + '</section>';
    }
    html += '</div>';
    app.innerHTML = html;
    app.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { logState.mode = b.getAttribute('data-mode'); render(); }); });
    document.getElementById('prev').addEventListener('click', function () { logState.anchor = key(prevA); render(); });
    document.getElementById('next').addEventListener('click', function () { logState.anchor = key(nextA); render(); });
    document.getElementById('jump-today').addEventListener('click', function () { logState.anchor = tk; render(); });
    var vis = document.getElementById('period-vis');
    if (!vis) return;
    if (mode === 'week') {
      var items = [];
      for (var i = 0; i < 7; i++) { (function (k) { var d = pd(k); items.push({ label: WD[d.getDay()] + ' ' + d.getDate(), value: dayMin(k), dim: k > tk, tip: fmtDate(k) + ': ' + hm(dayMin(k)), onClick: function () { openDay(k); } }); })(key(addDays(pd(start), i))); }
      vis.className = 'chart'; barChart(vis, items, { goal: goal(), label: 'Study hours this week' });
    } else if (mode === 'month') {
      var f = pd(start), lead = (f.getDay() + 6) % 7, last = pd(end).getDate(), cells = '';
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (w) { cells += '<div class="dow">' + w + '</div>'; });
      for (var e = 0; e < lead; e++) cells += '<button type="button" class="empty" tabindex="-1" aria-hidden="true"></button>';
      for (var dd = 1; dd <= last; dd++) {
        var k = key(new Date(f.getFullYear(), f.getMonth(), dd)), v = dayMin(k);
        var cls = v >= goal() ? 'goal' : (v >= 180 ? 'l4' : v >= 120 ? 'l3' : v >= 60 ? 'l2' : v > 0 ? 'l1' : '');
        if (k === tk) cls += ' today';
        cells += '<button type="button" class="' + cls + '" data-day="' + k + '" aria-label="' + esc(fmtDate(k)) + ': ' + hm(v) + (LOGS[k] ? ', has notes' : '') + '"><span class="d">' + dd + (LOGS[k] ? ' ·' : '') + '</span><span class="m">' + (v ? (v / 60).toFixed(1) + 'h' : '') + '</span></button>';
      }
      vis.innerHTML = '<div class="cal">' + cells + '</div>';
      vis.querySelectorAll('[data-day]').forEach(function (b) { b.addEventListener('click', function () { openDay(b.getAttribute('data-day')); }); });
    } else if (mode === 'year') {
      var yr = pd(start).getFullYear(), its = [];
      for (var mth = 0; mth < 12; mth++) {
        (function (mi) {
          var s = key(new Date(yr, mi, 1)), en = key(new Date(yr, mi + 1, 0)); var r = sumRange(s, en > tk ? tk : en);
          its.push({ label: MON[mi], value: s > tk ? 0 : r.total / Math.max(1, r.days), dim: s > tk, tip: MONL[mi] + ': ' + hm(r.total) + ' total · ' + hm(s > tk ? 0 : r.total / Math.max(1, r.days)) + ' per day', onClick: function () { logState.mode = 'month'; logState.anchor = s; render(); } });
        })(mth);
      }
      vis.className = 'chart'; barChart(vis, its, { goal: goal(), label: 'Average daily study time by month' });
      vis.insertAdjacentHTML('beforebegin', '<p class="muted" style="margin:0">Bars show the average per day in each month.</p>');
    }
  }
  function openDay(k) { logState.mode = 'day'; logState.anchor = k; if (location.hash !== '#studylog') { location.hash = 'studylog'; } else { render(); } }

  function subjectStats() {
    var st = {};
    function get(s) { return st[s] || (st[s] = { slug: s, minutes: 0, days: 0, thoughts: [], covered: [], last: '' }); }
    allDayKeys().forEach(function (k) { var row = D.study.days[k]; for (var s in row) { var o = get(s); o.minutes += row[s]; if (row[s] > 0) { o.days++; if (k > o.last) o.last = k; } } });
    D.logs.forEach(function (l) { l.sections.forEach(function (sec) { var o = get(sec.slug); if (!SUBJ[sec.slug]) SUBJ[sec.slug] = sec.name; sec.thoughts.forEach(function (t) { o.thoughts.push({ date: l.date, text: t }); }); sec.covered.forEach(function (c) { o.covered.push({ date: l.date, text: c }); }); if (l.date > o.last) o.last = l.date; }); });
    Object.keys(SUBJ).forEach(get);
    return st;
  }

  function viewSubjects() {
    var st = subjectStats();
    var list = Object.keys(st).map(function (k) { return st[k]; }).sort(function (a, b) { return (b.last || '').localeCompare(a.last || '') || b.minutes - a.minutes; });
    app.innerHTML = '<div class="view"><section style="display:grid;gap:14px"><span class="kicker">Subjects</span><h1>What I think, subject by subject.</h1>' +
      '<p class="lede">Every thought I write in a daily log is collected here under its subject, so I can see how my thinking grows.</p></section>' +
      '<section class="grid-cards">' + list.map(function (s) {
        var latest = s.thoughts.length ? s.thoughts[s.thoughts.length - 1] : null;
        return '<a class="card" href="#subject-' + esc(s.slug) + '"><h3>' + esc(subjName(s.slug)) + '</h3><span class="stat">' + hrs(s.minutes) + '</span>' +
          '<div class="meta"><span>' + s.thoughts.length + ' thought' + (s.thoughts.length === 1 ? '' : 's') + '</span><span>' + s.covered.length + ' notes</span>' + (s.last ? '<span>last ' + esc(fmtDate(s.last)) + '</span>' : '<span>not started</span>') + '</div>' +
          (latest ? '<p class="excerpt" style="margin:0">' + esc(latest.text.length > 140 ? latest.text.slice(0, 140) + '…' : latest.text) + '</p>' : '') + '</a>';
      }).join('') + '</section></div>';
  }

  function viewSubject(slug) {
    var st = subjectStats()[slug] || { slug: slug, minutes: 0, days: 0, thoughts: [], covered: [], last: '' };
    var posts = D.posts.filter(function (p) { return p.subjects.indexOf(slug) !== -1; });
    var byDate = {}; st.covered.forEach(function (c) { (byDate[c.date] = byDate[c.date] || []).push(c.text); });
    var dates = Object.keys(byDate).sort().reverse();
    var owner = isOwner();
    app.innerHTML = '<div class="view"><section style="display:grid;gap:12px"><a class="kicker" href="#subjects" style="text-decoration:none">← All subjects</a><h1>' + esc(subjName(slug)) + '</h1></section>' +
      '<section class="tiles"><div class="tile"><span class="label">Total time</span><span class="value">' + hm(st.minutes) + '</span><span class="sub">all time</span></div>' +
      '<div class="tile"><span class="label">Days studied</span><span class="value">' + st.days + '</span><span class="sub">from the timer</span></div>' +
      '<div class="tile hl"><span class="label">My thoughts</span><span class="value">' + st.thoughts.length + '</span><span class="sub">collected below</span></div></section>' +
      '<section><div class="sec-head"><h2>Weekly hours</h2><span class="muted">last 8 weeks</span></div><div class="chart" id="subj-chart"></div></section>' +
      '<section class="two">' +
      '<div><div class="sec-head"><h2>What I covered</h2></div>' +
      (dates.length ? '<div class="log-list">' + dates.map(function (d) { return '<article class="log"><div class="when"><a href="#day-' + esc(d) + '">' + esc(fmtDate(d)) + '</a></div><ul style="margin:0">' + byDate[d].map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></article>'; }).join('') + '</div>' : '<div class="empty-state">Nothing logged yet.</div>') + '</div>' +
      '<div><div class="sec-head"><h2>My thoughts</h2>' + (owner ? '<a class="more" href="' + ghNew('logs', todayKey() + '.md', logTemplate(todayKey()).replace('Subject name', subjName(slug))) + '" target="_blank" rel="noopener">Add one ↗</a>' : '') + '</div>' +
      (st.thoughts.length ? st.thoughts.slice().reverse().map(function (t) { return '<div style="margin-bottom:14px"><a class="pill soft" href="#day-' + esc(t.date) + '">' + esc(fmtDate(t.date)) + '</a><p class="thought">' + esc(t.text) + '</p></div>'; }).join('') : '<div class="empty-state">No thoughts yet. In a daily log, write a line starting with &gt; under this subject.</div>') + '</div>' +
      '</section>' +
      (posts.length ? '<section><div class="sec-head"><h2>Related writing</h2></div><div class="post-list">' + posts.map(postItemHTML).join('') + '</div></section>' : '') + '</div>';
    var items = [], mo = monday(pd(todayKey()));
    for (var i = 7; i >= 0; i--) {
      var s = addDays(mo, -7 * i), t = 0;
      for (var j = 0; j < 7; j++) { var row = D.study.days[key(addDays(s, j))]; if (row && row[slug]) t += row[slug]; }
      items.push({ label: (s.getMonth() + 1) + '/' + s.getDate(), value: t, tip: 'Week of ' + MON[s.getMonth()] + ' ' + s.getDate() + ': ' + hm(t) });
    }
    barChart(document.getElementById('subj-chart'), items, { label: 'Weekly hours for ' + subjName(slug), height: 200 });
  }

  function postItemHTML(p) {
    return '<a class="post-item" href="#post-' + esc(p.slug) + '"><span class="muted num" style="font-size:.85rem">' + esc(p.date) + '<br>' + esc(p.category) + '</span><div style="display:grid;gap:6px"><h3>' + esc(p.title) + '</h3>' + (p.summary ? '<p class="muted" style="margin:0">' + esc(p.summary) + '</p>' : '') + '</div></a>';
  }

  var blogFilter = 'all';
  function viewBlog() {
    var cats = ['all'].concat(Array.from(new Set(D.posts.map(function (p) { return p.category; }))));
    var list = D.posts.filter(function (p) { return blogFilter === 'all' || p.category === blogFilter; });
    var owner = isOwner();
    app.innerHTML = '<div class="view"><section style="display:grid;gap:14px"><span class="kicker">Blog</span><h1>Writing</h1><p class="lede">Essays on what I read and notes in progress.</p>' +
      (owner ? '<div class="btn-row"><a class="btn accent" href="' + ghNew('posts', todayKey() + '-new-post.md', postTemplate(todayKey())) + '" target="_blank" rel="noopener">✎ Write a new post</a></div>' : '') + '</section>' +
      '<section><div class="filters" role="group" aria-label="Filter by category">' + cats.map(function (c) { return '<button type="button" data-cat="' + esc(c) + '" aria-pressed="' + (c === blogFilter) + '">' + esc(c.charAt(0).toUpperCase() + c.slice(1)) + '</button>'; }).join('') + '</div></section>' +
      '<section>' + (list.length ? '<div class="post-list">' + list.map(postItemHTML).join('') + '</div>' : '<div class="empty-state">No posts here yet.</div>') + '</section></div>';
    app.querySelectorAll('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { blogFilter = b.getAttribute('data-cat'); render(); }); });
  }

  function viewPost(slug) {
    var i = D.posts.findIndex(function (p) { return p.slug === slug; });
    if (i < 0) { app.innerHTML = '<div class="empty-state">That post could not be found. <a href="#blog">Back to the blog</a></div>'; return; }
    var p = D.posts[i], newer = D.posts[i - 1], older = D.posts[i + 1];
    app.innerHTML = '<article class="view"><header style="display:grid;gap:12px;max-width:68ch"><a class="kicker" href="#blog" style="text-decoration:none">← Blog</a><h1>' + esc(p.title) + '</h1>' +
      '<div class="chips"><span class="pill soft">' + esc(fmtDate(p.date, true)) + '</span><span class="pill soft">' + esc(p.category) + '</span>' + p.subjects.map(function (s) { return '<a class="pill" href="#subject-' + esc(s) + '">' + esc(subjName(s)) + '</a>'; }).join('') + '</div></header>' +
      '<div class="prose">' + md(p.body) + '</div>' +
      '<nav class="two" style="border-top:1px solid #111;padding-top:18px">' + (older ? '<a href="#post-' + esc(older.slug) + '" style="text-decoration:none"><span class="kicker">← Older</span><br><strong>' + esc(older.title) + '</strong></a>' : '<span></span>') +
      (newer ? '<a href="#post-' + esc(newer.slug) + '" style="text-decoration:none;text-align:right"><span class="kicker">Newer →</span><br><strong>' + esc(newer.title) + '</strong></a>' : '') + '</nav>' +
      (isOwner() ? '<p><a class="btn" href="https://github.com/' + REPO + '/edit/main/' + esc(p.file) + '" target="_blank" rel="noopener">Edit this post ↗</a></p>' : '') + '</article>';
    window.scrollTo(0, 0);
  }

  function cvRows(rows) {
    return '<div class="cv">' + rows.map(function (r) { return '<div class="cv-row"><span class="num muted">' + r[0] + '</span><div>' + r[1] + '</div></div>'; }).join('') + '</div>';
  }

  function viewResearch() {
    var interests = ['Philosophy of education', 'Hate speech and linguistic injury', 'Speech act theory and performativity', 'Subject formation and interpellation', 'Ethics of alterity, hospitality, and recognition', 'Democratic and political education', 'Memory, silencing, and educational responses to hate in post-authoritarian societies'];
    app.innerHTML = '<div class="view"><section style="display:grid;gap:14px"><span class="kicker">Research</span><h1>Language, power, and harm.</h1>' +
      '<p class="lede">I study the wound of hate speech and how education can respond to it, drawing on Austin, Butler, and Derrida.</p></section>' +
      '<section class="two"><div><div class="sec-head"><h2>Research interests</h2></div><div class="chips">' + interests.map(function (i) { return '<span class="pill">' + esc(i) + '</span>'; }).join('') + '</div>' +
      '<div class="sec-head" style="margin-top:32px"><h2>Thesis</h2></div><p style="margin:0"><strong>The Wound of Hate Speech and Educational Response: A Philosophical Inquiry via Judith Butler</strong><br><span class="muted">M.A. thesis, Seoul National University, 2026. Advisor: Duck-Joo Kwak</span></p>' +
      '<div class="chips" style="margin-top:24px">' + ['philosophy-of-language', 'philosophy-of-education', 'poststructuralism', 'psychoanalysis'].map(function (s) { return '<a class="pill soft" href="#subject-' + s + '">' + esc(subjName(s)) + ' →</a>'; }).join('') + '</div></div>' +
      '<div><div class="sec-head"><h2>Conference presentations</h2></div>' + cvRows([
        ['Aug 2026', '<strong>When words wound: Linguistic injury and the task of education</strong><br><span class="muted">20th International Network of Philosophers of Education (INPE) Conference, Université du Québec à Montréal, Canada</span>'],
        ['Aug 2026', '<strong>Commencing conversation through commensality: Openness, enjoyment, and hospitality in a divided world</strong> (round table, with H. Jeong and T. Kim)<br><span class="muted">20th INPE Conference, Montréal, Canada</span>'],
        ['Nov 2024', '<strong>Rethinking hate speech and identity: Limits of existing discourses and the need for a new educational approach</strong><br><span class="muted">60th Anniversary International Conference, Korean Philosophy of Education Society, Sungkyunkwan University, Seoul</span>'],
        ['Aug 2024', '<strong>How to interpret “community” for educational purposes</strong><br><span class="muted">Asian Link of Philosophy of Education (ALPE) Annual Seminar, National Chiayi University, Taiwan</span>']
      ]) + '<div class="sec-head" style="margin-top:32px"><h2>Other presentations</h2></div>' + cvRows([
        ['Jun 2025', '<strong>The subject in citation: Revisiting speech act theory from Austin to Derrida</strong><br><span class="muted">Graduate Seminar, Department of Education, Seoul National University</span>']
      ]) + '</div></section></div>';
  }

  function viewAbout() {
    app.innerHTML = '<div class="view"><section style="display:grid;gap:14px"><span class="kicker">About</span><h1>Hi, I\'m Jinny.</h1>' +
      '<p class="lede">I\'m Hyunjin (Jinny) Kim, a PhD student in Education Policy, Organization &amp; Leadership at the University of Illinois Urbana-Champaign, advised by Rebecca M. Taylor. Before coming here, I taught elementary school in Seoul, where I used picture books and creative writing to work with children on hate speech, discrimination, and identity.</p>' +
      '<div class="btn-row"><a class="btn primary" href="#research">Research →</a><a class="btn" href="#studylog">Study log</a><a class="btn" href="mailto:hk80@illinois.edu">hk80@illinois.edu</a></div></section>' +
      '<section class="two"><div><div class="sec-head"><h2>Education</h2></div>' + cvRows([
        ['2026–', '<strong>Ph.D., Education Policy, Organization &amp; Leadership</strong><br><span class="muted">University of Illinois Urbana-Champaign · Advisor: Rebecca M. Taylor</span>'],
        ['2026', '<strong>M.A., Foundations of Education (Philosophy of Education)</strong><br><span class="muted">Seoul National University · Advisor: Duck-Joo Kwak</span>'],
        ['2018', '<strong>B.Ed., Elementary Education</strong><br><span class="muted">Seoul National University of Education</span>']
      ]) + '<div class="sec-head" style="margin-top:32px"><h2>University teaching</h2></div>' + cvRows([
        ['2026', '<strong>Teaching Assistant, KOR 203: Intermediate Korean I</strong><br><span class="muted">Korean Language Program, East Asian Languages &amp; Cultures, UIUC</span>'],
        ['2023–24', '<strong>Speaking Lab Teaching Assistant, College English I</strong><br><span class="muted">Seoul National University · 3 semesters of weekly sessions on academic speaking, argumentation, and presentation</span>']
      ]) + '</div>' +
      '<div><div class="sec-head"><h2>Teaching in schools</h2></div>' + cvRows([
        ['2020–', '<strong>Elementary School Teacher</strong><br><span class="muted">Seoul Metropolitan Office of Education (on study leave since Sep 2026). Workshops with picture books and creative writing on hate speech, discrimination, and identity.</span>'],
        ['2021, 22', '<strong>Lead Teacher, Picturebook-based Citizenship Project</strong><br><span class="muted">Seoul Metropolitan Office of Education · grades 4–6, exploring love, hate, war, and solidarity</span>'],
        ['2018–20', '<strong>Contract Teacher and Part-Time Instructor</strong><br><span class="muted">Public elementary schools in Seoul and Gyeonggi Province</span>']
      ]) + '<div class="sec-head" style="margin-top:32px"><h2>Service</h2></div>' + cvRows([
        ['2019–20', '<strong>Teacher Community for Engagement on History, Democracy, and Justice</strong><br><span class="muted">Gyeonggi Provincial Office of Education · field experiences at sites of Korea\'s democratization history; forums on human rights and environmental justice</span>'],
        ['2016', '<strong>Delegate, Global Youth Exchange Program</strong><br><span class="muted">Ministry of Gender Equality and Family &amp; National Youth Policy Institute</span>']
      ]) + '</div></section></div>';
  }

  // ---------- router ----------
  var routes = { home: viewHome, studylog: viewStudyLog, subjects: viewSubjects, blog: viewBlog, research: viewResearch, about: viewAbout };
  function render() {
    var h = (location.hash || '#home').slice(1);
    if (h === 'owner') { try { localStorage.setItem('owner', '1'); } catch (e) {} location.replace('#home'); return; }
    if (h === 'guest') { try { localStorage.removeItem('owner'); } catch (e) {} location.replace('#home'); return; }
    var section = h;
    if (/^day-\d{4}-\d{2}-\d{2}$/.test(h)) { logState.mode = 'day'; logState.anchor = h.slice(4); section = 'studylog'; viewStudyLog(); }
    else if (h.indexOf('subject-') === 0) { section = 'subjects'; viewSubject(h.slice(8)); }
    else if (h.indexOf('post-') === 0) { var p = D.posts.find(function (x) { return x.slug === h.slice(5); }); section = 'blog'; viewPost(h.slice(5)); }
    else if (routes[h]) { routes[h](); }
    else { section = 'home'; viewHome(); }
    document.querySelectorAll('[data-nav]').forEach(function (a) { if (a.getAttribute('data-nav') === section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    ownerBar();
  }
  function ownerBar() {
    var bar = document.getElementById('owner-bar');
    if (!isOwner()) { bar.innerHTML = ''; return; }
    var tk = todayKey();
    bar.innerHTML = '<div class="owner-bar"><div class="shell"><strong>Owner mode</strong><a href="' + ghNew('logs', tk + '.md', logTemplate(tk)) + '" target="_blank" rel="noopener">Write today\'s log ↗</a><a href="' + ghNew('posts', tk + '-new-post.md', postTemplate(tk)) + '" target="_blank" rel="noopener">Write a post ↗</a><a href="https://github.com/' + REPO + '" target="_blank" rel="noopener">Repository ↗</a><a href="#guest">Leave owner mode</a></div></div>';
  }
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });

  function getJSON(p) { return fetch(p, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(p); return r.json(); }); }
  Promise.all([getJSON('data/study.json'), getJSON('logs/index.json').catch(function () { return []; }), getJSON('posts/index.json').catch(function () { return []; })])
    .then(function (res) {
      D.study = res[0]; D.logs = res[1]; D.posts = res[2];
      SUBJ = Object.assign({}, D.study.subjects || {});
      var byName = {}; Object.keys(SUBJ).forEach(function (k) { byName[SUBJ[k].toLowerCase()] = k; byName[k] = k; });
      D.logs.forEach(function (l) {
        LOGS[l.date] = l;
        l.sections.forEach(function (s) {
          var n = s.name.toLowerCase();
          if (byName[n]) s.slug = byName[n];
          else { var hit = Object.keys(SUBJ).find(function (k) { return n.indexOf(SUBJ[k].toLowerCase().split(':')[0]) === 0; }); if (hit) s.slug = hit; }
          if (!SUBJ[s.slug]) SUBJ[s.slug] = s.name;
        });
      });
      var up = D.study.updated ? new Date(D.study.updated) : null;
      document.getElementById('foot-updated').textContent = up ? 'Study time updated ' + MON[up.getMonth()] + ' ' + up.getDate() + ', ' + up.getFullYear() : '';
      render();
    })
    .catch(function () { app.innerHTML = '<div class="empty-state">The study data could not be loaded. Please refresh the page.</div>'; });
})();
