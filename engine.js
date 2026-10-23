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
  /* 知识数据在 engine-data.js */
  var DATA = (typeof module !== 'undefined' && module.exports)
    ? require('./engine-data.js')
    : (typeof window !== 'undefined' ? window.TintData : null);

  var PRIMERS = DATA.PRIMERS;
  var CLEAR_HINTS = DATA.CLEAR_HINTS;
  var PROCESSES = DATA.PROCESSES;
  var SPRAY_KB = DATA.SPRAY_KB;
  var PROCESS_TIPS = DATA.PROCESS_TIPS;
var PROCESS_CHAIN = DATA.PROCESS_CHAIN || [];
  /* PRIMERS 已移到 engine-data.js */

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
   * 漆本身的「信噪比」：不用照片，只用这支漆的 K/S 曲线。
   *
   * 定义：
   *   加白保真 = 与白 1:1 混合后的彩度 / 原彩度
   *   加黑保真 = 与黑 1:1 混合后的彩度 / 原彩度
   *   灰噪     = 与中灰 1:1 混合后掉的彩度比例（越大越"搅浑"）
   *   色相漂移 = 加白后色相偏移的角度（度）
   *
   * 综合信噪比 = 100 × (0.5·加白 + 0.3·加黑 + 0.2·(1−灰噪)) − 0.5·色相漂移
   *
   * 这是「混色稳定性」的度量，不是图像信噪比。
   */
  function paintNoise(hex) {
    var baseLab = labOfHex(hex);
    var baseC = Math.sqrt(baseLab[1] * baseLab[1] + baseLab[2] * baseLab[2]);
    var baseH = Math.atan2(baseLab[2], baseLab[1]) * 180 / Math.PI;
    if (baseH < 0) baseH += 360;

    if (baseC < 8) {
      return { hex: hex, chroma: baseC, tintKeep: null, shadeKeep: null, grayMud: null,
               hueDrift: null, snr: null, note: "接近中性色，混色指标无意义" };
    }

    function mixWith(otherHex) {
      var R = mixSpectrum(
        [{ ks: paintKs(hex) }, { ks: paintKs(otherHex) }],
        [1, 1]
      );
      return measure(R).lab;
    }

    function chromaOf(lab) { return Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]); }
    function hueOf(lab) {
      var h = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
      return h < 0 ? h + 360 : h;
    }

    var tintLab = mixWith("#F3F3F0");
    var shadeLab = mixWith("#1B1B1B");
    var grayLab = mixWith("#8A8A86");

    var tintKeep = chromaOf(tintLab) / baseC;
    var shadeKeep = chromaOf(shadeLab) / baseC;
    var grayMud = 1 - chromaOf(grayLab) / baseC;

    var dh = Math.abs(hueOf(tintLab) - baseH);
    if (dh > 180) dh = 360 - dh;

    var snr = 100 * (0.5 * tintKeep + 0.3 * shadeKeep + 0.2 * (1 - grayMud)) - 0.5 * dh;
    snr = Math.max(0, Math.min(100, snr));

    return {
      hex: hex,
      chroma: baseC,
      tintKeep: tintKeep,
      shadeKeep: shadeKeep,
      grayMud: grayMud,
      hueDrift: dh,
      snr: snr,
      note: null
    };
  }


  /**
   * 漆的光学口径（有行业定义，可实测对照）：
   *   对比率 = 黑底反射率 ÷ 白底反射率（ISO 2814 的对比率定义）
   *   平均 K/S = 380–750nm 吸收散射比的平均值
   *   着色力基准 = 与白 1:10 混合后的明度（用于算相对着色力）
   *
   * 注意：X 是本站的膜厚单位（相对值，不是 µm）；
   * 输入是屏幕色反推的 K/S，所以数值是"推算值"，实测需涂膜。
   */
  function paintOptics(hex, opts) {
    opts = opts || {};
    var X = opts.thickness == null ? 0.6 : opts.thickness;

    var ks = paintKs(hex);
    var sum = 0;
    for (var i2 = 0; i2 < ks.length; i2++) sum += ks[i2];
    var meanKS = sum / ks.length;

    function Yof(R) { return measure(R).XYZ[1]; }

    var overBlack = Yof(coatOver(ks, paintKs("#0A0A0A"), X));
    var overWhite = Yof(coatOver(ks, paintKs("#FFFFFF"), X));
    var contrast = overWhite > 1e-9 ? overBlack / overWhite : null;
    if (contrast != null) contrast = Math.max(0, Math.min(1, contrast));

    // 着色力：与白 1:10 混合，看混合后有多"深"（Y 越低越强）
    var tintR = null;
    try {
      tintR = mixSpectrum([{ ks: ks }, { ks: paintKs("#F3F3F0") }], [1, 10]);
    } catch (e) {
      tintR = null;
    }
    var tintY = tintR ? Yof(tintR) : null;

    return {
      hex: hex,
      meanKS: meanKS,
      contrast: contrast,
      tintY: tintY,
      thickness: X
    };
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
  /* CLEAR_HINTS 已移到 engine-data.js */

  /* PROCESSES 已移到 engine-data.js */


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
  /* SPRAY_KB 已移到 engine-data.js */


  /** 喷涂小知识，和模板无关的通用经验 */
  /* PROCESS_TIPS 已移到 engine-data.js */

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
  /* 光照模块在 engine-light.js：litColor / shadeVariants / tintRecipe */





  /** 把 ΔE 很小的色块合并成一个（同一块漆的明暗被拆成两个时会出现） */
  function mergeSimilar(clusters, threshold) {
    var th = threshold == null ? 6 : threshold;
    var out = [];
    clusters.slice().sort(function (a, b) { return b.share - a.share; }).forEach(function (c) {
      var lab = c.lab || labOfHex(c.hex);
      for (var i = 0; i < out.length; i++) {
        if (deltaE00(out[i].lab, lab) < th) {
          out[i].share += c.share;
          out[i].merged = (out[i].merged || 1) + 1;
          return;
        }
      }
      out.push({ hex: c.hex, share: c.share, lab: lab, merged: 1 });
    });
    return out;
  }

  // ---------------------------------------------------------------
  // 分区信噪比：先卷积找边界分区，再在区域内部卷积
  // ---------------------------------------------------------------

  /** Sobel 梯度幅值（3×3 卷积） */
  function sobelMagnitude(luma, w, h) {
    var mag = new Float32Array(w * h);
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i = y * w + x;
        var tl = luma[i - w - 1], tc = luma[i - w], tr = luma[i - w + 1];
        var ml = luma[i - 1], mr = luma[i + 1];
        var bl = luma[i + w - 1], bc = luma[i + w], br = luma[i + w + 1];
        var gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
        var gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
        mag[i] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    return mag;
  }

  /** Otsu 阈值：让前景/背景的类间方差最大 */
  function otsuThreshold(values, bins) {
    bins = bins || 64;
    var hist = new Float64Array(bins);
    var max = 0, i;
    for (i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
    if (max <= 0) return 0;

    for (i = 0; i < values.length; i++) {
      var b = Math.min(bins - 1, Math.floor((values[i] / max) * bins));
      hist[b]++;
    }

    var total = values.length;
    var sumAll = 0;
    for (i = 0; i < bins; i++) sumAll += i * hist[i];

    var sumB = 0, wB = 0, best = 0, bestVar = -1;
    for (i = 0; i < bins; i++) {
      wB += hist[i];
      if (wB === 0) continue;
      var wF = total - wB;
      if (wF === 0) break;
      sumB += i * hist[i];
      var mB = sumB / wB;
      var mF = (sumAll - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between > bestVar) { bestVar = between; best = i; }
    }
    return ((best + 1) / bins) * max;
  }

  /** 3×3 膨胀一次，把断开的边界连起来 */
  function dilate(mask, w, h) {
    var out = new Uint8Array(mask.length);
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i = y * w + x;
        if (mask[i]) { out[i] = 1; continue; }
        if (mask[i - 1] || mask[i + 1] || mask[i - w] || mask[i + w]) out[i] = 1;
      }
    }
    // 边缘一圈保持原样
    for (var x2 = 0; x2 < w; x2++) { out[x2] = mask[x2]; out[(h - 1) * w + x2] = mask[(h - 1) * w + x2]; }
    for (var y2 = 0; y2 < h; y2++) { out[y2 * w] = mask[y2 * w]; out[y2 * w + w - 1] = mask[y2 * w + w - 1]; }
    return out;
  }

  /**
   * 频带信噪比：固定高斯金字塔分带，不用阈值。
   *
   * 结构（信号）= 粗层 + 中频层
   * 纹理（噪声）= 最细的两层
   * 全部零均值后算能量，输出 0~1 的占比和 dB。
   */
  /**
   * Hasler–Süsstrunk 鲜艳度。照片常见 44–50（VPF 论文实测 43.99 / 50.03）。
   */
  function colorfulness(rgb) {
    var n = rgb.length / 3;
    if (!n) return 0;
    var sRG = 0, sYB = 0, sRG2 = 0, sYB2 = 0;
    for (var i = 0; i < n; i++) {
      var r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
      var rg = r - g, yb = 0.5 * (r + g) - b;
      sRG += rg; sYB += yb; sRG2 += rg * rg; sYB2 += yb * yb;
    }
    var mRG = sRG / n, mYB = sYB / n;
    var vRG = Math.max(0, sRG2 / n - mRG * mRG);
    var vYB = Math.max(0, sYB2 / n - mYB * mYB);
    return Math.sqrt(vRG + vYB) + 0.3 * Math.sqrt(mRG * mRG + mYB * mYB);
  }

  /**
   * CIELAB 颜色熵（bit）。照片常见 4.6–5.2（VPF 论文实测 4.608 / 5.156）。
   */
  function colorEntropy(labs) {
    if (!labs || !labs.length) return 0;
    var bins = {}, n = labs.length;
    labs.forEach(function (lab) {
      var L = Math.max(0, Math.min(7, Math.floor(lab[0] / 12.5)));
      var a = Math.max(0, Math.min(5, Math.floor((lab[1] + 100) / 33.4)));
      var b = Math.max(0, Math.min(5, Math.floor((lab[2] + 100) / 33.4)));
      var key = L * 36 + a * 6 + b;
      bins[key] = (bins[key] || 0) + 1;
    });
    var H = 0;
    for (var k in bins) { var p = bins[k] / n; H -= p * Math.log2(p); }
    return H;
  }

  /**
   * 中心占比：中心 50% 的平均梯度 / 全图平均梯度。
   * 定义和 VPF 论文的 CBI 不同，只作方向参考。
   */
  function centerBias(luma, w, h) {
    var mag = sobelMagnitude(luma, w, h);
    var all = 0, nAll = 0, mid = 0, nMid = 0;
    var x0 = Math.floor(w * 0.25), x1 = Math.floor(w * 0.75);
    var y0 = Math.floor(h * 0.25), y1 = Math.floor(h * 0.75);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var v = mag[y * w + x];
        all += v; nAll++;
        if (x >= x0 && x < x1 && y >= y0 && y < y1) { mid += v; nMid++; }
      }
    }
    if (!nAll || !nMid) return 0;
    var mA = all / nAll;
    return mA > 1e-9 ? (mid / nMid) / mA : 0;
  }


  function bandSnr(luma, w, h, opts) {
    opts = opts || {};
    var levels = opts.levels == null ? 3 : opts.levels;
    var edgeWeight = opts.edgeWeight == null ? 0.5 : opts.edgeWeight;
    var r = opts.radius == null ? 2 : opts.radius;

    var pyr = [luma];
    for (var i = 0; i < levels; i++) pyr.push(boxBlur(pyr[i], w, h, r));

    function energy(arr) {
      var n = arr.length, mean = 0, k;
      for (k = 0; k < n; k++) mean += arr[k];
      mean /= n;
      var e = 0;
      for (k = 0; k < n; k++) { var d = arr[k] - mean; e += d * d; }
      return e / n;
    }

    var bandEnergy = [];
    for (var j = 0; j < levels; j++) {
      var band = new Float32Array(w * h);
      for (var p = 0; p < w * h; p++) band[p] = pyr[j][p] - pyr[j + 1][p];
      bandEnergy.push(energy(band));
    }

    var eTexture = bandEnergy[0] + (bandEnergy[1] || 0);
    var eMid = bandEnergy[2] || 0;
    var eCoarse = energy(pyr[levels]);
    var eStructure = eCoarse + eMid;

    // 边缘权重：细节算多重由它决定，调小 = 更看重形体
    var total = eStructure + eTexture * edgeWeight;
    var share = total > 1e-12 ? eStructure / total : 0;
    var db = 10 * Math.log10(Math.max(1e-9, eStructure) / Math.max(1e-9, eTexture * edgeWeight));

    return {
      share: share,
      db: db,
      eStructure: eStructure,
      eTexture: eTexture,
      eCoarse: eCoarse,
      eMid: eMid,
      bandEnergy: bandEnergy,
      edgeWeight: edgeWeight
    };
  }

  /** 连通域标记（边界像元不参与） */
  /** sRGB → Lab（D65），给逐像素用，比 labOfHex 快 */
  var SRGB_LIN = (function () {
    var t = new Float64Array(256);
    for (var i2 = 0; i2 < 256; i2++) {
      var c = i2 / 255;
      t[i2] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return t;
  })();

  function rgb2lab(r, g, b) {
    var R = SRGB_LIN[r | 0], G = SRGB_LIN[g | 0], B = SRGB_LIN[b | 0];

    var X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    var Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
    var Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;

    function f(t) { return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116); }
    var fx = f(X), fy = f(Y), fz = f(Z);

    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  /**
   * 按颜色分区：优先把颜色相近的像素连成一块。
   *
   * 和 segmentRegions 的区别：
   * - 不看亮度梯度，直接比 Lab 色差
   * - 区域从种子长出来，色差超过容差的邻居不进
   * - 平滑渐变会被切开（亮度慢慢变，但色差累计超限）
   */
  function colorRegions(data, w, h, opts) {
    opts = opts || {};
    var tol = opts.tol == null ? 7 : opts.tol;
    var tolSq = tol * tol;
    var minArea = opts.minArea == null ? Math.max(60, Math.round(w * h / 300)) : opts.minArea;

    var n = w * h;
    var labs = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var o = i * 4;
      var lab = rgb2lab(data[o], data[o + 1], data[o + 2]);
      labs[i * 3] = lab[0];
      labs[i * 3 + 1] = lab[1];
      labs[i * 3 + 2] = lab[2];
    }

    var labels = new Int32Array(n).fill(-1);
    var queue = new Int32Array(n);
    var regions = [];

    for (var seed = 0; seed < n; seed++) {
      if (labels[seed] >= 0) continue;

      var id = regions.length;
      var head = 0, tail = 0;
      queue[tail++] = seed;
      labels[seed] = id;

      // 区域的平均色，随生长更新
      var mR = labs[seed * 3], mG = labs[seed * 3 + 1], mB = labs[seed * 3 + 2];
      var cnt = 1;
      var minX = w, maxX = -1, minY = h, maxY = -1;

      while (head < tail) {
        var q = queue[head++];
        var qx = q % w, qy = (q - qx) / w;

        if (qx < minX) minX = qx;
        if (qx > maxX) maxX = qx;
        if (qy < minY) minY = qy;
        if (qy > maxY) maxY = qy;

        for (var k = 0; k < 4; k++) {
          var nx = qx + (k === 0 ? -1 : k === 1 ? 1 : 0);
          var ny = qy + (k === 2 ? -1 : k === 3 ? 1 : 0);
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

          var q2 = ny * w + nx;
          if (labels[q2] >= 0) continue;

          var dL = labs[q2 * 3] - mR;
          var dA = labs[q2 * 3 + 1] - mG;
          var dB = labs[q2 * 3 + 2] - mB;
          if (dL * dL + dA * dA + dB * dB > tolSq) continue;

          labels[q2] = id;
          queue[tail++] = q2;

          cnt++;
          mR += (labs[q2 * 3] - mR) / cnt;
          mG += (labs[q2 * 3 + 1] - mG) / cnt;
          mB += (labs[q2 * 3 + 2] - mB) / cnt;
        }
      }

      regions.push({
        id: id,
        area: cnt,
        meanL: mR,
        meanA: mG,
        meanB: mB,
        box: [minX, minY, maxX, maxY]
      });
    }

    // 激进合并：并查集 + 邻接表建一次，合并时只改并查集，不再每次重扫全图
    var aggressive = opts.mergeTol == null ? 16 : opts.mergeTol;
    var smallLimit = opts.smallLimit == null ? minArea * 6 : opts.smallLimit;

    var parent = new Int32Array(regions.length);
    for (var pi = 0; pi < regions.length; pi++) parent[pi] = pi;

    function find(x) {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }

    // 邻接表只建一次
    var adjSets = new Array(regions.length);
    for (var ai = 0; ai < regions.length; ai++) adjSets[ai] = new Set();

    for (var yy2 = 0; yy2 < h; yy2++) {
      for (var xx2 = 0; xx2 < w; xx2++) {
        var pp = yy2 * w + xx2;
        var la = labels[pp];
        if (la < 0) continue;
        if (xx2 < w - 1) {
          var lb = labels[pp + 1];
          if (lb >= 0 && lb !== la) { adjSets[la].add(lb); adjSets[lb].add(la); }
        }
        if (yy2 < h - 1) {
          var lc = labels[pp + w];
          if (lc >= 0 && lc !== la) { adjSets[la].add(lc); adjSets[lc].add(la); }
        }
      }
    }

    function distOf(x, y) {
      var dx = regions[x].meanL - regions[y].meanL;
      var dy = regions[x].meanA - regions[y].meanA;
      var dz = regions[x].meanB - regions[y].meanB;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    var guard = 0;
    while (guard++ < 400) {
      var smallest = -1, smallArea = Infinity;
      for (var ri = 0; ri < regions.length; ri++) {
        if (parent[ri] !== ri) continue;
        var ar = regions[ri].area;
        if (ar > 0 && ar < smallLimit && ar < smallArea) { smallArea = ar; smallest = ri; }
      }
      if (smallest < 0) break;

      var best = -1, bestD = Infinity;
      adjSets[smallest].forEach(function (nb) {
        if (parent[nb] !== nb || regions[nb].area <= 0) return;
        var d = distOf(smallest, nb);
        if (d < bestD) { bestD = d; best = nb; }
      });

      if (best < 0 || bestD > aggressive) { regions[smallest].area = -regions[smallest].area; continue; }

      var keep = regions[best].area >= regions[smallest].area ? best : smallest;
      var gone = keep === best ? smallest : best;
      var A2 = regions[keep].area, B2 = regions[gone].area;
      regions[keep].meanL = (regions[keep].meanL * A2 + regions[gone].meanL * B2) / (A2 + B2);
      regions[keep].meanA = (regions[keep].meanA * A2 + regions[gone].meanA * B2) / (A2 + B2);
      regions[keep].meanB = (regions[keep].meanB * A2 + regions[gone].meanB * B2) / (A2 + B2);
      regions[keep].area = A2 + B2;

      parent[gone] = keep;
      adjSets[gone].forEach(function (nb) {
        if (nb !== keep) { adjSets[keep].add(nb); adjSets[nb].add(keep); }
        adjSets[nb].delete(gone);
      });
      adjSets[gone] = null;
      regions[gone].area = 0;
    }

    // 一次性按并查集重编号
    var rootMap = new Map();
    for (var qq = 0; qq < n; qq++) {
      var l0 = labels[qq];
      if (l0 < 0) continue;
      var rt = find(l0);
      var nid = rootMap.get(rt);
      if (nid === undefined) { nid = rootMap.size; rootMap.set(rt, nid); }
      labels[qq] = nid;
    }

    var remapped = [];
    rootMap.forEach(function (nid2, rt2) {
      var rr = regions[rt2];
      remapped[nid2] = {
        id: nid2,
        area: Math.abs(rr.area),
        meanL: rr.meanL,
        meanA: rr.meanA,
        meanB: rr.meanB
      };
    });
    regions = remapped.filter(Boolean);


    // 重编号
    var relabel = {};
    var next = 0;
    var kept = [];
    for (var rj = 0; rj < regions.length; rj++) {
      if (regions[rj].area <= 0) continue;
      relabel[rj] = next++;
      kept.push(regions[rj]);
    }
    for (var qj = 0; qj < n; qj++) {
      var l0 = labels[qj];
      if (l0 >= 0 && relabel[l0] != null) labels[qj] = relabel[l0];
    }
    for (var rk = 0; rk < kept.length; rk++) kept[rk].id = relabel[kept[rk].id] != null ? relabel[rk] : rk;
    regions = kept.map(function (r5, k5) { r5.id = k5; return r5; });

    // 太小的块标成 -2，不参与
    var drop = [];
    regions.forEach(function (r) { if (r.area < minArea) drop.push(r.id); });
    if (drop.length) {
      var isDrop = {};
      drop.forEach(function (d) { isDrop[d] = true; });
      for (var q3 = 0; q3 < n; q3++) if (isDrop[labels[q3]]) labels[q3] = -2;
    }

    // 边界：标签变化的像素
    var isEdge = new Uint8Array(n);
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var idx = y * w + x;
        var v = labels[idx];
        if (labels[idx - 1] !== v || labels[idx + 1] !== v ||
            labels[idx - w] !== v || labels[idx + w] !== v) isEdge[idx] = 1;
      }
    }

    return {
      w: w, h: h,
      labels: labels,
      isEdge: isEdge,
      regions: regions.filter(function (r) { return r.area >= minArea; }),
      totalRegions: regions.length
    };
  }


  function segmentRegions(luma, w, h, opts) {
    opts = opts || {};
    var minArea = opts.minArea == null ? Math.max(60, Math.round(w * h / 300)) : opts.minArea;

    var mag = sobelMagnitude(luma, w, h);
    var th = opts.threshold != null ? opts.threshold : otsuThreshold(mag, 64);

    var isEdge = new Uint8Array(w * h);
    for (var i = 0; i < mag.length; i++) isEdge[i] = mag[i] > th ? 1 : 0;
    isEdge = dilate(isEdge, w, h);

    // 外面一圈也算边界，不然区域会绕过上下边缘连在一起
    for (var bx = 0; bx < w; bx++) { isEdge[bx] = 1; isEdge[(h - 1) * w + bx] = 1; }
    for (var by = 0; by < h; by++) { isEdge[by * w] = 1; isEdge[by * w + w - 1] = 1; }

    var labels = new Int32Array(w * h).fill(-1);
    var stack = new Int32Array(w * h);
    var regions = [];

    for (var p = 0; p < w * h; p++) {
      if (labels[p] >= 0 || isEdge[p]) continue;
      var id = regions.length;
      var sp = 0;
      stack[sp++] = p;
      labels[p] = id;

      var area = 0, sL = 0;
      while (sp > 0) {
        var q = stack[--sp];
        var qx = q % w, qy = (q - qx) / w;
        area++;
        sL += luma[q];
        if (qx > 0 && labels[q - 1] < 0 && !isEdge[q - 1]) { labels[q - 1] = id; stack[sp++] = q - 1; }
        if (qx < w - 1 && labels[q + 1] < 0 && !isEdge[q + 1]) { labels[q + 1] = id; stack[sp++] = q + 1; }
        if (qy > 0 && labels[q - w] < 0 && !isEdge[q - w]) { labels[q - w] = id; stack[sp++] = q - w; }
        if (qy < h - 1 && labels[q + w] < 0 && !isEdge[q + w]) { labels[q + w] = id; stack[sp++] = q + w; }
      }
      regions.push({ id: id, area: area, meanL: sL / area });
    }

    var kept = regions.filter(function (r) { return r.area >= minArea; });
    var tiny = regions.filter(function (r) { return r.area < minArea; });
    var tinyArea = tiny.reduce(function (t, r) { return t + r.area; }, 0);

    // 小区域不参与统计，标成 -2
    var drop = {};
    tiny.forEach(function (r) { drop[r.id] = true; });
    for (var k = 0; k < labels.length; k++) if (drop[labels[k]]) labels[k] = -2;

    return {
      w: w, h: h,
      labels: labels,
      isEdge: isEdge,
      edgeMag: mag,
      threshold: th,
      regions: kept.map(function (r, i) { return { id: r.id, area: r.area, meanL: r.meanL, order: i }; }),
      totalRegions: regions.length,
      tinyArea: tinyArea
    };
  }

  /**
   * 区域内部再卷积：这块面板喷得匀不匀。
   *
   *   区域内高频 = 噪声（颗粒、脏边）
   *   区域之间的亮度差 = 信号（分色清不清楚）
   */
  function regionSnr(luma, w, h, seg, opts) {
    opts = opts || {};
    var r = opts.radius == null ? 3 : opts.radius;
    var low = boxBlur(luma, w, h, r);

    var stats = seg.regions.map(function (reg) {
      var sLow = 0, sHigh = 0, n = 0;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var idx = y * w + x;
          if (seg.labels[idx] !== reg.id) continue;
          var dh = luma[idx] - low[idx];
          var dl = low[idx] - reg.meanL;
          sHigh += dh * dh;
          sLow += dl * dl;
          n++;
        }
      }
      return {
        id: reg.id, area: reg.area, meanL: reg.meanL,
        highVar: n ? sHigh / n : 0,
        lowVar: n ? sLow / n : 0
      };
    });

    var signal = 0;
    if (stats.length > 1) {
      var mL = stats.reduce(function (t, s) { return t + s.meanL * s.area; }, 0) / (w * h);
      stats.forEach(function (s) { signal += s.area * (s.meanL - mL) * (s.meanL - mL); });
      signal /= w * h;
    }

    var noise = 0;
    stats.forEach(function (s) { noise += s.area * s.highVar; });
    noise /= w * h;

    var ratio = noise > 1e-9 ? signal / noise : (signal > 0 ? Infinity : 0);
    var db = 10 * Math.log10(Math.max(1e-6, ratio));

    return {
      regions: stats,
      regionCount: stats.length,
      signal: signal,
      noise: noise,
      ratio: ratio,
      db: db,
      tinyShare: (seg.tinyArea || 0) / (w * h)
    };
  }

  // ---------------------------------------------------------------
  // 卷积信噪比：低频是结构，高频是细节/噪声
  // ---------------------------------------------------------------

  /** 可分离盒式模糊（O(n)），用来取低频 */
  function boxBlur(src, w, h, r) {
    var tmp = new Float32Array(w * h);
    var out = new Float32Array(w * h);
    var span = 2 * r + 1;

    // 横向
    for (var y = 0; y < h; y++) {
      var row = y * w, sum = 0;
      for (var x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
      for (var x2 = 0; x2 < w; x2++) {
        tmp[row + x2] = sum / span;
        var add = src[row + Math.min(w - 1, x2 + r + 1)];
        var sub = src[row + Math.max(0, x2 - r)];
        sum += add - sub;
      }
    }

    // 纵向
    for (var x3 = 0; x3 < w; x3++) {
      var sum2 = 0;
      for (var y2 = -r; y2 <= r; y2++) sum2 += tmp[Math.min(h - 1, Math.max(0, y2)) * w + x3];
      for (var y3 = 0; y3 < h; y3++) {
        out[y3 * w + x3] = sum2 / span;
        var add2 = tmp[Math.min(h - 1, y3 + r + 1) * w + x3];
        var sub2 = tmp[Math.max(0, y3 - r) * w + x3];
        sum2 += add2 - sub2;
      }
    }
    return out;
  }

  /**
   * 用卷积算信噪比。
   *
   * 低频（模糊后）= 结构、体积、大形状 → 信号
   * 高频（原图 − 模糊）= 边缘、纹理、杂色 → 细节/噪声
   *
   * 返回全局比值和逐块的信噪比图（用来标"哪里高哪里低"）。
   */
  /**
   * 从照片估光源：方向靠梯度卷积，色温靠高光色，软硬靠明暗分布。
   * 单张照片推不出真实仰角和距离，方向是画面里的投影方向。
   */
  /**
   * 分区估光：每个区域内部单独做方向直方图。
   *
   * 整图一个直方图会把不同朝向的面混在一起；分区之后
   * "左半边从左边来、右半边从上面来" 才分得开。
   */
  /**
   * 明暗分离：在已分好的区域内部，用大核卷积做局部对比，
   * 把每块再切成高光 / 中间调 / 阴影。
   *
   * 大核（radius 默认图短边的 1/18）算的是"这块的趋势"，
   * 原图减去趋势就是局部对比，放大后能看出哪亮哪暗。
   */
  function shadeMap(data, w, h, seg, opts) {
    opts = opts || {};
    var gain = opts.gain == null ? 2.2 : opts.gain;
    var k = opts.k == null ? 0.75 : opts.k;

    var n = w * h;
    var luma = new Float32Array(n);
    for (var i2 = 0; i2 < n; i2++) {
      var o = i2 * 4;
      luma[i2] = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) / 255;
    }

    var radius = opts.radius == null ? Math.max(6, Math.round(Math.min(w, h) / 18)) : opts.radius;
    var low = boxBlur(luma, w, h, radius);

    var detail = new Float32Array(n);
    for (var i3 = 0; i3 < n; i3++) {
      detail[i3] = (luma[i3] - low[i3]) * gain;   // 放大局部对比
    }

    var kind = new Int8Array(n).fill(-1);          // 0 阴影 / 1 中间 / 2 高光
    var pixelLists = regionPixelLists(seg, n);
    var pixelLists = regionPixelLists(seg, n);
    var perRegion = [];

    (seg.regions || []).forEach(function (reg) {
      var pix = pixelLists[reg.id] || [];
      var sum = 0, sum2 = 0, cnt = 0;
      for (var q = 0; q < pix.length; q++) {
        var v = low[pix[q]];
        sum += v; sum2 += v * v; cnt++;
      }
      if (!cnt) return;

      var mean = sum / cnt;
      var sd = Math.sqrt(Math.max(0, sum2 / cnt - mean * mean));
      var hiTh = mean + sd * k;
      var loTh = mean - sd * k;

      var hi = 0, mid = 0, lo = 0;
      for (var q2 = 0; q2 < pix.length; q2++) {
        var qi2 = pix[q2];
        var v2 = low[qi2];
        if (v2 >= hiTh) { kind[qi2] = 2; hi++; }
        else if (v2 <= loTh) { kind[qi2] = 0; lo++; }
        else { kind[qi2] = 1; mid++; }
      }

      perRegion.push({
        id: reg.id,
        area: cnt,
        share: cnt / n,
        meanL: mean,
        sd: sd,
        highlight: hi / cnt,
        midtone: mid / cnt,
        shadow: lo / cnt
      });
    });

    perRegion.sort(function (a, b) { return b.area - a.area; });

    return {
      kind: kind,
      detail: detail,
      perRegion: perRegion,
      radius: radius,
      gain: gain
    };
  }


  /** 每个区域的像素索引表：建一次，按区域遍历只碰自己的像素 */
  function regionPixelLists(seg, n) {
    if (seg._pix) return seg._pix;

    var lists = [];
    for (var i2 = 0; i2 < n; i2++) {
      var l = seg.labels[i2];
      if (l < 0) continue;
      if (!lists[l]) lists[l] = [];
      lists[l].push(i2);
    }
    seg._pix = lists;
    return lists;
  }

  function regionLights(data, w, h, seg, opts) {
    opts = opts || {};
    var r = opts.radius == null ? 3 : opts.radius;
    var minArea = opts.minArea == null ? Math.round(w * h / 60) : opts.minArea;
    var BINS = 24;

    var n = w * h;
    var luma = new Float32Array(n);
    for (var i2 = 0; i2 < n; i2++) {
      var o = i2 * 4;
      luma[i2] = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) / 255;
    }
    var low = boxBlur(luma, w, h, r);

    var gxArr = new Float32Array(n);
    var gyArr = new Float32Array(n);
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var idx = y * w + x;
        var gx = (low[idx - w + 1] + 2 * low[idx + 1] + low[idx + w + 1]) -
                 (low[idx - w - 1] + 2 * low[idx - 1] + low[idx + w - 1]);
        var gy = (low[idx + w - 1] + 2 * low[idx + w] + low[idx + w + 1]) -
                 (low[idx - w - 1] + 2 * low[idx - w] + low[idx - w + 1]);
        gxArr[idx] = gx;
        gyArr[idx] = gy;
      }
    }

    var out = [];
    var pixLists = regionPixelLists(seg, n);
    seg.regions.forEach(function (reg) {
      if (reg.area < minArea) return;

      var hist = new Float64Array(BINS);
      var total = 0;
      var myPix = pixLists[reg.id] || [];

      for (var qi = 0; qi < myPix.length; qi++) {
        var q = myPix[qi];
        var gx2 = gxArr[q], gy2 = gyArr[q];
        var mag = Math.sqrt(gx2 * gx2 + gy2 * gy2);
        if (mag < 1e-6) continue;

        var deg = Math.atan2(-gy2, gx2) * 180 / Math.PI;
        if (deg < 0) deg += 360;
        hist[Math.min(BINS - 1, Math.floor(deg / (360 / BINS)))] += mag;
        total += mag;
      }

      if (total < 1e-9) return;

      var best = 0, bestV = -1, sumX = 0, sumY = 0;
      for (var b = 0; b < BINS; b++) {
        if (hist[b] > bestV) { bestV = hist[b]; best = b; }
        var ang = (b + 0.5) * (360 / BINS) * Math.PI / 180;
        sumX += Math.cos(ang) * hist[b];
        sumY += Math.sin(ang) * hist[b];
      }

      var coherence = Math.sqrt(sumX * sumX + sumY * sumY) / total;
      var azimuth = (best + 0.5) * (360 / BINS);

      out.push({
        id: reg.id,
        area: reg.area,
        share: reg.area / n,
        azimuth: azimuth,
        weight: bestV / total,
        coherence: coherence,
        meanL: reg.meanL
      });
    });

    out.sort(function (a2, b2) { return b2.area - a2.area; });
    return out;
  }


  /** 第 k 小的值：快速选择，O(n) 平均，不排序整块 */
  function nthValue(arr, k) {
    var lo = 0, hi = arr.length - 1;
    while (lo < hi) {
      var pivot = arr[(lo + hi) >> 1];
      var i2 = lo, j = hi;
      while (i2 <= j) {
        while (arr[i2] < pivot) i2++;
        while (arr[j] > pivot) j--;
        if (i2 <= j) {
          var t = arr[i2]; arr[i2] = arr[j]; arr[j] = t;
          i2++; j--;
        }
      }
      if (k <= j) hi = j;
      else if (k >= i2) lo = i2;
      else break;
    }
    return arr[k];
  }

  function lightReport(data, w, h, opts) {
    opts = opts || {};
    var r = opts.radius == null ? 4 : opts.radius;

    var n = w * h;
    var luma = new Float32Array(n);
    for (var i2 = 0; i2 < n; i2++) {
      var o = i2 * 4;
      luma[i2] = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) / 255;
    }

    var low = boxBlur(luma, w, h, r);

    var BINS = 36;
    var hist = new Float64Array(BINS);
    var sumX = 0, sumY = 0, sumMag = 0;

    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var idx = y * w + x;
        var tl = low[idx - w - 1], tc = low[idx - w], tr = low[idx - w + 1];
        var ml = low[idx - 1], mr = low[idx + 1];
        var bl = low[idx + w - 1], bc = low[idx + w], br = low[idx + w + 1];

        var gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
        var gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
        var mag = Math.sqrt(gx * gx + gy * gy);
        if (mag < 1e-6) continue;

        sumX += gx / mag;
        sumY += gy / mag;
        sumMag += 1;

        var deg0 = Math.atan2(-gy, gx) * 180 / Math.PI;
        if (deg0 < 0) deg0 += 360;
        hist[Math.min(BINS - 1, Math.floor(deg0 / (360 / BINS)))] += mag;
      }
    }

    // 多光源：直方图已在上面的循环里累加

    // 圆周平滑一次，避免峰太尖
    var smoothed = new Float64Array(BINS);
    for (var b2 = 0; b2 < BINS; b2++) {
      smoothed[b2] = (hist[(b2 + BINS - 1) % BINS] + hist[b2] * 2 + hist[(b2 + 1) % BINS]) / 4;
    }

    var totalW = 0;
    for (var b3 = 0; b3 < BINS; b3++) totalW += smoothed[b3];

    var lobes = [];
    if (totalW > 1e-9) {
      var maxW = 0;
      for (var b4 = 0; b4 < BINS; b4++) if (smoothed[b4] > maxW) maxW = smoothed[b4];

      for (var b5 = 0; b5 < BINS; b5++) {
        var v = smoothed[b5];
        if (v < maxW * 0.35) continue;                    // 至少是主峰的 35%
        if (v < smoothed[(b5 + BINS - 1) % BINS] || v <= smoothed[(b5 + 1) % BINS]) continue;  // 只取局部峰

        var deg = b5 * (360 / BINS) + (360 / BINS) / 2;
        lobes.push({ azimuth: deg, weight: v / totalW });
      }

      lobes.sort(function (a2, b6) { return b6.weight - a2.weight; });
      lobes = lobes.slice(0, 3);
    }


    var dirX = sumX, dirY = sumY;   // 梯度指向亮侧 = 光源方位
    var coherence = sumMag > 0 ? Math.sqrt(dirX * dirX + dirY * dirY) / sumMag : 0;

    var azimuth = Math.atan2(-dirY, dirX) * 180 / Math.PI;
    if (azimuth < 0) azimuth += 360;

    var lumaCopy = Float32Array.from(luma);
    var p05 = nthValue(lumaCopy, Math.floor(n * 0.05));
    var p95 = nthValue(lumaCopy, Math.floor(n * 0.95));
    var contrast = p95 - p05;

    var shadowShare = 0;
    for (var k = 0; k < n; k++) if (luma[k] <= p05 + 0.02) shadowShare++;
    shadowShare /= n;

    var sumR = 0, sumG = 0, sumB = 0, cnt = 0;
    for (var j = 0; j < n; j++) {
      if (luma[j] < p95) continue;
      var o2 = j * 4;
      sumR += data[o2]; sumG += data[o2 + 1]; sumB += data[o2 + 2];
      cnt++;
    }
    if (!cnt) { sumR = sumG = sumB = 255; cnt = 1; }
    sumR /= cnt; sumG /= cnt; sumB /= cnt;

    var X = 0.4124 * sumR + 0.3576 * sumG + 0.1805 * sumB;
    var Y = 0.2126 * sumR + 0.7152 * sumG + 0.0722 * sumB;
    var Z = 0.0193 * sumR + 0.1192 * sumG + 0.9505 * sumB;
    var ssum = X + Y + Z;
    var cct = null;
    if (ssum > 0) {
      var cx = X / ssum, cy = Y / ssum;
      var nn = (cx - 0.3320) / (0.1858 - cy);
      var v = 449 * nn * nn * nn + 3525 * nn * nn + 6823.3 * nn + 5520.33;
      if (isFinite(v)) cct = Math.max(1500, Math.min(15000, v));
    }

    var tempLabel = cct == null ? '—'
      : cct < 3300 ? '很暖' : cct < 4500 ? '偏暖'
      : cct < 6000 ? '接近中性' : cct < 7500 ? '偏冷' : '很冷';

    var dirLabel;
    if (azimuth >= 337.5 || azimuth < 22.5) dirLabel = '右';
    else if (azimuth < 67.5) dirLabel = '右上';
    else if (azimuth < 112.5) dirLabel = '上';
    else if (azimuth < 157.5) dirLabel = '左上';
    else if (azimuth < 202.5) dirLabel = '左';
    else if (azimuth < 247.5) dirLabel = '左下';
    else if (azimuth < 292.5) dirLabel = '下';
    else dirLabel = '右下';

    var hard = contrast > 0.55 ? '硬光' : contrast > 0.35 ? '中等' : '柔光';

    return {
      azimuth: azimuth,
      direction: dirLabel,
      coherence: coherence,
      contrast: contrast,
      p05: p05, p95: p95,
      shadowShare: shadowShare,
      highlight: [Math.round(sumR), Math.round(sumG), Math.round(sumB)],
      cct: cct,
      tempLabel: tempLabel,
      hardness: hard,
      lobes: lobes
    };
  }


  function freqSnr(luma, w, h, opts) {
    opts = opts || {};
    var radius = opts.radius == null ? 4 : opts.radius;
    var tile = opts.tile == null ? 16 : opts.tile;

    var low = boxBlur(luma, w, h, radius);

    // 先去均值：低频里含着整张图的平均亮度，不减掉的话比值会被亮度虚高
    var mean = 0;
    for (var m0 = 0; m0 < w * h; m0++) mean += low[m0];
    mean /= w * h;

    var eLow = 0, eHigh = 0;
    var high = new Float32Array(w * h);
    for (var i = 0; i < w * h; i++) {
      var d = luma[i] - low[i];
      var s0 = low[i] - mean;
      high[i] = d;
      eLow += s0 * s0;
      eHigh += d * d;
    }
    eLow /= w * h;
    eHigh /= w * h;

    var ratio = eLow / Math.max(1e-6, eHigh);
    var db = 10 * Math.log10(Math.max(1e-6, ratio));

    // 逐块：每块算自己的低频/高频能量
    var cols = Math.ceil(w / tile), rows = Math.ceil(h / tile);
    var map = new Float32Array(cols * rows);

    for (var ty = 0; ty < rows; ty++) {
      for (var tx = 0; tx < cols; tx++) {
        var sl = 0, sh = 0, n = 0, ml = 0;
        for (var y = ty * tile; y < Math.min(h, (ty + 1) * tile); y++) {
          for (var x = tx * tile; x < Math.min(w, (tx + 1) * tile); x++) {
            var idx = y * w + x;
            ml += low[idx];
            sh += high[idx] * high[idx];
            n++;
          }
        }
        ml /= n;
        for (var y2 = ty * tile; y2 < Math.min(h, (ty + 1) * tile); y2++) {
          for (var x2 = tx * tile; x2 < Math.min(w, (tx + 1) * tile); x2++) {
            var d2 = low[y2 * w + x2] - ml;
            sl += d2 * d2;
          }
        }
        var r2 = (sl / n) / Math.max(1e-6, sh / n);
        map[ty * cols + tx] = r2;
      }
    }

    return {
      eLow: eLow,
      eHigh: eHigh,
      ratio: ratio,
      db: db,
      radius: radius,
      cols: cols,
      rows: rows,
      tile: tile,
      map: map,
      low: low,
      high: high
    };
  }

  /**
   * 分层：按面积占比把颜色分成「底色层 / 主体层 / 点缀层」。
   *
   * 不分"信号噪声"——背景也是构图的一部分。
   * 看的是层次有没有拉开：相邻两层颜色太像，画面就会糊成一片。
   */
  function layerReport(clusters, opts) {
    opts = opts || {};
    if (!clusters || !clusters.length) return null;

    var baseCut = opts.baseCut == null ? 0.55 : opts.baseCut;   // 底色层占到 55%
    var midCut = opts.midCut == null ? 0.8 : opts.midCut;      // 主体层再占到 85%

    var sorted = clusters.slice().sort(function (a, b) { return b.share - a.share; });
    var acc = 0;
    var layers = [
      { id: 'base', name: '底色层', colors: [], share: 0 },
      { id: 'mid', name: '主体层', colors: [], share: 0 },
      { id: 'accent', name: '点缀层', colors: [], share: 0 }
    ];

    sorted.forEach(function (c, i) {
      var li;
      if (i === 0) li = 0;                 // 最大的一块 = 底色层
      else if (acc < midCut) li = 1;       // 中间部分 = 主体层
      else li = 2;                         // 剩下的 = 点缀层

      layers[li].colors.push(c);
      layers[li].share += c.share;
      acc += c.share;
    });

    // 按总占比重新命名：底色层必须是最大的那组
    var NAMES = ['底色层', '主体层', '点缀层'];
    var ranked = layers.filter(function (L) {
      return L.colors.length > 0;
    }).sort(function (a, b) { return b.share - a.share; });

    var renamed = [];
    ranked.forEach(function (L, i) {
      L.name = NAMES[i] || ('第 ' + (i + 1) + ' 层');
      renamed.push(L);
    });

    // 每层的代表色：该层里占比最大的那个
    layers.forEach(function (L) {
      L.active = L.colors.length > 0;
      if (!L.active) { L.hex = null; L.lab = null; return; }
      var top = L.colors.slice().sort(function (a, b) { return b.share - a.share; })[0];
      L.hex = top.hex;
      L.lab = top.lab || labOfHex(top.hex);
    });

    var active = layers.filter(function (L) { return L.active; });

    // 相邻层的色差：太小说明这层"立"不起来
    var gaps = [];
    for (var i = 1; i < active.length; i++) {
      gaps.push(deltaE00(active[i - 1].lab, active[i].lab));
    }
    var minGap = gaps.length ? Math.min.apply(null, gaps) : Infinity;

    var verdict;
    if (active.length === 1) verdict = '只有一个颜色，谈不上分层。';
    else if (minGap >= 25) verdict = '层次很清楚：相邻两层差 ' + minGap.toFixed(0) + '，远看也分得开。';
    else if (minGap >= 12) verdict = '层次够用：相邻两层差 ' + minGap.toFixed(0) + '，近看没问题。';
    else if (minGap >= 6) verdict = '层次偏弱：相邻两层只差 ' + minGap.toFixed(0) + '，退后两步就糊了。';
    else verdict = '层次混了：相邻两层几乎同色（差 ' + minGap.toFixed(0) + '）。';

    if (active.length === 3 && layers[2].share > 0.25) {
      verdict += ' 点缀层占了 ' + Math.round(layers[2].share * 100) + '%，已经不算点缀。';
    }

    return {
      layers: renamed,
      activeCount: renamed.length,
      gaps: gaps,
      minGap: minGap,
      verdict: verdict
    };
  }

  /**
   * 信噪比：把画面里的颜色分成"信号"和"噪声"。
   *
   * 信号 = 占比 ≥ 25% 的颜色（"真正在主导"的那几块）。
   * 噪声 = 剩下的。
   * 比值 = 信号占比 / 噪声占比，用 "X : 1" 表示。
   * 四色均分时信号为 0、比值 0，正说明没有主色。
   */
  function snrReport(clusters, opts) {
    opts = opts || {};
    if (!clusters || !clusters.length) return null;

    var sorted = clusters.slice().sort(function (a, b) { return b.share - a.share; });

    // 信号 = 最大的那一块；噪声 = 其余全部。
    // 只看"主色压不压得住"，碎不碎另由有效色数反映。
    var main = sorted[0];
    var s = main.share;
    var n = Math.max(0, 1 - s);
    var ratio = n <= 1e-6 ? Infinity : s / n;

    var H = 0;
    sorted.forEach(function (c) {
      if (c.share > 0) H -= c.share * Math.log2(c.share);
    });

    var detail = sorted.map(function (c, i) {
      return {
        hex: c.hex,
        share: c.share,
        lab: c.lab || labOfHex(c.hex),
        role: i === 0 ? 'signal' : 'noise'
      };
    });

    var eff = Math.pow(2, H);
    var verdict;
    if (!isFinite(ratio)) verdict = '画面几乎是单一颜色，没有噪声。';
    else if (ratio >= 2) verdict = '主色压得住：最大一块占 ' + Math.round(s * 100) + '%，其余都在让位。';
    else if (ratio >= 1) verdict = '主次偏弱：最大一块占 ' + Math.round(s * 100) + '%，还撑得住场面。';
    else if (ratio >= 0.5) verdict = '偏碎：最大一块只占 ' + Math.round(s * 100) + '%，眼睛找不到重点。';
    else verdict = '很碎：最大一块只有 ' + Math.round(s * 100) + '%，远看会糊成一片。';

    if (eff > 3.5) verdict += ' 有效色数 ' + eff.toFixed(1) + '，颜色种类偏多。';

    return {
      signal: s,
      noise: n,
      ratio: ratio,
      ratioText: isFinite(ratio) ? ratio.toFixed(1) + ' : 1' : '∞ : 1',
      entropy: H,
      effectiveColors: eff,
      colors: detail,
      verdict: verdict
    };
  }


  // ---------------------------------------------------------------
  // 信噪比：画面里"想让人看的"和"全部信息"的比例
  // ---------------------------------------------------------------

  /**
   * 给一组色块打分：主色够不够压得住、色块是不是太碎、明度拉不拉得开。
   * 只看照片里抽出来的颜色，不涉及构图。
   */
  function noiseReport(clusters) {
    if (!clusters || !clusters.length) return null;

    var sorted = clusters.slice().sort(function (a, b) { return b.share - a.share; });
    var dominant = sorted[0].share;
    var big = sorted.filter(function (c) { return c.share >= 0.15; }).length;

    var lMin = Infinity, lMax = -Infinity;
    sorted.forEach(function (c) {
      if (c.lab && c.lab[0] < lMin) lMin = c.lab[0];
      if (c.lab && c.lab[0] > lMax) lMax = c.lab[0];
    });
    var lRange = isFinite(lMin) ? lMax - lMin : 0;

    var hues = {};
    sorted.forEach(function (c) {
      if (!c.lab) return;
      if (Math.hypot(c.lab[1], c.lab[2]) < 8) return;
      var h = Math.atan2(c.lab[2], c.lab[1]) * 180 / Math.PI;
      if (h < 0) h += 360;
      hues[Math.floor(h / 45)] = true;
    });
    var hueCount = Object.keys(hues).length;

    var lines = [];
    var level = 'ok';

    if (dominant < 0.45) {
      level = 'warn';
      lines.push('没有主色：最大的一块只占 ' + Math.round(dominant * 100) + '%，画面缺主次。');
    }

    if (big >= 4) {
      level = 'warn';
      lines.push('色块太碎：' + big + ' 块都超过 15%，焦点会被稀释。');
    }

    if (lRange < 25) {
      level = 'warn';
      lines.push('明度拉不开：最亮和最暗只差 ' + Math.round(lRange) + '，远看会糊成一片。');
    } else if (lRange > 70 && big >= 4) {
      lines.push('对比很强但信息多：让一个区域当主角，其余压下去。');
    }

    if (hueCount >= 5) {
      lines.push('用色 ' + hueCount + ' 个色系，颜色之间容易打架，建议收一收。');
    }

    if (!lines.length) {
      lines.push('主次清楚：主色 ' + Math.round(dominant * 100) + '%，明度差 ' +
        Math.round(lRange) + '，' + big + ' 个主要色块。');
    }

    return {
      dominant: dominant,
      bigBlocks: big,
      lRange: lRange,
      hueCount: hueCount,
      level: level,
      lines: lines
    };
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

  // 光照模块（engine-light.js）：只依赖下面这些核心函数
  var CORE = {
    labOfHex: labOfHex,
    labToSrgb: labToSrgb,
    rgbToHex: rgbToHex,
    linToSrgb: linToSrgb,
    mixSpectrum: mixSpectrum,
    paintNoise: paintNoise,
    paintOptics: paintOptics,
    paintKs: paintKs,
    rOfKs: rOfKs,
    measure: measure,
    xyzToLab: xyzToLab,
    hueAngle: hueAngle,
    deltaE00: deltaE00,
    DROP_ML: DROP_ML,
    PIGMENTS: PIGMENTS
  };

  var TintLight = (typeof module === 'object' && module.exports)
    ? require('./engine-light.js')
    : (typeof globalThis !== 'undefined' ? globalThis.TintLight : null);

  if (!TintLight) throw new Error('engine-light.js 没有加载（顺序：先 engine-light.js 再 engine.js）');
  var LIGHT = TintLight(CORE);

  return {
    PIGMENTS: PIGMENTS,
    BASE_PAINT: BASE_PAINT,
    PRESETS: PRESETS,
    solve: solve,
    nearestPaint: nearestPaint,
    estimateLight: LIGHT.estimateLight,
    noiseReport: noiseReport,
    snrReport: snrReport,
    layerReport: layerReport,
    mergeSimilar: mergeSimilar,
    freqSnr: freqSnr,
    segmentRegions: segmentRegions,
    colorRegions: colorRegions,
    lightReport: lightReport,
    regionLights: regionLights,
    nthValue: nthValue,
    shadeMap: shadeMap,
    rgb2lab: rgb2lab,
    regionSnr: regionSnr,
    bandSnr: bandSnr,
    colorfulness: colorfulness,
    colorEntropy: colorEntropy,
    centerBias: centerBias,
    castName: castName,
    metalName: metalName,
    shadeVariants: LIGHT.shadeVariants,
    litColor: LIGHT.litColor,
    tintRecipe: LIGHT.tintRecipe,
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
    PROCESS_CHAIN: PROCESS_CHAIN,
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
    paintOptics: paintOptics,
    paintNoise: paintNoise,
    measure: measure,
    setLib: setLib
  };
});
