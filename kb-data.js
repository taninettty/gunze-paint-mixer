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
      <button type="button" data-anchor="sd-safety">安全</button>
      <button type="button" data-anchor="sd-thin">稀释</button>
      <button type="button" data-anchor="sd-thinner">稀释剂</button>
      <button type="button" data-anchor="sd-tech">手法</button>
      <button type="button" data-anchor="sd-compat">兼容</button>
      <button type="button" data-anchor="sd-env">环境</button>
      <button type="button" data-anchor="sd-rework">返工</button>
      <button type="button" data-anchor="sd-store">储存</button>
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
    </div>
    <h4 id="sd-safety">安全与防护：这一步不能省</h4>
    <p class="sd-lead">
      郡士 C 系是硝基漆，稀释剂含酯类、酮类、醇醚类有机溶剂。这类物质不是「味道大」的问题，
      而是长期吸入会损伤中枢神经和呼吸系统。喷漆必须在通风条件下做，必须戴合适的口罩。
    </p>
    <div class="ab-note">
      <b>口罩</b>：普通医用口罩、布口罩<b>无效</b>——它们拦不住有机蒸气。要用带<b>有机气体滤盒</b>的防毒面具（如 3M 6000 系列 + 6001 滤盒）。
      <br><b>通风</b>：抽风机把漆雾排到室外，或至少在通风处作业；密闭房间里戴口罩也不够，因为氧气里的溶剂浓度仍在升高。
      <br><b>手套</b>：丁腈手套。乳胶会被溶剂溶胀，等于没戴。
      <br><b>眼睛</b>：护目镜，尤其是洗笔和倒稀释剂时。
    </div>
    <p class="sd-lead">
      <b>废液</b>：洗笔的废稀释剂不要倒下水道。静置后漆渣沉底，上层清液可重复用于洗笔，漆渣按有害垃圾处理。
      <b>储存</b>：漆和稀释剂远离火源、避免阳光直射，容器拧紧（溶剂挥发会让漆变稠）。
    </p>

    <h4 id="sd-thinner">稀释剂：黄标、蓝标、缓干，各用在哪</h4>
    <p class="sd-lead">
      郡士的稀释剂不止一种，用错会影响流平和干燥速度。
    </p>
    <dl class="gl-list">
      <dt>黄标（Mr.Color Thinner）</dt>
      <dd>标准稀释剂，干燥速度中等。日常喷涂、补土稀释都用它，最通用。</dd>
      <dt>蓝标（Mr.Color Leveling Thinner）</dt>
      <dd>缓干型，挥发慢，漆膜有更多时间流平。适合<b>大面积、光泽面、金属漆</b>——橘皮和干喷会明显减少。代价是干得慢，别在急着下一道时用。</dd>
      <dt>快干稀释剂</dt>
      <dd>挥发快，适合小件、快速堆叠，但更容易干喷和橘皮。新手不建议一上来就用。</dd>
      <dt>水性 / 珐琅稀释剂</dt>
      <dd>与硝基<b>不通用</b>。水性漆用水或专用稀释剂；珐琅漆用 X-20 类。混用会结块或分层。</dd>
    </dl>
    <p class="sd-lead">
      <b>比例不是标准</b>：同一支漆放久了会变稠，批号之间也有差异。判断依据是「搅拌棒上流下来的样子」——
      连续细流像牛奶就对了，成条断续说明太稠。
    </p>

    <h4 id="sd-compat">漆层兼容：谁能盖在谁上面</h4>
    <p class="sd-lead">
      叠层的原则只有一条：<b>后喷的漆，溶剂不能溶解先喷的漆</b>。溶剂强度大致是：
    </p>
    <div class="ab-note">
      硝基（郡士 C）&gt; 珐琅（田宫方瓶）&gt; 水性（田宫圆瓶 / 郡士 H）
    </div>
    <dl class="gl-list">
      <dt>硝基上盖硝基</dt>
      <dd>可以，但底层必须干透。半干时喷第二层，溶剂会把底层「咬」起来起皱（俗称咬底）。</dd>
      <dt>硝基上盖珐琅 / 水性</dt>
      <dd>安全。弱溶剂不会溶解已干的硝基膜——这也是为什么渗线、旧化都用珐琅系。</dd>
      <dt>珐琅 / 水性上盖硝基</dt>
      <dd><b>危险</b>。硝基溶剂会直接溶解底层，轻则起皱，重则整片浮起。</dd>
      <dt>底层没干透就叠</dt>
      <dd>无论哪种组合都会出问题：溶剂被封在下面，后期收缩、龟裂、发白。</dd>
    </dl>
    <p class="sd-lead">
      判据：<b>纸胶带轻贴再撕</b>，胶带上没有漆屑、也没有压痕，才算干透。硝基漆通常需要 12–24 小时。
    </p>

    <h4 id="sd-rework">返工：喷坏了怎么救</h4>
    <p class="sd-lead">
      先判断严重程度，再决定救法。顺序是「能盖就盖、能磨就磨、都不行才剥」。
    </p>
    <dl class="gl-list">
      <dt>第一档：薄盖</dt>
      <dd>只是发花、颜色不匀、有轻微橘皮。等干透，稀释后薄喷 2 道盖过去。</dd>
      <dt>第二档：打磨重喷</dt>
      <dd>流挂、明显橘皮、颗粒。干透后 P800 湿磨打平，P1000 收面，重新喷。</dd>
      <dt>第三档：剥离</dt>
      <dd>大面积咬底、龟裂、颜色彻底错。用郡士<span> </span>「Mr.Color 洗漆剂」或专用脱漆剂泡洗；没有的话，异丙醇浸泡 + 旧牙刷也能慢慢刷掉。ABS 件不要用强溶剂长时间泡，会发白变形。</dd>
      <dt>不要做的</dt>
      <dd>在没干透的漆上继续喷、用砂纸硬磨流挂（会把周围一起磨穿）、用稀释剂直接擦大面积漆面（会糊成一片）。</dd>
    </dl>

    <h4 id="sd-store">剩漆怎么存</h4>
    <p class="sd-lead">
      调好的漆和开过封的原漆都怕两件事：<b>溶剂挥发</b>和<b>颜料沉降</b>。
    </p>
    <dl class="gl-list">
      <dt>调好的漆</dt>
      <dd>当天用完最好。要留，装进带盖玻璃瓶（塑料瓶会被溶剂慢慢渗透），拧紧、避光，一般能放 1–2 周；出现结块或胶化就丢掉。</dd>
      <dt>开过封的原漆</dt>
      <dd>瓶口擦干净再拧盖（残漆干在螺纹上会导致密封不严），竖放、避光。变稠后可以加稀释剂调回，但反复稀释会改变树脂比例。</dd>
      <dt>用前必做</dt>
      <dd>摇匀或搅拌 1 分钟以上。金属漆、消光漆的颜料密度大，静置几天就会沉底——不搅匀直接喷，颜色和光泽都会不匀。</dd>
    </dl>

  `,

  flow: `
    <h4 id="fl-top">全流程详解</h4>
    <p class="sd-lead">
      15 个步骤，每步按「目的 → 原理 → 材料 → 参数 → 操作 → 判据 → 常见问题」写。
      标<b>典型值</b>的是车间经验，标<b>标准</b>的是有据可查的规范，两者不混说。
    </p>

    <div class="fl-nav">
      <span>上游</span> 洗件 · 修模 · 假组 · 补土 · 补土后打磨 · 遮盖准备
      <span>中游</span> 底漆 · 面漆 · 高光与阴影
      <span>下游</span> 水贴 · 渗线 · 旧化 · 清漆 · 抛光 · 组装
    </div>

    <h4 id="fl-1">1 · 洗件</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>去掉模具残留的脱模剂，让漆能咬住塑料表面。</dd>
      <dt>原理</dt><dd>注塑件表面常残留硅油或硬脂酸锌类脱模剂，它们把塑料的表面能降到 30 mN/m 以下，而涂料需要 38–45 mN/m 才铺得开。表面能不足的直接后果是缩孔和成片剥落。附着力可用划格法（ISO 2409 / ASTM D3359）验证。</dd>
      <dt>材料</dt><dd>中性洗洁精、软毛刷（旧牙刷）、40–50℃ 温水、无绒布。</dd>
      <dt>参数</dt><dd><b>典型值</b>：水温 40–50℃，浸泡 5 分钟，刷洗 1–2 分钟，流水冲净 30 秒。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>拆下不需要喷的零件，分开洗。</li>
        <li>温水加几滴洗洁精，软毛刷顺着表面刷，重点刷凹陷和合模线附近。</li>
        <li>流水冲净，直到水在表面铺成连续水膜。</li>
        <li>无绒布吸干或自然晾干，不要用纸巾擦（留纤维）。</li>
      </ol></dd>
      <dt>判据</dt><dd>冲水时表面是<b>连续水膜</b>，不缩成水珠；晾干后无水痕。水珠说明还有油。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>洗完还是缩孔</b>：脱模剂进了缝隙，用超声波清洗或换更强力的除油剂（异丙醇棉签局部擦）。</li>
        <li><b>零件发白</b>：水温过高或浸泡过久，ABS 表面被洗洁精侵蚀，只能打磨掉。</li>
        <li><b>用手直接拿件</b>：指纹的皮脂比脱模剂更难去除，洗完戴丁腈手套。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>「表面能 38 mN/m」是涂料行业常用的湿润判据（ISO 8296 达因笔可实测）。洗洁精不是万能：硅油类脱模剂需要溶剂型除油剂。</dd>
    </dl>

    <h4 id="fl-2">2 · 修模</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>消除合模线、飞边、缩水，避免漆面出现硬边或塌陷。</dd>
      <dt>原理</dt><dd>漆膜厚度通常只有 20–50 μm，比合模线的高度小一个量级。合模线不会被漆盖住，反而会因为边缘张力变化堆积漆，形成明显的脊。</dd>
      <dt>材料</dt><dd>笔刀、水砂纸 P400 / P800 / P1000 / P1500、打磨棒、补土（如有凹陷）。</dd>
      <dt>参数</dt><dd><b>典型值</b>：P400 去大飞边 → P800 整形 → P1000 精修 → P1500 收面；每级打磨方向与前一级交叉 45°。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>笔刀贴着合模线刮，刀刃与表面约 30°，只刮凸起部分。</li>
        <li>P400 沿合模线方向磨平，注意不要磨圆棱角。</li>
        <li>P800 交叉 45° 打磨，把 P400 的划痕磨掉。</li>
        <li>P1000、P1500 逐级收细，最后用水砂纸湿磨。</li>
        <li>斜光检查，看不到接缝后进入补土。</li>
      </ol></dd>
      <dt>判据</dt><dd>斜 45° 打光，表面无接缝、无砂痕；手指划过无台阶感。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>跳号打磨</b>：P400 直接上 P1000，深层划痕压不住，喷完显现。必须逐级。</li>
        <li><b>把边缘磨圆</b>：直角变圆角，喷完轮廓会「糊」，只能补土重做。</li>
        <li><b>砂纸标号混淆</b>：日本 JIS 的 #400 和欧洲 FEPA 的 P400 不是同一标度，数值相近但粒度不同——买的时候看包装标注体系。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>砂纸粒度有 JIS R6001、FEPA、CAMI 三套体系，同一数字不完全等价。本站标注统一写「P」（FEPA）。</dd>
    </dl>

    <h4 id="fl-3">3 · 假组</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>在喷漆之前确认装配关系、活动范围和需要遮盖的部位。</dd>
      <dt>原理</dt><dd>漆膜有厚度。卡榫与孔的配合间隙通常在 0.05–0.15 mm，两侧各喷 30 μm 正好吃掉这个间隙——喷完插不进去，或者一插就掉漆。</dd>
      <dt>材料</dt><dd>不用胶，必要时用遮盖带临时固定。</dd>
      <dt>参数</dt><dd><b>典型值</b>：配合面预留 0.1 mm 以上；活动关节（球关节、铰链）喷漆前用遮盖带或凡士林隔离。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>按说明书把关键部位插一遍，不粘死。</li>
        <li>标记需要遮盖的配合面（接口、卡榫、转轴）。</li>
        <li>确认哪些面会被遮住、哪些要先喷、哪些必须最后装。</li>
      </ol></dd>
      <dt>判据</dt><dd>能完整拼起来，且知道每个接口喷完是否还装得回去。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>喷完才发现装不上</b>：只能刮漆，等于白喷。</li>
        <li><b>关节喷死</b>：漆膜把球关节粘住，强行活动会崩漆。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>「预留 0.1 mm」是车间经验值，实际取决于漆膜厚度与零件公差，没有行业标准。</dd>
    </dl>

    <h4 id="fl-4">4 · 补土</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>统一底色、填平细微划痕、给面漆提供均匀的附着面。</dd>
      <dt>原理</dt><dd>硝基类补土（郡士 Mr.Surfacer 系列）靠溶剂把塑料表面轻微溶胀，形成机械咬合；同时亚光粗糙面比光滑塑料更容易被面漆润湿。目数越高，填充力越弱、保留细节越好。</dd>
      <dt>材料</dt><dd>郡士 Mr.Surfacer 500（填缝）、1000（通用）、1200（保细节）；瓶装需用黄标稀释剂 1:1.5–1:2，喷罐即用。</dd>
      <dt>参数</dt><dd><b>典型值</b>：气压 1.2–1.5 bar，距离 15–20 cm，薄喷 2–3 道，每道间隔 10–15 分钟；表干约 30 分钟，全干 12–24 小时。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>摇匀（喷罐至少 1 分钟），试喷确认雾化正常。</li>
        <li>第一道极薄，只求附着；间隔 10 分钟。</li>
        <li>第二、三道逐层加厚，湿膜发润即可停手。</li>
        <li>干燥后检查，凹陷处补第二次。</li>
      </ol></dd>
      <dt>判据</dt><dd>表面均匀亚光，无露底亮斑；刻线和铆钉仍然清晰。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>刻线被填平</b>：喷太厚或用了 500 目在细节面上。细节面用 1200。</li>
        <li><b>补土起皱</b>：底层未干就喷第二道，溶剂顶起第一层（俗称咬底）。</li>
        <li><b>干燥慢</b>：低温高湿环境，硝基类溶剂挥发受阻。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>Mr.Surfacer 的目数表示填料粒径级别，不是砂纸粒度，两套体系不可直接换算。</dd>
    </dl>

    <h4 id="fl-5">5 · 补土后打磨</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>去掉补土表面的颗粒和流挂，为面漆提供平整基底。</dd>
      <dt>原理</dt><dd>补土喷完后表面存在「干喷颗粒」（漆雾在半空干燥后落回表面），粒径几十微米，比面漆膜厚还大，不打磨会直接凸出在漆面上。</dd>
      <dt>材料</dt><dd>水砂纸 P1000 / P1500、清水、软布。</dd>
      <dt>参数</dt><dd><b>典型值</b>：湿磨，水保持流动；P1000 去颗粒 → P1500 收面；边角轻压。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>砂纸泡水 10 分钟，湿磨时保持表面有水。</li>
        <li>P1000 打圈磨，重点在颗粒和流挂处。</li>
        <li>P1500 顺一个方向收，消除打磨方向纹。</li>
        <li>冲净、晾干，检查是否磨穿。</li>
      </ol></dd>
      <dt>判据</dt><dd>手摸顺滑，斜光下无亮点（磨穿）和砂眼（凹陷）。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>磨穿露底</b>：边角压力过大。补一层补土再磨。</li>
        <li><b>干磨堵砂纸</b>：粉末糊住磨料，越磨越亮但不掉料。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>湿磨的目的是降温、排屑、减少粉尘；对 ABS 塑料长时间浸水可能影响尺寸稳定性，磨完及时擦干。</dd>
    </dl>

    <h4 id="fl-6">6 · 遮盖准备</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>做出锐利、不渗漆的分色界线。</dd>
      <dt>原理</dt><dd>漆雾是高速运动的小液滴，遇到遮盖带边缘的微小翘起会钻进去，形成锯齿或渗色。压边的作用是把胶带边缘的胶层完全压到表面，消除缝隙。</dd>
      <dt>材料</dt><dd>和纸遮盖带（通用）、乙烯基遮盖带（曲线）、遮盖液、牙签、棉签。</dd>
      <dt>参数</dt><dd><b>典型值</b>：和纸带贴附时间不超过 24–48 小时（胶会转移）；喷涂时喷流方向与带边成 30–45°，<b>从带子往空白处推</b>。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>先贴大面，再补小缝；带子不要拉伸过度。</li>
        <li>牙签沿边压实，重点压实拐角。</li>
        <li>缝隙用遮盖液点封，干后形成胶膜。</li>
        <li>喷涂方向从带边指向空白区域。</li>
        <li>撕带时漆半干（不粘手）再撕，角度 180° 慢拉。</li>
      </ol></dd>
      <dt>判据</dt><dd>撕开后分色线锐利，无锯齿、无渗漆、无残胶。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>渗漆</b>：没压边，或漆太稀（表面张力低，容易爬缝）。</li>
        <li><b>撕掉面漆</b>：底漆附着力不足，或撕太早（漆还湿）。</li>
        <li><b>残胶</b>：带子贴太久，胶转移到漆面，用稀释剂轻擦。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>「24–48 小时」取决于胶种和温湿度，没有统一标准；乙烯基带初粘力更高，但不适合长时间贴附。</dd>
    </dl>

    <h4 id="fl-7">7 · 底漆</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>决定面漆的最终明度和发色偏向。</dd>
      <dt>原理</dt><dd>面漆有半透明性，底层颜色会透出来。白底把面漆往亮处推、黑底往暗处压、灰底最中性；粉色底能提升红黄系的鲜艳感（对红色尤其明显）。</dd>
      <dt>材料</dt><dd>郡士 C1 光泽白、C13 中灰、C2 光泽黑；浅色面漆配白底，深色配黑/灰底。</dd>
      <dt>参数</dt><dd><b>典型值</b>：薄喷 2 道，间隔 10 分钟；白底遮盖力弱，往往需要 3 道。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>确认底漆与补土兼容（同为硝基系最稳）。</li>
        <li>薄喷第一道，只求均匀覆盖。</li>
        <li>第二道加厚到完全盖住补土色。</li>
      </ol></dd>
      <dt>判据</dt><dd>底色均匀，没有透出的补土灰或塑料原色。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>白底盖不住</b>：白色颜料遮盖力天生低，改用浅灰底再上白。</li>
        <li><b>底漆咬底</b>：底漆溶剂把补土溶胀，起皱。等补土全干再喷。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>「粉底提亮红黄」是模型圈经验做法，原理与颜料对可见光谱的选择性反射有关，但没有定量标准。</dd>
    </dl>

    <h4 id="fl-8">8 · 面漆</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>喷出目标色，并控制膜厚与均匀度。</dd>
      <dt>原理</dt><dd>溶剂型漆成膜分两步：溶剂挥发 + 树脂聚结成膜。一次喷太厚，表层先干、内层溶剂来不及逸出，会造成流挂、起皱、后期收缩。</dd>
      <dt>材料</dt><dd>按配方调好的郡士漆、黄标稀释剂、搅拌棒、量杯。</dd>
      <dt>参数</dt><dd><b>典型值</b>：稀释 1:1.5–1:2，气压 1.2–1.5 bar，距离 15–20 cm；每道间隔 10–15 分钟，共 2–3 道；总干膜厚 30–50 μm。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>调漆后静置 1–2 分钟消泡，试喷检查雾化。</li>
        <li>第一道极薄（雾喷），让表面先「抓住」一层。</li>
        <li>第二、三道加厚，走枪匀速、起收都在件外。</li>
        <li>每道之间用斜光检查是否有漏喷。</li>
      </ol></dd>
      <dt>判据</dt><dd>颜色均匀、无流挂、无橘皮；与目标色卡比对 ΔE 在可接受范围（通常 ≤3）。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>流挂</b>：一道太厚或距离太近。等干透打磨重喷。</li>
        <li><b>橘皮</b>：稀释不足、气压偏低、距离太远导致漆雾预干。</li>
        <li><b>盖不住底色</b>：浅色盖深色需要更多道，不要靠加厚解决。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>「干膜 30–50 μm」是模型涂装的常见区间；工业涂装的膜厚标准（如 ISO 12944）按防护等级另行规定，不适用。</dd>
    </dl>

    <h4 id="fl-9">9 · 高光与阴影</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>用明暗和色相变化做出体积感。</dd>
      <dt>原理</dt><dd>人眼通过三样东西判断体积：明度梯度（哪亮哪暗）、色相偏移（暖光亮、冷光暗的互补规律）、边缘软硬（硬光边缘利落，柔光过渡长）。</dd>
      <dt>材料</dt><dd>主色、白（C1）、棕（C7）或冷色（C5/C14）、极稀的稀释比。</dd>
      <dt>参数</dt><dd><b>典型值</b>：高光稀释 1:3，气压 0.8 bar，距离 20–25 cm，面积不超过受光面的 5%；阴影往里压 15–25 个明度。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>先做暗面：从背光侧往交界线推，边缘留软。</li>
        <li>再做亮面：由外向内收，先大面积很淡，再收窄加深。</li>
        <li>高光最后点：只在最凸的位置，面积小、边缘消失。</li>
      </ol></dd>
      <dt>判据</dt><dd>退后两步能看出受光面；高光<b>看不出边界</b>；暗部不发脏。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>高光边界硬</b>：稀释不够或一次喷太浓，只能重做。</li>
        <li><b>暗部发脏</b>：用黑压暗。应改用棕（暖）或冷色（冷光）。</li>
        <li><b>整件发平</b>：明度差不足，至少拉到 30 以上。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>「高光面积 ≤5%」是经验值，与观看距离和模型比例相关，没有行业标准。</dd>
    </dl>


    <h4 id="fl-10">10 · 水贴</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>把标识、编号、图案贴到漆面上，做出「印上去」的效果。</dd>
      <dt>原理</dt><dd>水贴是一层极薄的载膜 + 印刷层。载膜与漆面的光泽差是「银边」的根源：膜面偏亮、漆面亚光时，边缘会反光。软化剂让载膜贴合曲面，设定剂把膜「焊」进漆面。</dd>
      <dt>材料</dt><dd>水贴、温水、棉签、Mr.Mark Setter（定位）、Mr.Mark Softener（软化）。</dd>
      <dt>参数</dt><dd><b>典型值</b>：水温 20–30℃，浸泡 20–40 秒；软化剂只涂在贴好后的表面，不要泡；干燥 12–24 小时再上清漆。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>漆面先做光泽（清漆或亮光面漆），亚光面贴水贴必然银边。</li>
        <li>剪下图案，留 2–3 mm 边，泡到载膜能滑动。</li>
        <li>连纸移到位置，用棉签把水贴从纸上推下来。</li>
        <li>吸干水分，摆正位置；曲面涂软化剂，让它自己服帖。</li>
        <li>干透前不要碰，干后上清漆封住。</li>
      </ol></dd>
      <dt>判据</dt><dd>无银边、无气泡、无褶皱；侧光看不出贴纸厚度。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>银边</b>：贴在亚光面上，或膜下水没排净。解决：光泽底 + 软化和设定剂。</li>
        <li><b>破裂</b>：泡太久或水贴老化，载膜失去强度。</li>
        <li><b>贴完起雾</b>：水没干就上清漆，水被封在下面。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>Setter/Softener 的化学机理是改变载膜的表面张力与溶胀性，属厂方配方，具体成分未公开。</dd>
    </dl>

    <h4 id="fl-11">11 · 渗线</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>把刻线、缝隙、凹槽压深，强化轮廓。</dd>
      <dt>原理</dt><dd>靠毛细作用：低黏度液体沿缝隙自动铺开。珐琅系渗线液（田宫 Panel Line Accent）与硝基漆面不互溶，所以能用 X-20 稀释剂擦掉溢出部分而不伤面漆。</dd>
      <dt>材料</dt><dd>渗线液、X-20 或专用稀释剂、棉签、无绒纸。</dd>
      <dt>参数</dt><dd><b>典型值</b>：面漆上先罩一层光泽清漆再渗线；点入后等 10–20 分钟半干时擦；擦拭力度要轻，只擦平面不擦线。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>确认面漆干透，上一层光泽清漆保护。</li>
        <li>笔尖轻触刻线一端，让液体自己流进去。</li>
        <li>溢出部分等半干，用棉签蘸稀释剂轻擦。</li>
        <li>干透后可罩消光，把反光压下去。</li>
      </ol></dd>
      <dt>判据</dt><dd>线条连续、粗细一致、不晕开；擦过的平面不留痕迹。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>擦出面漆</b>：没做光泽保护层，稀释剂直接咬了面漆。</li>
        <li><b>渗不进去</b>：刻线太浅或已被补土填平，先用刻线刀走一遍。</li>
        <li><b>整片发脏</b>：渗线液太稀或擦太晚（已完全干硬）。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>「珐琅不与硝基互溶」是相对而言：长时间浸泡仍会软化硝基漆膜，擦拭要及时。</dd>
    </dl>

    <h4 id="fl-12">12 · 旧化</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>让模型看起来被使用过——而不是刚拆盒。</dd>
      <dt>原理</dt><dd>真实使用痕迹有规律：磨损集中在凸起和受力面，脏污集中在缝隙和下缘，锈从积水处往下流。旧化就是按这个分布做「不均匀」。</dd>
      <dt>材料</dt><dd>海绵（掉漆）、油画颜料 + 无味稀释剂（流锈、滤镜）、粉彩（泥土）、固定剂。</dd>
      <dt>参数</dt><dd><b>典型值</b>：掉漆从轻到重分 2–3 层，每层干透再叠；流锈用 1:5 以上极稀颜料；粉彩最后上，喷固定剂时距离 30 cm 以上、薄雾。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>先想清楚这件东西「在哪用过」：沙漠、雨天、城市。</li>
        <li>掉漆：海绵蘸漆轻拍，只拍棱边和活动部位。</li>
        <li>流锈：从锈源向下点一条极稀的锈色，让它自己流。</li>
        <li>泥土：粉彩刷在下缘和轮胎纹路，方向一致。</li>
        <li>每层干透再叠，宁可少不可多。</li>
      </ol></dd>
      <dt>判据</dt><dd>远看有层次，近看有细节；脏污集中在下缘和边角，不是全件均匀。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>全件均匀做旧</b>：成了「灰色滤镜」，等于没有旧化。</li>
        <li><b>颜料擦不掉</b>：底漆没做光泽隔离，颜料咬进面漆。</li>
        <li><b>粉彩被固定剂冲掉</b>：喷太近或太湿。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>旧化没有客观标准，属于美术判断；本站只描述常用手法与材料，不评价「像不像」。</dd>
    </dl>

    <h4 id="fl-13">13 · 清漆</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>统一光泽、保护水贴与旧化层、便于后续处理。</dd>
      <dt>原理</dt><dd>清漆是透明树脂溶液，成膜后形成连续层。消光靠加入消光粉（二氧化硅类）造成表面微观粗糙，入射光漫反射。消光粉密度大，静置会沉降，用前必须摇匀。</dd>
      <dt>材料</dt><dd>郡士 C46 光泽、C30 消光剂、C181 半光（或自调）；稀释剂。</dd>
      <dt>参数</dt><dd><b>典型值</b>：稀释 1:1–1:1.5，气压 1.5 bar，距离 20 cm；两道薄喷 + 一道稍湿；相对湿度 <70%。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>摇匀（消光漆尤其重要），静置消泡。</li>
        <li>薄喷两道，间隔 10 分钟。</li>
        <li>最后一道稍湿，让表面流平，但不要湿到发亮。</li>
        <li>完全固化 24 小时后再组装或抛光。</li>
      </ol></dd>
      <dt>判据</dt><dd>侧光下无反光断差、无橘皮、无发白。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>白化</b>：湿度高，溶剂挥发带走热量，水汽凝结。等湿度降下来重喷。</li>
        <li><b>光泽不均</b>：消光粉没摇匀，喷出来一块亮一块哑。</li>
        <li><b>流挂</b>：最后一道贪厚。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>「湿度 <70%」是经验门槛，实际与温度、溶剂挥发速率相关；工业上有露点计算（露点温度与表面温度差 ≤3℃ 为安全），更严谨。</dd>
    </dl>

    <h4 id="fl-14">14 · 抛光</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>去掉清漆表面的细微颗粒，做出镜面光泽。</dd>
      <dt>原理</dt><dd>抛光是用更细的磨料逐级削平表面凸起，把漫反射变成镜面反射。粗磨料去划痕、细磨料出亮度，跳级会留下无法消除的细纹。</dd>
      <dt>材料</dt><dd>打磨膏（粗 → 细）、软布、棉签、清水。</dd>
      <dt>参数</dt><dd><b>典型值</b>：粗膏打圈 → 细膏顺一个方向收；每次换膏前清洁表面；只对光泽漆面做。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>清漆完全固化（至少 24 小时）。</li>
        <li>粗膏用软布打圈，重点在有颗粒的区域。</li>
        <li>擦净后换细膏，方向一致，收出亮度。</li>
        <li>最后用清水冲净残膏。</li>
      </ol></dd>
      <dt>判据</dt><dd>迎光看是连续反光，没有雾面斑块和划痕。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>磨穿清漆</b>：力度过大或漆膜太薄，露出下面颜色。</li>
        <li><b>消光面被抛光</b>：磨成本地亮斑，只能重喷消光。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>模型用打磨膏没有统一粒度标号，实际效果取决于磨料粒径（通常从十几微米到亚微米）。</dd>
    </dl>

    <h4 id="fl-15">15 · 组装</h4>
    <dl class="fl-dl">
      <dt>目的</dt><dd>把分件装回去，不破坏漆面。</dd>
      <dt>原理</dt><dd>漆膜增加了零件尺寸，配合从「间隙」变成「过盈」。强行插入会把漆膜挤裂，裂纹从接口扩散到漆面。</dd>
      <dt>材料</dt><dd>笔刀、砂纸、模型胶（ABS 用）、瞬间胶（少量）、遮盖带。</dd>
      <dt>参数</dt><dd><b>典型值</b>：接口处刮掉 0.05–0.1 mm 漆膜；瞬间胶用量控制在针尖大小，避免白化。</dd>
      <dt>操作</dt>
      <dd><ol>
        <li>试插，找出过紧的位置。</li>
        <li>用笔刀刮掉接口内侧的漆，再试。</li>
        <li>需要粘的地方用模型胶点粘，不要整面涂。</li>
        <li>活动件装好后活动几次，确认不涩。</li>
      </ol></dd>
      <dt>判据</dt><dd>接缝紧密、不掉漆、活动件能正常转动。</dd>
      <dt>常见问题</dt>
      <dd><ul>
        <li><b>硬插崩漆</b>：最常见，且无法局部修复。</li>
        <li><b>瞬间胶白化</b>：用量多或湿度高，在漆面留下白霜。</li>
      </ul></dd>
      <dt>严谨说明</dt><dd>「0.05–0.1 mm」是经验值。零件公差大的套件，需要按实际试插结果调整。</dd>
    </dl>

    <p class="sd-lead" style="margin-top:18px;padding-top:12px;border-top:1px dashed var(--line);font-size:11.5px">
      以上参数中，标注「典型值」的是车间与模型圈的通行做法，会随漆种、比例、温湿度变化；
      标注「标准」的（如 ISO 2409 附着力、ISO 8296 表面张力、FEPA 砂纸粒度）是可查的规范。
      两者请不要混用。
    </p>
  `,


    about: `
    <h4 id="ab-intro">关于这个站</h4>

    <p class="sd-lead">
      你手上有一盒郡士漆，屏幕上有——或者心里有一个——想要的颜色。<br>
      问题是：这中间差多少，该加哪几支，各加几滴。
    </p>
    <p class="sd-lead"><b>这个站回答的就是这个问题。</b></p>

    <h5 class="gl-h">为什么会有它</h5>
    <p class="sd-lead">
      市面上的调色工具大多把颜色当 RGB 数字直接平均，混出来会偏暗、偏灰——因为颜料混合不是三盏灯叠加。
      通用色卡也不认郡士的漆号，给不出"加 C39 几滴"这种答案。
    </p>
    <p class="sd-lead">
      所以这里换了一套：用 <b>226 支郡士漆的实际色值</b>，在 CIELAB 空间里做 Kubelka-Munk 混合，
      最后用<b>人眼尺度</b>的 ΔE 告诉你差多少。
    </p>

    <h5 class="gl-h">它解决三件事</h5>
    <ol class="gl-ul">
      <li><b>复刻</b>：看到一个颜色，想用郡士漆调出来。</li>
      <li><b>受限</b>：手上只有几支漆，在这些漆里找最接近的组合。</li>
      <li><b>验证</b>：调完想知道和目标的差，以及差在哪——偏黄、偏暗，还是发灰。</li>
    </ol>

    <h5 class="gl-h">它凭什么算</h5>
    <ul class="gl-ul">
      <li>在 <b>CIELAB</b> 里算，不在 RGB 里算。RGB 平均不符合颜料的混色规律，会越混越脏。</li>
      <li>用 <b>Kubelka-Munk 单常数</b>模型——涂料行业描述"颜料怎么混合"的标准近似。</li>
      <li>色差用 <b>CIEDE2000</b>：按人眼对明度、彩度、色相的敏感度加权，不是简单的直线距离。</li>
      <li>漆色数据是 226 支郡士漆的色值，<b>屏幕近似值，不是分光仪实测</b>。</li>
    </ul>

    <h5 class="gl-h">它不装懂</h5>
    <ul class="gl-ul">
      <li>屏幕上的漆色和真实漆膜有差距，<b>整体按 ±3 ΔE 看待</b>；正式上色前先打小样。</li>
      <li>照片反推受光线、白平衡、镜头影响，<b>只能看方向，不能当测量</b>。</li>
      <li>信噪比页的阈值（结构占比、中心占比等）<b>没有行业标准</b>，只适合改前改后自己比。</li>
      <li>金属、珠光、透明的表现是<b>规则模拟</b>，不是物理仿真。</li>
      <li>它<b>不生成喷涂方案</b>。技法因人、因件、因漆而异，写死的步骤只会误导。</li>
    </ul>

    <h5 class="gl-h">怎么开始</h5>
    <p class="sd-lead">
      选一个颜色 → 勾 3 支你确实有的漆 → 看配方 → 调 2ml 小样 → 喷废板。<br>
      第一次别贪多。<b>三支漆能调到 ΔE 5 以内，就已经能用了。</b>
    </p>

    <h5 class="gl-h">一句话</h5>
    <p class="sd-lead">
      它是个计算器，不是老师。<b>能算的算准，算不准的直说。</b>
    </p>

    <p class="sd-lead" style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--line);color:var(--ink-3);font-size:11.5px">
      纯前端实现，无后端、无账号、无追踪。所有计算在你的浏览器里完成，图片不会上传。
      打开 <code>index.html</code> 即可离线使用。
    </p>
  `,

  glossary: `
    <h4 id="gl-intro">名词解释</h4>
    <p class="sd-lead">
      这个站里出现的词，按四组排。每条一两句话，看不懂的再往下翻。
    </p>

    <h5 class="gl-h">一、颜色与测量</h5>
    <dl class="gl-list">
      <dt>sRGB</dt>
      <dd>电脑和手机默认的颜色空间。屏幕、照片、色卡上的十六进制值都是 sRGB。</dd>

      <dt>Lab（CIELAB）</dt>
      <dd>和人眼感受更接近的颜色坐标：L 是明度（0–100），a 是红绿轴，b 是黄蓝轴。算色差用它，比直接比 RGB 准。</dd>

      <dt>L*</dt>
      <dd>Lab 里的明度。0 是黑，100 是白。同一个颜色喷厚喷薄，L* 会变。</dd>

      <dt>色相角</dt>
      <dd>颜色在色环上的角度，0° 红、90° 黄、180° 绿、270° 蓝。同一个色相改深浅，色相角几乎不变。</dd>

      <dt>彩度（C）</dt>
      <dd>颜色有多"艳"。C 高＝鲜艳，C 低＝发灰。加白、加黑、加灰都会掉彩度。</dd>

      <dt>ΔE（色差）</dt>
      <dd>两个颜色差多少。日常判断：<b>≤2 肉眼看不出</b>，3–5 能看出，5 以上一眼分得开。本站用 CIEDE2000 公式。</dd>

      <dt>D65</dt>
      <dd>标准日光（约 6500K），颜色计算的参考光源。屏幕上的白色按它定义。</dd>

      <dt>色温</dt>
      <dd>光源偏暖还是偏冷，单位 K。3000K 偏黄（白炽灯），5500K 接近日光，7000K 偏蓝（阴天）。</dd>
    </dl>

    <h5 class="gl-h">二、调色</h5>
    <dl class="gl-list">
      <dt>漆号</dt>
      <dd>郡士的编号，C 开头是光泽漆（C39），后面跟编号。同一个编号不同光泽是两支不同的漆。</dd>

      <dt>稀释比</dt>
      <dd>漆和稀释剂的比例。写 1:1.5 就是 1 份漆加 1.5 份稀释剂。<b>比例是起点，不是标准</b>——同一支漆放久了会变稠。</dd>

      <dt>毫升 / 滴</dt>
      <dd>配方里的用量。本站按滴算时，1 滴≈0.04 ml，2ml 大约 50 滴。</dd>

      <dt>配方</dt>
      <dd>从哪支漆出发、加别的漆多少。本站给的是"加法配方"，不是从零配。</dd>

      <dt>遮盖力</dt>
      <dd>漆盖住底色的能力。浅色盖深色要喷更多层，深色盖浅色容易。</dd>

      <dt>光泽 / 半光 / 消光</dt>
      <dd>表面反光程度。同一个颜色三种光泽，看着完全不同，买错光泽颜色对也没用。</dd>
    </dl>

    <h5 class="gl-h">三、喷涂</h5>
    <dl class="gl-list">
      <dt>走枪</dt>
      <dd>喷笔匀速移动。起枪和收枪都要在零件外面，不然两端会积漆。</dd>

      <dt>雾喷 / 湿喷</dt>
      <dd>雾喷是远距离薄薄一层（几乎看不见），湿喷是近距离喷到表面发润。</dd>

      <dt>干喷</dt>
      <dd>漆在半空就干了，落到表面成颗粒。原因：距离太远、气压太高、稀释不够。</dd>

      <dt>橘皮</dt>
      <dd>表面像橘子皮一样的细密凹凸。原因：稀释不足、气压不够、喷得太厚。</dd>

      <dt>流挂</dt>
      <dd>漆太多往下淌，形成一道道痕。只能等干透后打磨掉重喷。</dd>

      <dt>白化</dt>
      <dd>漆膜发白起雾，多发生在湿度高的时候（水汽混进漆里）。</dd>

      <dt>渗色</dt>
      <dd>两种颜色交界处糊开。原因：遮盖带没压边、漆太稀。</dd>

      <dt>遮盖带 / 压边</dt>
      <dd>分色时贴的胶带。贴完要用牙签沿边压实，否则漆会渗进去。</dd>

      <dt>水补土</dt>
      <dd>喷涂前的底漆，用来统一底色、检查表面瑕疵。</dd>
    </dl>

    <h5 class="gl-h">四、图像分析</h5>
    <dl class="gl-list">
      <dt>卷积</dt>
      <dd>拿一个小窗口在图上滑动，每个位置做加权求和。模糊、找边、算梯度都是卷积。</dd>

      <dt>Sobel（索贝尔算子）</dt>
      <dd>一种 3×3 卷积核，用来算亮度梯度——梯度大的地方就是边。</dd>

      <dt>分区</dt>
      <dd>把图切成颜色相近的若干块。本站按 Lab 色差生长，同色才连在一起。</dd>

      <dt>结构占比</dt>
      <dd>对比能量落在形体（大块面）上的比例。低说明刻线、水贴、颗粒在抢戏。<b>没有行业标准，只能改前改后比。</b></dd>

      <dt>颜色熵</dt>
      <dd>画面里有多少种明显不同的颜色，单位 bit。照片常见 4.6–5.2。平涂插画会低很多。</dd>

      <dt>鲜艳度</dt>
      <dd>Hasler–Süsstrunk 公式算出的整体色彩强度，照片常见 44–50。</dd>

      <dt>相干度</dt>
      <dd>光的方向有多一致。接近 1 说明只有一个主光，接近 0 说明没有主光、方向不可信。</dd>

      <dt>明暗分离</dt>
      <dd>在每块区域内用大核卷积找趋势，再按偏离程度分出高光和阴影。</dd>
    </dl>
