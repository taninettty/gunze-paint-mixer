/*!
 * 调色台 — 界面逻辑（郡士 Mr.Color 版）
 * 依赖：engine.js（计算内核）、gunze-data.js（色库）、spectral.js（光谱数据）
 */
(function () {
  'use strict';

  var E = null;
  var MAX_SEL = 8;
  var KIND_LABEL = { metal: '金属', clear: '透明', pearl: '珠光', additive: '消光' };

  var state = {
    layers: [],
    targetHex: '#B79764',
    selected: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'],
    volume: 100
  };

  var lastResult = null;

  function $(id) { return document.getElementById(id); }

  // --------------------------------------------------------------
  // 依赖加载
  // --------------------------------------------------------------
  function loadSpectral(done, fail) {
    if (window.spectral) return done();

    var s = document.createElement('script');
    s.src = './spectral.js';
    s.onload = function () { window.spectral ? done() : cdn(); };
    s.onerror = cdn;
    document.head.appendChild(s);

    function cdn() {
      var c = document.createElement('script');
      c.src = 'https://cdn.jsdelivr.net/npm/spectral.js@3.0.0/spectral.js';
      c.onload = function () { window.spectral ? done() : fail(); };
      c.onerror = fail;
      document.head.appendChild(c);
    }
  }

  // --------------------------------------------------------------
  // 工具
  // --------------------------------------------------------------
  function normalizeHex(input) {
    var t = String(input == null ? '' : input).trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(t)) t = t.replace(/./g, function (c) { return c + c; });
    if (!/^[0-9a-fA-F]{6}$/.test(t)) return null;
    return '#' + t.toUpperCase();
  }

  function fmtAmount(v) {
    if (v <= 0) return '0';
    if (v >= 1) return String(Math.round(v));   // 整滴，不显示小数
    if (v >= 0.1) return v.toFixed(1);
    return '<0.1';
  }

  function fmtPct(p) {
    return p >= 1 ? p.toFixed(1) : p.toFixed(2);
  }

  function fmtParts(p) {
    if (p < 0.1) return '<0.1';
    if (p < 10) return p.toFixed(1);
    return p.toFixed(0);
  }

  /** 卡片太窄，把 "光泽白 C1" 这类压成最好认的中文名 */
  function shortName(p) {
    var n = (p.name || p.code).replace(/\s*\(.*\)$/, '');
    n = n.replace(/^(光泽|半光|消光)/, '');
    return n;
  }

  function nearLabel(de) {
    if (de <= 1.5) return '几乎一样';
    if (de <= 3) return '很接近';
    if (de <= 6) return '有点像';
    return '差别较大';
  }

  function grade(de, chroma) {
    // 两个都接近中性（白/灰/黑）时色相肉眼难分，ΔE00 会被低彩度下的色相角放大
    var neutral = typeof chroma === 'number' && chroma < 6;
    if (de <= 1) return ['ok', '几乎无差'];
    if (de <= (neutral ? 2.5 : 2)) return ['ok', '很好'];
    if (de <= (neutral ? 5 : 3.5)) return ['warn', neutral ? '接近中性，肉眼难分' : '可接受'];
    return ['bad', '偏差明显'];
  }

  function toast(msg) {
    var el = $('copyBtn');
    var old = el.textContent;
    el.textContent = msg;
    setTimeout(function () { el.textContent = old; }, 1400);
  }

  // --------------------------------------------------------------
  // 构建列表
  // --------------------------------------------------------------
  function buildPresets() {
    var box = $('presets');
    E.PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      var i = document.createElement('i');
      i.style.background = p.hex;
      b.appendChild(i);
      b.appendChild(document.createTextNode(p.name));
      b.addEventListener('click', function () { setTarget(p.hex); });
      box.appendChild(b);
    });
  }

  function buildGunzeList() {
    var dl = $('gunzeList');
    E.PIGMENTS.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.code;
      o.label = p.code + ' ' + p.name;
      dl.appendChild(o);
    });
  }

  /** 把 "c39" / "39" / "dark yellow" 解析成一支漆 */
  function resolveGunze(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return null;

    var m = t.match(/^c?\s*0*(\d{1,3})$/i);
    if (m) {
      var code = 'C' + parseInt(m[1], 10);
      for (var i = 0; i < E.PIGMENTS.length; i++) {
        if (E.PIGMENTS[i].code === code) return E.PIGMENTS[i];
      }
      return null;
    }

    var q = t.toLowerCase();
    for (var j = 0; j < E.PIGMENTS.length; j++) {
      var p = E.PIGMENTS[j];
      if ((p.code + ' ' + p.name + ' ' + (p.nameEn || '')).toLowerCase().indexOf(q) >= 0) return p;
    }
    return null;
  }

  var GROUPS = [
    { key: 'base', title: '实色 · 珠光', match: function (p) { return p.kind === 'solid' || p.kind === 'pearl' || !p.kind; } },
    { key: 'metal', title: '金属漆', match: function (p) { return p.kind === 'metal'; } },
    { key: 'clear', title: '透明漆', match: function (p) { return p.kind === 'clear'; } },
    { key: 'additive', title: '消光剂', match: function (p) { return p.kind === 'additive'; } }
  ];

  function buildPigments() {
    var box = $('pigList');

    GROUPS.forEach(function (g) {
      var items = E.PIGMENTS.filter(g.match);
      if (!items.length) return;

      var group = document.createElement('div');
      group.className = 'pig-group';
      group.dataset.group = g.key;

      var title = document.createElement('div');
      title.className = 'pig-group-title';
      title.textContent = g.title + ' · ' + items.length;
      group.appendChild(title);

      items.forEach(function (p) { group.appendChild(pigRow(p)); });
      box.appendChild(group);
    });

    updateCount();
  }

  function pigRow(p) {
    var label = document.createElement('label');
    label.className = 'pig';
    label.title = p.note;
    label.dataset.k = (p.code + ' ' + p.name + ' ' + (p.nameEn || '')).toLowerCase();

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = p.id;
    cb.checked = state.selected.indexOf(p.id) >= 0;

    var sw = document.createElement('span');
    sw.className = 'sw';
    sw.style.background = p.hex;

    var txt = document.createElement('span');
    txt.className = 'txt';
    var cd = document.createElement('span');
    cd.className = 'cd';
    cd.textContent = p.code;
    var nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = p.name;
    txt.appendChild(cd);
    txt.appendChild(nm);

    if (p.kind && p.kind !== 'solid') {
      var kd = document.createElement('span');
      kd.className = 'kd kd-' + p.kind;
      kd.textContent = KIND_LABEL[p.kind] || p.kind;
      txt.appendChild(kd);
    }

    label.appendChild(cb);
    label.appendChild(sw);
    label.appendChild(txt);

    cb.addEventListener('change', function () {
      var ids = readSelection();
      if (ids.length > MAX_SEL) {
        cb.checked = false;
        toast('最多 ' + MAX_SEL + ' 支');
        return;
      }
      state.selected = ids;
      updateCount();
      compute();
    });

    return label;
  }

  function addPigment(code) {
    var cb = document.querySelector('#pigList input[value="' + code + '"]');
    if (!cb || cb.checked) return false;
    if (state.selected.length >= MAX_SEL) { toast('最多 ' + MAX_SEL + ' 支'); return false; }
    cb.checked = true;
    state.selected = readSelection();
    updateCount();
    compute();
    return true;
  }

  var kbState = { id: 'gear' };

  var KB_TABS = [
    { id: 'gear', name: '器材' },
    { id: 'practice', name: '实务' },
    { id: 'art', name: '配色' },
    { id: 'fail', name: '翻车急救' }
  ];

  function renderKb() {
    var tabs = $('kbTabs');
    var list = $('kbList');
    if (!tabs || !list) return;

    tabs.innerHTML = '';
    KB_TABS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'kb-tab' + (c.id === kbState.id ? ' active' : '');
      b.textContent = c.name;
      b.addEventListener('click', function () {
        kbState.id = c.id;
        renderKb();
      });
      tabs.appendChild(b);
    });

    var VIEW = { gear: 'airbrush', practice: 'spray', art: 'art', fail: 'fail' };
    var v = { block: VIEW[kbState.id] || 'airbrush' };

    var air = $('airbrush');
    if (air) air.hidden = v.block !== 'airbrush';

    var sd = $('sprayDetail');
    if (sd) sd.hidden = v.block !== 'spray';

    var fd = $('failDetail');
    if (fd) fd.hidden = v.block !== 'fail';

    var ad = $('artDetail');
    if (ad) ad.hidden = v.block !== 'art';

    var listEl = $('kbList');
    if (listEl) listEl.hidden = true;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    var cat = E.SPRAY_KB.filter(function (c) { return c.id === kbState.id; })[0] || E.SPRAY_KB[0];
    list.innerHTML = '';

    cat.items.forEach(function (it) {
      var card = document.createElement('div');
      card.className = 'kb-item' + (cat.id === 'fail' ? ' fail' : '');

      var t = document.createElement('h4');
      t.textContent = it.q;

      var p = document.createElement('p');
      p.textContent = it.a;

      card.appendChild(t);
      card.appendChild(p);
      list.appendChild(card);
    });
  }

  function showPage(id) {
    var pages = document.querySelectorAll('.page, .panel[data-page]');
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].dataset.page) pages[i].hidden = pages[i].dataset.page !== id;
    }

    var btns = document.querySelectorAll('.nav-btn');
    for (var j = 0; j < btns.length; j++) {
      btns[j].classList.toggle('active', btns[j].dataset.page === id);
    }

    var g = $('guide');
    if (g && !g.dataset.dismissed) g.hidden = id !== 'mix';

    try { localStorage.setItem('tint.page', id); } catch (e) {}
  }

  function initNav() {
    var nav = $('topnav');
    if (!nav) return;

    nav.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.nav-btn');
      if (!btn) return;
      showPage(btn.dataset.page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    var saved = 'mix';
    try { saved = localStorage.getItem('tint.page') || 'mix'; } catch (e) {}
    showPage(saved);
  }

  function initAirbrush() {
    var btn = $('abTrigger');
    var svg = $('abSvg');
    var paint = $('abPaint');
    var cap = $('abCaption');
    if (!btn || !svg || !paint) return;

    var on = false;

    function set(v) {
      on = v;
      svg.classList.toggle('pressed', on);
      btn.classList.toggle('on', on);
      paint.style.display = on ? 'inline' : 'none';
      btn.textContent = on ? '松开扳机' : '按住扳机';
      cap.textContent = on
        ? '按下并后拉：针退开，漆被负压吸出，在喷嘴口被气流撕成雾'
        : '没按扳机：只有气在走，漆出不来';
    }

    btn.addEventListener('click', function () { set(!on); });

    // 按下去看动画，松开恢复
    btn.addEventListener('mousedown', function () { set(true); });
    btn.addEventListener('mouseup', function () { setTimeout(function () { set(false); }, 600); });
  }

  function initSprayNav() {
    var nav = document.querySelector('.sd-nav');
    if (!nav) return;

    nav.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button');
      if (!btn) return;
      var el = document.getElementById(btn.dataset.anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function initGuide() {
    var g = $('guide');
    if (!g) return;

    try {
      if (localStorage.getItem('tint.guide') === 'off') { g.hidden = true; g.dataset.dismissed = '1'; }
    } catch (e) {}

    var btn = $('guideClose');
    if (btn) {
      btn.addEventListener('click', function () {
        g.hidden = true;
        g.dataset.dismissed = '1';
        try { localStorage.setItem('tint.guide', 'off'); } catch (e) {}
      });
    }
  }

  function updateCount() {
    $('pigCount').textContent = '已选 ' + state.selected.length + ' / ' + MAX_SEL;
  }

  function readSelection() {
    return Array.prototype.slice
      .call(document.querySelectorAll('#pigList input:checked'))
      .map(function (x) { return x.value; });
  }

  // --------------------------------------------------------------
  // 目标色
  // --------------------------------------------------------------
  function setTarget(hex, opts) {
    var n = normalizeHex(hex);
    if (!n) return false;
    var o = opts || {};

    state.targetHex = n;
    if (o.kind !== undefined) state.targetKind = o.kind || null;

    if (!o.keepInput) $('hexInput').value = n;
    $('colorInput').value = n.toLowerCase();
    $('targetChip').style.background = n;
    $('chipHex').textContent = n;
    $('targetHexLabel').textContent = n;
    $('chipTarget').style.background = n;

    var lab = E.labOfHex(n);
        var cast = E.castName(lab);
    $('hueHint').textContent = 'L* ' + lab[0].toFixed(0) +
      ' · C* ' + Math.hypot(lab[1], lab[2]).toFixed(0) +
      (cast ? ' · ' + cast : '');

    var badge = $('targetKind');
    if (badge) {
      var KNAME = { metal: '金属色', pearl: '珠光色', clear: '透明色', solid: '' };
      var kn = KNAME[state.targetKind] || '';
      badge.hidden = !kn;
      badge.textContent = kn;
    }

    if (o.defer) scheduleCompute();
    else compute();

    return true;
  }

  // --------------------------------------------------------------
  // 主计算（带节流）
  // --------------------------------------------------------------
  var pendingTimer = null;
  var lastCompute = 0;

  function now() {
    return (window.performance || Date).now();
  }

  function scheduleCompute() {
    var gap = 100 - (now() - lastCompute);
    if (gap <= 0) {
      lastCompute = now();
      compute();
    } else {
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(function () {
        lastCompute = now();
        compute();
      }, gap);
    }
  }

  function compute() {
    if (!E || !window.spectral) return;

    var t0 = now();
    var res;

    // 目标指定了漆种（比如金属），就只在同种漆里配
    var ids = state.selected;
    state.kindEmpty = false;
    var blocked = null;

    if (state.targetKind && state.targetKind !== 'solid') {
      var byCode = {};
      E.PIGMENTS.forEach(function (p) { byCode[p.code] = p; });

      var same = ids.filter(function (id) {
        return byCode[id] && byCode[id].kind === state.targetKind;
      });

      if (same.length) {
        ids = same;
      } else {
        state.kindEmpty = true;
        blocked = {
          ok: false,
          error: '目标是' + ({ metal: '金属色', pearl: '珠光色', clear: '透明色' }[state.targetKind] || '特殊色') +
            '，但手上的漆里没有同种漆。金属感、珠光感都不在颜色里——用实色配出来只是看着像，喷出来不是。' +
            '先在「手上的漆」里勾一支，或者用下面的「工序模板」。',
          suggestions: E.nearestPaints(state.targetHex, state.targetKind, 3)
        };
      }
    }

    try {
      res = blocked || E.solveMixed({
        targetHex: state.targetHex,
        pigmentIds: ids,
        volume: state.volume
      });
    } catch (err) {
      console.error(err);
      $('note').textContent = '计算出错：' + err.message;
      return;
    }

    var ms = now() - t0;
    $('solveTime').textContent = ms < 10 ? '<10 ms' : Math.round(ms) + ' ms';

    lastResult = res;
    render(res);

    $('snapDe').textContent = res.ok && res.exactDeltaE != null
      ? '精确解 ΔE ' + res.exactDeltaE.toFixed(1) + '（靠量不出来的微量堆出来的）'
      : '';

    scheduleLayers();
    scheduleShades();
    renderBuy();
  }

  var shadeTimer = null;

  function scheduleShades() {
    if (shadeTimer) clearTimeout(shadeTimer);
    shadeTimer = setTimeout(renderShades, 60);
  }

  function renderBuy() {
    var list = $('buyList');
    if (!list) return;

    var picks = E.nearestPaints(state.targetHex, null, 3);
    list.innerHTML = '';

    picks.forEach(function (p, i) {
      var li = document.createElement('li');

      var sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.background = p.pigment.hex;

      var b = document.createElement('b');
      b.textContent = p.pigment.code + ' ' + p.pigment.name;

      li.appendChild(sw);
      li.appendChild(b);
      li.appendChild(document.createTextNode(
        '　ΔE ' + p.deltaE.toFixed(1) + (i === 0 ? '（最接近，先买这支）' : '')
      ));
      list.appendChild(li);
    });

    var tip = document.createElement('li');
    tip.style.color = '#9C968A';
    tip.style.fontSize = '11px';
    tip.textContent = '各买一瓶 10 毫升就够调一个模型；先按上面配方试，不够再补。';
    list.appendChild(tip);
  }

  function setStyle(style) {
    if (style !== 'physical' && style !== 'art') return;
    state.style = style;
    [].forEach.call(document.querySelectorAll('.style-opt[data-style]'), function (b) {
      b.classList.toggle('active', b.dataset.style === style);
    });
    renderShades();
  }

  function hslToRgb(h, s, l) {
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      function hue2rgb(p2, q2, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
        if (t < 1 / 2) return q2;
        if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
        return p2;
      }
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p2 = 2 * l - q;
      r = hue2rgb(p2, q, h + 1 / 3);
      g = hue2rgb(p2, q, h);
      b = hue2rgb(p2, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function setLight(light) {
    if (light !== 'warm' && light !== 'neutral' && light !== 'cool') return;
    state.light = light;
    [].forEach.call(document.querySelectorAll('.light-opt[data-light]'), function (b) {
      b.classList.toggle('active', b.dataset.light === light);
    });
    renderShades();
  }

  function renderLayers() {
    var box = $('layerStack');
    if (!box) return;

    // 目标色变了不删层：按新底色重算配方，并标记
    var layerIds = state.selected.length ? state.selected
      : E.PIGMENTS.filter(function (p) { return p.mixable; }).slice(0, 6).map(function (p) { return p.code; });

    state.layers.forEach(function (L) {
      if (L.baseHex === state.targetHex) return;
      try {
        L.tint = E.tintRecipe(state.targetHex, L.hex, layerIds, { volume: 10 });
        L.rebased = true;
      } catch (e) { L.tint = null; }
      L.baseHex = state.targetHex;
    });

    if (!state.layers.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    box.hidden = false;
    box.innerHTML = '<h5>附加层（底色不改，按顺序喷）</h5>';

    state.layers.forEach(function (L, i) {
      var row = document.createElement('div');
      row.className = 'layer-item';

      var sw = document.createElement('i');
      sw.className = 'lsw';
      sw.style.background = L.hex;

      var nm = document.createElement('span');
      nm.className = 'lname';
      nm.textContent = '第 ' + (i + 1) + ' 层 · ' + L.name + (L.rebased ? '（按新底色重算）' : '');

      var rc = document.createElement('span');
      rc.className = 'lrc';
      if (L.tint) {
        rc.textContent = '底 ' + L.tint.basePct + '% · ' + L.tint.items.map(function (it) {
          return shortName(it.pigment) + ' ' + it.pct + '%';
        }).join(' · ');
      } else {
        rc.textContent = L.hex;
      }

      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'lx';
      x.textContent = '移除';
      x.addEventListener('click', function () {
        state.layers.splice(i, 1);
        renderLayers();
      });

      row.appendChild(sw);
      row.appendChild(nm);
      row.appendChild(rc);
      row.appendChild(x);
      box.appendChild(row);
    });
  }

  function renderShades() {
    var row = $('shadeRow');
    if (!row) return;

    var isMetal = false;
    var isPearl = false;
    try {
      var np = E.nearestPaint(state.targetHex);
      isMetal = !!(np && np.pigment && np.pigment.kind === 'metal');
      isPearl = !!(np && np.pigment && np.pigment.kind === 'pearl');
    } catch (err) { isMetal = false; }

    var variants = E.shadeVariants(state.targetHex, { light: state.light || 'neutral', metal: isMetal, pearl: isPearl, style: state.style || 'physical' });
    var ids = state.selected.length ? state.selected : E.PIGMENTS.filter(function (p) { return p.mixable; }).slice(0, 6).map(function (p) { return p.code; });

    row.innerHTML = '';
    renderLayers();

    variants.forEach(function (v) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'shade-card';
      card.title = v.note;

      var sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.background = v.hex;

      var nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = v.name;

      var lv = document.createElement('i');
      lv.className = 'lv';
      lv.textContent = 'L' + Math.round(v.lab[0]);
      nm.appendChild(lv);

      var hx = document.createElement('span');
      hx.className = 'hx';
      hx.textContent = v.hex;

      var rc = document.createElement('span');
      rc.className = 'rc';

      // 配方：在底色里加多少，而不是「从头调出这个颜色」
      var tr = null;
      try {
        tr = E.tintRecipe(state.targetHex, v.hex, ids, { volume: 10 });
      } catch (err) { tr = null; }

      if (tr) {
        var parts = tr.items.map(function (it) {
          return shortName(it.pigment) + ' ' + it.pct + '%';
        });
        rc.textContent = '底 ' + tr.basePct + '% · ' + parts.join(' · ') + (tr.exact ? '' : ' ≈');
        card.title = v.note + '\n底色 ' + tr.basePct + '%' + tr.items.map(function (it) {
          return ' + ' + it.pigment.code + ' ' + it.pigment.name + ' ' + it.pct + '%';
        }).join('') + '\n偏差 ΔE ' + tr.deltaE.toFixed(1);
      } else {
        rc.textContent = v.note;
      }
      card.appendChild(sw);
      card.appendChild(nm);
      card.appendChild(hx);
      card.appendChild(rc);

      card.addEventListener('click', function () {
        var idx = -1;
        for (var q = 0; q < state.layers.length; q++) if (state.layers[q].id === v.id) idx = q;

        if (idx >= 0) {
          state.layers.splice(idx, 1);
        } else {
          state.layers.push({ id: v.id, name: v.name, hex: v.hex, tint: tr, baseHex: state.targetHex });
        }
        renderLayers();
      });

      row.appendChild(card);
    });
  }

  // --------------------------------------------------------------
  // 工序模板：伪电镀 / 糖果色 / 金属色
  // --------------------------------------------------------------
  var procState = { id: 'chrome', overrides: {}, metal: 'C8', clear: 'C47' };

  function renderProcess() {
    var res = E.buildProcess(procState.id, { metal: procState.metal, clear: procState.clear, overrides: procState.overrides });
    if (!res) return;

    $('procDesc').textContent = res.desc;

    var meta = $('procMeta');
    if (meta) {
      meta.innerHTML = '';

      function chip(text, cls) {
        var s = document.createElement('span');
        if (cls) s.className = cls;
        s.textContent = text;
        meta.appendChild(s);
      }

      chip(res.steps.length + ' 层');
      if (res.meta) {
        chip(res.meta.dry);
        var stars = '';
        for (var si = 0; si < 3; si++) stars += si < res.meta.level ? '★' : '☆';
        chip('难度 ' + stars, 'lv');
      }
    }

    var tip = res.tip;
    if (res.clearHint) tip += ' 这支透明色的用途：' + res.clearHint + '。';
    $('procTip').textContent = tip;

    var list = $('procSteps');
    list.innerHTML = '';

    res.steps.forEach(function (st, i) {
      var li = document.createElement('li');
      li.className = 'proc-step';

      var no = document.createElement('span');
      no.className = 'no';
      no.textContent = i + 1;

      var sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.background = st.hex || '#ddd';

      var body = document.createElement('div');
      body.className = 'body';

      var top = document.createElement('div');
      top.className = 'top';

      var KMAP = {
        '底漆': ['solid'], '底色': ['solid'], '实色': ['solid'],
        '金属层': ['metal'], '金属色': ['metal'], '银色底': ['metal'],
        '珠光层': ['pearl', 'solid'],
        '透明色': ['clear'], '罩光': ['clear'], '保护层': ['clear']
      };
      var kinds = KMAP[st.role] || null;

      var nm = document.createElement('select');
      nm.className = 'step-paint';

      E.PIGMENTS.filter(function (p) {
        return !kinds || kinds.indexOf(p.kind) >= 0;
      }).forEach(function (p) {
        var op = document.createElement('option');
        op.value = p.code;
        op.textContent = p.code + ' ' + p.name;
        if (p.code === st.code) op.selected = true;
        nm.appendChild(op);
      });

      nm.addEventListener('change', function () {
        procState.overrides[i] = nm.value;
        renderProcess();
      });

      var role = document.createElement('span');
      role.className = 'role';
      role.textContent = st.role;

      var qty = document.createElement('span');
      qty.className = 'qty';
      qty.textContent = st.qty;

      top.appendChild(nm);
      top.appendChild(role);
      top.appendChild(qty);

      var note = document.createElement('div');
      note.className = 'note';
      note.textContent = st.note;

      body.appendChild(top);
      body.appendChild(note);

      if (st.know) {
        var k = document.createElement('div');
        k.className = 'step-know';
        k.textContent = st.know;
        body.appendChild(k);
      }

      li.appendChild(no);
      li.appendChild(sw);
      li.appendChild(body);
      list.appendChild(li);
    });

    var sum = document.querySelector('.proc-know summary');
    if (sum) sum.textContent = '喷涂小知识 · ' + E.PROCESS_TIPS.length + ' 条';

    var know = $('procKnow');
    if (know && !know.children.length) {
      E.PROCESS_TIPS.forEach(function (t) {
        var li = document.createElement('li');
        li.textContent = t;
        know.appendChild(li);
      });
    }
  }

  // --------------------------------------------------------------
  // 分层反推：目标色像是哪支漆喷在哪种底漆上
  // --------------------------------------------------------------
  var layerTimer = null;

  function scheduleLayers() {
    clearTimeout(layerTimer);
    layerTimer = setTimeout(updateLayers, 220);
  }

  function updateLayers() {
    if (!E) return;
    var box = $('layerList');
    var primer = $('primerSel').value;

    var res;
    try {
      res = E.solveLayered({ targetHex: state.targetHex, primerHex: primer, limit: 3 });
    } catch (err) {
      box.innerHTML = "";
      return;
    }

    box.innerHTML = "";

    res.candidates.forEach(function (c, i) {
      var row = document.createElement("div");
      row.className = "layer-row" + (i === 0 ? " top" : "");

      var code = document.createElement("span");
      code.className = "code";
      code.textContent = c.pigment.code;

      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = c.pigment.name;

      var de = document.createElement("span");
      de.className = "lde";
      de.textContent = "ΔE " + c.deltaE.toFixed(1);

      var th = document.createElement("span");
      th.className = "th";
      th.textContent = c.label;

      row.appendChild(code);
      row.appendChild(nm);
      row.appendChild(de);
      row.appendChild(th);
      box.appendChild(row);
    });
  }

  // --------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------
  function render(res) {
    var body = $('recipeBody');
    body.innerHTML = '';

    // 最接近的郡士色
    var near = E.nearestPaint(state.targetHex);
    var nearBox = $('nearest');
    nearBox.innerHTML = '';
    if (near) {
      var dot = document.createElement('i');
      dot.style.background = near.pigment.hex;
      nearBox.appendChild(dot);
      nearBox.appendChild(document.createTextNode('最接近 '));
      var b = document.createElement('b');
      b.textContent = near.pigment.code + ' ' + near.pigment.name;
      nearBox.appendChild(b);
      nearBox.appendChild(document.createTextNode(
        near.deltaE < 0.3 ? ' · 就是这个色' : ' · ΔE ' + near.deltaE.toFixed(1)
      ));
    }

    if (!res.ok) {
      $('deValue').textContent = '—';
      $('deLabel').textContent = '';
      $('deBox').className = 'de';
      $('predHexLabel').textContent = '—';
      $('chipPred').style.background = 'repeating-linear-gradient(45deg,#EFECE4,#EFECE4 6px,#E6E2D8 6px,#E6E2D8 12px)';
      $('note').className = 'note warn';
      $('note').textContent = res.error;

      // 没有同种漆：推荐三支，点了直接加进手上的漆
      if (res.suggestions && res.suggestions.length) {
        var tipRow = document.createElement('tr');
        var tipTd = document.createElement('td');
        tipTd.colSpan = 3;
        tipTd.className = 'sug-title';
        tipTd.textContent = '最接近的三支' +
          ({ metal: '金属漆', pearl: '珠光漆', clear: '透明漆' }[state.targetKind] || '') + '：';
        tipRow.appendChild(tipTd);
        body.appendChild(tipRow);

        res.suggestions.forEach(function (s) {
          var tr2 = document.createElement('tr');
          tr2.className = 'sug';

          var td2 = document.createElement('td');
          var sw = document.createElement('i');
          sw.className = 'sw';
          sw.style.background = s.pigment.hex;
          td2.appendChild(sw);
          td2.appendChild(document.createTextNode(' ' + s.pigment.code + ' ' + s.pigment.name));
          tr2.appendChild(td2);

          var td3 = document.createElement('td');
          td3.textContent = 'ΔE ' + s.deltaE.toFixed(1);
          tr2.appendChild(td3);

          var td4 = document.createElement('td');
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sug-add';
          btn.textContent = '加入';
          btn.addEventListener('click', function () { addPigment(s.pigment.code); });
          td4.appendChild(btn);
          tr2.appendChild(td4);

          body.appendChild(tr2);
        });

        return;
      }

      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'empty';
      td.textContent = '还没有选漆';
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    $('chipTarget').style.background = res.target.hex;
    $('chipPred').style.background = res.predicted.hex;
    $('predHexLabel').textContent = res.predicted.hex;

    var tLab = res.target.lab || E.labOfHex(res.target.hex);
    var pLab = res.predicted.lab || E.labOfHex(res.predicted.hex);
    var chromaAvg = (Math.hypot(tLab[1], tLab[2]) + Math.hypot(pLab[1], pLab[2])) / 2;
    var g = grade(res.deltaE, chromaAvg);
    $('deBox').className = 'de ' + g[0];
    $('deValue').textContent = res.deltaE.toFixed(2);
    $('deLabel').textContent = g[1];

    res.items.forEach(function (l) {
      var tr = document.createElement('tr');

      var td1 = document.createElement('td');
      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = l.pigment.hex;
      td1.appendChild(dot);

      var nameWrap = document.createElement('span');
      nameWrap.appendChild(document.createTextNode(l.pigment.name + ' '));
      var cod = document.createElement('span');
      cod.className = 'cod';
      cod.textContent = l.pigment.code;
      nameWrap.appendChild(cod);

      if (l.tone) {
        var tone = document.createElement('span');
        tone.className = 'tone';
        tone.textContent = l.tone;
        nameWrap.appendChild(tone);
      }

      td1.appendChild(nameWrap);

      if (l.isBase) {
        var tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = '打底';
        td1.appendChild(tag);
      }
      tr.appendChild(td1);

      var td2 = document.createElement('td');
      td2.className = 'pct';
      td2.textContent = fmtPct(l.percent) + '%';
      tr.appendChild(td2);

      var td3 = document.createElement('td');
      td3.textContent = l.kind === 'bulk' ? Math.round(l.ml) + ' 毫升' : l.drops + ' 滴';
      if (l.kind === 'trace') td3.className = 'trace';
      tr.appendChild(td3);

      body.appendChild(tr);
    });

    var notes = [];

    var additives = state.selected.filter(function (id) {
      var p = E.PIGMENTS.filter(function (x) { return x.id === id; })[0];
      return p && p.kind === 'additive';
    }).length;
    if (additives) {
      notes.push('消光剂只调整光泽，不参与调色，已从配方中排除。');
    }

    var kinds = {};
    res.items.forEach(function (it) { if (it.pigment.kind) kinds[it.pigment.kind] = true; });

    if (kinds.metal && kinds.solid) {
      notes.push('金属漆混了实色：金属粉会被盖住，金属感会明显减弱。');
    }
    if (kinds.clear && (kinds.solid || kinds.metal)) {
      notes.push('透明漆混进实色或金属漆会发浑；伪电镀、糖果色是分层喷出来的，不是混出来的。');
    }

    if (near && near.deltaE < 0.5) {
      notes.push('目标色就是 ' + near.pigment.code + ' ' + near.pigment.name +
        '，手上有这支直接用最省事；下面是只用当前所选漆的替代配方。');
    } else if (res.missingHue) {
      notes.push(res.missingHue);
    }
    if (!res.predicted.inGamut) notes.push('结果超出屏幕能显示的范围（sRGB 色域），实物可能更鲜艳。');
    if (!notes.length && res.deltaE > 1.2) {
      var add = bestMissingPigment(res, state.selected);
      var castOfTarget = E.castName(E.labOfHex(res.target.hex));
      if (add) {
        notes.push('目标是' + (castOfTarget || '这个色') + '，现在差 ' + res.deltaE.toFixed(1) +
          '；再勾上 ' + add.code + ' ' + add.name + ' 能到 ' + add.de.toFixed(1) + '。');
      } else {
        notes.push('想更贴近，可以多勾一两支邻近色相的郡士色。');
      }
    }

    var pn = $('preciseNote');
    if (pn) {
      if (res.deltaE < 1.5) {
        pn.hidden = false;
        pn.textContent = 'ΔE ' + res.deltaE.toFixed(2) + ' 是数学结果。实际调色误差约 ±3：吸管最小 0.04 毫升、漆的批次差、喷涂厚度都会吃掉这点差距。';
      } else {
        pn.hidden = true;
      }
    }

    $('note').className = 'note' + (res.missingHue && !(near && near.deltaE < 0.5) ? ' warn' : '');
    $('note').textContent = notes.join(' ');
  }

  // --------------------------------------------------------------
  // 导出
  // --------------------------------------------------------------
  function recipeText() {
    var r = lastResult;
    if (!r || !r.ok) return '';

    var out = [];
    out.push('郡士模型漆调色配方');
    out.push('目标 ' + r.target.hex + '  →  预测 ' + r.predicted.hex + '   ΔE00 ' + r.deltaE.toFixed(2));
    out.push('调配总量 ' + r.total + ' 滴');
    out.push('--------------------------------');

    r.items.forEach(function (l) {
      out.push(
        l.pigment.code.padEnd(5, ' ') + l.pigment.name +
        '  ' + (l.kind === 'bulk' ? l.ml.toFixed(0) + ' 毫升' : l.drops + ' 滴') +
        '  ' + l.percent.toFixed(1) + '%'
      );
    });

    out.push('--------------------------------');
    out.push('顺序：先加主色，再按由浅到深加辅色，黑色最后一点点加。');
    out.push('提示：屏幕色非实测，先在小样上试色。');
    return out.join('\n');
    if (state.layers && state.layers.length) {
      out.push('');
      out.push('附加层（底色 ' + r.target.hex + '）');
      state.layers.forEach(function (L, k) {
        var s = L.tint
          ? '底 ' + L.tint.basePct + '% + ' + L.tint.items.map(function (it) {
              return it.pigment.code + ' ' + it.pigment.name + ' ' + it.pct + '%';
            }).join(' + ')
          : L.hex;
        out.push('  第 ' + (k + 1) + ' 层 ' + L.name + '（' + L.hex + '）：' + s);
      });
    }

  }

  function copyRecipe() {
    var text = recipeText();
    if (!text) { toast('还没有配方'); return; }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制'); }, fallback);
    } else {
      fallback();
    }

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-2000px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast('已复制');
      } catch (e) {
        toast('复制失败');
      }
      document.body.removeChild(ta);
    }
  }

  function downloadRecipe() {
    var text = recipeText();
    if (!text) { toast('还没有配方'); return; }

    var blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '郡士调色_' + state.targetHex.replace('#', '') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

      // --------------------------------------------------------------
  // 照片分析
  // --------------------------------------------------------------
  var photo = {
    marks: [],
    kindOverride: {},
    hidden: {},
    samples: null,
    bg: null,
    loaded: false,
    baseImageData: null,
    assign: null,
    centroids: null,
    clusters: null,
    clusterRGB: null,
    ignored: null,
    shown: [],
    gain: null,
    mode: 'mask'
  };

  function openModal() {
    $('analyzeModal').hidden = false;
    if (photo.loaded) {
      renderCanvas(photo.mode, null);
      layoutBadges();
    }
  }

  function closeModal() {
    $('analyzeModal').hidden = true;
  }

  function bindPhoto() {
    $('analyzeBtn').addEventListener('click', openModal);
    if ($('dbgBtn')) $('dbgBtn').addEventListener('click', photoDebug);
    [].forEach.call(document.querySelectorAll('.light-opt[data-light]'), function (b) {
      b.addEventListener('click', function () { setLight(b.dataset.light); });
    });
    [].forEach.call(document.querySelectorAll('.style-opt[data-style]'), function (b) {
      b.addEventListener('click', function () { setStyle(b.dataset.style); });
    });
    $('modalClose').addEventListener('click', closeModal);

    $('analyzeModal').addEventListener('click', function (ev) {
      if (ev.target === ev.currentTarget) closeModal();
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('analyzeModal').hidden) closeModal();
    });

    $('measureBtn').addEventListener('click', function () {
      photo.measureStep = 1;
      photo.measure = {};
      $('measureBtn').classList.add('active');
      $('resultTitle').textContent = '先点这块的高光（最亮的那一小块）';
    });

    $('pickWhite').addEventListener('click', function () {
      photo.picking = !photo.picking;
      $('pickWhite').classList.toggle('active', photo.picking);
      $('resultTitle').textContent = photo.picking
        ? '点画面里的白纸、灰卡或白色零件'
        : '分析结果';
    });

    document.addEventListener('paste', function (ev) {
      if ($('analyzeModal').hidden) return;
      var items = ev.clipboardData && ev.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') === 0) {
          var f = items[i].getAsFile();
          if (f) { loadPhoto(f); ev.preventDefault(); return; }
        }
      }
    });

    $('analyzeModal').addEventListener('dragover', function (ev) { ev.preventDefault(); });
    $('analyzeModal').addEventListener('drop', function (ev) {
      ev.preventDefault();
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f && f.type.indexOf('image') === 0) loadPhoto(f);
    });

    $('photoInput').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (file) loadPhoto(file);
    });

    ['wbToggle', 'bgToggle', 'clusterK'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        if (photo.loaded) runAnalysis();
      });
    });

    var modes = document.querySelectorAll('.mode');
    for (var i = 0; i < modes.length; i++) {
      modes[i].addEventListener('click', function (ev) {
        setMode(ev.currentTarget.dataset.mode);
      });
    }

    window.addEventListener('resize', function () {
      if (!$('analyzeModal').hidden) layoutBadges();
    });

    // 拖框选择
    var drag = null;
    var skipClick = false;

    $('photoCanvas').addEventListener('pointerdown', function (ev) {
      if (!photo.loaded) return;
      var box = $('photoCanvas').getBoundingClientRect();
      drag = { x0: ev.clientX - box.left, y0: ev.clientY - box.top, box: box };
      $('dragBox').hidden = true;
    });

    window.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.box.left;
      var dy = ev.clientY - drag.box.top;

      if (Math.abs(dx - drag.x0) < 4 && Math.abs(dy - drag.y0) < 4) return;

      var db = $('dragBox');
      db.hidden = false;
      db.style.left = Math.min(drag.x0, dx) + 'px';
      db.style.top = Math.min(drag.y0, dy) + 'px';
      db.style.width = Math.abs(dx - drag.x0) + 'px';
      db.style.height = Math.abs(dy - drag.y0) + 'px';
    });

    window.addEventListener('pointerup', function (ev) {
      if (!drag) return;
      var d = drag;
      drag = null;
      $('dragBox').hidden = true;

      var dx = ev.clientX - d.box.left;
      var dy = ev.clientY - d.box.top;
      if (Math.abs(dx - d.x0) < 6 && Math.abs(dy - d.y0) < 6) return;   // 当点击处理

      var cv2 = $('photoCanvas');
      var sx = cv2.width / d.box.width;
      var sy = cv2.height / d.box.height;

      var m = E.rectRegion(photo.baseImageData.data, cv2.width, cv2.height,
        Math.round(d.x0 * sx), Math.round(d.y0 * sy),
        Math.round(dx * sx), Math.round(dy * sy));

      if (!m) return;
      skipClick = true;
      photo.mark = m;
      setTarget(m.hex);
      addMark(m);
      renderCanvas('mark', null);
    });

    $('photoCanvas').addEventListener('click', function (ev) {
      if (skipClick) { skipClick = false; return; }

      var cv = ev.currentTarget;
      if (!photo.loaded || !photo.baseImageData) return;

      var rect = cv.getBoundingClientRect();
      var x = Math.round((ev.clientX - rect.left) * (cv.width / rect.width));
      var y = Math.round((ev.clientY - rect.top) * (cv.height / rect.height));
      x = Math.min(cv.width - 1, Math.max(0, x));
      y = Math.min(cv.height - 1, Math.max(0, y));

      var i = (y * cv.width + x) * 4;
      var d = photo.baseImageData.data;

      if (photo.picking) {
        photo.whiteRef = [d[i], d[i + 1], d[i + 2]];
        photo.picking = false;
        $('pickWhite').classList.remove('active');
        runAnalysis();
        return;
      }

      if (photo.measureStep) {
        var rgbM = E.wbRGB([d[i], d[i + 1], d[i + 2]], photo.gain);

        if (photo.measureStep === 1) {
          photo.measure.hl = rgbM;
          photo.measureStep = 2;
          $('resultTitle').textContent = '再点这块的中间调（不反光的地方）';
        } else {
          photo.measure.mid = rgbM;
          photo.measureStep = 0;
          $('measureBtn').classList.remove('active');
          showMeasureCard(E.judgeMetallic(photo.measure.hl, photo.measure.mid));
        }
        return;
      }

      var mark = E.growRegion(photo.baseImageData.data, cv.width, cv.height, x, y, {});
      if (!mark) {
        var rgb0 = E.wbRGB([d[i], d[i + 1], d[i + 2]], photo.gain);
        setTarget(E.rgbToHex(rgb0[0], rgb0[1], rgb0[2]));
        return;
      }

      photo.mark = mark;
      setTarget(mark.hex);
      addMark(mark);
      renderCanvas('mark', null);
    });
  }

  function photoDebug() {
    var im = $('photoImg');
    var cv = $('photoCanvas');
    var out = $('dbgOut');
    var lines = [];

    lines.push('页面版本 ' + (($('appVer') || {}).textContent || '?'));
    lines.push('UA ' + navigator.userAgent.slice(0, 90));
    lines.push('视口 ' + window.innerWidth + '×' + window.innerHeight + ' · DPR ' + (window.devicePixelRatio || 1));

    if (im) {
      var ir = im.getBoundingClientRect();
      lines.push('img 显示 ' + Math.round(ir.width) + '×' + Math.round(ir.height) +
        ' · 原图 ' + im.naturalWidth + '×' + im.naturalHeight +
        ' · 完成 ' + im.complete + ' · hidden ' + im.hidden +
        ' · display ' + getComputedStyle(im).display);
    } else {
      lines.push('img 元素不存在');
    }

    if (cv) {
      var cr = cv.getBoundingClientRect();
      lines.push('canvas 属性 ' + cv.width + '×' + cv.height +
        ' · 显示 ' + Math.round(cr.width) + '×' + Math.round(cr.height) +
        ' · hidden ' + cv.hidden +
        ' · display ' + getComputedStyle(cv).display +
        ' · opacity ' + getComputedStyle(cv).opacity);

      try {
        var ctx = cv.getContext('2d');
        var d1 = ctx.getImageData(2, 2, 1, 1).data;
        var d2 = ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
        lines.push('canvas 像素 左上 [' + [d1[0], d1[1], d1[2], d1[3]].join(',') + '] 中心 [' +
          [d2[0], d2[1], d2[2], d2[3]].join(',') + ']');
      } catch (e) {
        lines.push('canvas 读像素失败 ' + e.message);
      }
    } else {
      lines.push('canvas 元素不存在');
    }

    if (photo.baseImageData) {
      var b = photo.baseImageData.data;
      var mid = (Math.floor(photo.baseImageData.height / 2) * photo.baseImageData.width +
        Math.floor(photo.baseImageData.width / 2)) * 4;
      lines.push('分析数据 ' + photo.baseImageData.width + '×' + photo.baseImageData.height +
        ' · 中心 [' + [b[mid], b[mid + 1], b[mid + 2], b[mid + 3]].join(',') + ']');
    } else {
      lines.push('还没有分析数据');
    }

    lines.push('模式 ' + photo.mode + ' · 色块 ' + (photo.shown ? photo.shown.length : 0));

    out.textContent = lines.join(String.fromCharCode(10));
    out.hidden = false;
  }

  function showPhotoError(msg) {
    var cv = $('photoCanvas');
    if (cv) cv.hidden = true;
    var im = $('photoImg');
    if (im) { im.hidden = true; im.removeAttribute('src'); }
    var t = $('resultTitle');
    if (t) {
      t.hidden = false;
      t.textContent = msg;
    }
    var lb = $('lightBar');
    if (lb) lb.hidden = true;
    var meta = $('imgMeta');
    if (meta) meta.textContent = '';
  }

  function loadPhoto(file) {
    var url = URL.createObjectURL(file);
    var img = new Image();

    img.onerror = function () {
      showPhotoError('这张图打不开：可能是 HEIC 或损坏的文件。换成 JPG / PNG 再试一次。');
    };

    img.onload = function () {
      // 统一显示尺寸：小图放大、大图缩小，都装进同一个框
      // 小屏压得更狠：手机 WebView 对大画布的内存很敏感
      var small = (window.innerWidth || 1000) < 820;
      var boxW = small ? 720 : 1000;
      var boxH = small ? 720 : 640;
      var scale = Math.min(boxW / img.width, boxH / img.height);
      scale = Math.max(0.15, Math.min(scale, 3));
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));

      var cv = $('photoCanvas');
      cv.width = w;
      cv.height = h;
      cv.hidden = false;
      var im = $('photoImg');
      if (im) {
        im.src = url;
        im.hidden = false;
        im.style.maxWidth = '100%';
      }
      var ctx = cv.getContext('2d');

      try {
        // 先铺白底：带透明通道的 PNG 直接画会"看不见"，分析也会读到空白
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
      } catch (err) {
        showPhotoError('这张图浏览器处理不了（可能太大或格式特殊），换一张 JPG 试试');
        return;
      }

      try {
        photo.baseImageData = cv.getContext('2d').getImageData(0, 0, w, h);
      } catch (err) {
        showPhotoError('读不出图片像素（画布太大或被浏览器限制），换一张小一点的照片');
        return;
      }
      if ($('imgMeta')) $('imgMeta').textContent = '已载入 ' + img.width + '×' + img.height;

      // 顺带判断：整张图是不是几乎一个颜色（纯色截图、透明底）
      (function () {
        var d = photo.baseImageData.data;
        var s = 0, s2 = 0, n = 0;
        for (var i = 0; i < d.length; i += 4 * 37) {
          var l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          s += l; s2 += l * l; n++;
        }
        var mean = s / n;
        var varr = Math.max(0, s2 / n - mean * mean);
        photo.flatImage = Math.sqrt(varr) < 3;
      })();

      photo.mark = null;
      photo.marks = [];
      photo.kindOverride = {};
      photo.hidden = {};
      $('markCard').hidden = true;

      try {
        var gloss = E.analyzeGloss(photo.baseImageData.data, w, h);
        var line = $('glossLine');
        line.innerHTML = '';
        line.appendChild(document.createTextNode('漆面：'));
        var lb = document.createElement('b');
        lb.textContent = gloss.level;
        line.appendChild(lb);
        line.appendChild(document.createTextNode(
          ' · 高光占比 ' + (gloss.ratio * 100).toFixed(1) +
          '% · 边缘锐度 ' + gloss.sharpness.toFixed(0)
        ));
        var sub = document.createElement('div');
        sub.textContent = gloss.hint;
        line.appendChild(sub);
      } catch (err) { /* 光泽判定失败不影响其他 */ }


      collectSamples();
      photo.loaded = true;
      $('modeRow').hidden = false;
      $('photoHint').textContent = '分区图上的编号对应右边的色块；点画面任意位置可以取单点色。';

      runAnalysis();
      URL.revokeObjectURL(url);
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      toast('图片读不了');
    };

    img.src = url;
  }

  /** 采样像素，顺便用四周边缘估一个背景色 */
  function collectSamples() {
    var cv = $('photoCanvas');
    var data = photo.baseImageData.data;
    var w = cv.width, h = cv.height;
    var stride = Math.max(1, Math.round(Math.sqrt((w * h) / 15000)));

    function lum(x, y) {
      var i = (y * w + x) * 4;
      return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }

    var flat = [];
    var edge = [];
    var eR = 0, eG = 0, eB = 0, eN = 0;

    for (var y = 0; y < h; y += stride) {
      for (var x = 0; x < w; x += stride) {
        var i = (y * w + x) * 4;
        var rgb = [data[i], data[i + 1], data[i + 2]];
        edge.push(rgb);

        if (y < h * 0.1 || y > h * 0.9 || x < w * 0.1 || x > w * 0.9) {
          eR += rgb[0]; eG += rgb[1]; eB += rgb[2]; eN++;
        }

        // 只收平坦区域的像素：边缘、颗粒、高光边界都会污染颜色
        if (x > 1 && y > 1 && x < w - 2 && y < h - 2) {
          var gx = Math.abs(lum(x + 1, y) - lum(x - 1, y));
          var gy = Math.abs(lum(x, y + 1) - lum(x, y - 1));
          if (gx + gy < 12) flat.push(rgb);
        }
      }
    }

    photo.samples = flat.length > edge.length * 0.25 ? flat : edge;
    photo.flatRatio = edge.length ? flat.length / edge.length : 0;
    photo.bg = eN ? [Math.round(eR / eN), Math.round(eG / eN), Math.round(eB / eN)] : null;
  }

  function runAnalysis() {
    if (!photo.samples) return;

    var k = Number($('clusterK').value) || 6;
    var ignoreBg = $('bgToggle').checked && photo.bg;

    // 始终估一次光源，用来显示"这张图什么光"
    var estGain = photo.whiteRef ? E.wbGain(photo.whiteRef) : E.shadesOfGray(photo.samples, 6);
    var useWB = $('wbToggle').checked;
    var gain = useWB ? estGain : null;

    var t0 = now();
    var res = E.analyzeImage(photo.samples, { k: k, gain: gain });

    var light = E.estimateLight(estGain);

    // 估出来的色温直接决定六张卡的方向（用户还能手动改）
    if (light && typeof setLight === 'function') {
      setLight(light.cct && light.cct < 4500 ? 'warm' : (light.cct && light.cct > 6000 ? 'cool' : 'neutral'));
    }
    var lb = $('lightBar');
    if (lb) {
      if (light) {
        lb.hidden = false;
        lb.innerHTML = '';
        var dot = document.createElement('i');
        dot.style.background = light.swatch;
        var txt = document.createElement('span');
        txt.innerHTML = '光源 <b>' + light.label + '</b>（约 ' + light.cct + 'K）' +
          (useWB ? ' <em>· 已自动校正</em>' : ' <em>· 未校正</em>');
        lb.appendChild(dot);
        lb.appendChild(txt);
      } else {
        lb.hidden = true;
      }
    }

    var cv = $('photoCanvas');
    photo.gain = res.gain;
    var raw = E.classifyPixels(photo.baseImageData.data, cv.width, cv.height, res.centers, res.gain);
    if (res.indexMap) {
      for (var ri = 0; ri < raw.length; ri++) raw[ri] = res.indexMap[raw[ri]] || 0;
    }
    photo.assign = E.smoothLabels(raw, cv.width, cv.height);

    // 用整图像素重算占比，比抽样更准
    var n = res.clusters.length;
    var counts = new Array(n).fill(0);
    for (var p = 0; p < photo.assign.length; p++) counts[photo.assign[p]]++;

    var total = cv.width * cv.height;
    res.clusters.forEach(function (c, i) {
      c.share = counts[i] / total;
      c.index = i;
    });

    // 背景判定
    // 背景参考也要走同一套白平衡，否则拿“暖光下的背景”去比“校正后的色块”，永远对不上
    var bgRGB = photo.bg;
    if (bgRGB && gain) bgRGB = E.wbRGB(bgRGB, gain);
    var bgHex = bgRGB ? E.rgbToHex(bgRGB[0], bgRGB[1], bgRGB[2]) : null;
    var bgLab = bgHex ? E.labOfHex(bgHex) : null;
    photo.ignored = {};
    if (ignoreBg && bgLab) {
      res.clusters.forEach(function (c) {
        if (E.deltaE00(c.lab, bgLab) < 9) photo.ignored[c.index] = true;
      });
    }

    photo.clusters = res.clusters;
    photo.clusterRGB = res.clusters.map(function (c) {
      var rgb = E.hexToRgb(c.hex);
      return [rgb.r, rgb.g, rgb.b];
    });

    // 每块的平均亮度：分区图只保留一点点明暗，别把原图的阴影照搬
    var lSum = new Array(res.clusters.length).fill(0);
    var lCnt = new Array(res.clusters.length).fill(0);
    for (var q = 0; q < photo.assign.length; q++) {
      var iq = q * 4;
      var lq = photo.baseImageData.data[iq] * 0.299 + photo.baseImageData.data[iq + 1] * 0.587 + photo.baseImageData.data[iq + 2] * 0.114;
      lSum[photo.assign[q]] += lq;
      lCnt[photo.assign[q]]++;
    }
    photo.clusterL = lSum.map(function (s, i) { return lCnt[i] ? s / lCnt[i] : 128; });

    buildCentroids(cv.width, cv.height);
    photo.shown = res.clusters.filter(function (c) { return !photo.ignored[c.index] && !photo.hidden[c.index]; });
    photo.accents = res.accents || [];

    // 百分比按“模型本身”归一：背景被剔除后不该再算进分母
    var shownCount = 0;
    photo.shown.forEach(function (c) { shownCount += counts[c.index]; });
    if (shownCount > 0) {
      photo.shown.forEach(function (c) { c.share = counts[c.index] / shownCount; });
    }

    renderList();
    setMode('photo');

    var codes = [];
    photo.shown.forEach(function (c) {
      var n = E.nearestPaint(c.hex);
      if (n.deltaE < 6 && codes.indexOf(n.pigment.code) < 0) codes.push(n.pigment.code);
    });

    photo.summaryText = null;

    if (photo.flatImage) {
      $('resultTitle').textContent = '这张图几乎是纯色（可能是纯白截图或透明底），分析结果没有意义——换一张有模型主体的照片';
      $('resultTitle').hidden = false;
      return;
    }

    $('resultTitle').textContent = '大概用了 ' + (codes.length || photo.shown.length) + ' 支漆' +
      (codes.length ? '：' + codes.slice(0, 4).join('、') : '') + '  ·  ' + photo.shown.length + ' 块主色' +
      (res.wb ? ' · 已校正光线' : '');

    photo.summaryText = $('resultTitle').textContent;
  }

  /** 每块的重心，用来放编号；重心落在别的区域时就近找一个本块像素 */
  function buildCentroids(w, h) {
    var n = photo.clusters.length;
    var sx = new Float64Array(n), sy = new Float64Array(n), cnt = new Float64Array(n);

    for (var p = 0; p < w * h; p++) {
      var a = photo.assign[p];
      sx[a] += p % w;
      sy[a] += Math.floor(p / w);
      cnt[a]++;
    }

    photo.centroids = [];

    for (var i = 0; i < n; i++) {
      if (!cnt[i]) { photo.centroids.push(null); continue; }

      var cx = sx[i] / cnt[i];
      var cy = sy[i] / cnt[i];
      var best = null;
      var bd = Infinity;

      for (var y = 0; y < h; y += 2) {
        for (var x = 0; x < w; x += 2) {
          if (photo.assign[y * w + x] !== i) continue;
          var d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (d < bd) { bd = d; best = [x, y]; }
        }
      }

      photo.centroids.push(best || [Math.round(cx), Math.round(cy)]);
    }
  }

  function addMark(m) {
    if (!photo.marks) photo.marks = [];
    m.kind = m.kind || 'solid';

    // 颜色几乎一样的，替换而不是重复添加
    var dup = -1;
    for (var i = 0; i < photo.marks.length; i++) {
      if (E.deltaE00(photo.marks[i].lab, m.lab) < 2) { dup = i; break; }
    }
    if (dup >= 0) photo.marks[dup] = m;
    else photo.marks.push(m);

    renderList();
    showMarkCard(m);
  }

  function markLabel(m) {
    var near = E.nearestPaint(m.hex, m.kind === 'solid' ? null : m.kind) || E.nearestPaint(m.hex);
    var name = near.pigment.code + ' ' + near.pigment.name;
    if (m.kind === 'metal') name = E.metalName(m.lab) + ' · ' + name;
    return { near: near, text: nearLabel(near.deltaE) + ' · ' + name };
  }

  function markRow(m, num) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cc cc-accent';

    var sw = document.createElement('span');
    sw.className = 'cc-sw';
    sw.style.background = m.hex;

    var main = document.createElement('span');
    main.className = 'cc-main';

    var head = document.createElement('span');
    head.className = 'cc-hex';
    var idx = document.createElement('span');
    idx.className = 'cc-idx';
    idx.textContent = num;
    head.appendChild(idx);
    head.appendChild(document.createTextNode(m.hex));

    var em = document.createElement('em');
    em.textContent = (m.share * 100).toFixed(1) + '%';
    head.appendChild(em);

    var paint = document.createElement('span');
    paint.className = 'cc-paint';
    paint.textContent = markLabel(m).text;

    if (m.kind !== 'solid') {
      var tag = document.createElement('em');
      tag.className = 'sheen';
      tag.textContent = { metal: '金属', pearl: '珠光', clear: '透明' }[m.kind] || '';
      paint.appendChild(tag);
    }

    main.appendChild(head);
    main.appendChild(paint);
    btn.appendChild(sw);
    btn.appendChild(main);

    btn.addEventListener('click', function () {
      showMarkCard(m);
      renderCanvas('mark', null);
    });

    btn.addEventListener('contextmenu', function (ev) {
      openMenu(ev, [
        {
          label: '重新选择',
          run: function () {
            showMarkCard(m);
            renderCanvas('mark', null);
          }
        },
        {
          label: '删除这条标记',
          danger: true,
          run: function () {
            var idx = photo.marks.indexOf(m);
            if (idx >= 0) photo.marks.splice(idx, 1);
            renderList();
          }
        }
      ]);
    });

    return btn;
  }

  function showMeasureCard(r) {
    if (photo.summaryText) $('resultTitle').textContent = photo.summaryText;

    var card = $('markCard');
    card.innerHTML = '';
    card.hidden = false;

    function chip(hex) {
      var s = document.createElement('span');
      s.className = 'sw';
      s.style.background = hex;
      s.title = hex;
      return s;
    }

    var body = document.createElement('div');
    body.className = 'body';

    var l1 = document.createElement('div');
    l1.className = 'l1';
    var strong = document.createElement('b');
    strong.textContent = r.verdict;
    l1.appendChild(strong);
    l1.appendChild(document.createTextNode('  ' + r.hlHex + ' / ' + r.midHex));
    body.appendChild(l1);

    var l2 = document.createElement('div');
    l2.className = 'l2';
    l2.textContent = '亮度差 ' + r.dL.toFixed(0) + ' · 彩度比 ' + r.satRatio.toFixed(2) + ' · 色相差 ' + r.dHue.toFixed(0) + '°';
    body.appendChild(l2);

    var row = document.createElement('div');
    row.className = 'kind-row';

    var use = document.createElement('button');
    use.type = 'button';
    use.className = 'kind-btn use';
    use.textContent = '用中间调这个色';
    use.addEventListener('click', function () {
      setTarget(r.midHex, { kind: r.kind });
      closeModal();
    });
    row.appendChild(use);

    body.appendChild(row);

    card.appendChild(chip(r.hlHex));
    card.appendChild(chip(r.midHex));
    card.appendChild(body);
  }

  function showMarkCard(m) {
    var card = $('markCard');
    photo.mark = m;
    m.kind = m.kind || 'solid';

    var KINDS = [
      { id: 'solid', name: '实色' },
      { id: 'metal', name: '金属' },
      { id: 'pearl', name: '珠光' },
      { id: 'clear', name: '透明' }
    ];

    function rerender() {
      card.innerHTML = '';
      card.hidden = false;

      var sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.background = m.hex;

      var body = document.createElement('div');
      body.className = 'body';

      // 按用户选的漆种去找最接近的漆
      var near = E.nearestPaint(m.hex, m.kind === 'solid' ? null : m.kind) || E.nearestPaint(m.hex);

      var label = near.pigment.code + ' ' + near.pigment.name;
      if (m.kind === 'metal') label = E.metalName(m.lab) + ' · ' + label;

      var l1 = document.createElement('div');
      l1.className = 'l1';
      var b = document.createElement('b');
      b.textContent = m.hex;
      l1.appendChild(b);
      l1.appendChild(document.createTextNode('  ' + nearLabel(near.deltaE) + ' · ' + label));
      body.appendChild(l1);

      var l2 = document.createElement('div');
      l2.className = 'l2';
      l2.textContent = '占 ' + (m.share * 100).toFixed(1) + '%' +
        (m.lMax ? ' · 明度 ' + m.lMin + '–' + m.lMax : '') +
        (m.grain != null ? ' · 颗粒 ' + m.grain.toFixed(0) : '');
      body.appendChild(l2);

      // 漆种切换
      var row = document.createElement('div');
      row.className = 'kind-row';

      KINDS.forEach(function (k) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kind-btn' + (m.kind === k.id ? ' active' : '');
        btn.textContent = k.name;
        btn.addEventListener('click', function () {
          m.kind = k.id;
          if (m.clusterIndex != null) photo.kindOverride[m.clusterIndex] = k.id;
          if (m.overrideKey) photo.kindOverride[m.overrideKey] = k.id;
          rerender();
          renderList();
        });
        row.appendChild(btn);
      });

      var use = document.createElement('button');
      use.type = 'button';
      use.className = 'kind-btn use';
      use.textContent = '用这个色';
      use.addEventListener('click', function () {
        setTarget(m.hex, { kind: m.kind });
        closeModal();
      });
      row.appendChild(use);

      body.appendChild(row);
      card.appendChild(sw);
      card.appendChild(body);
    }

    rerender();
  }

  function openMenu(ev, items) {
    ev.preventDefault();

    var menu = $('ctxMenu');
    menu.innerHTML = '';
    menu.hidden = false;

    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      if (it.danger) b.className = 'danger';
      b.addEventListener('click', function () {
        menu.hidden = true;
        it.run();
      });
      menu.appendChild(b);
    });

    menu.style.left = Math.min(ev.clientX, window.innerWidth - 150) + 'px';
    menu.style.top = Math.min(ev.clientY, window.innerHeight - 120) + 'px';
  }

  document.addEventListener('click', function () { $('ctxMenu').hidden = true; });
  document.addEventListener('contextmenu', function (ev) {
    if (!ev.target.closest('.cc')) $('ctxMenu').hidden = true;
  });

  /** 试一下：再加一支没勾的漆，看能不能明显变准 */
  function finishOf(p) {
    var n = (p.note || '') + (p.name || '');
    if (n.indexOf('消光') >= 0) return 'matte';
    if (n.indexOf('半光') >= 0) return 'semi';
    if (n.indexOf('光泽') >= 0) return 'gloss';
    return '';
  }

  function bestMissingPigment(res, selected) {
    var bulkFinish = res.items.length ? finishOf(res.items[0].pigment) : '';
    var targetLab = E.labOfHex(res.target.hex);
    var targetHue = Math.atan2(targetLab[2], targetLab[1]) * 180 / Math.PI;

    var pool = E.PIGMENTS.filter(function (p) {
      if (selected.indexOf(p.code) >= 0) return false;
      if (p.kind !== 'solid' && p.kind !== 'pearl') return false;
      var lab = E.labOfHex(p.hex);
      return Math.hypot(lab[1], lab[2]) > 8;
    }).map(function (p) {
      var lab = E.labOfHex(p.hex);
      var h = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
      var d = Math.abs(h - targetHue);
      if (d > 180) d = 360 - d;
      return { p: p, dist: d, sameFinish: !bulkFinish || finishOf(p) === bulkFinish };
    }).sort(function (x, y) { return x.dist - y.dist; });

    function tryList(list) {
      var best = null;
      list.slice(0, 5).forEach(function (c) {
        var r = null;
        try {
          r = E.solveMixed({
            targetHex: res.target.hex,
            pigmentIds: selected.concat([c.p.code]),
            volume: 100
          });
        } catch (err) { r = null; }
        if (!r || !r.ok) return;
        if (!best || r.deltaE < best.de) best = { code: c.p.code, name: c.p.name, de: r.deltaE };
      });
      return best && best.de < res.deltaE - 0.8 ? best : null;
    }

    // 先只从"同光泽"里挑，实在没有再看别的
    var same = pool.filter(function (x) { return x.sameFinish; });
    var other = pool.filter(function (x) { return !x.sameFinish; });
    return tryList(same) || tryList(other);
  }

  function renderList() {
    var noise = null;
    try { noise = E.noiseReport(photo.shown); } catch (e) { noise = null; }
    var nb = $('noiseBox');
    if (nb) {
      if (noise) {
        nb.hidden = false;
        nb.className = 'noise-box' + (noise.level === 'warn' ? ' warn' : '');
        nb.innerHTML = '<b>信噪比</b> · ' + noise.lines.join(' ');
      } else {
        nb.hidden = true;
      }
    }

    var list = $('clusterList');
    list.innerHTML = '';

    // 顶部色板：一眼看到提取出来的颜色
    var strip = $('paletteStrip');
    strip.innerHTML = '';
    photo.shown.forEach(function (c, idx) {
      var chip = document.createElement('div');
      chip.className = 'pal-chip';
      chip.style.background = c.hex;
      chip.style.flexGrow = Math.max(2, c.share * 100);
      chip.textContent = idx + 1;
      chip.title = c.hex + ' · ' + (c.share * 100).toFixed(1) + '%';
      strip.appendChild(chip);
    });

    photo.shown.forEach(function (c, idx) {
      list.appendChild(clusterRow(c, idx + 1));
    });

    if (photo.accents && photo.accents.length) {
      var sep = document.createElement('div');
      sep.className = 'accent-title';
      sep.textContent = '点缀色（面积小，但确实是这个色）';
      list.appendChild(sep);

      photo.accents.forEach(function (c, i) {
        list.appendChild(accentRow(c, i + 1));
      });
    }

    if (photo.marks && photo.marks.length) {
      var mt = document.createElement('div');
      mt.className = 'accent-title';
      mt.textContent = '手动标记（' + photo.marks.length + '）';
      list.appendChild(mt);

      photo.marks.forEach(function (m, i) {
        list.appendChild(markRow(m, i + 1));
      });
    }

    if (!photo.shown.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '没拆出主色，换个拆分数量或关掉「忽略背景」试试';
      list.appendChild(empty);
    }
  }

  function clusterRow(c, num) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cc';
    btn.title = '点一下，把这个颜色设成目标色';

    var sw = document.createElement('span');
    sw.className = 'cc-sw';
    sw.style.background = c.hex;

    var main = document.createElement('span');
    main.className = 'cc-main';

    var head = document.createElement('span');
    head.className = 'cc-hex';

    var idx = document.createElement('span');
    idx.className = 'cc-idx';
    idx.textContent = num;
    head.appendChild(idx);

    head.appendChild(document.createTextNode(c.hex));

    var em = document.createElement('em');
    em.textContent = (c.share * 100).toFixed(0) + '%';
    head.appendChild(em);

    var kind = photo.kindOverride[c.index] || 'solid';
    var near = E.nearestPaint(c.hex, kind === 'solid' ? null : kind) || E.nearestPaint(c.hex);

    var paint = document.createElement('span');
    paint.className = 'cc-paint';

    var lab = document.createElement('b');
    lab.textContent = nearLabel(near.deltaE);
    paint.appendChild(lab);

    var label = near.pigment.code + ' ' + near.pigment.name;
    if (kind === 'metal') label = E.metalName(c.lab) + ' · ' + label;

    paint.appendChild(document.createTextNode(' · ' + label));

    if (kind !== 'solid') {
      var ktag = document.createElement('em');
      ktag.className = 'sheen';
      ktag.textContent = { metal: '金属', pearl: '珠光', clear: '透明' }[kind] || '';
      paint.appendChild(ktag);
    } else if (c.sheen && c.sheen !== '实色') {
      var tag = document.createElement('em');
      tag.className = 'sheen';
      tag.textContent = c.sheen;
      tag.title = '亮部与暗部色相差 ' + c.dHue.toFixed(0) + '°，彩度比 ' + c.cRatio.toFixed(2);
      paint.appendChild(tag);
    }

    main.appendChild(head);
    main.appendChild(paint);

    // 只有“不像”的时候才给配方，别一上来就丢一堆数字
    if (near.deltaE > 3) {
      var r = null;
      try {
        r = E.solve({ targetHex: c.hex, pigmentIds: state.selected, total: state.total, _noHint: true });
      } catch (err) { r = null; }

      if (r && r.ok && r.lines.length) {
        var mix = document.createElement('span');
        mix.className = 'cc-mix';
        var top = r.lines.slice(0, 3).map(function (l) {
          return shortName(l.pigment) + ' ' + fmtPct(l.percent) + '%';
        }).join(' + ');
        if (r.lines.length > 3) top += ' 等';
        mix.textContent = '没有现成的，可以调：' + top;
        main.appendChild(mix);
      }
    }

    btn.appendChild(sw);
    btn.appendChild(main);

    btn.addEventListener('click', function () {
      var mask = new Uint8Array(photo.assign.length);
      var cnt = 0;
      for (var i = 0; i < photo.assign.length; i++) {
        if (photo.assign[i] === c.index) { mask[i] = 1; cnt++; }
      }
      c.kind = photo.kindOverride[c.index] || 'solid';
      showMarkCard({
        mask: mask, count: cnt, share: c.share, hex: c.hex, lab: c.lab,
        lMin: c.lMin, lMax: c.lMax, dHue: c.dHue, cRatio: c.cRatio,
        sheen: c.sheen, kind: c.kind, clusterIndex: c.index
      });
      renderCanvas('mark', null);
    });

    btn.addEventListener('contextmenu', function (ev) {
      openMenu(ev, [
        {
          label: '重新选择',
          run: function () {
            var mask = new Uint8Array(photo.assign.length);
            var cnt = 0;
            for (var i = 0; i < photo.assign.length; i++) {
              if (photo.assign[i] === c.index) { mask[i] = 1; cnt++; }
            }
            showMarkCard({
              mask: mask, count: cnt, share: c.share, hex: c.hex, lab: c.lab,
              lMin: c.lMin, lMax: c.lMax, dHue: c.dHue, cRatio: c.cRatio,
              sheen: c.sheen, kind: photo.kindOverride[c.index] || 'solid', clusterIndex: c.index
            });
            renderCanvas('mark', null);
          }
        },
        {
          label: '删除这一块',
          danger: true,
          run: function () {
            photo.hidden[c.index] = true;
            photo.shown = photo.shown.filter(function (x) { return x.index !== c.index; });
            renderList();
            setMode('photo');
          }
        }
      ]);
    });

    btn.addEventListener('mouseenter', function () {
      renderCanvas('photo', c.index);
    });

    btn.addEventListener('mouseleave', function () {
      renderCanvas(photo.mode, null);
    });

    return btn;
  }

  function accentRow(c, num) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cc cc-accent';
    btn.title = '点一下看这块，可以改漆种';

    var key = 'a:' + c.hex;
    var kind = photo.kindOverride[key] || 'solid';

    var sw = document.createElement('span');
    sw.className = 'cc-sw';
    sw.style.background = c.hex;

    var main = document.createElement('span');
    main.className = 'cc-main';

    var head = document.createElement('span');
    head.className = 'cc-hex';
    head.appendChild(document.createTextNode(c.hex));

    var em = document.createElement('em');
    em.textContent = (c.share * 100).toFixed(1) + '%';
    head.appendChild(em);

    var near = E.nearestPaint(c.hex, kind === 'solid' ? null : kind) || E.nearestPaint(c.hex);
    var paint = document.createElement('span');
    paint.className = 'cc-paint';
    var b = document.createElement('b');
    b.textContent = nearLabel(near.deltaE);
    paint.appendChild(b);

    var label = near.pigment.code + ' ' + near.pigment.name;
    if (kind === 'metal') label = E.metalName(c.lab) + ' · ' + label;
    paint.appendChild(document.createTextNode(' · ' + label));

    if (kind !== 'solid') {
      var ktag = document.createElement('em');
      ktag.className = 'sheen';
      ktag.textContent = { metal: '金属', pearl: '珠光', clear: '透明' }[kind] || '';
      paint.appendChild(ktag);
    }

    main.appendChild(head);
    main.appendChild(paint);
    btn.appendChild(sw);
    btn.appendChild(main);

    function open() {
      var mask = null;
      var cnt = 0;
      if (c.indices && c.indices.length) {
        mask = new Uint8Array(photo.assign.length);
        c.indices.forEach(function (i) { mask[i] = 1; cnt++; });
      }
      showMarkCard({
        mask: mask, count: cnt, share: c.share, hex: c.hex, lab: c.lab,
        lMin: 0, lMax: 0, sheen: '实色', kind: kind, overrideKey: key
      });
      if (mask) renderCanvas('mark', null);
    }

    btn.addEventListener('click', open);

    btn.addEventListener('contextmenu', function (ev) {
      openMenu(ev, [
        { label: '重新选择', run: open },
        {
          label: '删除这条点缀',
          danger: true,
          run: function () {
            photo.accents = photo.accents.filter(function (x) { return x !== c; });
            renderList();
          }
        }
      ]);
    });

    return btn;
  }

  function setMode(mode) {
    photo.mode = mode;
    [].forEach.call(document.querySelectorAll('.mode'), function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    var modes = document.querySelectorAll('.mode');
    for (var i = 0; i < modes.length; i++) {
      modes[i].classList.toggle('active', modes[i].dataset.mode === mode);
    }

    renderCanvas(mode, null);
    layoutBadges();
  }

  function renderCanvas(mode, focus) {
    var cv = $('photoCanvas');
    if (!photo.baseImageData) return;

    var ctx = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    var src = photo.baseImageData.data;

    if (mode === 'photo' && focus == null) {
      ctx.putImageData(photo.baseImageData, 0, 0);
      return;
    }

    var out = ctx.createImageData(w, h);
    var dst = out.data;

    for (var p = 0; p < w * h; p++) {
      var a = photo.assign[p];
      var i = p * 4;
      var px = p % w;
      var py = (p - px) / w;

      if (mode === 'mark' && photo.mark) {
        if (photo.mark.mask[p]) {
          dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2];
        } else {
          var g1 = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;
          var v1 = 238 - (238 - g1) * 0.18;
          dst[i] = v1; dst[i + 1] = v1; dst[i + 2] = v1;
        }
      } else if (mode === 'mask') {
        // 保留原图明暗，叠上色块颜色；边界画深色线，模型轮廓还在
        var c = photo.ignored[a] ? [246, 245, 242] : photo.clusterRGB[a];
        var g0 = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;

        // 只留一点点明暗起伏，整体压平成色块
        var v = photo.ignored[a] ? 1 : Math.max(0.86, Math.min(1.12, g0 / (photo.clusterL[a] || 128)));

        dst[i] = c[0] * v;
        dst[i + 1] = c[1] * v;
        dst[i + 2] = c[2] * v;

        // 边界
        var right = px < w - 1 ? photo.assign[p + 1] : a;
        var down = py < h - 1 ? photo.assign[p + w] : a;
        if (right !== a || down !== a) {
          dst[i] *= 0.55; dst[i + 1] *= 0.55; dst[i + 2] *= 0.55;
        }
      } else if (focus != null) {
        if (a === focus) {
          dst[i] = src[i];
          dst[i + 1] = src[i + 1];
          dst[i + 2] = src[i + 2];
        } else if (photo.ignored[a]) {
          dst[i] = 250; dst[i + 1] = 249; dst[i + 2] = 247;
        } else {
          var g = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;
          var v = 226 - (226 - g) * 0.45;
          dst[i] = v;
          dst[i + 1] = v;
          dst[i + 2] = v;
        }
      } else {
        dst[i] = src[i];
        dst[i + 1] = src[i + 1];
        dst[i + 2] = src[i + 2];
      }

      dst[i + 3] = 255;
    }

    ctx.putImageData(out, 0, 0);
  }

  function layoutBadges() {
    var box = $('badges');
    box.innerHTML = '';

    var cv = $('photoCanvas');
    if (photo.mode !== 'mask' || !photo.centroids) return;

    var rect = cv.getBoundingClientRect();
    if (!rect.width || !cv.width) return;

    var sx = rect.width / cv.width;
    var sy = rect.height / cv.height;

    photo.shown.forEach(function (c, idx) {
      var pt = photo.centroids[c.index];
      if (!pt) return;

      var d = document.createElement('span');
      d.className = 'badge';
      d.textContent = idx + 1;
      d.style.left = (pt[0] * sx) + 'px';
      d.style.top = (pt[1] * sy) + 'px';
      box.appendChild(d);
    });
  }

