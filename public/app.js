const STEPS = [
  {
    key: 'participation',
    title: '오늘 점심, 참여하시나요?',
    options: [
      { value: '참여하겠다', label: '참여하겠다', emoji: '🙋', color: '#2563EB' },
      { value: '묻어가겠다', label: '묻어가겠다', emoji: '🐥', color: '#3B82F6' }
    ]
  },
  {
    key: 'distance',
    title: '거리는 어떻게 할까요?',
    options: [
      { value: '가깝게', label: '가깝게', emoji: '📍', color: '#059669' },
      { value: '상관없다', label: '상관없다', emoji: '🤷', color: '#10B981' },
      { value: '새로운장소', label: '새로운 장소', emoji: '🆕', color: '#34D399' }
    ]
  },
  {
    key: 'category',
    title: '어떤 종류가 끌리나요?',
    options: [
      { value: '한식', label: '한식', emoji: '🍚', color: '#D97706' },
      { value: '양식', label: '양식', emoji: '🍝', color: '#F59E0B' },
      { value: '중식', label: '중식', emoji: '🥟', color: '#FB923C' },
      { value: '일식', label: '일식', emoji: '🍣', color: '#F97316' },
      { value: '그외', label: '그 외', emoji: '🍽️', color: '#EA580C' }
    ]
  },
  {
    key: 'foodType',
    title: '어떤 음식이 당기나요?',
    options: [
      { value: '면류', label: '면류', emoji: '🍜', color: '#7C3AED' },
      { value: '고기', label: '고기', emoji: '🥩', color: '#8B5CF6' },
      { value: '피자', label: '피자', emoji: '🍕', color: '#A78BFA' },
      { value: '밥류', label: '밥류', emoji: '🍱', color: '#6D28D9' },
      { value: '분식', label: '분식', emoji: '🌶️', color: '#9333EA' },
      { value: '그외', label: '그 외', emoji: '🍽️', color: '#C026D3' }
    ]
  }
];

const state = {
  deviceId: getOrCreateDeviceId(),
  name: '',
  answers: {},
  stepIndex: 0,
  pollTimer: null
};

function getOrCreateDeviceId() {
  let id = localStorage.getItem('lunch-vote-device-id');
  if (!id) {
    id = 'd-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('lunch-vote-device-id', id);
  }
  return id;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ---------- name screen ----------

const nameInput = document.getElementById('name-input');
const startBtn = document.getElementById('start-btn');

nameInput.addEventListener('input', () => {
  startBtn.disabled = nameInput.value.trim().length === 0;
});

startBtn.addEventListener('click', () => {
  state.name = nameInput.value.trim();
  if (!state.name) return;
  state.stepIndex = 0;
  state.answers = {};
  showScreen('screen-deck');
  renderDeck();
});

// ---------- deck screen ----------

const deckEl = document.getElementById('deck');
const deckTitleEl = document.getElementById('deck-title');
const stepCountEl = document.getElementById('step-count');
const progressBarEl = document.getElementById('progress-bar');

function renderDeck() {
  const step = STEPS[state.stepIndex];
  deckTitleEl.textContent = step.title;
  stepCountEl.textContent = `${state.stepIndex + 1} / ${STEPS.length}`;
  progressBarEl.style.width = `${(state.stepIndex / STEPS.length) * 100}%`;

  deckEl.innerHTML = '';
  step.options.forEach((opt) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.background = opt.color;
    card.innerHTML = `
      <div class="card-check">✓</div>
      <div class="card-emoji">${opt.emoji}</div>
      <div class="card-label">${opt.label}</div>
    `;
    card.addEventListener('click', () => selectOption(step, opt, card));
    deckEl.appendChild(card);
  });

  // center the deck scroll position
  deckEl.scrollLeft = 0;
}

