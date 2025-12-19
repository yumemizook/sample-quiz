// Minimal Express server providing lunar conversion endpoint
// Usage: npm run serve

const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static site files
app.use(express.static(path.join(__dirname)));

// Simple request logger to aid debugging
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

// Try to load @dqcai/vn-lunar if installed
let vnLunar = null;
try {
  vnLunar = require('@dqcai/vn-lunar');
  console.log('Using @dqcai/vn-lunar for lunar conversion');
} catch (err) {
  console.warn('Optional dependency @dqcai/vn-lunar not available, falling back to mapping');
}

// Simple mapping fallback (same years as client mapping)
const tetDates = {
  2000: '2000-02-05', 2001: '2001-01-24', 2002: '2002-02-12', 2003: '2003-02-01',
  2004: '2004-01-22', 2005: '2005-02-09', 2006: '2006-01-29', 2007: '2007-02-18',
  2008: '2008-02-07', 2009: '2009-01-26', 2010: '2010-02-14', 2011: '2011-02-03',
  2012: '2012-01-23', 2013: '2013-02-10', 2014: '2014-01-31', 2015: '2015-02-19',
  2016: '2016-02-08', 2017: '2017-01-28', 2018: '2018-02-16', 2019: '2019-02-05',
  2020: '2020-01-25', 2021: '2021-02-12', 2022: '2022-02-01', 2023: '2023-01-22',
  2024: '2024-02-10', 2025: '2025-01-29', 2026: '2026-02-17', 2027: '2027-02-06',
  2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03', 2031: '2031-01-23',
  2032: '2032-02-11', 2033: '2033-01-31', 2034: '2034-02-19', 2035: '2035-02-08',
  2036: '2036-01-28', 2037: '2037-02-15', 2038: '2038-02-04', 2039: '2039-01-24',
  2040: '2040-02-12'
};

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getTetStart(year) {
  if (tetDates[year]) return parseISO(tetDates[year]);
  return null;
}

function getTetInfo(date = new Date()) {
  const y = date.getFullYear();
  const candidates = [y, y - 1];
  for (const cy of candidates) {
    const start = getTetStart(cy);
    if (!start) continue;
    const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const diffDays = Math.floor((date - startMidnight) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 15) {
      return { isTet: true, tetYear: cy, dayOfTet: diffDays + 1, tetStart: startMidnight };
    }
  }
  return { isTet: false };
}

app.get('/lunar', async (req, res) => {
  // Accept a date query param YYYY-MM-DD or use today
  const q = req.query.date;
  const date = q ? new Date(q) : new Date();

  // If vnLunar is available, use it for lunar conversion
  if (vnLunar && typeof vnLunar.solar2lunar === 'function') {
    try {
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const d = date.getDate();
      // @dqcai/vn-lunar's solar2lunar returns {lDay,lMonth,lYear,isLeap}
      const lunar = vnLunar.solar2lunar(y, m, d);
      const tet = getTetInfo(date);
      return res.json({ ok: true, source: 'vn-lunar', lunar, tet });
    } catch (e) {
      console.error('vn-lunar failed:', e);
      // fallback to mapping
    }
  }

  // Fallback: use mapping to answer whether date is within Tet
  const tetInfo = getTetInfo(date);
  return res.json({ ok: true, source: 'mapping', tet: tetInfo });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
