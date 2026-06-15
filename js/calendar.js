// ═══════════════════════════════════════════════════════════════════════
//  calendar.js — Calendario de selección de período
// ═══════════════════════════════════════════════════════════════════════

let _calState = {
  mode: 'days',
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  selStart: null,
  selEnd: null,
  selStartMonth: null,
  selEndMonth: null,
};

const _CAL_MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function openPeriodCalendar() {
  closePeriodDropdown();
  const popup = document.getElementById('period-calendar-popup');
  if (!popup) return;

  const p = state.period;
  _calState.viewYear = new Date().getFullYear();
  _calState.viewMonth = new Date().getMonth();
  _calState.selStart = p.startDate || null;
  _calState.selEnd = p.endDate || null;
  _calState.selStartMonth = null;
  _calState.selEndMonth = null;

  if (p.type === 'custom' && p.startDate && p.endDate) {
    const s = new Date(p.startDate + 'T00:00:00');
    const e = new Date(p.endDate + 'T00:00:00');
    _calState.viewYear = s.getFullYear();
    _calState.viewMonth = s.getMonth();
    _calState.selStart = p.startDate;
    _calState.selEnd = p.endDate;
    _calState.selStartMonth = { year: s.getFullYear(), month: s.getMonth() };
    _calState.selEndMonth = { year: e.getFullYear(), month: e.getMonth() };
  }

  popup.classList.add('open');
  switchCalMode(_calState.mode);
  lucide.createIcons();
}

function closePeriodCalendar() {
  const popup = document.getElementById('period-calendar-popup');
  if (popup) popup.classList.remove('open');
}

function switchCalMode(mode) {
  _calState.mode = mode;
  document.querySelectorAll('.period-cal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.calMode === mode);
  });
  document.getElementById('period-cal-body-days').style.display = mode === 'days' ? '' : 'none';
  document.getElementById('period-cal-body-months').style.display = mode === 'months' ? '' : 'none';
  if (mode === 'days') renderCalGrid();
  else renderCalMonthsGrid();
}

function calNavMonth(delta) {
  _calState.viewMonth += delta;
  if (_calState.viewMonth > 11) { _calState.viewMonth = 0; _calState.viewYear++; }
  if (_calState.viewMonth < 0) { _calState.viewMonth = 11; _calState.viewYear--; }
  if (_calState.mode === 'days') renderCalGrid();
  else renderCalMonthsGrid();
}

function calNavYear(delta) {
  _calState.viewYear += delta;
  if (_calState.mode === 'days') renderCalGrid();
  else renderCalMonthsGrid();
}

function renderCalGrid() {
  const grid = document.getElementById('period-cal-grid');
  const label = document.getElementById('period-cal-month-label');
  if (!grid || !label) return;

  label.textContent = _CAL_MONTHS_ES[_calState.viewMonth] + ' ' + _calState.viewYear;

  const year = _calState.viewYear;
  const month = _calState.viewMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  let html = '';
  for (let i = 0; i < startDow; i++) {
    html += '<div class="cal-day cal-day-empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const isStart = dateStr === _calState.selStart;
    const isEnd = dateStr === _calState.selEnd;
    const inRange = _calState.selStart && _calState.selEnd && dateStr > _calState.selStart && dateStr < _calState.selEnd;
    const classes = ['cal-day'];
    if (isStart) classes.push('cal-day-start');
    if (isEnd) classes.push('cal-day-end');
    if (inRange) classes.push('cal-day-inrange');
    if (isStart && isEnd) classes.push('cal-day-single');
    html += '<div class="' + classes.join(' ') + '" data-date="' + dateStr + '" onclick="calSelectDay(\'' + dateStr + '\')">' + d + '</div>';
  }
  grid.innerHTML = html;

  const rangeText = document.getElementById('period-cal-range-text');
  if (rangeText) {
    if (_calState.selStart && _calState.selEnd) {
      rangeText.textContent = formatDate(_calState.selStart) + ' – ' + formatDate(_calState.selEnd);
    } else if (_calState.selStart) {
      rangeText.textContent = 'Desde ' + formatDate(_calState.selStart) + ' – seleccioná fecha de fin';
    } else {
      rangeText.textContent = 'Seleccioná un rango de fechas';
    }
  }
}

function calSelectDay(dateStr, ev) {
  (ev || event).stopPropagation();
  if (!_calState.selStart || (_calState.selStart && _calState.selEnd)) {
    _calState.selStart = dateStr;
    _calState.selEnd = null;
  } else {
    if (dateStr < _calState.selStart) {
      _calState.selEnd = _calState.selStart;
      _calState.selStart = dateStr;
    } else {
      _calState.selEnd = dateStr;
    }
  }
  renderCalGrid();
}

