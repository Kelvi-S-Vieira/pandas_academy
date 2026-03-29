(function () {
  'use strict';

  /* ── State ──────────────────────────────────────────────────── */
  const state = {
    challenges: [],
    currentChallenge: null,
    userCode: '',
    xp: 0,
    streak: 0,
    completed: new Set(),
    activeLevel: 'all',   // 'all' | 'Iniciante' | 'Intermediário' | etc.
    sidebarOpen: window.innerWidth >= 901,
  };

  /* ── Level config ────────────────────────────────────────────── */
  const LEVELS = [
    { key: 'all',          label: 'Todos',        dotClass: 'dot-all',          levelClass: '' },
    { key: 'Iniciante',    label: 'Iniciante',    dotClass: 'dot-beginner',     levelClass: 'level-beginner' },
    { key: 'Intermediário',label: 'Intermediário',dotClass: 'dot-intermediate', levelClass: 'level-intermediate' },
    { key: 'Avançado',     label: 'Avançado',     dotClass: 'dot-advanced',     levelClass: 'level-advanced' },
    { key: 'Expert',       label: 'Expert',       dotClass: 'dot-expert',       levelClass: 'level-expert' },
  ];

  /* ── DOM refs ────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const el = {
    sidebar:       $('sidebar'),
    overlay:       $('overlay'),
    mainWrapper:   $('main-wrapper'),
    menuBtn:       $('menu-btn'),
    sidebarClose:  $('sidebar-close'),
    sidebarNav:    $('sidebar-nav'),
    topbarLevel:   $('topbar-level'),
    grid:          $('challenges-grid'),
    loading:       $('loading'),
    modal:         $('modal'),
    closeModal:    $('close-modal'),
    codeEditor:    $('code-editor'),
    runBtn:        $('run-btn'),
    solutionBtn:   $('solution-btn'),
    exportBtn:     $('export-btn'),
    output:        $('output'),
    dataPreview:   $('data-preview'),
    taskDesc:      $('task-desc'),
    title:         $('challenge-title'),
    keywords:      $('keywords'),
    modalBadge:    $('modal-badge'),
    challengeLink: $('challenge-link'),
    challengeLinkA:$('challenge-link-a'),
    sbXp:          $('sb-xp'),
    sbStreak:      $('sb-streak'),
    sbDone:        $('sb-done'),
    tbXp:          $('tb-xp'),
    tbStreak:      $('tb-streak'),
  };

  /* ── LocalStorage ────────────────────────────────────────────── */
  function saveProgress() {
    localStorage.setItem('pandas_xp',        state.xp);
    localStorage.setItem('pandas_streak',    state.streak);
    localStorage.setItem('pandas_completed', JSON.stringify([...state.completed]));
  }

  function loadProgress() {
    state.xp     = parseInt(localStorage.getItem('pandas_xp')    || '0', 10);
    state.streak = parseInt(localStorage.getItem('pandas_streak') || '0', 10);
    const saved  = localStorage.getItem('pandas_completed');
    state.completed = saved ? new Set(JSON.parse(saved)) : new Set();
  }

  /* ── Level helpers ───────────────────────────────────────────── */
  function levelClass(level) {
    const map = {
      'iniciante':    'beginner',
      'intermediario':'intermediate',
      'avancado':     'advanced',
      'expert':       'expert',
    };
    const norm = level.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return map[norm] || 'beginner';
  }

  function levelConfig(level) {
    return LEVELS.find(l => l.key === level) || LEVELS[0];
  }

  /* ── Escape HTML ─────────────────────────────────────────────── */
  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Sidebar toggle ──────────────────────────────────────────── */
  function openSidebar() {
    state.sidebarOpen = true;
    el.sidebar.classList.add('open');
    el.overlay.classList.add('active');
  }

  function closeSidebar() {
    state.sidebarOpen = false;
    el.sidebar.classList.remove('open');
    el.overlay.classList.remove('active');
  }

  function toggleSidebar() {
    if (window.innerWidth >= 901) {
      // Desktop: collapse/expand pushing content
      el.sidebar.classList.toggle('collapsed');
      el.mainWrapper.classList.toggle('full');
    } else {
      // Mobile: overlay drawer
      state.sidebarOpen ? closeSidebar() : openSidebar();
    }
  }

  /* ── Build sidebar nav ───────────────────────────────────────── */
  function buildSidebarNav() {
    el.sidebarNav.innerHTML = '';

    LEVELS.forEach(lvl => {
      const challenges = lvl.key === 'all'
        ? state.challenges
        : state.challenges.filter(c => c.level === lvl.key);

      if (challenges.length === 0 && lvl.key !== 'all') return;

      const doneCount = challenges.filter(c => state.completed.has(c.id)).length;
      const pct = challenges.length ? Math.round((doneCount / challenges.length) * 100) : 0;
      const isActive = state.activeLevel === lvl.key;

      const group = document.createElement('div');
      group.className = `nav-group${isActive ? ' open' : ''}`;

      // Header row
      const header = document.createElement('div');
      header.className = `nav-group-header${isActive ? ' active' : ''}`;
      header.innerHTML = `
        <span class="nav-level-dot ${lvl.dotClass}"></span>
        <span class="nav-group-label">${lvl.label}</span>
        <span class="nav-group-count">${doneCount}/${challenges.length}</span>
        <span class="nav-group-arrow">›</span>
      `;

      // Progress bar
      const progressBar = document.createElement('div');
      progressBar.className = 'nav-progress';
      const fill = document.createElement('div');
      fill.className = 'nav-progress-fill';
      fill.style.cssText = `width:${pct}%; background:${
        lvl.key === 'all' ? 'linear-gradient(90deg,#6366f1,#ec4899)' :
        lvl.key === 'Iniciante' ? '#4ade80' :
        lvl.key === 'Intermediário' ? '#facc15' :
        lvl.key === 'Avançado' ? '#f87171' : '#818cf8'
      };`;
      progressBar.appendChild(fill);

      // Items container
      const items = document.createElement('div');
      items.className = 'nav-items';

      // "Ver todos do nível" shortcut item
      const allItem = document.createElement('div');
      allItem.className = `nav-item${state.activeLevel === lvl.key ? ' active-item' : ''}`;
      allItem.innerHTML = `<span style="font-size:11px;">≡</span> Ver todos (${challenges.length})`;
      allItem.addEventListener('click', (e) => {
        e.stopPropagation();
        selectLevel(lvl.key);
        if (window.innerWidth < 901) closeSidebar();
      });
      items.appendChild(allItem);

      // Individual challenge items
      challenges.forEach(ch => {
        const item = document.createElement('div');
        const done = state.completed.has(ch.id);
        item.className = `nav-item${done ? ' done' : ''}`;
        item.innerHTML = `
          <span class="nav-item-check">${done ? '✓' : ''}</span>
          <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">#${ch.id} ${esc(ch.title)}</span>
        `;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          selectLevel(lvl.key === 'all' ? 'all' : ch.level);
          openChallenge(ch.id);
          if (window.innerWidth < 901) closeSidebar();
        });
        items.appendChild(item);
      });

      // Toggle open/close on header click
      header.addEventListener('click', () => {
        const isOpen = group.classList.contains('open');
        // Close all others
        document.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
        if (!isOpen) group.classList.add('open');
      });

      group.appendChild(header);
      group.appendChild(progressBar);
      group.appendChild(items);
      el.sidebarNav.appendChild(group);

      // Auto-open active level
      if (isActive) group.classList.add('open');
    });
  }

  /* ── Select level (filter grid) ─────────────────────────────── */
  function selectLevel(levelKey) {
    state.activeLevel = levelKey;
    const cfg = levelConfig(levelKey);
    el.topbarLevel.textContent = cfg.key === 'all' ? 'Todos os desafios' : cfg.label;
    renderGrid();
    buildSidebarNav();
  }

  /* ── Render grid ─────────────────────────────────────────────── */
  function renderGrid() {
    const visible = state.activeLevel === 'all'
      ? state.challenges
      : state.challenges.filter(c => c.level === state.activeLevel);

    if (visible.length === 0) {
      el.grid.innerHTML = `
        <div class="empty-state">
          <h3>🐼</h3>
          <p>Nenhum desafio neste nível ainda.</p>
        </div>`;
      return;
    }

    el.grid.innerHTML = visible.map(ch => {
      const done   = state.completed.has(ch.id);
      const lvlCls = levelClass(ch.level);
      return `
        <div class="challenge-card${done ? ' done-card' : ''}" data-id="${ch.id}">
          ${done ? '<div class="done-badge">✅ Concluído</div>' : ''}
          <div class="card-title">${esc(ch.title)}</div>
          <div class="card-level level-${lvlCls}">${esc(ch.level)}</div>
          <pre class="card-preview">${esc(ch.data_csv)}</pre>
          <div class="card-task">${esc(ch.task)}</div>
          <div class="card-keywords">Keywords: ${ch.keywords.join(', ')}</div>
        </div>`;
    }).join('');

    el.grid.querySelectorAll('.challenge-card').forEach(card => {
      card.addEventListener('click', () => openChallenge(parseInt(card.dataset.id, 10)));
    });
  }

  /* ── Update stats ────────────────────────────────────────────── */
  function updateStats() {
    el.sbXp.textContent     = state.xp;
    el.sbStreak.textContent = `${state.streak}🔥`;
    el.sbDone.textContent   = state.completed.size;
    el.tbXp.textContent     = `${state.xp} XP`;
    el.tbStreak.textContent = `Streak ${state.streak}`;
  }

  /* ── Open challenge modal ────────────────────────────────────── */
  function openChallenge(id) {
    const ch = state.challenges.find(c => c.id === id);
    if (!ch) return;
    state.currentChallenge = ch;
    state.userCode = ch.starter_code;

    const lvlCls = levelClass(ch.level);
    el.modalBadge.textContent  = ch.level;
    el.modalBadge.className    = `modal-badge card-level level-${lvlCls}`;
    el.title.textContent       = ch.title;
    el.dataPreview.textContent = ch.data_csv;
    el.taskDesc.textContent    = ch.task;
    el.keywords.textContent    = `Keywords: ${ch.keywords.join(', ')}`;
    el.codeEditor.value        = ch.starter_code;
    el.output.textContent      = '';
    el.runBtn.textContent      = '🚀 Validar';
    el.runBtn.disabled         = false;

    if (ch.link) {
      el.challengeLink.style.display = 'block';
      el.challengeLinkA.href = ch.link;
    } else {
      el.challengeLink.style.display = 'none';
    }

    if (state.completed.has(ch.id)) {
      el.output.textContent = '✅ Você já completou este desafio! Revise à vontade.';
    }

    el.modal.classList.add('show');
    el.codeEditor.focus();
  }

  /* ── Close modal ─────────────────────────────────────────────── */
  function closeModal() { el.modal.classList.remove('show'); }

  /* ── Validate code ───────────────────────────────────────────── */
  function validateCode() {
    if (!state.currentChallenge) return;
    const kws  = state.currentChallenge.keywords;
    const code = state.userCode.toLowerCase();
    const ok   = kws.every(kw => code.includes(kw.toLowerCase()));

    if (ok) {
      const fresh = !state.completed.has(state.currentChallenge.id);
      if (fresh) {
        state.xp     += 100 + state.currentChallenge.id * 10;
        state.streak += 1;
        state.completed.add(state.currentChallenge.id);
        saveProgress();
        if (typeof confetti === 'function') {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }
        // Mark card in grid
        const card = el.grid.querySelector(`.challenge-card[data-id="${state.currentChallenge.id}"]`);
        if (card) card.classList.add('done-card');
        // Rebuild nav to reflect new completion
        buildSidebarNav();
      }
      el.output.textContent =
        `✅ DESAFIO CONCLUÍDO!\nXP: ${state.xp}  |  Streak: ${state.streak}\n\n` +
        `── Solução de referência ─────────────\n${state.currentChallenge.solution}`;
      el.runBtn.textContent = '🎉 Concluído!';
      el.runBtn.disabled    = true;
      updateStats();
    } else {
      const missing = kws.filter(kw => !code.includes(kw.toLowerCase()));
      el.output.textContent =
        `❌ Ainda não...\nKeywords necessárias: ${kws.join(', ')}\nFaltando: ${missing.join(', ')}`;
    }
  }

  /* ── Export .py ──────────────────────────────────────────────── */
  function exportChallenge() {
    if (!state.currentChallenge) return;
    const ch = state.currentChallenge;
    const content =
`# ${ch.title}  |  Nível: ${ch.level}
# Keywords: ${ch.keywords.join(', ')}

import pandas as pd
import io

data = """${ch.data_csv}"""
df = pd.read_csv(io.StringIO(data))

# --- Seu código ---
${state.userCode}
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `desafio_${ch.id}_${ch.title.replace(/\s+/g,'_')}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  /* ── Load solution ───────────────────────────────────────────── */
  function loadSolution() {
    if (!state.currentChallenge) return;
    state.userCode = state.currentChallenge.solution;
    el.codeEditor.value = state.userCode;
  }

  /* ── Reset ───────────────────────────────────────────────────── */
  window.resetProgress = function () {
    if (!confirm('Resetar todo o progresso? Esta ação não pode ser desfeita.')) return;
    localStorage.removeItem('pandas_xp');
    localStorage.removeItem('pandas_streak');
    localStorage.removeItem('pandas_completed');
    location.reload();
  };

  /* ── Load challenges ─────────────────────────────────────────── */
  async function loadChallenges() {
    try {
      const res  = await fetch('challenges.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json       = await res.json();
      state.challenges = json.challenges;

      el.loading.style.display = 'none';
      el.grid.style.display    = '';

      buildSidebarNav();
      renderGrid();
      updateStats();
    } catch (err) {
      console.error('Erro carregando desafios:', err);
      el.loading.innerHTML = `
        <div style="color:#f87171; text-align:center; padding:40px;">
          <div style="font-size:2rem; margin-bottom:12px;">⚠️</div>
          <strong>Erro ao carregar challenges.json</strong><br>
          <small style="opacity:.7;">Verifique se o arquivo está na mesma pasta e o servidor está rodando.</small>
        </div>`;
    }
  }

  /* ── Init ────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    updateStats();

    // Sidebar
    el.menuBtn.addEventListener('click', toggleSidebar);
    el.sidebarClose.addEventListener('click', () => {
      if (window.innerWidth >= 901) {
        el.sidebar.classList.add('collapsed');
        el.mainWrapper.classList.add('full');
      } else {
        closeSidebar();
      }
    });
    el.overlay.addEventListener('click', closeSidebar);

    // Modal
    el.closeModal.addEventListener('click', closeModal);
    el.modal.addEventListener('click', e => { if (e.target === el.modal) closeModal(); });
    el.runBtn.addEventListener('click', validateCode);
    el.solutionBtn.addEventListener('click', loadSolution);
    el.exportBtn.addEventListener('click', exportChallenge);
    el.codeEditor.addEventListener('input', e => { state.userCode = e.target.value; });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && el.modal.classList.contains('show')) closeModal();
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); validateCode(); }
      if (e.ctrlKey && e.key === 's')     { e.preventDefault(); exportChallenge(); }
    });

    loadChallenges();
  });

})();
