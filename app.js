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

    var VIEW = { gear: 'airbrush', practice: 'spray', fail: 'fail' };
    var v = { block: VIEW[kbState.id] || 'airbrush' };

    var air = $('airbrush');
    if (air) air.hidden = v.block !== 'airbrush';

    var sd = $('sprayDetail');
    if (sd) sd.hidden = v.block !== 'spray';

    var fd = $('failDetail');
    if (fd) fd.hidden = v.block !== 'fail';

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

  function renderShades() {
    var row = $('shadeRow');
    if (!row) return;

    var variants = E.shadeVariants(state.targetHex);
    var ids = state.selected.length ? state.selected : E.PIGMENTS.filter(function (p) { return p.mixable; }).slice(0, 6).map(function (p) { return p.code; });

    row.innerHTML = '';

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

      card.addEventListener('click', function () { setTarget(v.hex); });

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
  }

  // --------------------------------------------------------------
  // 启动
  // --------------------------------------------------------------
  // 把 kb-data.js 里的内容挂进页面（改文案只改那个文件）
  function mountKb() {
    if (typeof KB_DATA === "undefined") return;
    var map = { airbrush: "airbrush", spray: "sprayDetail", fail: "failDetail" };
    Object.keys(map).forEach(function (k) {
      var el = $(map[k]);
      if (el && KB_DATA[k]) el.innerHTML = KB_DATA[k];
    });
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
