/* 页面逻辑：选择阵型与打法、渲染战术简报、并排对照、URL 状态同步 */
(function () {
  'use strict';

  var T = window.TACTICS;
  var P = window.TacticsPitch;

  var METRIC_ROWS = [
    { key: 'height', label: '平均站位高度', hint: '越大越靠前压' },
    { key: 'width', label: '平均宽度利用', hint: '越大越贴边线' },
    { key: 'depth', label: '阵线纵深', hint: '前后两条线的距离' },
    { key: 'advanced', label: '越过中线人数', hint: '参与进攻的人数' }
  ];

  var state = {
    formation: '4-3-3',
    style: 'press',
    layers: { zones: true, overlays: true, thirds: true, motion: true },
    compare: {
      a: { formation: '4-4-2', style: 'lowblock' },
      b: { formation: '4-3-3', style: 'press' }
    }
  };

  var el = {
    formationChips: document.getElementById('formation-chips'),
    styleChips: document.getElementById('style-chips'),
    briefTitle: document.getElementById('brief-title'),
    briefTag: document.getElementById('brief-tag'),
    briefPoints: document.getElementById('brief-points'),
    briefStats: document.getElementById('brief-stats'),
    briefDuty: document.getElementById('brief-duty'),
    briefDutyMeta: document.getElementById('brief-duty-meta'),
    live: document.getElementById('live-status'),
    styleCards: document.getElementById('style-cards'),
    compareTable: document.getElementById('compare-body'),
    compareVerdict: document.getElementById('compare-verdict'),
    copyButton: document.getElementById('copy-link'),
    copyHint: document.getElementById('copy-hint'),
    randomButton: document.getElementById('random-combo')
  };

  function pct(value) { return Math.round(value * 100) + '%'; }

  function metricText(key, value) {
    return key === 'advanced' ? value + ' 人' : pct(value);
  }

  /* ---------- 主预览 ---------- */

  var mainPitch = P.create(document.getElementById('pitch'), {
    onPlayerHover: function (player, active) {
      if (active) { showDuty(player); }
      else { showDuty(null); }
    }
  });

  function showDuty(player) {
    if (!player) {
      el.briefDutyMeta.textContent = '球场上的圆点';
      el.briefDuty.textContent = '把鼠标移到球员身上，看这个位置在当前打法下的职责。';
      return;
    }
    var style = T.STYLES[state.style];
    var extra = (style.duties || {})[player.group];
    el.briefDutyMeta.textContent = player.number + ' 号 · ' + player.role;
    el.briefDuty.textContent = extra ? extra + '。' + T.ROLE_DUTY[player.role] : T.ROLE_DUTY[player.role];
  }

  function renderBrief(result) {
    var style = result.style, formation = result.formation;
    el.briefTitle.textContent = state.formation + ' · ' + style.label;
    el.briefTag.textContent = style.tag;

    el.briefPoints.textContent = '';
    [['阵型结构', state.formation + '：' + formation.desc]]
      .concat(formation.points)
      .concat(style.points)
      .forEach(function (row) {
        var dt = document.createElement('dt');
        dt.textContent = row[0];
        var dd = document.createElement('dd');
        dd.textContent = row[1];
        el.briefPoints.appendChild(dt);
        el.briefPoints.appendChild(dd);
      });

    var m = P.metrics(result.pts);
    el.briefStats.textContent = '';
    METRIC_ROWS.forEach(function (row) {
      var card = document.createElement('div');
      card.className = 'stat';
      var value = document.createElement('p');
      value.className = 'stat-value';
      value.textContent = metricText(row.key, m[row.key]);
      var bar = document.createElement('span');
      bar.className = 'stat-bar';
      var fill = document.createElement('i');
      var ratio = row.key === 'advanced' ? m.advanced / 10 : m[row.key];
      fill.style.width = Math.max(4, Math.min(100, ratio * 100)) + '%';
      bar.appendChild(fill);
      var label = document.createElement('p');
      label.className = 'stat-label';
      label.textContent = row.label;
      card.appendChild(value);
      card.appendChild(bar);
      card.appendChild(label);
      el.briefStats.appendChild(card);
    });

    el.live.textContent = '当前预览：' + state.formation + ' 阵型，' + style.label + '。' + style.tag + '。';
    showDuty(null);
  }

  function renderMain() {
    var result = mainPitch.render(state, state.layers);
    renderBrief(result);
    syncChips();
    syncPitchLegend();
  }

  /* 球场旁的速查图例：跟随「显示图层」的开关一起变淡 */
  var pitchLegend = document.getElementById('pitch-legend');

  function syncPitchLegend() {
    if (!pitchLegend) return;
    Array.prototype.forEach.call(pitchLegend.querySelectorAll('[data-layer]'), function (item) {
      item.classList.toggle('is-off', !state.layers[item.dataset.layer]);
    });
  }

  /* 速查图例可折叠；状态记在本机，下次打开保持上次的收展选择 */
  var LEGEND_KEY = 'football.pitchLegend.v1';
  var pitchLegendToggle = document.getElementById('pitch-legend-toggle');

  function setLegendCollapsed(collapsed) {
    if (!pitchLegend || !pitchLegendToggle) return;
    pitchLegend.classList.toggle('is-collapsed', collapsed);
    pitchLegendToggle.setAttribute('aria-expanded', String(!collapsed));
    try { localStorage.setItem(LEGEND_KEY, collapsed ? 'collapsed' : 'open'); } catch (err) { /* 隐私模式忽略 */ }
  }

  if (pitchLegend && pitchLegendToggle) {
    var legendCollapsed = false;
    try { legendCollapsed = localStorage.getItem(LEGEND_KEY) === 'collapsed'; } catch (err) { /* 隐私模式忽略 */ }
    setLegendCollapsed(legendCollapsed);
    pitchLegendToggle.addEventListener('click', function () {
      setLegendCollapsed(!pitchLegend.classList.contains('is-collapsed'));
    });
  }

  /* ---------- 选择器 ---------- */

  function makeChips(container, order, isActive, onPick, labelOf) {
    container.textContent = '';
    order.forEach(function (key) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.dataset.key = key;
      button.textContent = labelOf ? labelOf(key) : key;
      button.addEventListener('click', function () { onPick(key); });
      container.appendChild(button);
    });
    container.__order = order;
    container.__isActive = isActive;
  }

  function syncChips() {
    Array.prototype.forEach.call(el.formationChips.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.key === state.formation));
    });
    Array.prototype.forEach.call(el.styleChips.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.key === state.style));
    });
  }

  makeChips(el.formationChips, T.FORMATION_ORDER, null, function (key) {
    state.formation = key;
    renderMain();
    writeHash();
  });
  makeChips(el.styleChips, T.STYLE_ORDER, null, function (key) {
    state.style = key;
    renderMain();
    writeHash();
  }, function (key) { return T.STYLES[key].label; });

  ['zones', 'overlays', 'thirds', 'motion'].forEach(function (key) {
    var input = document.getElementById('layer-' + key);
    if (!input) return;
    input.checked = state.layers[key];
    input.addEventListener('change', function () {
      state.layers[key] = input.checked;
      renderMain();
    });
  });

  if (el.randomButton) {
    el.randomButton.addEventListener('click', function () {
      var f = T.FORMATION_ORDER[Math.floor(Math.random() * T.FORMATION_ORDER.length)];
      var s = T.STYLE_ORDER[Math.floor(Math.random() * T.STYLE_ORDER.length)];
      if (f === state.formation && s === state.style) { s = T.STYLE_ORDER[(T.STYLE_ORDER.indexOf(s) + 1) % T.STYLE_ORDER.length]; }
      state.formation = f;
      state.style = s;
      renderMain();
      writeHash();
    });
  }

  /* ---------- 打法小抄 ---------- */

  T.STYLE_ORDER.forEach(function (key) {
    var style = T.STYLES[key];
    var card = document.createElement('article');
    card.className = 'style-card';
    var title = document.createElement('h3');
    title.textContent = style.label;
    var tag = document.createElement('p');
    tag.className = 'style-tag';
    tag.textContent = style.tag;
    var list = document.createElement('ul');
    style.points.forEach(function (row) {
      var li = document.createElement('li');
      li.textContent = row[1];
      list.appendChild(li);
    });
    var jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'link-button';
    jump.textContent = '在战术台预览 →';
    jump.addEventListener('click', function () {
      state.style = key;
      renderMain();
      writeHash();
      document.getElementById('studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    card.appendChild(title);
    card.appendChild(tag);
    card.appendChild(list);
    card.appendChild(jump);
    el.styleCards.appendChild(card);
  });

  /* ---------- 并排对照 ---------- */

  function fillSelect(select, order, labels, current) {
    select.textContent = '';
    order.forEach(function (key) {
      var option = document.createElement('option');
      option.value = key;
      option.textContent = labels ? labels(key) : key;
      select.appendChild(option);
    });
    select.value = current;
  }

  var selects = {};
  ['a', 'b'].forEach(function (side) {
    selects[side] = {
      formation: document.getElementById('cmp-' + side + '-formation'),
      style: document.getElementById('cmp-' + side + '-style'),
      title: document.getElementById('cmp-' + side + '-title'),
      pitch: P.create(document.getElementById('pitch-' + side), {})
    };
    fillSelect(selects[side].formation, T.FORMATION_ORDER, null, state.compare[side].formation);
    fillSelect(selects[side].style, T.STYLE_ORDER, function (k) { return T.STYLES[k].label; }, state.compare[side].style);
    selects[side].formation.addEventListener('change', function () {
      state.compare[side].formation = selects[side].formation.value;
      renderCompare();
      writeHash();
    });
    selects[side].style.addEventListener('change', function () {
      state.compare[side].style = selects[side].style.value;
      renderCompare();
      writeHash();
    });
  });

  function renderCompare() {
    var computed = {};
    ['a', 'b'].forEach(function (side) {
      var cfg = state.compare[side];
      var result = selects[side].pitch.render(cfg, { zones: true, overlays: true, thirds: false });
      selects[side].title.textContent = cfg.formation + ' · ' + result.style.label;
      computed[side] = P.metrics(result.pts);
    });

    el.compareTable.textContent = '';
    METRIC_ROWS.forEach(function (row) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = row.label;
      var tdA = document.createElement('td');
      var tdB = document.createElement('td');
      tdA.textContent = metricText(row.key, computed.a[row.key]);
      tdB.textContent = metricText(row.key, computed.b[row.key]);
      var bigger = computed.a[row.key] >= computed.b[row.key] ? tdA : tdB;
      bigger.classList.add('is-lead');
      tr.appendChild(th);
      tr.appendChild(tdA);
      tr.appendChild(tdB);
      el.compareTable.appendChild(tr);
    });

    var styleA = T.STYLES[state.compare.a.style], styleB = T.STYLES[state.compare.b.style];
    var heightDiff = Math.abs(computed.a.height - computed.b.height);
    var widthDiff = Math.abs(computed.a.width - computed.b.width);
    var who = computed.a.height >= computed.b.height ? 'A' : 'B';
    var text = 'A 是「' + styleA.label + '」，B 是「' + styleB.label + '」。';
    if (heightDiff < 0.02) {
      text += '两套打法的整体站位高度几乎一样，差别主要在线路与职责分工。';
    } else {
      text += who + ' 的整体站位更靠前，平均高出 ' + heightDiff.toFixed(2) + ' 个场地长度；';
    }
    if (widthDiff >= 0.03) {
      text += (computed.a.width >= computed.b.width ? 'A' : 'B') + ' 的横向展开更充分，平均宽度多出 ' + widthDiff.toFixed(2) + '。';
    } else {
      text += '两者的横向宽度接近。';
    }
    el.compareVerdict.textContent = text;
  }

  /* ---------- 分享链接 ---------- */

  if (el.copyButton) {
    el.copyButton.addEventListener('click', function () {
      var url = location.href;
      function done(ok) { el.copyHint.textContent = ok ? '链接已复制，包含当前选择的战术组合。' : '复制失败，可以直接复制地址栏链接。'; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  }

  function writeHash() {
    var parts = [
      'f=' + encodeURIComponent(state.formation),
      's=' + state.style,
      'af=' + encodeURIComponent(state.compare.a.formation),
      'as=' + state.compare.a.style,
      'bf=' + encodeURIComponent(state.compare.b.formation),
      'bs=' + state.compare.b.style
    ];
    try { history.replaceState(null, '', '#' + parts.join('&')); }
    catch (err) { /* file:// 下部分浏览器禁止改写历史，忽略即可 */ }
  }

  var readingHash = false;
  function readHash() {
    if (!location.hash || location.hash.length < 2) return;
    readingHash = true;
    var params = new URLSearchParams(location.hash.slice(1));
    function pickSet(target, prefix) {
      var f = params.get(prefix + 'f'), s = params.get(prefix + 's');
      if (f && T.FORMATIONS[f]) target.formation = f;
      if (s && T.STYLES[s]) target.style = s;
    }
    pickSet(state, '');
    pickSet(state.compare.a, 'a');
    pickSet(state.compare.b, 'b');
    selects.a.formation.value = state.compare.a.formation;
    selects.a.style.value = state.compare.a.style;
    selects.b.formation.value = state.compare.b.formation;
    selects.b.style.value = state.compare.b.style;
    renderMain();
    renderCompare();
    readingHash = false;
  }

  window.addEventListener('hashchange', function () { if (!readingHash) readHash(); });

  renderMain();
  renderCompare();
  readHash();
  writeHash();
})();