`,

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

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <rect x="6" y="54" width="208" height="16" fill="#C89B6A"/>
            <circle cx="60" cy="62" r="2.4" fill="#8B5E3C"/>
            <circle cx="92" cy="58" r="2" fill="#8B5E3C"/>
            <circle cx="128" cy="64" r="2.6" fill="#8B5E3C"/>
            <circle cx="160" cy="59" r="1.8" fill="#8B5E3C"/>
            <text x="20" y="26" class="ab-fig-t">针尖大小的小坑</text>
          </svg>
          <h5>针孔</h5>
          <p class="sym"><b>断面</b>　漆膜里有细小的贯穿孔，露出底层。</p>
          <p><b>长什么样</b>　密密麻麻针尖大的小凹点，侧光看像砂纸。</p>
          <p><b>原因</b>　底材有油或水；漆太稠、气泡没消；喷太厚，表层先结膜、溶剂从下面顶破。</p>
          <p><b>处理</b>　干透后 P1000 湿磨，重新薄喷；底材彻底除油除湿。</p>
          <p><b>预防</b>　调漆后静置消泡、底材干净干燥、薄喷多层。</p>
        </article>

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <rect x="6" y="56" width="208" height="14" fill="#C89B6A"/>
            <path d="M40 56 l6 -10 l7 10 M70 56 l5 -8 l6 8 M110 56 l7 -11 l6 11 M150 56 l5 -9 l6 9" fill="none" stroke="#8B5E3C" stroke-width="1.4"/>
            <text x="20" y="26" class="ab-fig-t">表面裂成网状</text>
          </svg>
          <h5>龟裂</h5>
          <p class="sym"><b>断面</b>　漆膜表层开裂，裂缝呈网状或羽毛状。</p>
          <p><b>长什么样</b>　细密裂纹，像干涸的泥地。</p>
          <p><b>原因</b>　底层没干透就叠层，溶剂被封在下面；或厚涂导致表里收缩不一致；弱溶剂面漆盖在强溶剂底漆上也会。</p>
          <p><b>处理</b>　无法局部修复，只能剥离重喷。</p>
          <p><b>预防</b>　每层干透（12–24 小时）再叠；强溶剂在下、弱溶剂在上。</p>
        </article>

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <rect x="6" y="54" width="208" height="16" fill="#C89B6A"/>
            <rect x="6" y="48" width="208" height="6" fill="#E4E0D6" opacity=".85"/>
            <text x="20" y="26" class="ab-fig-t">表面浮一层白霜</text>
          </svg>
          <h5>粉化 / 起霜</h5>
          <p class="sym"><b>断面</b>　漆膜表面析出一层粉状或霜状物。</p>
          <p><b>长什么样</b>　擦一下手上有白粉；消光件尤其明显。</p>
          <p><b>原因</b>　消光粉加多了或没摇匀；湿度高时溶剂挥发吸热、水汽凝结；长期日晒老化。</p>
          <p><b>处理</b>　轻微擦掉后罩一层清漆；严重的打磨重喷。</p>
          <p><b>预防</b>　消光漆用前摇匀、湿度低于 70%、避免暴晒。</p>
        </article>

        <article>
          <svg class="defect" viewBox="0 0 220 96" aria-hidden="true">
            <rect x="6" y="70" width="208" height="18" fill="#DCD5C7"/>
            <rect x="6" y="54" width="104" height="16" fill="#B4530A"/>
            <rect x="110" y="54" width="104" height="16" fill="#C97A3E"/>
            <text x="20" y="26" class="ab-fig-t">同一块漆两边不同色</text>
          </svg>
          <h5>褪色 / 变色</h5>
          <p class="sym"><b>断面</b>　漆膜颜色随时间变浅或偏移。</p>
          <p><b>长什么样</b>　和刚喷时比明显发黄、发灰或变淡。</p>
          <p><b>原因</b>　紫外线和氧化；清漆黄变（硝基清漆尤其）；颜料耐光性差异（红色系最敏感）。</p>
          <p><b>处理</b>　无法还原，只能重喷；展示时避免阳光直射。</p>
          <p><b>预防</b>　避光存放；耐光性差的颜色用抗 UV 清漆罩面。</p>
        </article>

      </div>

          <div class="ab-principle">
      <h4>三条通用原则</h4>
      <p><b>1. 先停手，别趁湿补救。</b>　湿的时候动它只会越弄越糟，等干了再处理。</p>
      <p><b>2. 打磨是最后手段。</b>　每磨一次就少一层漆，磨穿底色就得从头来。</p>
      <p><b>3. 同一个问题连着出两次，先停。</b>　多半是漆或设备的状态变了（稠了、堵了、湿度上来了），不是手的问题。</p>
    </div>`
