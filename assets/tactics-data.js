/* 足球战术数据：阵型、打法风格、球员职责
   坐标约定：x 0 = 本方球门 → 1 = 对方球门；y 0 = 一侧边线 → 1 = 另一侧边线
   球场按 105m x 68m 归一化，所有位置都是 0~1 的比例值 */
(function (global) {
  'use strict';

  /* 位置分组：用来判断站位调整方向和职责归类 */
  var GROUP = {
    '门将': 'gk',
    '中卫': 'def',
    '边卫': 'def',
    '翼卫': 'def',
    '后腰': 'mid',
    '中场': 'mid',
    '前腰': 'mid',
    '边锋': 'att',
    '中锋': 'att'
  };

  /* 习惯贴边的位置 */
  var WIDE = { '边卫': true, '翼卫': true, '边锋': true };

  /* 位置职责：基础版，任何打法下都成立 */
  var ROLE_DUTY = {
    '门将': '负责最后一道防线，也是后场出球的第一发起点',
    '中卫': '盯防对方前锋、保护身后空当，并完成第一脚向前传递',
    '边卫': '兼顾边路防守与套边支援，是边路宽度的第二来源',
    '翼卫': '整条边路往返，攻防转换时既要下底也要回追',
    '后腰': '防线身前的屏障，负责拦截、保护与转移球',
    '中场': '连接前后场，控制节奏并争夺二点球',
    '前腰': '在对方中场与防线之间接球，负责最后一传',
    '边锋': '拉开宽度，一对一突破或内切制造射门机会',
    '中锋': '支点与终结者，牵制中卫为队友创造空间'
  };

  /* 阵型：players = [球衣号, 位置, x, y]，x 为纵向、y 为横向 */
  var FORMATIONS = {
    '4-3-3': {
      desc: '边锋拉开宽度，中场三人形成倒三角',
      points: [
        ['中场结构', '单后腰拖后保护，两名中场前提支援锋线'],
        ['进攻方式', '边锋一对一拉开，中锋抢点，中场后插上'],
        ['防守弱点', '两名中场身后的肋部容易被直塞打穿']
      ],
      players: [
        [1, '门将', 0.05, 0.50], [2, '边卫', 0.20, 0.86], [4, '中卫', 0.17, 0.63], [5, '中卫', 0.17, 0.37], [3, '边卫', 0.20, 0.14],
        [6, '后腰', 0.34, 0.50], [8, '中场', 0.45, 0.71], [10, '中场', 0.45, 0.29],
        [7, '边锋', 0.68, 0.86], [9, '中锋', 0.75, 0.50], [11, '边锋', 0.68, 0.14]
      ]
    },
    '4-2-3-1': {
      desc: '双后腰保护防线，前腰串联锋线',
      points: [
        ['中场结构', '双后腰形成屏障，前腰在两条线之间活动'],
        ['进攻方式', '边锋内切加边卫套边，中锋做支点'],
        ['防守弱点', '前腰与中锋之间容易被切断，造成前后脱节']
      ],
      players: [
        [1, '门将', 0.05, 0.50], [2, '边卫', 0.20, 0.86], [4, '中卫', 0.17, 0.63], [5, '中卫', 0.17, 0.37], [3, '边卫', 0.20, 0.14],
        [6, '后腰', 0.34, 0.59], [8, '后腰', 0.34, 0.41],
        [7, '边锋', 0.55, 0.86], [10, '前腰', 0.56, 0.50], [11, '边锋', 0.55, 0.14], [9, '中锋', 0.73, 0.50]
      ]
    },
    '3-5-2': {
      desc: '三中卫加双翼卫，中场形成人数优势',
      points: [
        ['中场结构', '五中场控制中路，翼卫负责提供边路宽度'],
        ['进攻方式', '双前锋搭档抢点，翼卫下底传中'],
        ['防守弱点', '翼卫身后空当大，边路回防距离长']
      ],
      players: [
        [1, '门将', 0.05, 0.50], [4, '中卫', 0.17, 0.72], [5, '中卫', 0.15, 0.50], [3, '中卫', 0.17, 0.28],
        [2, '翼卫', 0.34, 0.91], [6, '后腰', 0.34, 0.50], [8, '中场', 0.40, 0.66], [10, '中场', 0.40, 0.34], [11, '翼卫', 0.34, 0.09],
        [9, '中锋', 0.72, 0.60], [7, '中锋', 0.72, 0.40]
      ]
    },
    '4-4-2': {
      desc: '两条四人线平行站位，双前锋搭档',
      points: [
        ['中场结构', '平行四人中场，边路与中路分工清晰'],
        ['进攻方式', '边路传中加双前锋抢点，二点球争夺积极'],
        ['防守弱点', '中路只有两人，容易被对手三人中场压制']
      ],
      players: [
        [1, '门将', 0.05, 0.50], [2, '边卫', 0.20, 0.86], [4, '中卫', 0.17, 0.63], [5, '中卫', 0.17, 0.37], [3, '边卫', 0.20, 0.14],
        [7, '边锋', 0.42, 0.86], [6, '中场', 0.38, 0.60], [8, '中场', 0.38, 0.40], [11, '边锋', 0.42, 0.14],
        [9, '中锋', 0.68, 0.58], [10, '中锋', 0.68, 0.42]
      ]
    },
    '3-4-3': {
      desc: '三中卫支撑，前场三人组高压逼抢',
      points: [
        ['中场结构', '三中卫加双中场，翼卫上下往返'],
        ['进攻方式', '前场三人组换位，边路形成二打一'],
        ['防守弱点', '中场覆盖范围大，被快速转移时容易被拉开']
      ],
      players: [
        [1, '门将', 0.05, 0.50], [4, '中卫', 0.17, 0.72], [5, '中卫', 0.15, 0.50], [3, '中卫', 0.17, 0.28],
        [2, '翼卫', 0.38, 0.89], [6, '后腰', 0.36, 0.60], [8, '中场', 0.36, 0.40], [11, '翼卫', 0.38, 0.11],
        [7, '边锋', 0.66, 0.83], [9, '中锋', 0.74, 0.50], [10, '边锋', 0.66, 0.17]
      ]
    },
    '5-3-2': {
      desc: '五后卫密集防守，双前锋等待反击',
      points: [
        ['防守结构', '五后卫加三名中场，禁区前沿保护充分'],
        ['进攻方式', '断球后长传找双前锋，翼卫前插跟进'],
        ['防守弱点', '进攻人数少，长期被动容易被反复围攻']
      ],
      players: [
        [1, '门将', 0.05, 0.50], [2, '翼卫', 0.22, 0.90], [4, '中卫', 0.15, 0.68], [5, '中卫', 0.13, 0.50], [3, '中卫', 0.15, 0.32], [11, '翼卫', 0.22, 0.10],
        [6, '后腰', 0.33, 0.50], [8, '中场', 0.36, 0.63], [10, '中场', 0.36, 0.37],
        [9, '中锋', 0.62, 0.58], [7, '中锋', 0.62, 0.42]
      ]
    },
    '4-1-4-1': {
      desc: '单后腰保护防线，四人中场平行铺开',
      points: [
        ['中场结构', '单后腰居中拖后，四名中场一字排开覆盖宽度'],
        ['进攻方式', '边锋与边卫叠加套边，中场后排插上支援单前锋'],
        ['防守弱点', '单后腰两侧肋部空当大，被快速转移时容易被打穿']
      ],
      players: [
        [1, '门将', 0.05, 0.50], [2, '边卫', 0.20, 0.86], [4, '中卫', 0.17, 0.63], [5, '中卫', 0.17, 0.37], [3, '边卫', 0.20, 0.14],
        [6, '后腰', 0.33, 0.50],
        [7, '边锋', 0.50, 0.86], [8, '中场', 0.47, 0.62], [10, '中场', 0.47, 0.38], [11, '边锋', 0.50, 0.14],
        [9, '中锋', 0.74, 0.50]
      ]
    },
    '4-2-2-2': {
      desc: '双后腰加双前腰，中路层次最厚的踢法',
      points: [
        ['中场结构', '双后腰兜底，两名前腰在对方中场身后接球'],
        ['进攻方式', '中路二过一渗透，双前锋一前一后错位抢点'],
        ['防守弱点', '边路只有边卫一人，被对手边路连续冲击时吃力']
      ],
      players: [
        [1, '门将', 0.05, 0.50], [2, '边卫', 0.20, 0.88], [4, '中卫', 0.17, 0.63], [5, '中卫', 0.17, 0.37], [3, '边卫', 0.20, 0.12],
        [6, '后腰', 0.34, 0.58], [8, '后腰', 0.34, 0.42],
        [10, '前腰', 0.56, 0.72], [7, '前腰', 0.56, 0.28],
        [9, '中锋', 0.73, 0.58], [11, '中锋', 0.73, 0.42]
      ]
    },
    '5-4-1': {
      desc: '五后卫加四中场，禁区前沿堆人死守',
      points: [
        ['防守结构', '两条线都压到本方半场，中路和禁区前沿双重保护'],
        ['进攻方式', '断球后长传找单前锋，翼卫是唯一的前插点'],
        ['防守弱点', '前场只有一人，控球时间很短，容易被压在半场']
      ],
      players: [
        [1, '门将', 0.05, 0.50], [2, '翼卫', 0.22, 0.90], [4, '中卫', 0.15, 0.68], [5, '中卫', 0.13, 0.50], [3, '中卫', 0.15, 0.32], [11, '翼卫', 0.22, 0.10],
        [7, '中场', 0.34, 0.76], [6, '中场', 0.36, 0.58], [8, '中场', 0.36, 0.42], [10, '中场', 0.34, 0.24],
        [9, '中锋', 0.66, 0.50]
      ]
    }
  };

  var FORMATION_ORDER = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2', '3-4-3', '5-3-2', '4-1-4-1', '4-2-2-2', '5-4-1'];

  /* 不同打法对站位的位移量（按位置分组，单位：场地长度比例） */
  var SHIFT = {
    press: { gk: 0.02, def: 0.12, mid: 0.07, att: 0.04 },
    possession: { gk: 0.00, def: 0.05, mid: 0.02, att: -0.01 },
    counter: { gk: -0.02, def: -0.05, mid: -0.02, att: 0.03 },
    lowblock: { gk: 0.00, def: -0.13, mid: -0.10, att: -0.01 },
    direct: { gk: 0.01, def: -0.01, mid: 0.03, att: 0.06 },
    halfspace: { gk: 0.00, def: 0.06, mid: 0.06, att: 0.02 },
    balanced: { gk: 0.00, def: 0.02, mid: 0.02, att: 0.00 }
  };

  /* 横向拉伸系数：控球拉开宽度，低位防守向中路压缩 */
  var SPREAD = { possession: 1.16, lowblock: 0.84, direct: 0.92, halfspace: 1.02, balanced: 1.0 };

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function adjust(style, player) {
    var group = GROUP[player[1]];
    var x = player[2], y = player[3];
    if (style === 'wings') {
      var isWide = !!WIDE[player[1]];
      return { x: clamp(x + (isWide ? 0.07 : 0.02), 0.045, 0.95), y: isWide ? (y < 0.5 ? 0.055 : 0.945) : y };
    }
    if (style === 'halfspace' && WIDE[player[1]]) {
      /* 肋部渗透：边路球员主动往边线与中路之间的空当里收 */
      return { x: clamp(x + 0.05, 0.045, 0.95), y: y < 0.5 ? 0.30 : 0.70 };
    }
    var shift = SHIFT[style] || SHIFT.press;
    var spread = SPREAD[style] || 1;
    return {
      x: clamp(x + (shift[group] || 0), 0.045, 0.95),
      y: clamp(0.5 + (y - 0.5) * spread, 0.02, 0.98)
    };
  }

  /* 打法风格：站位调整之外，还带覆盖区域、跑动线路和职责变化 */
  var STYLES = {
    press: {
      label: '高位压迫',
      tag: '整条阵线前移，丢球后 5 秒内就地反抢',
      note: '前压 · 就地反抢',
      points: [
        ['压迫高度', '前场六到七人整体前压，防线推到中圈附近'],
        ['进攻发起', '高位断球后立刻二次进攻，常获得直面防线的机会'],
        ['主要风险', '身后留出大片空当，容易被打直塞或长传反击']
      ],
      duties: {
        gk: '站位提前到禁区外，充当清道夫',
        def: '防线压到中圈附近，随时准备造越位',
        mid: '封堵中路传球线路，逼对手往边路出球',
        att: '第一道逼抢线，丢球后立刻就地反抢'
      },
      zones: [{ x0: 0.5, x1: 0.97, tone: 'att', edge: { axis: 'v', at: 0.5 } }],
      overlay: function (pts) {
        return {
          arrows: pts.filter(function (p) { return GROUP[p.role] === 'mid' || GROUP[p.role] === 'att'; })
            .map(function (p) { return { from: [p.x + 0.028, p.y], to: [p.x + 0.115, p.y], tone: 'att' }; })
        };
      }
    },

    possession: {
      label: '控球组织',
      tag: '拉开宽度与纵深，用传球网络层层推进',
      note: '传球网络 · 位置轮转',
      points: [
        ['站位结构', '三线拉开、宽度用满，持球点周围始终保持三角'],
        ['进攻发起', '后场短传渗透，中场第三人跑动，前场制造单点突破'],
        ['主要风险', '后场出球被逼抢失误，直接送给对手单刀']
      ],
      duties: {
        gk: '出球第一点，用短传把球送进中场',
        def: '拉开到边线接应门将，把对手前锋拉出中路',
        mid: '不断位置轮转，为持球人提供两条以上出球线路',
        att: '回撤接球后再前插，制造局部人数优势'
      },
      zones: [],
      overlay: function (pts) {
        var seen = {}, lanes = [];
        pts.forEach(function (a, i) {
          pts.map(function (b, j) { return { j: j, d: Math.hypot((b.x - a.x) * 1.544, b.y - a.y) }; })
            .filter(function (o) { return o.j !== i; })
            .sort(function (m, n) { return m.d - n.d; })
            .slice(0, 2)
            .forEach(function (o) {
              var key = Math.min(i, o.j) + '-' + Math.max(i, o.j);
              if (!seen[key]) { seen[key] = 1; lanes.push([[a.x, a.y], [pts[o.j].x, pts[o.j].y]]); }
            });
        });
        return { lanes: lanes };
      }
    },

    counter: {
      label: '快速反击',
      tag: '中后场收缩，断球后 3-4 脚直传打身后',
      note: '直传打身后',
      points: [
        ['防守形态', '中后场收缩，主动让出控球权'],
        ['转换方式', '断球后三到四脚直传打身后，锋线保持高位等待接应'],
        ['主要风险', '长时间无球体能消耗大，落入阵地战缺少办法']
      ],
      duties: {
        def: '断球后第一脚直传打身后，不做多余的横传',
        mid: '收在防线身前完成拦截，得球后立刻向前找人',
        att: '保持高位待接长传，反击时冲刺对方中卫身后'
      },
      zones: [{ x0: 0.06, x1: 0.44, tone: 'def', edge: { axis: 'v', at: 0.44 } }],
      overlay: function (pts) {
        var sources = pts.filter(function (p) { return p.role === '中卫'; }).slice(0, 2)
          .concat(pts.filter(function (p) { return p.role === '后腰'; }).slice(0, 1));
        var targets = pts.filter(function (p) { return GROUP[p.role] === 'att'; }).slice(0, 2);
        var arrows = [];
        if (targets.length) {
          sources.forEach(function (s, i) {
            var t = targets[i % targets.length];
            /* 直传打身后是「球」的线路，用 lane 色走点线 */
            arrows.push({ from: [s.x + 0.03, s.y], to: [t.x - 0.04, t.y], tone: 'lane' });
          });
        }
        return { arrows: arrows };
      }
    },

    lowblock: {
      label: '低位防守',
      tag: '本方 30 米内压缩成两条线，禁区前沿优先保护',
      note: '整体回收',
      points: [
        ['防守形态', '本方三十米区域压缩成两条线，中路比边路更优先保护'],
        ['断球方式', '密集协防与解围，不轻易出脚上抢'],
        ['主要风险', '被反复围攻，远射与定位球是主要失球来源']
      ],
      duties: {
        def: '退到禁区前沿一字排开，优先封堵射门线路',
        mid: '与防线保持八到十米距离，保护弧顶和二点球',
        att: '回收到中圈附近干扰出球，不参与高位逼抢'
      },
      zones: [{ x0: 0.055, x1: 0.36, tone: 'def', edge: { axis: 'v', at: 0.36 } }],
      overlay: function (pts) {
        var arrows = [];
        pts.forEach(function (p) {
          if (GROUP[p.role] !== 'def' && GROUP[p.role] !== 'mid') return;
          var x1 = p.x - 0.025, x2 = Math.max(0.035, p.x - 0.095);
          if (x1 - x2 > 0.02) arrows.push({ from: [x1, p.y], to: [x2, p.y], tone: 'def' });
        });
        return { arrows: arrows };
      }
    },

    wings: {
      label: '边路进攻',
      tag: '边后卫与边锋叠瓦套边，边路形成二打一',
      note: '套边 · 底线传中',
      points: [
        ['进攻通道', '边后卫与边锋叠瓦套边，边路形成二打一'],
        ['终结方式', '底线传中或倒三角回做，中路包抄抢点'],
        ['主要风险', '边后卫身后空当被打反击，中路缺少支点']
      ],
      duties: {
        def: '边卫大胆前插套边，中卫负责补位保护边路身后',
        mid: '向边路靠拢形成三角，接应套边后的回传',
        att: '贴边拿球吸引防守，为套边的队友让出通道'
      },
      zones: [
        { x0: 0, x1: 1, y0: 0, y1: 0.135, tone: 'att', edge: { axis: 'h', at: 0.135 } },
        { x0: 0, x1: 1, y0: 0.865, y1: 1, tone: 'att', edge: { axis: 'h', at: 0.865 } }
      ],
      overlay: function (pts) {
        var arrows = pts.filter(function (p) { return WIDE[p.role]; })
          .map(function (p) { return { from: [p.x + 0.025, p.y], to: [p.x + 0.115, p.y], tone: 'att' }; });
        return {
          arrows: arrows,
          curves: [
            /* 底线传中同样是「球」的线路 */
            { from: [0.76, 0.085], c: [0.94, 0.10], to: [0.90, 0.42], tone: 'lane' },
            { from: [0.76, 0.915], c: [0.94, 0.90], to: [0.90, 0.58], tone: 'lane' }
          ]
        };
      }
    },

    direct: {
      label: '长传冲吊',
      tag: '后场直接起球找锋线，前场专注争顶与二点球',
      note: '长传 · 争二点',
      points: [
        ['进攻发起', '后场拿球不做过多短传，第一选择是把球送进对方半场'],
        ['前场分工', '中锋抢第一点，中场压上抢二点球并就地组织二次进攻'],
        ['主要风险', '传球成功率低，丢球后被对手快速反击，中场容易暴露']
      ],
      duties: {
        gk: '开大脚直接找前场高点，不做后场短传倒脚',
        def: '得球后第一时间起长传，防线保持紧凑不给反击空间',
        mid: '压到中锋身后抢二点球，抢到后立刻分边或远射',
        att: '中锋卡住中卫争顶，边锋跟进包抄落点'
      },
      zones: [{ x0: 0.58, x1: 0.88, tone: 'att', edge: { axis: 'v', at: 0.58 } }],
      overlay: function (pts) {
        var backs = pts.filter(function (p) { return p.role === '中卫'; }).slice(0, 3);
        var striker = pts.filter(function (p) { return p.role === '中锋'; })[0];
        var arrows = [], curves = [];
        if (!striker) return { arrows: arrows, curves: curves };
        backs.forEach(function (b, i) {
          /* 中卫起长传找中锋：属于「球」的线路 */
          curves.push({
            from: [b.x + 0.02, b.y],
            c: [(b.x + striker.x) / 2, b.y + (striker.y - b.y) * 0.25],
            to: [striker.x - 0.04, striker.y + (i - 1) * 0.05],
            tone: 'lane'
          });
        });
        arrows.push({ from: [striker.x + 0.02, striker.y], to: [striker.x + 0.10, striker.y], tone: 'att' });
        pts.filter(function (p) { return GROUP[p.role] === 'mid'; }).slice(0, 2).forEach(function (m) {
          arrows.push({ from: [m.x + 0.02, m.y], to: [Math.min(0.92, m.x + 0.14), striker.y], tone: 'lane' });
        });
        return { arrows: arrows, curves: curves };
      }
    },

    halfspace: {
      label: '肋部渗透',
      tag: '从边线与中路之间的肋部接球，斜插禁区或倒三角回做',
      note: '肋部 · 倒三角',
      points: [
        ['进攻通道', '边路球员收到肋部，边卫在外面套边把对手边后卫拉走'],
        ['终结方式', '肋部接球后斜插禁区，或者回做给跟进的队友远射'],
        ['主要风险', '肋部一旦丢球，中路只剩后腰一人，回防距离很长']
      ],
      duties: {
        gk: '短传出球后站到禁区外，随时准备接回传',
        def: '边卫套边拉开宽度，中卫横向保护肋部身后',
        mid: '在肋部接球完成转身，是最主要的推进点',
        att: '先收进肋部再斜插禁区，抢在对方中卫身前完成射门'
      },
      zones: [
        { x0: 0.46, x1: 0.94, y0: 0.17, y1: 0.35, tone: 'att', edge: { axis: 'v', at: 0.46 } },
        { x0: 0.46, x1: 0.94, y0: 0.65, y1: 0.83, tone: 'att', edge: { axis: 'v', at: 0.46 } }
      ],
      overlay: function (pts) {
        var arrows = pts.filter(function (p) { return WIDE[p.role]; }).map(function (p) {
          return { from: [p.x, p.y], to: [Math.min(0.93, p.x + 0.08), p.y < 0.5 ? 0.27 : 0.73], tone: 'att' };
        });
        return {
          arrows: arrows,
          curves: [
            { from: [0.60, 0.28], c: [0.82, 0.26], to: [0.89, 0.44], tone: 'lane' },
            { from: [0.60, 0.72], c: [0.82, 0.74], to: [0.89, 0.56], tone: 'lane' }
          ]
        };
      }
    },

    balanced: {
      label: '攻守平衡',
      tag: '站位不冒进也不回收，靠短传网络稳稳推进',
      note: '保持队形',
      points: [
        ['站位结构', '三线距离均匀，抢下球权后先稳住阵型再向前'],
        ['进攻发起', '每个持球人身边至少一个短传接应点，不冒险直塞'],
        ['主要风险', '缺少针对性，遇到高强度逼抢或铁桶阵时打不开局面']
      ],
      duties: {
        gk: '按需选择短传或大脚，不勉强出球',
        def: '保持与中场的距离，既不上抢太深也不一味退防',
        mid: '稳住球权、横向转移，把球送到状态更好的队友脚下',
        att: '在前场回接串联，机会不好就不强行突破'
      },
      zones: [{ x0: 0.32, x1: 0.68, tone: 'lane', edge: { axis: 'v', at: 0.5 } }],
      overlay: function (pts) {
        var seen = {}, lanes = [];
        pts.forEach(function (a, i) {
          pts.map(function (b, j) { return { j: j, d: Math.hypot((b.x - a.x) * 1.544, b.y - a.y) }; })
            .filter(function (o) { return o.j !== i; })
            .sort(function (m, n) { return m.d - n.d; })
            .slice(0, 1)
            .forEach(function (o) {
              var key = Math.min(i, o.j) + '-' + Math.max(i, o.j);
              if (!seen[key]) { seen[key] = 1; lanes.push([[a.x, a.y], [pts[o.j].x, pts[o.j].y]]); }
            });
        });
        return { lanes: lanes };
      }
    }
  };

  var STYLE_ORDER = ['press', 'possession', 'counter', 'lowblock', 'wings', 'direct', 'halfspace', 'balanced'];

  global.TACTICS = {
    GROUP: GROUP,
    WIDE: WIDE,
    ROLE_DUTY: ROLE_DUTY,
    FORMATIONS: FORMATIONS,
    FORMATION_ORDER: FORMATION_ORDER,
    STYLES: STYLES,
    STYLE_ORDER: STYLE_ORDER,
    adjust: adjust
  };
})(window);