function renderCalMonthsGrid() {
  const grid = document.getElementById('period-cal-months-grid');
  const label = document.getElementById('period-cal-year-label');
  if (!grid || !label) return;

  label.textContent = _calState.viewYear;

  let html = '';
  for (let m = 0; m < 12; m++) {
    const isStart = _calState.selStartMonth && _calState.selStartMonth.year === _calState.viewYear && _calState.selStartMonth.month === m;
    const isEnd = _calState.selEndMonth && _calState.selEndMonth.year === _calState.viewYear && _calState.selEndMonth.month === m;
    const inRange = _calState.selStartMonth && _calState.selEndMonth &&
      (_calState.viewYear > _calState.selStartMonth.year || (_calState.viewYear === _calState.selStartMonth.year && m > _calState.selStartMonth.month)) &&
      (_calState.viewYear < _calState.selEndMonth.year || (_calState.viewYear === _calState.selEndMonth.year && m < _calState.selEndMonth.month));
    const classes = ['cal-month'];
    if (isStart) classes.push('cal-month-start');
    if (isEnd) classes.push('cal-month-end');
    if (inRange) classes.push('cal-month-inrange');
    if (isStart && isEnd) classes.push('cal-month-single');
    html += '<div class="' + classes.join(' ') + '" data-month="' + m + '" onclick="calSelectMonth(' + m + ')">' + _CAL_MONTHS_ES[m].slice(0, 3) + '</div>';
  }
  grid.innerHTML = html;

  const rangeText = document.getElementById('period-cal-month-range-text');
  if (rangeText) {
    if (_calState.selStartMonth && _calState.selEndMonth) {
      const s = _calState.selStartMonth;
      const e = _calState.selEndMonth;
      rangeText.textContent = _CAL_MONTHS_ES[s.month].slice(0, 3) + ' ' + s.year + ' – ' + _CAL_MONTHS_ES[e.month].slice(0, 3) + ' ' + e.year;
    } else if (_calState.selStartMonth) {
      const s = _calState.selStartMonth;
      rangeText.textContent = 'Desde ' + _CAL_MONTHS_ES[s.month].slice(0, 3) + ' ' + s.year + ' – seleccioná mes de fin';
    } else {
      rangeText.textContent = 'Seleccioná un rango de meses';
    }
  }
}

function calSelectMonth(month, ev) {
  (ev || event).stopPropagation();
  const sel = { year: _calState.viewYear, month };
  if (!_calState.selStartMonth || (_calState.selStartMonth && _calState.selEndMonth)) {
    _calState.selStartMonth = sel;
    _calState.selEndMonth = null;
  } else {
    const startVal = _calState.selStartMonth.year * 12 + _calState.selStartMonth.month;
    const endVal = sel.year * 12 + sel.month;
    if (endVal < startVal) {
      _calState.selEndMonth = _calState.selStartMonth;
      _calState.selStartMonth = sel;
    } else {
      _calState.selEndMonth = sel;
    }
  }
  renderCalMonthsGrid();
}

function applyPeriodCalendar() {
  if (_calState.mode === 'days') {
    if (_calState.selStart && _calState.selEnd) {
      state.period.type = 'custom';
      state.period.startDate = _calState.selStart;
      state.period.endDate = _calState.selEnd;
    } else if (_calState.selStart) {
      state.period.type = 'custom';
      state.period.startDate = _calState.selStart;
      state.period.endDate = _calState.selStart;
    }
  } else {
    if (_calState.selStartMonth && _calState.selEndMonth) {
      const s = _calState.selStartMonth;
      const e = _calState.selEndMonth;
      state.period.type = 'custom';
      state.period.startDate = new Date(s.year, s.month, 1).toISOString().split('T')[0];
      state.period.endDate = new Date(e.year, e.month + 1, 0).toISOString().split('T')[0];
    } else if (_calState.selStartMonth) {
      const s = _calState.selStartMonth;
      state.period.type = 'custom';
      state.period.startDate = new Date(s.year, s.month, 1).toISOString().split('T')[0];
      state.period.endDate = new Date(s.year, s.month + 1, 0).toISOString().split('T')[0];
    }
  }
  savePeriod();
  closePeriodCalendar();
  updatePeriodLabel();
  renderAll();
}

function clearPeriodCalendar() {
  _calState.selStart = null;
  _calState.selEnd = null;
  _calState.selStartMonth = null;
  _calState.selEndMonth = null;
  if (_calState.mode === 'days') renderCalGrid();
  else renderCalMonthsGrid();
}