,

  art: `<div class="ab-cards">
        <article>
          <h5>① 只能同系相混</h5>
          <p><b>可以混</b>　硝基之间（Mr.Color C 系、GX 系）可以任意互调；水性之间（Acrysion 等）也可以。</p>
          <p><b>不要混</b>　硝基 + 水性会分层、结块，喷出来是颗粒。</p>
          <p>拿不准就分开调，最后一层再统一罩光。</p>
        </article>

        <article>
          <h5>② 稀释剂必须对号</h5>
          <p>硝基漆用硝基稀释剂，水性用水性稀释剂。用错会起絮、发白。</p>
          <p>不同品牌的稀释剂通用性不一，换品牌先在废件上试。</p>
        </article>

        <article>
          <h5>③ 光泽会「传染」</h5>
          <p>往光泽漆里加一点消光，整罐就变成半光——<b>光泽是混出来的，不是喷出来的</b>。</p>
          <p>要保光泽，色漆阶段别掺消光，靠最后罩一层光泽保护漆决定。</p>
        </article>

        <article>
          <h5>④ 金属漆别掺实色</h5>
          <p>实色漆会盖住金属颗粒，金属感直接消失，剩下的只是「带点亮片的灰」。</p>
          <p>调金属色，用金属互调；实在要改，加同系金属银稀释强度。</p>
        </article>

        <article>
          <h5>⑤ 透明色是「罩」出来的</h5>
          <p>透明红叠在银色上 = 伪电镀；叠在实色上会发浑、发闷。</p>
          <p>透明色负责「染色」，不负责「遮色」——底下是什么，最后就透出什么。</p>
        </article>

        <article>
          <h5>⑥ 底漆决定发色</h5>
          <p><b>白底</b>最亮最艳，适合鲜艳色和白色机体；<b>灰底</b>最中性，判断颜色最准；<b>黑底</b>最沉，颜色会暗一档。</p>
          <p>金属色垫黑底会更亮更「金属」，垫白底会发粉。</p>
        </article>
      </div>

      <div class="ab-principle">
        <h4>一句话总结</h4>
        <p><b>同系相混、稀释剂对号、光泽靠罩光、金属别掺色、透明只染色、底色定发色。</b></p>
        <p>六条里最容易翻车的是第一条和第三条：混错系直接报废，掺了消光没法救回来。</p>
      </div>

      <h4>信噪比：为什么有的模型「脏」</h4>
      <p class="sd-lead">
        一件模型上的「信息」包括：分色线、水贴、旧化、金属边、渗线、迷彩。
        信噪比 = <b>想让人看的那个区域的信息 ÷ 整件的总信息</b>。
      </p>

      <div class="ab-cards">
        <article>
          <h5>① 焦点要「吵」，其余要「安静」</h5>
          <p>人的眼睛只会停在一个地方。头部、武器、胸口标志——选一个做密集处理，其它地方降下来。</p>
          <p>通体细节拉满，等于没有焦点，看起来就是「糊」。</p>
        </article>

        <article>
          <h5>② 通体高对比 = 显脏</h5>
          <p>每块装甲都有高光、都有阴影、都有旧化，大脑就无法判断哪个是主体。</p>
          <p>对比度是预算，花在焦点上，别的地方要省。</p>
        </article>

        <article>
          <h5>③ 三个降噪手段</h5>
          <p><b>压暗</b>　次要区域整体加一层暗色，退到后面去。</p>
          <p><b>降饱和</b>　把次要区域的颜色调灰，注意力自然移开。</p>
          <p><b>少做旧化</b>　旧化是最吵的信息，次要区域保持干净。</p>
        </article>

        <article>
          <h5>④ 水贴和分色线也是「信息」</h5>
          <p>贴满水贴的机体不需要再多做旧化，反过来也一样。</p>
          <p>加一样东西之前，先想清楚要挤掉哪一样。</p>
        </article>
      </div>

      <h4>美术的基本原则</h4>

      <div class="ab-cards">
        <article>
          <h5>① 明度优先于颜色</h5>
          <p>把照片转成黑白，如果体积还看得出来，说明明度对了；看不出来，颜色再准也是平的。</p>
          <p>配色之前先定明度阶梯。</p>
        </article>

        <article>
          <h5>② 对比有三个轴</h5>
          <p><b>明度</b>　亮对暗；<b>色相</b>　红对绿；<b>饱和</b>　艳对灰。</p>
          <p>新手最容易只用色相对比，结果颜色打架、明度却一样平。</p>
        </article>

        <article>
          <h5>③ 冷暖是相对的</h5>
          <p>「暖光冷影」是惯例，不是定律：单一主光、补光温度相反时才成立。</p>
          <p>阴天、逆光、彩色环境下要反着来。</p>
        </article>

        <article>
          <h5>④ 60-30-10</h5>
          <p>主色约六成，辅色三成，点缀一成。</p>
          <p>点缀超过两成就不再是点缀，画面会散。</p>
        </article>

        <article>
          <h5>⑤ 焦点只能有一个</h5>
          <p>一加一大于二的前提是观众知道看哪。<b>两个焦点等于没有焦点。</b></p>
        </article>

        <article>
          <h5>⑥ 留白让细节更有力</h5>
          <p>大面积素色不是偷懒，是给细节留出对比背景。</p>
          <p>整件都是细节，细节就不再是细节。</p>
        </article>
      </div>

      <div class="ab-principle">
        <h4>这些原则怎么用在喷漆上</h4>
        <p><b>1.</b> 先定光源和明度阶梯，再选颜色。</p>
        <p><b>2.</b> 主色占大面积，点缀色只出现在小面积（天线、标识、武器）。</p>
        <p><b>3.</b> 高光与阴影的差距要稳住：相邻两档明度差 8–12 就够，超过就假。</p>
        <p><b>4.</b> 每加一层（旧化、水贴、金属边），问一句「它抢了谁的注意力」。</p>
      </div>`
};
