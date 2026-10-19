/*!
 * 调色台 — 喷涂知识内容
 *
 * 这里只放内容（HTML 片段），不放逻辑。
 * 想改文案、加一条知识、改一张图，直接改对应段落即可，不用碰 index.html。
 *
 * 三个键：
 *   airbrush  器材：喷笔解剖、气泵、气泵类型、电磁泵
 *   spray     实务：稀释、手法、环境、保养
 *   fail      翻车急救：正常漆面 + 八种缺陷
 */
var KB_DATA = {
  airbrush: `<div class="ab-head">
      <h3>喷笔是怎么把漆喷出来的</h3>
      <button type="button" class="ab-trigger" id="abTrigger">按住扳机</button>
    </div>

    <svg viewBox="0 0 900 360" class="ab-svg" id="abSvg" role="img" aria-label="喷笔结构剖面图">
      <defs>
        <linearGradient id="abBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F5F1E8"/>
          <stop offset=".55" stop-color="#E3DCCD"/>
          <stop offset="1" stop-color="#CEC5B4"/>
        </linearGradient>
        <linearGradient id="abCup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#EFE9DD"/>
          <stop offset="1" stop-color="#D6CCB9"/>
        </linearGradient>
        <linearGradient id="abPaintGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#D9722F"/>
          <stop offset="1" stop-color="#A8401A"/>
        </linearGradient>
        <linearGradient id="abAir" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#9FC6DE"/>
          <stop offset="1" stop-color="#6AA6C9"/>
        </linearGradient>
        <radialGradient id="abMist" cx="0" cy=".5" r="1">
          <stop offset="0" stop-color="#D9722F" stop-opacity=".45"/>
          <stop offset="1" stop-color="#D9722F" stop-opacity="0"/>
        </radialGradient>
        <clipPath id="cupClip">
          <path d="M306 52 H372 L356 128 H322 Z"/>
        </clipPath>
        <marker id="abArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#B4530A"/>
        </marker>
        <marker id="abArrowG" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#2F7D4F"/>
        </marker>
        <marker id="abArrowB" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#5C9BC4"/>
        </marker>
      </defs>

      <!-- ===== 气路：软管 → 气阀 → 笔身气道 → 喷嘴 ===== -->
      <path d="M96 268 C176 268 300 262 396 232" stroke="url(#abAir)" stroke-width="13"
            fill="none" stroke-linecap="round"/>
      <text x="78" y="296" class="ab-lb">气泵软管</text>

      <!-- 气阀 -->
      <rect x="386" y="196" width="30" height="40" rx="6" fill="#AED0E3" stroke="#84AEC6"/>
      <circle cx="401" cy="216" r="8" fill="#EAF4FA" stroke="#84AEC6"/>
      <text x="360" y="258" class="ab-lb">气阀</text>


      <!-- ===== 笔身 ===== -->
      <rect x="236" y="128" width="372" height="58" rx="16" fill="url(#abBody)" stroke="#B9B0A0"/>
      <!-- 扳机（在笔身上方，按下去压气阀、后拉带针） -->
      <path id="abTriggerRect" d="M396 118 h22 v26 c6 8 6 20 0 28 h-22 c-6 -8 -6 -20 0 -28 Z"
            fill="#9AA3AC" stroke="#7C858E"/>
      <text x="372" y="106" class="ab-lb">扳机</text>


      <!-- 笔身内的气道（从气阀向前到喷嘴） -->
      <path d="M401 196 V170 H600" stroke="#BBD8E8" stroke-width="9" fill="none"/>
      <path d="M401 196 V170 H600" stroke="#8FC0DA" stroke-width="4" fill="none" opacity=".65"/>

      <!-- 尾调 -->
      <rect x="212" y="146" width="26" height="22" rx="5" fill="#C9BFAE" stroke="#A79C88"/>
      <text x="176" y="140" class="ab-lb">尾调</text>

      <!-- ===== 漆杯 ===== -->
      <path d="M306 52 H372 L356 128 H322 Z" fill="url(#abCup)" stroke="#B9B0A0"/>
      <g clip-path="url(#cupClip)">
        <rect class="ab-liquid" x="300" y="74" width="80" height="60" fill="url(#abPaintGrad)"/>
        <ellipse cx="339" cy="74" rx="34" ry="5" fill="#E58A45" opacity=".85"/>
      </g>
      <text x="300" y="38" class="ab-lb">漆杯</text>

      <!-- 漆针 -->
      <g id="abNeedle">
        <line x1="238" y1="157" x2="586" y2="157" stroke="#8A929B" stroke-width="4" stroke-linecap="round"/>
        <polygon points="586,151 606,157 586,163" fill="#8A929B"/>
      </g>
      <text x="470" y="184" class="ab-lb">漆针</text>

      <!-- ===== 喷嘴 ===== -->
      <polygon points="604,141 632,157 604,173" fill="#C9BFAE" stroke="#A79C88"/>
      <path d="M604 136 q14 21 0 42" stroke="#8FA7B6" stroke-width="3" fill="none" opacity=".8"/>
      <text x="612" y="124" class="ab-lb">喷嘴</text>

      <!-- 喷幅 -->
      <g class="ab-spray-air" opacity=".55">
        <polygon points="634,157 790,96 790,218" fill="url(#abMist)"/>
      </g>

      <!-- ===== 气流粒子（一直在跑） ===== -->
      <g class="ab-air">
        <circle r="3.6" fill="#4E93BC">
          <animateMotion dur="2.4s" repeatCount="indefinite"
            path="M96,268 C176,268 300,262 396,232 L401,196 L401,170 L600,157"/>
        </circle>
        <circle r="3.6" fill="#4E93BC">
          <animateMotion dur="2.4s" begin="-0.8s" repeatCount="indefinite"
            path="M96,268 C176,268 300,262 396,232 L401,196 L401,170 L600,157"/>
        </circle>
        <circle r="3.6" fill="#4E93BC">
          <animateMotion dur="2.4s" begin="-1.6s" repeatCount="indefinite"
            path="M96,268 C176,268 300,262 396,232 L401,196 L401,170 L600,157"/>
        </circle>
      </g>

      <!-- ===== 漆流（按扳机才出现） ===== -->
      <g class="ab-paint" id="abPaint" display="none">
        <circle r="3.4" fill="#C8552A">
          <animateMotion dur="1.1s" repeatCount="indefinite" path="M339,118 L339,157 L596,157"/>
        </circle>
        <circle r="3.4" fill="#C8552A">
          <animateMotion dur="1.1s" begin="-0.37s" repeatCount="indefinite" path="M339,118 L339,157 L596,157"/>
        </circle>
        <circle r="3.4" fill="#C8552A">
          <animateMotion dur="1.1s" begin="-0.74s" repeatCount="indefinite" path="M339,118 L339,157 L596,157"/>
        </circle>

        <!-- 雾化粒子：扇形散开 -->
        <g class="ab-mist">
          <circle r="2.4" fill="#C8552A"><animateMotion dur=".8s" repeatCount="indefinite" path="M640,157 L780,104"/></circle>
          <circle r="2.2" fill="#C8552A"><animateMotion dur=".8s" begin="-.12s" repeatCount="indefinite" path="M640,157 L784,124"/></circle>
          <circle r="2.4" fill="#C8552A"><animateMotion dur=".8s" begin="-.24s" repeatCount="indefinite" path="M640,157 L786,146"/></circle>
          <circle r="2" fill="#C8552A"><animateMotion dur=".8s" begin="-.36s" repeatCount="indefinite" path="M640,157 L784,170"/></circle>
          <circle r="2.4" fill="#C8552A"><animateMotion dur=".8s" begin="-.48s" repeatCount="indefinite" path="M640,157 L778,192"/></circle>
          <circle r="2" fill="#C8552A"><animateMotion dur=".8s" begin="-.6s" repeatCount="indefinite" path="M640,157 L766,210"/></circle>
          <circle r="1.8" fill="#C8552A"><animateMotion dur=".8s" begin="-.18s" repeatCount="indefinite" path="M640,157 L760,132"/></circle>
          <circle r="1.8" fill="#C8552A"><animateMotion dur=".8s" begin="-.54s" repeatCount="indefinite" path="M640,157 L758,182"/></circle>
        </g>
      </g>
    </svg>

    <div class="ab-caption" id="abCaption">没按扳机：气在走，漆被针挡住出不来</div>

    <div class="ab-detail">
      <h4>先分清三种供漆方式</h4>
      <table class="ab-table">
        <thead><tr><th>类型</th><th>漆杯位置</th><th>怎么供漆</th><th>适合</th></tr></thead>
        <tbody>
          <tr><td>重力式</td><td>笔身上方</td><td>重力 + 喷嘴负压</td><td>模型最常用，省漆、好洗、低气压也能喷</td></tr>
          <tr><td>虹吸式</td><td>笔身下方</td><td>全靠负压吸</td><td>大量喷涂，需要较高气压</td></tr>
          <tr><td>侧壶式</td><td>笔身侧面</td><td>重力 + 可旋转</td><td>少量、要转角度喷死角</td></tr>
        </tbody>
      </table>

      <h4>逐件拆开看</h4>

      <div class="ab-cards">
        <article>
          <h5>① 漆杯</h5>

      <svg class="ab-fig" viewBox="0 0 160 90" aria-hidden="true">
        <path d="M46 12 H114 L106 60 H54 Z" fill="#F3EDE1" stroke="#B9B0A0" stroke-width="1.4"/>
        <path d="M50 30 H110 L104 58 H56 Z" fill="#D9722F" opacity=".85"/>
        <ellipse cx="80" cy="30" rx="30" ry="3.4" fill="#E58A45"/>
        <path d="M80 64 V80" stroke="#B4530A" stroke-width="1.6" marker-end="url(#abArrow)"/>
        <text x="84" y="78" class="ab-fig-t">重力</text>
      </svg>
          <p><b>作用</b>　储漆，靠重力把漆送到笔身底部。</p>
          <p><b>细节</b>　常见 7 / 10 / 15 毫升。杯壁刻度只能参考，不同漆密度不一样。带盖的杯子能防止溶剂挥发，喷到一半停下来也不至于结皮。</p>
          <p><b>出问题</b>　杯底残留旧漆 → 下次喷出颗粒；杯口没盖 → 漆面结皮，掉进漆里堵笔。</p>
        </article>

        <article>
          <h5>② 笔身漆道</h5>

      <svg class="ab-fig" viewBox="0 0 160 90" aria-hidden="true">
        <rect x="10" y="34" width="140" height="30" rx="10" fill="#F0EBE1" stroke="#B9B0A0" stroke-width="1.4"/>
        <rect x="66" y="8" width="14" height="26" fill="#EFE9DD" stroke="#B9B0A0" stroke-width="1.2"/>
        <path d="M73 12 V34" stroke="#D9722F" stroke-width="5" opacity=".55"/>
        <path d="M46 49 H132" stroke="#D9722F" stroke-width="7" stroke-linecap="round" opacity=".8"/>
        <circle cx="60" cy="49" r="2.6" fill="#fff"/>
        <circle cx="86" cy="49" r="2.6" fill="#fff"/>
        <circle cx="112" cy="49" r="2.6" fill="#fff"/>
        <text x="12" y="26" class="ab-fig-t">从漆杯下来</text>
        <text x="112" y="26" class="ab-fig-t">去喷嘴</text>
      </svg>
          <p><b>作用</b>　把漆从杯底引到喷嘴，是一条很细的内部通道。</p>
          <p><b>细节</b>　通道直径通常不到 1 毫米，转弯处最容易积漆。洗笔时稀释剂要能从杯口一路流到喷嘴口，才算洗干净。</p>
          <p><b>出问题</b>　通道里有干漆 → 出漆断续、带渣、越喷越小。</p>
        </article>

        <article>
          <h5>③ 漆针</h5>

      <svg class="ab-fig" viewBox="0 0 160 90" aria-hidden="true">
        <rect x="118" y="26" width="12" height="38" rx="3" fill="#C9BFAE" stroke="#A79C88" stroke-width="1.2"/>
        <line x1="24" y1="45" x2="110" y2="45" stroke="#8A929B" stroke-width="3.4" stroke-linecap="round"/>
        <polygon points="110,41 120,45 110,49" fill="#8A929B"/>
        <path d="M64 16 H34" stroke="#B4530A" stroke-width="1.5" marker-end="url(#abArrow)"/>
        <text x="68" y="20" class="ab-fig-t">后拉</text>
        <circle cx="121" cy="45" r="4" fill="none" stroke="#B4530A" stroke-dasharray="2 2"/>
        <text x="16" y="66" class="ab-fig-t">顶住 = 不出漆</text>
      </svg>
          <p><b>作用</b>　顶住喷嘴堵住漆路；后退多少，出漆就有多少。</p>
          <p><b>细节</b>　一根前端带锥度的细钢针，直径通常 0.2–0.3 毫米。针尖必须和喷嘴孔完全同心，轻微弯一点就会偏喷。</p>
          <p><b>出问题</b>　针尖弯 → 偏喷、滴漆；针身有干漆 → 拉动发涩、出漆忽大忽小；针尖磨损 → 关不死，一直滴。</p>
        </article>

        <article>
          <h5>④ 喷嘴</h5>

      <svg class="ab-fig" viewBox="0 0 160 90" aria-hidden="true">
        <polygon points="34,18 92,45 34,72" fill="#C9BFAE" stroke="#A79C88" stroke-width="1.3"/>
        <rect x="92" y="41" width="7" height="8" fill="#7C858E"/>
        <path d="M92 76 H99" stroke="#8B8478" stroke-width="1"/>
        <path d="M92 73 V79 M99 73 V79" stroke="#8B8478" stroke-width="1"/>
        <text x="78" y="88" class="ab-fig-t">0.3 mm</text>
        <circle cx="112" cy="38" r="1.8" fill="#C8552A" opacity=".7"/>
        <circle cx="120" cy="45" r="1.6" fill="#C8552A" opacity=".6"/>
        <circle cx="112" cy="52" r="1.8" fill="#C8552A" opacity=".7"/>
        <text x="16" y="16" class="ab-fig-t">最小、最贵、别捅</text>
      </svg>
          <p><b>作用</b>　最细的那个孔，决定线宽和雾化质量。</p>
          <p><b>细节</b>　0.2 / 0.3 / 0.5 毫米是常见规格。喷嘴、漆针、气帽是<b>三件配套</b>的一组，不能混着换——0.3 的针配 0.2 的喷嘴，针会顶不到底。</p>
          <p><b>出问题</b>　堵 → 喷不出或偏喷；用针捅过 → 孔被扩，雾化永久变粗，只能换。</p>
        </article>

        <article>
          <h5>⑤ 气帽（喷嘴帽）</h5>

      <svg class="ab-fig" viewBox="0 0 160 90" aria-hidden="true">
        <circle cx="60" cy="45" r="10" fill="#C9BFAE" stroke="#A79C88" stroke-width="1.2"/>
        <circle cx="60" cy="45" r="3.2" fill="#7C858E"/>
        <circle cx="60" cy="45" r="24" fill="none" stroke="#84AEC6" stroke-dasharray="3 3" stroke-width="1.4"/>
        <path d="M14 22 L46 37" stroke="#5C9BC4" stroke-width="1.6" marker-end="url(#abArrowB)"/>
        <path d="M14 68 L46 53" stroke="#5C9BC4" stroke-width="1.6" marker-end="url(#abArrowB)"/>
        <path d="M106 45 L88 45" stroke="#5C9BC4" stroke-width="1.6" marker-end="url(#abArrowB)"/>
        <path d="M96 20 L74 36" stroke="#5C9BC4" stroke-width="1.6" marker-end="url(#abArrowB)"/>
        <path d="M60 82 V62" stroke="#5C9BC4" stroke-width="1.6" marker-end="url(#abArrowB)"/>
        <text x="12" y="14" class="ab-fig-t">四路气汇到口部</text>
      </svg>
          <p><b>作用</b>　把压缩空气导向喷嘴口，形成一圈高速气流。</p>
          <p><b>细节</b>　气帽中间的环形缝隙决定负压强度。有的气帽能旋动调节喷幅（扇形/圆形）。</p>
          <p><b>出问题</b>　气帽小孔堵了 → 偏喷（一边有漆一边没有）、喷出来是斜的。这是「偏喷」最常见的原因，不是喷嘴坏。</p>
        </article>

        <article>
          <h5>⑥ 扳机</h5>

      <svg class="ab-fig" viewBox="0 0 160 90" aria-hidden="true">
        <line x1="18" y1="30" x2="146" y2="30" stroke="#B9B0A0" stroke-width="2"/>
        <path d="M64 20 h18 v18 c5 7 5 16 0 22 h-18 c-5 -6 -5 -15 0 -22 Z" fill="#9AA3AC" stroke="#7C858E" stroke-width="1.2"/>
        <path d="M40 26 V56" stroke="#B4530A" stroke-width="1.6" marker-end="url(#abArrow)"/>
        <text x="22" y="68" class="ab-fig-t">下压＝出气</text>
        <path d="M112 52 H88" stroke="#2F7D4F" stroke-width="1.6" marker-end="url(#abArrowG)"/>
        <text x="108" y="68" class="ab-fig-t">后拉＝出漆</text>
      </svg>
          <p><b>作用</b>　两段行程：<b>下压</b>打开气阀，<b>后拉</b>带动漆针。</p>
          <p><b>细节</b>　双动笔这两段独立，可以先吹气再出漆；单动笔按下就同时出气和漆。松手时先关漆、后关气，能避免残漆滴在模型上。</p>
          <p><b>出问题</b>　行程发涩 → 出漆忽大忽小；O 圈干涩 → 回弹慢、关不严。</p>
        </article>

        <article>
          <h5>⑦ 气阀</h5>

      <svg class="ab-fig" viewBox="0 0 160 90" aria-hidden="true">
        <rect x="52" y="34" width="46" height="30" rx="7" fill="#AED0E3" stroke="#84AEC6" stroke-width="1.3"/>
        <rect x="70" y="14" width="8" height="22" fill="#9AA3AC"/>
        <path d="M74 40 v18" stroke="#7C858E" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="74" cy="62" r="3.4" fill="#EAF4FA" stroke="#84AEC6"/>
        <path d="M12 49 H52" stroke="#8FC0DA" stroke-width="5" stroke-linecap="round"/>
        <path d="M98 49 H140" stroke="#8FC0DA" stroke-width="5" stroke-linecap="round"/>
        <path d="M86 20 V34" stroke="#B4530A" stroke-width="1.5" marker-end="url(#abArrow)"/>
        <text x="12" y="82" class="ab-fig-t">进气</text>
        <text x="116" y="82" class="ab-fig-t">进笔身</text>
      </svg>
          <p><b>作用</b>　扳机下压时打开，压缩空气才进笔身。</p>
          <p><b>细节</b>　弹簧 + 阀杆 + O 圈，在扳机正下方。软管的气从这里进，再沿笔身内部气道走到气帽。</p>
          <p><b>出问题</b>　O 圈老化 → 漏气、气压不稳、一直出气；阀杆卡住 → 按下没反应。</p>
        </article>

        <article>
          <h5>⑧ 尾调</h5>

      <svg class="ab-fig" viewBox="0 0 160 90" aria-hidden="true">
        <rect x="10" y="34" width="22" height="24" rx="4" fill="#C9BFAE" stroke="#A79C88" stroke-width="1.2"/>
        <path d="M14 34 V58 M19 34 V58 M24 34 V58 M29 34 V58" stroke="#A79C88" stroke-width=".8"/>
        <line x1="32" y1="46" x2="66" y2="46" stroke="#8A929B" stroke-width="2.4"/>
        <rect x="66" y="36" width="9" height="20" rx="2" fill="#9AA3AC"/>
        <line x1="75" y1="46" x2="140" y2="46" stroke="#8A929B" stroke-width="3"/>
        <polygon points="140,42 150,46 140,50" fill="#8A929B"/>
        <path d="M96 24 H78" stroke="#B4530A" stroke-width="1.5" marker-end="url(#abArrow)"/>
        <text x="86" y="20" class="ab-fig-t">行程被限住</text>
        <text x="12" y="76" class="ab-fig-t">拧紧＝出漆小</text>
      </svg>
          <p><b>作用</b>　限制漆针后退的最大行程，用来定「最大出漆量」。</p>
          <p><b>细节</b>　拧紧 = 针退得少 = 出漆小；拧松 = 出漆大。做细节时先拧到很小，靠扳机微调，不容易一次喷多。</p>
          <p><b>出问题</b>　拧太紧 → 后拉没反应，会误以为堵了。</p>
        </article>
      </div>

      <h4>原理：三步</h4>
      <div class="ab-steps">
        <div>
          <b>① 负压吸漆</b>
          <p>压缩空气从气帽的环形缝隙高速冲出，喷嘴口气压下降形成负压。漆杯里的漆被大气压压着，就从漆道被吸到喷嘴口——这就是文丘里效应。漆杯越高、密封越好，吸得越稳。</p>
        </div>
        <div>
          <b>② 气流撕碎成雾</b>
          <p>漆一碰到高速气流就被撕成细滴。液滴越细，漆面越平滑。影响它的三件事：气流速度（气压）、漆的黏度（稀释比例）、表面张力（稀释剂种类）。太稠撕不碎 → 粗点拉丝；太稀 → 流挂盖不住。</p>
        </div>
        <div>
          <b>③ 出漆量和气压要匹配</b>
          <p>针退得越多，漆流越大。但气流能带走的漆有限：超过这个量就喷粗点甚至拉丝。所以调的时候两件事一起动——<b>漆稠了加气压，漆稀了减出漆</b>，只动一样永远调不好。</p>
        </div>
      </div>

      <h4>口径怎么选</h4>
      <table class="ab-table">
        <thead><tr><th>口径</th><th>线宽</th><th>常用气压</th><th>稀释</th><th>适合</th></tr></thead>
        <tbody>
          <tr><td>0.2 mm</td><td>0.5–1 mm</td><td>1–1.5 bar</td><td>1 : 2</td><td>细节、边角、水贴边缘</td></tr>
          <tr><td>0.3 mm</td><td>1–2 mm</td><td>1.5–2 bar</td><td>1 : 1.5–2</td><td>通用，一支走天下</td></tr>
          <tr><td>0.4 mm</td><td>2–4 mm</td><td>2–2.5 bar</td><td>1 : 1–1.5</td><td>补土、大面积</td></tr>
          <tr><td>0.5 mm</td><td>3–8 mm</td><td>2–3 bar</td><td>1 : 1</td><td>车壳、大件、金属漆</td></tr>
        </tbody>
      </table>

      <h4>部件 vs 故障</h4>
      <table class="ab-table">
        <thead><tr><th>症状</th><th>先查哪里</th></tr></thead>
        <tbody>
          <tr><td>偏喷，一边有漆一边没有</td><td>气帽小孔堵了（最常见），其次针尖弯</td></tr>
          <tr><td>出漆断续、越喷越小</td><td>漆道有干漆，或者漆太稠</td></tr>
          <tr><td>停手后一直滴漆</td><td>针尖没顶严、针尖磨损、喷嘴口有干漆</td></tr>
          <tr><td>按下扳机没反应</td><td>气阀卡住 / 尾调拧太紧 / 喷嘴全堵</td></tr>
          <tr><td>雾化变粗、颗粒大</td><td>气压不足、漆太稠、或者喷嘴被捅扩过孔</td></tr>
          <tr><td>一直漏气</td><td>气阀 O 圈老化</td></tr>
        </tbody>
      </table>

      <div class="ab-principle">
        <h4>为什么双动笔要先气后漆</h4>
        <p>
          先出气可以把表面灰尘吹走，也能先确认雾化正常；停手时先关漆再关气，喷嘴口不会积着一坨漆往下滴。
          用熟了就是条件反射——按下 → 后拉 → 松漆 → 松气。
        </p>
      </div>
      </div>

      <h4>气泵：从电机到喷嘴</h4>
      <p class="sd-lead">
        整条链是：<b>电机转 → 曲轴把旋转变成往复 → 活塞压缩空气 → 单向阀 → 储气罐稳压 → 压力开关控制启停 → 调压阀定输出 → 水隔除水 → 喷笔</b>。
      </p>

      <svg viewBox="0 0 900 360" class="ab-fig" style="height:320px" aria-hidden="true">
        <rect x="36" y="52" width="92" height="72" rx="10" fill="#F0EBE1" stroke="#B9B0A0" stroke-width="1.4"/>
        <g stroke="#9AA3AC" stroke-width="1.6" fill="none">
          <path d="M56 66 q14 22 0 44"/>
          <path d="M74 66 q14 22 0 44"/>
          <path d="M92 66 q14 22 0 44"/>
        </g>
        <circle cx="118" cy="88" r="4" fill="#9AA3AC"/>
        <text x="44" y="146" class="ab-fig-t">电机</text>

        <line x1="128" y1="88" x2="170" y2="88" stroke="#8A929B" stroke-width="4"/>

        <circle cx="196" cy="88" r="22" fill="#E8E2D8" stroke="#A79C88" stroke-width="1.4"/>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0 196 88" to="360 196 88" dur="1.6s" repeatCount="indefinite"/>
          <line x1="196" y1="88" x2="208" y2="74" stroke="#7C858E" stroke-width="3"/>
          <circle cx="208" cy="74" r="4" fill="#7C858E"/>
        </g>
        <text x="176" y="146" class="ab-fig-t">曲轴</text>

        <line x1="208" y1="74" x2="268" y2="104" stroke="#9AA3AC" stroke-width="4" stroke-linecap="round"/>

        <rect x="262" y="66" width="104" height="66" rx="6" fill="#F3EDE1" stroke="#B9B0A0" stroke-width="1.4"/>
        <rect x="286" y="76" width="34" height="46" rx="4" fill="#9AA3AC">
          <animate attributeName="y" values="76;86;76" dur="1.6s" repeatCount="indefinite"/>
        </rect>
        <text x="272" y="150" class="ab-fig-t">气缸 / 活塞</text>

        <path d="M366 74 H400" stroke="#8FC0DA" stroke-width="5" stroke-linecap="round"/>
        <text x="330" y="52" class="ab-fig-t">排气</text>

        <path d="M400 74 V250 H420" stroke="#8FC0DA" stroke-width="5" fill="none" stroke-linecap="round"/>

        <polygon points="424,238 448,250 424,262" fill="#C9BFAE" stroke="#A79C88" stroke-width="1.2"/>
        <line x1="448" y1="238" x2="448" y2="262" stroke="#A79C88" stroke-width="2"/>
        <text x="404" y="296" class="ab-fig-t">单向阀</text>

        <rect x="470" y="216" width="130" height="68" rx="34" fill="#DCE7EE" stroke="#8FB3C9" stroke-width="1.4"/>
        <circle cx="506" cy="250" r="16" fill="#fff" stroke="#8FB3C9" stroke-width="1.4"/>
        <line x1="506" y1="250" x2="516" y2="242" stroke="#B4530A" stroke-width="1.8"/>
        <rect x="530" y="186" width="50" height="30" rx="6" fill="#F0EBE1" stroke="#B9B0A0" stroke-width="1.3"/>
        <circle cx="555" cy="201" r="8" fill="#9AA3AC"/>
        <text x="484" y="296" class="ab-fig-t">储气罐 + 压力开关</text>

        <rect x="620" y="228" width="44" height="44" rx="6" fill="#F0EBE1" stroke="#B9B0A0" stroke-width="1.3"/>
        <rect x="634" y="210" width="16" height="18" fill="#B4530A"/>
        <text x="614" y="296" class="ab-fig-t">调压阀</text>

        <path d="M700 222 h44 v34 l-22 26 l-22 -26 Z" fill="#E8F2F8" stroke="#8FB3C9" stroke-width="1.3"/>
        <path d="M700 258 h44" stroke="#8FB3C9" stroke-width="1.2"/>
        <text x="690" y="296" class="ab-fig-t">水隔</text>

        <path d="M744 250 C770 250 776 236 800 236" stroke="#8FC0DA" stroke-width="5" fill="none" stroke-linecap="round"/>
        <rect x="804" y="226" width="66" height="20" rx="9" fill="#EFE9DD" stroke="#B9B0A0" stroke-width="1.3"/>
        <polygon points="870,226 882,236 870,246" fill="#C9BFAE"/>
        <text x="806" y="296" class="ab-fig-t">喷笔</text>

        <g stroke="#8FC0DA" stroke-width="5" fill="none" stroke-linecap="round">
          <path d="M450 250 H468"/><path d="M600 250 H618"/><path d="M664 250 H698"/>
        </g>

        <circle r="3.2" fill="#4E93BC">
          <animateMotion dur="6s" repeatCount="indefinite" path="M366,74 H400 V250 H420"/>
          <animate attributeName="opacity" values="0;1;1;0" dur="6s" repeatCount="indefinite"/>
        </circle>
        <circle r="3.2" fill="#4E93BC">
          <animateMotion dur="3.4s" begin="-1.2s" repeatCount="indefinite" path="M452,250 H800"/>
        </circle>
        <circle r="3.2" fill="#4E93BC">
          <animateMotion dur="3.4s" begin="-2.4s" repeatCount="indefinite" path="M452,250 H800"/>
        </circle>
      </svg>

      <div class="ab-cards">
        <article>
          <h5>⓪ 电机：动力来源</h5>
          <p><b>作用</b>　带动曲轴旋转，是所有动作的起点。</p>
          <p><b>细节</b>　模型用气泵多为 1/5–1/3 马力。直驱（电机轴直接连曲轴）最常见，便宜但抖动大；皮带传动更静音。</p>
          <p><b>出问题</b>　碳刷磨损 → 转速掉、打不上压；散热差 → 烫手、自动保护停机。</p>
        </article>

        <article>
          <h5>① 曲轴 + 连杆：旋转变往复</h5>
          <p><b>作用</b>　把电机的<b>旋转</b>变成活塞的<b>上下往复</b>。</p>
          <p><b>细节</b>　曲轴偏心量决定活塞行程，行程 × 缸径决定排气量。</p>
          <p><b>出问题</b>　连杆轴承旷 → 噪音变大、敲缸，排气量下降。</p>
        </article>

        <article>
          <h5>② 活塞 + 气缸：压缩</h5>
          <p><b>作用</b>　下行吸气，上行把空气压进管路。</p>
          <p><b>关键</b>　往复式出气天生是脉动的，单靠它供气会一道一道。</p>
          <p><b>出问题</b>　活塞环磨损 → 打不上压、一直转不停。</p>
        </article>

        <article>
          <h5>③ 单向阀：不让气倒流</h5>
          <p><b>作用</b>　只允许气往罐里走。</p>
          <p><b>细节</b>　活塞回程时管内压力高，没有它会倒灌回气缸。</p>
          <p><b>出问题</b>　阀片脏或老化 → 关机掉压快、频繁启动。</p>
        </article>

        <article>
          <h5>④ 储气罐：把脉动抹平</h5>
          <p><b>作用</b>　吸收活塞脉动，出气才平稳。</p>
          <p><b>细节</b>　罐越大越稳，充气也越久。模型用 3–6 升够用。</p>
          <p><b>出问题</b>　无罐直连 → 喷出来一顿一顿，还容易积水。</p>
        </article>

        <article>
          <h5>⑤ 压力开关：自动启停</h5>
          <p><b>作用</b>　罐压掉到下限启动，到上限停止。</p>
          <p><b>细节</b>　一般 3–4 bar 启停，再由调压阀降到 1.5–2 bar 用。</p>
          <p><b>出问题</b>　启停过于频繁 → 漏气或罐太小。</p>
        </article>

        <article>
          <h5>⑥ 调压阀：决定手上的气压</h5>
          <p><b>作用</b>　把罐内高压降到你要的输出并稳住。</p>
          <p><b>细节</b>　罐压高、输出低才稳；表上读的是输出压力。</p>
          <p><b>出问题</b>　坏了 → 气压忽高忽低，漆面一会粗一会流挂。</p>
        </article>

        <article>
          <h5>⑦ 水隔：把水挡在笔外</h5>
          <p><b>作用</b>　空气压缩后会析水，水隔靠离心加滤芯分离。</p>
          <p><b>细节</b>　必须装在调压阀之后、软管之前。</p>
          <p><b>出问题</b>　忘了放水 → 白点、鱼眼，还总在漆快干时出现。</p>
        </article>
      </div>

            <h4>气泵有哪几种</h4>
      <p class="sd-lead">
        上面画的只是最常见的一种（无油活塞 + 储气罐）。市面上还有几类，原理不同，适合的场景也不一样。
      </p>

      <table class="ab-table">
        <thead><tr><th>类型</th><th>原理</th><th>噪音</th><th>出气</th><th>适合</th></tr></thead>
        <tbody>
          <tr><td>无油活塞（直驱）</td><td>电机直连曲轴，活塞往复</td><td>大 70–85 dB</td><td>有脉动，需罐</td><td>入门、预算低、能忍受噪音</td></tr>
          <tr><td>有油活塞</td><td>同上，但缸内有润滑油</td><td>中 65–75 dB</td><td>较平稳</td><td>耐用、长时间工作</td></tr>
          <tr><td>静音活塞</td><td>低转速 + 大缸径 + 隔音罩</td><td>小 30–45 dB</td><td>平稳</td><td>家里用、晚上喷</td></tr>
          <tr><td>隔膜式</td><td>橡胶膜片往复，无油</td><td>小 40–55 dB</td><td>流量小</td><td>喷笔套装、小面积、偶尔用</td></tr>
          <tr><td>电磁式（电磁泵）</td><td>线圈吸动衔铁，50 Hz 往复</td><td>小 45–60 dB（嗡嗡声）</td><td>脉动明显，必须配罐</td><td>喷笔套装、小件、静音要求一般</td></tr>
          <tr><td>涡旋式</td><td>两个螺旋盘相对运动压缩</td><td>很小 35–45 dB</td><td>连续平稳</td><td>高端、长时间连续喷</td></tr>
          <tr><td>冰箱压缩机改装</td><td>拆制冷压缩机 + 罐 + 过滤</td><td>很小 35–45 dB</td><td>平稳但流量小</td><td>DIY、性价比高</td></tr>
          <tr><td>气罐 / CO₂</td><td>预充压缩气体，无电机</td><td>无</td><td>恒定，但会衰减</td><td>应急、外出、无电源</td></tr>
        </tbody>
      </table>

      <h4>电磁泵是怎么工作的</h4>
      <p class="sd-lead">
        没有电机、没有曲轴、没有碳刷。它靠<b>市电本身的频率</b>在往复——插上电就一直以每秒 50 次的节奏在动。
      </p>

      <svg viewBox="0 0 900 300" class="ab-fig" style="height:300px" aria-hidden="true">
        <!-- 交流电 -->
        <path d="M40 70 q18 -26 36 0 t36 0 t36 0" stroke="#B4530A" stroke-width="2" fill="none"/>
        <text x="46" y="96" class="ab-fig-t">交流 50 Hz</text>
        <path d="M56 70 V108" stroke="#B4530A" stroke-width="2"/>
        <path d="M120 70 V108" stroke="#B4530A" stroke-width="2"/>

        <!-- 线圈 -->
        <rect x="150" y="112" width="112" height="92" rx="6" fill="#E8E2D8" stroke="#A79C88" stroke-width="1.4"/>
        <g stroke="#A79C88" stroke-width="1.1">
          <path d="M162 120 v76"/><path d="M174 120 v76"/><path d="M186 120 v76"/>
          <path d="M198 120 v76"/><path d="M210 120 v76"/><path d="M222 120 v76"/>
          <path d="M234 120 v76"/><path d="M246 120 v76"/>
        </g>
        <path d="M150 112 H262" stroke="#8A929B" stroke-width="2"/>
        <text x="160" y="232" class="ab-fig-t">线圈</text>

        <!-- 衔铁（上下振动） -->
        <rect x="158" y="88" width="96" height="16" rx="3" fill="#9AA3AC">
          <animate attributeName="y" values="88;100;88" dur="0.5s" repeatCount="indefinite"/>
        </rect>
        <text x="184" y="82" class="ab-fig-t">衔铁</text>

        <!-- 推杆 -->
        <path d="M254 96 H300" stroke="#7C858E" stroke-width="4">
          <animate attributeName="y1" values="96;108;96" dur="0.5s" repeatCount="indefinite"/>
          <animate attributeName="y2" values="96;108;96" dur="0.5s" repeatCount="indefinite"/>
        </path>

        <!-- 泵腔 + 膜片 -->
        <rect x="292" y="66" width="120" height="130" rx="10" fill="#F3EDE1" stroke="#B9B0A0" stroke-width="1.4"/>
        <ellipse cx="352" cy="86" rx="46" ry="12" fill="#DCE7EE" stroke="#8FB3C9" stroke-width="1.3">
          <animate attributeName="ry" values="12;5;12" dur="0.5s" repeatCount="indefinite"/>
          <animate attributeName="cy" values="86;92;86" dur="0.5s" repeatCount="indefinite"/>
        </ellipse>
        <text x="316" y="232" class="ab-fig-t">膜片</text>

        <!-- 两个单向阀 -->
        <polygon points="300,150 316,162 300,174" fill="#C9BFAE" stroke="#A79C88" stroke-width="1.1"/>
        <polygon points="400,120 384,132 400,144" fill="#C9BFAE" stroke="#A79C88" stroke-width="1.1"/>
        <text x="278" y="196" class="ab-fig-t">进口阀</text>
        <text x="392" y="168" class="ab-fig-t">出口阀</text>

        <!-- 进气 -->
        <path d="M230 162 H298" stroke="#8FC0DA" stroke-width="5" stroke-linecap="round"/>

        <!-- 出气 → 储气罐 → 喷笔 -->
        <path d="M404 132 H470" stroke="#8FC0DA" stroke-width="5" stroke-linecap="round"/>
        <rect x="474" y="98" width="130" height="68" rx="34" fill="#DCE7EE" stroke="#8FB3C9" stroke-width="1.4"/>
        <circle cx="510" cy="132" r="15" fill="#fff" stroke="#8FB3C9" stroke-width="1.4"/>
        <line x1="510" y1="132" x2="519" y2="125" stroke="#B4530A" stroke-width="1.7"/>
        <text x="492" y="196" class="ab-fig-t">储气罐（抹平脉动）</text>

        <path d="M608 132 H664" stroke="#8FC0DA" stroke-width="5" stroke-linecap="round"/>
        <rect x="690" y="104" width="52" height="40" rx="6" fill="#F0EBE1" stroke="#B9B0A0" stroke-width="1.3"/>
        <rect x="702" y="88" width="14" height="16" fill="#B4530A"/>
        <text x="684" y="196" class="ab-fig-t">调压阀</text>

        <path d="M748 124 C772 124 776 116 800 116" stroke="#8FC0DA" stroke-width="5" fill="none" stroke-linecap="round"/>
        <rect x="804" y="106" width="62" height="20" rx="9" fill="#EFE9DD" stroke="#B9B0A0" stroke-width="1.3"/>
        <polygon points="866,106 878,116 866,126" fill="#C9BFAE"/>
        <text x="806" y="160" class="ab-fig-t">喷笔</text>

        <!-- 气流粒子 -->
        <circle r="3" fill="#4E93BC">
          <animateMotion dur="1.6s" repeatCount="indefinite" path="M404,132 H800"/>
        </circle>
        <circle r="3" fill="#4E93BC">
          <animateMotion dur="1.6s" begin="-0.8s" repeatCount="indefinite" path="M404,132 H800"/>
        </circle>
        <circle r="3" fill="#4E93BC">
          <animate attributeName="cx" values="250;298" dur="0.5s" repeatCount="indefinite"/>
          <animate attributeName="cy" values="162;162" dur="0.5s" repeatCount="indefinite"/>
        </circle>
      </svg>

      <div class="ab-cards">
        <article>
          <h5>① 线圈：把电变成磁</h5>
          <p>交流电过线圈产生交变磁场，磁场一吸一放，频率就是市电的 50 Hz。</p>
          <p>没有碳刷、没有换向器——这是它寿命长的根本原因。</p>
        </article>
        <article>
          <h5>② 衔铁 + 膜片：磁力变位移</h5>
          <p>衔铁被吸动，推着膜片每秒鼓起、压下 50 次。</p>
          <p>行程很小（通常 1–2 毫米），所以流量不大，但结构极简。</p>
        </article>
        <article>
          <h5>③ 两个单向阀：往复变单向</h5>
          <p>膜片鼓起时排气阀开、进气阀关；压下时反过来。</p>
          <p>一进一出，气流就成了单向。阀片脏了流量立刻掉。</p>
        </article>
        <article>
          <h5>④ 储气罐：必须配</h5>
          <p>50 Hz 的脉动比活塞更密，没有罐会喷得一顿一顿。</p>
          <p>小罐（1–3 升）就够，主要是抹平高频抖动。</p>
        </article>
      </div>

      <div class="ab-principle">
        <h4>一句话总结</h4>
        <p>
          电磁泵 = <b>线圈 + 衔铁 + 膜片 + 两个单向阀</b>。它用市电的频率工作，结构比活塞机简单得多，
          但压力和流量都小。喷笔套装里那种小方盒子，基本就是这个。
        </p>
      </div>

      

      <div class="ab-cards">

        <article>
          <h5>直驱 vs 皮带</h5>
          <p><b>直驱</b>　电机轴直接连曲轴。便宜、体积小，但抖动和噪音都大。</p>
          <p><b>皮带</b>　电机通过皮带带曲轴。转速低、更静音、寿命长，但要定期检查皮带松紧。</p>
        </article>
        <article>
          <h5>无油 vs 有油</h5>
          <p><b>无油</b>　不用换油，但活塞环磨损快、噪音大、寿命相对短。</p>
          <p><b>有油</b>　耐用、噪音低，但要定期换油，且必须配油水分离，否则会把油雾喷进漆里。</p>
        </article>
        <article>
          <h5>冰箱压缩机 DIY</h5>
          <p>用旧冰箱压缩机 + 灭火器罐 + 油水分离，静音效果极好（35 dB 左右）。</p>
          <p>缺点是排气量小、需要一定的动手能力，焊接和密封做不好会漏气。</p>
        </article>
        <article>
          <h5>气罐 / CO₂ 瓶</h5>
          <p>没有电机，靠预充气体。完全静音，压力恒定，适合小件和外出。</p>
          <p>缺点是压力会随用量下降、需要充气或换罐，长期成本高。</p>
        </article>
      </div>

      <div class="ab-principle">
        <h4>怎么选</h4>
        <p><b>在家喷、怕吵</b>　→ 静音活塞，或者冰箱压缩机 DIY。</p>
        <p><b>预算有限、偶尔喷</b>　→ 无油活塞带罐，3–6 升。</p>
        <p><b>只喷小零件、上色为主</b>　→ 隔膜式或气罐就够。</p>
        <p><b>长时间连续喷涂</b>　→ 有油活塞或涡旋，注意占空比。</p>
      </div>

      <h4>买之前看这几个数</h4>
      <table class="ab-table">
        <thead><tr><th>参数</th><th>怎么看</th><th>模型够用的值</th></tr></thead>
        <tbody>
          <tr><td>排气量</td><td>每分钟出多少升气（L/min）</td><td>≥ 20 L/min，0.3 口径够用</td></tr>
          <tr><td>压力</td><td>最高能打多少 bar</td><td>4–6 bar（实际只用 1.5–2）</td></tr>
          <tr><td>储气罐</td><td>罐的容积</td><td>3–6 L，带罐是关键</td></tr>
          <tr><td>噪音</td><td>分贝数</td><td>≤ 60 dB 才敢在家里用</td></tr>
          <tr><td>占空比</td><td>能否连续工作</td><td>模型是间歇工作，一般够</td></tr>
        </tbody>
      </table>

      <div class="ab-principle">
        <h4>为什么一定要带储气罐</h4>
        <p>
          无罐气泵每往复一次气压就抖一次，喷笔对这种抖动极敏感——出漆量跟着抖，漆面就一道深一道浅。
          储气罐相当于一个水库，把抖动吃掉。贵一百块也优先买带罐的。
        </p>
      </div>
    `,

  spray: `<div class="sd-nav">
      <button type="button" data-anchor="sd-thin">稀释</button>
      <button type="button" data-anchor="sd-tech">手法</button>
      <button type="button" data-anchor="sd-env">环境</button>
      <button type="button" data-anchor="sd-care">保养</button>
    </div>

    <!-- ========== 稀释 ========== -->
    <h4 id="sd-thin">稀释：先学会判断稠稀，再记比例</h4>
    <p class="sd-lead">
      比例只是起点。同一支漆放久了会变稠，不同批次的浓度也不一样——真正要练的是<b>看</b>：漆挂在搅拌棒上流下来的样子。
    </p>

    <div class="sd-figs">
      <figure>
        <svg viewBox="0 0 120 150" aria-hidden="true">
          <rect x="42" y="14" width="36" height="70" rx="6" fill="#F3EDE1" stroke="#B9B0A0" stroke-width="1.3"/>
          <rect x="44" y="52" width="32" height="30" fill="#D9722F" opacity=".9"/>
          <path d="M42 84 h36" stroke="#B9B0A0" stroke-width="1.3"/>
          <path d="M60 84 V122" stroke="#D9722F" stroke-width="7" stroke-linecap="round"/>
          <circle cx="60" cy="128" r="4" fill="#D9722F"/>
          <text x="18" y="140" class="ab-fig-t">太稠：成条、断断续续</text>
        </svg>
        <figcaption>挂不住，像蜂蜜</figcaption>
      </figure>
      <figure>
        <svg viewBox="0 0 120 150" aria-hidden="true">
          <rect x="42" y="14" width="36" height="70" rx="6" fill="#F3EDE1" stroke="#B9B0A0" stroke-width="1.3"/>
          <rect x="44" y="46" width="32" height="36" fill="#D9722F" opacity=".9"/>
          <path d="M60 84 V116" stroke="#D9722F" stroke-width="4" stroke-linecap="round"/>
          <circle cx="60" cy="122" r="3" fill="#D9722F"/>
          <circle cx="60" cy="132" r="2.6" fill="#D9722F"/>
          <text x="22" y="146" class="ab-fig-t">合适：连续细流</text>
        </svg>
        <figcaption>像牛奶，挂一层薄膜</figcaption>
      </figure>
      <figure>
        <svg viewBox="0 0 120 150" aria-hidden="true">
          <rect x="42" y="14" width="36" height="70" rx="6" fill="#F3EDE1" stroke="#B9B0A0" stroke-width="1.3"/>
          <rect x="44" y="40" width="32" height="42" fill="#D9722F" opacity=".6"/>
          <path d="M60 84 V104" stroke="#D9722F" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="60" cy="110" r="1.8" fill="#D9722F"/>
          <circle cx="56" cy="120" r="1.6" fill="#D9722F"/>
          <circle cx="64" cy="128" r="1.6" fill="#D9722F"/>
          <text x="26" y="146" class="ab-fig-t">太稀：滴水、不挂壁</text>
        </svg>
        <figcaption>像水，一冲就掉</figcaption>
      </figure>
    </div>

    <table class="ab-table">
      <thead><tr><th>漆种</th><th>稀释剂</th><th>比例（漆 : 稀释剂）</th><th>注意</th></tr></thead>
      <tbody>
        <tr><td>硝基漆</td><td>郡士/田宫专用硝基稀释剂</td><td>1 : 1.5～2</td><td>最常用；别用香蕉水代替</td></tr>
        <tr><td>水性丙烯</td><td>专用水性稀释剂或蒸馏水</td><td>1 : 1～1.5</td><td>别用自来水，矿物质会发花</td></tr>
        <tr><td>珐琅漆</td><td>田宫 X-20</td><td>1 : 1～2</td><td>干得慢，适合渗线和手涂</td></tr>
        <tr><td>补土（瓶装）</td><td>同系稀释剂</td><td>1 : 1～1.5</td><td>稀一点才能喷，太稠会拉丝</td></tr>
        <tr><td>金属漆</td><td>同系稀释剂</td><td>1 : 2</td><td>稀一些，颗粒才排得开</td></tr>
        <tr><td>透明漆</td><td>同系稀释剂</td><td>1 : 2</td><td>薄喷，太稠会咬底</td></tr>
      </tbody>
    </table>

    <div class="ab-cards">
      <article>
        <h5>稀释剂怎么选</h5>
        <p><b>标准型</b>　通用，干速适中，最稳。</p>
        <p><b>缓干型</b>　夏天、潮湿天用，防白化和橘皮。干得慢，别急着叠层。</p>
        <p><b>快干型</b>　低温或赶时间用，但更容易橘皮。</p>
        <p><b>金属专用</b>　有的品牌有，能让颗粒排得更整齐。</p>
      </article>
      <article>
        <h5>四个常见错误</h5>
        <p><b>1. 用错稀释剂</b>　硝基配珐琅会絮凝，直接堵笔。</p>
        <p><b>2. 一次倒太多稀释剂</b>　稀了只能加漆，越调越多。</p>
        <p><b>3. 稀释后放一周</b>　溶剂挥发，比例变了。</p>
        <p><b>4. 用眼睛估比例</b>　买个带刻度的小杯，几块钱。</p>
      </article>
    </div>

    <!-- ========== 手法 ========== -->
    <h4 id="sd-tech">手法：距离、重叠、速度</h4>

    <div class="sd-figs">
      <figure class="wide">
        <svg viewBox="0 0 320 140" aria-hidden="true">
          <rect x="10" y="96" width="300" height="10" fill="#E8E2D6"/>
          <path d="M40 30 L96 96" stroke="#C9BFAE" stroke-width="8" stroke-linecap="round"/>
          <path d="M96 96 L120 40" stroke="#B4530A" stroke-width="1.2" stroke-dasharray="3 3"/>
          <path d="M96 96 L20 40" stroke="#B4530A" stroke-width="1.2" stroke-dasharray="3 3"/>
          <text x="128" y="60" class="ab-fig-t">15–20 cm</text>
          <rect x="150" y="86" width="70" height="10" fill="#D9722F" opacity=".55"/>
          <rect x="196" y="86" width="70" height="10" fill="#D9722F" opacity=".55"/>
          <text x="176" y="76" class="ab-fig-t">重叠 1/3～1/2</text>
          <path d="M260 110 H300" stroke="#2F7D4F" stroke-width="1.4" marker-end="url(#abArrowG)"/>
          <text x="258" y="126" class="ab-fig-t">匀速走枪</text>
        </svg>
      </figure>
    </div>

    <table class="ab-table">
      <thead><tr><th>项目</th><th>数值</th><th>为什么</th></tr></thead>
      <tbody>
        <tr><td>距离</td><td>15–20 cm</td><td>近了流挂，远了干喷起粉</td></tr>
        <tr><td>走枪速度</td><td>每秒约 20–30 cm</td><td>停住就流挂，太快盖不住</td></tr>
        <tr><td>重叠率</td><td>1/3～1/2</td><td>不漏喷，也不会一次太厚</td></tr>
        <tr><td>角度</td><td>尽量垂直</td><td>斜喷漆膜厚薄不均</td></tr>
        <tr><td>层间</td><td>10–15 分钟</td><td>摸着不粘手再上下一层</td></tr>
      </tbody>
    </table>

    <div class="ab-cards">
      <article>
        <h5>薄喷 vs 湿喷</h5>
        <p><b>薄喷</b>　漆量小、干得快、盖不住底色。适合多层堆、过渡、细节。</p>
        <p><b>湿喷</b>　一次喷到发亮，表面平整。适合最后一道、透明漆。</p>
        <p><b>规则</b>　前面几层薄喷打底，最后一道湿喷收光。反过来必流挂。</p>
      </article>
      <article>
        <h5>十字交叉</h5>
        <p>第一层横着走枪，第二层竖着走枪。这样漏喷的地方会被第二层补上，比一个方向喷三遍都匀。</p>
        <p>大面积（车壳、翅膀）一定要用，小零件可以省。</p>
      </article>
      <article>
        <h5>先边角后大面</h5>
        <p>边角、凹槽先喷到，再整体走一遍大面。反过来大面喷完再补边角，接缝会明显。</p>
      </article>
      <article>
        <h5>手别摸</h5>
        <p>指腹有油脂，摸过的地方上不了漆，会出现缩孔（小坑）。要检查干没干，用纸胶带轻贴一下。</p>
      </article>
    </div>

    <!-- ========== 环境 ========== -->
    <h4 id="sd-env">环境：温度、湿度、灰尘</h4>

    <table class="ab-table">
      <thead><tr><th>湿度</th><th>能喷什么</th><th>建议</th></tr></thead>
      <tbody>
        <tr><td>40–60%</td><td>什么都能喷</td><td>最理想</td></tr>
        <tr><td>60–75%</td><td>实色、补土</td><td>透明和光泽要小心，加缓干剂</td></tr>
        <tr><td>75–85%</td><td>只做实色</td><td>透明/光泽会发白（blushing）</td></tr>
        <tr><td>&gt;85%</td><td>别喷</td><td>开除湿机，或者等</td></tr>
      </tbody>
    </table>

    <div class="ab-cards">
      <article>
        <h5>温度</h5>
        <p><b>20–25℃</b> 最稳。</p>
        <p><b>低于 15℃</b>　干得慢，容易流挂、发白；漆膜可能一直不硬。</p>
        <p><b>高于 30℃</b>　溶剂挥发太快，起橘皮、干喷。</p>
      </article>
      <article>
        <h5>通风与防护</h5>
        <p>硝基漆有毒性，必须在通风处喷：开窗 + 抽风机 + 防毒口罩（不是普通医用口罩）。</p>
        <p>别在卧室、别在小孩在的房间。喷完继续通风半小时。</p>
      </article>
      <article>
        <h5>降尘</h5>
        <p>喷前在地上洒点水，或者用喷壶在空气里喷一层水雾，让灰尘落下去。</p>
        <p>漆面有颗粒，八成是灰尘，不是漆的问题。</p>
      </article>
      <article>
        <h5>干燥</h5>
        <p>自然干最好。要加速用远距离暖风，别贴着吹——表面干太快会起橘皮。</p>
        <p>硝基漆表干 10–15 分钟，实干 24 小时。没干透就叠层，必花。</p>
      </article>
    </div>

    <!-- ========== 保养 ========== -->
    <h4 id="sd-care">保养：每次五分钟，省下一支笔</h4>

    <div class="sd-steps">
      <div><b>① 倒残漆</b><p>把杯里剩的漆倒回瓶里（过滤一下），别留在杯里过夜。</p></div>
      <div><b>② 过稀释剂</b><p>杯里倒稀释剂，晃一晃，喷掉。重复到喷出来是清的。</p></div>
      <div><b>③ 拆针和喷嘴</b><p>抽出漆针擦干净；喷嘴拆下来泡稀释剂几分钟，别用针捅。</p></div>
      <div><b>④ 擦干装回</b><p>所有件擦干再装，螺纹处别硬拧。下次用之前先试喷一下。</p></div>
    </div>

    <table class="ab-table">
      <thead><tr><th>周期</th><th>做什么</th></tr></thead>
      <tbody>
        <tr><td>每次用完</td><td>四步清洗（上面那四步）</td></tr>
        <tr><td>每周</td><td>拆开喷嘴和针，彻底清一次漆道；检查 O 圈有没有发硬</td></tr>
        <tr><td>每月</td><td>螺纹和扳机转轴上一滴专用润滑油；检查气阀漏不漏气</td></tr>
        <tr><td>长期不用</td><td>彻底洗净晾干，针单独放，别长期顶着喷嘴</td></tr>
      </tbody>
    </table>

    <div class="ab-cards">
      <article>
        <h5>三个禁忌</h5>
        <p><b>别用针捅喷嘴</b>　孔一扩，雾化永久变粗，只能换。</p>
        <p><b>别把整支笔泡在溶剂里</b>　O 圈会老化发胀。</p>
        <p><b>别用机油润滑</b>　会腐蚀胶圈，用专用润滑脂。</p>
      </article>
      <article>
        <h5>什么时候该换件</h5>
        <p><b>喷嘴</b>　雾化明显变粗、清洗后仍偏喷。</p>
        <p><b>漆针</b>　针尖弯了、关不严一直滴。</p>
        <p><b>O 圈</b>　漏气、扳机回弹慢、接口渗漆。</p>
      </article>
    </div>`,

  fail: `<h4>正常的漆面是怎么形成的</h4>
      <p class="sd-lead">
        下面八张卡讲的是"坏了长什么样"。但在那之前得先知道**正常**长什么样——不然连判断的基准都没有。
      </p>

      <svg viewBox="0 0 460 170" class="ab-fig" style="height:200px" aria-hidden="true">
        <rect x="20" y="126" width="300" height="28" fill="#DCD5C7"/>
        <text x="20" y="168" class="ab-fig-t">模型本体（塑料 / 树脂）</text>

        <rect x="20" y="106" width="300" height="20" fill="#B9B0A0"/>
        <text x="334" y="120" class="ab-fig-t">底漆 / 补土　10–20 μm</text>

        <rect x="20" y="76" width="300" height="30" fill="#C89B6A"/>
        <text x="334" y="96" class="ab-fig-t">色漆 2–3 薄层　20–40 μm</text>

        <rect x="20" y="58" width="300" height="18" fill="#E8DCC4" opacity=".9"/>
        <text x="334" y="72" class="ab-fig-t">罩光 / 消光　10–20 μm</text>

        <path d="M312 58 V106" stroke="#B4530A" stroke-width="1.2"/>
        <path d="M308 58 H316 M308 106 H316" stroke="#B4530A" stroke-width="1.2"/>
        <text x="318" y="52" class="ab-fig-t">总厚 40–80 μm</text>
      </svg>

      <div class="ab-cards">
        <article>
          <h5>① 一层漆怎么变成膜</h5>
          <p><b>刚喷上</b>　是一层湿的漆雾液滴，表面坑坑洼洼。</p>
          <p><b>流平</b>　溶剂挥发、表面张力把液滴拉平——这一步决定表面平不平。</p>
          <p><b>成膜</b>　溶剂跑完，树脂连成一片。此时表面才定型。</p>
        </article>
        <article>
          <h5>② 为什么必须薄喷多层</h5>
          <p><b>薄层</b>　溶剂能从上往下跑掉，每层都能流平。</p>
          <p><b>厚层</b>　表面先干结成皮，里面的溶剂出不来，被困住 → 起泡、发白、后期塌陷。</p>
          <p>所以「薄喷三层」不是玄学，是让每一层都有机会干透和流平。</p>
        </article>
        <article>
          <h5>③ 干燥的三个阶段</h5>
          <p><b>表干</b>　10–15 分钟，摸着不粘手。此时可以喷下一层。</p>
          <p><b>实干</b>　约 24 小时，溶剂基本跑完。</p>
          <p><b>完全固化</b>　几天到一周，硬度才上来。这时候抛光才不会留痕。</p>
        </article>
        <article>
          <h5>④ 什么样的漆面算「平」</h5>
          <p>漆面微观上永远有起伏，关键是<b>起伏的尺度</b>。</p>
          <p>流平好 → 反光是一整片、能照出直线；流平差 → 反光散开，就是橘皮。</p>
          <p>侧光贴着看，是最快的判断方法。</p>
        </article>
      </div>

      <div class="ab-principle">
        <h4>正常漆面的五个标志</h4>
        <p><b>1. 颜色均匀</b>　没有深浅不一的斑块，边缘也没有积漆。</p>
        <p><b>2. 反光连续</b>　侧光看，反光是一条完整的光带，不是碎的。</p>
        <p><b>3. 没有凸起</b>　手指轻扫，感觉不到颗粒和硬点。</p>
        <p><b>4. 边缘干净</b>　遮盖线笔直，没有锯齿状渗色。</p>
        <p><b>5. 厚度一致</b>　棱角处没有明显变厚（那里最容易流挂）。</p>
      </div>

      <h4>先判断：漆干了没有</h4>

    <p class="sd-lead">
      同样的缺陷，没干和干了是两种处理。没干透可以稀释后盖过去；干透了只能打磨重来。
      判断方法：<b>用一小段纸胶带轻贴再撕</b>，胶带上有漆屑就是没干透。
    </p>

    <div class="fail-grid">
        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <path d="M6 70 V54 q7 -7 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 V70 Z" fill="#C89B6A"/>
            <path d="M40 30 L52 50" stroke="#B4530A" stroke-width="1.2"/>
            <path d="M64 30 L60 50" stroke="#B4530A" stroke-width="1.2"/>
            <path d="M88 30 L70 50" stroke="#B4530A" stroke-width="1.2"/>
            <text x="96" y="26" class="ab-fig-t">反光散开</text>
          </svg>
          <h5>橘皮</h5>
          <p class="sym"><b>断面</b>　漆膜表面是波浪，不是平的。</p>
          <p><b>长什么样</b>　密密麻麻的小凹坑，反光像橘子皮。</p>
          <p><b>原因</b>　漆太稠、枪太远、气压不足，或一层喷太厚。</p>
          <p><b>处理</b>　没干 → 稀释后薄盖；干了 → 800 目湿磨再薄喷。</p>
          <p><b>预防</b>　稀释到位、距离 15–20 cm、先薄后湿。</p>
        </article>

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <path d="M6 70 V52 H112 q6 0 8 8 q3 14 12 14 q9 0 11 -12 q2 -10 9 -10 H214 V70 Z" fill="#C89B6A"/>
            <path d="M141 56 V82" stroke="#B03A2E" stroke-width="1.4" marker-end="url(#abArrow)"/>
            <text x="148" y="90" class="ab-fig-t">这里的漆最厚</text>
          </svg>
          <h5>流挂</h5>
          <p class="sym"><b>断面</b>　某一处漆膜突然变厚，往下坠。</p>
          <p><b>长什么样</b>　一道漆往下淌，下边缘有厚边。</p>
          <p><b>原因</b>　一次喷太厚、停枪、距离太近。</p>
          <p><b>处理</b>　必须干透，打磨掉流挂边缘再薄喷。</p>
          <p><b>预防</b>　薄喷多层，匀速别停。</p>
        </article>

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <rect x="6" y="48" width="208" height="22" fill="#C89B6A"/>
            <rect x="6" y="42" width="208" height="20" fill="#FFFFFF" opacity=".55"/>
            <g fill="#FFFFFF" opacity=".9">
              <circle cx="34" cy="56" r="4"/><circle cx="62" cy="63" r="3.4"/>
              <circle cx="96" cy="54" r="4.2"/><circle cx="130" cy="62" r="3.6"/>
              <circle cx="162" cy="55" r="4"/><circle cx="190" cy="63" r="3.2"/>
            </g>
            <text x="6" y="36" class="ab-fig-t">漆膜里封住的水汽</text>
          </svg>
          <h5>白化</h5>
          <p class="sym"><b>断面</b>　漆膜内部有细小水汽，整层泛白。</p>
          <p><b>长什么样</b>　像蒙了一层白霜，光泽和透明最明显。</p>
          <p><b>原因</b>　湿度太高、稀释剂挥发太快、温度低。</p>
          <p><b>处理</b>　没干透 → 加缓干剂薄喷；已白 → 打磨重来。</p>
          <p><b>预防</b>　湿度 &lt;75%，潮湿天用缓干型稀释剂。</p>
        </article>

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <path d="M6 70 V48 H88 q10 0 12 10 q2 12 10 12 q8 0 10 -12 q2 -10 12 -10 H214 V70 Z" fill="#C89B6A"/>
            <path d="M98 74 q12 6 24 0" stroke="#8A7A63" stroke-width="2" fill="none"/>
            <text x="84" y="92" class="ab-fig-t">坑底露出底色</text>
          </svg>
          <h5>鱼眼 / 缩孔</h5>
          <p class="sym"><b>断面</b>　漆膜被顶开一个火山口，坑底见到下层。</p>
          <p><b>长什么样</b>　一个个小圆坑，中心颜色和周围不同。</p>
          <p><b>原因</b>　表面有油、水或硅（手摸、脱模剂、空压机带水）。</p>
          <p><b>处理</b>　干透打磨，洗件（加一点洗洁精）再重喷。</p>
          <p><b>预防</b>　喷前洗件、加水隔、别用手摸。</p>
        </article>

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <rect x="6" y="62" width="208" height="8" fill="#C89B6A" opacity=".7"/>
            <g fill="#C89B6A">
              <circle cx="26" cy="52" r="5"/><circle cx="48" cy="44" r="4"/>
              <circle cx="72" cy="55" r="5.5"/><circle cx="96" cy="44" r="4.4"/>
              <circle cx="120" cy="53" r="5"/><circle cx="146" cy="42" r="4.2"/>
              <circle cx="170" cy="52" r="5.4"/><circle cx="194" cy="45" r="4"/>
            </g>
            <text x="6" y="32" class="ab-fig-t">漆在半空就干了，落下来是颗粒</text>
          </svg>
          <h5>干喷</h5>
          <p class="sym"><b>断面</b>　没有连续漆膜，表面是一层松散颗粒。</p>
          <p><b>长什么样</b>　粗糙发粉、反光发哑，摸上去像砂纸。</p>
          <p><b>原因</b>　距离太远、气压太大、漆太稀。</p>
          <p><b>处理</b>　打磨平，拉近、降气压重喷。</p>
          <p><b>预防</b>　距离 15–20 cm，气压 1.5–2 bar。</p>
        </article>

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <rect x="6" y="48" width="96" height="22" fill="#8FA9C4"/>
            <rect x="118" y="48" width="96" height="22" fill="#C89B6A"/>
            <rect x="102" y="34" width="10" height="44" fill="#E8E2D6" stroke="#B9B0A0"/>
            <path d="M96 48 q10 8 6 22" stroke="#8FA9C4" stroke-width="4" fill="none" opacity=".9"/>
            <path d="M118 48 q-10 8 -6 22" stroke="#C89B6A" stroke-width="4" fill="none" opacity=".9"/>
            <text x="64" y="30" class="ab-fig-t">漆从胶带边缘渗进去</text>
          </svg>
          <h5>遮盖渗漆</h5>
          <p class="sym"><b>断面</b>　两种颜色在胶带边缘互相咬进去。</p>
          <p><b>长什么样</b>　交界处有锯齿状渗色，边缘不齐。</p>
          <p><b>原因</b>　胶带没压实、边缘翘起、一次喷太湿。</p>
          <p><b>处理</b>　干透后补边，局部重新遮盖再喷。</p>
          <p><b>预防</b>　压边压实，先薄喷一层「封边」。</p>
        </article>

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <rect x="6" y="48" width="208" height="22" fill="#C89B6A"/>
            <circle cx="72" cy="42" r="9" fill="#8A6A3A"/>
            <circle cx="70" cy="40" r="4" fill="#A8895A"/>
            <circle cx="150" cy="46" r="6" fill="#8A6A3A"/>
            <text x="6" y="32" class="ab-fig-t">灰尘或未过滤的漆块落在湿漆上</text>
          </svg>
          <h5>颗粒</h5>
          <p class="sym"><b>断面</b>　漆面里嵌着异物，凸出来。</p>
          <p><b>长什么样</b>　凸起的小点，反光时很明显。</p>
          <p><b>原因</b>　空气里的灰尘、漆没过滤、干喷的漆雾落下。</p>
          <p><b>处理</b>　干透后用 1500 目打磨，再抛光。</p>
          <p><b>预防</b>　漆过一遍滤网，喷前地上洒水降尘。</p>
        </article>

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <path d="M6 70 V50 L150 50 L214 62 V70 Z" fill="#C89B6A"/>
            <path d="M150 50 L214 62" stroke="#B4530A" stroke-width="1" stroke-dasharray="3 3"/>
            <text x="120" y="42" class="ab-fig-t">这一段薄了，底色透出来</text>
          </svg>
          <h5>漏喷 / 薄厚不均</h5>
          <p class="sym"><b>断面</b>　漆膜一头厚一头薄，薄处透底色。</p>
          <p><b>长什么样</b>　有的地方深、有的浅，侧面看有明显色块。</p>
          <p><b>原因</b>　重叠率不够、边角没先喷、走枪速度不一致。</p>
          <p><b>处理</b>　整体薄薄补一层。</p>
          <p><b>预防</b>　重叠 1/3，先边角后大面。</p>
        </article>
      </div>

          <div class="ab-principle">
      <h4>三条通用原则</h4>
      <p><b>1. 先停手，别趁湿补救。</b>　湿的时候动它只会越弄越糟，等干了再处理。</p>
      <p><b>2. 打磨是最后手段。</b>　每磨一次就少一层漆，磨穿底色就得从头来。</p>
      <p><b>3. 同一个问题连着出两次，先停。</b>　多半是漆或设备的状态变了（稠了、堵了、湿度上来了），不是手的问题。</p>
    </div>`
};
