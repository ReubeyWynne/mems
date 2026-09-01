/* kvk.js — KvK & Strongest Governor page toys: the live 28-day clock,
   today's card (what's efficient, what to save), and the KingShot copy
   generator. Registers with common.js via window.BH.registerPage.
   The copy blocks are built for KingShot chat: ≤512 characters a message,
   ✅/🆗/🚫 and full-width ｜ only — no box-drawing, no arrows. */
(function () {
  'use strict';

  // ── The 28-day wheel ───────────────────────────────────
  // Brawl week (1-7) → Strongest Governor (8-14) → Alliance
  // Mobilization (15-21) → KvK prep (22-26) + battle weekend (27-28).
  var CYCLE_LEN = 28;

  // The alliance's prep chart, validated against the community tables:
  // 16 materials × the 5 prep days, each cell best|ok|no.
  var MATRIX = [
    ['Truegold',        ['best', 'ok',  'no',   'no',   'ok']],
    ['Tempered TG',     ['best', 'ok',  'no',   'no',   'ok']],
    ['Hero shard',      ['no',   'best', 'best', 'no',   'no']],
    ['Master emblem',   ['no',   'best', 'best', 'no',   'no']],
    ['Building',        ['ok',   'best', 'no',   'no',   'no']],
    ['Troop',           ['no',   'no',   'no',   'best', 'ok']],
    ['Research',        ['ok',   'best', 'no',   'no',   'ok']],
    ['Hero roulette',   ['no',   'best', 'best', 'no',   'no']],
    ['Gathering',       ['no',   'best', 'no',   'best', 'best']],
    ['Intel missions',  ['best', 'no',   'best', 'no',   'best']],
    ['Pets advance',    ['no',   'no',   'best', 'no',   'best']],
    ['Gov charm',       ['best', 'no',   'best', 'best', 'no']],
    ['Gov gear',        ['no',   'no',   'no',   'no',   'best']],
    ['Widget gear',     ['no',   'no',   'no',   'best', 'best']],
    ['Mithril',         ['no',   'no',   'no',   'best', 'best']],
    ['Forgehammer',     ['no',   'no',   'no',   'best', 'best']]
  ];

  // A representative points-per-unit per material (for the today card).
  var PTS = {
    'Truegold': '2,000', 'Tempered TG': '30,000', 'Hero shard': '3,040+',
    'Master emblem': '6,000', 'Building': '30/min', 'Troop': '75 (T11)',
    'Research': '30/min', 'Hero roulette': '8,000', 'Gathering': '2',
    'Intel missions': '6,000', 'Pets advance': '15,000', 'Gov charm': '70',
    'Gov gear': '—', 'Widget gear': '8,000', 'Mithril': '40,000', 'Forgehammer': '4,000'
  };

  var GLYPH = { best: '\u2705', ok: '\uD83C\uDD97', no: '\uD83D\uDEAB' }; // ✅ 🆗 🚫

  var KOP_THEMES = ['City Construction', 'Basic Skills Up', 'Pet Training', 'Gear & Troops', 'Combined'];
  /* The daily reward thresholds are not stated here: they scale with the
     server and Town Center level, so the goal is always the 200k chest. */

  // Top-value tasks per prep day, for the "best value today" line.
  var KOP_TOPS = [
    ['Tempered Truegold', 30000], ['Intel missions', 6000], ['Truegold', 2000],
    ['Hero Roulette', 8000], ['Master emblem', 6000], ['Mythic shard', 3040], ['Truegold', 2000],
    ['Advanced Taming Mark', 15000], ['Hero Roulette', 8000], ['Intel missions', 6000],
    ['Mithril', 40000], ['Widget gear', 8000], ['Forgehammer', 4000], ['T11 troop', 75],
    ['Gov gear', 0], ['Truegold', 2000], ['Mithril', 40000], ['Intel missions', 6000]
  ];
  function kopTops(day) { // day 1-5
    var ranges = [[0, 3], [3, 7], [7, 10], [10, 14], [14, 18]];
    var r = ranges[day - 1];
    return KOP_TOPS.slice(r[0], r[1]);
  }

  var SG_THEMES = ['City Construction', 'Hero Development', 'Skill Up', 'Combat Training', 'Skill Up', 'Combat Training', 'Hero Development'];
  var SG_TASKS = [
    [['Tempered Truegold', 30000], ['Truegold', 2000], ['Gov charm', 70], ['Speedups', 30]],
    [['Mithril', 40000], ['Widget gear', 8000], ['Hero Roulette', 8000], ['Forgehammer', 4000], ['Mythic shard', 3040], ['Truegold', 2000], ['Epic shard', 1220], ['Rare shard', 350]],
    [['Advanced Taming Mark', 15000], ['Hero Roulette', 8000], ['Master emblem', 6000], ['Mythic shard', 3040], ['Epic shard', 1220], ['Common Taming Mark', 1150], ['Rare shard', 350], ['Gov charm', 70], ['Pet Advancement', 50]],
    [['Mithril', 40000], ['Widget gear', 8000], ['Forgehammer', 4000], ['Gov charm', 70], ['T10 troops', 39]],
    [['Mithril', 40000], ['Widget gear', 8000], ['Forgehammer', 4000], ['Truegold', 2000], ['Speedups', 30]],
    [['Gov charm', 36], ['T10 troops', 39]],
    [['Advanced Taming Mark', 15000], ['Mythic shard', 3040], ['Truegold', 2000], ['Epic shard', 1220], ['Common Taming Mark', 1150], ['Rare shard', 350], ['Pet Advancement', 50], ['Gathering', 3]]
  ];
  // Off-week save lists are deliberately day-less: the day mapping lives on
  // the prep chart, and the off-weeks (Brawl, Mobilization) have no scoring
  // days of their own — the roulette never runs then either.
  var SAVE_KVK = ['Truegold', 'Hero shards', 'Master emblems', 'Taming marks', 'Gems for roulette', 'Widgets + hammers', 'Mithril', 'Gov gear'];
  var SAVE_SG = ['Hero shards', 'Taming marks', 'Mithril', 'Widgets + forgehammers', 'Truegold', 'Gems for roulette'];

  // Short task names for the KingShot copy (keeps lines under the width cap).
  var SG_SHORT = {
    'Hero Roulette': 'Roulette', 'Widget gear': 'Widget', 'Mythic shard': 'Mythic',
    'Epic shard': 'Epic', 'Rare shard': 'Rare', 'Advanced Taming Mark': 'Adv Taming',
    'Common Taming Mark': 'Taming', 'Pet Advancement': 'Pets', 'T10 troops': 'T10',
    'Gathering': 'Gather'
  };

  // ── State — the schedule is GLOBAL: one wheel, anchored to dates ──
  // Cycle day 1 = 2026-08-18 (so 2026-09-01 is day 15 — the mobilization
  // week, and KvK prep opens 2026-09-08). Every kingdom turns the same
  // wheel on the same day. If the game's server date ever differs from
  // the device's, the calibration input on the page re-anchors day 1.
  var KEY = 'ks_epoch';
  var EPOCH = new Date(2026, 7, 18); // month 7 = August
  try {
    var saved = localStorage.getItem(KEY);
    if (saved) {
      var p = saved.split('-').map(Number);
      if (p.length === 3 && p[0] > 2000) EPOCH = new Date(p[0], p[1] - 1, p[2]);
    }
  } catch (e) { /* private mode */ }

  function epochISO() {
    var m = String(EPOCH.getMonth() + 1);
    var d = String(EPOCH.getDate());
    if (m.length < 2) m = '0' + m;
    if (d.length < 2) d = '0' + d;
    return EPOCH.getFullYear() + '-' + m + '-' + d;
  }

  function dayFromDate(dt) {
    var ms = Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) -
             Date.UTC(EPOCH.getFullYear(), EPOCH.getMonth(), EPOCH.getDate());
    var n = Math.floor(ms / 86400000);
    return ((n % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN + 1;
  }
  function todayDay() { return dayFromDate(new Date()); }

  var day = todayDay();

  function setDay(n, BH) {
    day = ((n - 1 + CYCLE_LEN) % CYCLE_LEN) + 1;
    render(BH);
  }

  function weekOf(d) {
    if (d <= 7) return 'brawl';
    if (d <= 14) return 'sg';
    if (d <= 21) return 'mob';
    if (d <= 26) return 'prep';
    return 'battle';
  }
  function prepDayOf(d) { return d - 21; }          // 22-26 → 1-5
  function sgDayOf(d) { return d - 7; }             // 8-14 → 1-7

  // ── The wheel ──────────────────────────────────────────
  function paintCycle(BH) {
    var box = document.getElementById('ks-cycle');
    if (!box) return;
    var keys = '<div class="cycle-keys" aria-hidden="true">' +
      '<span>' + BH.tr('ks.week.brawl', 'Brawl') + '</span>' +
      '<span>' + BH.tr('ks.week.sgShort', 'Governor') + '</span>' +
      '<span>' + BH.tr('ks.week.mobShort', 'Mobilize') + '</span>' +
      '<span>' + BH.tr('ks.week.prepShort', 'KvK') + '</span></div>';
    var cells = '';
    var tday = todayDay();
    for (var d = 1; d <= CYCLE_LEN; d++) {
      var w = weekOf(d);
      var label = BH.tr('ks.week.' + w, w) + ' \u2014 day ' + d;
      var cls = 'cell ' + w;
      if (d === day) cls += ' now';
      else if (d === tday) cls += ' mark';
      cells += '<span class="' + cls + '" role="img" aria-label="' + label + '" title="' + label + '"></span>';
    }
    box.innerHTML = keys + '<div class="cycle-bar">' + cells + '</div>';
  }

  // ── The today card ─────────────────────────────────────
  function rowHTML(mark, name, pts, extra) {
    return '<div class="trow' + (mark === GLYPH.no ? ' dont' : '') + (extra ? ' keep' : '') + '"><span class="tmark">' + mark + '</span>' +
      '<span class="tname">' + name + '</span>' +
      (pts ? '<span class="tpts">' + pts + '</span>' : '<span class="tpts"></span>') +
      (extra ? '<span class="tkeep">' + extra + '</span>' : '') + '</div>';
  }

  function zone(title, html) {
    return '<div class="today-zone"><h4>' + title + '</h4>' + html + '</div>';
  }

  function prepCard(n, BH) {
    var theme = KOP_THEMES[n - 1];
    var head = '<p class="today-kicker">' + BH.tr('ks.today.kickerPrep', 'KvK prep') + ' \u00B7 ' + BH.tr('ks.today.day', 'day') + ' ' + n + '</p>' +
      '<p class="today-title">' + theme + '</p>' +
      '<p class="today-meta">' + BH.tr('ks.today.chest', 'the daily goal is the 200,000-point chest') + '</p>';

    var best = '', ok = '', dont = '';
    for (var i = 0; i < MATRIX.length; i++) {
      var st = MATRIX[i][1][n - 1];
      var html = rowHTML(GLYPH[st], MATRIX[i][0], PTS[MATRIX[i][0]]);
      if (st === 'best') best += html;
      else if (st === 'ok') ok += html;
      else dont += html;
    }

    var body = zone(BH.tr('ks.today.spend', 'spend today'), best + ok) +
      zone(BH.tr('ks.today.dont', "don't touch"), dont);

    return { head: head, body: body, copy: dayBlock(n), copyTitle: BH.tr('ks.today.copyToday', 'copy today for KingShot') };
  }

  function sgCard(n, BH) {
    var tasks = SG_TASKS[n - 1].slice().sort(function (a, b) { return b[1] - a[1]; });
    var rows = '';
    for (var i = 0; i < tasks.length; i++) {
      rows += rowHTML('\u00B7', tasks[i][0], BH.fmt(tasks[i][1]));
    }
    var head = '<p class="today-kicker">' + BH.tr('ks.today.kickerSg', 'Strongest Governor') + ' \u00B7 ' + BH.tr('ks.today.day', 'day') + ' ' + n + '</p>' +
      '<p class="today-title">' + SG_THEMES[n - 1] + '</p>' +
      '<p class="today-meta">' + BH.tr('ks.today.sgMeta', 'daily rank closes at 00:00 UTC \u2014 two challenge medals a day') + '</p>';
    var body = zone(BH.tr('ks.today.top', 'best value today'), rows) +
      '<p class="note">' + BH.tr('ks.today.sgNote', 'roulette spins cost gems, so only spin on a day that pays well; hold intel missions from 08:00 the day before a scoring day so they bank for the event. Most of the time the fixed rewards beat the rankings: SG rank prizes are time-limited cosmetics, and your kingdom\u2019s KvK record is the legacy.') + '</p>';
    return { head: head, body: body, copy: sgCopy(n), copyTitle: BH.tr('ks.today.copySg', 'copy this day for KingShot') };
  }

  function battleCard(BH) {
    var facts = [
      BH.tr('ks.battle.f1', 'the castle contest runs a full 5 hours. hold it 2.5 hours continuously as one alliance and you win on the spot; otherwise the alliance with the most total hold time when the window closes takes it. the game runs the full 5 hours even once a side is mathematically uncatchable'),
      BH.tr('ks.battle.f2', 'four turrets wear the defenders down and give occupiers lethality'),
      BH.tr('ks.battle.f3', 'the battle day runs ~10:00\u201322:00 UTC; the castle is contestable for the full 5 hours within it'),
      BH.tr('ks.battle.f7', 'the window itself: during 10:00\u201322:00 UTC players can teleport between the servers and troop kills score points, all-out style. fun to blow off steam, but don\u2019t burn too many troops and resources. check world and alliance chat for any rules of engagement agreed between the servers first'),
      BH.tr('ks.battle.f5', 'field triage: 30% base recovery, up to 90% with satchels and rescue orders'),
      BH.tr('ks.battle.f6', 'shield before the window: the gap between phases is when towns fall, and the shield is essential for any time you spend offline in the battle window')
    ];
    var rows = '';
    for (var i = 0; i < facts.length; i++) rows += rowHTML('\u00B7', facts[i], '');
    var head = '<p class="today-kicker">' + BH.tr('ks.today.kickerBattle', 'KvK') + ' \u00B7 ' + BH.tr('ks.today.battleSub', 'battle weekend') + '</p>' +
      '<p class="today-title">' + BH.tr('ks.today.battleTitle', 'The Castle') + '</p>';
    var body = zone(BH.tr('ks.today.spend', 'the rules'), rows) +
      '<p class="note">' + BH.tr('ks.today.battleNote', 'your prep hoard is the healing fund \u2014 food and wood burn fast here.') + '</p>';
    return { head: head, body: body, copy: battleCopy(BH), copyTitle: BH.tr('ks.today.copyBattle', 'copy the battle reminder for KingShot') };
  }

  function offCard(week, BH) {
    var save = week === 'brawl' ? SAVE_SG : SAVE_KVK;
    var kicker = week === 'brawl' ? BH.tr('ks.today.kickerBrawl', 'week 1') + ' \u00B7 ' + BH.tr('ks.week.brawl', 'Brawl') : BH.tr('ks.today.kickerMob', 'week 3') + ' \u00B7 ' + BH.tr('ks.week.mob', 'Alliance Mobilization');
    var title = week === 'brawl' ? BH.tr('ks.week.brawl', 'Brawl week') : BH.tr('ks.week.mob', 'Alliance Mobilization week');
    var dayNote = '';
    if (week === 'mob' && day >= 20) {
      dayNote += '<p class="today-meta">' + BH.tr('ks.today.matchmaking', 'KvK matchmaking: your opponent is revealed.') + '</p>';
    }
    if (week === 'mob' && day === 20) {
      dayNote += '<p class="today-meta">' + BH.tr('ks.today.swordSunday', 'Swordland Showdown\u2019s one-hour battle runs today, the Sunday of this week.') + '</p>';
    }
    if (week === 'mob' && day === 21) {
      dayNote += '<p class="today-meta">' + BH.tr('ks.today.holdIntel', 'from 08:00 today, stop collecting intel missions. They bank and cash in for prep points.') + '</p>';
    }
    var rows = '';
    for (var i = 0; i < save.length; i++) rows += rowHTML('\u00B7', save[i], '');
    var head = '<p class="today-kicker">' + kicker + '</p><p class="today-title">' + title + '</p>' + dayNote;
    var body = zone(BH.tr('ks.today.hold', 'hold these'), rows) +
      '<p class="note">' + (week === 'brawl'
        ? BH.tr('ks.today.brawlNote', 'its own week. Swordland Showdown\u2019s one-hour battle is on Sunday, one of two in the cycle, and there are no fixed daily prep themes. Keep the KvK-precious hoard intact; Strongest Governor is next.')
        : BH.tr('ks.today.mobNote', 'its own event, with no fixed daily themes. Spend minimal KvK-precious resources: skip the Armament Competition and Officer Project rankings, just take the fixed rewards with minimal resources. The hoard is for prep.')) + '</p>';
    return { head: head, body: body, copy: saveCopy(week === 'brawl' ? 'sg' : 'kvk', BH), copyTitle: BH.tr('ks.today.copySave', 'copy the save list for KingShot') };
  }

  function render(BH) {
    var out = document.getElementById('ks-day-out');
    if (out) out.textContent = BH.tr('ks.today.dayOut', 'day {n} of 28').replace('{n}', day) +
      (day === todayDay() ? ' ' + BH.tr('ks.today.isToday', '\u00B7 today') : '');
    paintCycle(BH);
    highlightMatrix(BH);

    var card = document.getElementById('ks-card');
    if (!card) return;
    var w = weekOf(day);
    var info;
    if (w === 'prep') info = prepCard(prepDayOf(day), BH);
    else if (w === 'sg') info = sgCard(sgDayOf(day), BH);
    else if (w === 'battle') info = battleCard(BH);
    else info = offCard(w, BH);

    card.innerHTML = info.head + info.body + copyBoxHTML(info.copy, info.copyTitle);
    wireCopy(BH, info.copy);
  }

  // ── The matrix highlight ───────────────────────────────
  function highlightMatrix(BH) {
    var table = document.getElementById('ks-matrix');
    if (!table) return;
    var w = weekOf(day);
    var n = w === 'prep' ? prepDayOf(day) : 0;
    var heads = table.querySelectorAll('thead th');
    var cells = table.querySelectorAll('td[data-d]');
    for (var i = 0; i < heads.length; i++) heads[i].classList.toggle('today', n > 0 && i === n);
    for (var j = 0; j < cells.length; j++) {
      cells[j].classList.toggle('today', n > 0 && parseInt(cells[j].getAttribute('data-d'), 10) === n);
    }
  }

  // ── KingShot copy ──────────────────────────────────────
  // KingShot chat has a fixed width and a LINE CAP — the full prep chart
  // comes back from a paste with its rows merged (the alliance's own test
  // showed it). So every copy block is compact: ≤6 lines, no blank lines,
  // short chat labels. One prep day = one message.

  // Short chat labels — the alliance's own chart words.
  var SHORT = {
    'Truegold': 'Truegold', 'Tempered TG': 'Tempered TG', 'Hero shard': 'Hero shard',
    'Master emblem': 'Master', 'Building': 'Building', 'Troop': 'Troop', 'Research': 'Research',
    'Hero roulette': 'Wheel', 'Gathering': 'Gathering', 'Intel missions': 'Intel',
    'Pets advance': 'Pets', 'Gov charm': 'Gov charm', 'Gov gear': 'Gov gear',
    'Widget gear': 'Widget', 'Mithril': 'Mithril', 'Forgehammer': 'Hammer'
  };

  // One prep day, ≤6 lines: header, theme, then the ✅/🆗/🚫 groups.
  // Lines wrap at ~50 chars (KingShot's fixed width) and the 🚫 group
  // compresses to "everything else" when it would take more than one line.
  function fit(items, mark, max) {
    var line = mark + ' ' + items.join(' \u00B7 ');
    if (line.length <= max) return [line];
    var cut = line.lastIndexOf(' \u00B7 ', max);
    if (cut <= mark.length) return [line];
    return [line.slice(0, cut), mark + ' ' + line.slice(cut + 5)];
  }

  function dayBlock(n) {
    var groups = { best: [], ok: [], no: [] };
    for (var i = 0; i < MATRIX.length; i++) {
      var st = MATRIX[i][1][n - 1];
      groups[st].push(SHORT[MATRIX[i][0]]);
    }
    var lines = ['\uD83D\uDC51KVK PREP \u00B7 DAY ' + n + '\uD83D\uDC51', KOP_THEMES[n - 1]];
    lines = lines.concat(fit(groups.best, '\u2705', 50), fit(groups.ok, '\uD83C\uDD97', 50));
    lines.push('\uD83D\uDEAB ' + (groups.no.length > 4 ? 'everything else, save it' : groups.no.join(' \u00B7 ')));
    return lines.join('\n');
  }

  function sgCopy(n) {
    var tasks = SG_TASKS[n - 1].slice().sort(function (a, b) { return b[1] - a[1]; });
    var pieces = [];
    for (var i = 0; i < tasks.length; i++) {
      pieces.push(tasks[i][1].toLocaleString('en-GB') + ' ' + (SG_SHORT[tasks[i][0]] || tasks[i][0]));
    }
    var lines = ['\uD83D\uDC51SG DAY ' + n + ' \u00B7 ' + SG_THEMES[n - 1] + '\uD83D\uDC51'];
    var cur = '';
    for (var j = 0; j < pieces.length; j++) {
      var add = (cur ? ' \u00B7 ' : '') + pieces[j];
      if (cur && cur.length + add.length > 50) { lines.push(cur); cur = pieces[j]; }
      else cur += add;
    }
    lines.push(cur);
    lines.push('roulette costs gems \u00B7 hold intel from 08:00');
    return lines.join('\n');
  }

  function battleCopy(BH) {
    return [
      '\uD83D\uDC51KVK BATTLE WEEKEND\uD83D\uDC51',
      'castle: 5h contest',
      '2.5h continuous = early win \u00B7 else most hold time',
      '10-22 UTC: teleports + kill points (chat rules)',
      '4 turrets \u00B7 triage 30% \u2192 90%',
      'SHIELD before the window, essential offline'
    ].join('\n');
  }

  function saveCopy(target, BH) {
    var list = target === 'kvk' ? SAVE_KVK : SAVE_SG;
    var title = target === 'kvk' ? 'SAVE FOR KVK' : 'SAVE FOR GOVERNOR';
    var lines = ['\uD83D\uDC51' + title + '\uD83D\uDC51'];
    var cur = '';
    for (var i = 0; i < list.length; i++) {
      var add = (cur ? ' \u00B7 ' : '') + list[i];
      if (cur && cur.length + add.length > 50) { lines.push(cur); cur = list[i]; }
      else cur += add;
    }
    lines.push(cur);
    return lines.join('\n');
  }

  // Split into ≤512-char messages at line boundaries.
  var LIMIT = 512;
  function splitParts(text) {
    var parts = [];
    var rest = text;
    while (rest.length > LIMIT) {
      var cut = rest.lastIndexOf('\n', LIMIT);
      if (cut < 1) cut = LIMIT;
      parts.push(rest.slice(0, cut));
      rest = rest.slice(cut).replace(/^\n+/, '');
    }
    parts.push(rest);
    return parts;
  }

  function copyBoxHTML(text, title) {
    return '<div class="copy-box">' +
      '<p class="copy-label">' + title + '</p>' +
      '<textarea id="ks-copy-out" readonly spellcheck="false"></textarea>' +
      '<p class="copy-meta" id="ks-copy-meta"></p>' +
      '<div class="copy-btns">' +
      '<button type="button" id="ks-copy-btn" class="kb">' + window.BH.tr('ks.today.copyBtn', 'copy') + '</button>' +
      '<span id="ks-copy-parts" class="cycle-quick"></span>' +
      '</div>' +
      '<p class="copy-note">' + window.BH.tr('ks.today.copyNote', 'Shaped for KingShot chat: short lines that paste cleanly. If a block runs over one message, it comes split into parts; paste them in order.') + '</p>' +
      '</div>';
  }

  function wireCopy(BH, text) {
    var out = document.getElementById('ks-copy-out');
    var meta = document.getElementById('ks-copy-meta');
    var btn = document.getElementById('ks-copy-btn');
    var partsWrap = document.getElementById('ks-copy-parts');
    if (!out || !meta || !btn) return;

    var parts = splitParts(text);
    var idx = 0;

    function paint() {
      out.value = parts[idx];
      var len = parts[idx].length;
      var fits = len <= LIMIT;
      meta.innerHTML = BH.tr('ks.today.chars', '<b>{n}</b> / 512 characters').replace('{n}', BH.fmt(len)) +
        (fits ? ' \u2014 ' + BH.tr('ks.today.fits', 'fits one message') : ' \u2014 <span class="over">' + BH.tr('ks.today.over', 'split into {n} messages').replace('{n}', parts.length) + '</span>');
      btn.textContent = (parts.length > 1 ? BH.tr('ks.today.part', 'part {n}').replace('{n}', idx + 1) + ' \u00B7 ' : '') + BH.tr('ks.today.copyBtn', 'copy');
      if (partsWrap) {
        partsWrap.innerHTML = '';
        for (var i = 0; i < parts.length; i++) {
          (function (pi) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'kb' + (pi === idx ? ' on' : '');
            b.textContent = BH.tr('ks.today.part', 'part {n}').replace('{n}', pi + 1);
            b.addEventListener('click', function () { idx = pi; paint(); });
            partsWrap.appendChild(b);
          })(i);
        }
      }
    }

    function doCopy() {
      var done = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(out.value).then(function () { done = true; }).catch(function () { done = false; });
      }
      if (!done) {
        out.focus();
        out.select();
        try { document.execCommand('copy'); } catch (e) { /* no clipboard */ }
      }
      BH.showNote(BH.tr('ks.today.copied', 'copied. paste it straight into KingShot.'));
      if (weekOf(day) === 'prep' && parts.length === 1 && !BH.eggSeen(20)) {
        BH.markEgg(20);
        BH.showNote(BH.tr('ks.egg.copy', 'the bear approves of the chart. he is saving for kvk.'), out.closest('.copy-box'));
      }
    }

    btn.addEventListener('click', doCopy);
    paint();
  }

  // ── Registration ───────────────────────────────────────
  function boot(BH) {
    var prev = document.getElementById('ks-prev');
    var next = document.getElementById('ks-next');
    if (prev) prev.addEventListener('click', function () { setDay(day - 1, BH); });
    if (next) next.addEventListener('click', function () { setDay(day + 1, BH); });
    var today = document.getElementById('ks-today');
    if (today) today.addEventListener('click', function () { setDay(todayDay(), BH); });
    var quicks = document.querySelectorAll('[data-jump]');
    for (var i = 0; i < quicks.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { setDay(parseInt(b.getAttribute('data-jump'), 10), BH); });
      })(quicks[i]);
    }
    var epoch = document.getElementById('ks-epoch');
    if (epoch) {
      epoch.value = epochISO();
      epoch.addEventListener('change', function (e) {
        var v = e.target.value;
        if (!v) return;
        try { localStorage.setItem(KEY, v); } catch (err) { /* private mode */ }
        var p = v.split('-').map(Number);
        if (p.length === 3 && p[0] > 2000) EPOCH = new Date(p[0], p[1] - 1, p[2]);
        setDay(todayDay(), BH);
      });
    }
    render(BH);
  }

  BH.registerPage({
    whispers: function () {
      var tr = BH.tr;
      return [
        { id: 17, section: 'top',      line: tr('ks.egg.whisper0', 'the bear knows which day it is. he set the clock.') },
        { id: 18, section: 'matrix',   line: tr('ks.egg.whisper1', 'the bear saves everything for day 4.') },
        { id: 19, section: 'checklist', line: tr('ks.egg.whisper2', 'the bear\u2019s shield is always up.') }
      ];
    },
    boot: boot,
    onChange: function () { render(window.BH); }
  });
})();