// --------------------------------------------------------------
  // 事件绑定
  // --------------------------------------------------------------
  function bind() {
    $('colorInput').addEventListener('input', function (ev) {
      setTarget(ev.target.value, { defer: true });
    });

    $('hexInput').addEventListener('input', function (ev) {
      var n = normalizeHex(ev.target.value);
      if (n) setTarget(n, { keepInput: true, defer: true });
    });

    $('hexInput').addEventListener('blur', function (ev) {
      var n = normalizeHex(ev.target.value);
      ev.target.value = n || state.targetHex;
    });

    $('gunzeInput').addEventListener('change', function (ev) {
      var p = resolveGunze(ev.target.value);
      if (p) {
        ev.target.value = p.code;
        setTarget(p.hex);
      } else if (ev.target.value.trim()) {
        ev.target.value = '';
        toast('没有这个色号');
      }
    });

    $('pigSearch').addEventListener('input', function (ev) {
      var q = ev.target.value.trim().toLowerCase();
      var rows = document.querySelectorAll('#pigList .pig');
      for (var i = 0; i < rows.length; i++) {
        rows[i].hidden = q ? rows[i].dataset.k.indexOf(q) < 0 : false;
      }
    });

    function onTotal(ev) {
      var v = Number(ev.target.value);
      if (v > 0) {
        state.volume = v;
        compute();
      }
    }
    var tabs = document.querySelectorAll('.proc-tab');
    for (var ti = 0; ti < tabs.length; ti++) {
      tabs[ti].addEventListener('click', function (ev) {
        procState.id = ev.currentTarget.dataset.proc;
    procState.overrides = {};
        for (var k = 0; k < tabs.length; k++) tabs[k].classList.toggle('active', tabs[k] === ev.currentTarget);
        renderProcess();
      });
    }

    $('totalWeight').addEventListener('change', onTotal);
    $('totalWeight').addEventListener('input', onTotal);

    $('primerSel').addEventListener('change', updateLayers);

    $('copyBtn').addEventListener('click', copyRecipe);
    $('downloadBtn').addEventListener('click', downloadRecipe);

    bindPhoto();
    initSnr();
  }

  // --------------------------------------------------------------
  // 启动
  // --------------------------------------------------------------
  // 把 kb-data.js 里的内容挂进页面（改文案只改那个文件）
  function mountKb() {
    if (typeof KB_DATA === "undefined") return;
    var map = { airbrush: "airbrush", spray: "sprayDetail", art: "artDetail", fail: "failDetail" };
    Object.keys(map).forEach(function (k) {
      var el = $(map[k]);
      if (el && KB_DATA[k]) el.innerHTML = KB_DATA[k];
    });
  }

  // ---------------------------------------------------------------
  // 信噪比检测页
  // ---------------------------------------------------------------
  function initSnr() {
    var input = $('snrInput');
    if (!input) return;

    var STRIDE = 7;   // 采样步长（像素）
    var last = null;  // { samples, positions, w, h }

    function analyze(file) {
      var url = URL.createObjectURL(file);
      var img = new Image();

      img.onerror = function () {
        $('snrEmpty').hidden = false;
        $('snrEmpty').textContent = '这张图打不开，换 JPG / PNG 试试。';
        $('snrBody').hidden = true;
      };

      img.onload = function () {
        var scale = Math.min(1, 900 / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));

        var canvas = $('snrCanvas');
        var overlay = $('snrOverlay');
        if (!canvas || !overlay) return;

        var orig = $('snrOriginal');
        if (orig) orig.src = url;

        canvas.width = overlay.width = w;
        canvas.height = overlay.height = h;

        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        var data;
        try {
          data = ctx.getImageData(0, 0, w, h).data;
        } catch (e) {
          $('snrEmpty').hidden = false;
          $('snrEmpty').textContent = '读不出像素，换一张小一点的图。';
          return;
        }

        var samples = [], positions = [];
        for (var i = 0; i < w * h; i += STRIDE) {
          var p4 = i * 4;
          samples.push([data[p4], data[p4 + 1], data[p4 + 2]]);
          positions.push(i);
        }

        last = { samples: samples, positions: positions, w: w, h: h, data: data };
        render();
      };

      img.src = url;
    }

    function render() {
      if (!last) return;

      var k = Number($('snrK').value) || 6;

      // 频带信噪比：固定金字塔分带，无阈值
      var w = last.w, h = last.h;
      var luma = new Float32Array(w * h);
      for (var li = 0; li < w * h; li++) {
        var lp = li * 4;
        luma[li] = (last.data[lp] * 0.299 + last.data[lp + 1] * 0.587 + last.data[lp + 2] * 0.114) / 255;
      }

      var edgeW = Number(($('snrEdge') || {}).value) || 0.5;
      var bs = E.bandSnr(luma, w, h, { levels: 3, radius: 2, edgeWeight: edgeW });

      // 三个有出处的量（见页面下方标注）
      var rgbFlat = [];
      for (var ri = 0; ri < w * h; ri += 5) {
        var ro = ri * 4;
        rgbFlat.push(last.data[ro], last.data[ro + 1], last.data[ro + 2]);
      }
      var vivid = E.colorfulness(rgbFlat);
      var cbi = E.centerBias(luma, w, h);


      // 分区图（只作可视化，不参与打分）
      var seg = E.segmentRegions(luma, w, h, { minArea: Math.max(60, Math.round(w * h / 300)) });
      var octx = $('snrOverlay').getContext('2d');
      octx.clearRect(0, 0, w, h);
      var imgData = octx.createImageData(w, h);
      var dd = imgData.data;
      for (var pi = 0; pi < w * h; pi++) {
        var lab = seg.labels[pi];
        var o = pi * 4;
        if (seg.isEdge[pi]) { dd[o] = 46; dd[o + 1] = 44; dd[o + 2] = 40; dd[o + 3] = 130; continue; }
        if (lab < 0) { dd[o + 3] = 0; continue; }
        var rgb = hslToRgb(((lab * 137.508) % 360) / 360, 0.55, 0.58);
        dd[o] = rgb[0]; dd[o + 1] = rgb[1]; dd[o + 2] = rgb[2]; dd[o + 3] = 70;
      }
      octx.putImageData(imgData, 0, 0);

      // 颜色分层（参考信息）
      var res = E.analyzeImage(last.samples, { k: k });
      var merged = E.mergeSimilar(res.clusters, 6);
      last.merged = merged;
      var rep = E.layerReport(merged);
      var cEnt = E.colorEntropy(merged.map(function (c) { return c.lab; }));

      // 背景判定：只看左上和右上两块。
      // 一张模型照片，上方两角几乎总是背景；把整圈边都算进来会被底部的主体稀释。
      function cornerDominant(x0, x1, y0, y1) {
        var tally = {};
        var n = 0;
        for (var y = y0; y < y1; y += 3) {
          for (var x = x0; x < x1; x += 3) {
            var idx2 = (y * w + x) * 4;
            var r0 = last.data[idx2], g0 = last.data[idx2 + 1], b0 = last.data[idx2 + 2];

            var bestC = null, bd2 = Infinity;
            merged.forEach(function (c) {
              var cr = E.hexToRgb(c.hex);
              var dd2 = (r0 - cr.r) * (r0 - cr.r) + (g0 - cr.g) * (g0 - cr.g) + (b0 - cr.b) * (b0 - cr.b);
              if (dd2 < bd2) { bd2 = dd2; bestC = c.hex; }
            });
            if (!bestC) continue;
            tally[bestC] = (tally[bestC] || 0) + 1;
            n++;
          }
        }
        var top = null, best = 0;
        Object.keys(tally).forEach(function (hex) {
          if (tally[hex] > best) { best = tally[hex]; top = hex; }
        });
        return top ? { hex: top, share: best / n } : null;
      }

      var cw = Math.round(w * 0.3), ch = Math.round(h * 0.38);
      var tl = cornerDominant(0, cw, 0, ch);
      var tr = cornerDominant(w - cw, w, 0, ch);

      var bgHex = null;
      if (tl && tr) {
        var dCorner = E.deltaE00(E.labOfHex(tl.hex), E.labOfHex(tr.hex));
        if (dCorner < 18) {
          // 两角一致：取占比更大的那个角落为准
          bgHex = tl.share >= tr.share ? tl.hex : tr.hex;
        } else {
          // 两角不一致：谁占得更满用谁
          bgHex = tl.share >= tr.share ? tl.hex : tr.hex;
          if (Math.max(tl.share, tr.share) < 0.45) bgHex = null;
        }
      } else {
        bgHex = (tl && tl.hex) || (tr && tr.hex) || null;
      }


      // 认出背景就改名并排到第一行；认不出就保留按面积的命名
      if (bgHex) {
        var bgLayer = rep.layers.filter(function (L) {
          return L.active && L.colors.some(function (c) { return c.hex === bgHex; });
        })[0];

        if (bgLayer) {
          bgLayer.name = '背景层';
          bgLayer.isBg = true;
          var othersL = rep.layers.filter(function (L) { return L.active && L !== bgLayer; });
          var NAMES2 = ['主色层', '点缀层'];
          othersL.forEach(function (L, k2) { L.name = NAMES2[k2] || ('第 ' + (k2 + 1) + ' 色层'); });
          rep.layers.sort(function (x, y) {
            if (x.isBg) return -1;
            if (y.isBg) return 1;
            return y.share - x.share;
          });
        }
      }

      var activeColors = rep.layers.reduce(function (n, L) { return n + L.colors.length; }, 0);
      var lMin = 101, lMax = -1;
      merged.forEach(function (c) {
        var lb = c.lab[0];
        if (lb < lMin) lMin = lb;
        if (lb > lMax) lMax = lb;
      });
      var lRange = lMax - lMin;

      // 手工指定优先：把每个颜色归到指定角色，重算占比
      var manual = Object.keys(roles).length > 0;
      if (manual) {
        var roleShare = { bg: 0, main: 0, accent: 0 };
        merged.forEach(function (c) {
          var r4 = roles[c.hex];
          if (r4) roleShare[r4] += c.share;
        });
        rep.layers.forEach(function (L) {
          var r5 = null;
          L.colors.forEach(function (c) { if (roles[c.hex]) r5 = roles[c.hex]; });
          if (r5 === 'bg') { L.name = '背景层'; L.isBg = true; }
          else if (r5 === 'main') { L.name = '主色层'; L.isBg = false; }
          else if (r5 === 'accent') { L.name = '点缀层'; L.isBg = false; }
        });
        rep.layers.sort(function (x5, y5) {
          if (x5.isBg) return -1;
          if (y5.isBg) return 1;
          return y5.share - x5.share;
        });
      }

      $('snrEmpty').hidden = true;
      $('snrStage').hidden = false;
      $('snrBody').hidden = false;

      $('snrRatio').textContent = Math.round(bs.share * 100) + '%';
      $('snrEffective').textContent = '鲜艳度 ' + vivid.toFixed(0) +
        ' · 颜色熵 ' + cEnt.toFixed(1) + ' bit' +
        ' · 中心占比 ' + cbi.toFixed(2) +
        ' · 明度差 ' + Math.round(lRange);

      var verdict;
      if (bs.share >= 0.75) verdict = '对比主要在形体上：远看能看出块面，细节没抢戏。';
      else if (bs.share >= 0.45) verdict = '形体和细节各占一半：还能读，细节再多就糊。';
      else verdict = '对比主要在细节上：刻线、水贴、颗粒占了上风，退后两步会糊成一片。';
      if (manual) {
        $('snrVerdict').textContent = verdict +
          '（手工指定：背景 ' + Math.round(roleShare.bg * 100) +
          '% · 主体 ' + Math.round(roleShare.main * 100) +
          '% · 点缀 ' + Math.round(roleShare.accent * 100) + '%）';
      } else {
        $('snrVerdict').textContent = verdict;
      }

      // 建议：先排序，只留最该改的三条，每条给硬指标和动作
      var issues = [];

      function addIssue(sev, title, why, doit, dont) {
        issues.push({ sev: sev, t: title, w: why, d: doit, n: dont });
      }

      // ---------- 构图 ----------
      var bgL = rep.layers.filter(function (L) { return L.name === '背景层'; })[0];
      if (bgL && bgL.share > 0.45) {
        addIssue(bgL.share - 0.45, '背景太大',
          '背景占 ' + Math.round(bgL.share * 100) + '%，模型只占 ' + Math.round((1 - bgL.share) * 100) + '%。看的人第一眼看到的是布，不是模型。',
          ['裁图：把左右各切掉约 ' + Math.round((bgL.share - 0.45) * 50) + '%，让模型顶到画面 55% 以上',
           '重拍：走近到模型占画面 2/3，或者把镜头拉近一档',
           '换背景：用比模型暗两档的布，背景面积不变但不再抢眼'],
          '别用调色救。背景面积不改，压暗也只是把布变黑，模型还是那么小。');
      }

      // ---------- 明度 ----------
      var darkS = 0, lightS = 0;
      merged.forEach(function (c) {
        if (c.lab[0] < 35) darkS += c.share;
        if (c.lab[0] > 80) lightS += c.share;
      });

      if (darkS < 0.18) {
        addIssue((0.18 - darkS) * 2, '暗部不足',
          '暗部只占 ' + Math.round(darkS * 100) + '%，低于 18%。整件会发飘，照片像贴纸。',
          ['把所有缝隙、内侧、背光面统一压到 L* 30 以下',
           '在每道分色线加一条暗边，宽度 1–2mm 就够',
           '背景先压暗两档，暗部占比会立刻上来'],
          '别再提亮高光。亮部加得越多，暗部占比越低，越平。');
      }

      if (lightS > 0.45) {
        addIssue((lightS - 0.45) * 1.5, '亮部过多',
          '亮部占 ' + Math.round(lightS * 100) + '%，高光铺开就不是高光，是整体发白。',
          ['高光改成点或线：只留棱边和正面受光的一小块',
           '中间调整体降一档，让高光重新拉开对比',
           '如果是拍照问题，曝光降 0.7 档再拍'],
          '别靠加阴影去压亮部——那会把中间调一起压死。');
      }

      // ---------- 颜色 ----------
      if (cEnt > 5.2) {
        addIssue((cEnt - 5.2) * 2, '颜色失控',
          '颜色熵 ' + cEnt.toFixed(1) + ' bit，超过照片常见上限 5.2。每多一种色，注意力就分走一份。',
          ['砍到 3 种：主色 + 一个辅色 + 一处点缀',
           '把相近的两种（比如两个灰、两个棕）合成一种',
           '把某一类色统一成同一支漆的深浅两档'],
          '别用"加一个对比色"来救。颜色已经多了，再加只会更散。');
      }

      if (cEnt < 3.0) {
        addIssue((3.0 - cEnt) * 1.5, '颜色太单调',
          '颜色熵只有 ' + cEnt.toFixed(1) + ' bit，形体和颜色都是同一路，远看没有层次。',
          ['加一种低饱和的对比色，面积控制在 8% 以内',
           '同色系拆三档：底色、暗部、高光各用一支',
           '用光泽差代替色差：一块光泽、一块消光'],
          '别大改配色。单调的问题靠"一处对比"就能破，不需要重做。');
      }

      var accentS = (rep.layers.filter(function (L) { return L.name === '点缀层'; })[0] || {}).share || 0;
      if (accentS > 0.2) {
        addIssue((accentS - 0.2) * 2, '点缀变成第二主色',
          '点缀占 ' + Math.round(accentS * 100) + '%，超过 20% 就不是点缀，是第二主色。',
          ['砍掉一半，只留一处：天线、武器或胸口的一个标识',
           '把散在各处的小色块收到同一个区域',
           '如果这个色确实重要，就把它升成辅色，重新分配 60-30-10'],
          '别两个都留。两个都重要等于两个都不重要。');
      }

      // ---------- 细节 ----------
      if (bs.share < 0.55) {
        addIssue((0.55 - bs.share) * 2, '细节压过形体',
          '结构占比 ' + Math.round(bs.share * 100) + '%，低于 55%。对比能量大半落在刻线、水贴、颗粒上，远看是一团。',
          ['水贴砍一半，只留最有辨识度的几个',
           '旧化集中在底部 1/3，别全件铺',
           '把背景压暗压糊，让细节退到后面'],
          '别再加刻线或分色。现在缺的是留白，不是细节。');
      }

      if (bs.share > 0.95 && cEnt < 4.0) {
        addIssue(1.2, '画面太素',
          '结构 ' + Math.round(bs.share * 100) + '%、颜色熵 ' + cEnt.toFixed(1) + ' bit，形体和颜色都平。',
          ['在一个次要面加一处对比（低饱和，面积 5%）',
           '加一道金属边或分色线，制造一条视线',
           '靠光泽差做层次：同一色，一块光泽一块消光'],
          '别整件加深或整件提亮——那只会让平的地方更平。');
      }

      // 排优先级，只留三条
      issues.sort(function (x, y) { return y.sev - x.sev; });
      var top = issues.slice(0, 3);

      var advBox = $('snrAdvice');
      var advList = $('snrAdviceList');
      if (advBox && advList) {
        advBox.hidden = false;
        advList.innerHTML = '';

        if (!top.length) {
          var li0 = document.createElement('li');
          var b0 = document.createElement('b');
          b0.textContent = '没有硬伤';
          li0.appendChild(b0);
          var s0 = document.createElement('span');
          s0.className = 'why';
          s0.textContent = '各项都在区间内。想再往前一步，就做减法：去掉一个颜色、收掉一处细节。';
          li0.appendChild(s0);
          advList.appendChild(li0);
        }

        top.forEach(function (it, idx) {
          var li = document.createElement('li');
          li.className = idx === 0 ? 'top' : '';

          var b = document.createElement('b');
          b.textContent = (idx === 0 ? '最该改：' : '') + it.t;
          li.appendChild(b);

          var why = document.createElement('span');
          why.className = 'why';
          why.textContent = it.w;
          li.appendChild(why);

          var ul = document.createElement('ul');
          it.d.forEach(function (o) {
            var sub = document.createElement('li');
            sub.textContent = o;
            ul.appendChild(sub);
          });
          li.appendChild(ul);

          var no = document.createElement('span');
          no.className = 'dont';
          no.textContent = it.n;
          li.appendChild(no);

          advList.appendChild(li);
        });
      }

      var list = $('snrColors');
      list.innerHTML = '';

      rep.layers.forEach(function (L) {
        if (!L.active) return;

        var li = document.createElement('li');

        var nm = document.createElement('span');
        nm.className = 'hx';
        nm.style.fontWeight = '600';
        nm.style.color = 'var(--ink)';
        nm.textContent = L.name;

        var sws = document.createElement('span');
        sws.className = 'snr-sws';
        L.colors.forEach(function (c) {
          var s = document.createElement('i');
          s.className = 'sw';
          s.style.background = c.hex;
          s.title = c.hex + ' · ' + Math.round(c.share * 100) + '%';
          sws.appendChild(s);
        });

        var sh = document.createElement('span');
        sh.className = 'sh';
        sh.textContent = Math.round(L.share * 100) + '%';

        li.appendChild(nm);
        li.appendChild(sws);
        li.appendChild(sh);
        list.appendChild(li);
      });
    }

    // ---- 点选：点一下选中颜色，再指定背景/主体/点缀 ----
    var pickedHex = null;
    var roles = {};          // hex -> 'bg' | 'main' | 'accent'

    function pickAt(ev) {
      if (!last || !last.merged) return;
      var overlay = $('snrOverlay');
      var r = overlay.getBoundingClientRect();
      var x = Math.round((ev.clientX - r.left) / r.width * last.w);
      var y = Math.round((ev.clientY - r.top) / r.height * last.h);
      if (x < 0 || y < 0 || x >= last.w || y >= last.h) return;

      var idx = (y * last.w + x) * 4;
      var r0 = last.data[idx], g0 = last.data[idx + 1], b0 = last.data[idx + 2];

      var best = null, bd = Infinity;
      last.merged.forEach(function (c) {
        var cr = E.hexToRgb(c.hex);
        var d = (r0 - cr.r) * (r0 - cr.r) + (g0 - cr.g) * (g0 - cr.g) + (b0 - cr.b) * (b0 - cr.b);
        if (d < bd) { bd = d; best = c; }
      });
      if (!best) return;

      pickedHex = best.hex;
      $('snrAssign').hidden = false;
      $('snrPickSw').style.background = pickedHex;
      $('snrPickHex').textContent = pickedHex;

      [].forEach.call(document.querySelectorAll('.snr-assign button[data-role]'), function (btn) {
        btn.classList.toggle('on', roles[pickedHex] === btn.dataset.role);
      });
    }

    function applyRole(role) {
      if (!pickedHex) return;
      if (roles[pickedHex] === role) delete roles[pickedHex];
      else roles[pickedHex] = role;

      [].forEach.call(document.querySelectorAll('.snr-assign button[data-role]'), function (btn) {
        btn.classList.toggle('on', roles[pickedHex] === btn.dataset.role);
      });
      render();
    }

    function bindAssign() {
      if (!$('snrOverlay')) return;
      $('snrOverlay').addEventListener('click', pickAt);
      [].forEach.call(document.querySelectorAll('.snr-assign button[data-role]'), function (btn) {
        btn.addEventListener('click', function () { applyRole(btn.dataset.role); });
      });
      if ($('snrClearRoles')) {
        $('snrClearRoles').addEventListener('click', function () {
          roles = {};
          pickedHex = null;
          $('snrAssign').hidden = true;
          render();
        });
      }
    }

    input.addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) analyze(f);
    });

    bindAssign();
    $('snrK').addEventListener('change', render);
    if ($('snrEdge')) $('snrEdge').addEventListener('change', render);
    if ($('snrBg')) {
      $('snrBg').parentNode.style.display = 'none';   // 分层模式下不需要"忽略背景"
    }
  }

  function start() {
    mountKb();
    initGuide();
    initNav();
    initAirbrush();
    initSprayNav();

    E = window.TintEngine;
    renderKb();
    if (!E) {
      $('bootError').hidden = false;
      $('bootError').textContent = '计算内核 engine.js 没有加载成功。';
      return;
    }

    if (E.PRESETS && E.PRESETS.length) state.targetHex = E.PRESETS[0].hex;

    buildPresets();
    buildGunzeList();
    buildPigments();
    bind();
    renderProcess();

    setTarget(state.targetHex);
  }

  loadSpectral(start, function () {
    $('bootError').hidden = false;
  });
})();
