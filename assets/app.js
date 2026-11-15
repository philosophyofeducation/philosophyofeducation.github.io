/* Jinny Hyunjin Kim — personal site. Plain JS, no build step.
   Data: data/study.json (minutes per subject per day, synced from YPT),
         logs/index.json (daily notes, built from logs/*.md),
         posts/index.json (blog posts, built from posts/*.md). */
(function () {
  'use strict';

  var REPO = 'philosophyofeducation/philosophyofeducation.github.io';
  var app = document.getElementById('app');
  var D = { study: null, logs: [], posts: [], library: [], habits: { goals: {}, days: {} }, words: [] };
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
  var homeState = { month: null, sel: null };
  function viewHome() {
    var tk = todayKey(), g = goal();
    if (!homeState.sel) homeState.sel = tk;
    if (!homeState.month) homeState.month = tk.slice(0, 7);
    var life = lifetime(), lg = (D.study.lifetimeGoalHours || 10000) * 60;
    var mStart = homeState.month + '-01', md = pd(mStart), mEnd = key(new Date(md.getFullYear(), md.getMonth() + 1, 0));
    var month = sumRange(mStart, mEnd < tk ? mEnd : tk);
    var wkKeys = []; for (var d = monday(pd(tk)); key(d) <= tk; d = addDays(d, 1)) wkKeys.push(key(d));
    var hd = function (k) { return D.habits.days[k]; };
    var wakeAvg = avg(wkKeys.map(function (k) { return H('wake').val(k, hd(k)); }));
    var sleepAvg = avg(wkKeys.map(function (k) { return H('sleep').val(k, hd(k)); }));
    var exDays = wkKeys.filter(function (k) { var v = H('exercise').val(k, hd(k)); return v && v.length; }).length;
    var startAvg = avg(wkKeys.map(function (k) { return H('start').val(k); }));
    var words = D.words || [], got = words.filter(function (w) { return w.status === 'got it'; }).length;
    var wAdded = words.filter(function (w) { return w.date && w.date >= key(addDays(pd(tk), -6)); }).length;
    var reading = D.library.filter(function (x) { return x.status === 'reading'; }), done = D.library.filter(function (x) { return x.status === 'done'; }).length;
    var thoughtsN = D.logs.reduce(function (n, l) { return n + l.sections.reduce(function (m, s) { return m + s.thoughts.length; }, 0); }, 0);
    function stat(label, value, sub, href, hl) { return '<a class="stat' + (hl ? ' hl' : '') + '" href="' + href + '"><span class="label">' + label + '</span><span class="value">' + value + '</span><span class="sub">' + sub + '</span></a>'; }
    var html = '<div class="view">' +
      '<section class="home-head"><span class="kicker">PhD student · Philosophy of Education</span><h1>I study how <em>words wound</em>, and what education can do about it.</h1></section>' +
      '<section class="home-cal"><div class="hc-cal"><div class="hc-top"><button type="button" class="btn" data-hm="-1" aria-label="Previous month">←</button><h2>' + esc(md.toLocaleString('en-US', { month: 'long', year: 'numeric' })) + '</h2><button type="button" class="btn" data-hm="1" aria-label="Next month"' + (homeState.month >= tk.slice(0, 7) ? ' disabled' : '') + '>→</button></div>' +
      '<div class="cal big">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (x) { return '<span class="dow">' + x + '</span>'; }).join('') + calCells(mStart, mEnd, tk) + '</div>' +
      '<div class="legend hc-legend"><span><i style="background:#e1ad01"></i>5h+ studied</span><span><i style="background:#8f8f8f"></i>some study</span><span><i class="dotk"></i>wrote a thought</span><span>✓ habits on target</span></div></div>' +
      '<aside class="hc-day" id="hc-day" aria-live="polite"></aside></section>' +
      '<section><div class="sec-head"><h2>At a glance</h2></div><div class="stats">' +
      stat('Study · ' + esc(md.toLocaleString('en-US', { month: 'long' })), hm(month.total), month.met + ' days at 5h+', '#studylog') +
      stat('5h streak', streak() + (streak() === 1 ? ' day' : ' days'), 'in a row', '#studylog') +
      stat('Toward 10,000 hours', (life / 60).toFixed(1) + 'h', (life / lg * 100).toFixed(2) + '% of my PhD goal', '#studylog', true) +
      stat('Avg wake-up', tfmt(wakeAvg), 'this week · sleep ' + (sleepAvg == null ? '–' : sleepAvg.toFixed(1) + 'h'), '#habits') +
      stat('Avg study start', tfmt(startAvg), 'this week', '#habits') +
      stat('Exercise', exDays + ' / ' + ((D.habits.goals || {}).exerciseDaysPerWeek || 4), 'days this week', '#habits') +
      stat('★ Words I\'ve got', got + ' / ' + words.length, wAdded + ' added this week', '#words', true) +
      stat('Reading now', reading.length, done + ' finished', '#library') +
      stat('Thoughts', thoughtsN, 'in my own words', '#studylog') +
      '</div></section>' +
      '<section class="two"><div><div class="sec-head"><h2>Reading now</h2><a class="more" href="#library">Library →</a></div>' +
      (reading.length ? '<div class="post-list">' + reading.slice(0, 4).map(function (b) { return '<a class="post-item" href="#book-' + esc(b.id) + '"><span class="muted">' + esc(b.author.split(',')[0]) + '</span><h3>' + esc(b.title) + '</h3></a>'; }).join('') + '</div>' : '<div class="empty-state">Nothing on the desk.</div>') + '</div>' +
      '<div><div class="sec-head"><h2>Latest writing</h2><a class="more" href="#blog">All posts →</a></div>' +
      (D.posts.length ? '<div class="post-list">' + D.posts.slice(0, 3).map(postItemHTML).join('') + '</div>' : '<div class="empty-state">No posts yet.</div>') + '</div></section></div>';
    app.innerHTML = html;
    app.querySelectorAll('[data-hm]').forEach(function (bt) { bt.addEventListener('click', function () { var dd = pd(homeState.month + '-01'); dd.setMonth(dd.getMonth() + (+bt.getAttribute('data-hm'))); homeState.month = key(dd).slice(0, 7); viewHome(); }); });
    app.querySelectorAll('.cal.big [data-k]').forEach(function (bt) { bt.addEventListener('click', function () { homeState.sel = bt.getAttribute('data-k'); app.querySelectorAll('.cal.big [data-k]').forEach(function (x) { x.classList.toggle('sel', x === bt); x.setAttribute('aria-pressed', x === bt); }); drawDayPanel(homeState.sel); }); });
    drawDayPanel(homeState.sel);
  }
  function calCells(mStart, mEnd, tk) {
    var first = pd(mStart), pad = (first.getDay() + 6) % 7, out = '', g = goal();
    for (var i = 0; i < pad; i++) out += '<button type="button" class="empty" tabindex="-1" aria-hidden="true"></button>';
    for (var d = first; key(d) <= mEnd; d = addDays(d, 1)) {
      var k = key(d), m = dayMin(k), fut = k > tk;
      var lvl = m >= g ? 'goal' : (m >= 180 ? 'l3' : m >= 90 ? 'l2' : m > 0 ? 'l1' : '');
      var met = 0, rec = 0; if (!fut) HABITS.forEach(function (h) { if (h.id === 'hours') return; var c = habitCell(h, k); if (c.state !== 'none') { rec++; if (c.state === 'met') met++; } });
      var th = H('thought').val(k);
      out += '<button type="button" data-k="' + k + '" class="' + lvl + (k === tk ? ' today' : '') + (k === homeState.sel ? ' sel' : '') + (fut ? ' fut' : '') + '"' + (fut ? ' disabled' : '') + ' aria-pressed="' + (k === homeState.sel) + '" aria-label="' + esc(fmtDate(k)) + ': ' + hm(m) + '">' +
        '<span class="d">' + d.getDate() + (th ? '<i class="dotk"></i>' : '') + '</span>' + (m ? '<span class="m">' + (m / 60).toFixed(1) + 'h</span>' : '<span class="m"></span>') +
        (rec ? '<span class="hb">✓' + met + '<small>/' + rec + '</small></span>' : '') + '</button>';
    }
    return out;
  }
  function drawDayPanel(k) {
    var box = document.getElementById('hc-day'); if (!box) return;
    var m = dayMin(k), g = goal(), by = D.study.days[k] || {}, e = D.habits.days[k];
    var log = D.logs.find(function (l) { return l.date === k; });
    var habits = HABITS.map(function (h) { var c = habitCell(h, k); return c.state === 'none' ? '' : '<li class="' + c.state + '"><span class="sq"></span><span>' + esc(h.name) + '</span><span class="muted">' + esc(c.text) + '</span></li>'; }).join('');
    var meals = e && Array.isArray(e.meals) && e.meals.length ? e.meals.slice().sort(function (a, b) { return (tmin(a.time) || 0) - (tmin(b.time) || 0); }) : [];
    box.innerHTML = '<span class="kicker">' + (k === todayKey() ? 'Today' : 'Selected day') + '</span><h3>' + esc(fmtDate(k, true)) + '</h3>' +
      '<div class="hc-big">' + hm(m) + '</div><div class="bar goal"><span style="width:' + Math.min(100, m / g * 100).toFixed(1) + '%"></span></div>' +
      '<span class="muted">' + (m >= g ? '5-hour goal met' : hm(g - m) + ' short of 5 hours') + '</span>' +
      (m ? '<div class="hc-sec">' + breakdownHTML(by) + '</div>' : '') +
      (habits ? '<div class="hc-sec"><span class="w-lab">Habits</span><ul class="hc-habits">' + habits + '</ul></div>' : '') +
      (meals.length ? '<div class="hc-sec"><span class="w-lab">Meals</span><ul class="hc-meals">' + meals.map(function (x) { return '<li><span class="mt">' + (x.time ? tfmt(tmin(x.time)) : '') + '</span>' + esc(x.what || '') + '</li>'; }).join('') + '</ul></div>' : '') +
      (log ? '<div class="hc-sec"><span class="w-lab">What I covered</span><ul class="hc-cov">' + log.sections.map(function (s) { return s.covered.slice(0, 2).map(function (c) { return '<li><strong>' + esc(s.name) + '.</strong> ' + esc(c) + '</li>'; }).join(''); }).join('') + '</ul>' +
        log.sections.map(function (s) { return s.thoughts.map(function (t) { return '<p class="thought">' + esc(t) + '</p>'; }).join(''); }).join('') + '</div>' : '') +
      '<a class="btn" href="#day-' + k + '">Open this day in my Study Log →</a>';
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
    var html = '<div class="view"><section style="display:grid;gap:14px"><span class="kicker">Study Log</span><h1>Hours, and what I did with them.</h1>' + subNav('overview') + '</section>' +
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
    app.innerHTML = '<div class="view"><section style="display:grid;gap:14px"><span class="kicker">Study Log · Subject</span><h1>' + esc(subjName(slug)) + '</h1>' + subNav(slug) + '</section>' +
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

  function subNav(active) {
    var st = subjectStats();
    var order = Object.keys(SUBJ).filter(function (k) { return st[k] && (st[k].minutes > 0 || st[k].covered.length); });
    return '<nav class="subnav" aria-label="Study log sections"><a href="#studylog"' + (active === 'overview' ? ' aria-current="page"' : '') + '>Overview</a><span class="sep" aria-hidden="true"></span>' +
      order.map(function (k) { return '<a href="#subject-' + esc(k) + '"' + (active === k ? ' aria-current="page"' : '') + '>' + esc(subjName(k)) + '<span class="num">' + hrs(st[k].minutes) + '</span></a>'; }).join('') + '</nav>';
  }

  var STATUS = { reading: 'Reading', done: 'Done', 'to-read': 'To read' };
  var libFilter = 'all';
  function spineHeight(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 997; return 250 + (h % 5) * 12; }
  function viewLibrary() {
    var items = D.library.filter(function (b) { return libFilter === 'all' || b.status === libFilter; });
    var books = items.filter(function (b) { return b.kind === 'book'; }), papers = items.filter(function (b) { return b.kind !== 'book'; });
    var counts = { reading: 0, done: 0, 'to-read': 0 }; D.library.forEach(function (b) { counts[b.status] = (counts[b.status] || 0) + 1; });
    app.innerHTML = '<div class="view"><section style="display:grid;gap:14px"><span class="kicker">Library</span><h1>What I\'m reading.</h1>' +
      '<div class="filters" role="group" aria-label="Filter by status">' + ['all', 'reading', 'done', 'to-read'].map(function (f) { return '<button type="button" data-lf="' + f + '" aria-pressed="' + (f === libFilter) + '">' + (f === 'all' ? 'All' : STATUS[f]) + ' <span class="num">' + (f === 'all' ? D.library.length : (counts[f] || 0)) + '</span></button>'; }).join('') + '</div>' +
      '<div class="legend"><span><i style="background:#e1ad01"></i>Reading</span><span><i style="background:#111"></i>Done</span><span><i style="background:#fff;border:1px solid #111"></i>To read</span></div></section>' +
      '<section><div class="sec-head"><h2>Books</h2><span class="muted">' + books.length + '</span></div>' +
      (books.length ? '<div class="shelf">' + books.map(function (b) {
        var who = b.author.split(',')[0].split(' (')[0];
        return '<a class="book s-' + b.status + '" href="#book-' + esc(b.id) + '" style="--h:' + spineHeight(b.title) + 'px" aria-label="' + esc(b.title + ' by ' + b.author + ', ' + STATUS[b.status]) + '">' +
          '<span class="spine" aria-hidden="true"><span class="t">' + esc(b.title) + '</span><span class="a">' + esc(who) + '</span></span>' +
          '<span class="cover" aria-hidden="true"><span class="c-top"><span>' + esc(STATUS[b.status]) + '</span><span>' + esc(b.year || '') + '</span></span>' +
          '<span class="c-title">' + esc(b.title) + '</span>' + (b.subtitle ? '<span class="c-sub">' + esc(b.subtitle) + '</span>' : '') +
          '<span class="c-rule"></span><span class="c-author">' + esc(b.author) + '</span>' + (b.venue ? '<span class="c-pub">' + esc(b.venue) + '</span>' : '') + '</span></a>';
      }).join('') + '</div>' : '<div class="empty-state">No books here.</div>') + '</section>' +
      '<section><div class="sec-head"><h2>Papers &amp; chapters</h2><span class="muted">' + papers.length + '</span></div>' +
      (papers.length ? '<div class="papers">' + papers.map(function (b) {
        return '<a class="paper s-' + b.status + '" href="#book-' + esc(b.id) + '"><span class="band"><span>' + esc(b.year) + ' · ' + esc(KIND[b.kind] || '') + '</span><span>' + STATUS[b.status] + '</span></span><span class="pt">' + esc(b.title) + '</span><span class="pa">' + esc(b.author) + '</span><span class="pv">' + esc(b.venue || '') + '</span></a>';
      }).join('') + '</div>' : '<div class="empty-state">No papers here.</div>') + '</section></div>';
    app.querySelectorAll('[data-lf]').forEach(function (b) { b.addEventListener('click', function () { libFilter = b.getAttribute('data-lf'); render(); }); });
  }
  var KIND = { book: 'Book', paper: 'Article', chapter: 'Chapter', entry: 'Encyclopedia' };
  function viewBook(id) {
    var b = D.library.find(function (x) { return x.id === id; });
    if (!b) { app.innerHTML = '<div class="empty-state">That item is not on the shelf. <a href="#library">Back to the library</a></div>'; return; }
    var ov = b.overview, H = '';
    H += '<article class="view"><header class="note-head"><a class="kicker" href="#library" style="text-decoration:none">← Library</a>' +
      '<span class="kicker">' + esc(KIND[b.kind] || 'Reading') + (b.part ? ' · ' + esc(b.part) : '') + '</span><h1>' + esc(b.title) + '</h1>' +
      (b.subtitle ? '<p class="lede" style="margin:0">' + esc(b.subtitle) + '</p>' : '') +
      '<p class="byline"><strong>' + esc(b.author) + '</strong> · ' + esc(b.year) + (b.venue ? ' · <span class="muted">' + esc(b.venue) + '</span>' : '') + '</p>' +
      '<div class="chips"><span class="pill ' + (b.status === 'reading' ? 'goal' : '') + '">' + STATUS[b.status] + '</span>' +
      (b.dateRead ? '<span class="pill soft">read ' + esc(fmtDate(b.dateRead, true)) + '</span>' : '') +
      (b.subject ? '<a class="pill" href="#subject-' + esc(b.subject) + '">' + esc(subjName(b.subject)) + ' →</a>' : '') +
      (b.keywords || []).map(function (k) { return '<span class="pill soft">' + esc(k) + '</span>'; }).join('') + '</div>' +
      (b.note ? '<p class="muted" style="margin:0">' + esc(b.note) + '</p>' : '') +
      (isOwner() && b.sources ? '<div class="chips">' + b.sources.map(function (s) { return '<a class="pill soft" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + ' ↗</a>'; }).join('') + '</div>' : '') + '</header>';
    if (!ov && !b.map) {
      H += '<div class="empty-state">On my list to read. Notes will appear here once I start.</div></article>';
      app.innerHTML = H; window.scrollTo(0, 0); return;
    }
    if (ov) {
      H += '<section class="ov">' + (ov.question ? '<div><span class="kicker">The question</span><p class="ov-q">' + esc(ov.question) + '</p></div>' : '') +
        '<div><span class="kicker">The answer, in short</span><ol class="ov-c">' + (ov.claim || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ol>' +
        (ov.stance ? '<p class="muted" style="margin:10px 0 0">' + esc(ov.stance) + '</p>' : '') + '</div></section>';
    }
    var main = '';
    if (b.map) {
      main += '<section><div class="sec-head"><h2>Reading map</h2><span class="muted">' + b.map.length + ' parts</span></div><ol class="rmap">' + b.map.map(function (m, i) {
        return '<li><span class="rn num">' + String(i + 1).padStart(2, '0') + '</span><div class="rb"><div class="rt"><strong>' + esc(m.title) + '</strong>' + (m.pages ? '<span class="pp num">pp. ' + esc(m.pages) + '</span>' : '') + '</div>' +
          (m.q ? '<p class="rq">' + esc(m.q) + '</p>' : '') + (m.gist ? '<p>' + esc(m.gist) + '</p>' : '') +
          (m.sub ? '<ul>' + m.sub.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div></li>';
      }).join('') + '</ol></section>';
    }
    (b.tables || []).forEach(function (t) {
      main += '<section><div class="sec-head"><h2>' + esc(t.title) + '</h2></div><div class="tscroll"><table class="ntable"><thead><tr>' + t.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        t.rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return i === 0 ? '<th scope="row">' + esc(c) + '</th>' : '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
        (t.note ? '<p class="muted" style="font-size:.85rem;margin:8px 0 0">' + esc(t.note) + '</p>' : '') + '</section>';
    });
    if (b.concepts) {
      main += '<section><div class="sec-head"><h2>Key concepts</h2><span class="muted">' + b.concepts.length + '</span></div><div class="concepts">' + b.concepts.map(function (c) {
        return '<div class="concept"><dt>' + esc(c[0]) + '</dt><dd>' + esc(c[1]) + '</dd></div>';
      }).join('') + '</div></section>';
    }
    if (b.quotes) {
      main += '<section><div class="sec-head"><h2>Lines I keep</h2></div>' + b.quotes.map(function (q) { return '<blockquote class="kq">“' + esc(q.text) + '”<cite>p. ' + esc(q.page) + '</cite></blockquote>'; }).join('') + '</section>';
    }
    var side = '';
    side += '<div class="sec-head"><h2>My thoughts</h2></div>' + ((b.mine && b.mine.length) ? b.mine.map(function (t) { return '<p class="thought">' + esc(t) + '</p>'; }).join('') : '<p class="thought empty">My thoughts on this go here.</p>');
    if (b.questions && b.questions.length) side += '<h3 class="side-h">Questions I have</h3>' + b.questions.map(function (t) { return '<p class="thought q">' + esc(t) + '</p>'; }).join('');
    if (b.related && b.related.length) side += '<h3 class="side-h">Connections</h3><ul class="side-list">' + b.related.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    if (b.next && b.next.length) side += '<h3 class="side-h">Next</h3><ul class="side-list check">' + b.next.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    H += '<div class="note-grid"><div class="note-main">' + main + '</div><aside class="note-side">' + side + '</aside></div></article>';
    app.innerHTML = H;
    window.scrollTo(0, 0);
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


  // ---------- habits ----------
  function tmin(t) { if (!t) return null; var p = String(t).split(':'); return +p[0] * 60 + (+p[1] || 0); }
  function tfmt(m) { if (m == null) return '–'; m = Math.round(m); var h = Math.floor(m / 60) % 24, r = m % 60, ap = h < 12 ? 'am' : 'pm'; return ((h + 11) % 12 + 1) + ':' + String(r).padStart(2, '0') + ap; }
  function avg(a) { a = a.filter(function (v) { return v != null; }); return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function isWeekend(k) { var w = pd(k).getDay(); return w === 0 || w === 6; }
  function sleepHours(e) { if (!e || !e.bed || !e.wake) return null; return ((tmin(e.wake) - tmin(e.bed) + 1440) % 1440) / 60; }
  var HABITS = [
    { id: 'wake', name: 'Woke up', val: function (k, e) { return e && e.wake ? tmin(e.wake) : null; }, show: tfmt,
      met: function (v, g) { return g.wake ? v <= tmin(g.wake) : true; }, goal: function (g) { return g.wake ? 'by ' + tfmt(tmin(g.wake)) : ''; } },
    { id: 'sleep', name: 'Slept', val: function (k, e) { return sleepHours(e); }, show: function (v) { return v == null ? '–' : v.toFixed(1) + 'h'; },
      met: function (v, g) { return v >= (g.sleepHours || 0); }, goal: function (g) { return g.sleepHours ? g.sleepHours + 'h+' : ''; } },
    { id: 'start', name: 'Started studying', val: function (k) { var t = (D.study.starts || {})[k]; return t ? tmin(t) : null; }, show: tfmt,
      met: function (v, g) { return g.studyStart ? v <= tmin(g.studyStart) : true; }, goal: function (g) { return g.studyStart ? 'by ' + tfmt(tmin(g.studyStart)) + ' · from YPT' : 'from YPT'; } },
    { id: 'hours', name: 'Studied 5h+', val: function (k) { var ks = Object.keys(D.study.days).sort(); if (!ks.length || k < ks[0] || k > todayKey()) return null; var d = D.study.days[k] || {}, m = 0; for (var x in d) m += d[x]; if (k === todayKey() && m < (D.habits.goals.studyMinutes || 300)) return null; return m; }, show: function (v) { return v == null ? '–' : hm(v); },
      met: function (v, g) { return v >= (g.studyMinutes || 300); }, goal: function (g) { return hm(g.studyMinutes || 300) + '+ · from YPT'; } },
    { id: 'phone', name: 'Phone while studying', val: function (k) { var a = (D.study.appMinutes || {})[k]; return a == null ? null : a; }, show: function (v) { return v == null ? '–' : v + ' min'; },
      met: function (v, g) { return v <= (g.phoneMaxMinutes || 30); }, goal: function (g) { return 'under ' + (g.phoneMaxMinutes || 30) + ' min · from YPT'; } },
    { id: 'vocab', name: 'Vocabulary Builder', val: function (k, e) { return e && typeof e.vocabBuilder === 'boolean' ? e.vocabBuilder : null; }, show: function (v) { return v == null ? '–' : (v ? 'done' : 'skipped'); },
      met: function (v) { return v; }, goal: function () { return 'every day'; } },
    { id: 'analytic', name: 'Analytic philosophy', val: function (k, e) { return e && typeof e.analytic === 'boolean' ? e.analytic : null; }, show: function (v) { return v == null ? '–' : (v ? 'read' : 'skipped'); },
      met: function (v) { return v; }, goal: function () { return 'every day'; } },
    { id: 'thought', name: 'Wrote a thought', val: function (k) { var l = D.logs.find(function (x) { return x.date === k; }); if (!l) return null; return l.sections.reduce(function (n, s) { return n + s.thoughts.length; }, 0); }, show: function (v) { return v == null ? '–' : (v ? v + ' in my own words' : 'covered only'); },
      met: function (v) { return v > 0; }, goal: function () { return 'in my Study Log' } },
    { id: 'exercise', name: 'Exercised', val: function (k, e) { return e && Array.isArray(e.exercise) ? e.exercise : null; }, show: function (v) { return v == null ? '–' : (v.length ? v.join(', ') : 'rest day'); },
      met: function (v) { return v.length > 0; }, goal: function (g) { return g.exerciseDaysPerWeek ? g.exerciseDaysPerWeek + ' days a week' : ''; } },
    { id: 'food', name: 'No processed food', val: function (k, e) { if (e && typeof e.processed === 'boolean') return e.processed; if (e && Array.isArray(e.meals) && e.meals.length) return e.meals.some(function (m) { return m.processed; }); return null; }, show: function (v, k) { return v == null ? '–' : (v ? (isWeekend(k) ? 'weekend treat' : 'had some') : 'clean'); },
      met: function (v, g, k) { return !v || isWeekend(k); }, goal: function () { return 'weekdays clean, weekend treats OK'; } },
    { id: 'fast', name: 'Fasted', val: function (k, e) { if (e && e.fastHours != null) return +e.fastHours; return mealFast(k); }, show: function (v) { return v == null ? '–' : v + 'h'; },
      met: function (v, g) { return v >= (g.fastHours || 0); }, goal: function (g) { return g.fastHours ? g.fastHours + 'h+' : ''; } }
  ];
  function mealTimes(k) { var e = D.habits.days[k]; return e && Array.isArray(e.meals) ? e.meals.map(function (m) { return tmin(m.time); }).filter(function (t) { return t != null; }).sort(function (a, b) { return a - b; }) : []; }
  function mealFast(k) {
    var today = mealTimes(k), prev = mealTimes(key(addDays(pd(k), -1)));
    if (!today.length || !prev.length) return null;
    var last = prev[prev.length - 1], first = today[0];
    if (last < 300) last += 1440; // a meal after midnight belongs to the previous day
    return Math.round((first + 1440 - last) / 6) / 10;
  }
  function H(id) { return HABITS.find(function (x) { return x.id === id; }); }
  function habitCell(h, k) {
    var e = D.habits.days[k], g = D.habits.goals || {}, v = h.val(k, e);
    if (v == null) return { state: 'none', text: 'no record' };
    return { state: h.met(v, g, k) ? 'met' : 'miss', text: h.show(v, k), v: v };
  }
  function timeChart(box, keys, series, opt) {
    function draw() {
      box.innerHTML = '';
      var tip = document.createElement('div'); tip.className = 'tip'; box.appendChild(tip);
      var W = Math.max(280, box.clientWidth || 600), H = W < 520 ? 210 : 250, m = { t: 14, r: 8, b: 26, l: 52 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
      var vals = []; series.forEach(function (s) { keys.forEach(function (k) { var v = s.get(k); if (v != null) vals.push(v); }); if (s.goal != null) vals.push(s.goal); });
      var lo = Math.floor(((vals.length ? Math.min.apply(null, vals) : 360) - 30) / 60) * 60, hi = Math.ceil(((vals.length ? Math.max.apply(null, vals) : 720) + 30) / 60) * 60;
      var span = hi - lo, step = span > 600 ? 180 : (span > 300 ? 120 : 60);
      var y = function (v) { return m.t + (v - lo) / span * ih; };
      var x = function (i) { return m.l + (i + 0.5) * iw / keys.length; };
      var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opt.label });
      for (var t = lo; t <= hi; t += step) { svg.appendChild(sv('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: '#e2e2e2' })); var tx = sv('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }); tx.textContent = tfmt(t); svg.appendChild(tx); }
      var every = Math.ceil(keys.length / 10);
      keys.forEach(function (k, i) { if (i % every === 0 || i === keys.length - 1) { var d = pd(k), lt = sv('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }); lt.textContent = (d.getMonth() + 1) + '/' + d.getDate(); svg.appendChild(lt); } });
      series.forEach(function (s) {
        if (s.goal != null) svg.appendChild(sv('line', { x1: m.l, x2: W - m.r, y1: y(s.goal), y2: y(s.goal), stroke: s.color, 'stroke-width': 1.5, 'stroke-dasharray': '6 4', opacity: 0.8 }));
        var pts = []; keys.forEach(function (k, i) { var v = s.get(k); if (v != null) pts.push([x(i), y(v), k, v]); });
        if (pts.length > 1) svg.appendChild(sv('polyline', { points: pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 1.5, opacity: 0.55 }));
        pts.forEach(function (p) {
          var c = sv('circle', { cx: p[0], cy: p[1], r: 4.5, fill: s.color, stroke: '#fff', 'stroke-width': 1.5, tabindex: 0 });
          var txt = s.name + ' · ' + fmtDate(p[2]) + ': ' + tfmt(p[3]); c.setAttribute('aria-label', txt);
          function show() { tip.textContent = txt; tip.style.opacity = 1; var sc = box.clientWidth / W; tip.style.left = Math.min(Math.max(0, p[0] * sc - tip.offsetWidth / 2), box.clientWidth - tip.offsetWidth) + 'px'; tip.style.top = Math.max(0, p[1] * sc - 36) + 'px'; }
          function hide() { tip.style.opacity = 0; }
          c.addEventListener('mouseenter', show); c.addEventListener('focus', show); c.addEventListener('mouseleave', hide); c.addEventListener('blur', hide); c.addEventListener('touchstart', show, { passive: true });
          svg.appendChild(c);
        });
      });
      box.insertBefore(svg, tip);
    }
    draw(); box._redraw = draw;
  }
  function mealsHTML(keys) {
    var days = keys.slice().reverse().filter(function (k) { var e = D.habits.days[k]; return e && Array.isArray(e.meals) && e.meals.length; }).slice(0, 7);
    if (!days.length) return '<section><div class="sec-head"><h2>Meals</h2><span class="muted">what I ate, day by day</span></div><p class="muted">Meal entries start now.</p></section>';
    return '<section><div class="sec-head"><h2>Meals</h2><span class="muted">the last 7 days with entries</span></div><div class="meals">' + days.map(function (k) {
      var e = D.habits.days[k], f = H('fast').val(k, e);
      var ms = e.meals.slice().sort(function (a, b) { return (tmin(a.time) || 0) - (tmin(b.time) || 0); });
      return '<article class="mday"><header><strong>' + esc(fmtDate(k)) + '</strong>' + (f != null ? '<span class="muted">fasted ' + f + 'h</span>' : '') + '</header><ul>' +
        ms.map(function (m) { return '<li><span class="mt">' + (m.time ? tfmt(tmin(m.time)) : '') + '</span><span class="mw">' + esc(m.what || '') + (m.processed ? ' <span class="pill">processed</span>' : '') + '</span></li>'; }).join('') +
        '</ul>' + (e.mealNote ? '<p class="mnote">' + esc(e.mealNote) + '</p>' : '') + '</article>';
    }).join('') + '</div></section>';
  }
  function viewHabits() {
    var tk = todayKey(), g = D.habits.goals || {}, N = 28, keys = [];
    for (var i = N - 1; i >= 0; i--) keys.push(key(addDays(pd(tk), -i)));
    var wkKeys = []; for (var d = monday(pd(tk)); key(d) <= tk; d = addDays(d, 1)) wkKeys.push(key(d));
    function weekVals(id) { var h = HABITS.find(function (x) { return x.id === id; }); return wkKeys.map(function (k) { return h.val(k, D.habits.days[k]); }); }
    var exDays = weekVals('exercise').filter(function (v) { return v && v.length; }).length;
    var foodRec = wkKeys.filter(function (k) { return habitCell(H('food'), k).state !== 'none'; });
    var clean = foodRec.filter(function (k) { return habitCell(H('food'), k).state === 'met'; }).length;
    var aFast = avg(weekVals('fast')), aSleep = avg(weekVals('sleep'));
    // streak: consecutive recorded days ending today/yesterday where every recorded habit was met
    var owner = isOwner(), any = Object.keys(D.habits.days || {}).length;
    function tile(label, value, sub, hl) { return '<div class="tile' + (hl ? ' hl' : '') + '"><span class="label">' + label + '</span><span class="value">' + value + '</span><span class="sub">' + sub + '</span></div>'; }
    var html = '<div class="view"><section style="display:grid;gap:14px"><span class="kicker">Habits</span><h1>Small things, every day.</h1>' +
      '<div class="legend"><span><i style="background:#e1ad01"></i>On target</span><span><i style="background:#fff;border:1.5px solid #111"></i>Recorded, off target</span><span><i style="background:#ececec"></i>No record</span></div>' +
      (owner ? '<div class="btn-row"><a class="btn accent" href="https://github.com/' + REPO + '/edit/main/data/habits.json" target="_blank" rel="noopener">✎ Edit habits</a></div>' : '') + '</section>' +
      '<section><div class="sec-head"><h2>This week</h2><span class="muted">since Monday</span></div><div class="tiles">' +
      tile('Avg wake-up', tfmt(avg(weekVals('wake'))), g.wake ? 'goal: by ' + tfmt(tmin(g.wake)) : '') +
      tile('Avg sleep', aSleep == null ? '–' : aSleep.toFixed(1) + 'h', g.sleepHours ? 'goal: ' + g.sleepHours + 'h+' : '') +
      tile('Avg study start', tfmt(avg(weekVals('start'))), (g.studyStart ? 'goal: by ' + tfmt(tmin(g.studyStart)) + ' · ' : '') + 'from YPT') +
      tile('Avg study / day', hm(avg(weekVals('hours')) || 0), 'goal: ' + hm(g.studyMinutes || 300) + '+ · from YPT') +
      tile('Phone while studying', (function () { var a = avg(weekVals('phone')); return a == null ? '–' : Math.round(a) + ' min'; })(), 'daily avg · goal: under ' + (g.phoneMaxMinutes || 30) + ' min') +
      tile('Exercise days', exDays + ' / ' + (g.exerciseDaysPerWeek || 7), 'this week', exDays >= (g.exerciseDaysPerWeek || 99)) +
      tile('Clean-eating days', foodRec.length ? clean + ' / ' + foodRec.length : '–', 'days recorded, weekend treats OK') +
      tile('Avg fasting', aFast == null ? '–' : aFast.toFixed(1) + 'h', g.fastHours ? 'goal: ' + g.fastHours + 'h+' : '') +
      '</div></section>' +
      '<section><div class="sec-head"><h2>The last 4 weeks</h2><span class="muted">hover a square for the details</span></div>' +
      '<div class="hgrid-wrap"><table class="hgrid"><thead><tr><th></th>' + keys.map(function (k) { var d = pd(k); return '<th class="' + (k === tk ? 'today' : '') + (d.getDay() === 1 ? ' mon' : '') + '" title="' + esc(fmtDate(k)) + '"><span>' + (d.getDay() === 1 ? (d.getMonth() + 1) + '/' + d.getDate() : '') + '</span></th>'; }).join('') + '</tr></thead><tbody>' +
      HABITS.map(function (h) {
        return '<tr><th scope="row"><span class="hn">' + esc(h.name) + '</span><span class="hg">' + esc(h.goal(g)) + '</span></th>' + keys.map(function (k) {
          var c = habitCell(h, k), lab = h.name + ' · ' + fmtDate(k) + ': ' + c.text;
          return '<td><span class="hc ' + c.state + (pd(k).getDay() === 1 ? ' mon' : '') + '" title="' + esc(lab) + '" aria-label="' + esc(lab) + '" tabindex="0"></span></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      (any ? '' : '<p class="muted" style="margin-top:14px">Daily entries start now. Study start already comes in from my YPT timer.</p>') + '</section>' +
      mealsHTML(keys) +
      '<section class="two"><div><div class="sec-head"><h2>Mornings</h2><span class="legend"><span><i style="background:#111"></i>Woke up</span><span><i style="background:#e1ad01"></i>Started studying</span></span></div><div class="chart" id="h-morning"></div></div>' +
      '<div><div class="sec-head"><h2>Fasting</h2><span class="muted">hours between last and first meal</span></div><div class="chart" id="h-fast"></div></div></section></div>';
    app.innerHTML = html;
    timeChart(document.getElementById('h-morning'), keys, [
      { name: 'Woke up', color: '#111', get: function (k) { return H('wake').val(k, D.habits.days[k]); }, goal: g.wake ? tmin(g.wake) : null },
      { name: 'Started studying', color: '#e1ad01', get: function (k) { return H('start').val(k); }, goal: g.studyStart ? tmin(g.studyStart) : null }
    ], { label: 'Wake-up and study start times, last 4 weeks' });
    barChart(document.getElementById('h-fast'), keys.map(function (k) { var v = H('fast').val(k, D.habits.days[k]), d = pd(k); return { label: (d.getMonth() + 1) + '/' + d.getDate(), value: v == null ? 0 : v * 60, tip: fmtDate(k) + ': ' + (v == null ? 'no record' : v + 'h') }; }), { goal: g.fastHours ? g.fastHours * 60 : 0, label: 'Fasting hours, last 4 weeks' });
  }


  // ---------- words (Vocabulary Bank) ----------
  // Live link to the Vocabulary Bank (Google Apps Script web app bound to the sheet).
  var WORDS_API = '';
  var MASTERY = 3;
  function vocabKey() { try { return localStorage.getItem('vocabkey') || ''; } catch (e) { return ''; } }
  function mapApiRow(r) {
    var w = { status: r['Status'] || 'new', cat: r['Category'] || '', sub: r['Subcategory'] || '', word: (r['Word'] || '').trim(), en: r['English meaning'] || '', ko: r['Korean meaning'] || '', usage: r['Usage pattern'] || '', ety: r['Etymology'] || '', tip: r['Memory tip'] || '', text: r['Example from text'] || '', source: r['Source'] || '', date: r['Date added'] || '', streak: +r['Quiz streak'] || 0, record: r['Quiz record'] || '', last: r['Last quizzed'] || '' };
    var ex = r['Another example'] || ''; w.ex = ex ? ex.split(/\n?\s*\d[.)]\s+/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
    if (/^\(asked/.test(w.source)) w.source = '';
    return w;
  }
  var pending = [];
  function sendResults() {
    var k = vocabKey(); if (!WORDS_API || !k || !pending.length) return;
    var batch = pending.splice(0, pending.length);
    fetch(WORDS_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: k, results: batch }) })
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) throw 0; })
      .catch(function () { Array.prototype.unshift.apply(pending, batch); setTimeout(sendResults, 8000); });
  }
  function record(w, kind, correct) {
    if (kind === 'quiz') {
      var rec = (w.record || '0/0').split('/'), right = +rec[0] || 0, tries = +rec[1] || 0; tries++;
      if (correct) { right++; w.streak = (w.streak || 0) + 1; if (w.streak >= MASTERY) w.status = 'got it'; } else { w.streak = 0; w.status = 'shaky'; }
      w.record = right + '/' + tries; w.last = todayKey();
    } else if (!correct) { w.streak = 0; w.status = 'shaky'; }
    pending.push({ word: w.word, kind: kind, correct: !!correct }); sendResults();
  }
  function masteryHTML(w) {
    if (w.status === 'got it') return '<span class="mastery done" title="Got it">★ Got it</span>';
    var n = Math.min(MASTERY, w.streak || 0), dots = '';
    for (var i = 0; i < MASTERY; i++) dots += '<i class="' + (i < n ? 'on' : '') + '"></i>';
    return '<span class="mastery" title="' + n + ' of ' + MASTERY + ' quiz answers right in a row">' + dots + '</span>';
  }
  var W = { mode: 'book', cat: '', sub: '', status: '', mine: '', q: '', idx: 0, flip: false, quiz: null };
  function lsGet(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function marks() { return lsGet('wordmarks', {}); }
  function missed() { return lsGet('wordmissed', {}); }
  function parseCSV(t) {
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function wordsFromRows(rows) {
    var K = { 'Status': 'status', 'Category': 'cat', 'Subcategory': 'sub', 'Word': 'word', 'English meaning': 'en', 'Korean meaning': 'ko', 'Usage pattern': 'usage', 'Etymology': 'ety', 'Memory tip': 'tip', 'Example from text': 'text', 'Source': 'source', 'Another example': 'ex', 'Date added': 'date' };
    var head = rows[0].map(function (h) { return K[h.trim()] || h.trim(); });
    return rows.slice(1).map(function (r) {
      var w = {}; head.forEach(function (h, i) { w[h] = (r[i] || '').trim(); });
      var ex = w.ex ? w.ex.split(/\n?\s*\d[.)]\s+/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
      w.ex = ex; w.status = w.status || 'new'; if (/^\(asked/.test(w.source)) w.source = '';
      return w;
    }).filter(function (w) { return w.word; });
  }
  function catNum(c) { var m = /^(\d+)(?:[.-](\d+))?/.exec(c || ''); return m ? (+m[1]) * 100 + (+(m[2] || 0)) : 9999; }
  function wordSet() {
    var mk = marks(), ms = missed(), q = W.q.trim().toLowerCase();
    return D.words.filter(function (w) {
      if (W.cat && w.cat !== W.cat) return false;
      if (W.sub && w.sub !== W.sub) return false;
      if (W.status && w.status !== W.status) return false;
      if (W.mine === 'notyet' && mk[w.word] !== 'notyet') return false;
      if (W.mine === 'knew' && mk[w.word] !== 'knew') return false;
      if (W.mine === 'unseen' && mk[w.word]) return false;
      if (W.mine === 'missed' && !ms[w.word]) return false;
      if (W.mine === 'week' && !(w.date && w.date >= key(addDays(new Date(), -6)))) return false;
      if (q && (w.word + ' ' + w.ko + ' ' + w.en).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function blankRe(word) {
    var stem = function (p) { var e = p.replace(/[.*+?^${}|[\]\\]/g, '\\$&'); return e.length > 3 ? e.replace(/(e|y)$/i, '') + '[a-z]{0,4}' : e; };
    var alts = word.replace(/\([^)]*\)/g, ' ').split('/').map(function (a) {
      var parts = a.trim().split(/\s+/).filter(function (p) { return p && !/^(sb|sth|someone|something|one's|oneself|\.\.\.|~)$/i.test(p); });
      return parts.length ? parts.map(stem).join('\\s+(?:[a-z]+\\s+)?') : null;
    }).filter(Boolean).sort(function (a, b) { return b.length - a.length; });
    return alts.length ? new RegExp('\\b(?:' + alts.join('|') + ')\\b', 'i') : null;
  }
  function makeQuiz(set) {
    var sh = shuffle(set), pool = sh.filter(function (w) { return w.status !== 'got it'; }).concat(sh.filter(function (w) { return w.status === 'got it'; })).slice(0, Math.min(10, set.length)), all = D.words;
    return { i: 0, score: 0, picked: null, wrong: [], qs: pool.map(function (w) {
      var types = ['ko', 'en'], re = blankRe(w.word), sent = (w.ex || []).concat(w.text ? [w.text.replace(/^"|"$/g, '')] : []).find(function (x) { return re && re.test(x); });
      if (sent) types.push('blank');
      var t = types[Math.floor(Math.random() * types.length)];
      var others = shuffle(all.filter(function (x) { return x.word !== w.word; }));
      var near = others.filter(function (x) { return x.sub === w.sub || x.cat === w.cat; }).concat(others);
      var opts = shuffle([w].concat(near.filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 3)));
      if (t === 'ko') return { w: w, type: t, prompt: w.word, ask: 'What does this word mean?', opts: opts.map(function (o) { return { label: o.ko, ok: o === w }; }) };
      if (t === 'en') return { w: w, type: t, prompt: w.en, ask: 'Which word fits this meaning?', opts: opts.map(function (o) { return { label: o.word, ok: o === w }; }) };
      return { w: w, type: t, prompt: sent.replace(re, '_____'), ask: 'Fill in the blank.', opts: opts.map(function (o) { return { label: o.word, ok: o === w }; }) };
    }) };
  }
  function viewWords() {
    var all = D.words, set = wordSet();
    if (W.idx >= set.length) W.idx = 0;
    var cats = {}; all.forEach(function (w) { (cats[w.cat] = cats[w.cat] || {})[w.sub] = 1; });
    var catKeys = Object.keys(cats).sort(function (a, b) { return catNum(a) - catNum(b); });
    var mk = marks(), cnt = { new: 0, shaky: 0, 'got it': 0 }; all.forEach(function (w) { cnt[w.status] = (cnt[w.status] || 0) + 1; });
    var wk = all.filter(function (w) { return w.date && w.date >= key(addDays(new Date(), -6)); }).length;
    var got = cnt['got it'] || 0;
    function opt(v, l, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(l) + '</option>'; }
    var html = '<div class="view"><section style="display:grid;gap:14px"><span class="kicker">Words</span><h1>My word book.</h1>' +
      '<div class="tiles">' +
      '<div class="tile"><span class="label">Words in the bank</span><span class="value">' + all.length + '</span><span class="sub">' + (D.wordsLive ? 'live from my Vocabulary Bank' : 'from my Vocabulary Bank') + '</span></div>' +
      '<div class="tile"><span class="label">Added this week</span><span class="value">' + wk + '</span><span class="sub">last 7 days</span></div>' +
      '<div class="tile"><span class="label">New · Shaky</span><span class="value">' + (cnt.new || 0) + ' · ' + (cnt.shaky || 0) + '</span><span class="sub">still learning</span></div>' +
      '<div class="tile hl"><span class="label">★ Got it</span><span class="value">' + got + ' / ' + all.length + '</span><div class="bar goal"><span style="width:' + Math.max(0.5, got / Math.max(1, all.length) * 100).toFixed(1) + '%"></span></div><span class="sub">' + MASTERY + ' quiz answers right in a row</span></div>' +
      '</div></section>' +
      '<section class="wtools"><div class="seg" role="tablist" aria-label="Mode">' + [['book', 'Book'], ['cards', 'Flashcards'], ['quiz', 'Quiz'], ['list', 'List']].map(function (m) { return '<button type="button" role="tab" data-wm="' + m[0] + '" aria-selected="' + (W.mode === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      '<div class="wfilters">' +
      '<label>Meaning<select data-wf="group">' + opt('', 'All categories', W.sub ? 's:' + W.sub : (W.cat ? 'c:' + W.cat : '')) + catKeys.map(function (c) { var cur = W.sub ? 's:' + W.sub : (W.cat ? 'c:' + W.cat : ''); return '<optgroup label="' + esc(c) + '">' + opt('c:' + c, 'All of ' + c.replace(/^\d+\.\s*/, ''), cur) + Object.keys(cats[c]).sort(function (a, b) { return catNum(a.replace('-', '.')) - catNum(b.replace('-', '.')) || a.localeCompare(b, undefined, { numeric: true }); }).map(function (s) { return opt('s:' + s, s, cur); }).join('') + '</optgroup>'; }).join('') + '</select></label>' +
      '<label>How well I know it<select data-wf="mine">' + opt('', 'Every word', W.mine) + opt('unseen', 'Not checked yet', W.mine) + opt('notyet', 'Not yet (flashcards)', W.mine) + opt('missed', 'Missed in a quiz', W.mine) + opt('knew', 'I knew it', W.mine) + opt('week', 'Added this week', W.mine) + '</select></label>' +
      '<label>Status<select data-wf="status">' + opt('', 'Any', W.status) + opt('new', 'New', W.status) + opt('shaky', 'Shaky', W.status) + opt('got it', '★ Got it', W.status) + '</select></label>' +
      '<label>Search<input type="search" data-wf="q" value="' + esc(W.q) + '" placeholder="word or meaning"></label>' +
      '</div><p class="muted wcount">' + set.length + ' word' + (set.length === 1 ? '' : 's') + ' in this set' + (W.cat || W.sub || W.mine || W.status || W.q ? ' · <button type="button" class="linkbtn" data-wclear>clear filters</button>' : '') + '</p></section>' +
      '<section id="wbody"></section></div>';
    app.innerHTML = html;
    app.querySelectorAll('[data-wm]').forEach(function (b) { b.addEventListener('click', function () { W.mode = b.getAttribute('data-wm'); W.quiz = null; W.flip = false; viewWords(); }); });
    app.querySelector('[data-wf="group"]').addEventListener('change', function (e) { var v = e.target.value; W.cat = v.indexOf('c:') === 0 ? v.slice(2) : ''; W.sub = v.indexOf('s:') === 0 ? v.slice(2) : ''; W.idx = 0; W.quiz = null; viewWords(); });
    ['mine', 'status'].forEach(function (k) { app.querySelector('[data-wf="' + k + '"]').addEventListener('change', function (e) { W[k] = e.target.value; W.idx = 0; W.quiz = null; viewWords(); }); });
    var qi = app.querySelector('[data-wf="q"]'); qi.addEventListener('change', function () { W.q = qi.value; W.idx = 0; W.quiz = null; viewWords(); });
    var cl = app.querySelector('[data-wclear]'); if (cl) cl.addEventListener('click', function () { W.cat = W.sub = W.mine = W.status = W.q = ''; W.idx = 0; W.quiz = null; viewWords(); });
    drawWordBody(set);
  }
  function wordPages(w) {
    var mk = marks()[w.word];
    var left = '<div class="page left"><div class="pg-top"><span>' + esc(w.sub || w.cat) + '</span>' + (w.date ? '<span>' + esc(w.date) + '</span>' : '') + '</div>' +
      '<h2 class="w-word">' + esc(w.word) + '</h2><div class="w-ko">' + esc(w.ko) + '</div><p class="w-en">' + esc(w.en) + '</p>' +
      (w.usage ? '<div class="w-block"><span class="w-lab">How it\'s used</span><p>' + esc(w.usage) + '</p></div>' : '') +
      (w.ety ? '<div class="w-block"><span class="w-lab">Roots</span><p>' + esc(w.ety) + '</p></div>' : '') +
      '<div class="pg-foot">' + masteryHTML(w) + '<span class="pill ' + (w.status === 'shaky' ? '' : 'soft') + '">' + esc(w.status) + '</span>' + (w.record ? '<span class="muted pg-rec">quiz ' + esc(w.record) + ' right</span>' : '') + '</div></div>';
    var right = '<div class="page right">' + (w.tip ? '<div class="w-tip"><span class="w-lab">Memory tip</span><p>' + esc(w.tip) + '</p></div>' : '') +
      (w.text ? '<div class="w-block"><span class="w-lab">Where I met it</span><blockquote>' + esc(w.text) + '</blockquote>' + (w.source ? '<span class="muted w-src">' + esc(w.source) + '</span>' : '') + '</div>' : '') +
      (w.ex && w.ex.length ? '<div class="w-block"><span class="w-lab">Examples</span><ol class="w-ex">' + w.ex.map(function (x) { var re = blankRe(w.word); return '<li>' + (re ? esc(x).replace(re, function (m) { return '<mark>' + m + '</mark>'; }) : esc(x)) + '</li>'; }).join('') + '</ol></div>' : '') + '</div>';
    return left + right;
  }
  function drawWordBody(set) {
    var box = document.getElementById('wbody');
    if (!set.length) { box.innerHTML = '<div class="empty-state">No words in this set yet.</div>'; return; }
    var w = set[W.idx];
    function nav() {
      return '<div class="wnav"><button type="button" class="btn" data-wprev ' + (W.idx ? '' : 'disabled') + '>← Prev</button><span class="muted">' + (W.idx + 1) + ' / ' + set.length + '</span><button type="button" class="btn" data-wshuffle>Shuffle</button><button type="button" class="btn" data-wnext ' + (W.idx < set.length - 1 ? '' : 'disabled') + '>Next →</button></div>';
    }
    function bindNav() {
      var p = box.querySelector('[data-wprev]'), n = box.querySelector('[data-wnext]'), sh = box.querySelector('[data-wshuffle]');
      if (p) p.addEventListener('click', function () { W.idx--; W.flip = false; drawWordBody(set); });
      if (n) n.addEventListener('click', function () { W.idx++; W.flip = false; drawWordBody(set); });
      if (sh) sh.addEventListener('click', function () { var s2 = shuffle(set); set.length = 0; Array.prototype.push.apply(set, s2); W.idx = 0; W.flip = false; drawWordBody(set); });
    }
    if (W.mode === 'book') {
      box.innerHTML = '<div class="wbook" aria-live="polite">' + wordPages(w) + '</div>' + nav() + '<p class="muted wkeys">Tip: use the ← → keys to turn pages.</p>';
      bindNav();
    } else if (W.mode === 'cards') {
      box.innerHTML = '<div class="fcard' + (W.flip ? ' flipped' : '') + '" tabindex="0" role="button" aria-label="Flip card"><div class="face front"><span class="w-lab">' + esc(w.sub || '') + '</span><h2 class="w-word">' + esc(w.word) + '</h2><span class="muted">Say the meaning, then click to flip</span></div>' +
        '<div class="face back"><div class="w-ko">' + esc(w.ko) + '</div><p class="w-en">' + esc(w.en) + '</p>' + (w.tip ? '<p class="w-tipline">' + esc(w.tip) + '</p>' : '') + '</div></div>' +
        '<div class="wnav judge"><button type="button" class="btn" data-wmark="notyet">✗ Not yet</button><button type="button" class="btn accent" data-wmark="knew">✓ I knew it</button></div>' + nav();
      var c = box.querySelector('.fcard'); function flip() { W.flip = !W.flip; c.classList.toggle('flipped', W.flip); }
      c.addEventListener('click', flip); c.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
      box.querySelectorAll('[data-wmark]').forEach(function (b) { b.addEventListener('click', function () { var m = marks(); m[w.word] = b.getAttribute('data-wmark'); lsSet('wordmarks', m); record(w, 'card', m[w.word] === 'knew'); if (W.idx < set.length - 1) W.idx++; W.flip = false; drawWordBody(set); }); });
      bindNav();
    } else if (W.mode === 'quiz') {
      if (!W.quiz) W.quiz = makeQuiz(set);
      var Q = W.quiz;
      if (Q.i >= Q.qs.length) {
        box.innerHTML = '<div class="qdone"><span class="kicker">Quiz done</span><div class="big">' + Q.score + ' / ' + Q.qs.length + '</div>' +
          (Q.mastered && Q.mastered.length ? '<p>★ Now got it: ' + Q.mastered.map(esc).join(', ') + '</p>' : '') + (Q.wrong.length ? '<p>Words to look at again:</p><div class="chips">' + Q.wrong.map(function (x) { return '<span class="pill">' + esc(x) + '</span>'; }).join('') + '</div>' : '<p>Every one right. 🎉</p>') +
          '<div class="btn-row"><button type="button" class="btn primary" data-qnew>New quiz</button>' + (Q.wrong.length ? '<button type="button" class="btn" data-qmissed>Study the ones I missed</button>' : '') + '</div></div>';
        box.querySelector('[data-qnew]').addEventListener('click', function () { W.quiz = null; drawWordBody(set); });
        var qm = box.querySelector('[data-qmissed]'); if (qm) qm.addEventListener('click', function () { W.mine = 'missed'; W.mode = 'book'; W.quiz = null; W.idx = 0; viewWords(); });
        return;
      }
      var q = Q.qs[Q.i];
      box.innerHTML = '<div class="quiz"><div class="qhead"><span class="kicker">Question ' + (Q.i + 1) + ' of ' + Q.qs.length + '</span><span class="muted">Score ' + Q.score + '</span></div><div class="bar goal"><span style="width:' + (Q.i / Q.qs.length * 100) + '%"></span></div>' +
        (Q.i === 0 && Q.picked == null && !(WORDS_API && vocabKey()) ? '<p class="muted qnote">Practice mode: results on this device are not saved to the Vocabulary Bank.</p>' : '') + '<p class="qask">' + q.ask + '</p><div class="qprompt ' + q.type + '">' + esc(q.prompt) + '</div>' +
        '<div class="qopts">' + q.opts.map(function (o, i) { var cls = Q.picked == null ? '' : (o.ok ? ' right' : (Q.picked === i ? ' wrong' : '')); return '<button type="button" class="qopt' + cls + '" data-qo="' + i + '"' + (Q.picked == null ? '' : ' disabled') + '>' + esc(o.label) + '</button>'; }).join('') + '</div>' +
        (Q.picked != null ? '<div class="qfeed">' + masteryHTML(q.w) + ' <strong>' + esc(q.w.word) + '</strong> · ' + esc(q.w.ko) + (q.w.tip ? '<br><span class="muted">' + esc(q.w.tip) + '</span>' : '') + '</div><div class="btn-row"><button type="button" class="btn primary" data-qnext>' + (Q.i < Q.qs.length - 1 ? 'Next question →' : 'See my score') + '</button></div>' : '') + '</div>';
      box.querySelectorAll('[data-qo]').forEach(function (b) { b.addEventListener('click', function () {
        Q.picked = +b.getAttribute('data-qo'); var ms = missed();
        var ok = q.opts[Q.picked].ok, before = q.w.status;
        if (ok) { Q.score++; if (ms[q.w.word]) { delete ms[q.w.word]; } } else { Q.wrong.push(q.w.word); ms[q.w.word] = (ms[q.w.word] || 0) + 1; }
        record(q.w, 'quiz', ok); if (ok && before !== 'got it' && q.w.status === 'got it') Q.mastered = (Q.mastered || []).concat(q.w.word);
        lsSet('wordmissed', ms); drawWordBody(set);
      }); });
      var nx = box.querySelector('[data-qnext]'); if (nx) nx.addEventListener('click', function () { Q.i++; Q.picked = null; drawWordBody(set); });
    } else {
      var groups = {}; set.forEach(function (x) { (groups[x.sub || x.cat] = groups[x.sub || x.cat] || []).push(x); });
      var mk = marks();
      box.innerHTML = Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }).map(function (g) {
        return '<div class="wgroup"><h3>' + esc(g) + '</h3><div class="wlist">' + groups[g].map(function (x) { return '<button type="button" class="witem" data-wopen="' + esc(x.word) + '"><span class="wi-w">' + esc(x.word) + ' ' + masteryHTML(x) + '</span><span class="wi-k">' + esc(x.ko) + '</span></button>'; }).join('') + '</div></div>';
      }).join('');
      box.querySelectorAll('[data-wopen]').forEach(function (b) { b.addEventListener('click', function () { W.idx = set.findIndex(function (x) { return x.word === b.getAttribute('data-wopen'); }); W.mode = 'book'; viewWords(); window.scrollTo(0, 0); }); });
    }
  }
  document.addEventListener('keydown', function (e) {
    if (location.hash !== '#words' || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName) || (W.mode !== 'book' && W.mode !== 'cards')) return;
    var b = document.querySelector(e.key === 'ArrowRight' ? '[data-wnext]' : (e.key === 'ArrowLeft' ? '[data-wprev]' : null));
    if (b && !b.disabled) b.click();
  });

  // ---------- router ----------
  var routes = { home: viewHome, studylog: viewStudyLog, library: viewLibrary, habits: viewHabits, words: viewWords, blog: viewBlog };
  function render() {
    var h = (location.hash || '#home').slice(1);
    if (h === 'owner') { try { localStorage.setItem('owner', '1'); } catch (e) {} location.replace('#home'); return; }
    if (h.indexOf('key-') === 0) { try { localStorage.setItem('vocabkey', h.slice(4)); localStorage.setItem('owner', '1'); } catch (e) {} location.replace('#words'); return; }
    if (h === 'guest') { try { localStorage.removeItem('owner'); } catch (e) {} location.replace('#home'); return; }
    var section = h;
    if (/^day-\d{4}-\d{2}-\d{2}$/.test(h)) { logState.mode = 'day'; logState.anchor = h.slice(4); section = 'studylog'; viewStudyLog(); }
    else if (h === 'subjects') { section = 'studylog'; viewStudyLog(); }
    else if (h.indexOf('subject-') === 0) { section = 'studylog'; viewSubject(h.slice(8)); }
    else if (h.indexOf('book-') === 0) { section = 'library'; viewBook(h.slice(5)); }
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
    bar.innerHTML = '<div class="owner-bar"><div class="shell"><strong>Owner mode</strong><a href="' + ghNew('logs', tk + '.md', logTemplate(tk)) + '" target="_blank" rel="noopener">Write today\'s log ↗</a><a href="' + ghNew('posts', tk + '-new-post.md', postTemplate(tk)) + '" target="_blank" rel="noopener">Write a post ↗</a><a href="https://github.com/' + REPO + '/edit/main/data/habits.json" target="_blank" rel="noopener">Edit habits ↗</a><a href="https://github.com/' + REPO + '" target="_blank" rel="noopener">Repository ↗</a><a href="#guest">Leave owner mode</a></div></div>';
  }
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });

  function getJSON(p) { return fetch(p, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(p); return r.json(); }); }
  Promise.all([getJSON('data/study.json'), getJSON('logs/index.json').catch(function () { return []; }), getJSON('posts/index.json').catch(function () { return []; }), getJSON('data/library.json').catch(function () { return { items: [] }; }), getJSON('data/habits.json').catch(function () { return { goals: {}, days: {} }; }), (WORDS_API ? fetch(WORDS_API, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { return { words: j.rows.map(mapApiRow).filter(function (w) { return w.word; }), live: true }; }).catch(function () { return getJSON('data/words.json'); }) : getJSON('data/words.json')).catch(function () { return { words: [] }; })])
    .then(function (res) {
      D.study = res[0]; D.logs = res[1]; D.posts = res[2]; D.library = res[3].items || []; D.habits = res[4]; D.words = res[5].words || []; D.wordsLive = !!res[5].live;
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
