/*!
 * 端到端测试：真的操作页面，逐条点功能。
 *
 * 和 uitest.js 的区别：uitest 只验"加载成功"，这个验"功能对不对"——
 * 输入色号、改总量、切模板、点阴影卡、跑照片分析、拖框、看手机宽度。
 *
 * 用法：node e2e.js [--browser <路径>]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;

function findBrowser() {
  const i = process.argv.indexOf('--browser');
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const cands = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  for (const n of ['google-chrome', 'chromium', 'chromium-browser']) {
    try {
      const p = execFileSync(process.platform === 'win32' ? 'where' : 'which', [n], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/)[0];
      if (p) return p;
    } catch (e) {}
  }
  return null;
}

const PROBE = `
<script>
window.__errs = [];
window.addEventListener('error', function (e) { window.__errs.push(e.message); });
(function () {
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function q(s) { return document.querySelector(s); }
  function qa(s) { return document.querySelectorAll(s); }
  function txt(el) { return el ? el.textContent.trim() : ''; }

  async function photoFile() {
    var c = document.createElement('canvas'); c.width = 320; c.height = 240;
    var x = c.getContext('2d');
    x.fillStyle = '#EDEAE4'; x.fillRect(0, 0, 320, 240);
    x.fillStyle = '#C0392B'; x.fillRect(60, 60, 90, 120);
    x.fillStyle = '#2E5C9A'; x.fillRect(170, 60, 90, 120);
    return new Promise(function (res) {
      c.toBlob(function (b) { res(new File([b], 't.png', { type: 'image/png' })); }, 'image/png');
    });
  }

  (async function () {
    var out = { checks: {}, errs: [] };
    function set(k, v) { out.checks[k] = v; }

    await sleep(2200);

    // ---------- A 基础 ----------
    set('presets', qa('#presets button').length);
    set('pigs', qa('#pigList label').length);

    // ---------- B 输入色号 ----------
    var hex = document.getElementById('hexInput');
    hex.value = 'C39';
    hex.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(400);
    set('targetAfterC39', document.getElementById('targetHexLabel').textContent.trim());
    set('nearestText', txt(document.getElementById('nearest')).slice(0, 20));

    // ---------- C 配方 ----------
    function recipeSum() {
      var cells = qa('#recipeBody tr td:nth-child(2)');
      var sum = 0;
      for (var i = 0; i < cells.length; i++) {
        var v = parseFloat(cells[i].textContent);
        if (!isNaN(v)) sum += v;
      }
      return Math.round(sum * 10) / 10;
    }
    set('recipeRows', qa('#recipeBody tr').length);
    set('recipePctSum', recipeSum());

    var vol = qa('select').length ? null : null;
    // 改总量 100 -> 50
    var totalSel = null;
    qa('select').forEach(function (s) { if (s.id && s.id.indexOf('total') >= 0) totalSel = s; });
    if (totalSel) {
      totalSel.value = '50';
      totalSel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(400);
      var mlCells = qa('#recipeBody tr td:nth-child(3)');
      var ml = 0;
      for (var j = 0; j < mlCells.length; j++) {
        if (mlCells[j].textContent.indexOf('毫升') < 0) continue;
        var n = parseFloat(mlCells[j].textContent);
        if (!isNaN(n)) ml += n;
      }
      set('mlSumAt50', Math.round(ml));
      totalSel.value = '100';
      totalSel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
    }

    // ---------- D 阴影卡 ----------
    var shadeCards = qa('#shadeRow .shade-card');
    set('shadeCards', shadeCards.length);
    if (shadeCards.length >= 4) {
      var before = document.getElementById('targetHexLabel').textContent.trim();
      shadeCards[3].click();
      await sleep(400);
      set('shadeKeptTarget', document.getElementById('targetHexLabel').textContent.trim() === before);
      set('layerCount', document.querySelectorAll('#layerStack .layer-item').length);
      shadeCards[3].click();
      await sleep(350);
      set('layerAfterRemove', document.querySelectorAll('#layerStack .layer-item').length);
    }

    // ---------- F 工序模板 ----------
    var procTabs = qa('.proc-tab');
    set('procTabs', procTabs.length);
    var stepCounts = [];
    for (var t = 0; t < procTabs.length; t++) {
      procTabs[t].click();
      await sleep(250);
      stepCounts.push(qa('#procSteps li').length);
    }
    set('stepCounts', stepCounts.join(','));
    set('paintSelects', qa('.step-paint').length);

    // ---------- G 知识页 ----------
    qa('.nav-btn')[2].click();
    await sleep(500);
    set('kbTabs', qa('.kb-tab').length);
    set('airbrushCards', qa('#airbrush .ab-cards article').length);
    set('pumpSvgs', qa('#airbrush svg').length);

    var tabs = qa('.kb-tab');
    for (var i2 = 0; i2 < tabs.length; i2++) if (tabs[i2].textContent === '实务') tabs[i2].click();
    await sleep(400);
    set('sprayNav', qa('.sd-nav button').length);

    var tabs2 = qa('.kb-tab');
    for (var i3 = 0; i3 < tabs2.length; i3++) if (tabs2[i3].textContent === '翻车急救') tabs2[i3].click();
    await sleep(400);
    set('defectCards', qa('.fail-grid article').length);
    set('normalSection', document.getElementById('failDetail').textContent.indexOf('正常的漆面') >= 0);

    // ---------- H 照片分析 ----------
    qa('.nav-btn')[0].click();
    await sleep(300);
    document.getElementById('analyzeBtn').click();
    await sleep(300);
    var f = await photoFile();
    var dt = new DataTransfer(); dt.items.add(f);
    var inp = document.getElementById('photoInput');
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(2000);
    set('photoRows', qa('#clusterList .cc').length);
    set('lightBar', !document.getElementById('lightBar').hidden);

    // 拖框
    var cv = document.getElementById('photoCanvas');
    var r = cv.getBoundingClientRect();
    function pe(target, type, x, y) {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    }
    pe(cv, 'pointerdown', r.left + 20, r.top + 20);
    pe(window, 'pointermove', r.left + 120, r.top + 100);
    pe(window, 'pointerup', r.left + 120, r.top + 100);
    await sleep(600);
    set('markCardShown', !document.getElementById('markCard').hidden);

    document.getElementById('modalClose').click();
    await sleep(300);

    // ---------- I 手机宽度 ----------
    set('overflow', document.documentElement.scrollWidth - document.documentElement.clientWidth);
    set('vw', document.documentElement.clientWidth);

    out.errs = window.__errs.slice(0, 3);
    document.title = 'E2E ' + JSON.stringify(out);
  })();
})();
</script>
`;

function buildProbePage() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const stamp = Date.now();
  const page = path.join(ROOT, `.e2e-${stamp}.html`);
  fs.writeFileSync(page, html.replace(/(src="[a-z-]+\.js)(\?[^"]*)?"/g, `$1?v=${stamp}"`).replace('</body>', PROBE + '</body>'), 'utf8');
  return page;
}

function main() {
  const browser = findBrowser();
  if (!browser) { console.log('  跳过：没找到浏览器'); process.exit(0); }

  const page = buildProbePage();
  let dom = '';
  try {
    dom = execFileSync(browser, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--virtual-time-budget=25000', '--dump-dom',
      'file:///' + page.replace(/\\/g, '/')
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    console.log('  浏览器跑失败：' + e.message.split('\n')[0]);
    fs.unlinkSync(page); process.exit(1);
  }
  fs.unlinkSync(page);

  const m = dom.match(/<title>E2E (\{.*?\})<\/title>/);
  if (!m) { console.log('  页面没回报结果（可能中途崩了）'); process.exit(1); }

  let r;
  try { r = JSON.parse(m[1]); } catch (e) { console.log('  结果解析失败'); process.exit(1); }
  const c = r.checks;

  let pass = 0, fail = 0;
  function check(name, ok, detail) {
    if (ok) { pass++; console.log('  ok   ' + name + (detail ? '  ' + detail : '')); }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
  }

  console.log('\n[端到端] 真浏览器');
  check('没有 JS 报错', r.errs.length === 0, r.errs.join(' | ') || 'clean');
  check('预设渲染', c.presets > 0, c.presets + ' 个');
  check('色库 226 支', c.pigs === 226, c.pigs + ' 支');
  check('输入 C39 能定位', /^#/.test(c.targetAfterC39), c.targetAfterC39 + ' · ' + c.nearestText);
  check('配方有行', c.recipeRows > 0, c.recipeRows + ' 行');
  check('占比合计 100%', Math.abs(c.recipePctSum - 100) < 1.5, c.recipePctSum + '%');
  check('改总量到 50ml 后毫升数跟着变', c.mlSumAt50 == null || Math.abs(c.mlSumAt50 - 50) <= 2, c.mlSumAt50 + ' ml（只算毫升行，滴不计）');
  check('阴影卡 6 张', c.shadeCards === 6, c.shadeCards + ' 张');
  check('点阴影卡不改目标色', c.shadeKeptTarget === true, String(c.shadeKeptTarget));
  check('点阴影卡会加一层', c.layerCount === 1, String(c.layerCount));
  check('再点一次会移除', c.layerAfterRemove === 0, String(c.layerAfterRemove));
  check('工序模板 5 个', c.procTabs === 5, c.procTabs + ' 个');
  check('每个模板都有步骤', /^\d+(,\d+){4}$/.test(c.stepCounts || ''), c.stepCounts);
  check('每层可换漆', c.paintSelects >= 2, c.paintSelects + ' 个下拉');
  check('知识页 4 个页签', c.kbTabs === 4, c.kbTabs + ' 个');
  check('器材卡片齐全', c.airbrushCards >= 14, c.airbrushCards + ' 张');
  check('喷笔/气泵/电磁泵图都在', c.pumpSvgs >= 10, c.pumpSvgs + ' 张图');
  check('实务有 4 个子导航', c.sprayNav === 4, c.sprayNav + ' 个');
  check('翻车急救 8 张缺陷卡', c.defectCards === 8, c.defectCards + ' 张');
  check('有正常漆面章节', c.normalSection === true, String(c.normalSection));
  check('照片分析出主色', c.photoRows > 0, c.photoRows + ' 块');
  check('光源条显示', c.lightBar === true, String(c.lightBar));
  check('拖框能出标记卡', c.markCardShown === true, String(c.markCardShown));
  check('没有横向溢出', c.overflow <= 0, 'overflow ' + c.overflow + 'px / 视口 ' + c.vw);

  console.log('\n  端到端：' + pass + ' 通过 / ' + fail + ' 失败\n');
  process.exit(fail === 0 ? 0 : 1);
}

main();