function selectOption(step, opt, cardEl) {
  if (cardEl.classList.contains('selected')) return;
  deckEl.querySelectorAll('.card').forEach((c) => c.classList.remove('selected'));
  cardEl.classList.add('selected');
  cardEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

  state.answers[step.key] = opt.value;

  setTimeout(() => {
    if (state.stepIndex < STEPS.length - 1) {
      state.stepIndex++;
      renderDeck();
    } else {
      progressBarEl.style.width = '100%';
      submitVote();
    }
  }, 450);
}

// ---------- submit ----------

async function submitVote() {
  showScreen('screen-loading');
  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: state.deviceId,
        name: state.name,
        ...state.answers
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '제출에 실패했습니다.');
    showScreen('screen-result');
    renderResult(data.results);
    startPolling();
  } catch (err) {
    alert(err.message);
    showScreen('screen-deck');
  }
}

// ---------- result screen ----------

const CATEGORY_COLOR = {
  participation: '#3B82F6',
  distance: '#10B981',
  category: '#F59E0B',
  foodType: '#8B5CF6'
};
const CATEGORY_LABEL = {
  participation: '참여',
  distance: '거리',
  category: '종류',
  foodType: '음식종류'
};

function renderResult(results) {
  document.getElementById('result-meta').textContent =
    `${results.date} · 오늘 응답 ${results.totalVoters}명`;

  const recWrap = document.getElementById('recommend-list');
  recWrap.innerHTML = '';
  if (results.recommendations.length === 0 || results.recommendations.every((r) => r.score === 0)) {
    recWrap.innerHTML = `<p class="desc">아직 '참여하겠다' 응답이 없어서 추천을 계산할 수 없어요.</p>`;
  } else {
    results.recommendations.slice(0, 3).forEach((r, i) => {
      const item = document.createElement('div');
      item.className = 'recommend-item';
      item.innerHTML = `
        <div class="recommend-rank">${['🥇', '🥈', '🥉'][i] || i + 1}</div>
        <div class="recommend-info">
          <div class="recommend-name">${r.name}</div>
          <div class="recommend-sub">${r.category} · ${r.foodType} · ${r.distance}m</div>
        </div>
        <div class="recommend-score">${r.score}점</div>
      `;
      recWrap.appendChild(item);
    });
  }

  const tallyWrap = document.getElementById('tally-wrap');
  tallyWrap.innerHTML = '';
  STEPS.forEach((step) => {
    const counts = results.counts[step.key];
    const max = Math.max(1, ...Object.values(counts));
    const group = document.createElement('div');
    group.className = 'tally-group';
    group.innerHTML = `<div class="tally-group-title">${CATEGORY_LABEL[step.key]}</div>`;
    step.options.forEach((opt) => {
      const count = counts[opt.value] || 0;
      const row = document.createElement('div');
      row.className = 'tally-row';
      row.innerHTML = `
        <div class="tally-row-label">${opt.emoji} ${opt.label}</div>
        <div class="tally-row-bar-wrap">
          <div class="tally-row-bar" style="width:${(count / max) * 100}%; background:${opt.color}"></div>
        </div>
        <div class="tally-row-count">${count}</div>
      `;
      group.appendChild(row);
    });
    tallyWrap.appendChild(group);
  });

  document.getElementById('voter-count').textContent = results.totalVoters;
  const voterList = document.getElementById('voter-list');
  voterList.innerHTML = '';
  results.voters.forEach((v) => {
    const chip = document.createElement('span');
    chip.className = 'voter-chip' + (v.participation === '묻어가겠다' ? ' tag-along' : '');
    chip.textContent = `${v.participation === '묻어가겠다' ? '🐥' : '🙋'} ${v.name}`;
    voterList.appendChild(chip);
  });
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    if (!document.getElementById('screen-result').classList.contains('active')) return;
    try {
      const res = await fetch('/api/results');
      const data = await res.json();
      renderResult(data);
    } catch (e) {
      // ignore transient network errors while polling
    }
  }, 5000);
}

document.getElementById('revote-btn').addEventListener('click', () => {
  state.stepIndex = 0;
  state.answers = {};
  if (state.pollTimer) clearInterval(state.pollTimer);
  showScreen('screen-deck');
  renderDeck();
});
