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

    // 切到「翻车急救」子页
    var tabs = document.querySelectorAll('.kb-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].textContent === '翻车急救') tabs[i].click();
    }
    await sleep(500);
    var fd = document.getElementById('failDetail');
    out.failVisible = fd ? !fd.hidden : false;

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
  check('八张缺陷卡都在', r.defects === 8, r.defects + ' 张');
  check('漆库渲染了 226 支', r.pigs === 226, r.pigs + ' 支');
  check('阴影卡渲染了 6 张', r.shades === 6, r.shades + ' 张');
  check('预设渲染了', r.presets > 0, r.presets + ' 个');
  check('页签能切到知识页', r.kbVisible === true, String(r.kbVisible));
  check('翻车急救子页能显示', r.failVisible === true, String(r.failVisible));
  check('照片分析弹窗能打开', r.modalOpened === true, String(r.modalOpened));

  console.log(`\n  冒烟：${pass} 通过 / ${fail} 失败\n`);
  return fail === 0;
}

console.log('\n[冒烟测试] 真浏览器');
const ok = run();
process.exit(ok ? 0 : 1);
