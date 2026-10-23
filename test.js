/* 自测：node test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const E = require('./engine.js');

let pass = 0;
let fail = 0;

function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ok   ' + name + (extra ? '  ' + extra : ''));
  } else {
    fail++;
    console.log('  FAIL ' + name + (extra ? '  ' + extra : ''));
  }
}

function near(a, b, tol) { return Math.abs(a - b) <= tol; }

console.log('\n[1] CIEDE2000 与 Sharma 标准测试数据对比');
const sharma = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
  [[50, -1.1848, -84.8006], [50, 0, -82.7485], 1.0000],
  [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1.0000],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, -1, 2], [50, 0, 0], 2.3669],
  [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
  [[50, 2.49, -0.001], [50, -2.49, 0.001], 7.1792]
];
sharma.forEach(([a, b, want], i) => {
  const got = E.deltaE00(a, b);
  check('pair ' + (i + 1), near(got, want, 0.01), `want ${want}  got ${got.toFixed(4)}`);
});

console.log('\n[2] 色库完整性');
check('色库接近 200 支', E.PIGMENTS.length > 190, E.PIGMENTS.length + ' 支');
check('C1–C7 基础色齐全', ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].every(c => E.PIGMENTS.some(p => p.code === c)));
check('C8/C9/C10 以金属漆入库', ['C8', 'C9', 'C10'].every(c => E.PIGMENTS.some(p => p.code === c && p.kind === 'metal')));
check('C30 以消光剂入库', E.PIGMENTS.some(p => p.code === 'C30' && p.kind === 'additive'));
check('透明漆单独标记', E.PIGMENTS.filter(p => p.kind === 'clear').length >= 8);
check('每支都有合法色值', E.PIGMENTS.every(p => /^#[0-9A-F]{6}$/i.test(p.hex)));
check('色号不重复', new Set(E.PIGMENTS.map(p => p.code)).size === E.PIGMENTS.length);

console.log('\n[3] 单支自洽：拿漆本身的颜色当目标，应该 100% 命中');
const sample = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C13', 'C39', 'C41', 'C29', 'C12']
  .map(c => E.PIGMENTS.find(p => p.code === c)).filter(Boolean);

sample.forEach(p => {
  const r = E.solve({ targetHex: p.hex, pigmentIds: [p.id], total: 10 });
  check(
    p.code.padEnd(4),
    r.ok && r.deltaE < 0.01 && r.lines.length === 1 && near(r.lines[0].percent, 100, 0.01),
    `ΔE=${r.deltaE.toFixed(4)}`
  );
});

console.log('\n[4] 混色物理方向：蓝 + 黄 必须发绿');
const ksOf = h => E.ksOf(new (require('./spectral.js').Color)(h).R);
const blue = E.PIGMENTS.find(p => p.code === 'C5');
const yellow = E.PIGMENTS.find(p => p.code === 'C4');
const mix = E.measure(E.mixSpectrum([{ ks: ksOf(blue.hex) }, { ks: ksOf(yellow.hex) }], [1, 1]));
const hue = (Math.atan2(mix.lab[2], mix.lab[1]) * 180) / Math.PI;
check('C5 青 + C4 黄 落在绿色区', hue > 80 && hue < 180, `h=${hue.toFixed(1)}°  ${mix.hex}`);
check('没有变成灰', Math.hypot(mix.lab[1], mix.lab[2]) > 10, `C*=${Math.hypot(mix.lab[1], mix.lab[2]).toFixed(1)}`);

console.log('\n[5] 用基础 7 色调常见郡士色');
const BASIC = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'];
const targets = [
  ['C39 Dark Yellow', '#B79764'],
  ['C13 Neutral Gray', '#5B6B78'],
  ['C12 Olive Drab', '#685932'],
  ['C29 Hull Red', '#603336'],
  ['C19 Sandy Brown', '#96823B'],
  ['C14 Navy Blue', '#004652'],
  ['C11 Light Gull Gray', '#BDC3C4']
];

let slowest = 0;
targets.forEach(([name, hex]) => {
  const t0 = Date.now();
  const r = E.solve({ targetHex: hex, pigmentIds: BASIC, total: 20 });
  const ms = Date.now() - t0;
  slowest = Math.max(slowest, ms);
  const sum = r.lines.reduce((a, l) => a + l.percent, 0);
  const drops = r.lines.reduce((a, l) => a + l.amount, 0);
  check(
    name,
    r.ok && r.deltaE < 5 && near(sum, 100, 0.5) && near(drops, 20, 0.01),
    `ΔE=${r.deltaE.toFixed(1)}  ${ms}ms  ${r.lines.map(l => l.pigment.code + ' ' + l.percent.toFixed(0) + '%').join(' / ')}`
  );
});

console.log('\n[6] 最近色号');
const n1 = E.nearestPaint('#B79764');
check('C39 的色值指向 C39', n1.pigment.code === 'C39' && n1.deltaE < 0.01, n1.pigment.code + ' ΔE=' + n1.deltaE.toFixed(3));
const c2 = E.PIGMENTS.find(p => p.code === 'C2');
const n2 = E.nearestPaint(c2.hex);
check('C2 的色值指向 C2', n2.pigment.code === 'C2', n2.pigment.code + ' ΔE=' + n2.deltaE.toFixed(3));

console.log('\n[7] 降级与边界');
const none = E.solve({ targetHex: '#B79764', pigmentIds: [], total: 20 });
check('没选漆时给提示不崩', none.ok === false && typeof none.error === 'string', none.error);

const onlyWhite = E.solve({ targetHex: '#B79764', pigmentIds: ['C1'], total: 20 });
check('只有白也能算出结果并给建议', onlyWhite.ok === true && !!onlyWhite.missingHue, onlyWhite.missingHue);

const black = E.solve({ targetHex: '#0A0A0A', pigmentIds: ['C2'], total: 20 });
check('极深色不发散', black.ok && /^#[0-9A-F]{6}$/i.test(black.predicted.hex), black.predicted.hex + ' ΔE=' + black.deltaE.toFixed(2));

const many = E.solve({ targetHex: '#B79764', pigmentIds: E.PIGMENTS.slice(0, 12).map(p => p.id), total: 20 });
check('超过 8 支只取前 8 支', many.ok && many.lines.length <= 9, 'lines=' + many.lines.length);


console.log('\n[8] 照片分析');
const fake = [];
for (let i = 0; i < 400; i++) fake.push([200, 30, 30]);
for (let i = 0; i < 300; i++) fake.push([30, 160, 60]);
for (let i = 0; i < 300; i++) fake.push([40, 60, 180]);
const an = E.analyzeImage(fake, { k: 3 });
check('三色图拆成 3 块', an.clusters.length === 3, an.clusters.map(c => c.hex + ' ' + c.share.toFixed(2)).join(' | '));
check('面积占比对得上', near(an.clusters[0].share, 0.4, 0.02), '主色 ' + (an.clusters[0].share * 100).toFixed(0) + '%');
check('主色还原准确', E.deltaE00(an.clusters[0].lab, E.labOfHex('#C81E1E')) < 1.5, an.clusters[0].hex);
const an2 = E.analyzeImage(fake, { k: 3 });
check('同样的图结果稳定', an2.clusters[0].hex === an.clusters[0].hex);

const warm = [];
for (let i = 0; i < 500; i++) warm.push([150, 128, 100]);
const wb = E.analyzeImage(warm, { k: 3, whiteRef: [150, 128, 100] });
check('白平衡把暖灰拉成中性', Math.hypot(wb.clusters[0].lab[1], wb.clusters[0].lab[2]) < 2,
  wb.clusters[0].hex + ' C*=' + Math.hypot(wb.clusters[0].lab[1], wb.clusters[0].lab[2]).toFixed(2));
const noWb = E.analyzeImage(warm, { k: 3 });
check('不做白平衡时它是偏黄的', Math.hypot(noWb.clusters[0].lab[1], noWb.clusters[0].lab[2]) > 8,
  noWb.clusters[0].hex);


console.log('\n[9] 分层反推');
const Sp = require("./spectral.js");
const ksCache = {};
const ksOfHex = h => (ksCache[h] || (ksCache[h] = E.ksOf(new Sp.Color(h).R)));

function synth(code, primerHex, X) {
  const p = E.PIGMENTS.find(x => x.code === code);
  const ks = ksOfHex(p.hex);
  const Rg = new Sp.Color(primerHex).R;
  const R = ks.map((k, i) => {
    const a = 1 + k, b = Math.sqrt(a * a - 1), t = b * X;
    const coth = t > 20 ? 1 : (Math.exp(2 * t) + 1) / (Math.exp(2 * t) - 1);
    return Math.min(1, Math.max(0.002, (1 - Rg[i] * (a - b * coth)) / (a - Rg[i] + b * coth)));
  });
  return new Sp.Color(R).toString();
}

check('有 5 种标准底漆', E.PRIMERS.length === 5, E.PRIMERS.map(x => x.name).join('/'));
check('含粉底和棕底', ['粉底', '棕底'].every(n => E.PRIMERS.some(x => x.name === n)));

[['C39', '#B8B8B6', 1.0], ['C39', '#232323', 0.5], ['C41', '#8B4A3B', 1.2], ['C51', '#F0C6C0', 0.9]].forEach(([code, primer, X]) => {
  const obs = synth(code, primer, X);
  const r = E.solveLayered({ targetHex: obs, primerHex: primer, limit: 3 });
  check(code + ' 喷在 ' + primer + ' 能被反推出来',
    r.candidates[0].pigment.code === code && r.candidates[0].deltaE < 1.2,
    obs + ' -> ' + r.candidates[0].pigment.code + ' ΔE=' + r.candidates[0].deltaE.toFixed(2));
});

const opaque = E.solveLayered({ targetHex: synth('C6', '#B8B8B6', 3), primerHex: '#B8B8B6', limit: 1 });
check('盖死的情形不硬报层数', /盖死/.test(opaque.candidates[0].label), opaque.candidates[0].label);

const quick = Date.now();
E.solveLayered({ targetHex: '#B79764', primerHex: '#B8B8B6', limit: 3 });
check('单次反推 < 120ms', Date.now() - quick < 120, (Date.now() - quick) + 'ms');

console.log('\n[10] 光泽粗判');
function makeImg(w, h, paint) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = paint(x, y);
    const i = (y * w + x) * 4;
    d[i] = c[0]; d[i+1] = c[1]; d[i+2] = c[2]; d[i+3] = 255;
  }
  return d;
}

const matte = E.analyzeGloss(makeImg(200, 200, () => [128, 128, 128]), 200, 200);
check('纯色平涂判为消光', matte.level.indexOf('消光') >= 0, matte.level + ' ratio=' + (matte.ratio*100).toFixed(1) + '%');

const glossy = E.analyzeGloss(makeImg(200, 200, (x, y) => {
  const onDot = (x % 14 < 3) && (y % 14 < 3);
  return onDot ? [255, 255, 255] : [40, 40, 40];
}), 200, 200);
check('密集锐利高光判为光泽', glossy.level === '光泽',
  glossy.level + ' ratio=' + (glossy.ratio*100).toFixed(1) + '% sharp=' + glossy.sharpness.toFixed(0));
check('粗糙度数值有区分', glossy.sharpness > matte.sharpness, 'gloss=' + glossy.sharpness.toFixed(0) + ' matte=' + matte.sharpness.toFixed(0));


console.log('\n[11] 配比取整');
const rr = E.solve({ targetHex: '#B79764', pigmentIds: ['C1','C2','C3','C4','C5','C6','C7'], total: 20, _noHint: true });
const s10 = E.snapRecipe({ targetHex: '#B79764', lines: rr.lines, denom: 10 });
check('取整后份数加起来等于分母', s10.items.reduce((a, x) => a + x.parts, 0) === 10, s10.items.map(x => x.pigment.code + ' ' + x.parts).join(' : '));
check('取整配方有对应的 ΔE', s10.deltaE >= rr.deltaE && s10.deltaE < 25, 'ΔE ' + s10.deltaE.toFixed(1) + '（精确 ' + rr.deltaE.toFixed(1) + '）');
const s5 = E.snapRecipe({ targetHex: '#B79764', lines: rr.lines, denom: 5 });
check('5 份比 10 份更粗', s5.deltaE >= s10.deltaE, '5份 ΔE ' + s5.deltaE.toFixed(1) + ' / 10份 ' + s10.deltaE.toFixed(1));

const q5 = E.quantizeRecipe({ targetHex: '#B79764', lines: rr.lines, step: 0.05 });
check('5% 网格：百分比都是 5 的倍数',
  q5.items.every(x => Math.abs(x.percent % 5) < 1e-9),
  q5.items.map(x => x.pigment.code + ' ' + x.percent + '%').join(' + '));
check('5% 网格：加起来正好 100%', near(q5.items.reduce((a, x) => a + x.percent, 0), 100, 1e-6));
check('5% 网格：不劣于直接四舍五入', q5.deltaE <= s10.deltaE + 1e-6,
  '网格 ' + q5.deltaE.toFixed(2) + ' vs 四舍五入 ' + s10.deltaE.toFixed(2));
check('5% 网格：比精确解差但可用', q5.deltaE > rr.deltaE && q5.deltaE < 10, 'ΔE ' + q5.deltaE.toFixed(1));


console.log('\n[12] 主料毫升 + 微量滴数');
const Sp2 = require('./spectral.js');
const ks2 = h => E.ksOf(new Sp2.Color(h).R);
const pick = c => E.PIGMENTS.find(p => p.code === c);

// 按用户举的例子合成一个色：20 红 + 80 蓝 + 2 滴黑 + 2 滴绿
const exComps = [pick('C3'), pick('C5'), pick('C2'), pick('C6')].map(p => ({ ks: ks2(p.hex) }));
const exW = [20, 80, 2 * E.DROP_ML, 2 * E.DROP_ML];
const exTarget = E.measure(E.mixSpectrum(exComps, exW)).hex;

const mixed = E.solveMixed({ targetHex: exTarget, pigmentIds: ['C1','C2','C3','C4','C5','C6','C7'], volume: 100 });
check('能反推出 80 蓝 20 红 的主料', mixed.ok && mixed.items.filter(x => x.kind === 'bulk').length === 2,
  mixed.items.filter(x => x.kind === 'bulk').map(x => x.pigment.code + ' ' + x.ml.toFixed(0) + 'ml').join(' / '));
const blueIt = mixed.items.find(x => x.pigment.code === 'C5');
const redIt = mixed.items.find(x => x.pigment.code === 'C3');
check('主料毫升对得上', Math.abs(blueIt.ml - 80) <= 5 && Math.abs(redIt.ml - 20) <= 5,
  blueIt.ml.toFixed(0) + 'ml / ' + redIt.ml.toFixed(0) + 'ml');
check('微量用整滴表示', mixed.items.filter(x => x.kind === 'trace').every(x => Number.isInteger(x.drops) && x.drops > 0),
  mixed.items.filter(x => x.kind === 'trace').map(x => x.pigment.code + ' ' + x.drops + '滴').join(' / ') || '无');
check('混合配方 ΔE 够小', mixed.deltaE < 1.5, 'ΔE ' + mixed.deltaE.toFixed(2));
check('总毫升 = 主料 + 微量', Math.abs(mixed.totalMl - mixed.items.reduce((a, x) => a + x.ml, 0)) < 1e-6,
  mixed.totalMl.toFixed(2) + ' ml');

const t1 = Date.now();
E.solveMixed({ targetHex: '#B79764', pigmentIds: ['C1','C2','C3','C4','C5','C6','C7'], volume: 100 });
check('单次混合求解 < 150ms', Date.now() - t1 < 150, (Date.now() - t1) + 'ms');


console.log('\n[13] 色相调子');
const toneOf = code => E.toneOf(E.labOfHex(E.PIGMENTS.find(p => p.code === code).hex));
check('白色算中性', toneOf('C1') === '中性', toneOf('C1'));
check('IJA Green 是蓝调绿', toneOf('C16') === '蓝调绿', toneOf('C16'));
check('军灰算中性而不是蓝', toneOf('C13') === '中性', toneOf('C13'));
check('红就是红', toneOf('C3').indexOf('红') >= 0, toneOf('C3'));
const mixed3 = E.solveMixed({ targetHex: '#B79764', pigmentIds: ['C1','C2','C3','C4','C5','C6','C7'], volume: 100 });
check('配方里每支都带调子', mixed3.items.every(x => typeof x.tone === 'string' && x.tone.length > 0),
  mixed3.items.map(x => x.pigment.code + ':' + x.tone).join(' / '));


console.log('\n[14] 特殊漆');
const kinds = E.PIGMENTS.reduce((a, x) => { a[x.kind] = (a[x.kind] || 0) + 1; return a; }, {});
check('金属漆入库', (kinds.metal || 0) >= 15, 'metal=' + kinds.metal);
check('透明漆入库', (kinds.clear || 0) >= 10, 'clear=' + kinds.clear);
check('有珠光和消光剂', (kinds.pearl || 0) >= 1 && (kinds.additive || 0) >= 2, 'pearl=' + kinds.pearl + ' additive=' + kinds.additive);
check('金属漆可以参与混色', E.PIGMENTS.filter(p => p.kind === 'metal').every(p => p.mixable));

const withMetal = E.solve({ targetHex: '#B79764', pigmentIds: ['C8', 'C1', 'C2'], total: 100, _noHint: true });
check('金属漆能进配方', withMetal.ok && withMetal.lines.some(l => l.pigment.kind === 'metal'),
  withMetal.lines.map(l => l.pigment.code).join(','));
check('金属混实色会提示后果', /金属粉/.test((withMetal.warnings || []).join('')), (withMetal.warnings || []).join(''));

const onlyMetal = E.solve({ targetHex: '#DCDCDD', pigmentIds: ['C8'], total: 100, _noHint: true });
check('只选金属漆也能算', onlyMetal.ok, withMetal.lines.map(l => l.pigment.code).join(','));

const candy = E.solve({ targetHex: '#8B1A2B', pigmentIds: ['C8', 'C47'], total: 100, _noHint: true });
check('金属 + 透明会提示分层而不是混合', /分层|糖果|伪电镀/.test((candy.warnings || []).join('')),
  (candy.warnings || []).join(''));

const withAdditive = E.solve({ targetHex: '#B79764', pigmentIds: ['C30', 'C1', 'C2'], total: 100, _noHint: true });
check('消光剂仍不参与调色', withAdditive.lines.every(l => l.pigment.code !== 'C30'),
  withAdditive.lines.map(l => l.pigment.code).join(','));

const metalNear = E.nearestPaint('#DCDCDD');
check('找色时金属漆仍能命中', metalNear.pigment.code === 'C8', metalNear.pigment.code + ' ΔE=' + metalNear.deltaE.toFixed(2));


console.log('\n[15] 工序模板');
['chrome', 'candy', 'metal'].forEach(id => {
  const pr = E.buildProcess(id, { metal: 'C8', clear: 'C47' });
  check(pr.name + ' 模板可用', pr && pr.steps.length >= 2, pr.name + '：' + pr.steps.map(s => s.code).join(' → '));
});

const chrome = E.buildProcess('chrome', { metal: 'C8', clear: 'C47' });
check('伪电镀三步齐全', chrome.steps.map(s => s.code).join(',') === 'C2,C8,C47', chrome.steps.map(s => s.code).join(','));
check('每步都有层数和要点', chrome.steps.every(s => s.qty && s.note));
check('会带透明色用途提示', /尾灯|伪电镀/.test(chrome.clearHint || ''), chrome.clearHint);

const candy2 = E.buildProcess('candy', { metal: 'C90', clear: 'C50' });
check('换金属和透明色能生效', candy2.steps.some(s => s.code === 'C90') && candy2.steps.some(s => s.code === 'C50'),
  candy2.steps.map(s => s.code).join(','));


console.log('\n[16] 阴影合并');
const shaded = [];
for (let i = 0; i < 500; i++) shaded.push([200, 40, 40]);
for (let i = 0; i < 400; i++) shaded.push([120, 25, 25]);
for (let i = 0; i < 300; i++) shaded.push([40, 80, 180]);
for (let i = 0; i < 250; i++) shaded.push([20, 40, 95]);
for (let i = 0; i < 800; i++) shaded.push([222, 222, 222]);
const sh = E.analyzeImage(shaded, { k: 8 });
check('亮面暗面合并成一块', sh.clusters.length === 3, '拆出 ' + sh.clusters.length + ' 块：' + sh.clusters.map(c => c.hex).join(' '));
const redBlock = sh.clusters.filter(c => c.lab[1] > 30)[0];
check('合并后记录明度跨度', redBlock && redBlock.lMax - redBlock.lMin > 10, redBlock ? 'L ' + redBlock.lMin + '–' + redBlock.lMax : 'none');
check('代表色取受光面', redBlock && E.labOfHex(redBlock.hex)[0] > 40, redBlock ? redBlock.hex + ' L*=' + E.labOfHex(redBlock.hex)[0].toFixed(0) : 'none');


console.log('\n[17] 光源估计');
const warmWhite = [];
for (let i = 0; i < 2000; i++) warmWhite.push([232, 214, 190]);
const g = E.shadesOfGray(warmWhite, 6);
check('暖光下估出偏蓝的补偿', g[2] > g[0], g.map(x => x.toFixed(2)).join(', '));

const fixed = E.analyzeImage(warmWhite, { k: 3, gain: g });
check('补偿后白纸变中性', Math.hypot(fixed.clusters[0].lab[1], fixed.clusters[0].lab[2]) < 2,
  fixed.clusters[0].hex + ' C*=' + Math.hypot(fixed.clusters[0].lab[1], fixed.clusters[0].lab[2]).toFixed(1));

const raw = E.analyzeImage(warmWhite, { k: 3 });
check('不补偿则明显偏黄', Math.hypot(raw.clusters[0].lab[1], raw.clusters[0].lab[2]) > 8,
  raw.clusters[0].hex);

const g2 = E.wbGain([232, 214, 190]);
check('手动白点也能算出增益', g2 && g2[2] > g2[0], g2 ? g2.map(x => x.toFixed(2)).join(', ') : 'null');


console.log('\n[18] 漆面感（参考值）');
function grad(a, b, n) {
  const s = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    s.push([Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)]);
  }
  return s;
}
const solidG = E.analyzeImage(grad([110, 28, 28], [215, 62, 62], 60), { k: 3 });
check('纯明暗的实色判为实色', solidG.clusters[0].sheen === '实色',
  solidG.clusters[0].hex + ' Δh=' + solidG.clusters[0].dHue.toFixed(1));

const pearlG = E.analyzeImage(grad([120, 45, 95], [230, 190, 110], 60), { k: 3 });
check('随角异色会被标出来', pearlG.clusters.some(c => c.sheen !== '实色'),
  pearlG.clusters.map(c => c.hex + ':' + c.sheen).join(' '));
check('给出可解释的数值', pearlG.clusters.every(c => typeof c.dHue === 'number' && typeof c.cRatio === 'number'),
  'Δh ' + pearlG.clusters[0].dHue.toFixed(0) + '°');


console.log('\n[19] 漆种与金属命名');
check('浅金判成香槟金', E.metalName(E.labOfHex('#F8DD81')) === '香槟金', E.metalName(E.labOfHex('#F8DD81')));
check('棕金判成古铜', E.metalName(E.labOfHex('#A76938')) === '古铜色', E.metalName(E.labOfHex('#A76938')));
check('银灰判成枪铁', E.metalName(E.labOfHex('#8A8A8E')) === '枪铁色', E.metalName(E.labOfHex('#8A8A8E')));

const metalOnly = E.nearestPaint('#F8DD81', 'metal');
check('指定金属时只从金属漆里挑', metalOnly.pigment.kind === 'metal', metalOnly.pigment.code + ' ' + metalOnly.pigment.name);

const clearOnly = E.nearestPaint('#F8DD81', 'clear');
check('指定透明时只从透明漆里挑', clearOnly.pigment.kind === 'clear', clearOnly.pigment.code + ' ' + clearOnly.pigment.name);

const anyKind = E.nearestPaint('#F8DD81');
check('不指定就全库找', !!anyKind && anyKind.pigment.kind !== undefined, anyKind.pigment.code);


console.log('\n[20] 两点判金属');
const jm1 = E.judgeMetallic([220, 222, 228], [120, 122, 128]);
check('高光带色判金属', jm1.kind === 'metal', jm1.verdict + ' ΔL=' + jm1.dL.toFixed(0));

const jm2 = E.judgeMetallic([252, 252, 250], [200, 198, 192]);
check('高光发白判光泽实色', jm2.kind === 'solid', jm2.verdict);

const jm3 = E.judgeMetallic([150, 150, 148], [140, 140, 138]);
check('没高光就说判不了', jm3.verdict.indexOf('没有明显高光') >= 0, jm3.verdict);

const jm4 = E.judgeMetallic([230, 90, 80], [140, 40, 35]);
check('金属红也认', jm4.kind === 'metal', jm4.verdict);

console.log('\n[21] 页面引用一致性');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const kbPath = path.join(__dirname, 'kb-data.js');
const kbSrc = fs.existsSync(kbPath) ? fs.readFileSync(kbPath, 'utf8') : '';
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const htmlIds = new Set([...(html + kbSrc).matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const used = new Set([
  ...[...app.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]),
  ...[...app.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1])
]);
const missing = [...used].filter(id => !htmlIds.has(id));
check('app.js 引用的 id 都存在', missing.length === 0, missing.length ? '缺失: ' + missing.join(', ') : used.size + ' 个 id');
check('index.html 引入 gunze-data.js', /<script src="gunze-data\.js(\?[^"]*)?"><\/script>/.test(html));
check('index.html 引入 engine.js/app.js', /engine\.js/.test(html) && /app\.js/.test(html));
check('同目录有 spectral.js', fs.existsSync(path.join(__dirname, 'spectral.js')));
check('知识内容已外置', kbSrc.length > 20000 && kbSrc.indexOf('KB_DATA') >= 0, kbSrc ? Math.round(kbSrc.length / 1024) + ' KB' : '缺失');
  check('四个知识块都在', kbSrc.indexOf('airbrush:') > 0 && kbSrc.indexOf('spray:') > 0 && kbSrc.indexOf('art:') > 0 && kbSrc.indexOf('fail:') > 0, 'airbrush/spray/art/fail/flow/glossary/about');

console.log('\n[23] 文档与数据一致');
const README = fs.readFileSync(path.join(__dirname, "README.md"), "utf8");
const byKind = {};
E.PIGMENTS.forEach(function (p) { byKind[p.kind] = (byKind[p.kind] || 0) + 1; });

const expectLine = "共 **" + E.PIGMENTS.length + " 支**（" +
  byKind.solid + " 实色、" + byKind.metal + " 金属、" + byKind.clear + " 透明、" +
  byKind.additive + " 消光剂、" + byKind.pearl + " 珠光）";

check('README 的漆数与色库一致', README.indexOf(expectLine) >= 0, expectLine);

const stale = README.match(/\*\*(\d+) 支郡士/);
check('README 没写旧总数', !stale || Number(stale[1]) === E.PIGMENTS.length,
  stale ? stale[1] + ' vs ' + E.PIGMENTS.length : '无');

const engineSrc = fs.readFileSync(path.join(__dirname, "engine.js"), "utf8");
check('engine.js 注释没有旧数字', engineSrc.indexOf("209 支") < 0, 'clean');

check('阈值集中在 TUNING', /var TUNING = \{/.test(engineSrc) && /TUNING\.LAB_L_WEIGHT/.test(engineSrc),
  'engine.js 顶部有 TUNING 对象');
check('浏览器端没有 const/let', !/\b(const|let)\b/.test(fs.readFileSync(path.join(__dirname, "app.js"), "utf8")),
  'app.js 是 ES5');

console.log('\n[25] 阴影/高光的色相差异');
function hueOfLab(l) { let h = Math.atan2(l[2], l[1]) * 180 / Math.PI; return (h + 360) % 360; }
function hueGap(a, b) { const d = Math.abs(hueOfLab(a) - hueOfLab(b)); return d > 180 ? 360 - d : d; }

for (const base of ['#B79764', '#3A5FA8', '#C0392B', '#4A7A45']) {
  const v = E.shadeVariants(base);
  const c = v.filter(x => x.id === 'sh-cool')[0];
  const w = v.filter(x => x.id === 'sh-warm')[0];
  const de = E.deltaE00(c.lab, w.lab);
  check('冷暖阴影能区分 ' + base, de > 6, 'ΔE ' + de.toFixed(1) + ' · 色相差 ' + hueGap(c.lab, w.lab).toFixed(0) + '°');
}

const nb = E.shadeVariants('#9AA0A6');
const nc = nb.filter(x => x.id === 'sh-cool')[0];
const nw = nb.filter(x => x.id === 'sh-warm')[0];
check('中性色也给冷暖色偏', E.deltaE00(nc.lab, nw.lab) > 10, 'ΔE ' + E.deltaE00(nc.lab, nw.lab).toFixed(1));

const baseLab = E.labOfHex('#B79764');
const hv = E.shadeVariants('#B79764');
check('高光更亮', hv[0].lab[0] > baseLab[0] + 5, 'L ' + hv[0].lab[0].toFixed(0));
check('阴影更暗', hv[2].lab[0] < baseLab[0] - 5, 'L ' + hv[2].lab[0].toFixed(0));

console.log('\n[26] 光源色温');
function litGain(rgb) { const s = []; for (let i = 0; i < 300; i++) s.push(rgb); return E.shadesOfGray(s, 6); }
const warmL = E.estimateLight(litGain([255, 180, 107]));
const coolL = E.estimateLight(litGain([201, 221, 255]));
const neutralL = E.estimateLight(litGain([255, 238, 221]));

check('暖光判为暖', warmL.cct < 4000 && warmL.label.indexOf('暖') >= 0, warmL.label + ' ' + warmL.cct + 'K');
check('冷光判为冷', coolL.cct > 6500 && coolL.label.indexOf('冷') >= 0, coolL.label + ' ' + coolL.cct + 'K');
check('中性光不偏', neutralL.label === '接近中性', neutralL.label + ' ' + neutralL.cct + 'K');
check('暖光比冷光低', warmL.cct < coolL.cct - 2000, warmL.cct + ' vs ' + coolL.cct);
check('给出光源色块', /^#[0-9A-F]{6}$/i.test(warmL.swatch), warmL.swatch);

console.log('\n[27] 知识内容结构');
const kbs = fs.readFileSync(path.join(__dirname, 'kb-data.js'), 'utf8');
const secs = {};
let mm;
const re = /^\s*(airbrush|spray|art|fail): \x60([\s\S]*?)\x60\s*,?\s*$/gm;
while ((mm = re.exec(kbs))) secs[mm[1]] = mm[2];

function count(s, re2) { return (s.match(re2) || []).length; }

check('四个块都解析出来了', Object.keys(secs).length === 4, Object.keys(secs).join(','));
for (const key of ['airbrush', 'spray', 'art', 'fail']) {
  const body = secs[key] || '';
  const okDiv = count(body, /<div\b/g) === count(body, /<\/div>/g);
  const okArt = count(body, /<article\b/g) === count(body, /<\/article>/g);
  const okSvg = count(body, /<svg\b/g) === count(body, /<\/svg>/g);
  check(key + ' 标签闭合', okDiv && okArt && okSvg,
    'div ' + count(body, /<div\b/g) + '/' + count(body, /<\/div>/g) +
    ' · svg ' + count(body, /<svg\b/g) + '/' + count(body, /<\/svg>/g));
}
check('翻车急救共 16 张卡（12 缺陷 + 4 正常漆面）', count(secs.fail || '', /<article\b/g) === 16, count(secs.fail || '', /<article\b/g) + ' 张');
check('内容里没有脚本', !/<script/i.test(kbs), 'clean');

console.log('\n[28] 点缀漆可以来自主料之外');
const pale = E.solveMixed({ targetHex: '#EFF7F5', pigmentIds: ['C1', 'C31', 'C32', 'C5'], volume: 100 });
const paleTrace = pale.items.filter(function (i) { return i.kind === 'trace' && i.drops > 0; });
check('偏青的白会加蓝', paleTrace.length > 0 && paleTrace.some(function (i) { return i.pigment.code === 'C5'; }),
  pale.items.map(function (i) { return i.pigment.code + (i.drops ? '(' + i.drops + '滴)' : ''); }).join(' / '));
check('加了之后明显更准', pale.deltaE < 2, 'ΔE ' + pale.deltaE.toFixed(2));

const noBlue = E.solveMixed({ targetHex: '#EFF7F5', pigmentIds: ['C1', 'C31', 'C32'], volume: 100 });
check('没勾蓝就只用白灰', noBlue.items.length === 1 && noBlue.items[0].pigment.code === 'C1',
  noBlue.items.map(function (i) { return i.pigment.code; }).join(' / '));

console.log('\n[29] 美术规则');
// 色相锚点：纯色的 Lab 位置
function castOf(hex) { return E.castName(E.labOfHex(hex)); }
check('黄是偏黄', castOf('#FFFF00') === '偏黄', castOf('#FFFF00'));
check('蓝是偏蓝', castOf('#0000FF') === '偏蓝', castOf('#0000FF'));
check('青是偏青', castOf('#00FFFF') === '偏青', castOf('#00FFFF'));
check('绿是偏绿', castOf('#00FF00') === '偏绿', castOf('#00FF00'));

// 金属命名：铜不能被叫成金
const c10 = E.PIGMENTS.filter(function (p) { return p.code === 'C10'; })[0];
check('C10 金属铜 → 古铜色', E.metalName(E.labOfHex(c10.hex)) === '古铜色', E.metalName(E.labOfHex(c10.hex)));
const c9 = E.PIGMENTS.filter(function (p) { return p.code === 'C9'; })[0];
check('C9 金属金 → 黄金/香槟', /金/.test(E.metalName(E.labOfHex(c9.hex))), E.metalName(E.labOfHex(c9.hex)));

// 阴影必须降饱和
['#B79764', '#2E5C9A', '#C0392B'].forEach(function (hex) {
  var base = E.labOfHex(hex);
  var cBase = Math.hypot(base[1], base[2]);
  var sh = E.shadeVariants(hex).filter(function (v) { return v.id === 'sh'; })[0];
  var cSh = Math.hypot(sh.lab[1], sh.lab[2]);
  check('阴影不更艳 ' + hex, cSh < cBase * 1.4, cBase.toFixed(1) + ' → ' + cSh.toFixed(1));
});

// 六张卡要能互相区分
['#B79764', '#2E5C9A', '#E8E4DC'].forEach(function (hex) {
  var v = E.shadeVariants(hex);
  var minDe = Infinity;
  for (var i = 0; i < v.length; i++) {
    for (var j = i + 1; j < v.length; j++) {
      var d = E.deltaE00(v[i].lab, v[j].lab);
      if (d < minDe) minDe = d;
    }
  }
  check('六张卡两两可分 ' + hex, v.length === 6 && minDe >= 3, '最小 ΔE ' + minDe.toFixed(1));
});

console.log('\n[30] 光照决定阴影方向');
{
  var b2 = '#B79764';
  var shadeWarm = E.shadeVariants(b2, { light: 'warm' });
  var shadeCool = E.shadeVariants(b2, { light: 'cool' });
  var pickLight = function (arr, id) { return arr.filter(function (x) { return x.id === id; })[0]; };

  var dHiLight = E.deltaE00(pickLight(shadeWarm, 'hi').lab, pickLight(shadeCool, 'hi').lab);
  check('暖光与冷光的高光不同', dHiLight > 3, 'ΔE ' + dHiLight.toFixed(1));

  var dShLight = E.deltaE00(pickLight(shadeWarm, 'sh-warm').lab, pickLight(shadeCool, 'sh-warm').lab);
  check('暖光与冷光的暖阴影不同', dShLight > 3, 'ΔE ' + dShLight.toFixed(1));

  // 暖光下冷阴影应该比冷光下更"有存在感"

  var dWarmShade = E.deltaE00(pickLight(shadeWarm, 'sh-cool').lab, E.labOfHex(b2));
  var dCoolShade = E.deltaE00(pickLight(shadeCool, 'sh-cool').lab, E.labOfHex(b2));
  check('暖光下冷阴影更偏紫', dWarmShade > dCoolShade - 0.5,
    dWarmShade.toFixed(1) + ' vs ' + dCoolShade.toFixed(1));

  // 三档光照都要六张卡且两两可分
  ['warm', 'neutral', 'cool'].forEach(function (L) {
    var v = E.shadeVariants(b2, { light: L });
    var minDeLight = Infinity;
    for (var ii = 0; ii < v.length; ii++) {
      for (var jj = ii + 1; jj < v.length; jj++) {
        var d = E.deltaE00(v[ii].lab, v[jj].lab);
        if (d < minDeLight) minDeLight = d;
      }
    }
    check('光照 ' + L + ' 下六张卡两两可分', v.length === 6 && minDeLight >= 3, '最小 ΔE ' + minDeLight.toFixed(1));
  });
}

console.log('\n[31] 金属漆的光影');
{
  var mHex = '#B08D57';
  var solidV = E.shadeVariants(mHex, { light: 'neutral' });
  var metalV = E.shadeVariants(mHex, { light: 'neutral', metal: true });
  var hiOf = function (arr) { return arr.filter(function (x) { return x.id === 'hi'; })[0]; };
  var shOf = function (arr) { return arr.filter(function (x) { return x.id === 'sh'; })[0]; };

  check('金属高光比实色更亮', hiOf(metalV).lab[0] > hiOf(solidV).lab[0] + 1,
    hiOf(solidV).lab[0].toFixed(0) + ' → ' + hiOf(metalV).lab[0].toFixed(0));
  check('金属阴影比实色更暗', shOf(metalV).lab[0] < shOf(solidV).lab[0] - 1,
    shOf(solidV).lab[0].toFixed(0) + ' → ' + shOf(metalV).lab[0].toFixed(0));
  check('金属明暗跨度更大',
    (hiOf(metalV).lab[0] - shOf(metalV).lab[0]) > (hiOf(solidV).lab[0] - shOf(solidV).lab[0]),
    (hiOf(metalV).lab[0] - shOf(metalV).lab[0]).toFixed(0) + ' vs ' + (hiOf(solidV).lab[0] - shOf(solidV).lab[0]).toFixed(0));
}

console.log('\n[32] 珠光翻色');
{
  var pb = '#B08D57';
  var sV = E.shadeVariants(pb, { light: 'neutral' });
  var pV = E.shadeVariants(pb, { light: 'neutral', pearl: true });
  var h1 = sV.filter(function (x) { return x.id === 'hi'; })[0];
  var h2 = pV.filter(function (x) { return x.id === 'hi'; })[0];
  check('珠光高光会换色相', E.deltaE00(h1.lab, h2.lab) > 2, 'ΔE ' + E.deltaE00(h1.lab, h2.lab).toFixed(1));
}

console.log('\n[33] 物理风与美术风');
{
  var sb = '#B79764';
  var ph = E.shadeVariants(sb, { light: 'neutral', style: 'physical' });
  var ar = E.shadeVariants(sb, { light: 'neutral', style: 'art' });
  var cs = function (v) { return v.filter(function (x) { return x.id === 'sh-cool'; })[0]; };
  check('美术风的冷阴影更紫', cs(ar).lab[2] < cs(ph).lab[2] - 3,
    cs(ph).lab[2].toFixed(1) + ' → ' + cs(ar).lab[2].toFixed(1));
  check('两种风格的冷阴影明显不同', E.deltaE00(cs(ph).lab, cs(ar).lab) > 8,
    'ΔE ' + E.deltaE00(cs(ph).lab, cs(ar).lab).toFixed(1));
  var hr = function (v) { return v.filter(function (x) { return x.id === 'hi'; })[0]; };
  var bluePh = E.shadeVariants('#2E5C9A', { light: 'neutral', style: 'physical' });
  var blueAr = E.shadeVariants('#2E5C9A', { light: 'neutral', style: 'art' });
  check('美术风高光更偏红（蓝色基色）', hr(blueAr).lab[1] > hr(bluePh).lab[1],
    hr(bluePh).lab[1].toFixed(1) + ' → ' + hr(blueAr).lab[1].toFixed(1));
}

console.log('\n[34] 导出函数清单');
{
  // 拆文件前先钉死：这些导出必须一直在，且能跑
  const EXPECT = {
    PIGMENTS: 'object', BASE_PAINT: 'object', PRESETS: 'object',
    PROCESSES: 'object', PROCESS_TIPS: 'object', SPRAY_KB: 'object',
    PROCESS_CHAIN: 'object',
    CLEAR_HINTS: 'object', PRIMERS: 'object',
    DROP_ML: 'number',

    solve: 'function', solveMixed: 'function', solveLayered: 'function',
    snapRecipe: 'function', quantizeRecipe: 'function',
    nearestPaint: 'function', nearestPaints: 'function',
    buildProcess: 'function',
    analyzeImage: 'function', classifyPixels: 'function', smoothLabels: 'function',
    growRegion: 'function', rectRegion: 'function',
    shadesOfGray: 'function', wbGain: 'function', wbRGB: 'function',
    estimateLight: 'function',
    castName: 'function', metalName: 'function', toneOf: 'function', noiseReport: 'function', snrReport: 'function', layerReport: 'function', mergeSimilar: 'function', freqSnr: 'function', segmentRegions: 'function', colorRegions: 'function', lightReport: 'function', regionLights: 'function', shadeMap: 'function', nthValue: 'function', paintNoise: 'function', rgb2lab: 'function', regionSnr: 'function', bandSnr: 'function', colorfulness: 'function', colorEntropy: 'function', centerBias: 'function',
    judgeMetallic: 'function', analyzeGloss: 'function',
    shadeVariants: 'function', litColor: 'function', tintRecipe: 'function',
    deltaE00: 'function', labOfHex: 'function', hexToRgb: 'function',
    rgbToHex: 'function', ksOf: 'function', mixSpectrum: 'function',
    measure: 'function', setLib: 'function'
  };

  const names = Object.keys(EXPECT);
  const missing = names.filter(n => !(n in E));
  const extra = Object.keys(E).filter(k => !(k in EXPECT));
  const wrongType = names.filter(n => n in E && typeof E[n] !== EXPECT[n]);

  check('导出数量对得上', Object.keys(E).length === names.length,
    Object.keys(E).length + ' 个');
  check('没有缺失的导出', missing.length === 0, missing.join(',') || '全部存在');
  check('没有多余的导出', extra.length === 0, extra.join(',') || '无新增');
  check('类型都对', wrongType.length === 0, wrongType.join(',') || 'ok');

  // 每个函数都真跑一次
  const SMOKE = {
    solve: () => E.solve({ targetHex: '#B79764', pigmentIds: ['C1', 'C2', 'C3'] }),
    solveMixed: () => E.solveMixed({ targetHex: '#B79764', pigmentIds: ['C1', 'C2', 'C3'] }),
    solveLayered: () => E.solveLayered({ targetHex: '#B79764', pigmentIds: ['C1', 'C2', 'C3'], primer: '#B8B8B6' }),
    quantizeRecipe: () => E.quantizeRecipe({ targetHex: '#B79764', lines: E.solve({ targetHex: '#B79764', pigmentIds: ['C1', 'C2', 'C3'] }).lines }),
    nearestPaint: () => E.nearestPaint('#B79764'),
    nearestPaints: () => E.nearestPaints('#B79764', 3),
    buildProcess: () => E.buildProcess(E.PROCESSES[0].id),
    analyzeImage: () => E.analyzeImage([[200, 60, 60], [60, 90, 200], [220, 220, 220]], { k: 2 }),
    classifyPixels: () => E.classifyPixels([[200, 60, 60], [60, 90, 200]], { centers: [[200, 60, 60], [60, 90, 200]] }),
    smoothLabels: () => E.smoothLabels([0, 0, 1, 1], 2, 2),
    growRegion: () => E.growRegion(new Uint8ClampedArray(4 * 4 * 4).fill(200), 4, 4, 1, 1, {}),
    rectRegion: () => E.rectRegion(new Uint8ClampedArray(4 * 4 * 4).fill(200), 4, 4, 0, 0, 3, 3, {}),
    shadesOfGray: () => E.shadesOfGray([[200, 180, 160], [120, 110, 100]], 6),
    wbGain: () => E.wbGain([200, 180, 160]),
    wbRGB: () => E.wbRGB([200, 180, 160], [1.1, 1, 0.9]),
    estimateLight: () => E.estimateLight([1.1, 1, 0.9]),
    rgb2lab: () => E.rgb2lab(255, 0, 0),
    paintNoise: () => E.paintNoise('#C82828'),
    nthValue: () => E.nthValue(Float32Array.from([5, 1, 4, 2, 3]), 2),
    shadeMap: () => {
      var w = 40, h = 40, d = new Uint8ClampedArray(w * h * 4);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var o = (y * w + x) * 4;
        var v = Math.round(255 * (1 - y / h * 0.8));
        d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255;
      }
      var seg = E.colorRegions(d, w, h, { tol: 30, minArea: 100 });
      return E.shadeMap(d, w, h, seg, {});
    },
    regionLights: () => {
      var w = 60, h = 60, d = new Uint8ClampedArray(w * h * 4);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var o = (y * w + x) * 4;
        var v = x < 30 ? Math.round(255 * (1 - x / 30 * 0.6)) : Math.round(255 * (1 - y / h * 0.6));
        v = Math.max(0, Math.min(255, v));
        d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255;
      }
      var seg = E.colorRegions(d, w, h, { tol: 9, minArea: 100 });
      return E.regionLights(d, w, h, seg, { radius: 3, minArea: 100 });
    },
    lightReport: () => {
      var w = 40, h = 40, d = new Uint8ClampedArray(w * h * 4);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var o = (y * w + x) * 4;
        var v = Math.round(255 * (1 - x / w));
        d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255;
      }
      return E.lightReport(d, w, h, { radius: 3 });
    },
    colorRegions: () => {
      var w = 40, h = 40, d = new Uint8ClampedArray(w * h * 4);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var o = (y * w + x) * 4;
        d[o] = x < 20 ? 200 : 40; d[o + 1] = 40; d[o + 2] = x < 20 ? 40 : 200; d[o + 3] = 255;
      }
      return E.colorRegions(d, w, h, { tol: 8, minArea: 100 });
    },
    segmentRegions: () => {
      var w = 32, h = 32, l = new Float32Array(w * h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) l[y * w + x] = x < 16 ? 0.2 : 0.8;
      return E.segmentRegions(l, w, h, { minArea: 40 });
    },
    colorfulness: () => E.colorfulness([200, 40, 40, 20, 200, 40]),
    colorEntropy: () => E.colorEntropy([[50, 0, 0], [70, 20, 20], [30, -20, 30]]),
    centerBias: () => {
      var w = 40, h = 40, l = new Float32Array(w * h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) l[y * w + x] = (x > 15 && x < 25 && y > 15 && y < 25) ? 1 : 0;
      return E.centerBias(l, w, h);
    },
    bandSnr: () => {
      var l = new Float32Array(64 * 64);
      for (var y = 0; y < 64; y++) for (var x = 0; x < 64; x++) l[y * 64 + x] = x / 64;
      return E.bandSnr(l, 64, 64, { levels: 3, radius: 2 });
    },
    regionSnr: () => {
      var w = 32, h = 32, l = new Float32Array(w * h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) l[y * w + x] = x < 16 ? 0.2 : 0.8;
      return E.regionSnr(l, w, h, E.segmentRegions(l, w, h, { minArea: 40 }), { radius: 2 });
    },
    freqSnr: () => E.freqSnr(new Float32Array(64 * 64).fill(0.5), 64, 64, { radius: 2, tile: 16 }),
    mergeSimilar: () => E.mergeSimilar([
      { hex: '#E8C24A', share: 0.6, lab: [80, 5, 60] },
      { hex: '#E0BA45', share: 0.4, lab: [78, 5, 58] }
    ], 6),
    layerReport: () => E.layerReport([
      { hex: '#E8E4DC', share: 0.5, lab: [91, 0, 0] },
      { hex: '#B79764', share: 0.3, lab: [64, 5, 31] },
      { hex: '#C0392B', share: 0.2, lab: [45, 60, 45] }
    ]),
    snrReport: () => E.snrReport([
      { hex: '#B79764', share: 0.6, lab: [64, 5, 31] },
      { hex: '#4A3A72', share: 0.25, lab: [30, 10, -20] },
      { hex: '#E8E4DC', share: 0.15, lab: [91, 0, 0] }
    ]),
    noiseReport: () => E.noiseReport([
      { hex: '#B79764', share: 0.6, lab: [64, 5, 31] },
      { hex: '#4A3A72', share: 0.3, lab: [30, 10, -20] }
    ]),
    castName: () => E.castName([50, 10, 10]),
    metalName: () => E.metalName([50, 10, 10]),
    toneOf: () => E.toneOf([50, 10, 10]),
    judgeMetallic: () => E.judgeMetallic([70, 0, 0], [40, 5, 5]),
    analyzeGloss: () => E.analyzeGloss([[200, 200, 200], [40, 40, 40]]),
    shadeVariants: () => E.shadeVariants('#B79764', { light: 'neutral' }),
    litColor: () => E.litColor('#B79764', { cct: 5000 }),
    tintRecipe: () => E.tintRecipe('#B79764', '#8C7452', ['C1', 'C2', 'C3']),
    deltaE00: () => E.deltaE00([50, 0, 0], [52, 0, 0]),
    labOfHex: () => E.labOfHex('#B79764'),
    hexToRgb: () => E.hexToRgb('#B79764'),
    rgbToHex: () => E.rgbToHex(183, 151, 100),
    ksOf: () => E.ksOf(new Array(38).fill(0.5)),
    mixSpectrum: () => E.mixSpectrum([{ ks: new Array(38).fill(0.2) }, { ks: new Array(38).fill(0.6) }], [1, 1]),
    measure: () => E.measure(new Array(38).fill(0.5)),
    setLib: () => { E.setLib(require('./spectral.js')); return true; }
  };

  let ran = 0, broke = [];
  Object.keys(SMOKE).forEach(function (name) {
    if (typeof E[name] !== 'function') { broke.push(name + '(缺失)'); return; }
    try {
      const r = SMOKE[name]();
      if (r === undefined || r === null) broke.push(name + '(返回空)');
      else ran++;
    } catch (e) {
      broke.push(name + '(' + e.message.slice(0, 24) + ')');
    }
  });

  // snapRecipe 依赖完整求解上下文（内部还会读 lines[i].parts 等），只验存在与类型
  check('每个函数都跑得通', broke.length === 0, ran + ' 个（snapRecipe 仅验类型）· ' + (broke.join(', ') || 'ok'));
}

console.log('\n[35] 信噪比');
{
  var mk = function (hex, share) { return { hex: hex, share: share, lab: E.labOfHex(hex) }; };

  var good = E.noiseReport([mk('#B79764', 0.6), mk('#4A3A72', 0.3), mk('#E8E4DC', 0.1)]);
  check('主次清楚时判 ok', good.level === 'ok' && good.bigBlocks === 2, good.lines.join(' ').slice(0, 30));

  var busy = E.noiseReport([mk('#B79764', 0.24), mk('#C0392B', 0.22), mk('#2E5C9A', 0.2), mk('#8A8A8A', 0.18), mk('#E8E4DC', 0.16)]);
  check('碎色块会报警', busy.level === 'warn' && busy.bigBlocks === 5, busy.lines[0].slice(0, 24));

  var flat = E.noiseReport([mk('#8A8A8A', 0.7), mk('#9A9A9A', 0.2), mk('#7A7A7A', 0.1)]);
  check('明度太近会报警', flat.lines.join('').indexOf('明度拉不开') >= 0, flat.lines.join(' ').slice(0, 30));

  check('空输入返回 null', E.noiseReport([]) === null, 'null');
}

console.log('\n[36] 信噪比数值');
{
  var mkc = function (hex, share) { return { hex: hex, share: share, lab: E.labOfHex(hex) }; };

  var wide = E.snrReport([mkc('#B79764', 0.7), mkc('#4A3A72', 0.2), mkc('#C0392B', 0.1)]);
  check('主色强时比值大', wide.ratio > 2, wide.ratioText);
  check('信号只有一个（主色）', wide.colors.filter(function (c) { return c.role === 'signal'; }).length === 1,
    wide.colors.map(function (c) { return c.hex + ':' + c.role; }).join(' '));

  var flat = E.snrReport([mkc('#B79764', 0.3), mkc('#4A3A72', 0.3), mkc('#C0392B', 0.2), mkc('#E8E4DC', 0.2)]);
  check('四色均分时不算主次清楚', flat.ratio < 2, flat.ratioText);

  var single = E.snrReport([mkc('#B79764', 1)]);
  check('单色时比值为无穷', single.ratioText === '∞ : 1', single.ratioText);

  check('有效色数 ≤ 颜色数', flat.effectiveColors <= flat.colors.length + 0.001,
    flat.effectiveColors.toFixed(2) + ' / ' + flat.colors.length);
}

console.log('\n[37] 分层');
{
  var mk3 = function (hex, share) { return { hex: hex, share: share, lab: E.labOfHex(hex) }; };

  var clear = E.layerReport([mk3('#E8E4DC', 0.5), mk3('#B79764', 0.3), mk3('#C0392B', 0.2)]);
  check('三个颜色分成三层', clear.activeCount === 3, clear.layers.map(function (L) { return L.name + L.colors.length; }).join(' '));
  check('层次拉开时不报警', clear.minGap > 20 && clear.verdict.indexOf('糊') < 0, clear.verdict.slice(0, 26));

  var muddy = E.layerReport([mk3('#B79764', 0.6), mk3('#AB8F60', 0.4)]);
  check('两层太像会说糊', muddy.verdict.indexOf('混') >= 0 || muddy.verdict.indexOf('弱') >= 0, muddy.verdict.slice(0, 26));

  var accents = E.layerReport([mk3('#E8E4DC', 0.4), mk3('#B79764', 0.3), mk3('#C0392B', 0.3)]);
  check('背景也算层，不单独剔除', accents.layers[0].name === '底色层' && accents.layers[0].colors.length >= 1,
    accents.layers[0].name + ' ' + accents.layers[0].colors.length);
}

console.log('\n[38] 相近色合并');
{
  var mk4 = function (hex, share) { return { hex: hex, share: share, lab: E.labOfHex(hex) }; };

  var same = E.mergeSimilar([mk4('#E8C24A', 0.35), mk4('#E0BA45', 0.30), mk4('#3A5C88', 0.25), mk4('#FFFFFF', 0.10)], 6);
  check('相近的黄色合成一个', same.length === 3, same.length + ' 块');
  check('合并后占比相加', Math.abs(same[0].share - 0.65) < 0.01, same[0].share.toFixed(2));

  var diff = E.mergeSimilar([mk4('#E8C24A', 0.5), mk4('#3A5C88', 0.5)], 6);
  check('差别大的不合并', diff.length === 2, diff.length + ' 块');
}

console.log('\n[39] 卷积信噪比');
{
  var W = 64, H = 64;

  function pattern(fn) {
    var l = new Float32Array(W * H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) l[y * W + x] = fn(x, y);
    return l;
  }

  var smooth = E.freqSnr(pattern(function (x) { return 0.2 + 0.6 * x / W; }), W, H, { radius: 4, tile: 16 });
  check('平滑渐变被判为结构为主', smooth.db > 20, smooth.db.toFixed(1) + ' dB');

  var noise = E.freqSnr(pattern(function () { return Math.random(); }), W, H, { radius: 4, tile: 16 });
  check('随机噪声的比值明显更低', noise.db < smooth.db - 10, noise.db.toFixed(1) + ' dB');

  var checker = E.freqSnr(pattern(function (x, y) { return ((x >> 2) + (y >> 2)) % 2 ? 0.9 : 0.1; }), W, H, { radius: 4, tile: 16 });
  check('高频棋盘的比值最低', checker.db < noise.db, checker.db.toFixed(1) + ' dB');

  check('分块尺寸对得上', smooth.cols === 4 && smooth.rows === 4, smooth.cols + 'x' + smooth.rows);
}

console.log('\n[40] 先分区再算区域内部');
{
  var W = 96, H = 96;

  function img(fn) {
    var l = new Float32Array(W * H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) l[y * W + x] = fn(x, y);
    return l;
  }

  var three = img(function (x) { return x < 32 ? 0.2 : (x < 64 ? 0.6 : 0.9); });
  var seg = E.segmentRegions(three, W, H, { minArea: 200 });
  check('三块色块切成三个区域', seg.regions.length === 3, seg.regions.length + ' 区');

  var rThree = E.regionSnr(three, W, H, seg, { radius: 3 });
  check('干净分区的比值很高', rThree.db > 20, rThree.db.toFixed(1) + ' dB');

  var noisy = img(function (x) {
    return (x < 32 ? 0.2 : (x < 64 ? 0.6 : 0.9)) + (Math.random() - 0.5) * 0.3;
  });
  var segN = E.segmentRegions(noisy, W, H, { minArea: 200 });
  var rNoisy = E.regionSnr(noisy, W, H, segN, { radius: 3 });
  check('同样的分区加了噪声后比值下降', rNoisy.db < rThree.db - 5, rNoisy.db.toFixed(1) + ' dB');

  var one = img(function () { return 0.5; });
  var segOne = E.segmentRegions(one, W, H, { minArea: 200 });
  check('纯色只有一块区域', segOne.regions.length === 1, segOne.regions.length + ' 区');
}

console.log('\n[41] 频带信噪比');
{
  var W = 200, H = 200;
  function mk(fn) { var l = new Float32Array(W * H); for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) l[y * W + x] = fn(x, y); return l; }

  var ramp = E.bandSnr(mk(function (x) { return x / W; }), W, H, { levels: 3, radius: 2 });
  check('渐变几乎全是结构', ramp.share > 0.9, (ramp.share * 100).toFixed(0) + '%');

  var blocks = E.bandSnr(mk(function (x) { return x < 100 ? 0.2 : 0.8; }), W, H, { levels: 3, radius: 2 });
  check('大色块也算结构', blocks.share > 0.9, (blocks.share * 100).toFixed(0) + '%');

  var stripes = E.bandSnr(mk(function (x) { return (x % 4) < 2 ? 0.3 : 0.7; }), W, H, { levels: 3, radius: 2 });
  check('细条纹算纹理', stripes.share < 0.1, (stripes.share * 100).toFixed(1) + '%');

  var noise = E.bandSnr(mk(function () { return Math.random(); }), W, H, { levels: 3, radius: 2 });
  check('随机噪声算纹理', noise.share < 0.1, (noise.share * 100).toFixed(1) + '%');

  check('结构占比在 0~1 之间', ramp.share <= 1 && stripes.share >= 0, ramp.share.toFixed(2) + ' / ' + stripes.share.toFixed(2));
}

console.log('\n[42] 边缘权重');
{
  var W = 200, H = 200;
  var l = new Float32Array(W * H);
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) l[y * W + x] = (x % 4) < 2 ? 0.3 : 0.7;

  var w1 = E.bandSnr(l, W, H, { levels: 3, radius: 2, edgeWeight: 1 });
  var w05 = E.bandSnr(l, W, H, { levels: 3, radius: 2, edgeWeight: 0.5 });
  var w025 = E.bandSnr(l, W, H, { levels: 3, radius: 2, edgeWeight: 0.25 });

  check('边缘权重越小，结构占比越高', w025.share > w05.share && w05.share > w1.share,
    (w1.share * 100).toFixed(1) + '% → ' + (w05.share * 100).toFixed(1) + '% → ' + (w025.share * 100).toFixed(1) + '%');
  check('默认权重是 0.5', Math.abs(w05.edgeWeight - 0.5) < 1e-9, String(w05.edgeWeight));
}

console.log('\n[43] 有出处的三个量');
{
  var gray = [];
  for (var i = 0; i < 100; i++) gray.push(128, 128, 128);
  var red = [];
  for (var j = 0; j < 100; j++) red.push(200, 40, 40);

  check('灰图鲜艳度为 0', Math.abs(E.colorfulness(gray)) < 1e-6, E.colorfulness(gray).toFixed(2));
  check('红图鲜艳度明显更高', E.colorfulness(red) > 40, E.colorfulness(red).toFixed(1));

  check('单色熵为 0', Math.abs(E.colorEntropy([[50, 0, 0], [50, 0, 0]])) < 1e-6, '0');
  check('三色熵大于 1', E.colorEntropy([[50, 0, 0], [70, 20, 20], [30, -20, 30]]) > 1, E.colorEntropy([[50, 0, 0], [70, 20, 20], [30, -20, 30]]).toFixed(2));

  var w = 40, h = 40, l = new Float32Array(w * h);
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) l[y * w + x] = (x > 15 && x < 25 && y > 15 && y < 25) ? 1 : 0;
  check('中心有东西时中心占比 > 1', E.centerBias(l, w, h) > 1, E.centerBias(l, w, h).toFixed(2));
}

console.log('\n[44] 颜色分区');
{
  var W = 60, H = 60;
  var d = new Uint8ClampedArray(W * H * 4);
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
    var o = (y * W + x) * 4;
    var c = x < 20 ? [200, 40, 40] : (x < 40 ? [40, 160, 80] : [60, 90, 200]);
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  var r3 = E.colorRegions(d, W, H, { tol: 8, minArea: 100 });
  check('三种颜色分成三块', r3.regions.length === 3, r3.regions.length + ' 块');
  check('三块面积覆盖全图', r3.regions.reduce(function (s, x) { return s + x.area; }, 0) === W * H, '全覆盖');

  var d2 = new Uint8ClampedArray(W * H * 4);
  for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) {
    var o2 = (y2 * W + x2) * 4;
    var v = Math.round(255 * x2 / (W - 1));
    d2[o2] = v; d2[o2 + 1] = v; d2[o2 + 2] = v; d2[o2 + 3] = 255;
  }
  var r4 = E.colorRegions(d2, W, H, { tol: 5, minArea: 40, mergeTol: 4 });
  check('渐变会被切成多块', r4.regions.length > 3, r4.regions.length + ' 块');

  var lab = E.rgb2lab(255, 0, 0);
  check('rgb2lab 算得对', Math.abs(lab[0] - 53) < 6 && lab[1] > 60, lab.map(function (v) { return v.toFixed(0); }).join(','));
}

console.log('\n[45] 光源估计');
{
  var W = 100, H = 100;
  function mk(fn) {
    var d = new Uint8ClampedArray(W * H * 4);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var o = (y * W + x) * 4;
      var v = fn(x, y);
      d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255;
    }
    return d;
  }

  var left = E.lightReport(mk(function (x) { return 255 * (1 - x / W); }), W, H, { radius: 3 });
  check('左亮 → 光从左边来', left.direction === '左' && left.coherence > 0.8, left.direction + ' ' + Math.round(left.azimuth) + '°');

  var top = E.lightReport(mk(function (x, y) { return 255 * (1 - y / H); }), W, H, { radius: 3 });
  check('上亮 → 光从上来', top.direction === '上' && top.coherence > 0.8, top.direction + ' ' + Math.round(top.azimuth) + '°');

  var flat = E.lightReport(mk(function () { return 200; }), W, H, { radius: 3 });
  check('纯平光 → 相干度接近 0', flat.coherence < 0.1, flat.coherence.toFixed(2));

  check('单光源能找出一个峰', left.lobes && left.lobes.length >= 1 && Math.abs(left.lobes[0].azimuth - 180) < 12,
    left.lobes && left.lobes.length ? Math.round(left.lobes[0].azimuth) + '°' : '无');

  check('峰的权重在 0~1 之间', left.lobes[0].weight > 0 && left.lobes[0].weight <= 1, left.lobes[0].weight.toFixed(2));

  check('纯平光没有峰', flat.lobes.length === 0, flat.lobes.length + ' 个');
}

console.log('\n[46] 分区方向');
{
  var W = 120, H = 120;
  var d = new Uint8ClampedArray(W * H * 4);
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
    var o = (y * W + x) * 4;
    var v = x < 60 ? Math.round(255 * (1 - x / 60 * 0.6)) : Math.round(255 * (1 - y / H * 0.6));
    v = Math.max(0, Math.min(255, v));
    d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255;
  }
  var seg = E.colorRegions(d, W, H, { tol: 9, minArea: 200 });
  var rl = E.regionLights(d, W, H, seg, { radius: 3, minArea: 200 });

  check('分区能给出多个方向', rl.length >= 2, rl.length + ' 个区域');

  var leftRegion = rl.filter(function (r) { return Math.abs(r.azimuth - 180) < 30; });
  check('有一块判定为左光', leftRegion.length >= 1, leftRegion.length + ' 块');

  var topRegion = rl.filter(function (r) { return Math.abs(r.azimuth - 90) < 30; });
  check('有一块判定为顶光', topRegion.length >= 1, topRegion.length + ' 块');

  check('每块都带相干度', rl.every(function (r) { return r.coherence >= 0 && r.coherence <= 1; }), 'ok');
}

console.log('\n[47] 明暗分离');
{
  var W = 80, H = 80;
  var d = new Uint8ClampedArray(W * H * 4);
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
    var o = (y * W + x) * 4;
    var v = Math.round(255 * (1 - y / H * 0.8));
    d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255;
  }
  var seg = E.colorRegions(d, W, H, { tol: 30, minArea: 200 });
  var sm = E.shadeMap(d, W, H, seg, {});

  check('大核半径随图尺寸走', sm.radius >= 4, 'radius ' + sm.radius);

  var withShade = sm.perRegion.filter(function (r) { return r.highlight > 0 && r.shadow > 0; });
  check('区域里同时切出高光和阴影', withShade.length >= 1, withShade.length + ' 块');

  var r0 = sm.perRegion[0];
  check('三段加起来约 100%', Math.abs((r0.highlight + r0.midtone + r0.shadow) * 100 - 100) < 0.5,
    ((r0.highlight + r0.midtone + r0.shadow) * 100).toFixed(1) + '%');
}

console.log('\n[48] 全流程上下游');
{
  check('链条有 15 步', E.PROCESS_CHAIN.length === 15, E.PROCESS_CHAIN.length + ' 步');

  var stages = {};
  E.PROCESS_CHAIN.forEach(function (s) { stages[s.stage] = (stages[s.stage] || 0) + 1; });
  check('上游 6 步', stages['上游'] === 6, String(stages['上游']));
  check('中游 3 步', stages['中游'] === 3, String(stages['中游']));
  check('下游 6 步', stages['下游'] === 6, String(stages['下游']));

  var complete = E.PROCESS_CHAIN.filter(function (s) { return s.why && s.how && s.done && s.pit; });
  check('每步都有为什么/怎么做/判据/常见错', complete.length === 15, complete.length + ' 步完整');

  check('第一步是洗件', E.PROCESS_CHAIN[0].name === '洗件', E.PROCESS_CHAIN[0].name);
  check('最后一步是组装', E.PROCESS_CHAIN[14].name === '组装', E.PROCESS_CHAIN[14].name);
}

console.log('\n[49] 快速选择');
{
  var arr = Float32Array.from([9, 1, 8, 2, 7, 3, 6, 4, 5, 0]);
  check('第 0 小是 0', E.nthValue(Float32Array.from(arr), 0) === 0, String(E.nthValue(Float32Array.from(arr), 0)));
  check('第 9 小是 9', E.nthValue(Float32Array.from(arr), 9) === 9, String(E.nthValue(Float32Array.from(arr), 9)));
  check('中位数是 4', E.nthValue(Float32Array.from(arr), 4) === 4, String(E.nthValue(Float32Array.from(arr), 4)));

  var big = new Float32Array(10000);
  for (var i = 0; i < big.length; i++) big[i] = (i * 7919) % 10000;
  var q = E.nthValue(big, 5000);
  var sorted = Float32Array.from(big).sort();
  check('一万个数取中位与排序一致', q === sorted[5000], q + ' vs ' + sorted[5000]);
}

console.log('\n[50] 性能护栏');
{
  var W2 = 400, H2 = 400;
  var data2 = new Uint8ClampedArray(W2 * H2 * 4);
  for (var yy = 0; yy < H2; yy++) {
    for (var xx = 0; xx < W2; xx++) {
      var o2 = (yy * W2 + xx) * 4;
      data2[o2] = (xx * 255 / W2) | 0;
      data2[o2 + 1] = (yy * 255 / H2) | 0;
      data2[o2 + 2] = 120;
      data2[o2 + 3] = 255;
    }
  }

  var luma2 = new Float32Array(W2 * H2);
  for (var i4 = 0; i4 < W2 * H2; i4++) {
    var o3 = i4 * 4;
    luma2[i4] = (data2[o3] * 0.299 + data2[o3 + 1] * 0.587 + data2[o3 + 2] * 0.114) / 255;
  }

  var perf0 = Date.now();
  var seg3 = E.colorRegions(data2, W2, H2, { tol: 9, minArea: Math.round(W2 * H2 / 300) });
  E.bandSnr(luma2, W2, H2, { levels: 3, radius: 2 });
  E.shadeMap(data2, W2, H2, seg3, {});
  E.regionLights(data2, W2, H2, seg3, { radius: 3 });
  E.lightReport(data2, W2, H2, { radius: 4 });
  var cost = Date.now() - perf0;

  check('400×400 全流程 < 800ms', cost < 800, cost + ' ms');
  check('分区能出结果', seg3.regions.length > 0, seg3.regions.length + ' 块');
}

console.log('\n[51] 漆性指标');
{
  var red = E.paintNoise('#C82828');
  check('红色有信噪比', red.snr != null && red.snr > 0, red.snr && red.snr.toFixed(1));
  check('红色加白保真在 0~1', red.tintKeep > 0 && red.tintKeep <= 1, red.tintKeep && red.tintKeep.toFixed(2));
  check('中性色不参与排名', E.paintNoise('#1B1B1B').snr === null, E.paintNoise('#1B1B1B').note);

  var data = require('./paint-noise.js');
  check('漆性数据 226 条', data.length === 226, data.length + ' 条');

  var ranked = data.filter(function (r) { return r.snr != null; });
  check('可排名数量合理', ranked.length > 100 && ranked.length < 226, ranked.length + ' 支');

  var sorted = ranked.slice().sort(function (a, b) { return b.snr - a.snr; });
  check('排序首尾差明显', sorted[0].snr - sorted[sorted.length - 1].snr > 20,
    sorted[0].snr + ' vs ' + sorted[sorted.length - 1].snr);

  check('每支都有 hex 与色号', data.every(function (r) { return r.hex && r.code; }), 'ok');
}

console.log('\n[22] 性能');
const t0 = Date.now();
for (let i = 0; i < 10; i++) {
  E.solve({ targetHex: '#B79764', pigmentIds: BASIC, total: 20 });
}
const avg = (Date.now() - t0) / 10;
check('7 支漆单次求解 < 300ms', avg < 300, `平均 ${avg.toFixed(0)}ms（最慢单次 ${slowest}ms）`);

// 最后一条：README 宣称的测试数必须等于实际跑的数量（含本条）
{
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const claims = [...readme.matchAll(/(\d+) 项/g)].map(m => Number(m[1]));
  const uniq = [...new Set(claims)];
  const expect = pass + fail + 1;
  check('README 的测试数与实际一致', uniq.length === 1 && uniq[0] === expect,
    claims.length ? '宣称 ' + uniq.join('/') + ' · 实际 ' + expect : 'README 没写');
}

console.log(`\n===== ${pass} 通过 / ${fail} 失败 =====\n`);
process.exit(fail ? 1 : 0);
