/* 我的战术板：自由放置球员、画线、导入阵型、给球员命名
   复用 tactics-pitch.js 的球场底图与坐标工具，改动自动存进 localStorage */
(function () {
  'use strict';

  var P = window.TacticsPitch;
  var T = window.TACTICS;
  var svg = document.getElementById('board-pitch');
  var root = document.getElementById('board');
  if (!svg || !root || !P || !T) return;

  var NS = 'http://www.w3.org/2000/svg';
  var STORE_KEY = 'football.tacticsBoard.v1';
  var ROLES = ['门将', '中卫', '边卫', '翼卫', '后腰', '中场', '前腰', '边锋', '中锋'];
  var TOOL_LABEL = {
    select: '选择 / 移动', player: '放置球员', arrow: '箭头', line: '连线',
    pen: '自由画线', circle: '圆圈', erase: '橡皮'
  };
  var TONE_LABEL = { att: '跑动橙', def: '回收蓝', lane: '线路青白' };

  var dom = {
    status: document.getElementById('board-status'),
    roster: document.getElementById('board-roster'),
    count: document.getElementById('board-count'),
    form: document.getElementById('board-player-form'),
    number: document.getElementById('bp-number'),
    name: document.getElementById('bp-name'),
    role: document.getElementById('bp-role'),
    side: document.getElementById('bp-side'),
    delPlayer: document.getElementById('bp-delete'),
    formation: document.getElementById('board-formation'),
    style: document.getElementById('board-style'),
    mirror: document.getElementById('board-mirror'),
    importBtn: document.getElementById('board-import'),
    undoBtn: document.getElementById('board-undo'),
    clearBtn: document.getElementById('board-clear'),
    exportBtn: document.getElementById('board-export'),
    importJsonBtn: document.getElementById('board-import-json'),
    file: document.getElementById('board-file'),
    hint: document.getElementById('board-hint'),
    tools: Array.prototype.slice.call(root.querySelectorAll('.board-toolbar [data-tool]')),
    tones: Array.prototype.slice.call(root.querySelectorAll('.tone-btn'))
  };

  /* ---------- 小工具 ---------- */

  function mk(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    if (attrs) {
      for (var k in attrs) { if (attrs[k] != null) node.setAttribute(k, attrs[k]); }
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  var seq = 0;
  function uid() { seq += 1; return 'i' + Date.now().toString(36) + seq.toString(36); }
  function clamp01(v) { return Math.min(0.985, Math.max(0.015, v)); }
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
    return null;
  }
  function toneVar(tone) {
    if (tone === 'def') return 'var(--tone-def)';
    if (tone === 'lane') return 'var(--tone-lane)';
    return 'var(--tone-att)';
  }
  function X(n) { return P.tx(n); }
  function Y(n) { return P.ty(n); }
  function status(msg) { if (dom.status) dom.status.textContent = msg; }

  /* ---------- 状态 ---------- */

  var state = { players: [], shapes: [], tool: 'select', tone: 'att', selected: null };
  var undoStack = [];
  var drag = null;

  /* ---------- 画布图层 ---------- */

  P.drawField(svg);
  var gShapes = mk('g', { 'class': 'board-shapes' }, svg);
  var gPlayers = mk('g', { 'class': 'board-players' }, svg);
  var gPreview = mk('g', { 'class': 'board-preview' }, svg);
  svg.setAttribute('data-tool', state.tool);

  /* ---------- 坐标换算 ---------- */

  function svgPoint(clientX, clientY) {
    var ctm = svg.getScreenCTM && svg.getScreenCTM();
    if (ctm && svg.createSVGPoint) {
      var pt = svg.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      return pt.matrixTransform(ctm.inverse());
    }
    var box = svg.getBoundingClientRect();
    var g = P.geom;
    return {
      x: (clientX - box.left) / (box.width || 1) * g.W,
      y: (clientY - box.top) / (box.height || 1) * g.H
    };
  }

  function nPt(evt) {
    var loc = svgPoint(evt.clientX, evt.clientY);
    var n = P.toNorm(loc.x, loc.y);
    return { x: clamp01(n.x), y: clamp01(n.y), px: loc };
  }

  /* ---------- 渲染 ---------- */

  function linePath(from, to) {
    return 'M' + X(from[0]).toFixed(1) + ',' + Y(from[1]).toFixed(1) +
           ' L' + X(to[0]).toFixed(1) + ',' + Y(to[1]).toFixed(1);
  }

  function renderShapes() {
    gShapes.textContent = '';
    state.shapes.forEach(function (s) {
      var g = mk('g', { 'class': 'board-item', 'data-id': s.id }, gShapes);
      var stroke = toneVar(s.tone);
      if (s.type === 'pen') {
        var d = s.pts.map(function (p, i) {
          return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1);
        }).join(' ');
        mk('path', { 'class': 'board-hit', d: d }, g);
        mk('path', {
          'class': 'board-shape', d: d, fill: 'none', stroke: stroke, 'stroke-width': 4,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }, g);
        return;
      }
      if (s.type === 'circle') {
        var c = s.pts[0];
        var cAttr = { cx: X(c[0]).toFixed(1), cy: Y(c[1]).toFixed(1), r: Math.max(6, s.r).toFixed(1) };
        mk('circle', Object.assign({ 'class': 'board-hit' }, cAttr), g);
        mk('circle', Object.assign({
          'class': 'board-shape', fill: stroke, 'fill-opacity': 0.12, stroke: stroke,
          'stroke-width': 4, 'stroke-dasharray': '11 8'
        }, cAttr), g);
        return;
      }
      var d2 = linePath(s.pts[0], s.pts[1]);
      mk('path', { 'class': 'board-hit', d: d2 }, g);
      var attrs = {
        'class': 'board-shape', d: d2, fill: 'none', stroke: stroke,
        'stroke-width': 4.5, 'stroke-linecap': 'round'
      };
      /* 与球场图层一致：橙/蓝＝实线（人的跑动），线路色＝点线（球的线路） */
      if (s.tone === 'lane') attrs['stroke-dasharray'] = '2 8';
      if (s.type === 'arrow') attrs['marker-end'] = 'url(#pw-arrow-' + s.tone + ')';
      mk('path', attrs, g);
    });
  }

  function renderPlayers() {
    gPlayers.textContent = '';
    state.players.forEach(function (p) {
      var cls = 'board-player is-' + p.side + (state.selected === p.id ? ' is-selected' : '');
      var g = mk('g', { 'class': cls, 'data-id': p.id }, gPlayers);
      g.style.transform = 'translate(' + X(p.x).toFixed(1) + 'px,' + Y(p.y).toFixed(1) + 'px)';
      mk('circle', { 'class': 'pw-dot', cx: 0, cy: 0, r: 22 }, g);
      mk('text', { 'class': 'pw-num', x: 0, y: 0, 'font-size': 25 }, g).textContent = String(p.number);
      mk('text', {
        'class': 'pw-role', x: 0, y: 27, 'font-size': 19, 'stroke-width': 5
      }, g).textContent = p.name ? p.name : p.role;
    });
  }

  function renderRoster() {
    if (!dom.roster) return;
    dom.roster.textContent = '';
    if (dom.count) dom.count.textContent = state.players.length + ' 人';
    state.players.forEach(function (p) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      if (state.selected === p.id) btn.className = 'is-selected';
      var dot = document.createElement('span');
      dot.className = 'roster-dot is-' + p.side;
      var label = document.createElement('span');
      label.textContent = p.number + ' 号 · ' + (p.name || p.role) +
        (p.name ? '（' + p.role + '）' : '') + ' · ' + (p.side === 'home' ? '我方' : '对手');
      btn.appendChild(dot);
      btn.appendChild(label);
      btn.addEventListener('click', function () {
        setTool('select');
        select(p.id);
      });
      li.appendChild(btn);
      dom.roster.appendChild(li);
    });
  }

  function renderForm() {
    if (!dom.form) return;
    var p = byId(state.players, state.selected);
    dom.form.hidden = !p;
    if (!p) return;
    dom.number.value = p.number;
    dom.name.value = p.name || '';
    dom.role.value = p.role;
    dom.side.value = p.side;
  }

  function render() {
    renderShapes();
    renderPlayers();
    renderRoster();
    renderForm();
    if (dom.undoBtn) dom.undoBtn.disabled = undoStack.length === 0;
    queueSave();
  }

  /* ---------- 存档 ---------- */

  var saveTimer = null;
  function payload() {
    return { version: 1, players: state.players, shapes: state.shapes };
  }
  function saveNow() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(payload())); } catch (err) { /* 隐私模式忽略 */ }
  }
  function queueSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveTimer = null; saveNow(); }, 200);
  }

  function normalizePlayer(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var num = parseInt(raw.number, 10);
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      x: clamp01(Number(raw.x) || 0.5),
      y: clamp01(Number(raw.y) || 0.5),
      number: isFinite(num) && num > 0 ? Math.min(99, num) : 1,
      name: typeof raw.name === 'string' ? raw.name.slice(0, 12) : '',
      role: ROLES.indexOf(raw.role) >= 0 ? raw.role : '中场',
      side: raw.side === 'away' ? 'away' : 'home'
    };
  }

  function normalizeShape(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var type = ['arrow', 'line', 'pen', 'circle'].indexOf(raw.type) >= 0 ? raw.type : null;
    if (!type || !Array.isArray(raw.pts) || !raw.pts.length) return null;
    var pts = raw.pts.map(function (p) {
      if (!Array.isArray(p)) return [0.5, 0.5];
      return [clamp01(Number(p[0]) || 0.5), clamp01(Number(p[1]) || 0.5)];
    });
    var out = { id: typeof raw.id === 'string' && raw.id ? raw.id : uid(), type: type, tone: raw.tone, pts: pts };
    if (type === 'circle') out.r = Math.max(6, Math.min(400, Number(raw.r) || 30));
    return out;
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (err) { return false; }
    if (!raw) return false;
    var data;
    try { data = JSON.parse(raw); } catch (err) { return false; }
    if (!data || !Array.isArray(data.players)) return false;
    state.players = data.players.map(normalizePlayer).filter(Boolean);
    state.shapes = (Array.isArray(data.shapes) ? data.shapes : []).map(normalizeShape).filter(Boolean);
    return state.players.length > 0;
  }

  /* ---------- 撤销 ---------- */

  function pushUndo() {
    undoStack.push(JSON.stringify(payload()));
    if (undoStack.length > 60) undoStack.shift();
    if (dom.undoBtn) dom.undoBtn.disabled = false;
  }

  function undo() {
    var snap = undoStack.pop();
    if (!snap) return;
    var data = JSON.parse(snap);
    state.players = data.players;
    state.shapes = data.shapes;
    if (!byId(state.players, state.selected)) state.selected = null;
    render();
    status('已撤销上一步操作。');
  }

  /* ---------- 选择与编辑 ---------- */

  function select(id) {
    state.selected = id;
    renderPlayers();
    renderRoster();
    renderForm();
    var p = byId(state.players, id);
    status(p ? ('已选中 ' + p.number + ' 号' + (p.name || p.role) + '，可在右侧改名字或号码。') : '已取消选中。');
  }

  function nextNumber() {
    var max = 0;
    state.players.forEach(function (p) { if (p.number > max) max = p.number; });
    return max >= 99 ? 1 : max + 1;
  }

  function removePlayer(id) {
    var i = 0;
    for (; i < state.players.length; i++) {
      if (state.players[i].id === id) break;
    }
    if (i >= state.players.length) return;
    pushUndo();
    var removed = state.players.splice(i, 1)[0];
    if (state.selected === id) state.selected = null;
    render();
    status('已删除 ' + removed.number + ' 号球员。');
  }

  function removeShape(id) {
    var i = 0;
    for (; i < state.shapes.length; i++) {
      if (state.shapes[i].id === id) break;
    }
    if (i >= state.shapes.length) return;
    pushUndo();
    state.shapes.splice(i, 1);
    render();
    status('已擦除一条线条。');
  }

  /* ---------- 指针交互 ---------- */

  function setTool(tool) {
    state.tool = tool;
    svg.setAttribute('data-tool', tool);
    dom.tools.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
    });
    status('当前工具：' + TOOL_LABEL[tool] + '。');
  }

  function onDown(evt) {
    if (evt.button != null && evt.button !== 0) return;
    var hit = evt.target && evt.target.closest ? evt.target.closest('[data-id]') : null;
    var hitIsPlayer = !!(hit && hit.classList.contains('board-player'));
    var np = nPt(evt);

    if (state.tool === 'erase') {
      if (hitIsPlayer) removePlayer(hit.dataset.id);
      else if (hit) removeShape(hit.dataset.id);
      return;
    }

    if (state.tool === 'select' || state.tool === 'player') {
      if (hitIsPlayer) {
        var p = byId(state.players, hit.dataset.id);
        select(p.id);
        drag = { mode: 'move', id: p.id, dx: p.x - np.x, dy: p.y - np.y };
        capture(evt);
        evt.preventDefault();
        return;
      }
      if (state.tool === 'select') { select(null); return; }
      pushUndo();
      var fresh = {
        id: uid(), x: np.x, y: np.y, number: nextNumber(),
        name: '', role: '中场', side: 'home'
      };
      state.players.push(fresh);
      state.selected = fresh.id;
      drag = { mode: 'move', id: fresh.id, dx: 0, dy: 0 };
      render();
      status('已放置 ' + fresh.number + ' 号球员，可在右侧改名字、号码和位置。');
      capture(evt);
      evt.preventDefault();
      return;
    }

    /* 画线类工具 */
    pushUndo();
    var shape = { id: uid(), type: state.tool, tone: state.tone, pts: [[np.x, np.y]] };
    if (state.tool === 'arrow' || state.tool === 'line') shape.pts.push([np.x, np.y]);
    if (state.tool === 'circle') shape.r = 30;
    state.shapes.push(shape);
    drag = { mode: 'draw', id: shape.id, anchor: np.px };
    renderShapes();
    capture(evt);
    evt.preventDefault();
  }

  function capture(evt) {
    try { svg.setPointerCapture(evt.pointerId); } catch (err) { /* 老浏览器忽略 */ }
  }

  function onMove(evt) {
    if (!drag) return;
    var np = nPt(evt);
    if (drag.mode === 'move') {
      var p = byId(state.players, drag.id);
      if (!p) return;
      p.x = clamp01(np.x + drag.dx);
      p.y = clamp01(np.y + drag.dy);
      renderPlayers();
      queueSave();
      return;
    }
    var s = byId(state.shapes, drag.id);
    if (!s) return;
    if (s.type === 'pen') {
      var last = s.pts[s.pts.length - 1];
      if (Math.hypot(last[0] - np.x, last[1] - np.y) < 0.006) return;
      s.pts.push([np.x, np.y]);
    } else if (s.type === 'circle') {
      s.r = Math.max(6, Math.hypot(np.px.x - drag.anchor.x, np.px.y - drag.anchor.y));
    } else {
      s.pts[1] = [np.x, np.y];
    }
    renderShapes();
  }

  function onUp() {
    if (!drag) return;
    var d = drag;
    drag = null;
    var s = byId(state.shapes, d.id);
    if (d.mode === 'draw' && s) {
      var c = s.pts[0];
      var tiny = (s.type === 'circle' && s.r < 9) ||
        (s.type !== 'circle' && s.type !== 'pen' &&
          Math.hypot(s.pts[1][0] - c[0], s.pts[1][1] - c[1]) < 0.012) ||
        (s.type === 'pen' && s.pts.length < 3);
      if (tiny) {
        var i = state.shapes.indexOf(s);
        if (i >= 0) state.shapes.splice(i, 1);
        undoStack.pop();
        if (dom.undoBtn) dom.undoBtn.disabled = undoStack.length === 0;
      }
    }
    gpclear();
    render();
  }

  function gpclear() { if (gPreview) gPreview.textContent = ''; }

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);

  /* ---------- 工具条 ---------- */

  dom.tools.forEach(function (btn) {
    btn.addEventListener('click', function () { setTool(btn.dataset.tool); });
  });

  dom.tones.forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.tone = btn.dataset.tone;
      dom.tones.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      status('画笔颜色：' + TONE_LABEL[state.tone] + '。');
    });
  });

  /* ---------- 球员表单 ---------- */

  function withSelected(fn) {
    var p = byId(state.players, state.selected);
    if (!p) return;
    fn(p);
    renderPlayers();
    renderRoster();
    queueSave();
  }

  if (dom.number) {
    dom.number.addEventListener('input', function () {
      var v = parseInt(dom.number.value, 10);
      withSelected(function (p) { p.number = isFinite(v) && v > 0 ? Math.min(99, v) : p.number; });
    });
  }
  if (dom.name) {
    dom.name.addEventListener('input', function () {
      var v = dom.name.value.slice(0, 12);
      withSelected(function (p) { p.name = v; });
    });
  }
  if (dom.role) {
    dom.role.addEventListener('change', function () {
      withSelected(function (p) { p.role = dom.role.value; });
    });
  }
  if (dom.side) {
    dom.side.addEventListener('change', function () {
      withSelected(function (p) { p.side = dom.side.value; });
    });
  }
  if (dom.delPlayer) {
    dom.delPlayer.addEventListener('click', function () {
      if (state.selected) removePlayer(state.selected);
    });
  }

  /* ---------- 导入阵型 / 清空 / 存取 ---------- */

  function fillSelect(select, order, labels, current) {
    select.textContent = '';
    order.forEach(function (key) {
      var option = document.createElement('option');
      option.value = key;
      option.textContent = labels ? labels(key) : key;
      select.appendChild(option);
    });
    if (current) select.value = current;
  }

  if (dom.formation) fillSelect(dom.formation, T.FORMATION_ORDER, null, '4-3-3');
  if (dom.style) fillSelect(dom.style, T.STYLE_ORDER, function (k) { return T.STYLES[k].label; }, 'press');
  if (dom.role) fillSelect(dom.role, ROLES, null, '中场');

  function importFormation() {
    var fKey = dom.formation ? dom.formation.value : '4-3-3';
    var sKey = dom.style ? dom.style.value : 'press';
    var pts = P.computePts(fKey, sKey);
    var meta = T.FORMATIONS[fKey].players;
    var list = pts.map(function (p, i) {
      return {
        id: uid(), x: p.x, y: p.y, role: p.role,
        number: meta[i][0], name: '', side: 'home'
      };
    });
    if (dom.mirror && dom.mirror.checked) {
      pts.forEach(function (p, i) {
        list.push({
          id: uid(), x: 1 - p.x, y: 1 - p.y, role: p.role,
          number: meta[i][0], name: '', side: 'away'
        });
      });
    }
    pushUndo();
    state.players = list;
    state.shapes = [];
    state.selected = null;
    render();
    status('已导入 ' + fKey + ' 阵型与「' + T.STYLES[sKey].label + '」站位，共 ' + list.length + ' 人。');
  }

  if (dom.importBtn) dom.importBtn.addEventListener('click', importFormation);

  if (dom.clearBtn) {
    dom.clearBtn.addEventListener('click', function () {
      pushUndo();
      state.players = [];
      state.shapes = [];
      state.selected = null;
      render();
      status('已清空战术板。');
    });
  }

  if (dom.undoBtn) dom.undoBtn.addEventListener('click', undo);

  if (dom.exportBtn) {
    dom.exportBtn.addEventListener('click', function () {
      var text = JSON.stringify(payload(), null, 2);
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'tactics-board.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      status('已导出 tactics-board.json。');
      if (dom.hint) dom.hint.textContent = '已导出 tactics-board.json；在别的设备上用「导入 JSON」即可还原。';
    });
  }

  if (dom.importJsonBtn && dom.file) {
    dom.importJsonBtn.addEventListener('click', function () { dom.file.click(); });
    dom.file.addEventListener('change', function () {
      var file = dom.file.files && dom.file.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var data = null;
        try { data = JSON.parse(String(reader.result)); } catch (err) { data = null; }
        if (!data || !Array.isArray(data.players)) {
          status('导入失败：这不是有效的战术板 JSON 文件。');
          if (dom.hint) dom.hint.textContent = '导入失败：文件内容不是战术板 JSON。';
          return;
        }
        pushUndo();
        state.players = data.players.map(normalizePlayer).filter(Boolean);
        state.shapes = (Array.isArray(data.shapes) ? data.shapes : []).map(normalizeShape).filter(Boolean);
        state.selected = null;
        render();
        status('已导入 ' + state.players.length + ' 名球员的战术板。');
        if (dom.hint) dom.hint.textContent = '已导入战术板：' + state.players.length + ' 名球员。';
      };
      reader.readAsText(file);
      dom.file.value = '';
    });
  }

  /* ---------- 初始化 ---------- */

  if (dom.mirror) dom.mirror.checked = true;
  setTool('select');
  dom.tones.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tone === state.tone)); });

  if (!load()) {
    state.players = [];
    state.shapes = [];
    importSeed();
  } else {
    status('已载入上次保存在本机的战术板。');
  }
  render();
  if (dom.undoBtn) dom.undoBtn.disabled = true;

  function importSeed() {
    var pts = P.computePts('4-3-3', 'press');
    var meta = T.FORMATIONS['4-3-3'].players;
    pts.forEach(function (p, i) {
      state.players.push({
        id: uid(), x: p.x, y: p.y, role: p.role,
        number: meta[i][0], name: '', side: 'home'
      });
      state.players.push({
        id: uid(), x: 1 - p.x, y: 1 - p.y, role: p.role,
        number: meta[i][0], name: '', side: 'away'
      });
    });
  }
})();
