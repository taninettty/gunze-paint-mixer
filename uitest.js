/*!
 * 冒烟测试：真的打开页面，检查它初始化成功、三个知识块挂上了、页签能切、弹窗能开。
 *
 * 这个脚本专门抓"改了但没生效"这类静默失败——node test.js 只能测引擎，
 * 测不到 DOM 初始化顺序、挂载失败、[hidden] 被样式覆盖这些问题。
 *
 * 用法：
 *   node uitest.js                 # 自动找 Edge / Chrome
 *   node uitest.js --browser <路径>
 *
 * 找不到浏览器时跳过（退出码 0），方便在没有图形环境的 CI 里跑。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;

function findBrowser() {
  const argIdx = process.argv.indexOf('--browser');
  if (argIdx > -1 && process.argv[argIdx + 1]) return process.argv[argIdx + 1];
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  for (const name of ['google-chrome', 'chromium', 'chromium-browser', 'chrome']) {
    try {
      const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim().split(/\r?\n/)[0];
      if (out) return out;
    } catch (e) { /* 没装 */ }
  }

  return null;
}

const PROBE = `
<script>
window.__errs = [];
window.addEventListener('error', function (e) { window.__errs.push(e.message + ' @' + e.lineno); });
(function () {
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  (async function () {
    await sleep(2200);

    var out = {
      errs: window.__errs.slice(0, 3),
      air: document.getElementById('airbrush').innerHTML.length,
      spray: document.getElementById('sprayDetail').innerHTML.length,
      fail: document.getElementById('failDetail').innerHTML.length,
  glossary: document.getElementById('glossaryDetail').innerHTML.length,
  flow: document.getElementById('flowDetail').innerHTML.length,
  about: document.getElementById('aboutDetail').innerHTML.length,
      defects: document.querySelectorAll('.fail-grid article').length,
      pigs: document.querySelectorAll('#pigList label').length,
      shades: document.querySelectorAll('#shadeRow .shade-card').length,
      presets: document.querySelectorAll('#presets button').length
    };

    // 切到「喷涂知识」页
    var navs = document.querySelectorAll('.nav-btn');
    if (navs[2]) navs[2].click();
    await sleep(500);
    var kbTabs = document.querySelector('.kb-tabs');
    out.kbVisible = kbTabs ? getComputedStyle(kbTabs).display !== 'none' : false;

    // 风格按钮
    (function () {
      var art = document.querySelector('.style-opt[data-style=\"art\"]');
      if (!art) return;
      var before = Array.prototype.map.call(document.querySelectorAll('#shadeRow .shade-card .hx'), function (e) { return e.textContent; }).join();
      art.click();
      var after = Array.prototype.map.call(document.querySelectorAll('#shadeRow .shade-card .hx'), function (e) { return e.textContent; }).join();
      out.styleChanged = before !== after;
      out.styleActive = (document.querySelector('.style-opt.active') || {}).dataset ? document.querySelector('.style-opt.active').dataset.style : '';
      document.querySelector('.style-opt[data-style=\"physical\"]').click();
    })();

    // 逐个页签点一遍：每个都要"刚好一个内容块可见且非空"
    var tabs = document.querySelectorAll('.kb-tab');
    var DETAILS = ['airbrush', 'sprayDetail', 'artDetail', 'failDetail', 'flowDetail', 'glossaryDetail', 'aboutDetail'];
    var tabReport = [];

    for (var t = 0; t < tabs.length; t++) {
      tabs[t].click();
      await sleep(380);

      var shown = DETAILS.filter(function (id) {
        var el = document.getElementById(id);
        return el && !el.hidden && el.innerHTML.length > 200;
      });

      tabReport.push(tabs[t].textContent + '=' + (shown.length === 1 ? shown[0] : 'BAD:' + (shown.join('|') || 'none')));
    }
    out.tabs = tabReport.join(' ');

    // 停回翻车急救
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].textContent === '翻车急救') tabs[i].click();
    }
    await sleep(500);
    var fd = document.getElementById('failDetail');
    out.failVisible = fd ? !fd.hidden : false;

    // 配方页的两个折叠区
    var buy = document.getElementById('buyBox');
    if (buy) {
      buy.open = true;
      await sleep(200);
      out.buyItems = document.querySelectorAll('#buyList li').length;
    }

    // 分层反推：换底漆后列表要重算
    var baseSel = document.getElementById('primerSel');
    if (baseSel) {
      var before = document.getElementById('layerList').textContent;
      baseSel.selectedIndex = 0;
      baseSel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
      out.layeredChanged = document.getElementById('layerList').textContent !== before;
    }

    // 信噪比页
    var snrBtn = document.querySelector('.nav-btn[data-page="snr"]');
    if (snrBtn) {
      snrBtn.click();
      await sleep(350);
      var snrPanel = document.querySelector('.panel--snr');
      out.snrShown = snrPanel ? getComputedStyle(snrPanel).display !== 'none' : false;
      out.snrInputs = document.querySelectorAll('#snrInput, #snrK').length;
    }

    // 三个顶层页：每次只应显示一个
    var PAGE_PANEL = ['.panel--target', '.panel--process', '.panel--kb'];
    var pageReport = [];
    for (var n = 0; n < navs.length && n < PAGE_PANEL.length; n++) {
      navs[n].click();
      await sleep(320);
      var el = document.querySelector(PAGE_PANEL[n]);
      var ok = el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 40;
      pageReport.push(navs[n].textContent + '=' + (ok ? 'ok' : 'hidden'));
    }
    out.pages = pageReport.join(' ');

    // 回「调色」，打开弹窗
    if (navs[0]) navs[0].click();
    await sleep(400);
    var btn = document.getElementById('analyzeBtn');
    if (btn) btn.click();
    await sleep(400);
    var modal = document.getElementById('analyzeModal');
    out.modalOpened = modal ? !modal.hidden : false;

    document.title = 'SMOKE ' + JSON.stringify(out);
  })();
})();
</script>
`;

