/* kvk.js — the Event Cycle page toys (kvk-strongest-governor/): the live
   28-day clock, today's card (what's efficient, what to save), and the
   KingShot copy generator. Registers with common.js via window.BH.registerPage.
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

  // ── The light weeks — day-aware runs, orthogonal to the phase axis ──
  // Owner-confirmed schedule. Alliance Brawl fills week 1 (days 1–7, the
  // week right after KvK). Inside each light week (days 1–7 and 15–21),
  // the Armament Competition and the Officer Project each run twice:
  // Armament Type 1 from the week's Monday (days 1–2, 15–16), Type 2 from
  // its Friday (days 5–6, 19–20); Officer Type A from Wednesday (days
  // 3–4, 17–18), Type B from Sunday (days 7–8, 21–22) — Type B's second
  // day spills into Strongest Governor day 1 (day 8) and KvK prep day 1
  // (day 22). Every run's task set changes with the day it started.
  var ARMAMENT_RUNS = [
    { start: 1,  end: 2,  type: 1, label: 'Type 1' },
    { start: 5,  end: 6,  type: 2, label: 'Type 2' },
    { start: 15, end: 16, type: 1, label: 'Type 1' },
    { start: 19, end: 20, type: 2, label: 'Type 2' }
  ];
  var OFFICER_RUNS = [
    { start: 3,  end: 4,  type: 'A', label: 'Type A' },
    { start: 7,  end: 8,  type: 'B', label: 'Type B' },
    { start: 17, end: 18, type: 'A', label: 'Type A' },
    { start: 21, end: 22, type: 'B', label: 'Type B' }
  ];

  // Points per action for each run type — owner-confirmed task tables; the
  // page sections carry the same numbers. Row = [task label, points] (a
  // string points value is used verbatim, e.g. the officer troop ladder).
  var ARM_TASKS = {
    1: [
      ['Tempered Truegold (building upgrade)', 1500], ['Mythic hero shard', 125],
      ['Truegold (building upgrade)', 100], ['Epic hero shard', 50],
      ['Truegold Dust (tech research)', 50], ['Rare hero shard', 15],
      ['Governor Gear max score +1', 3], ['1m construction / research / training speedup', 1]
    ],
    2: [
      ['Mithril', 8000], ['Widget', 1600], ['Tempered Truegold (building upgrade)', 1500],
      ['Forgehammer', 800], ['Truegold (building upgrade)', 100],
      ['Truegold Dust (tech research)', 50], ['Governor Gear max score +1', 3],
      ['1m construction / research / training speedup', 1]
    ]
  };
  var OFF_TASKS = {
    A: [
      ['Widget', 12000], ['Forgehammer', 6000], ['Mithril', 60000],
      ['Governor Charm max score +1', 70], ['Troop training (T1\u2013T11)', '1\u201337']
    ],
    B: [
      ['Widget', 12000], ['Forgehammer', 6000], ['Mythic hero shard', 3040],
      ['Epic hero shard', 1220], ['Rare hero shard', 350],
      ['Governor Gear max score +1', 70]
    ]
  };
  // The hoard-precious materials each run type spends, for the run cards'
  // minimal-spend note (the next scoring week wants them saved).
  var RUN_HOARD = {
    arm1: ['hero shards', 'truegold'], arm2: ['mithril', 'widgets + hammers'],
    offA: ['mithril', 'governor charms'], offB: ['hero shards', 'governor gear']
  };
  function runKey(run) { return (run.event === 'armament' ? 'arm' : 'off') + run.run.type; }

  // Which run (if any) is live on cycle day d. Armament and Officer never
  // overlap in the confirmed schedule, so at most one is returned.
  function liveRun(d) {
    var i;
    for (i = 0; i < ARMAMENT_RUNS.length; i++) {
      if (d >= ARMAMENT_RUNS[i].start && d <= ARMAMENT_RUNS[i].end) {
        return { event: 'armament', run: ARMAMENT_RUNS[i], n: i + 1, dayNo: d - ARMAMENT_RUNS[i].start + 1 };
      }
    }
    for (i = 0; i < OFFICER_RUNS.length; i++) {
      if (d >= OFFICER_RUNS[i].start && d <= OFFICER_RUNS[i].end) {
        return { event: 'officer', run: OFFICER_RUNS[i], n: i + 1, dayNo: d - OFFICER_RUNS[i].start + 1 };
      }
    }
    return null;
  }

  // ── Short task names for the KingShot copy (keeps lines under the width cap).
  var SG_SHORT = {
    'Hero Roulette': 'Roulette', 'Widget gear': 'Widget', 'Mythic shard': 'Mythic',
    'Epic shard': 'Epic', 'Rare shard': 'Rare', 'Advanced Taming Mark': 'Adv Taming',
    'Common Taming Mark': 'Taming', 'Pet Advancement': 'Pets', 'T10 troops': 'T10',
    'Gathering': 'Gather'
  };

  // ── State — the schedule is GLOBAL: one wheel, anchored to dates ──
  // Cycle day 1 is always a Monday. The default anchor is Monday
  // 2026-08-17, so 2026-09-01 is day 16 and 2026-09-02 (a Wednesday) is
  // day 17 — the day Officer Project's Type A run is live. KvK prep opens
  // on day 22 (2026-09-07); the battle weekend is days 27–28. Every
  // kingdom turns the same wheel on the same day. If the game's server
  // date ever differs from the device's, the calibration input on the
  // page re-anchors day 1.
  var KEY = 'ks_epoch';
  var EPOCH = new Date(2026, 7, 17); // month 7 = August; day 1 is a Monday
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
      '<p class="note">' + BH.tr('ks.today.sgNote', 'roulette spins cost gems \u2014 spin only on a day that pays. hold intel from 08:00 the day before a scoring day so it banks. fixed rewards usually beat the rankings: SG prizes are cosmetics; the KvK record is the legacy.') + '</p>';
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

  function weekCard(w, BH) {
    // Fallback for a light-week day with no live run — the confirmed
    // schedule always has one, but keep the save-list card if it changes.
    var save = w === 'brawl' ? SAVE_SG : SAVE_KVK;
    var kicker = w === 'brawl' ? BH.tr('ks.today.kickerBrawl', 'week 1') + ' \u00B7 ' + BH.tr('ks.week.brawl', 'Brawl') : BH.tr('ks.today.kickerMob', 'week 3') + ' \u00B7 ' + BH.tr('ks.week.mob', 'Alliance Mobilization');
    var title = w === 'brawl' ? BH.tr('ks.week.brawl', 'Brawl week') : BH.tr('ks.week.mob', 'Alliance Mobilization week');
    var head = '<p class="today-kicker">' + kicker + '</p><p class="today-title">' + title + '</p>' + weekNotesHtml(w, BH);
    var rows = '';
    for (var i = 0; i < save.length; i++) rows += rowHTML('\u00B7', save[i], '');
    var body = zone(BH.tr('ks.today.hold', 'hold these'), rows) +
      '<p class="note">' + (w === 'brawl'
        ? BH.tr('ks.today.brawlNote', 'its own week: no fixed daily themes, Swordland\u2019s one-hour battle on Sunday (one of two in the cycle). keep the KvK-precious hoard intact; Strongest Governor is next.')
        : BH.tr('ks.today.mobNote', 'its own event, no daily themes. spend minimal KvK-precious resources \u2014 take the armament and officer fixed rewards, skip their rankings. the hoard is for prep.')) + '</p>';
    return { head: head, body: body, copy: saveCopy(w === 'brawl' ? 'sg' : 'kvk', BH), copyTitle: BH.tr('ks.today.copySave', 'copy the save list for KingShot') };
  }

  // ── The light weeks — day-aware cards ──────────────────
  // The brawl's six themed days: five 24-hour challenge days, then the
  // ~36-hour Full-Scale finale spilling from day 6 into Sunday day 7.
  var BRAWL_THEMES = ['Rise of the City', 'Hero Development', 'Pet Training', 'Gear Enhancement', 'Trade Baron', 'Full-Scale Competition'];
  function brawlThemeIdx(d) { return d > 6 ? 6 : d; }

  function weekNotesHtml(w, BH) {
    // Time-critical notes that ride on the light weeks: the Swordland
    // battle on their Sundays (days 7 and 21 under the Monday anchor), the
    // matchmaking reveal (days 20–21) and day 21's intel hold for prep.
    var h = '';
    if (w === 'mob' && day >= 20) {
      h += '<p class="today-meta">' + BH.tr('ks.today.matchmaking', 'KvK matchmaking: your opponent is revealed.') + '</p>';
    }
    if (day === 7 || day === 21) {
      h += '<p class="today-meta">' + BH.tr('ks.today.swordSunday', 'Swordland Showdown\u2019s one-hour battle runs today, the Sunday of this week.') + '</p>';
    }
    if (w === 'mob' && day === 21) {
      h += '<p class="today-meta">' + BH.tr('ks.today.holdIntel', 'from 08:00 today, stop collecting intel missions. They bank and cash in for prep points.') + '</p>';
    }
    return h;
  }

  function runZoneRows(tasks, BH) {
    var rows = '';
    for (var i = 0; i < tasks.length; i++) {
      rows += rowHTML('\u00B7', tasks[i][0], typeof tasks[i][1] === 'number' ? BH.fmt(tasks[i][1]) : tasks[i][1]);
    }
    return rows;
  }

  function runHeadHtml(run, BH) {
    var ev = run.event === 'armament' ? BH.tr('ks.today.kickerArm', 'Armament Competition') : BH.tr('ks.today.kickerOff', 'Officer Project');
    var kicker = ev + ' \u00B7 ' + BH.tr('ks.today.runOfCycle', 'run {n} of the cycle').replace('{n}', run.n) +
      ' \u00B7 ' + BH.tr('ks.today.runDayNo', 'day {n} of the run').replace('{n}', run.dayNo);
    var title = run.event === 'armament'
      ? 'Type ' + run.run.type
      : 'Type ' + run.run.type + ' \u2014 ' + (run.run.type === 'A' ? 'Infantry & Charms' : 'Governor Gear & Hero Shards');
    var meta;
    if (run.event === 'armament') {
      meta = BH.tr(run.run.type === 1 ? 'ks.today.armMeta1' : 'ks.today.armMeta2',
        'thresholds scale with your Town Center \u2014 the top tier pays ' + (run.run.type === 1 ? 'Artisan Visions' : 'Truegold') + '. read your own ladder in-game.');
    } else {
      var item = run.run.type === 'A' ? 'Forgehammer(s)' : 'Charm Design(s)';
      meta = BH.tr('ks.today.offMeta', 'four milestones + an Honor Ranking; rewards grow with server age. the top tier pays {item}, plus the Mythic Conquest and Expedition skill books.').replace('{item}', item);
    }
    return '<p class="today-kicker">' + kicker + '</p>' +
      '<p class="today-title">' + title + '</p>' +
      '<p class="today-meta">' + meta + '</p>' + weekNotesHtml(weekOf(day), BH);
  }

  function brawlContextHtml(BH) {
    var idx = brawlThemeIdx(day);
    var when = day >= 6
      ? BH.tr('ks.today.brawlFinale', 'the ~36-hour Full-Scale finale, spilling into Sunday')
      : BH.tr('ks.today.brawlDay', 'Day {n} \u00B7 {theme}').replace('{n}', idx).replace('{theme}', BRAWL_THEMES[idx - 1]);
    return '<p class="today-meta">' +
      BH.tr('ks.today.brawlLive', 'Alliance Brawl is live beside it \u2014 {when}. one spend can score both; the day tables live in the brawl section.').replace('{when}', when) +
      '</p>';
  }

  function hoardList(run) { return RUN_HOARD[runKey(run)].join(' \u00B7 '); }

  function runNoteHtml(run, w, BH) {
    if (w === 'sg' || w === 'prep') {
      // Officer Type B's spill day — the run shares the card with the phase day.
      var next = w === 'sg' ? 'Strongest Governor' : 'KvK prep';
      return '<p class="note">' + BH.tr('ks.today.spillNote',
        'Type B spills into today \u2014 ' + next + ' day 1 is live below it. take the fixed rewards with what\u2019s cheap; the ' + next + ' week is where the hoard pays.') + '</p>';
    }
    var arm = run.event === 'armament';
    var next = w === 'brawl' ? 'Strongest Governor wants next week' : 'KvK prep wants';
    var fallback = arm
      ? 'fixed rewards beat the ranking here \u2014 this run spends {hoard}, which ' + next + '. take the milestones; skip the chase.'
      : 'the ranking costs more than it pays \u2014 take the milestones with what\u2019s cheap. this run spends {hoard}; ' + (w === 'brawl' ? 'Strongest Governor opens on day 8.' : 'KvK prep opens on day 22.');
    return '<p class="note">' + BH.tr(arm ? (w === 'brawl' ? 'ks.today.armNote1' : 'ks.today.armNote3') : (w === 'brawl' ? 'ks.today.offNote1' : 'ks.today.offNote3'), fallback).replace('{hoard}', hoardList(run)) + '</p>';
  }

  function holdZoneHtml(w, BH) {
    var save = w === 'brawl' ? SAVE_SG : SAVE_KVK;
    var rows = '';
    for (var i = 0; i < save.length; i++) rows += rowHTML('\u00B7', save[i], '');
    return zone(BH.tr('ks.today.hold', 'hold these'), rows);
  }

  function runDayCard(run, w, BH) {
    var phase = null;
    if (w === 'sg' || w === 'prep') {
      phase = w === 'sg' ? sgCard(sgDayOf(day), BH) : prepCard(prepDayOf(day), BH);
    }
    var tasks = run.event === 'armament' ? ARM_TASKS[run.run.type] : OFF_TASKS[run.run.type];
    var body = zone(BH.tr('ks.today.spend', 'spend today'), runZoneRows(tasks, BH));
    if (w === 'brawl') body += brawlContextHtml(BH);
    body += runNoteHtml(run, w, BH);
    if (w === 'brawl' || w === 'mob') body += holdZoneHtml(w, BH);
    if (phase) {
      return {
        head: runHeadHtml(run, BH) + phase.head,
        body: body + phase.body,
        copy: phase.copy,
        copyTitle: phase.copyTitle
      };
    }
    return {
      head: runHeadHtml(run, BH),
      body: body,
      copy: runCopy(run, BH),
      copyTitle: BH.tr('ks.today.copyRun', 'copy the run for KingShot')
    };
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
    var run = liveRun(day);
    var info;
    if (run) info = runDayCard(run, w, BH);
    else if (w === 'prep') info = prepCard(prepDayOf(day), BH);
    else if (w === 'sg') info = sgCard(sgDayOf(day), BH);
    else if (w === 'battle') info = battleCard(BH);
    else info = weekCard(w, BH);

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

  // Short chat labels for the light-week run tasks (Armament / Officer).
  var RUN_SHORT = {
    'Truegold (building upgrade)': 'Truegold', 'Truegold Dust (tech research)': 'TG dust',
    'Tempered Truegold (building upgrade)': 'temp TG', 'Governor Gear max score +1': 'gear +1',
    'Governor Charm max score +1': 'charm +1', '1m construction / research / training speedup': '1m spd',
    'Rare hero shard': 'Rare', 'Epic hero shard': 'Epic', 'Mythic hero shard': 'Mythic',
    'Forgehammer': 'Hammer', 'Widget': 'Widget', 'Mithril': 'Mithril'
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

  // The live run, one compact block: header, its task table as short
  // lines (highest points first), then the milestone note. Same ≤6-line
  // contract as the prep and SG blocks.
  function runCopy(run, BH) {
    var r = run.run;
    var lines = [];
    var tasks;
    if (run.event === 'armament') {
      lines.push('\uD83D\uDC51ARMAMENT \u00B7 TYPE ' + r.type + '\uD83D\uDC51');
      tasks = ARM_TASKS[r.type];
    } else {
      lines.push('\uD83D\uDC51OFFICER \u00B7 TYPE ' + r.type + '\uD83D\uDC51');
      tasks = OFF_TASKS[r.type].filter(function (t) { return t[0].indexOf('Troop training') === -1; });
    }
    tasks = tasks.slice().sort(function (a, b) {
      return (typeof b[1] === 'number' ? b[1] : 0) - (typeof a[1] === 'number' ? a[1] : 0);
    });
    var cur = '';
    for (var i = 0; i < tasks.length; i++) {
      var piece = (typeof tasks[i][1] === 'number' ? BH.fmt(tasks[i][1]) : tasks[i][1]) + ' ' + (RUN_SHORT[tasks[i][0]] || tasks[i][0]);
      var add = (cur ? ' \u00B7 ' : '') + piece;
      if (cur && cur.length + add.length > 50) { lines.push(cur); cur = piece; }
      else cur += add;
    }
    lines.push(cur);
    if (run.event === 'officer' && r.type === 'A') {
      lines.push('troop train: T11 37 \u2192 T1 1');
    }
    if (run.event === 'armament') {
      lines.push(r.type === 1 ? 'top tier: Artisan Visions \u00B7 read your ladder' : 'top tier: Truegold \u00B7 read your ladder');
    } else {
      lines.push('M4: ' + (r.type === 'A' ? 'Forgehammer(s)' : 'Charm Design(s)') + ' + skill books');
    }
    lines.push('milestones > ranking \u00B7 check in-game');
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
    // The today display is live on the reader's device date: if the cycle
    // day rolls over while the page is open (or the tab sat backgrounded
    // overnight), catch up on focus/visibility instead of showing a stale
    // day. No-op whenever the selected day already matches today.
    function refreshToday() {
      var t = todayDay();
      if (t !== day) setDay(t, BH);
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refreshToday();
    });
    window.addEventListener('focus', refreshToday);
    render(BH);
  }

  BH.registerPage({
    boot: boot,
    onChange: function () { render(window.BH); }
  });
})();
