/*!
 * TintEngine — 油漆调色计算内核（方案 A：调色模拟器）
 *
 * 混色物理模型：Kubelka-Munk 单常数理论（K/S 线性混合）
 * 光谱/色度基础数据：spectral.js v3.0.0 (MIT, © 2025 Ronald van Wijnen)
 *   https://github.com/rvanwijnen/spectral.js
 *
 * 本文件不依赖 DOM，可在浏览器和 Node 中运行。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TintEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ------------------------------------------------------------------
  // 调参总表
  //
  // 所有"手感"相关的阈值都集中在这里。改之前先想清楚要动哪一头：
  // 调大 = 更宽松/更保守（取决于条目），每条都写了方向。
  // ------------------------------------------------------------------
  var TUNING = {
    // —— 聚类 ——
    LAB_L_WEIGHT: 0.35,        // 明度在"颜色距离"里占的权重。调大→更看重明暗，调小→更看重色相
    KMEANS_ITERS: 12,          // k-means 迭代上限。调大更精确但更慢
    HUE_MERGE_DEG: 12,         // 色相相差多少度以内算同一块。调大→色块更少更干净，调小→分得更细

    // —— 色块筛选 ——
    MIN_SHARE: 0.0015,         // 面积下限（占比）。低于它、且不够艳的块会被丢掉
    MIN_CHROMA: 18,            // 彩度下限：够艳的小块即使面积小也保留（金边、蓝标识）
    NEUTRAL_CHROMA: 10,        // 低于这个彩度算中性色（白灰黑），合并更宽容
    NEUTRAL_MERGE_DE: 5,       // 中性色之间的合并容差（ΔE）
    COLOR_MERGE_DE: 3.5,       // 有彩色块之间的合并容差（ΔE）

    // —— 点缀色（主色解释不了的像素）——
    ACCENT_RESIDUAL_DE: 14,    // 离最近主色超过多少 ΔE 才算"解释不了"。调小→更多小色块，也更容易把噪点算进来
    ACCENT_MIN_SHARE: 0.0008,  // 点缀色最小面积占比

    // —— 求解器 ——
    HINT_DE: 3.5,              // 单支漆就能到这个 ΔE 以内时，提示"直接买这支"

    // —— 出量 ——
    DROP_ML: 0.04              // 一滴按多少毫升算。0.04 = 郡士滴管的常见口径
  };



  // ------------------------------------------------------------------
  // 依赖注入（延迟加载，方便单测时手动替换）
  // ------------------------------------------------------------------
  var cachedLib = null;

  function lib() {
    if (cachedLib) return cachedLib;
    if (typeof require === 'function') {
      cachedLib = require('./spectral.js');
    } else if (typeof globalThis !== 'undefined' && globalThis.spectral) {
      cachedLib = globalThis.spectral;
    }
    if (!cachedLib) throw new Error('spectral.js 尚未加载');
    return cachedLib;
  }

  function setLib(m) { cachedLib = m; }

  // ------------------------------------------------------------------
  // 基础工具
  // ------------------------------------------------------------------
  var MIN_R = 0.002;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  /** 反射率 -> K/S */
  function ksOf(R) {
    var out = new Array(R.length);
    for (var i = 0; i < R.length; i++) {
      var r = clamp(R[i], MIN_R, 1);
      out[i] = ((1 - r) * (1 - r)) / (2 * r);
    }
    return out;
  }

  /** K/S -> 反射率（Kubelka-Munk 反函数） */
  function rOfKs(ks) {
    return 1 + ks - Math.sqrt(ks * ks + 2 * ks);
  }

  /** hex -> {r,g,b} 0..255 */
  function hexToRgb(hex) {
    var h = String(hex).trim().replace(/^#/, '');
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('非法颜色值: ' + hex);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (x) {
      var v = Math.round(clamp(x, 0, 255));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('').toUpperCase();
  }

  // ------------------------------------------------------------------
  // CIE Lab / ΔE00
  // ------------------------------------------------------------------
  var whiteCache = null;

  function refWhite() {
    if (!whiteCache) whiteCache = new (lib().Color)('#FFFFFF').XYZ;
    return whiteCache;
  }

  function xyzToLab(xyz) {
    var w = refWhite();
    var EPS = 216 / 24389;
    var KAPPA = 24389 / 27;

    function f(t) {
      return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
    }

    var fx = f(xyz[0] / w[0]);
    var fy = f(xyz[1] / w[1]);
    var fz = f(xyz[2] / w[2]);

    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  /** 任意 hex -> Lab（与混色结果走同一套光谱管道，保证自洽） */
  function labOfHex(hex) {
    return xyzToLab(new (lib().Color)(hex).XYZ);
  }

  /** CIEDE2000，kL = kC = kH = 1 */
  function deltaE00(lab1, lab2) {
    var L1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
    var L2 = lab2[0], a2 = lab2[1], b2 = lab2[2];

    var RAD = Math.PI / 180;
    var DEG = 180 / Math.PI;

    var C1 = Math.hypot(a1, b1);
    var C2 = Math.hypot(a2, b2);
    var Cbar = (C1 + C2) / 2;
    var Cbar7 = Math.pow(Cbar, 7);
    var G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

    var a1p = (1 + G) * a1;
    var a2p = (1 + G) * a2;
    var C1p = Math.hypot(a1p, b1);
    var C2p = Math.hypot(a2p, b2);

    var h1p = C1p === 0 ? 0 : (Math.atan2(b1, a1p) * DEG + 360) % 360;
    var h2p = C2p === 0 ? 0 : (Math.atan2(b2, a2p) * DEG + 360) % 360;

    var dLp = L2 - L1;
    var dCp = C2p - C1p;
    var dhp;

    if (C1p * C2p === 0) {
      dhp = 0;
    } else {
      dhp = h2p - h1p;
      if (dhp > 180) dhp -= 360;
      else if (dhp < -180) dhp += 360;
    }

    var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * RAD) / 2);

    var Lbar = (L1 + L2) / 2;
    var Cbarp = (C1p + C2p) / 2;
    var hbarp;

    if (C1p * C2p === 0) {
      hbarp = h1p + h2p;
    } else if (Math.abs(h1p - h2p) <= 180) {
      hbarp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
      hbarp = (h1p + h2p + 360) / 2;
    } else {
      hbarp = (h1p + h2p - 360) / 2;
    }

    var T = 1
      - 0.17 * Math.cos((hbarp - 30) * RAD)
      + 0.24 * Math.cos(2 * hbarp * RAD)
      + 0.32 * Math.cos((3 * hbarp + 6) * RAD)
      - 0.20 * Math.cos((4 * hbarp - 63) * RAD);

    var dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
    var Cbarp7 = Math.pow(Cbarp, 7);
    var RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
    var SL = 1 + (0.015 * Math.pow(Lbar - 50, 2)) / Math.sqrt(20 + Math.pow(Lbar - 50, 2));
    var SC = 1 + 0.045 * Cbarp;
    var SH = 1 + 0.015 * Cbarp * T;
    var RT = -Math.sin(2 * dTheta * RAD) * RC;

    var tL = dLp / SL;
    var tC = dCp / SC;
    var tH = dHp / SH;

    return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
  }

  // ------------------------------------------------------------------
  // 混色
  // ------------------------------------------------------------------
  /** weights 与 comps 一一对应；返回 38 波段反射率 */
  function mixSpectrum(comps, weights) {
    var n = comps[0].ks.length;
    var total = 0;
    for (var i = 0; i < weights.length; i++) total += weights[i];
    if (total <= 0) return null;

    var R = new Array(n);
    for (var b = 0; b < n; b++) {
      var s = 0;
      for (var k = 0; k < comps.length; k++) s += comps[k].ks[b] * weights[k];
      R[b] = clamp(rOfKs(s / total), MIN_R, 1);
    }
    return R;
  }

  function measure(R) {
    var c = new (lib().Color)(R);
    return {
      R: R,
      XYZ: c.XYZ,
      lab: xyzToLab(c.XYZ),
      hex: c.toString({ format: 'hex' }),
      inGamut: c.inGamut()
    };
  }

  // ------------------------------------------------------------------
  // 求解：对数坐标搜索 + ΔE00 局部精修
  // ------------------------------------------------------------------
  /**
   * 把对数坐标 z 映射成权重（softmax）。
   * 用对数坐标的原因：真实配方动辄是 98% : 1.5% : 0.5% 这种量级跨度，
   * 线性空间里的搜索几乎走不动，取对数后步长才是“倍率”，能同时兼顾大小组分。
   */
  function buildWeights(z, freeIdx, fixedW, freeTotal) {
    var m = -Infinity;
    var i;
    for (i = 0; i < z.length; i++) if (z[i] > m) m = z[i];

    var e = new Array(z.length);
    var s = 0;
    for (i = 0; i < z.length; i++) { e[i] = Math.exp(z[i] - m); s += e[i]; }

    var w = fixedW.slice();
    for (var k = 0; k < freeIdx.length; k++) w[freeIdx[k]] = (freeTotal * e[k]) / s;
    return w;
  }

  /** 对数坐标下的坐标下降（步长逐级缩小） */
  function logSearch(comps, targetLab, freeIdx, fixedW, freeTotal, z0) {
    var bestZ = z0.slice();
    var bestW = buildWeights(bestZ, freeIdx, fixedW, freeTotal);
    var bestDE = deltaE00(measure(mixSpectrum(comps, bestW)).lab, targetLab);

    var steps = [6, 3, 1.5, 0.7, 0.35, 0.16, 0.07, 0.03];
    var CAP = 8;

    for (var s = 0; s < steps.length; s++) {
      var step = steps[s];
      var improved = true;
      var guard = 0;

      while (improved && guard++ < 40) {
        improved = false;
        for (var i = 0; i < bestZ.length; i++) {
          for (var sign = -1; sign <= 1; sign += 2) {
            var cand = bestZ.slice();
            cand[i] = Math.max(-CAP, Math.min(CAP, cand[i] + sign * step));

            var w = buildWeights(cand, freeIdx, fixedW, freeTotal);
            var de = deltaE00(measure(mixSpectrum(comps, w)).lab, targetLab);

            if (de < bestDE - 1e-9) {
              bestZ = cand;
              bestDE = de;
              improved = true;
            }
          }
        }
      }
    }

    return { w: buildWeights(bestZ, freeIdx, fixedW, freeTotal), de: bestDE };
  }

  /** 按 ΔE00 做成对转移的局部搜索 */
  function refine(w, comps, targetLab, fixedIdx) {
    var best = w.slice();
    var R = mixSpectrum(comps, best);
    var m = measure(R);
    var bestDE = deltaE00(m.lab, targetLab);
    var bestR = m.R;
    var bestLab = m.lab;

    var steps = [0.12, 0.05, 0.02, 0.008];
    var n = best.length;

    for (var s = 0; s < steps.length; s++) {
      var step = steps[s];
      var improved = true;
      var guard = 0;
      while (improved && guard++ < 60) {
        improved = false;
        for (var i = 0; i < n; i++) {
          if (fixedIdx.indexOf(i) >= 0) continue;   // 固定组分（基漆）只能被消耗到 0，必须保护
          if (best[i] < step) continue;
          for (var j = 0; j < n; j++) {
            if (i === j) continue;
            if (fixedIdx.indexOf(j) >= 0) continue;
            best[i] -= step;
            best[j] += step;
            var R2 = mixSpectrum(comps, best);
            var l2 = xyzToLab(new (lib().Color)(R2).XYZ);
            var de2 = deltaE00(l2, targetLab);
            if (de2 < bestDE - 1e-7) {
              bestDE = de2; bestR = R2; bestLab = l2;
              improved = true;
            } else {
              best[i] += step;
              best[j] -= step;
            }
          }
        }
      }
    }
    return { w: best, de: bestDE, R: bestR, lab: bestLab };
  }

  // ------------------------------------------------------------------
  // 郡士（GSI Creos / Mr.Hobby）Mr. Color 色库
  // ------------------------------------------------------------------
  var PAINT_DB = (typeof module === 'object' && module.exports)
    ? require('./gunze-data.js')
    : (typeof globalThis !== 'undefined' ? globalThis.GUNZE_COLORS : null);

  if (!PAINT_DB || !PAINT_DB.length) {
    throw new Error('郡士色库 gunze-data.js 没有加载');
  }

  var FINISH_CN = {
    'Gloss': '光泽', 'Semi-Gloss': '半光', 'Satin': '半光',
    'Flat': '消光', 'Matt': '消光', 'Metallic': '金属'
  };

  var PIGMENTS = PAINT_DB.map(function (p) {
    return {
      id: p.id,
      code: p.code || p.id,
      name: p.nameCn || p.name,
      nameEn: p.name,
      hex: p.hex,
      family: p.core ? '基础色' : '郡士色',
      note: '郡士 ' + (p.id || p.code) + (p.finish ? ' · ' + (FINISH_CN[p.finish] || p.finish) : ''),
      core: !!p.core,
      kind: p.kind || 'solid',
      mixable: p.kind !== 'additive'
    };
  });

  /** 需要“先打白底”时用的白，郡士这边就是 C1 */
  var BASE_PAINT = { id: 'base', code: 'C1', name: '白色打底', hex: '#F4F4F1', family: '基漆', note: '' };

  var PRESET_CODES = ['C39', 'C13', 'C14', 'C12', 'C19', 'C29'];

  var PRESETS = PRESET_CODES.map(function (code) {
    var p = PIGMENTS.filter(function (x) { return x.code === code; })[0];
    return p ? { name: code + ' ' + p.name, hex: p.hex } : null;
  }).filter(Boolean);

  // 色相缓存：226 支漆每次都重算 Lab 太慢
  var hueCache = {};

  function pigmentHue(p) {
    if (hueCache[p.id] === undefined) {
      var lab = labOfHex(p.hex);
      hueCache[p.id] = hueAngle(lab);
    }
    return hueCache[p.id];
  }

  function hueAngle(lab) {
    var h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
    return h < 0 ? h + 360 : h;
  }

  function hueDelta(a, b) {
    var d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  // 同上，供测配色时比较两支色浆
  var labCache = {};

  function pigLab(p) {
    if (!labCache[p.id]) labCache[p.id] = labOfHex(p.hex);
    return labCache[p.id];
  }

  // ------------------------------------------------------------------
  // 主求解入口
  // ------------------------------------------------------------------
  /**
   * @param {Object} opts
   * @param {string} opts.targetHex     目标色
   * @param {string[]} opts.pigmentIds  选中的色浆 id（1~6 个）
   * @param {number} [opts.baseShare]   基漆占比 0~1
   * @param {number} [opts.total]       总重量（仅用于换算，默认 1000）
   */
  function solve(opts) {
    var targetHex = opts.targetHex;
    var ids = (opts.pigmentIds || []).slice(0, 8);
    var baseShare = clamp(opts.baseShare || 0, 0, 0.95);
    var total = opts.total || 20;

    var byId = {};
    PIGMENTS.forEach(function (p) { byId[p.id] = p; });

    var target = new (lib().Color)(targetHex);
    var targetLab = xyzToLab(target.XYZ);

    var comps = [];
    var weights = [];
    var meta = [];
    var fixedIdx = [];

    if (baseShare > 0) {
      comps.push({ ks: ksOf(new (lib().Color)(BASE_PAINT.hex).R) });
      weights.push(baseShare);
      meta.push({ pigment: BASE_PAINT, isBase: true });
      fixedIdx.push(0);
    }

    var chosen = ids.map(function (id) { return byId[id]; })
      .filter(Boolean)
      .filter(function (p) { return p.mixable; });
    chosen.forEach(function (p) {
      comps.push({ ks: ksOf(new (lib().Color)(p.hex).R) });
      weights.push(0);
      meta.push({ pigment: p });
    });

    if (comps.length === 0) {
      return {
        ok: false,
        error: '至少选一支漆'
      };
    }

    // 只剩固定组分（例如只有基漆）
    var freeCount = weights.length - fixedIdx.length;
    var result;

    if (freeCount === 0) {
      var R0 = mixSpectrum(comps, weights);
      var m0 = measure(R0);
      result = { w: weights, de: deltaE00(m0.lab, targetLab), R: m0.R, lab: m0.lab, hex: m0.hex, inGamut: m0.inGamut };
    } else {
      var freeTotal = 1 - baseShare;
      var freeIdx = [];
      for (var fi = 0; fi < weights.length; fi++) {
        if (fixedIdx.indexOf(fi) < 0) freeIdx.push(fi);
      }

      // 多起点：均分，以及每支色浆各自主导一次。
      // 真实配方几乎都是“一支主色 + 一两支辅色”，单起点很容易掉进局部最优。
      var starts = [new Array(freeIdx.length).fill(0)];
      for (var s0 = 0; s0 < freeIdx.length; s0++) {
        var z0 = new Array(freeIdx.length).fill(0);
        z0[s0] = 2.4;
        starts.push(z0);
      }

      var best = null;
      for (var si = 0; si < starts.length; si++) {
        var run = logSearch(comps, targetLab, freeIdx, weights, freeTotal, starts[si]);
        if (!best || run.de < best.de) best = run;
      }

      var ref = refine(best.w, comps, targetLab, fixedIdx);

      // 清掉数值噪声
      var cleaned = ref.w.map(function (x, idx) {
        return fixedIdx.indexOf(idx) >= 0 ? x : (x < 1e-5 ? 0 : x);
      });
      var sum = cleaned.reduce(function (a, b) { return a + b; }, 0);
      cleaned = cleaned.map(function (x) { return x / sum; });

      var mf = measure(mixSpectrum(comps, cleaned));
      result = {
        w: cleaned,
        de: deltaE00(mf.lab, targetLab),
        R: mf.R,
        lab: mf.lab,
        hex: mf.hex,
        inGamut: mf.inGamut
      };
    }

    // ---- 混了不同漆种时，说明物理后果 ----
    var warnings = [];
    var kinds = {};
    meta.forEach(function (m) { if (m.pigment && m.pigment.kind) kinds[m.pigment.kind] = true; });
    if (kinds.metal && kinds.solid) {
      warnings.push('金属漆和实色混在一起，金属粉会被实色盖住，金属感会明显减弱。');
    }
    if (kinds.clear && (kinds.solid || kinds.metal)) {
      warnings.push('透明漆混进实色或金属漆会发浑；伪电镀、糖果色是分层喷出来的，不是混出来的。');
    }
    if (kinds.metal && kinds.clear) {
      warnings.push('透明色罩在金属色上才是糖果色/伪电镀的做法——先银底，再罩透明色，别直接混。');
    }

    // ---- 组装成可读的配方 ----
    var lines = meta.map(function (m, idx) {
      return {
        pigment: m.pigment,
        isBase: !!m.isBase,
        share: result.w[idx],
        amount: result.w[idx] * total,
        hex: m.pigment.hex
      };
    }).filter(function (l) { return l.share > 5e-4; });

    lines.sort(function (a, b) {
      if (a.isBase !== b.isBase) return a.isBase ? -1 : 1;
      return b.amount - a.amount;
    });

    var maxAmt = Math.max.apply(null, lines.map(function (l) { return l.amount; }));

    lines.forEach(function (l) {
      l.percent = l.share * 100;
      // 份数按“用量最大的组分 = 100 份”折算，方便没有天平的时候按比例舀
      l.parts = maxAmt > 0 ? (l.amount / maxAmt) * 100 : 0;
    });

    // ---- 失败诊断：与其猜，不如真算一遍“补一支会怎样” ----
    var hint = null;

    if (result.de > TUNING.HINT_DE && !opts._noHint) {
      // 1) 白基漆是不是加多了
      if (baseShare > 0) {
        var alt0 = solve({
          targetHex: targetHex, pigmentIds: ids, baseShare: 0, total: total, _noHint: true
        });
        if (alt0.ok && alt0.deltaE < Math.min(2, result.de - 1.5)) {
          hint = '白基漆占了 ' + Math.round(baseShare * 100) + '%，深色被冲淡了：基漆降到 0% 时 ΔE 只有 ' +
            alt0.deltaE.toFixed(1) + '。';
        }
      }

      // 2) 补一支、或者换掉最鸡肋的那一支
      if (!hint) {
        var usedIds = chosen.map(function (p) { return p.id; });

        var weakest = null;
        lines.forEach(function (l) {
          if (l.isBase) return;
          if (!weakest || l.share < weakest.share) weakest = l;
        });

        // 226 支全试太慢，只挑 10 支候选：先基础色，再按色相接近程度
        var th = hueAngle(targetLab);
        var cands = PIGMENTS
          .filter(function (p) { return usedIds.indexOf(p.id) < 0; })
          .map(function (p) {
            return { p: p, score: (p.core ? -360 : 0) + hueDelta(pigmentHue(p), th) };
          })
          .sort(function (a, b) { return a.score - b.score; })
          .slice(0, usedIds.length >= 8 ? 4 : 8);

        var bestAdd = null;

        for (var pi = 0; pi < cands.length; pi++) {
          var cand = cands[pi].p;

          var baseIds = usedIds;
          var swapOut = null;

          // 已经选满时，用候选色替换掉当前配方里占比最小的那支
          if (usedIds.length >= 8) {
            if (!weakest) continue;
            baseIds = usedIds.filter(function (id) { return id !== weakest.pigment.id; });
            swapOut = weakest.pigment;
          }

          var alt = solve({
            targetHex: targetHex,
            pigmentIds: baseIds.concat(cand.id),
            baseShare: baseShare,
            total: total,
            _noHint: true
          });

          if (alt.ok && (!bestAdd || alt.deltaE < bestAdd.de)) {
            bestAdd = { p: cand, de: alt.deltaE, swapOut: swapOut };
          }
        }

        if (bestAdd && bestAdd.de < result.de - 1.5) {
          hint = bestAdd.swapOut
            ? '把「' + bestAdd.swapOut.name + '」换成「' + bestAdd.p.name + '」后，ΔE 可以从 ' +
              result.de.toFixed(1) + ' 降到 ' + bestAdd.de.toFixed(1) + '。'
            : '加一支「' + bestAdd.p.name + '」后，ΔE 可以从 ' + result.de.toFixed(1) +
              ' 降到 ' + bestAdd.de.toFixed(1) + '。';
        }
      }

      // 3) 兜底
      if (!hint) {
        hint = result.de > 6
          ? '这个色超出了现有色浆能覆盖的范围：要么补鲜艳的原色色浆，要么换一种基漆。'
          : '偏差偏大，可以多勾一两支邻近色相的色浆再算。';
      }
    }

    return {
      ok: true,
      target: { hex: targetHex, lab: targetLab },
      predicted: { hex: result.hex, lab: result.lab, inGamut: result.inGamut },
      deltaE: result.de,
      lines: lines,
      total: total,
      baseShare: baseShare,
      warnings: warnings,
      missingHue: hint
    };
  }

  // ------------------------------------------------------------------
  // 照片分析：把一张图拆成几块主色
  // ------------------------------------------------------------------
  function srgbToLin(v) {
    v = v / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function linToSrgb(x) {
    var c = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return Math.round(clamp(c, 0, 1) * 255);
  }

  function linToLab(lin) {
    var X = 0.41239079926595934 * lin[0] + 0.357584339383878 * lin[1] + 0.1804807884018343 * lin[2];
    var Y = 0.21263900587151027 * lin[0] + 0.715168678767756 * lin[1] + 0.07219231536073371 * lin[2];
    var Z = 0.01933081871559182 * lin[0] + 0.11919477979462598 * lin[1] + 0.9505321522496607 * lin[2];

    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }

    var fx = f(X / 0.95047);
    var fy = f(Y);
    var fz = f(Z / 1.08883);

    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  /**
   * 把像素样本聚成 k 块主色（Lab 空间 k-means）。
   *
   * @param {number[][]} samples [[r,g,b], ...]，0-255
   * @param {Object} opts { k: 4~8, whiteRef: [r,g,b]|null }
   * @return {{clusters: Array, wb: boolean}}
   */
  function analyzeImage(samples, opts) {
    opts = opts || {};
    var k = Math.max(2, Math.min(10, opts.k || 6));

    // 白平衡：把参考色（通常是背景）拉成中性
    var gain = opts.gain || null;
    if (!gain && opts.whiteRef) {
      var rl = srgbToLin(opts.whiteRef[0]);
      var gl = srgbToLin(opts.whiteRef[1]);
      var bl = srgbToLin(opts.whiteRef[2]);
      var m = (rl + gl + bl) / 3;
      if (rl > 0.01 && gl > 0.01 && bl > 0.01) gain = [m / rl, m / gl, m / bl];
    }

    var pts = [];
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var lin = [
        clamp(srgbToLin(s[0]) * (gain ? gain[0] : 1), 0, 1),
        clamp(srgbToLin(s[1]) * (gain ? gain[1] : 1), 0, 1),
        clamp(srgbToLin(s[2]) * (gain ? gain[2] : 1), 0, 1)
      ];
      pts.push({ lin: lin, lab: linToLab(lin) });
    }

    if (!pts.length) return { clusters: [], wb: !!gain };

    // 初始化分两步，避免被大面积背景带偏：
    // 1) 先做颜色直方图，只保留出现最多的若干种颜色
    // 2) 在这些颜色里做“最远点”采样，保证初始中心彼此分得开
    var bins = {};
    for (var q = 0; q < samples.length; q++) {
      var s2 = samples[q];
      var key = ((s2[0] >> 4) << 8) | ((s2[1] >> 4) << 4) | (s2[2] >> 4);
      var bin = bins[key];
      if (!bin) bins[key] = bin = { n: 0, r: 0, g: 0, b: 0 };
      bin.n++;
      bin.r += s2[0];
      bin.g += s2[1];
      bin.b += s2[2];
    }

    var cands = [];
    for (var key2 in bins) {
      var bn = bins[key2];
      cands.push({
        n: bn.n,
        lab: linToLab([
          srgbToLin(bn.r / bn.n),
          srgbToLin(bn.g / bn.n),
          srgbToLin(bn.b / bn.n)
        ])
      });
    }
    cands.sort(function (a, b) { return b.n - a.n; });

    // 面积大的颜色优先，但金色、蓝色这种小面积高彩度的不能丢
    var byCount = cands.slice(0, Math.max(20, k * 5));
    var byChroma = cands.slice().sort(function (a, b) {
      return Math.hypot(b.lab[1], b.lab[2]) - Math.hypot(a.lab[1], a.lab[2]);
    }).slice(0, 14);

    var merged = byCount.slice();
    byChroma.forEach(function (x) {
      if (merged.indexOf(x) < 0) merged.push(x);
    });

    cands = merged;

    function dist2(p1, p2) {
      var dL = p1[0] - p2[0];
      var da = p1[1] - p2[1];
      var db = p1[2] - p2[2];
      return dL * dL + da * da + db * db;
    }

    var centers = [cands[0].lab.slice()];
    cands.shift();

    // 先留两个位置给“小面积鲜艳色”，别让灰色系占满
    var mainSlots = Math.max(1, k - 2);

    while (centers.length < mainSlots && cands.length) {
      var pick = 0;
      var pickScore = -1;

      for (var ci = 0; ci < cands.length; ci++) {
        var dmin = Infinity;
        for (var cj = 0; cj < centers.length; cj++) {
          var dd = dist2(cands[ci].lab, centers[cj]);
          if (dd < dmin) dmin = dd;
        }
        // 乘上出现次数的平方根：既分散，又不会挑到一个孤立的杂点
        var score = dmin * Math.sqrt(cands[ci].n);
        if (score > pickScore) { pickScore = score; pick = ci; }
      }

      centers.push(cands[pick].lab.slice());
      cands.splice(pick, 1);
    }

    // 每个 45° 色相扇区至少给一个中心。
    // 不然金色、蓝色这种小面积颜色，会被“面积×距离”的打分压下去。
    var sectors = {};
    cands.forEach(function (x) {
      var ch = Math.hypot(x.lab[1], x.lab[2]);
      if (ch < 10) return;
      var hh = Math.atan2(x.lab[2], x.lab[1]) * 180 / Math.PI;
      if (hh < 0) hh += 360;
      var sec = Math.floor(hh / 45);
      if (!sectors[sec] || ch > sectors[sec].c) sectors[sec] = { x: x, c: ch };
    });

    Object.keys(sectors).forEach(function (sk) {
      if (centers.length >= k) return;
      var x = sectors[sk].x;
      for (var ci2 = 0; ci2 < centers.length; ci2++) {
        if (dist2(centers[ci2], x.lab) < 225) return;   // 15 以内就算有了
      }
      centers.push(x.lab.slice());
    });

var assign = new Array(pts.length).fill(0);

    for (var iter = 0; iter < TUNING.KMEANS_ITERS; iter++) {
      var changed = false;

      for (var p = 0; p < pts.length; p++) {
        var best = 0;
        var bestD = Infinity;
        for (var c2 = 0; c2 < centers.length; c2++) {
          var dL = (pts[p].lab[0] - centers[c2][0]) * TUNING.LAB_L_WEIGHT;
          var da = pts[p].lab[1] - centers[c2][1];
          var db = pts[p].lab[2] - centers[c2][2];
          var d = dL * dL + da * da + db * db;
          if (d < bestD) { bestD = d; best = c2; }
        }
        if (assign[p] !== best) { assign[p] = best; changed = true; }
      }

      var sums = [];
      for (var c3 = 0; c3 < centers.length; c3++) sums.push({ n: 0, lin: [0, 0, 0] });

      for (var p2 = 0; p2 < pts.length; p2++) {
        var a2 = assign[p2];
        sums[a2].n++;
        sums[a2].lin[0] += pts[p2].lin[0];
        sums[a2].lin[1] += pts[p2].lin[1];
        sums[a2].lin[2] += pts[p2].lin[2];
      }

      for (var c4 = 0; c4 < centers.length; c4++) {
        if (!sums[c4].n) continue;
        centers[c4] = linToLab([
          sums[c4].lin[0] / sums[c4].n,
          sums[c4].lin[1] / sums[c4].n,
          sums[c4].lin[2] / sums[c4].n
        ]);
      }

      if (!changed) break;
    }

    var groups = [];
    for (var c5 = 0; c5 < centers.length; c5++) groups.push({ n: 0, idx: [] });
    for (var p3 = 0; p3 < pts.length; p3++) {
      groups[assign[p3]].n++;
      groups[assign[p3]].idx.push(p3);
    }

    var clusters = [];

    groups.forEach(function (grp, gi) {
      if (!grp.n) return;

      // 同一块里明度跨度很大，多半是同一支漆的亮面和暗面。
      // 取明度 85 分位附近那批像素当代表色，阴影不参与平均。
      var ls = grp.idx.map(function (i) { return pts[i].lab[0]; }).sort(function (a, b) { return a - b; });
      var p70 = ls[Math.min(ls.length - 1, Math.floor(ls.length * 0.92))];

      var keep = grp.idx.filter(function (i) { return Math.abs(pts[i].lab[0] - p70) <= 5; });
      if (!keep.length) keep = grp.idx;

      var lin = [0, 0, 0];
      keep.forEach(function (i) {
        lin[0] += pts[i].lin[0];
        lin[1] += pts[i].lin[1];
        lin[2] += pts[i].lin[2];
      });
      lin = [lin[0] / keep.length, lin[1] / keep.length, lin[2] / keep.length];

      // 漆面感：同一块里亮面和暗面的色相/彩度会不会变。
      // 实色漆只是变亮变暗，色相不动；金属/珠光会随角度偏色。
      var order = grp.idx.slice().sort(function (a, b) { return pts[a].lab[0] - pts[b].lab[0]; });
      var k30 = Math.max(1, Math.floor(order.length * 0.3));

      function meanLabOf(list) {
        var acc = [0, 0, 0];
        list.forEach(function (i) {
          acc[0] += pts[i].lab[0];
          acc[1] += pts[i].lab[1];
          acc[2] += pts[i].lab[2];
        });
        return [acc[0] / list.length, acc[1] / list.length, acc[2] / list.length];
      }

      var loLab = meanLabOf(order.slice(0, k30));
      var hiLab = meanLabOf(order.slice(-k30));

      var cLo = Math.hypot(loLab[1], loLab[2]);
      var cHi = Math.hypot(hiLab[1], hiLab[2]);
      var dHue = Math.abs(hueAngle(hiLab) - hueAngle(loLab));
      if (dHue > 180) dHue = 360 - dHue;
      var cRatio = cLo > 1 ? cHi / cLo : 1;

      var chroma = Math.hypot(hiLab[1], hiLab[2]);
      var sheen = "实色";

      // 白灰黑这种低彩度的，色相本来就不稳，别硬判金属
      if (chroma >= 12) {
        if (dHue > 14 || cRatio > 1.7) sheen = "随角异色";
        else if (dHue > 6 || cRatio > 1.3) sheen = "可能金属";
      }

      clusters.push({
        hex: rgbToHex(linToSrgb(lin[0]), linToSrgb(lin[1]), linToSrgb(lin[2])),
        share: grp.n / pts.length,
        lab: linToLab(lin),
        lin: lin,
        n: grp.n,
        lMin: Math.round(ls[0]),
        lMax: Math.round(ls[ls.length - 1]),
        members: [gi],
        dHue: dHue,
        cRatio: cRatio,
        sheen: sheen
      });
    });

    clusters.sort(function (a, b) { return b.n - a.n; });

    // 色相相近的块合并：一个漆被亮面/暗面拆成两块时并回去。
    // 中性色（彩度低）不合并，否则白灰黑会糊成一团。
    var merged = [];
    clusters.forEach(function (c) {
      var chroma = Math.hypot(c.lab[1], c.lab[2]);
      if (chroma < 10) { merged.push(c); return; }

      var hit = null;
      var cHue = hueAngle(c.lab);

      for (var m = 0; m < merged.length; m++) {
        var mm = merged[m];
        if (Math.hypot(mm.lab[1], mm.lab[2]) < 10) continue;

        var dh = Math.abs(hueAngle(mm.lab) - cHue);
        if (dh > 180) dh = 360 - dh;

        // 同一支漆的亮面和暗面：色相几乎不变，只是明度和彩度在变
        if (dh < TUNING.HUE_MERGE_DEG) { hit = mm; break; }
      }

      if (!hit) { merged.push(c); return; }

      hit.n += c.n;
      hit.share += c.share;
      hit.members = hit.members.concat(c.members);
      hit.lMin = Math.min(hit.lMin, c.lMin);
      hit.lMax = Math.max(hit.lMax, c.lMax);

      // 代表色取受光那一面，别被暗面拉黑
      if (c.lab[0] > hit.lab[0]) {
        hit.lab = c.lab;
        hit.lin = c.lin;
        hit.hex = c.hex;
      }
    });

    clusters = merged.filter(function (c) {
      var chroma = Math.hypot(c.lab[1], c.lab[2]);
      return c.share >= TUNING.MIN_SHARE || chroma >= TUNING.MIN_CHROMA;   // 小面积但鲜艳的（金色、蓝色标记）也留着
    });

    // 再并一次“看起来根本是同一个色”的块：
    // 两块白、两块灰这种，对用户没有意义
    var uniq = [];
    clusters.forEach(function (c) {
      var hit = null;
      var cChroma = Math.hypot(c.lab[1], c.lab[2]);
      var tol = cChroma < TUNING.NEUTRAL_CHROMA ? TUNING.NEUTRAL_MERGE_DE : TUNING.COLOR_MERGE_DE;

      for (var u = 0; u < uniq.length; u++) {
        if (deltaE00(c.lab, uniq[u].lab) < tol) { hit = uniq[u]; break; }
      }
      if (!hit) { uniq.push(c); return; }

      hit.n += c.n;
      hit.share += c.share;
      hit.members = hit.members.concat(c.members);
      hit.lMin = Math.min(hit.lMin, c.lMin);
      hit.lMax = Math.max(hit.lMax, c.lMax);

      if (c.lab[0] > hit.lab[0]) {
        hit.lab = c.lab;
        hit.lin = c.lin;
        hit.hex = c.hex;
      }
    });

    clusters = uniq;
    clusters.sort(function (a, b) { return b.share - a.share; });

    // ---- 点缀色：主色解释不了的像素 ----
    // 金色、蓝色标识这种面积 1% 以下的颜色，按面积聚类永远分不到中心。
    // 这里反过来做：算每个像素离最近主色多远，远的那批单独聚一次。
    var residual = [];
    for (var rp = 0; rp < pts.length; rp++) {
      var minD = Infinity;
      for (var rc = 0; rc < clusters.length; rc++) {
        var dl2 = (pts[rp].lab[0] - clusters[rc].lab[0]) * TUNING.LAB_L_WEIGHT;
        var da2 = pts[rp].lab[1] - clusters[rc].lab[1];
        var db2 = pts[rp].lab[2] - clusters[rc].lab[2];
        var dd2 = dl2 * dl2 + da2 * da2 + db2 * db2;
        if (dd2 < minD) minD = dd2;
      }
      if (minD > TUNING.ACCENT_RESIDUAL_DE * TUNING.ACCENT_RESIDUAL_DE) residual.push(rp);
    }

    var accents = [];

    if (residual.length >= pts.length * 0.001 && residual.length >= 60) {
      // 残差里分两类，够大的才留下
      var rc1 = pts[residual[0]].lab.slice();
      var far = residual[0];
      var farD = -1;
      residual.forEach(function (i) {
        var d0 = Math.pow(pts[i].lab[0] - rc1[0], 2) + Math.pow(pts[i].lab[1] - rc1[1], 2) + Math.pow(pts[i].lab[2] - rc1[2], 2);
        if (d0 > farD) { farD = d0; far = i; }
      });
      var rc2 = pts[far].lab.slice();

      var lab1 = residual.map(function () { return 0; });

      for (var it2 = 0; it2 < 10; it2++) {
        var s1 = [0, 0, 0], s2 = [0, 0, 0], n1 = 0, n2 = 0;
        residual.forEach(function (i) {
          var d1 = Math.pow(pts[i].lab[0] - rc1[0], 2) + Math.pow(pts[i].lab[1] - rc1[1], 2) + Math.pow(pts[i].lab[2] - rc1[2], 2);
          var d2 = Math.pow(pts[i].lab[0] - rc2[0], 2) + Math.pow(pts[i].lab[1] - rc2[1], 2) + Math.pow(pts[i].lab[2] - rc2[2], 2);
          if (d1 <= d2) { s1[0] += pts[i].lab[0]; s1[1] += pts[i].lab[1]; s1[2] += pts[i].lab[2]; n1++; }
          else { s2[0] += pts[i].lab[0]; s2[1] += pts[i].lab[1]; s2[2] += pts[i].lab[2]; n2++; }
        });
        if (n1) rc1 = [s1[0] / n1, s1[1] / n1, s1[2] / n1];
        if (n2) rc2 = [s2[0] / n2, s2[1] / n2, s2[2] / n2];
      }

      // 收敛后再分一次组，把像素下标留下来，方便点选时高亮
      var g1 = [];
      var g2 = [];

      residual.forEach(function (i) {
        var d1 = Math.pow(pts[i].lab[0] - rc1[0], 2) + Math.pow(pts[i].lab[1] - rc1[1], 2) + Math.pow(pts[i].lab[2] - rc1[2], 2);
        var d2 = Math.pow(pts[i].lab[0] - rc2[0], 2) + Math.pow(pts[i].lab[1] - rc2[1], 2) + Math.pow(pts[i].lab[2] - rc2[2], 2);
        if (d1 <= d2) g1.push(i); else g2.push(i);
      });

      [[rc1, g1], [rc2, g2]].forEach(function (pair) {
        var group = pair[1];
        if (group.length < pts.length * TUNING.ACCENT_MIN_SHARE) return;

        var labA = pair[0];
        var rgbA = labToSrgb(labA);

        accents.push({
          hex: rgbToHex(rgbA[0], rgbA[1], rgbA[2]),
          share: group.length / pts.length,
          lab: labA,
          accent: true,
          indices: group
        });
      });
    }

    // 合并会让块数变少，逐像素的分类结果还指着旧编号，必须映射回来
    var indexMap = [];
    clusters.forEach(function (c, newIdx) {
      (c.members || []).forEach(function (m) { indexMap[m] = newIdx; });
    });

    return { clusters: clusters, accents: accents, wb: !!gain, centers: centers, gain: gain, indexMap: indexMap };
  }

  /**
   * 把整张图逐像素归到最近的聚类中心，用来画分区图。
   * @param {Uint8ClampedArray} data RGBA
   * @return {Uint8Array} 每个像素的块编号
   */
  function classifyPixels(data, width, height, centers, gain) {
    var out = new Uint8Array(width * height);

    for (var p = 0; p < width * height; p++) {
      var i = p * 4;
      var lin = [
        clamp(srgbToLin(data[i]) * (gain ? gain[0] : 1), 0, 1),
        clamp(srgbToLin(data[i + 1]) * (gain ? gain[1] : 1), 0, 1),
        clamp(srgbToLin(data[i + 2]) * (gain ? gain[2] : 1), 0, 1)
      ];
      var lab = linToLab(lin);

      var best = 0;
      var bd = Infinity;
      for (var c = 0; c < centers.length; c++) {
        var dL = lab[0] - centers[c][0];
        var da = lab[1] - centers[c][1];
        var db = lab[2] - centers[c][2];
        var d = dL * dL + da * da + db * db;
        if (d < bd) { bd = d; best = c; }
      }
      out[p] = best;
    }

    return out;
  }
  /** 按分析时的白平衡系数还原一个像素颜色 */
  function wbRGB(rgb, gain) {
    if (!gain) return rgb;
    return [
      linToSrgb(clamp(srgbToLin(rgb[0]) * gain[0], 0, 1)),
      linToSrgb(clamp(srgbToLin(rgb[1]) * gain[1], 0, 1)),
      linToSrgb(clamp(srgbToLin(rgb[2]) * gain[2], 0, 1))
    ];
  }
  // ------------------------------------------------------------------
  // 分层反推：面漆盖在已知底漆上，反推最可能的漆和遮盖程度
  // ------------------------------------------------------------------
  var PRIMERS = [
    { id: 'white', name: '白底', hex: '#F3F3F0' },
    { id: 'lgray', name: '浅灰', hex: '#B8B8B6' },
    { id: 'black', name: '黑底', hex: '#232323' },
    { id: 'pink', name: '粉底', hex: '#F0C6C0' },
    { id: 'brown', name: '棕底', hex: '#8B4A3B' }
  ];

  var primerCache = {};
  var ksCache = {};

  function primerR(hex) {
    if (!primerCache[hex]) primerCache[hex] = new (lib().Color)(hex).R;
    return primerCache[hex];
  }

  function paintKs(hex) {
    if (!ksCache[hex]) ksCache[hex] = ksOf(new (lib().Color)(hex).R);
    return ksCache[hex];
  }

  /**
   * 单常数 K-M：厚度 X 的涂层盖在底色 Rg 上的反射率。
   * R = [1 − Rg(a − b·coth(bX))] / [a − Rg + b·coth(bX)]
   */
  function coatOver(ksCoat, Rg, X) {
    var out = new Array(ksCoat.length);
    for (var i = 0; i < ksCoat.length; i++) {
      var k = ksCoat[i];
      var a = 1 + k;
      var b = Math.sqrt(a * a - 1);
      var t = b * X;
      var coth = t > 20 ? 1 : (Math.exp(2 * t) + 1) / (Math.exp(2 * t) - 1);
      out[i] = clamp((1 - Rg[i] * (a - b * coth)) / (a - Rg[i] + b * coth), MIN_R, 1);
    }
    return out;
  }

  function coverageLabel(X) {
    if (X < 0.45) return '很薄，会透底';
    if (X < 1.1) return '薄喷';
    if (X < 2.4) return '正常覆盖';
    return '盖死';
  }

  /**
   * 反推：这个颜色像是什么漆、喷了几层、底下是什么底漆。
   *
   * @param {Object} opts { targetHex, primerHex, limit }
   * @return {{candidates: Array, primer: Object}}
   */
  function solveLayered(opts) {
    opts = opts || {};

    var targetLab = xyzToLab(new (lib().Color)(opts.targetHex).XYZ);
    var primerHex = opts.primerHex || PRIMERS[1].hex;
    var Rg = primerR(primerHex);

    // 先粗扫一遍厚度，挑出最像的几支，再仔细找厚度
    var COARSE = [0.15, 0.25, 0.4, 0.6, 0.9, 1.3, 2, 3, 4.5];
    var list = [];

    for (var i = 0; i < PIGMENTS.length; i++) {
      var p = PIGMENTS[i];
      var kc = paintKs(p.hex);
      var best = { de: Infinity, X: 0 };

      for (var g = 0; g < COARSE.length; g++) {
        var X = COARSE[g];
        var d = deltaE00(xyzToLab(new (lib().Color)(coatOver(kc, Rg, X)).XYZ), targetLab);
        if (d < best.de) { best.de = d; best.X = X; }
      }

      list.push({ pigment: p, de: best.de, X: best.X });
    }

    list.sort(function (a, b) { return a.de - b.de; });

    var top = list.slice(0, 6);

    // 精修厚度
    top.forEach(function (c) {
      var kc = paintKs(c.pigment.hex);
      var lo = Math.max(0.04, c.X * 0.45);
      var hi = c.X * 2.2;
      var steps = 24;

      for (var s = 1; s <= steps; s++) {
        var X = lo + ((hi - lo) * s) / steps;
        var d = deltaE00(xyzToLab(new (lib().Color)(coatOver(kc, Rg, X)).XYZ), targetLab);
        if (d < c.de) { c.de = d; c.X = X; }
      }

      // 漆膜一旦盖死，厚度就不可辨了——别硬报层数
      var massDe = deltaE00(xyzToLab(new (lib().Color)(c.pigment.hex).XYZ), targetLab);
      if (massDe < 0.6) {
        c.label = '已经盖死（层数分不出来）';
        c.opaque = true;
      } else {
        c.label = coverageLabel(c.X);
      }
    });

    top.sort(function (a, b) { return a.de - b.de; });

    var limit = opts.limit || 3;

    return {
      primer: PRIMERS.filter(function (x) { return x.hex === primerHex; })[0] || { name: '自定义', hex: primerHex },
      candidates: top.slice(0, limit).map(function (c) {
        return {
          pigment: c.pigment,
          deltaE: c.de,
          thickness: c.X,
          label: c.label
        };
      })
    };
  }

  // ------------------------------------------------------------------
  // 照片：光泽粗判
  // ------------------------------------------------------------------
  /**
   * 从像素里粗估漆面光泽。
   *
   * 思路：镜面高光 = 比周围明显亮、同时几乎没彩度的像素。
   * 量两个数：高光点占比、高光边缘的锐利程度。
   *
   * @param {Uint8ClampedArray} data RGBA
   * @return {{ratio:number, sharpness:number, level:string, hint:string}}
   */
  function analyzeGloss(data, width, height) {
    var n = width * height;
    var lum = new Float32Array(n);
    var sat = new Float32Array(n);

    for (var p = 0; p < n; p++) {
      var i = p * 4;
      var r = data[i], g = data[i + 1], b = data[i + 2];
      lum[p] = 0.299 * r + 0.587 * g + 0.114 * b;
      sat[p] = Math.max(r, g, b) - Math.min(r, g, b);
    }

    // 积分图，用来算局部均值
    var W = width + 1;
    var sum = new Float64Array(W * (height + 1));
    for (var y = 0; y < height; y++) {
      var row = 0;
      for (var x = 0; x < width; x++) {
        row += lum[y * width + x];
        sum[(y + 1) * W + (x + 1)] = sum[y * W + (x + 1)] + row;
      }
    }

    var rad = Math.max(4, Math.round(Math.min(width, height) / 36));

    function meanAt(x, y) {
      var x0 = Math.max(0, x - rad), x1 = Math.min(width, x + rad + 1);
      var y0 = Math.max(0, y - rad), y1 = Math.min(height, y + rad + 1);
      var s = sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0];
      return s / ((x1 - x0) * (y1 - y0));
    }

    var count = 0;
    var sharp = 0;
    var usable = 0;

    for (var py = 1; py < height - 1; py += 1) {
      for (var px = 1; px < width - 1; px += 1) {
        var idx = py * width + px;
        var L = lum[idx];

        // 梯度（只算亮度）
        var gx = Math.abs(lum[idx + 1] - lum[idx - 1]);
        var gy = Math.abs(lum[idx + width] - lum[idx - width]);
        var grad = gx + gy;

        usable++;

        if (L > 70 && sat[idx] < 26 && L - meanAt(px, py) > 10) {
          count++;
          sharp += grad;
        }
      }
    }

    var ratio = usable ? count / usable : 0;
    var sharpness = count ? sharp / count : 0;

    var level, hint;

    if (ratio < 0.004) {
      level = '消光 / 哑光';
      hint = '几乎看不到镜面高光，像是消光或半消光面。';
    } else if (ratio < 0.02 || sharpness < 26) {
      level = '半消光';
      hint = '有一点高光但边缘发糊，多半是半消光，也可能是光泽面被拍糊了。';
    } else {
      level = '光泽';
      hint = '高光清楚而锐利，像是光泽面。';
    }

    return {
      ratio: ratio,
      sharpness: sharpness,
      level: level,
      hint: hint + '（从照片粗判，受打光影响很大）'
    };
  }


  /**
   * 把精确配比取整成人能记住的份数（最大余额法）。
   * 10 份就是 2:8 / 3:7，20 份粒度更细，冲淡误差更小。
   */
  function snapRecipe(opts) {
    var denom = opts.denom || 10;
    var lines = opts.lines || [];

    var exact = lines.map(function (l) { return l.share * denom; });
    var counts = exact.map(function (v) { return Math.floor(v + 1e-9); });
    var used = counts.reduce(function (a, b) { return a + b; }, 0);

    var order = exact.map(function (v, i) { return { i: i, f: v - Math.floor(v + 1e-9) }; })
      .sort(function (a, b) { return b.f - a.f; });

    var need = denom - used;
    for (var k = 0; k < need && order.length; k++) counts[order[k % order.length].i]++;

    var comps = [];
    var weights = [];
    lines.forEach(function (l, i) {
      if (counts[i] > 0) {
        comps.push({ ks: paintKs(l.pigment.hex) });
        weights.push(counts[i]);
      }
    });

    if (!comps.length) return null;

    var m = measure(mixSpectrum(comps, weights));

    return {
      denom: denom,
      items: lines.map(function (l, i) {
        return { pigment: l.pigment, parts: counts[i] };
      }).filter(function (x) { return x.parts > 0; }),
      deltaE: deltaE00(m.lab, labOfHex(opts.targetHex)),
      hex: m.hex
    };
  }


  /**
   * 按固定步长（默认 5%）枚举最优配比。
   * 比“先算精确解再四舍五入”更准：取整后的最优点往往不在四舍五入的位置上。
   *
   * @param {Object} opts { targetHex, lines, step }
   */
  function quantizeRecipe(opts) {
    var step = opts.step || 0.05;
    var units = Math.round(1 / step);

    var lines = (opts.lines || []).slice(0, 4);
    if (!lines.length) return null;

    var targetLab = labOfHex(opts.targetHex);
    var comps = lines.map(function (l) { return { ks: paintKs(l.pigment.hex) }; });
    var k = comps.length;

    var w = new Array(k).fill(0);
    var best = { de: Infinity, w: null };

    function rec(i, remain) {
      if (i === k - 1) {
        w[i] = remain;
        if (w[0] === 0) return;

        var m = measure(mixSpectrum(comps, w));
        var d = deltaE00(m.lab, targetLab);
        if (d < best.de) { best.de = d; best.w = w.slice(); }
        return;
      }
      for (var c = 0; c <= remain; c++) {
        w[i] = c;
        rec(i + 1, remain - c);
      }
    }

    rec(0, units);

    if (!best.w) return null;

    var mf = measure(mixSpectrum(comps, best.w));

    return {
      step: step,
      items: lines.map(function (l, i) {
        return {
          pigment: l.pigment,
          percent: (best.w[i] / units) * 100,
          units: best.w[i]
        };
      }).filter(function (x) { return x.units > 0; }),
      deltaE: best.de,
      hex: mf.hex
    };
  }


  // 美术说的“调”：颜料没有纯色相，绿总是偏蓝或偏黄
  var TONE_FAMILIES = [
    { h: 20, name: '红' },
    { h: 50, name: '橙' },
    { h: 90, name: '黄' },
    { h: 145, name: '绿' },
    { h: 265, name: '蓝' },
    { h: 310, name: '紫' },
    { h: 345, name: '品红' }
  ];

  /** 例：偏蓝的绿 → “蓝调绿”；色相很正就给一个名字；彩度太低算中性 */
  function toneOf(lab) {
    var c = Math.hypot(lab[1], lab[2]);
    if (c < 12) return '中性';

    var h = hueAngle(lab);
    var bi = 0;
    var bd = Infinity;
    var bdiff = 0;

    for (var i = 0; i < TONE_FAMILIES.length; i++) {
      var d = ((h - TONE_FAMILIES[i].h + 540) % 360) - 180;
      if (Math.abs(d) < bd) { bd = Math.abs(d); bi = i; bdiff = d; }
    }

    var fam = TONE_FAMILIES[bi].name;
    if (bd <= 14) return fam;

    var ni = bdiff > 0 ? (bi + 1) % TONE_FAMILIES.length : (bi - 1 + TONE_FAMILIES.length) % TONE_FAMILIES.length;
    return TONE_FAMILIES[ni].name + '调' + fam;
  }

  /** 把色相角说成人话：绿、青、蓝紫…… */
  function hueDirName(h) {
    h = ((h % 360) + 360) % 360;
    if (h < 20 || h >= 340) return '红';
    if (h < 45) return '橙';
    if (h < 70) return '黄';
    if (h < 105) return '黄绿';
    if (h < 150) return '绿';
    if (h < 195) return '青';
    if (h < 250) return '蓝';
    if (h < 290) return '蓝紫';
    if (h < 320) return '紫';
    return '品红';
  }

  /** 一滴大约多少毫升 */
  var DROP_ML = TUNING.DROP_ML;

  /**
   * 主料按毫升、微调按滴的双层配方。
   *
   * 真实调法：100ml 里 20ml 红 + 80ml 蓝，再额外加 2 滴黑、2 滴绿。
   * 微量不是体积占比，是"另外滴几滴"，所以必须单独搜。
   *
   * 两段式：先只按主料找最像的几个组合，再对这几个组合分别试微量，
   * 否则「主料组合 × 微量组合」会爆掉。
   *
   * @param {Object} opts { targetHex, pigmentIds, volume, maxDrops }
   */
  function solveMixed(opts) {
    opts = opts || {};

    var volume = opts.volume || 100;
    var maxDrops = opts.maxDrops == null ? 12 : opts.maxDrops;
    var units = 20;   // 主料按 5% 步进

    var exact = solve({ targetHex: opts.targetHex, pigmentIds: opts.pigmentIds, total: 100, _noHint: true });
    if (!exact.ok) return { ok: false, error: exact.error };

    var sorted = exact.lines;

    // 第三支要够分量才算主料，否则只当前两支 + 微量候选
    var bulkCount = sorted.length >= 3 && sorted[2].share >= 0.03
      ? 3
      : Math.min(2, sorted.length);

    var bulkList = sorted.slice(0, bulkCount);
    var traceList = sorted.slice(bulkCount, bulkCount + 2);

    var comps = bulkList.concat(traceList).map(function (l) {
      return { ks: paintKs(l.pigment.hex) };
    });

    var targetLab = labOfHex(opts.targetHex);
    var w = new Array(comps.length).fill(0);

    function evaluate() {
      return deltaE00(measure(mixSpectrum(comps, w)).lab, targetLab);
    }

    // ---- 第一段：只排主料 ----
    var bulks = [];

    if (bulkCount === 1) {
      w[0] = volume;
      bulks.push({ de: evaluate(), w: w.slice() });
    } else if (bulkCount === 2) {
      for (var a = 1; a < units; a++) {
        w[0] = (a / units) * volume;
        w[1] = ((units - a) / units) * volume;
        bulks.push({ de: evaluate(), w: w.slice() });
      }
    } else {
      for (var x1 = 1; x1 < units - 1; x1++) {
        for (var x2 = 1; x1 + x2 < units; x2++) {
          w[0] = (x1 / units) * volume;
          w[1] = (x2 / units) * volume;
          w[2] = ((units - x1 - x2) / units) * volume;
          bulks.push({ de: evaluate(), w: w.slice() });
        }
      }
    }

    bulks.sort(function (p, q) { return p.de - q.de; });

    // ---- 第二段：对最好的几个主料组合试微量 ----
    var best = { de: Infinity, w: null };

    function recTrace(i) {
      if (i === traceList.length) {
        var d = evaluate();
        if (d < best.de) { best.de = d; best.w = w.slice(); }
        return;
      }
      for (var k = 0; k <= maxDrops; k++) {
        w[bulkCount + i] = k * DROP_ML;
        recTrace(i + 1);
      }
    }

    var pool = bulks.slice(0, traceList.length ? 6 : 1);

    pool.forEach(function (b) {
      for (var i = 0; i < b.w.length; i++) w[i] = b.w[i];
      if (traceList.length) {
        recTrace(0);
      } else if (b.de < best.de) {
        best.de = b.de;
        best.w = b.w.slice();
      }
    });

    // ---- 第三段：主料之外，允许再引入一支"点缀" ----
    // 例：偏青的白 = 白 100% + 一两滴蓝。以前的候选只来自精确解的前几名，
    // 蓝这种"不加到主料、但能改色相"的漆永远进不来。
    (function () {
      var used = {};
      bulkList.concat(traceList).forEach(function (l) { used[l.pigment.code] = true; });

      var cands = [];
      (opts.pigmentIds || []).forEach(function (id) {
        if (used[id]) return;
        var pig = null;
        for (var i = 0; i < PIGMENTS.length; i++) if (PIGMENTS[i].code === id) pig = PIGMENTS[i];
        if (pig && pig.kind !== 'additive') cands.push(pig);
      });
      cands = cands.slice(0, 6);

      var bestExtra = null;

      cands.forEach(function (pig) {
        var ksE = paintKs(pig.hex);
        var comps2 = comps.concat([{ ks: ksE }]);

        for (var k = 1; k <= maxDrops; k++) {
          var w2 = best.w.concat([k * DROP_ML]);
          var de = deltaE00(measure(mixSpectrum(comps2, w2)).lab, targetLab);
          if (bestExtra === null || de < bestExtra.de) {
            bestExtra = { de: de, w: w2, comps: comps2, pig: pig, drops: k };
          }
        }
      });

      if (bestExtra && bestExtra.de < best.de - 0.05) {
        best.de = bestExtra.de;
        best.w = bestExtra.w;
        comps = bestExtra.comps;
        traceList = traceList.concat([{ pigment: bestExtra.pig }]);
      }
    })();

    if (!best.w) return { ok: false, error: '没有可用配方' };

    var items = [];
    var totalMl = 0;

    bulkList.forEach(function (l, i) {
      var ml = best.w[i];
      if (ml <= 0) return;
      totalMl += ml;
      items.push({ pigment: l.pigment, kind: 'bulk', ml: ml, drops: 0, ci: i });
    });

    traceList.forEach(function (l, i) {
      var drops = Math.round(best.w[bulkCount + i] / DROP_ML);
      if (drops <= 0) return;
      var ml = drops * DROP_ML;
      totalMl += ml;
      items.push({ pigment: l.pigment, kind: 'trace', ml: ml, drops: drops, ci: bulkCount + i });
    });

    items.forEach(function (it) {
      it.percent = totalMl > 0 ? (it.ml / totalMl) * 100 : 0;
    });

    var fin = measure(mixSpectrum(comps, best.w));
    var labAll = fin.lab;
    var hAll = hueAngle(labAll);

    // 每支漆自己的调：加它就是把整体往这个方向带
    items.forEach(function (it) {
      var lb = pigLab(it.pigment);
      it.chroma = Math.hypot(lb[1], lb[2]);
      it.tone = toneOf(lb);
    });

    // 只算主料时色相差多少，这个差就是靠微调补的
    var wBulk = best.w.slice();
    items.forEach(function (it) {
      if (it.kind === 'trace') wBulk[it.ci] = 0;
    });
    var labBulk = measure(mixSpectrum(comps, wBulk)).lab;
    var hTarget = hueAngle(targetLab);
    var hueGap = ((hTarget - hueAngle(labBulk) + 540) % 360) - 180;

    return {
      ok: true,
      target: { hex: opts.targetHex, lab: targetLab },
      predicted: { hex: fin.hex, inGamut: fin.inGamut },
      deltaE: best.de,
      exactDeltaE: exact.deltaE,
      items: items,
      volume: volume,
      totalMl: totalMl,
      dropMl: DROP_ML,
      hueBulk: hueAngle(labBulk),
      hueTarget: hTarget,
      hueGap: hueGap,
      hueBulkName: hueDirName(hueAngle(labBulk)),
      hueTargetName: hueDirName(hTarget)
    };
  }


  // ------------------------------------------------------------------
  // 工序模板：伪电镀、糖果色、金属色
  // ------------------------------------------------------------------
  var CLEAR_HINTS = {
    C46: "通用光泽保护层",
    C47: "尾灯、眼睛、伪电镀罩色",
    C48: "车灯、金色调",
    C49: "转向灯、复古暖调",
    C50: "玻璃、冷色调",
    C138: "绿灯、仪表、科幻件",
    C155: "高光面罩光",
    C181: "半光罩光，接近真车质感",
    C182: "消光罩光，军模常用",
    C183: "透明灰调，压亮不压色"
  };

  var PROCESSES = [
    {
      id: "chrome",
      name: "伪电镀",
      meta: { dry: "每层 10–15 分钟，全干 24 小时", level: 3 },
      desc: "黑底 → 银 → 透明色。看起来像电镀，其实是三层漆。",
      tip: "关键不是配比，是每层都要干透：黑底没干透、银层没干透就罩透明色，必花。",
      steps: function (o) {
        return [
          { code: "C2", role: "底漆", qty: "2–3 层", note: "光泽黑，喷到完全盖住、表面发亮为止" },
          { code: o.metal, role: "金属层", qty: "2 薄层", note: "薄喷、间隔 10 分钟，厚喷会发暗发灰" },
          { code: o.clear, role: "透明色", qty: "1–2 层", note: "第一层雾喷，第二层湿喷；深浅靠层数控制" }
        ];
      }
    },
    {
      id: "candy",
      name: "糖果色",
      meta: { dry: "每层 10–15 分钟，全干 24 小时", level: 3 },
      desc: "银色打底 + 透明色罩面，越透越亮。",
      tip: "糖果色不靠调色，靠底层有多亮。银层越亮、透明层越薄，颜色越透。",
      steps: function (o) {
        return [
          { code: "C2", role: "底漆", qty: "1–2 层", note: "深色底能让银色更亮；浅色件可省" },
          { code: o.metal, role: "银色底", qty: "2–3 层", note: "要均匀发亮，这是糖果色的命根子" },
          { code: o.clear, role: "透明色", qty: "1–3 层", note: "薄薄一层层加，深了就只能重来" }
        ];
      }
    },
    {
      id: "pearl",
      name: "珠光色",
      meta: { dry: "珠光层间隔 20 分钟，全干 24 小时", level: 2 },
      desc: "同色系底色 + 珠光层 + 罩光。珠光的亮是靠底下那层撑起来的。",
      tip: "珠光最怕底色不对：底色调太深，珍珠会发脏；太浅又看不出效果。先在小板上试。珠光层要「湿一点、薄一点」，喷太干片状粉立不起来，会发灰。",
      steps: function (o) {
        return [
          { code: "C1", role: "底色", qty: "2 层", note: "想要什么色就用什么色的实色打底，珠光会把它透出来" },
          { code: "C151", role: "珠光层", qty: "2–3 薄层", note: "珍珠白盖在底色上，每层薄薄的湿喷，方向一致" },
          { code: "C46", role: "罩光", qty: "2 层", note: "把珠光封在下面；要哑光就把 C46 换成 C30 消光" }
        ];
      }
    },
    {
      id: "solid",
      name: "实色漆",
      meta: { dry: "每层 10–15 分钟，全干 24 小时", level: 1 },
      desc: "补土 → 底漆 → 实色薄层。看着最简单，翻车最多。",
      tip: "实色漆最容易犯的错是「想一层盖住」。薄喷三层永远比厚喷一层好：厚喷会流挂、会盖掉细节、干燥还慢。",
      steps: function (o) {
        return [
          { code: "C1", role: "底漆", qty: "1–2 层", note: "白底提亮、灰底压暗；也可以直接上补土后喷" },
          { code: "C4", role: "实色", qty: "2–3 薄层", note: "这里只是示例色，换成你要做的颜色；每层薄到能看见底色" },
          { code: "C46", role: "罩光", qty: "1–2 层", note: "光泽面用 C46，想要哑光就换 C30 消光" }
        ];
      }
    },
    {
      id: "metal",
      name: "金属色",
      meta: { dry: "每层 10 分钟，全干 12 小时", level: 1 },
      desc: "底漆决定明度，金属色薄喷出颗粒感。",
      tip: "金属颗粒会沉底，摇匀再喷；湿喷容易花，薄喷多道才匀。",
      steps: function (o) {
        return [
          { code: "C2", role: "底漆", qty: "1–2 层", note: "黑底出深金属，灰底出浅金属" },
          { code: o.metal, role: "金属色", qty: "2–3 薄层", note: "别一次喷厚，颗粒会流动结块" }
        ];
      }
    }
  ];


  /** 每一层的专属小知识 */
  var STEP_KNOW = {
    chrome: [
      "黑底要喷到发亮才算数——哑光黑吸光，上面的银会发灰。",
      "银层是命根子：摸上去不粘手才能罩透明色，否则必花。",
      "第一道雾喷把银层封住，第二道才湿喷；一次喷厚会咬底。"
    ],
    candy: [
      "深色底让银更亮；浅色件跳过这步也成立。",
      "银要喷到完全均匀发亮，糖果色的通透度全靠它。",
      "一层层加，每层干透再看颜色；深了只能洗掉重来。"
    ],
    pearl: [
      "底色就是珠光的色相来源：蓝底出蓝珍珠，白底出象牙。",
      "薄而湿是关键——太干片状粉立不起来会发灰，太湿会流挂。",
      "光油把珠光封住；别直接上消光，会吃掉闪烁感。"
    ],
    solid: [
      "白底提亮、灰底压暗；补土打磨到看不见划痕再喷。",
      "每层薄到能看见底色，三层下来自然就盖住了。",
      "罩光前摸一下，完全不粘手才上。"
    ],
    metal: [
      "黑底出深金属、灰底出浅金属，选错底整支漆都偏。",
      "用前摇一分钟；湿喷颗粒会流动结块，只能薄薄叠。"
    ]
  };

  /** 喷涂知识库：按类分组，一条一个坑 */
  var SPRAY_KB = [
    {
      id: "gear",
      name: "器材",
      items: [
        { q: "喷笔口径怎么选", a: "0.2 细节、0.3 通用、0.4–0.5 补土和大面积。新手先买 0.3，一支能用很久。" },
        { q: "气压设多少", a: "1.5–2 bar（约 20–30 psi）。太高漆雾飞散、漆面干粉；太低出漆成滴。" },
        { q: "空压机要带储气罐", a: "不带罐的气压是脉动的，喷出来一道一道。带罐 + 稳压阀是最低要求。" },
        { q: "水隔必须有", a: "压缩空气会带水，喷到漆面上就是白点、鱼眼。几十块的水隔能省掉一半翻车。" },
        { q: "喷笔别买最便宜的", a: "雾化差、清洗难、喷嘴容易堵。入门一支 0.3mm 的够用，别一次买三支。" }
      ]
    },
    {
      id: "thin",
      name: "稀释",
      items: [
        { q: "硝基漆比例", a: "大约 1 : 1.5～2（漆 : 专用稀释剂）。太稠拉丝、橘皮；太稀盖不住、流挂。" },
        { q: "稀释剂要用同系", a: "郡士硝基用郡士稀释剂，田宫珐琅用 X-20。混用会絮凝、堵笔。" },
        { q: "少量多次稀释", a: "先加一倍，试喷一道，不够再补。一次倒多了只能再加漆，越调越多。" },
        { q: "水性漆稀释", a: "用专用稀释剂或蒸馏水，约 1:1。别用自来水，矿物质会让漆面发花。" },
        { q: "稀释后别久放", a: "溶剂会挥发，比例就变了。最好当次用完，剩下的密封冷藏也别超过一周。" }
      ]
    },
    {
      id: "tech",
      name: "手法",
      items: [
        { q: "距离 15–20 厘米", a: "近了流挂，远了干喷起粉。用前先在废件上试一道找手感。" },
        { q: "薄喷多层", a: "每层薄到能看见底色。厚喷一层会流挂、盖掉细节、干得还慢。" },
        { q: "走枪匀速、别停", a: "在一点上停住必流挂。宁可快速扫过、多扫几遍。" },
        { q: "先边角后大面", a: "边角喷不到位，最后整体补一层就匀了。反过来大面喷完再补边角会花。" },
        { q: "十字交叉", a: "第二层和第一层走枪方向垂直，覆盖更均匀，不容易漏喷。" },
        { q: "别用手摸", a: "指腹有油，摸过的地方上不了漆，会出现缩孔。" },
        { q: "遮盖先浅后深", a: "浅色盖不住深色。顺序反了，一撕胶带就露底。" }
      ]
    },
    {
      id: "env",
      name: "环境",
      items: [
        { q: "温度 20–25℃ 最稳", a: "低于 15℃ 干得慢、容易白化；高于 30℃ 干太快，起橘皮。" },
        { q: "湿度超过 75% 别喷光泽和透明", a: "水汽会被封进漆膜，干了发白（blushing）。必须喷就加缓干剂、开除湿。" },
        { q: "必须通风、戴口罩", a: "硝基漆有毒性，别在卧室喷。开窗 + 抽风 + 防毒口罩是底线。" },
        { q: "喷前在地上洒点水", a: "压住浮尘，减少漆面颗粒。这条几乎零成本。" },
        { q: "别在阳光直射下喷", a: "表面干太快，底下还没干，必起橘皮。" }
      ]
    },
    {
      id: "fail",
      name: "翻车急救",
      items: [
        { q: "橘皮（表面像橘子皮）", a: "漆太稠、枪太远或气压不足。先稀释 + 拉近 + 加气压；已经干了只能打磨重喷。" },
        { q: "流挂（漆往下淌）", a: "一次喷太厚或者停枪。等彻底干透，打磨掉，再薄薄补。" },
        { q: "白化（发白雾）", a: "湿度太高、稀释剂挥发太快。加缓干剂、除湿、薄喷；已经白了打磨掉重来。" },
        { q: "鱼眼 / 缩孔（小坑）", a: "表面有油或水。洗件、加水隔、别用手摸。" },
        { q: "堵笔", a: "漆太稠或没洗。拆下喷嘴泡稀释剂，别用针去捅（会扩孔）。" },
        { q: "干喷（表面粉末感）", a: "距离太远、气压太大，漆在半空就干了。拉近、降气压、加稀释。" },
        { q: "遮盖渗漆", a: "胶带没压实或边缘翘。先喷一层薄薄的封边，再正常喷。" },
        { q: "漆面有颗粒", a: "灰尘、漆没过滤、或者干喷落下。用滤网过滤漆，喷前洒水降尘。" }
      ]
    },
    {
      id: "care",
      name: "保养",
      items: [
        { q: "每次喷完立刻洗", a: "稀释剂过一遍，再拆针和喷嘴。干了的漆会把喷嘴糊死。" },
        { q: "别用针捅喷嘴", a: "会扩孔，雾化变差。堵了就泡，泡不开再拆。" },
        { q: "长期不用上专用油", a: "针和扳机缝上一滴专用润滑油，别用机油，会腐蚀胶圈。" },
        { q: "胶圈别泡溶剂太久", a: "会老化发胀，漏漆漏气。泡几分钟就拿出来擦干。" }
      ]
    }
  ];


  /** 喷涂小知识，和模板无关的通用经验 */
  var PROCESS_TIPS = [
    "薄喷三层永远好过厚喷一层：每层薄到能看见底色，间隔 10–15 分钟。",
    "距离 15–20 厘米，匀速走枪，别在一点上停——停下就流挂。",
    "先喷边角、再喷大面；边角喷不到位，最后补一层整体就匀了。",
    "温度低于 15℃ 或湿度高于 75% 别喷光泽和透明，容易发白、干不透。",
    "金属漆、珠光漆会沉底，用前摇一分钟以上，不然喷出来发花。",
    "遮盖用胶带先在手背上粘一下再贴，粘性太强会把底漆一起撕下来。",
    "喷完立刻洗笔，干了的漆会堵喷嘴，下次就废了。",
    "别用热风近距离吹干，容易起橘皮；自然干或者远距离暖风。",
    "表面有橘皮多半是漆太稠或者枪太远；有灰尘就喷前在地上洒点水。",
    "硝基漆稀释比例大约 1 : 1.5～2（漆 : 专用稀释剂），太稠会拉丝、橘皮。",
    "喷笔口径：0.3 毫米通用；补土、金属颗粒用 0.4–0.5 毫米更不容易堵。",
    "气压 1.5–2 bar（约 20–30 psi）；气压太大漆雾飞散，太小出漆成滴。",
    "每层之间别用手摸，指腹有油，摸了那块就上不了漆。",
    "遮盖顺序先浅后深：浅色盖不住深色，反过来一撕就露底。",
    "开喷前先在流道或废件上试一道，确认出漆、雾化、颜色都对。",
    "硝基漆有毒性，必须通风，戴口罩；别在卧室喷。",
    "稀释好的漆别放太久，溶剂挥发后比例就变了，最好当次用完。",
    "出漆断断续续先查两件事：喷嘴堵了，或者漆太稠。"
  ];

  /**
   * 按模板生成工序清单。
   * @param {string} id chrome | candy | metal
   * @param {Object} opts { metal, clear }
   */
  function buildProcess(id, opts) {
    opts = opts || {};
    var proc = PROCESSES.filter(function (x) { return x.id === id; })[0];
    if (!proc) return null;

    var byCode = {};
    PIGMENTS.forEach(function (p) { byCode[p.code] = p; });

    var metal = byCode[opts.metal || "C8"] || byCode["C8"];
    var clear = byCode[opts.clear || "C47"] || byCode["C47"];

    var overrides = opts.overrides || {};
    var knows = STEP_KNOW[proc.id] || [];

    var steps = proc.steps({ metal: metal.code, clear: clear.code }).map(function (st, i) {
      var code = overrides[i] && byCode[overrides[i]] ? overrides[i] : st.code;
      var pig = byCode[code];

      return {
        code: code,
        role: st.role,
        qty: st.qty,
        note: st.note,
        know: knows[i] || "",
        pigment: pig || null,
        name: pig ? pig.name : code,
        hex: pig ? pig.hex : null
      };
    });

    return {
      id: proc.id,
      name: proc.name,
      meta: proc.meta || null,
      desc: proc.desc,
      tip: proc.tip,
      clearHint: clear.kind === "clear" ? (CLEAR_HINTS[clear.code] || "") : "",
      steps: steps
    };
  }


  /**
   * 3×3 多数表决，去掉分区图上的椒盐噪点。
   * @param {Uint8Array} labels
   */
  function smoothLabels(labels, width, height) {
    var out = new Uint8Array(labels.length);
    var counts = {};

    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var i = y * width + x;

        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          out[i] = labels[i];
          continue;
        }

        counts = {};
        var best = labels[i];
        var bestN = 0;

        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var v = labels[(y + dy) * width + (x + dx)];
            counts[v] = (counts[v] || 0) + 1;
            if (counts[v] > bestN) { bestN = counts[v]; best = v; }
          }
        }

        out[i] = bestN >= 5 ? best : labels[i];
      }
    }

    return out;
  }


  /**
   * 灰世界/灰色阴影法（Shades-of-Gray, Finlayson & Trezzi 2004）估光源。
   * p 越大越偏向“最亮的那个面”，p=1 是经典灰世界，p=6 对模型照片通常更稳。
   *
   * @param {number[][]} samples
   * @param {number} p
   * @return {number[]} 三个通道的增益
   */
  function shadesOfGray(samples, p) {
    p = p || 6;
    if (!samples || !samples.length) return [1, 1, 1];

    var sum = [0, 0, 0];

    for (var i = 0; i < samples.length; i++) {
      var s0 = samples[i];
      for (var c = 0; c < 3; c++) {
        sum[c] += Math.pow(Math.max(srgbToLin(s0[c]), 1e-6), p);
      }
    }

    var e = [0, 0, 0];
    for (var k = 0; k < 3; k++) e[k] = Math.pow(sum[k] / samples.length, 1 / p);
    if (!e[0] || !e[1] || !e[2]) return [1, 1, 1];

    var m = (e[0] + e[1] + e[2]) / 3;
    return [m / e[0], m / e[1], m / e[2]];
  }

  /** 用一个白/灰参考点算增益 */
  function wbGain(rgb) {
    var r = srgbToLin(rgb[0]);
    var g = srgbToLin(rgb[1]);
    var b = srgbToLin(rgb[2]);
    if (r < 0.01 || g < 0.01 || b < 0.01) return null;
    var m = (r + g + b) / 3;
    return [m / r, m / g, m / b];
  }

  /** Lab 直接转 sRGB，用于残差聚类的代表色 */
  function labToSrgb(lab) {
    var fy = (lab[0] + 16) / 116;
    var fx = fy + lab[1] / 500;
    var fz = fy - lab[2] / 200;

    function inv(t) { return t * t * t > 0.008856 ? t * t * t : (116 * t - 16) / 903.3; }

    var X = inv(fx) * 0.95047;
    var Y = inv(fy);
    var Z = inv(fz) * 1.08883;

    var r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
    var g = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
    var b = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;

    return [linToSrgb(clamp(r, 0, 1)), linToSrgb(clamp(g, 0, 1)), linToSrgb(clamp(b, 0, 1))];
  }


  /**
   * 统计一块像素的颜色属性（区域生长和框选共用）。
   *
   * @param {Uint8ClampedArray} data RGBA
   * @param {number[]} indices 像素序号
   * @param {number} total 全图像素数（算占比）
   */
  function statsOf(data, width, height, indices, total) {
    if (!indices.length) return null;

    var labs = new Float32Array(indices.length * 3);
    var i, k;

    for (i = 0; i < indices.length; i++) {
      k = indices[i] * 4;
      var lin0 = [srgbToLin(data[k]), srgbToLin(data[k + 1]), srgbToLin(data[k + 2])];
      var lab0 = linToLab(lin0);
      labs[i * 3] = lab0[0];
      labs[i * 3 + 1] = lab0[1];
      labs[i * 3 + 2] = lab0[2];
    }

    // 按明度排序，取受光面
    var order = indices.map(function (_, j) { return j; })
      .sort(function (a, b) { return labs[a * 3] - labs[b * 3]; });

    var p92 = order[Math.min(order.length - 1, Math.floor(order.length * 0.92))];
    var keep = order.filter(function (j) { return Math.abs(labs[j * 3] - labs[p92 * 3]) <= 6; });
    if (!keep.length) keep = order;

    var lin = [0, 0, 0];
    keep.forEach(function (j) {
      var kk = indices[j] * 4;
      lin[0] += srgbToLin(data[kk]);
      lin[1] += srgbToLin(data[kk + 1]);
      lin[2] += srgbToLin(data[kk + 2]);
    });
    lin = [lin[0] / keep.length, lin[1] / keep.length, lin[2] / keep.length];

    // 明暗跨度与色相变化
    var k30 = Math.max(1, Math.floor(order.length * 0.3));

    function meanLabOf(list) {
      var acc = [0, 0, 0];
      list.forEach(function (j) {
        acc[0] += labs[j * 3];
        acc[1] += labs[j * 3 + 1];
        acc[2] += labs[j * 3 + 2];
      });
      return [acc[0] / list.length, acc[1] / list.length, acc[2] / list.length];
    }

    var lo = meanLabOf(order.slice(0, k30));
    var hi = meanLabOf(order.slice(-k30));

    var hueDiff = Math.abs(hueAngle(hi) - hueAngle(lo));
    if (hueDiff > 180) hueDiff = 360 - hueDiff;

    var cLo = Math.hypot(lo[1], lo[2]);
    var cHi = Math.hypot(hi[1], hi[2]);
    var cRatio = cLo > 1 ? cHi / cLo : 1;

    // 颗粒感：相邻像素的平均亮度差，金属漆通常更“糙”
    var grainSum = 0;
    var grainN = 0;
    var maskSet = {};
    indices.forEach(function (p) { maskSet[p] = 1; });

    for (i = 0; i < indices.length; i++) {
      var p2 = indices[i];
      var px2 = p2 % width;
      var py2 = (p2 - px2) / width;

      if (px2 < width - 1 && maskSet[p2 + 1]) {
        var a2 = (indices[i] * 4), b2 = ((p2 + 1) * 4);
        grainSum += Math.abs(
          (data[a2] * 0.299 + data[a2 + 1] * 0.587 + data[a2 + 2] * 0.114) -
          (data[b2] * 0.299 + data[b2 + 1] * 0.587 + data[b2 + 2] * 0.114)
        );
        grainN++;
      }
    }
    var grain = grainN ? grainSum / grainN : 0;

    var chroma = Math.hypot(hi[1], hi[2]);
    var sheen = '实色';

    if (chroma >= 12) {
      if (hueDiff > 14 || cRatio > 1.7) sheen = '随角异色';
      else if (hueDiff > 6 || cRatio > 1.3) sheen = '可能金属';
    } else {
      // 中性色（银、枪铁、黑）：色相不会变，靠“颗粒感 + 明度分布”判断。
      // 用 10~90 分位而不是最大最小值，避免被高光和黑边带偏。
      var lo10 = labs[order[Math.floor(order.length * 0.1)] * 3];
      var hi90 = labs[order[Math.min(order.length - 1, Math.floor(order.length * 0.9))] * 3];
      var spread = hi90 - lo10;

      if (grain > 13 && spread > 12 && spread < 55) {
        sheen = '可能金属（中性色）';
      }
    }

    var mask = new Uint8Array(width * height);
    indices.forEach(function (p) { mask[p] = 1; });

    return {
      mask: mask,
      count: indices.length,
      share: indices.length / total,
      hex: rgbToHex(linToSrgb(lin[0]), linToSrgb(lin[1]), linToSrgb(lin[2])),
      lab: linToLab(lin),
      lMin: Math.round(labs[order[0] * 3]),
      lMax: Math.round(labs[order[order.length - 1] * 3]),
      dHue: hueDiff,
      cRatio: cRatio,
      grain: grain,
      sheen: sheen
    };
  }

  /**
   * 从种子点长出一块相连的同色区域。
   *
   * 相邻像素允许小步差（应付渐变），但整体不能离种子太远（防止漏到背景）。
   *
   * @param {Uint8ClampedArray} data RGBA
   * @param {number} sx 种子 x
   * @param {number} sy 种子 y
   * @param {Object} opts { stepTol, seedTol, maxShare }
   */
  function growRegion(data, width, height, sx, sy, opts) {
    opts = opts || {};
    var stepTol = opts.stepTol || 8;
    var seedTol = opts.seedTol || 32;
    var maxPixels = Math.floor(width * height * (opts.maxShare || 0.5));

    var n = width * height;
    var labs = new Float32Array(n * 3);

    for (var i = 0; i < n; i++) {
      var k = i * 4;
      var lab = linToLab([srgbToLin(data[k]), srgbToLin(data[k + 1]), srgbToLin(data[k + 2])]);
      labs[i * 3] = lab[0];
      labs[i * 3 + 1] = lab[1];
      labs[i * 3 + 2] = lab[2];
    }

    var seedIdx = sy * width + sx;
    var seedL = labs[seedIdx * 3];
    var seedA = labs[seedIdx * 3 + 1];
    var seedB = labs[seedIdx * 3 + 2];

    var visited = new Uint8Array(n);
    var stack = [seedIdx];
    var region = [];

    while (stack.length && region.length < maxPixels) {
      var p = stack.pop();
      if (visited[p]) continue;
      visited[p] = 1;

      var dSeed = Math.sqrt(
        Math.pow(labs[p * 3] - seedL, 2) +
        Math.pow(labs[p * 3 + 1] - seedA, 2) +
        Math.pow(labs[p * 3 + 2] - seedB, 2)
      );
      if (dSeed > seedTol) continue;

      region.push(p);

      var px = p % width;
      var py = (p - px) / width;

      var neigh = [];
      if (px > 0) neigh.push(p - 1);
      if (px < width - 1) neigh.push(p + 1);
      if (py > 0) neigh.push(p - width);
      if (py < height - 1) neigh.push(p + width);

      for (var q = 0; q < neigh.length; q++) {
        var nb = neigh[q];
        if (visited[nb]) continue;

        var dNb = Math.sqrt(
          Math.pow(labs[nb * 3] - labs[p * 3], 2) +
          Math.pow(labs[nb * 3 + 1] - labs[p * 3 + 1], 2) +
          Math.pow(labs[nb * 3 + 2] - labs[p * 3 + 2], 2)
        );
        if (dNb <= stepTol) stack.push(nb);
      }
    }

    // 纹理太碎或者面积太小，退化成“种子周围一小块”
    if (region.length < 8) {
      region = [];
      for (var wy = Math.max(0, sy - 6); wy <= Math.min(height - 1, sy + 6); wy++) {
        for (var wx = Math.max(0, sx - 6); wx <= Math.min(width - 1, sx + 6); wx++) {
          var wi = wy * width + wx;
          var dW = Math.sqrt(
            Math.pow(labs[wi * 3] - seedL, 2) +
            Math.pow(labs[wi * 3 + 1] - seedA, 2) +
            Math.pow(labs[wi * 3 + 2] - seedB, 2)
          );
          if (dW <= seedTol) region.push(wi);
        }
      }
    }

    if (!region.length) return null;
    return statsOf(data, width, height, region, n);
  }

  /**
   * 框选一块矩形区域直接分析（不要求连通）。
   */
  function rectRegion(data, width, height, x0, y0, x1, y1) {
    var left = Math.max(0, Math.min(x0, x1));
    var right = Math.min(width - 1, Math.max(x0, x1));
    var top = Math.max(0, Math.min(y0, y1));
    var bottom = Math.min(height - 1, Math.max(y0, y1));

    var idx = [];
    for (var y = top; y <= bottom; y++) {
      for (var x = left; x <= right; x++) idx.push(y * width + x);
    }

    if (idx.length < 4) return null;
    return statsOf(data, width, height, idx, width * height);
  }

  /** 在郡士色库里找最接近的一支 */
  function nearestPaint(hex, kind) {
    var lab = labOfHex(hex);
    var best = null;

    for (var i = 0; i < PIGMENTS.length; i++) {
      var p = PIGMENTS[i];
      if (kind && p.kind !== kind) continue;

      var d = deltaE00(lab, pigLab(p));
      if (!best || d < best.deltaE) best = { pigment: p, deltaE: d };
    }

    return best;
  }


  function judgeMetallic(hlRGB, midRGB) {
    var hlLin = [srgbToLin(hlRGB[0]), srgbToLin(hlRGB[1]), srgbToLin(hlRGB[2])];
    var midLin = [srgbToLin(midRGB[0]), srgbToLin(midRGB[1]), srgbToLin(midRGB[2])];
    var hl = linToLab(hlLin);
    var mid = linToLab(midLin);

    if (mid[0] > hl[0]) {
      var tl = hl; hl = mid; mid = tl;
      var tl2 = hlLin; hlLin = midLin; midLin = tl2;
    }

    var dL = hl[0] - mid[0];
    var cHl = Math.hypot(hl[1], hl[2]);
    var cMid = Math.hypot(mid[1], mid[2]);
    var satRatio = cMid > 1 ? cHl / cMid : 1;

    var dHue = Math.abs(hueAngle(hl) - hueAngle(mid));
    if (dHue > 180) dHue = 360 - dHue;
    if (cHl < 8 || cMid < 8) dHue = 0;

    var verdict;
    var kind;

    if (dL < 15) {
      verdict = '没有明显高光，多半是消光/半光';
      kind = 'solid';
    } else if (satRatio >= 0.72) {
      verdict = '金属：高光又亮又不偏色';
      kind = 'metal';
    } else {
      verdict = '光泽实色：高光发白';
      kind = 'solid';
    }

    return {
      dL: dL,
      satRatio: satRatio,
      dHue: dHue,
      verdict: verdict,
      kind: kind,
      hlHex: rgbToHex(linToSrgb(hlLin[0]), linToSrgb(hlLin[1]), linToSrgb(hlLin[2])),
      midHex: rgbToHex(linToSrgb(midLin[0]), linToSrgb(midLin[1]), linToSrgb(midLin[2])),
      midLab: linToLab(midLin)
    };
  }

  /** 找最接近的几支漆，可按漆种过滤 */
  function nearestPaints(hex, kind, n) {
    var lab = labOfHex(hex);
    var list = [];

    for (var i = 0; i < PIGMENTS.length; i++) {
      var p = PIGMENTS[i];
      if (kind && p.kind !== kind) continue;
      list.push({ pigment: p, deltaE: deltaE00(lab, pigLab(p)) });
    }

    list.sort(function (a, b) { return a.deltaE - b.deltaE; });
    return list.slice(0, n || 3);
  }


  /**
   * 从一个底色推出高光色和阴影色（含冷暖两版）。
   *
   * 冷暖的差别是**色相**，不是明度：把色相往"冷极"（青蓝 200°/270°）
   * 或"暖极"（红橙 10°/40°）转一段，冷阴影与暖阴影相差 60° 以上。
   */
  // ---------------------------------------------------------------
  // 真实光照：同一块漆，被不同光谱的光照亮，出来是不同的颜色
  // ---------------------------------------------------------------

  // CIE D65 相对光谱功率，380–750nm，步长 10nm（38 个点，与 spectral.js 对齐）
  var D65_SPD = [
    49.98, 54.65, 82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86,
    115.92, 108.81, 109.35, 108.21, 104.79, 107.69, 104.41, 104.05, 100.00, 96.33,
    95.79, 88.69, 90.01, 89.60, 87.70, 83.29, 83.70, 80.03, 80.21, 82.28,
    78.28, 69.72, 71.61, 74.35, 61.60, 69.89, 72.46, 67.31
  ];

  /**
   * 黑体光谱（普朗克定律），按 560nm 归一到 100，和 D65 同一尺度。
   * @param {number} kelvin 色温
   * @returns {number[]} 38 个波段的相对功率
   */
  function planckSPD(kelvin) {
    var c2 = 1.4388e7;   // nm·K
    var out = new Array(38);
    var refIdx = 18;     // 560nm
    var ref = 0;

    for (var i = 0; i < 38; i++) {
      var nm = 380 + i * 10;
      var l5 = Math.pow(nm / 1000, 5);
      out[i] = 1 / (l5 * (Math.exp(c2 / (nm * kelvin)) - 1));
      if (i === refIdx) ref = out[i];
    }
    for (var j = 0; j < 38; j++) out[j] = out[j] / ref * 100;
    return out;
  }

  /**
   * 把漆的反射率放到某个光源下。
   *
   * measure() 内部用的是 D65 加权，所以这里乘上「新光源 / D65」的比值，
   * 等式就变成 ∫ R·S·CMF，也就是这块漆在 S 下的真实颜色。
   */
  function litReflectance(R, spd, gain) {
    var out = new Array(R.length);
    for (var i = 0; i < R.length; i++) {
      var v = R[i] * (spd[i] / D65_SPD[i]) * gain;
      out[i] = v > 0.999 ? 0.999 : (v < 0 ? 0 : v);
    }
    return out;
  }

  /** 反射率为 1 的白色在该光源下的 XYZ（用来做色适应） */
  function whiteOf(spd) {
    var one = new Array(38);
    for (var i = 0; i < 38; i++) one[i] = 1;
    return measure(litReflectance(one, spd, 1)).XYZ;
  }

  var D65_WHITE = [0.95047, 1.0, 1.08883];

  /**
   * 一块漆在指定光照下的颜色。
   *
   * @param {string} hex 漆色
   * @param {object} o
   *   cct    光源色温（K）
   *   gain   照度倍数（1 = 正常，阴影通常 0.4–0.6）
   *   adapt  色适应程度（0 = 完全按光源原样，1 = 眼睛完全适应）
   *   spec   高光（镜面反射）叠加，0–0.3
   */
  function litColor(hex, o) {
    o = o || {};
    var cct = o.cct || 5500;
    var gain = o.gain == null ? 1 : o.gain;
    var adapt = o.adapt == null ? 0.8 : o.adapt;
    var spec = o.spec || 0;

    var spd = planckSPD(cct);
    var ks = paintKs(hex);
    var R = new Array(ks.length);
    for (var q = 0; q < ks.length; q++) R[q] = rOfKs(ks[q]);
    var m = measure(litReflectance(R, spd, gain));

    var w = whiteOf(spd);
    var xyz = m.XYZ.slice();

    // 冯·克里斯色适应：按比例把光源白拉回 D65 白，adapt 控制拉回多少
    for (var i = 0; i < 3; i++) {
      var ratio = (D65_WHITE[i] / w[i]) * gain;
      var scale = Math.pow(ratio, adapt);
      xyz[i] = xyz[i] * scale;
    }

    // 镜面高光：直接往白色方向加
    if (spec > 0) {
      xyz[0] += D65_WHITE[0] * spec;
      xyz[1] += D65_WHITE[1] * spec;
      xyz[2] += D65_WHITE[2] * spec;
    }

    var lab = xyzToLab(xyz);
    var rgb = labToSrgb(lab);
    return {
      hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
      lab: lab,
      xyz: xyz
    };
  }

  function shadeVariants(hex, opts) {
    opts = opts || {};
    var light = opts.light === 'warm' || opts.light === 'cool' ? opts.light : 'neutral';
    // 金属漆：高光以镜面反射为主（更亮、更白），阴影几乎没有漫反射（更暗）
    var metal = !!opts.metal;
    // 珠光：干涉颜料的角色变，角度一变就换色相（我们只有一张图，用"角色位移"近似）
    var pearl = !!opts.pearl;

    // 光源设定：同一块漆，换个光源就是另一种颜色
    var LIGHT = {
      warm:  { sun: 4200, sun2: 3200, sky: 10000, ground: 4000, deep: 13000 },
      neutral: { sun: 5200, sun2: 3800, sky: 9000, ground: 4200, deep: 13000 },
      cool:  { sun: 7000, sun2: 5500, sky: 8000, ground: 4800, deep: 14000 }
    }[light];

    var baseLab = labOfHex(hex);

    // 光谱只负责"色相往哪偏"；明度按阶梯给定，避免高光被晒爆成纯白
    function mk(id, name, note, o) {
      var c = litColor(hex, { cct: o.cct, gain: 1, adapt: o.adapt, spec: 0 });
      var lab = c.lab.slice();
      var dL = o.dL;
      if (metal) {
        dL = dL > 0 ? dL * 1.5 : dL * 1.3;
        // 镜面反射带走一部分彩度：金属高光更接近"发白的本色"
        if (dL > 0) { lab[1] *= 0.85; lab[2] *= 0.85; }
      }
      if (pearl) {
        dL = dL * 1.2;
        // 高光偏一个方向、阴影偏反方向：这就是珠光的"翻色"
        var ang = (dL > 0 ? 22 : -18) * Math.PI / 180;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        var na = lab[1] * ca - lab[2] * sa;
        var nb = lab[1] * sa + lab[2] * ca;
        lab[1] = na;
        lab[2] = nb;
      }
      lab[0] = Math.max(4, Math.min(97, baseLab[0] + dL));
      if (o.spec) {
        var k = 1 - o.spec * 3;
        lab[1] *= k;
        lab[2] *= k;
      }
      var rgb = labToSrgb(lab);
      return { id: id, name: name, note: note, hex: rgbToHex(rgb[0], rgb[1], rgb[2]), lab: lab };
    }

    var list = [
      // 直射光：亮、偏暖
      mk('hi', '高光', '直射光照到的颜色（' + LIGHT.sun + 'K）',
        { cct: LIGHT.sun, dL: 12, spec: 0.04, adapt: 0.85 }),

      mk('hi-warm', '暖高光', '更暖的直射光（' + LIGHT.sun2 + 'K）',
        { cct: LIGHT.sun2, dL: 11, spec: 0.06, adapt: 0.8 }),

      // 阴影：只有天空散射，偏冷且变暗
      mk('sh', '阴影', '天空散射光下的颜色（' + LIGHT.sky + 'K）',
        { cct: LIGHT.sky, dL: -14, adapt: 0.55 }),

      mk('sh-warm', '暖阴影', '地面反射的暖光（' + LIGHT.ground + 'K）',
        { cct: LIGHT.ground, dL: -15, adapt: 0.35 }),

      mk('sh-cool', '冷阴影', '深阴影，只有蓝天光（' + LIGHT.deep + 'K）',
        { cct: LIGHT.deep, dL: -16, adapt: 0.25 }),

      (function () {
        var g = mk('sh-gray', '中性阴影', '眼睛完全适应的阴影，只剩明度差',
          { cct: LIGHT.sky, dL: -15, adapt: 0.9 });
        g.lab = [g.lab[0], 0, 0];
        var rgb = labToSrgb(g.lab);
        g.hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        return g;
      })()
    ];

    // 从亮到暗排
    list.sort(function (p, q) { return q.lab[0] - p.lab[0]; });

    // 兜底：物理上很接近的两档，稍微拉开一点，保证肉眼能分
    for (var i = 1; i < list.length; i++) {
      for (var t = 0; t < 4; t++) {
        var minDe = Infinity;
        for (var j = 0; j < i; j++) {
          var d = deltaE00(list[i].lab, list[j].lab);
          if (d < minDe) minDe = d;
        }
        if (minDe >= 3) break;

        var L2 = Math.max(4, list[i].lab[0] - 3);
        var a2 = list[i].lab[1] * 1.06;
        var b2 = list[i].lab[2] * 1.06;
        var rgb2 = labToSrgb([L2, a2, b2]);
        list[i] = {
          id: list[i].id, name: list[i].name, note: list[i].note,
          hex: rgbToHex(rgb2[0], rgb2[1], rgb2[2]), lab: [L2, a2, b2]
        };
      }
    }

    return list;
  }
  /**
   * 从白平衡增益反推光源色温（McCamy 近似）。
   *
   * gain 是把画面校回中性所需的乘数，取倒数就是光源本身的颜色。
   * 只用于提示"这张图什么光"，不参与计算。
   */
  function estimateLight(gain) {
    if (!gain || !gain[0] || !gain[1] || !gain[2]) return null;

    var ir = 1 / gain[0], ig = 1 / gain[1], ib = 1 / gain[2];
    ir /= ig; ib /= ig; ig = 1;

    var X = 0.4124 * ir + 0.3576 * ig + 0.1805 * ib;
    var Y = 0.2126 * ir + 0.7152 * ig + 0.0722 * ib;
    var Z = 0.0193 * ir + 0.1192 * ig + 0.9505 * ib;

    var sum = X + Y + Z;
    if (!sum) return null;

    var x = X / sum, y = Y / sum;
    var n = (x - 0.3320) / (0.1858 - y);
    var cct = 449 * n * n * n + 3525 * n * n + 6823.3 * n + 5520.33;

    if (!isFinite(cct)) return null;
    cct = Math.max(1500, Math.min(15000, cct));

    var label = cct < 3300 ? '很暖' : cct < 4500 ? '偏暖'
      : cct < 6000 ? '接近中性' : cct < 7500 ? '偏冷' : '很冷';

    // 光源色：把倒数归一化到最亮通道，再转 sRGB
    var inv = [1 / gain[0], 1 / gain[1], 1 / gain[2]];
    var mx = Math.max(inv[0], inv[1], inv[2]) || 1;
    var swatch = [
      linToSrgb(Math.min(1, inv[0] / mx)),
      linToSrgb(Math.min(1, inv[1] / mx)),
      linToSrgb(Math.min(1, inv[2] / mx))
    ];

    return {
      cct: Math.round(cct / 50) * 50,
      label: label,
      warm: cct < 5000,
      swatch: rgbToHex(swatch[0], swatch[1], swatch[2])
    };
  }



  /**
   * 在原漆里加多少——阴影/高光卡的配方用这个。
   *
   * 和 solve 的区别：solve 是"从一堆漆里配出某个颜色"，
   * 这里是"在这支漆的基础上加多少什么"。
   *
   * 按百分比算，不是按滴：高光往往要加三四成的白，
   * 用滴表示会变成"加 120 滴"，没有意义。少量时再换算成滴。
   */
  function tintRecipe(baseHex, targetHex, pigmentIds, opts) {
    opts = opts || {};
    var volume = opts.volume || 10;

    var STEPS = [2, 3, 4, 6, 8, 12, 16, 22, 30, 40, 50];

    var targetLab = labOfHex(targetHex);
    var baseKs = paintKs(baseHex);

    function findPig(id) {
      for (var q = 0; q < PIGMENTS.length; q++) if (PIGMENTS[q].code === id) return PIGMENTS[q];
      return null;
    }

    var pigs = (pigmentIds || []).map(findPig).filter(function (p) {
      return p && p.kind !== 'additive';
    });
    if (!pigs.length) return null;

    function evalMix(specs) {
      var usedPct = 0;
      for (var i = 0; i < specs.length; i++) usedPct += specs[i].pct;
      if (usedPct >= 95) return null;

      var comps = [{ ks: baseKs }];
      var w = [100 - usedPct];
      for (var j = 0; j < specs.length; j++) {
        comps.push({ ks: paintKs(specs[j].pigment.hex) });
        w.push(specs[j].pct);
      }
      return deltaE00(measure(mixSpectrum(comps, w)).lab, targetLab);
    }

    var singles = [];
    for (var i = 0; i < pigs.length; i++) {
      for (var s = 0; s < STEPS.length; s++) {
        var de = evalMix([{ pigment: pigs[i], pct: STEPS[s] }]);
        if (de != null) singles.push({ pigment: pigs[i], pct: STEPS[s], deltaE: de });
      }
    }
    if (!singles.length) return null;
    singles.sort(function (a, b) { return a.deltaE - b.deltaE; });

    var best = { items: [{ pigment: singles[0].pigment, pct: singles[0].pct }], deltaE: singles[0].deltaE };

    var top = singles.slice(0, 4);
    for (var t = 0; t < top.length; t++) {
      for (var k = 0; k < pigs.length; k++) {
        if (pigs[k].code === top[t].pigment.code) continue;
        for (var s2 = 0; s2 < STEPS.length; s2++) {
          var d2 = evalMix([
            { pigment: top[t].pigment, pct: top[t].pct },
            { pigment: pigs[k], pct: STEPS[s2] }
          ]);
          if (d2 != null && d2 < best.deltaE) {
            best = {
              items: [
                { pigment: top[t].pigment, pct: top[t].pct },
                { pigment: pigs[k], pct: STEPS[s2] }
              ],
              deltaE: d2
            };
          }
        }
      }
    }

    var totalPct = 0;
    best.items.forEach(function (it) {
      totalPct += it.pct;
      it.ml = Math.round((it.pct / 100) * volume * 10) / 10;
      it.drops = Math.round((it.pct / 100) * volume / DROP_ML);
    });
    best.totalPct = totalPct;
    best.basePct = 100 - totalPct;
    best.volume = volume;
    best.exact = best.deltaE < 2.5;

    return best;
  }

  /** 用一个词说清这个颜色的色调偏向（彩度太低就不说） */
  function castName(lab) {
    var c = Math.hypot(lab[1], lab[2]);
    if (c < 2) return '';

    // Lab 里的真实位置：红 40 / 橙 60 / 黄 103 / 绿 136 / 青 196 / 蓝 306 / 品红 328
    var h = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
    if (h < 0) h += 360;

    if (h < 15 || h >= 350) return '偏红';
    if (h < 55) return '偏红';
    if (h < 75) return '偏橙';
    if (h < 118) return '偏黄';
    if (h < 132) return '偏黄绿';
    if (h < 165) return '偏绿';
    if (h < 200) return '偏青';
    if (h < 312) return '偏蓝';
    if (h < 320) return '偏蓝紫';
    if (h < 327) return '偏紫';
    return '偏品红';
  }

  function metalName(lab) {
    var L = lab[0];
    var chroma = Math.hypot(lab[1], lab[2]);

    if (chroma < 12) {
      if (L > 72) return '银色';
      if (L > 45) return '枪铁色';
      return '黑铁色';
    }

    var h = hueAngle(lab);

    if (h < 15 || h >= 350) return '红铜色';
    if (h < 55) return L > 62 ? '亮铜色' : '红铜色';
    if (h < 78) return L > 66 ? '黄铜色' : '古铜色';
    if (h < 115) return L > 78 ? '香槟金' : (L > 60 ? '黄金色' : '黄铜色');
    if (h < 165) return '青铜色';
    if (h < 205) return '蓝绿钢';
    if (h < 315) return '蓝钢色';
    if (h < 330) return '紫钢色';
    return '金属色';
  }

  return {
    PIGMENTS: PIGMENTS,
    BASE_PAINT: BASE_PAINT,
    PRESETS: PRESETS,
    solve: solve,
    nearestPaint: nearestPaint,
    estimateLight: estimateLight,
    castName: castName,
    metalName: metalName,
    shadeVariants: shadeVariants,
    litColor: litColor,
    tintRecipe: tintRecipe,
    nearestPaints: nearestPaints,
    judgeMetallic: judgeMetallic,
    analyzeImage: analyzeImage,
    classifyPixels: classifyPixels,
    smoothLabels: smoothLabels,
    growRegion: growRegion,
    rectRegion: rectRegion,
    shadesOfGray: shadesOfGray,
    wbGain: wbGain,
    wbRGB: wbRGB,
    solveLayered: solveLayered,
    snapRecipe: snapRecipe,
    quantizeRecipe: quantizeRecipe,
    solveMixed: solveMixed,
    buildProcess: buildProcess,
    PROCESSES: PROCESSES,
    PROCESS_TIPS: PROCESS_TIPS,
    SPRAY_KB: SPRAY_KB,
    CLEAR_HINTS: CLEAR_HINTS,
    toneOf: toneOf,
    DROP_ML: DROP_ML,
    analyzeGloss: analyzeGloss,
    PRIMERS: PRIMERS,
    deltaE00: deltaE00,
    labOfHex: labOfHex,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    ksOf: ksOf,
    mixSpectrum: mixSpectrum,
    measure: measure,
    setLib: setLib
  };
});
