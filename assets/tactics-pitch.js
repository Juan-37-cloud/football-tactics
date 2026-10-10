/* 球场渲染模块：负责画球场、球员站位与战术图层
   对外暴露 TacticsPitch.create(svg, options) → { render(state, layers) } */
(function (global) {
  'use strict';

  var T = global.TACTICS;
  var NS = 'http://www.w3.org/2000/svg';

  /* 球场几何：105m x 68m，按 10px/米 画到 1050 x 680 的 viewBox 里 */
  var W = 1050, H = 680, PAD = 14;
  var PW = W - PAD * 2, PH = H - PAD * 2;
  var CX = W / 2, CY = H / 2;
  var PXS = PW / 105, PYS = PH / 68, PRS = (PXS + PYS) / 2;
  var GOAL_HALF = 3.66 * PYS;
  var PA_DEPTH = 16.5 * PXS, PA_HALF = 20.16 * PYS;
  var GA_DEPTH = 5.5 * PXS, GA_HALF = 9.16 * PYS;
  var SPOT_D = 11 * PXS, CIRCLE_R = 9.15 * PRS;
  /* 罚球弧与罚球区线的交点，距中线 7.31m */
  var ARC_HALF = Math.sqrt(Math.max(0, Math.pow(9.15, 2) - Math.pow(16.5 - 11, 2))) * PYS;

  /* 不同容器宽度对应的球员标记尺寸 */
  var SCALES = [
    { min: 720, dot: 21, num: 23, role: 19, halo: 5.5, roles: true },
    { min: 560, dot: 26, num: 28, role: 24, halo: 6.5, roles: false },
    { min: 400, dot: 33, num: 35, role: 30, halo: 8, roles: false },
    { min: 0, dot: 42, num: 45, role: 38, halo: 9.5, roles: false }
  ];

  function tx(n) { return PAD + n * PW; }
  function ty(n) { return PAD + n * PH; }

  function mk(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    if (attrs) { for (var k in attrs) { node.setAttribute(k, attrs[k]); } }
    if (parent) { parent.appendChild(node); }
    return node;
  }

  function mkText(attrs, text, parent) {
    var node = mk('text', attrs, parent);
    node.textContent = text;
    return node;
  }

  function toneVar(tone) {
    if (tone === 'def') return 'var(--tone-def)';
    if (tone === 'lane') return 'var(--tone-lane)';
    return 'var(--tone-att)';
  }

  function reducedMotion() {
    return typeof global.matchMedia === 'function' &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* 跑动点的渐变按色调分开生成，取色一律走 CSS 变量，深浅主题共用一套定义 */
  function toneKey(tone) {
    if (tone === 'def') return 'def';
    if (tone === 'lane') return 'lane';
    return 'att';
  }

  /* 彗尾轮廓：以核半径 r 归一，尾尖朝 -x（即航向的反方向）收细 */
  function tailPath(r) {
    function px(k) { return (r * k).toFixed(2); }
    return 'M' + px(-0.5) + ',' + px(-0.66) +
      ' C' + px(-1.5) + ',' + px(-0.62) + ' ' + px(-2.05) + ',' + px(-0.3) + ' ' + px(-2.6) + ',0' +
      ' C' + px(-2.05) + ',' + px(0.3) + ' ' + px(-1.5) + ',' + px(0.62) + ' ' + px(-0.5) + ',' + px(0.66) + ' Z';
  }

  function drawSurface(g) {
    mk('rect', { x: 0, y: 0, width: W, height: H, rx: 16, fill: 'var(--pitch)' }, g);
    var stripes = 10, step = PW / stripes;
    for (var s = 0; s < stripes; s++) {
      if (s % 2) mk('rect', { x: PAD + s * step, y: PAD, width: step, height: PH, fill: 'var(--pitch-stripe)' }, g);
    }
    mk('rect', { x: 0, y: 0, width: W, height: H, rx: 16, fill: 'none', stroke: 'var(--line)', 'stroke-opacity': 0.35, 'stroke-width': 3 }, g);
  }

  function drawMarkings(g) {
    var line = { 'class': 'pw-line' };
    mk('rect', Object.assign({}, line, { x: PAD, y: PAD, width: PW, height: PH }), g);
    mk('line', Object.assign({}, line, { x1: CX, y1: PAD, x2: CX, y2: PAD + PH }), g);
    mk('circle', Object.assign({}, line, { cx: CX, cy: CY, r: CIRCLE_R }), g);
    mk('circle', { cx: CX, cy: CY, r: 4.5, fill: 'var(--line)' }, g);

    [1, -1].forEach(function (side) {
      var edge = side > 0 ? PAD : PAD + PW;
      var dir = side > 0 ? 1 : -1;
      /* 罚球区、球门区 */
      mk('rect', Object.assign({}, line, { x: side > 0 ? edge : edge - PA_DEPTH, y: CY - PA_HALF, width: PA_DEPTH, height: PA_HALF * 2 }), g);
      mk('rect', Object.assign({}, line, { x: side > 0 ? edge : edge - GA_DEPTH, y: CY - GA_HALF, width: GA_DEPTH, height: GA_HALF * 2 }), g);
      /* 罚球点 */
      mk('circle', { cx: edge + dir * SPOT_D, cy: CY, r: 4, fill: 'var(--line)' }, g);
      /* 罚球弧 */
      var ax = edge + dir * PA_DEPTH;
      mk('path', { 'class': 'pw-line', d: 'M' + ax + ',' + (CY - ARC_HALF) + ' A' + CIRCLE_R + ',' + CIRCLE_R + ' 0 0 ' + (side > 0 ? 1 : 0) + ' ' + ax + ',' + (CY + ARC_HALF) }, g);
      /* 球门 */
      mk('rect', { x: side > 0 ? PAD - 10 : PAD + PW, y: CY - GOAL_HALF, width: 10, height: GOAL_HALF * 2, rx: 2, fill: 'var(--line)', 'fill-opacity': 0.55 }, g);
    });

    /* 角球弧 */
    var cr = 1 * PRS;
    mk('path', { 'class': 'pw-line', d: 'M' + (PAD + cr) + ',' + PAD + ' A' + cr + ',' + cr + ' 0 0 1 ' + PAD + ',' + (PAD + cr) }, g);
    mk('path', { 'class': 'pw-line', d: 'M' + (PAD + PW - cr) + ',' + PAD + ' A' + cr + ',' + cr + ' 0 0 0 ' + (PAD + PW) + ',' + (PAD + cr) }, g);
    mk('path', { 'class': 'pw-line', d: 'M' + PAD + ',' + (PAD + PH - cr) + ' A' + cr + ',' + cr + ' 0 0 1 ' + (PAD + cr) + ',' + (PAD + PH) }, g);
    mk('path', { 'class': 'pw-line', d: 'M' + (PAD + PW) + ',' + (PAD + PH - cr) + ' A' + cr + ',' + cr + ' 0 0 0 ' + (PAD + PW - cr) + ',' + (PAD + PH) }, g);
  }

  /* 三区划分：本方三区 / 中场三区 / 进攻三区 */
  function drawThirds(g) {
    var thirds = [
      { from: 0, to: 1 / 3, label: '本方三区' },
      { from: 1 / 3, to: 2 / 3, label: '中场三区' },
      { from: 2 / 3, to: 1, label: '进攻三区' }
    ];
    thirds.forEach(function (t) {
      mk('rect', { x: tx(t.from), y: PAD, width: tx(t.to) - tx(t.from), height: PH, fill: 'var(--line)', 'fill-opacity': 0.03 }, g);
      mkText({ 'class': 'pw-third-label', x: (tx(t.from) + tx(t.to)) / 2, y: PAD + 26 }, t.label, g);
    });
    [1 / 3, 2 / 3].forEach(function (x) {
      mk('line', { x1: tx(x), y1: PAD, x2: tx(x), y2: PAD + PH, stroke: 'var(--line)', 'stroke-opacity': 0.35, 'stroke-width': 2, 'stroke-dasharray': '10 9' }, g);
    });
    mkText({ 'class': 'pw-axis-label pw-axis-label--home', x: PAD + 14, y: PAD + 26 }, '← 本方球门', g);
    mkText({ 'class': 'pw-axis-label pw-axis-label--away', x: PAD + PW - 14, y: PAD + 26, 'text-anchor': 'end' }, '对方球门 →', g);
  }

  function drawArrowDefs(defs) {
    /* 箭头明暗：沿箭头方向由亮到暗，给实心箭头体积感，又不像白色高光那样冲淡本色 */
    var shade = mk('linearGradient', { id: 'pw-arrow-shade', x1: '0', y1: '0', x2: '0.55', y2: '1' }, defs);
    mk('stop', { 'class': 'pw-shade-a', offset: '0' }, shade);
    mk('stop', { 'class': 'pw-shade-b', offset: '1' }, shade);
    /* 橙/蓝：细长矛形实心箭头＝球员的跑动方向；两侧带弧度的矛形比直线菱形更利落 */
    var blade = 'M1.1,1.5 Q6.9,3.2 12.2,6.5 Q6.9,9.8 1.1,11.5 Q3.6,6.5 1.1,1.5 Z';
    /* 脊背一道细高光，像金属反光，让实心色块有质地 */
    var glint = 'M3.1,3.2 Q7.2,4.6 10.3,6.4';
    ['att', 'def'].forEach(function (tone) {
      var m = mk('marker', {
        id: 'pw-arrow-' + tone, viewBox: '0 0 13 13', refX: 12.2, refY: 6.5,
        markerWidth: 13, markerHeight: 13, markerUnits: 'userSpaceOnUse', orient: 'auto'
      }, defs);
      mk('path', {
        d: blade, fill: toneVar(tone), stroke: 'var(--arrow-rim)', 'stroke-width': 0.85,
        'stroke-linejoin': 'round'
      }, m);
      mk('path', { d: blade, fill: 'url(#pw-arrow-shade)' }, m);
      mk('path', {
        d: glint, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.38,
        'stroke-width': 0.7, 'stroke-linecap': 'round'
      }, m);
    });
    /* 线路色：空心圆环收尾（环心留空、外加深色细边），代替三角箭头，避免与实心圆点（球员/对手）混淆 */
    var beacon = mk('marker', {
      id: 'pw-arrow-lane', viewBox: '0 0 13 13', refX: 6.5, refY: 6.5,
      markerWidth: 13, markerHeight: 13, markerUnits: 'userSpaceOnUse', orient: 'auto'
    }, defs);
    mk('circle', { cx: 6.5, cy: 6.5, r: 4.1, fill: 'none', stroke: 'var(--arrow-rim)', 'stroke-width': 3.1 }, beacon);
    mk('circle', { cx: 6.5, cy: 6.5, r: 4.1, fill: 'none', stroke: toneVar('lane'), 'stroke-width': 2 }, beacon);
    mk('circle', { cx: 6.5, cy: 6.5, r: 1.15, fill: toneVar('lane') }, beacon);
    /* 跑动点（彗星）：核＝径向高光玻璃球，尾＝本色向后渐隐；
       高光位置随点一起旋转，所以无论朝哪个方向跑，光都从「前进方向的左上方」来 */
    ['att', 'def', 'lane'].forEach(function (tone) {
      var headG = mk('radialGradient', { id: 'pw-runner-head-' + tone, cx: '0.34', cy: '0.3', r: '0.8' }, defs);
      mk('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '0.62' }, headG);
      mk('stop', { 'class': 'pw-stop-' + tone, offset: '0.34', 'stop-opacity': '1' }, headG);
      mk('stop', { 'class': 'pw-stop-' + tone, offset: '1', 'stop-opacity': '1' }, headG);
      var tailG = mk('linearGradient', { id: 'pw-runner-tail-' + tone, x1: '1', y1: '0.5', x2: '0', y2: '0.5' }, defs);
      mk('stop', { 'class': 'pw-stop-' + tone, offset: '0', 'stop-opacity': '0.55' }, tailG);
      mk('stop', { 'class': 'pw-stop-' + tone, offset: '0.45', 'stop-opacity': '0.18' }, tailG);
      mk('stop', { 'class': 'pw-stop-' + tone, offset: '1', 'stop-opacity': '0' }, tailG);
    });
  }

  function create(svg, options) {
    options = options || {};
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.classList.add('pw-pitch');
    var titleEl = svg.querySelector('title');
    var descEl = svg.querySelector('desc');
    svg.textContent = '';
    if (titleEl) svg.appendChild(titleEl);
    if (descEl) svg.appendChild(descEl);

    var defs = mk('defs', null, svg);
    drawArrowDefs(defs);

    var gSurface = mk('g', null, svg);
    var gThirds = mk('g', null, svg);
    var gMark = mk('g', null, svg);
    var gZone = mk('g', null, svg);
    var gOver = mk('g', null, svg);
    var gMotion = mk('g', null, svg);
    var gPlayers = mk('g', null, svg);

    drawSurface(gSurface);
    drawThirds(gThirds);
    drawMarkings(gMark);

    var scale = SCALES[0];
    var nodes = [];
    var animateReady = false;
    for (var i = 0; i < 11; i++) {
      var g = mk('g', { 'class': 'pw-player' }, gPlayers);
      var circle = mk('circle', { 'class': 'pw-dot', cx: 0, cy: 0, r: scale.dot }, g);
      var num = mkText({ 'class': 'pw-num', x: 0, y: 0 }, '', g);
      var role = mkText({ 'class': 'pw-role', x: 0, y: 0 }, '', g);
      if (options.onPlayerHover) {
        (function (group, dot) {
          group.addEventListener('mouseenter', function () { options.onPlayerHover(dot.__pwPlayer, true); });
          group.addEventListener('mouseleave', function () { options.onPlayerHover(dot.__pwPlayer, false); });
        })(g, circle);
      }
      nodes.push({ g: g, circle: circle, num: num, role: role });
    }

    function applyScale() {
      var width = svg.clientWidth || svg.getBoundingClientRect().width || W;
      var picked = SCALES[SCALES.length - 1];
      for (var s = 0; s < SCALES.length; s++) {
        if (width >= SCALES[s].min) { picked = SCALES[s]; break; }
      }
      scale = picked;
      svg.classList.toggle('is-compact', !picked.roles);
      nodes.forEach(function (n) {
        n.circle.setAttribute('r', picked.dot);
        n.num.setAttribute('font-size', picked.num);
        n.role.setAttribute('font-size', picked.role);
        n.role.setAttribute('stroke-width', picked.halo);
        n.role.setAttribute('y', picked.dot + picked.role * 0.95);
      });
      return picked;
    }

    function renderZones(style) {
      gZone.textContent = '';
      (style.zones || []).forEach(function (z) {
        var x0 = tx(z.x0), x1 = tx(z.x1);
        var y0 = ty(z.y0 == null ? 0 : z.y0), y1 = ty(z.y1 == null ? 1 : z.y1);
        mk('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: toneVar(z.tone), 'fill-opacity': 0.15 }, gZone);
        if (!z.edge) return;
        if (z.edge.axis === 'v') {
          var ex = tx(z.edge.at);
          mk('line', { x1: ex, y1: y0, x2: ex, y2: y1, stroke: toneVar(z.tone), 'stroke-opacity': 0.6, 'stroke-width': 2.5, 'stroke-dasharray': '9 7' }, gZone);
        } else {
          var ey = ty(z.edge.at);
          mk('line', { x1: x0, y1: ey, x2: x1, y2: ey, stroke: toneVar(z.tone), 'stroke-opacity': 0.6, 'stroke-width': 2.5, 'stroke-dasharray': '9 7' }, gZone);
        }
      });
    }

    /* 轨迹动画：沿线路跑动的彗星点（玻璃核＋渐隐拖尾），用 SVG animateMotion 驱动，无需逐帧脚本 */
    function renderRunners(trails) {
      gMotion.textContent = '';
      if (reducedMotion()) return;
      trails.forEach(function (t, i) {
      var runner = mk('g', { 'class': 'pw-runner' }, gMotion);
        /* 颜色跟随所属线路：橙＝前压、蓝＝回收、青白＝球，与图例配色一一对应 */
        var tone = toneKey(t.tone);
        runner.style.setProperty('--tone-run', toneVar(t.tone));
        var r = Math.max(6.5, scale.dot * 0.52);
        /* 朝向＝线段起止的航向角，彗尾永远拖在身后；曲线取弦向，在这个尺度上足够贴合 */
        var ang = Math.atan2(ty(t.to[1]) - ty(t.from[1]), tx(t.to[0]) - tx(t.from[0])) * 180 / Math.PI;
        /* 草皮柔影与呼吸光环不参与旋转：影子始终落在下方，光始终从上方来 */
        mk('circle', {
          'class': 'pw-runner-shadow', r: (r * 1.04).toFixed(2), cy: (r * 0.2).toFixed(2),
          'stroke-width': Math.max(1.5, r * 0.2).toFixed(2)
        }, runner);
        mk('circle', {
          'class': 'pw-runner-halo', r: (r * 1.18).toFixed(2), 'stroke-width': Math.max(1.2, r * 0.16).toFixed(2)
        }, runner);
        var art = mk('g', { 'class': 'pw-runner-art', transform: 'rotate(' + ang.toFixed(1) + ')' }, runner);
        /* 彗尾：向后收细并渐隐，跑动点因此有了方向与速度感，而不再只是一枚圆环 */
        mk('path', { 'class': 'pw-runner-tail', fill: 'url(#pw-runner-tail-' + tone + ')', d: tailPath(r) }, art);
        mk('line', {
          'class': 'pw-runner-core', x1: (-r * 0.5).toFixed(2), y1: 0,
          x2: (-r * 2.1).toFixed(2), y2: 0, 'stroke-width': Math.max(1, r * 0.16).toFixed(2)
        }, art);
        /* 彗核：径向高光的实心玻璃球 + 下沿暗面 + 深色细边，做出体积，与扁平的球员圆点区分 */
        mk('circle', { 'class': 'pw-runner-head', r: r.toFixed(2), fill: 'url(#pw-runner-head-' + tone + ')' }, art);
        mk('circle', { 'class': 'pw-runner-shade', r: r.toFixed(2), fill: 'url(#pw-arrow-shade)' }, art);
        mk('circle', {
          'class': 'pw-runner-rim', r: (r + 0.6).toFixed(2), 'stroke-width': Math.max(1.2, r * 0.16).toFixed(2)
        }, art);
        mk('ellipse', {
          'class': 'pw-runner-glint', cx: (-r * 0.2).toFixed(2), cy: (-r * 0.36).toFixed(2),
          rx: (r * 0.3).toFixed(2), ry: (r * 0.17).toFixed(2), transform: 'rotate(-24)'
        }, art);
        var length = Math.hypot((t.to[0] - t.from[0]) * 1.544, t.to[1] - t.from[1]);
        var dur = Math.max(1.5, Math.min(3.6, 1 + length * 4.6));
        var begin = (i * 0.34).toFixed(2) + 's';
        var time = dur.toFixed(2) + 's';
        mk('animateMotion', {
          path: t.path, dur: time, repeatCount: 'indefinite',
          begin: begin, rotate: 'none', calcMode: 'linear'
        }, runner);
        /* 起步淡入、收尾淡出，圆点像「跑过去的人」，不会在终点突然消失 */
        mk('animate', {
          attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;0.16;0.82;1',
          dur: time, begin: begin, repeatCount: 'indefinite', calcMode: 'linear'
        }, runner);
      });
    }

    function renderOverlay(style, pts) {
      gOver.textContent = '';
      gMotion.textContent = '';
      var out = (style.overlay && style.overlay(pts)) || {};
      var trails = [];
      /* 箭杆渐变按路径逐帧生成，先清掉上一轮的，避免 defs 里越堆越多 */
      Array.prototype.slice.call(defs.querySelectorAll('.pw-shaft-grad')).forEach(function (n) {
        n.parentNode.removeChild(n);
      });
      var gradSeq = 0;
      function d2(from, to) {
        return 'M' + tx(from[0]).toFixed(1) + ',' + ty(from[1]).toFixed(1) +
               ' L' + tx(to[0]).toFixed(1) + ',' + ty(to[1]).toFixed(1);
      }
      /* 箭杆上色：由细淡起笔到本色收笔，整条线路像一笔带出去的轨迹，而不是一根塑料管 */
      function shaftPaint(from, to, tone) {
        var id = 'pw-shaft-' + (gradSeq++);
        var grad = mk('linearGradient', {
          id: id, 'class': 'pw-shaft-grad', gradientUnits: 'userSpaceOnUse',
          x1: tx(from[0]).toFixed(1), y1: ty(from[1]).toFixed(1),
          x2: tx(to[0]).toFixed(1), y2: ty(to[1]).toFixed(1)
        }, defs);
        mk('stop', { 'class': 'pw-stop-' + toneKey(tone), offset: '0', 'stop-opacity': '0.45' }, grad);
        mk('stop', { 'class': 'pw-stop-' + toneKey(tone), offset: '1', 'stop-opacity': '0.96' }, grad);
        return 'url(#' + id + ')';
      }
      /* 颜色绑定主体：橙/蓝＝人的跑动（实线箭头），线路色＝球的线路（点线＋末端圆点） */
      function flowAttrs(tone) {
        return tone === 'lane'
          ? { 'class': 'pw-flow-dots', 'stroke-dasharray': '0.5 8' }
          : { 'class': 'pw-flow' };
      }
      /* 线条底衬：同色柔光 + 深色细影（都不做模糊），让线路压在草皮上有厚度、边缘又干净；
         球的线路只留柔光，否则会出现一条「实线」，点线语义就丢了 */
      function glowPath(d, tone, width) {
        mk('path', {
          d: d, fill: 'none', stroke: toneVar(tone), 'stroke-opacity': 0.16,
          'stroke-width': (width + (tone === 'lane' ? 3.8 : 4.4)).toFixed(1),
          'stroke-linecap': 'round', 'class': 'pw-flow-casing'
        }, gOver);
        if (tone === 'lane') return;
        mk('path', {
          d: d, fill: 'none', stroke: 'var(--arrow-rim)', 'stroke-opacity': 0.55,
          'stroke-width': (width + 1.6).toFixed(1), 'stroke-linecap': 'round', 'class': 'pw-flow-shadow'
        }, gOver);
      }
      (out.lanes || []).forEach(function (l) {
        var dl = d2(l[0], l[1]);
        glowPath(dl, 'lane', 3.2);
        mk('path', Object.assign({
          d: dl, fill: 'none', stroke: shaftPaint(l[0], l[1], 'lane'),
          'stroke-width': 3.2, 'stroke-linecap': 'round'
        }, flowAttrs('lane')), gOver);
      });
      (out.curves || []).forEach(function (c) {
        var d = 'M' + tx(c.from[0]).toFixed(1) + ',' + ty(c.from[1]).toFixed(1) +
                ' Q' + tx(c.c[0]).toFixed(1) + ',' + ty(c.c[1]).toFixed(1) +
                ' ' + tx(c.to[0]).toFixed(1) + ',' + ty(c.to[1]).toFixed(1);
        glowPath(d, c.tone, 3.5);
        mk('path', Object.assign({
          d: d, fill: 'none', stroke: shaftPaint(c.from, c.to, c.tone),
          'stroke-width': 3.6, 'stroke-linecap': 'round',
          'marker-end': 'url(#pw-arrow-' + c.tone + ')'
        }, flowAttrs(c.tone)), gOver);
        trails.push({ path: d, tone: c.tone, from: c.from, to: c.to });
      });
      (out.arrows || []).forEach(function (a) {
        var d = d2(a.from, a.to);
        glowPath(d, a.tone, 3.5);
        mk('path', Object.assign({
          d: d, fill: 'none', stroke: shaftPaint(a.from, a.to, a.tone),
          'stroke-width': 3.6, 'stroke-linecap': 'round',
          'marker-end': 'url(#pw-arrow-' + a.tone + ')'
        }, flowAttrs(a.tone)), gOver);
        trails.push({ path: d, tone: a.tone, from: a.from, to: a.to });
      });
      if (style.note) {
        mkText({ 'class': 'pw-note', x: tx(0.018), y: ty(0.97), 'font-size': scale.role * 1.1, 'stroke-width': scale.halo }, style.note, gOver);
      }
      return trails;
    }

    function render(state, layers) {
      layers = layers || { zones: true, overlays: true, thirds: true, motion: true };
      var pts = TacticsPitch.computePts(state.formation, state.style);
      var style = T.STYLES[state.style];
      var formation = T.FORMATIONS[state.formation];

      applyScale();

      nodes.forEach(function (node, index) {
        var p = pts[index];
        var meta = formation.players[index];
        node.g.style.transform = 'translate(' + tx(p.x).toFixed(1) + 'px,' + ty(p.y).toFixed(1) + 'px)';
        node.num.textContent = String(meta[0]);
        node.role.textContent = p.role;
        node.circle.__pwPlayer = { number: meta[0], role: p.role, group: T.GROUP[p.role] };
        node.g.setAttribute('aria-hidden', 'true');
      });

      if (!animateReady) {
        animateReady = true;
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(function () {
            /* 先固化首帧位置，再开启过渡，避免球员从原点飞入 */
            void svg.getBoundingClientRect();
            svg.classList.add('is-animated');
          });
        } else {
          svg.classList.add('is-animated');
        }
      }

      renderZones(style);
      var trails = renderOverlay(style, pts);
      var motionOn = layers.motion !== false;
      renderRunners(trails);

      gZone.style.display = layers.zones ? '' : 'none';
      gOver.style.display = layers.overlays ? '' : 'none';
      gThirds.style.display = layers.thirds ? '' : 'none';
      gMotion.style.display = motionOn ? '' : 'none';
      svg.classList.toggle('no-motion', !motionOn);
      if (typeof svg.pauseAnimations === 'function') {
        if (motionOn) svg.unpauseAnimations(); else svg.pauseAnimations();
      }

      if (descEl) {
          descEl.textContent = state.formation + ' 阵型的' + style.label + '打法：' + style.tag +
          '。橙色与蓝色实线箭头表示球员的跑动方向，橙色为前压、蓝色为回收；浅色点线表示球的传球线路，末端空心圆点表示线路终点；' +
          '半透明区域是本方主动施压、重点保护或主要控球的地带；线条上拖尾的彗星点沿线路循环移动，按方向演示球员与球的移动。';
      }

      return { pts: pts, style: style, formation: formation };
    }

    if (typeof ResizeObserver !== 'undefined') {
      var lastWidth = -1;
      new ResizeObserver(function () {
        var width = svg.clientWidth;
        if (Math.abs(width - lastWidth) < 2) return;
        lastWidth = width;
        applyScale();
      }).observe(svg.parentNode || svg);
    }

    applyScale();
    return { render: render, element: svg };
  }

  function computePts(formationKey, styleKey) {
    var formation = T.FORMATIONS[formationKey];
    return formation.players.map(function (player) {
      var a = T.adjust(styleKey, player);
      return { role: player[1], x: a.x, y: a.y };
    });
  }

  /* 给「我的战术板」复用的球场底图：只画草皮、条纹与场地线 */
  function drawField(svg) {
    var defs = mk('defs', null, svg);
    drawArrowDefs(defs);
    var gSurface = mk('g', { 'class': 'pw-surface' }, svg);
    drawSurface(gSurface);
    var gMark = mk('g', { 'class': 'pw-markings' }, svg);
    drawMarkings(gMark);
    return { defs: defs, surface: gSurface, markings: gMark };
  }

  function toNorm(px, py) {
    return { x: (px - PAD) / PW, y: (py - PAD) / PH };
  }

  /* 站位指标：用来量化不同打法的区别（不含门将） */
  function metrics(pts) {
    var outfield = pts.filter(function (p) { return T.GROUP[p.role] !== 'gk'; });
    var height = 0, width = 0, minX = Infinity, maxX = -Infinity, advanced = 0;
    outfield.forEach(function (p) {
      height += p.x;
      width += Math.abs(p.y - 0.5) * 2;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.x >= 0.5) advanced += 1;
    });
    var n = outfield.length || 1;
    return {
      height: height / n,
      width: width / n,
      depth: maxX - minX,
      advanced: advanced
    };
  }

  global.TacticsPitch = {
    create: create,
    computePts: computePts,
    metrics: metrics,
    drawField: drawField,
    toNorm: toNorm,
    tx: tx,
    ty: ty,
    geom: { W: W, H: H, PAD: PAD, PW: PW, PH: PH }
  };
})(window);