function buildProbePage() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const stamp = Date.now();
  const versioned = html.replace(/(src="[a-z-]+\.js)(\?[^"]*)?"/g, `$1?v=${stamp}"`);
  const file = path.join(os.tmpdir(), `tint-smoke-${stamp}.html`);
  // 探针页放在仓库目录下，相对路径才找得到 js
  const local = path.join(ROOT, `.smoke-${stamp}.html`);
  fs.writeFileSync(local, versioned.replace('</body>', PROBE + '</body>'), 'utf8');
  return local;
}

function run() {
  const browser = findBrowser();
  if (!browser) {
    console.log('  跳过：没找到 Chrome / Edge（可用 --browser 指定）');
    return true;
  }

  const page = buildProbePage();
  let dom = '';

  try {
    dom = execFileSync(browser, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--virtual-time-budget=9000',
      '--dump-dom',
      'file:///' + page.replace(/\\/g, '/')
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    console.log('  失败：浏览器没跑起来 — ' + e.message.split('\n')[0]);
    fs.unlinkSync(page);
    return false;
  }

  fs.unlinkSync(page);

  const m = dom.match(/<title>SMOKE (\{.*?\})<\/title>/);
  if (!m) {
    console.log('  失败：页面没有回报结果（脚本可能在初始化时就崩了）');
    return false;
  }

  let r;
  try { r = JSON.parse(m[1]); } catch (e) {
    console.log('  失败：结果解析不了');
    return false;
  }

  let pass = 0, fail = 0;
  function check(name, ok, detail) {
    if (ok) { pass++; console.log('  ok   ' + name + (detail ? '  ' + detail : '')); }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
  }

  check('没有 JS 报错', r.errs.length === 0, r.errs.join(' | ') || 'clean');
  check('器材内容已挂载', r.air > 2000, r.air + ' 字符');
  check('实务内容已挂载', r.spray > 1000, r.spray + ' 字符');
  check('翻车急救内容已挂载', r.fail > 1000, r.fail + ' 字符');
  check('名词内容已挂载', r.glossary > 1000, r.glossary + ' 字符');
  check('流程内容已挂载', r.flow > 5000, r.flow + ' 字符');
  check('关于内容已挂载', r.about > 500, r.about + ' 字符');
  check('十二张缺陷卡都在', r.defects === 12, r.defects + ' 张');
  check('漆库渲染了 226 支', r.pigs === 226, r.pigs + ' 支');
  check('阴影卡渲染了 6 张', r.shades === 6, r.shades + ' 张');
  check('预设渲染了', r.presets > 0, r.presets + ' 个');
  check('页签能切到知识页', r.kbVisible === true, String(r.kbVisible));
  check('翻车急救子页能显示', r.failVisible === true, String(r.failVisible));
  check('买漆清单能展开', r.buyItems > 0, String(r.buyItems));
  check('换底漆会重算分层反推', r.layeredChanged === true, String(r.layeredChanged));
  check('三个顶层页都能显示', (r.pages || '').indexOf('hidden') < 0 && (r.pages || '').split(' ').length === 3, r.pages);
  check('风格按钮能切换', r.styleChanged === true && r.styleActive === 'art', (r.styleActive || '') + ' · 变化 ' + String(r.styleChanged));
  check('信噪比页能打开', r.snrShown === true && r.snrInputs === 2, String(r.snrShown) + ' · ' + r.snrInputs + ' 个控件');
  check('每个页签点开都有内容', (r.tabs || '').indexOf('BAD') < 0 && (r.tabs || '').split(' ').length === 7, r.tabs);
  check('照片分析弹窗能打开', r.modalOpened === true, String(r.modalOpened));

  console.log(`\n  冒烟：${pass} 通过 / ${fail} 失败\n`);
  return fail === 0;
}

console.log('\n[冒烟测试] 真浏览器');
const ok = run();
process.exit(ok ? 0 : 1);
