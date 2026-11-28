const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';
const ACTIVITY_FILE = path.join(__dirname, '.staff-activity.json');
const THEME_FILE = path.join(__dirname, '.app-theme.json');
const MAX_ACTIVITY_ENTRIES = 200;
const ALLOWED_THEMES = new Set([
  'original',
  'classic_christmas',
  'candy_cane_cafe',
  'midnight_snowfall',
]);

function sanitizeThemeId(raw) {
  const val = String(raw ?? '').trim();
  return ALLOWED_THEMES.has(val) ? val : 'original';
}

function loadActiveTheme() {
  try {
    if (!fs.existsSync(THEME_FILE)) return 'original';
    const parsed = JSON.parse(fs.readFileSync(THEME_FILE, 'utf8'));
    return sanitizeThemeId(parsed?.theme);
  } catch {
    return 'original';
  }
}

let activeTheme = loadActiveTheme();

function persistActiveTheme() {
  try {
    fs.writeFileSync(THEME_FILE, JSON.stringify({ theme: activeTheme }), 'utf8');
  } catch (err) {
    console.warn('Could not persist app theme:', err?.message || err);
  }
}

function sanitizeActivityEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const staffName = String(raw.staffName ?? '').trim().slice(0, 80) || 'Staff';
  const date = String(raw.date ?? '').trim().slice(0, 40);
  const time = String(raw.time ?? '').trim().slice(0, 40);
  const location = String(raw.location ?? '').trim().slice(0, 80) || 'Sterling';
  const parsedCount = Number(raw.totalCount);
  const totalCount = Number.isFinite(parsedCount) ? Math.max(0, Math.round(parsedCount)) : 0;
  if (!date || !time) return null;
  return { staffName, date, time, location, totalCount };
}

function loadActivityEntries() {
  try {
    if (!fs.existsSync(ACTIVITY_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeActivityEntry).filter(Boolean).slice(0, MAX_ACTIVITY_ENTRIES);
  } catch {
    return [];
  }
}

let activityEntries = loadActivityEntries();

function persistActivityEntries() {
  try {
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(activityEntries), 'utf8');
  } catch (err) {
    console.warn('Could not persist staff activity:', err?.message || err);
  }
}

app.use(express.json({ limit: '32kb' }));

app.get('/api/activity', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ entries: activityEntries.map(sanitizeActivityEntry).filter(Boolean) });
});

app.post('/api/activity', (req, res) => {
  const entry = sanitizeActivityEntry(req.body);
  if (!entry) {
    return res.status(400).json({ error: 'Invalid activity entry' });
  }
  activityEntries = [entry, ...activityEntries].slice(0, MAX_ACTIVITY_ENTRIES);
  persistActivityEntries();
  return res.status(201).json({ entry });
});

app.get('/api/theme', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  activeTheme = sanitizeThemeId(activeTheme);
  res.json({ theme: activeTheme });
});

app.post('/api/theme', (req, res) => {
  const raw = String(req.body?.theme ?? '').trim();
  if (!ALLOWED_THEMES.has(raw)) {
    return res.status(400).json({ error: 'Invalid theme' });
  }
  activeTheme = raw;
  persistActiveTheme();
  return res.json({ theme: activeTheme });
});

app.use(express.static(__dirname, { dotfiles: 'ignore' }));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
