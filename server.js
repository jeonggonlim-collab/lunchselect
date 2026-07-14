const path = require('path');
const fs = require('fs');
const express = require('express');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;

const EXCEL_PATH = path.join(__dirname, 'restaurants.xlsx');
const VOTES_PATH = path.join(__dirname, 'data', 'votes.json');

const OPTIONS = {
  participation: ['참여하겠다', '묻어가겠다'],
  distance: ['가깝게', '상관없다', '새로운장소'],
  category: ['한식', '양식', '중식', '일식', '그외'],
  foodType: ['면류', '고기', '피자', '밥류', '분식', '그외']
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------

function getTodayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10); // YYYY-MM-DD
}

let restaurantsCache = { mtimeMs: 0, data: [] };

async function loadRestaurants() {
  if (!fs.existsSync(EXCEL_PATH)) {
    return [];
  }
  const stat = fs.statSync(EXCEL_PATH);
  if (stat.mtimeMs === restaurantsCache.mtimeMs) {
    return restaurantsCache.data;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.worksheets[0];

  const headerRow = sheet.getRow(1).values; // 1-indexed, [0] is empty
  const colIndex = {};
  headerRow.forEach((val, idx) => {
    const key = String(val || '').trim();
    if (['식당명', '이름', 'name'].includes(key)) colIndex.name = idx;
    if (['종류', 'category'].includes(key)) colIndex.category = idx;
    if (['음식종류', '음식 종류', 'foodType'].includes(key)) colIndex.foodType = idx;
    if (['거리', '거리(m)', 'distance'].includes(key)) colIndex.distance = idx;
  });

  const data = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const name = String(row.getCell(colIndex.name || 1).value || '').trim();
    if (!name) return;
    data.push({
      name,
      category: String(row.getCell(colIndex.category || 2).value || '').trim(),
      foodType: String(row.getCell(colIndex.foodType || 3).value || '').trim(),
      distance: Number(row.getCell(colIndex.distance || 4).value) || 0
    });
  });

  restaurantsCache = { mtimeMs: stat.mtimeMs, data };
  return data;
}

function loadVotes() {
  if (!fs.existsSync(VOTES_PATH)) return [];
  try {
    const raw = fs.readFileSync(VOTES_PATH, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

function saveVotes(votes) {
  fs.mkdirSync(path.dirname(VOTES_PATH), { recursive: true });
  fs.writeFileSync(VOTES_PATH, JSON.stringify(votes, null, 2), 'utf-8');
}

function distanceScore(vote, restaurant) {
  // restaurant.distance is in meters; lower = closer
  if (vote === '가깝게') {
    if (restaurant.distance <= 300) return 2;
    if (restaurant.distance <= 500) return 1;
    return 0;
  }
  // '상관없다' and '새로운장소' currently have no distance-based signal
  // ('새로운장소' would need visit-history data we don't collect yet)
  return 0;
}

async function computeResults() {
  const today = getTodayKST();
  const allVotes = loadVotes();
  const todayVotes = allVotes.filter((v) => v.date === today);
  const restaurants = await loadRestaurants();

  const counts = {
    participation: Object.fromEntries(OPTIONS.participation.map((o) => [o, 0])),
    distance: Object.fromEntries(OPTIONS.distance.map((o) => [o, 0])),
    category: Object.fromEntries(OPTIONS.category.map((o) => [o, 0])),
    foodType: Object.fromEntries(OPTIONS.foodType.map((o) => [o, 0]))
  };

  todayVotes.forEach((v) => {
    if (counts.participation[v.participation] !== undefined) counts.participation[v.participation]++;
    if (counts.distance[v.distance] !== undefined) counts.distance[v.distance]++;
    if (counts.category[v.category] !== undefined) counts.category[v.category]++;
    if (counts.foodType[v.foodType] !== undefined) counts.foodType[v.foodType]++;
  });

  // Only members who chose to actively participate shape the recommendation.
  const activeVotes = todayVotes.filter((v) => v.participation === '참여하겠다');

  const scored = restaurants.map((r) => {
    let score = 0;
    activeVotes.forEach((v) => {
      if (v.category === r.category) score += 1;
      if (v.foodType === r.foodType) score += 1;
      score += distanceScore(v.distance, r);
    });
    return { ...r, score };
  });

  scored.sort((a, b) => b.score - a.score || a.distance - b.distance);

  return {
    date: today,
    totalVoters: todayVotes.length,
    voters: todayVotes.map((v) => ({ name: v.name, participation: v.participation })),
    counts,
    recommendations: scored.slice(0, 5)
  };
}

// ---------- routes ----------

app.get('/api/config', (req, res) => {
  res.json({ options: OPTIONS });
});

app.get('/api/restaurants', async (req, res) => {
  res.json(await loadRestaurants());
});

app.post('/api/vote', async (req, res) => {
  const { deviceId, name, participation, distance, category, foodType } = req.body || {};

  if (!deviceId || !name || !name.trim()) {
    return res.status(400).json({ error: '이름을 입력해주세요.' });
  }
  if (!OPTIONS.participation.includes(participation)) {
    return res.status(400).json({ error: '참여 여부가 올바르지 않습니다.' });
  }
  if (!OPTIONS.distance.includes(distance)) {
    return res.status(400).json({ error: '거리 선택이 올바르지 않습니다.' });
  }
  if (!OPTIONS.category.includes(category)) {
    return res.status(400).json({ error: '종류 선택이 올바르지 않습니다.' });
  }
  if (!OPTIONS.foodType.includes(foodType)) {
    return res.status(400).json({ error: '음식종류 선택이 올바르지 않습니다.' });
  }

  const today = getTodayKST();
  const votes = loadVotes();
  const filtered = votes.filter((v) => !(v.deviceId === deviceId && v.date === today));
  filtered.push({
    deviceId,
    name: name.trim(),
    participation,
    distance,
    category,
    foodType,
    date: today,
    updatedAt: new Date().toISOString()
  });
  saveVotes(filtered);

  res.json({ ok: true, results: await computeResults() });
});

app.get('/api/results', async (req, res) => {
  res.json(await computeResults());
});

app.listen(PORT, () => {
  console.log(`Lunch vote server running on port ${PORT}`);
});
