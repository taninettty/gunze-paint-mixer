/*!
 * 调色台 — 光照模块
 *
 * 同一块漆，被不同光谱的光照亮，出来是不同的颜色。
 * 只做"光"这一层：黑体光谱、色适应、六张阴影/高光卡、原漆调法。
 *
 * 依赖 engine.js 传进来的核心函数。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.TintLight = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CORE) {
  'use strict';

  var labOfHex = CORE.labOfHex;
  var labToSrgb = CORE.labToSrgb;
  var rgbToHex = CORE.rgbToHex;
  var linToSrgb = CORE.linToSrgb;
  var mixSpectrum = CORE.mixSpectrum;
  var paintKs = CORE.paintKs;
  var rOfKs = CORE.rOfKs;
  var measure = CORE.measure;
  var xyzToLab = CORE.xyzToLab;
  var hueAngle = CORE.hueAngle;
  var deltaE00 = CORE.deltaE00;
  var DROP_ML = CORE.DROP_ML;
  var PIGMENTS = CORE.PIGMENTS;

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
    // 风格：physical 按光谱老实算；art 在光谱结果上再加一层美术夸张
    var style = opts.style === 'art' ? 'art' : 'physical';

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
      // 美术风：不做"按角度转色相"，直接换成画师会用的那个色相
      //   高光 → 暖黄；阴影 → 紫（暖阴影 → 棕）
      //   物理上不成立，但 v1.6 的效果就是这样，看着对
      if (style === 'art') {
        var baseC = Math.hypot(baseLab[1], baseLab[2]);
        var baseHue = Math.atan2(baseLab[2], baseLab[1]) * 180 / Math.PI;
        if (baseHue < 0) baseHue += 360;
        var hueT;
        if (dL > 0) {
          // 高光：只往暖端挪 20°，红还是红、蓝还是蓝
          var d = ((70 - baseHue + 540) % 360) - 180;
          hueT = baseHue + (d > 0 ? 1 : -1) * Math.min(Math.abs(d), 20);
        } else {
          // 阴影：直接换成画师会用的那个色相（紫/棕），它不是"转"出来的
          hueT = id === 'sh-warm' ? 45 : 305;
        }
        var cT = Math.min(baseC * 1.1, dL > 0 ? 46 : 30);
        if (cT < 6) cT = dL > 0 ? 6 : 8;
        var hRad = hueT * Math.PI / 180;
        lab[1] = cT * Math.cos(hRad);
        lab[2] = cT * Math.sin(hRad);
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

  return {
    litColor: litColor,
    estimateLight: estimateLight,
    shadeVariants: shadeVariants,
    tintRecipe: tintRecipe
  };
});
