// Simple Tet (Lunar New Year) tracker
// Uses a mapping of Lunar New Year (Tet) Gregorian dates for years 2000-2040
// and exposes functions to check whether a given date is within Tet period
// (first 15 lunar days). This avoids needing a full lunar conversion library.

const tetDates = {
  // year: 'YYYY-MM-DD' (Gregorian date of Lunar New Year)
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

function parseDateISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getTetStartForYear(year) {
  if (tetDates[year]) return parseDateISO(tetDates[year]);
  return null;
}

// Check if a given date (Date object) is within Tet period (day 1..15)
function getTetInfo(date = new Date()) {
  const y = date.getFullYear();

  // Tet may fall in Jan/Feb; need to check two candidate years: current and previous
  const candidates = [y, y - 1];
  for (const cy of candidates) {
    const start = getTetStartForYear(cy);
    if (!start) continue;
    const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const diffDays = Math.floor((date - startMidnight) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 15) {
      return {
        isTet: true,
        tetYear: cy,
        dayOfTet: diffDays + 1,
        tetStart: startMidnight
      };
    }
  }

  return { isTet: false };
}

// Apply Tet UI effects: add class to body and show message in provided container
function applyTetEffects(opts = {}) {
  const date = opts.date ? new Date(opts.date) : new Date();
  const info = getTetInfo(date);
  const body = document.body;
  if (info.isTet) {
    body.classList.add('tet-mode');
    // Small tip text
    const tipsEl = document.getElementById(opts.tipsContainerId || 'tipsText');
    if (tipsEl) {
      const tips = [
        'Chúc Mừng Năm Mới! (Happy Lunar New Year!)',
        'Today is day ' + info.dayOfTet + ' of Tet — enjoy festive bonuses!',
        'Tip: Take a break between quizzes to enjoy the celebrations.',
        'đừng all in tài nữa khéo xỉu là đéo ai cứu đâu',
        "don't let your mother take all the lucky money.",
        'Get outside, go visit your relatives, have fun with them. Tet only comes once a year you know...',
      ];
      tipsEl.textContent = tips.join(' ');
    }
    // Add subtle red lanterns and confetti decorations
    createTetDecorations(opts);
    // Optionally show a banner element
    if (opts.bannerId) {
      const banner = document.getElementById(opts.bannerId);
      if (banner) banner.style.display = 'block';
    }
    return info;
  } else {
    body.classList.remove('tet-mode');
    return info;
  }
}

// Create simple Tet decorations (lanterns + confetti)
function createTetDecorations(opts = {}) {
  // Avoid duplicate decorations
  if (document.querySelector('.tet-decorations')) return;

  const container = document.createElement('div');
  container.className = 'tet-decorations';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';

  // lanterns
  const lanterns = document.createElement('div');
  lanterns.className = 'tet-lanterns';
  for (let i = 0; i < 6; i++) {
    const l = document.createElement('div');
    l.className = 'tet-lantern';
    l.style.left = (10 + i * 14) + '%';
    l.style.animationDelay = (i * 0.3) + 's';
    lanterns.appendChild(l);
  }
  container.appendChild(lanterns);

  // confetti
  const confetti = document.createElement('div');
  confetti.className = 'tet-confetti';
  for (let i = 0; i < 18; i++) {
    const c = document.createElement('div');
    c.className = 'tet-confetti-piece';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = ['#ff3b30', '#ff9500', '#ffd60a', '#ff2d55'][Math.floor(Math.random() * 4)];
    c.style.animationDelay = (Math.random() * 3) + 's';
    confetti.appendChild(c);
  }
  container.appendChild(confetti);

  document.body.appendChild(container);

  // Remove decorations after 20s
  setTimeout(() => {
    container.style.transition = 'opacity 1s';
    container.style.opacity = '0';
    setTimeout(() => container.remove(), 1200);
  }, 20000);
}

// Server-side lunar conversion is preferred. Client should call /lunar endpoint.
// Provide a thin client-side helper that only returns mapping-based Tet info.
async function getLunarInfo(date = new Date()) {
  // This function intentionally avoids importing any client CDN lunar libraries.
  // It returns mapping-based tet info so callers can still make decisions when
  // the server is not reachable.
  try {
    const tet = getTetInfo(date);
    return { tet };
  } catch (e) {
    return null;
  }
}

// Expose functions
window.lunarTracker = {
  getTetInfo,
  applyTetEffects,
  getLunarInfo,
  _tetDates: tetDates
};

export { getTetInfo, applyTetEffects, getLunarInfo };
