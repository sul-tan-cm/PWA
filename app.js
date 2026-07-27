// ============================================
// نظام الحضور ودرجة الانضباط - المنطق الرئيسي
// ============================================

let state = {
  currentTab: 'dashboard',
  selectedDate: dateStr(new Date()),
  employeeSearchQuery: '',
  selectedEmployeeId: null
};

const TABS = [
  { id: 'dashboard', label: '📊 المؤشرات', icon: '📊' },
  { id: 'daily', label: '📋 التسجيل اليومي', icon: '📋' },
  { id: 'penalties', label: '⚠️ الجزاءات', icon: '⚠️' },
  { id: 'discipline', label: '🎯 الانضباط', icon: '🎯' },
  { id: 'inquiry', label: '🔍 الاستعلام', icon: '🔍' },
  { id: 'employees', label: '👥 الموظفون', icon: '👥' }
];

// ==================== أدوات مساعدة للحساب ====================

function getStatusGroup(status) {
  return STATUS_CATEGORIES[status] ? STATUS_CATEGORIES[status].group : 'not_field';
}

function isFieldStatus(status) {
  const g = getStatusGroup(status);
  return g === 'field_in' || g === 'field_out';
}

function getDayCounts(dateKey) {
  const dayLog = ATTENDANCE_LOG[dateKey] || {};
  let fieldIn = 0, fieldOut = 0, notField = 0;
  const activeEmployees = EMPLOYEES.filter(e => e.active);

  activeEmployees.forEach(emp => {
    const status = dayLog[emp.id];
    const group = getStatusGroup(status);
    if (group === 'field_in') fieldIn++;
    else if (group === 'field_out') fieldOut++;
    else notField++;
  });

  const totalField = fieldIn + fieldOut;
  const total = activeEmployees.length;

  return {
    total, fieldIn, fieldOut, totalField, notField,
    actualPresent: totalField // الموجود الفعلي = نازل الميدان (داخل + خارج الطابور)
  };
}

function getDateRangeKeys(days) {
  const keys = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(dateStr(d));
  }
  return keys;
}

// حساب نسبة الانضباط لموظف عبر فترة
function getDisciplineScore(empId, days) {
  const keys = getDateRangeKeys(days);
  let cleanDays = 0;
  let violationDays = 0;

  keys.forEach(k => {
    const status = (ATTENDANCE_LOG[k] || {})[empId];
    if (ATTENDANCE_VIOLATIONS.includes(status)) {
      violationDays++;
    } else {
      cleanDays++;
    }
  });

  // خصم إضافي لأيام فيها جزاءات رسمية (خفارة جزاء/حسم رخصة/حسم راتب/جزاء ميداني) ضمن نفس الفترة
  const rangeStart = keys[0];
  const rangeEnd = keys[keys.length - 1];
  const penaltiesInRange = PENALTIES_LOG.filter(p => p.empId === empId && p.date >= rangeStart && p.date <= rangeEnd);

  // كل جزاء رسمي يحول يوم "نظيف" إلى يوم "مخالفة" (إن لم يكن كذلك أصلاً)
  const penaltyDaysSet = new Set(penaltiesInRange.map(p => p.date));
  penaltyDaysSet.forEach(pd => {
    const wasViolation = ATTENDANCE_VIOLATIONS.includes((ATTENDANCE_LOG[pd] || {})[empId]);
    if (!wasViolation) {
      cleanDays--;
      violationDays++;
    }
  });

  const totalDays = keys.length;
  const percentage = totalDays > 0 ? Math.round((cleanDays / totalDays) * 100) : 100;

  return {
    percentage: Math.max(0, Math.min(100, percentage)),
    cleanDays: Math.max(0, cleanDays),
    violationDays,
    totalDays,
    penaltiesCount: penaltiesInRange.length,
    penalties: penaltiesInRange
  };
}

function getDisciplineLevel(percentage) {
  if (percentage < 50) return { label: 'سيء', cls: 'bad' };
  if (percentage <= 70) return { label: 'جيد', cls: 'good' };
  if (percentage <= 89) return { label: 'جيد جداً', cls: 'vgood' };
  return { label: 'ممتاز', cls: 'excellent' };
}

// ==================== رسم الخلفية (المدفع PLZ-45) ====================

function renderCannonBackground() {
  const svg = `
  <svg viewBox="0 0 400 220" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- جسم المدفعية الذاتية الحركة PLZ-45 (تخطيطي مبسط) -->
    <g stroke="#c9a24b" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round">
      <!-- الهيكل السفلي / الجنزير -->
      <rect x="20" y="150" width="230" height="34" rx="6"/>
      <ellipse cx="45" cy="184" rx="16" ry="16"/>
      <ellipse cx="90" cy="184" rx="16" ry="16"/>
      <ellipse cx="135" cy="184" rx="16" ry="16"/>
      <ellipse cx="180" cy="184" rx="16" ry="16"/>
      <ellipse cx="222" cy="184" rx="16" ry="16"/>
      <line x1="20" y1="184" x2="270" y2="184"/>
      <!-- البدن العلوي -->
      <path d="M40 150 L55 108 L200 108 L220 150 Z"/>
      <!-- البرج -->
      <path d="M70 108 L85 78 L165 78 L178 108 Z"/>
      <!-- الفوهة / الماسورة -->
      <line x1="178" y1="90" x2="330" y2="66"/>
      <line x1="178" y1="98" x2="328" y2="76"/>
      <line x1="325" y1="66" x2="332" y2="76"/>
      <!-- كوة القيادة -->
      <rect x="95" y="86" width="26" height="14" rx="2"/>
      <!-- تفاصيل خطية إضافية -->
      <line x1="55" y1="130" x2="220" y2="130"/>
      <line x1="70" y1="140" x2="205" y2="140"/>
    </g>
  </svg>`;
  document.getElementById('bgCannon').innerHTML = svg;
}

// ==================== شريط التبويبات ====================

function renderTabs() {
  const bar = document.getElementById('tabsBar');
  bar.innerHTML = TABS.map(t =>
    `<div class="tab ${state.currentTab === t.id ? 'active' : ''}" onclick="switchTab('${t.id}')">${t.label}</div>`
  ).join('');
}

function renderBottomNav() {
  const nav = document.getElementById('bottomNav');
  nav.innerHTML = TABS.map(t =>
    `<div class="nav-btn ${state.currentTab === t.id ? 'active' : ''}" onclick="switchTab('${t.id}')">
      <span class="icon">${t.icon}</span>${t.label.replace(/^\S+\s/, '')}
    </div>`
  ).join('');
}

function switchTab(id) {
  state.currentTab = id;
  render();
}

// ==================== صفحة: لوحة المؤشرات ====================

function renderDashboardPage() {
  const today = state.selectedDate;
  const counts = getDayCounts(today);

  // اتجاه آخر 14 يوم
  const trendKeys = getDateRangeKeys(14);
  const trendData = trendKeys.map(k => getDayCounts(k));

  // متوسط الانضباط العام لآخر 30 يوم
  const activeEmployees = EMPLOYEES.filter(e => e.active);
  const allScores = activeEmployees.map(e => getDisciplineScore(e.id, 30).percentage);
  const avgDiscipline = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

  const excellentCount = allScores.filter(s => s >= 90).length;
  const badCount = allScores.filter(s => s < 50).length;

  return `
    <div class="card">
      <div class="card-title"><span class="bar"></span> مؤشرات اليوم (${today})</div>
      <div class="kpi-grid">
        <div class="kpi-box gold"><div class="kpi-num">${counts.total}</div><div class="kpi-label">القوة الكلية</div></div>
        <div class="kpi-box green"><div class="kpi-num">${counts.actualPresent}</div><div class="kpi-label">الموجود الفعلي</div></div>
        <div class="kpi-box red"><div class="kpi-num">${counts.notField}</div><div class="kpi-label">غير نازل الميدان</div></div>
        <div class="kpi-box blue"><div class="kpi-num">${counts.fieldIn}</div><div class="kpi-label">داخل الطابور</div></div>
        <div class="kpi-box amber"><div class="kpi-num">${counts.fieldOut}</div><div class="kpi-label">خارج الطابور</div></div>
        <div class="kpi-box gold"><div class="kpi-num">${counts.total ? Math.round((counts.actualPresent/counts.total)*100) : 0}%</div><div class="kpi-label">نسبة التواجد</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="bar"></span> مؤشرات الانضباط العام (متوسط 30 يوم)</div>
      <div class="kpi-grid">
        <div class="kpi-box gold"><div class="kpi-num">${avgDiscipline}%</div><div class="kpi-label">المتوسط العام</div></div>
        <div class="kpi-box green"><div class="kpi-num">${excellentCount}</div><div class="kpi-label">عدد الممتازين</div></div>
        <div class="kpi-box red"><div class="kpi-num">${badCount}</div><div class="kpi-label">عدد ضعاف الانضباط</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="bar"></span> اتجاه الموجود الفعلي (آخر 14 يوم)</div>
      <div class="chart-wrap"><canvas id="trendChart" height="140"></canvas></div>
    </div>

    <div class="card">
      <div class="card-title"><span class="bar"></span> توزيع حالات اليوم</div>
      <div class="chart-wrap"><canvas id="statusPie" height="180"></canvas></div>
    </div>
  `;
}

function drawTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = 140;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const keys = getDateRangeKeys(14);
  const data = keys.map(k => getDayCounts(k).actualPresent);
  const max = Math.max(...data, 1);
  const padL = 30, padB = 20, padT = 10;
  const chartW = w - padL - 10, chartH = h - padB - padT;

  // محاور
  ctx.strokeStyle = '#2a4433';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(padL, h - padB); ctx.lineTo(w - 10, h - padB);
  ctx.stroke();

  // خط البيانات
  ctx.strokeStyle = '#c9a24b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = padL + (i / (data.length - 1)) * chartW;
    const y = padT + chartH - (v / max) * chartH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // نقاط
  ctx.fillStyle = '#e0bd6a';
  data.forEach((v, i) => {
    const x = padL + (i / (data.length - 1)) * chartW;
    const y = padT + chartH - (v / max) * chartH;
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
  });

  // تسمية أقصى قيمة
  ctx.fillStyle = '#9db3a3';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(max, padL - 4, padT + 5);
  ctx.fillText('0', padL - 4, h - padB + 3);
}

function drawStatusPie() {
  const canvas = document.getElementById('statusPie');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = 180;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const dayLog = ATTENDANCE_LOG[state.selectedDate] || {};
  const counts = {};
  EMPLOYEES.filter(e => e.active).forEach(emp => {
    const s = dayLog[emp.id] || 'غير محدد';
    counts[s] = (counts[s] || 0) + 1;
  });

  const colors = ['#3a9d5c','#3a7ca5','#d99a2b','#c14545','#8b5cf6','#e0bd6a','#6b8f71','#4a9d9d','#c97b4b','#7b7bc9','#9d3a7c','#5c9d3a','#3a5c9d','#9d5c3a','#c9c93a'];
  const entries = Object.entries(counts);
  const total = entries.reduce((s, [,v]) => s + v, 0);

  const cx = 70, cy = 90, r = 65;
  let startAngle = -Math.PI / 2;
  entries.forEach(([status, val], i) => {
    const angle = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    startAngle += angle;
  });

  // مفتاح
  let ly = 10;
  const lx = 155;
  ctx.font = '10.5px sans-serif';
  ctx.textAlign = 'right';
  entries.forEach(([status, val], i) => {
    if (lx > w - 10) return;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(w - 14, ly, 10, 10);
    ctx.fillStyle = '#eef2ec';
    ctx.fillText(`${status} (${val})`, w - 20, ly + 9);
    ly += 16;
  });
}

// ==================== صفحة: التسجيل اليومي ====================

function renderDailyPage() {
  const dayLog = ATTENDANCE_LOG[state.selectedDate] || {};
  const activeEmployees = EMPLOYEES.filter(e => e.active);

  const rows = activeEmployees.map(emp => {
    const status = dayLog[emp.id] || 'موجود';
    const group = getStatusGroup(status);
    const pillClass = group === 'field_in' ? 'field-in' : (group === 'field_out' ? 'field-out' : 'notfield');
    return `
      <tr>
        <td>${emp.militaryNo}</td>
        <td style="text-align:right">${emp.name}</td>
        <td>${emp.rank}</td>
        <td>
          <select onchange="updateStatus('${emp.id}', this.value)" style="margin:0;padding:6px;font-size:12px;">
            <optgroup label="نازل الميدان - داخل الطابور">
              ${STATUS_LIST_FIELD_IN.map(s => `<option value="${s}" ${s===status?'selected':''}>${s}</option>`).join('')}
            </optgroup>
            <optgroup label="نازل الميدان - خارج الطابور">
              ${STATUS_LIST_FIELD_OUT.map(s => `<option value="${s}" ${s===status?'selected':''}>${s}</option>`).join('')}
            </optgroup>
            <optgroup label="غير نازل الميدان">
              ${STATUS_LIST_NOT_FIELD.map(s => `<option value="${s}" ${s===status?'selected':''}>${s}</option>`).join('')}
            </optgroup>
          </select>
        </td>
        <td><span class="status-pill ${pillClass}">${group === 'field_in' ? 'داخل الطابور' : (group === 'field_out' ? 'خارج الطابور' : 'غير نازل')}</span></td>
      </tr>
    `;
  }).join('');

  const counts = getDayCounts(state.selectedDate);

  return `
    <div class="card">
      <div class="card-title"><span class="bar"></span> اختيار التاريخ</div>
      <input type="date" value="${state.selectedDate}" onchange="changeDate(this.value)">
    </div>

    <div class="card">
      <div class="kpi-grid">
        <div class="kpi-box green"><div class="kpi-num">${counts.actualPresent}</div><div class="kpi-label">الموجود الفعلي</div></div>
        <div class="kpi-box blue"><div class="kpi-num">${counts.fieldIn}</div><div class="kpi-label">داخل الطابور</div></div>
        <div class="kpi-box amber"><div class="kpi-num">${counts.fieldOut}</div><div class="kpi-label">خارج الطابور</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="bar"></span> سجل حضور اليوم (${activeEmployees.length} فرد)</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>الرقم العسكري</th><th>الاسم</th><th>الرتبة</th><th>الحالة</th><th>التصنيف</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function changeDate(val) {
  state.selectedDate = val;
  render();
}

function updateStatus(empId, newStatus) {
  if (!ATTENDANCE_LOG[state.selectedDate]) ATTENDANCE_LOG[state.selectedDate] = {};
  ATTENDANCE_LOG[state.selectedDate][empId] = newStatus;
  render();
}

// ==================== صفحة: الانضباط ====================

function renderDisciplinePage() {
  const activeEmployees = EMPLOYEES.filter(e => e.active);
  const scored = activeEmployees.map(emp => {
    const score = getDisciplineScore(emp.id, 30);
    return { emp, score, level: getDisciplineLevel(score.percentage) };
  }).sort((a, b) => a.score.percentage - b.score.percentage);

  const rows = scored.map(({ emp, score, level }) => `
    <tr>
      <td>${emp.militaryNo}</td>
      <td style="text-align:right">${emp.name}</td>
      <td>${emp.rank}</td>
      <td><b>${score.percentage}%</b></td>
      <td>${score.violationDays}</td>
      <td>${score.penaltiesCount}</td>
      <td><span class="badge ${level.cls}">${level.label}</span></td>
    </tr>
  `).join('');

  const avg = Math.round(scored.reduce((s, x) => s + x.score.percentage, 0) / scored.length);
  const dist = { excellent: 0, vgood: 0, good: 0, bad: 0 };
  scored.forEach(x => dist[x.level.cls]++);

  return `
    <div class="card">
      <div class="card-title"><span class="bar"></span> نظرة عامة على الانضباط (آخر 30 يوم)</div>
      <div class="kpi-grid">
        <div class="kpi-box gold"><div class="kpi-num">${avg}%</div><div class="kpi-label">المتوسط العام</div></div>
        <div class="kpi-box green"><div class="kpi-num">${dist.excellent}</div><div class="kpi-label">ممتاز (90-100%)</div></div>
        <div class="kpi-box blue"><div class="kpi-num">${dist.vgood}</div><div class="kpi-label">جيد جداً (71-89%)</div></div>
        <div class="kpi-box amber"><div class="kpi-num">${dist.good}</div><div class="kpi-label">جيد (60-70%)</div></div>
        <div class="kpi-box red"><div class="kpi-num">${dist.bad}</div><div class="kpi-label">سيء (أقل من 50%)</div></div>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:10px;line-height:1.6;">
        النسبة = (أيام بدون مخالفات ÷ إجمالي أيام الفترة) × 100. المخالفات تشمل التأخير والغياب من سجل الحضور اليومي، إضافة إلى الجزاءات الرسمية (خفارة جزاء، حسم رخصة، حسم راتب، جزاء ميداني).
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="bar"></span> ترتيب الأفراد حسب نسبة الانضباط (الأضعف أولاً)</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>الرقم العسكري</th><th>الاسم</th><th>الرتبة</th><th>النسبة</th><th>أيام مخالفة</th><th>عدد الجزاءات</th><th>التصنيف</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ==================== صفحة: الاستعلام ====================

function renderInquiryPage() {
  const query = state.employeeSearchQuery.trim();

  return `
    <div class="card">
      <div class="card-title"><span class="bar"></span> الاستعلام عن أداء وانضباط موظف</div>
      <label>ابحث بالاسم أو الرقم العسكري</label>
      <input type="text" id="searchInput" placeholder="مثال: عبدالله أو 400021" value="${query}" oninput="searchEmployee(this.value)" autocomplete="off">
    </div>
    <div id="inquiryResults"></div>
  `;
}

function renderInquiryResults() {
  const resultsEl = document.getElementById('inquiryResults');
  if (!resultsEl) return;

  const query = state.employeeSearchQuery.trim();
  let matched = [];
  if (query.length > 0) {
    matched = EMPLOYEES.filter(e =>
      e.name.includes(query) || e.militaryNo.includes(query)
    );
  }

  let html = '';
  if (state.selectedEmployeeId) {
    const emp = EMPLOYEES.find(e => e.id === state.selectedEmployeeId);
    if (emp) html = renderEmployeeDetail(emp);
  } else if (matched.length === 1) {
    html = renderEmployeeDetail(matched[0]);
  } else if (matched.length > 1) {
    html = `
      <div class="card">
        <div class="card-title"><span class="bar"></span> نتائج مطابقة (${matched.length})</div>
        ${matched.map(e => `
          <div class="info-row" style="cursor:pointer" onclick="selectEmployee('${e.id}')">
            <span class="lbl">${e.name} — ${e.militaryNo}</span>
            <span class="val">عرض ←</span>
          </div>
        `).join('')}
      </div>
    `;
  } else if (query.length > 0) {
    html = `<div class="empty-state">لا توجد نتائج مطابقة لـ "${query}"</div>`;
  }

  resultsEl.innerHTML = html;
}

function searchEmployee(val) {
  state.employeeSearchQuery = val;
  state.selectedEmployeeId = null;
  renderInquiryResults();
}

function selectEmployee(empId) {
  state.selectedEmployeeId = empId;
  renderInquiryResults();
}

function renderEmployeeDetail(emp) {
  const score30 = getDisciplineScore(emp.id, 30);
  const score90 = getDisciplineScore(emp.id, 90);
  const level = getDisciplineLevel(score30.percentage);
  const todayStatus = (ATTENDANCE_LOG[state.selectedDate] || {})[emp.id] || '—';
  const group = getStatusGroup(todayStatus);

  const recentPenalties = score30.penalties.sort((a,b) => b.date.localeCompare(a.date));
  const penaltyRows = recentPenalties.length > 0 ? recentPenalties.map(p => `
    <tr>
      <td>${p.date}</td>
      <td>${p.type}</td>
      <td>${p.hours ? p.hours + ' ساعة' : '—'}</td>
    </tr>
  `).join('') : `<tr><td colspan="3" class="empty-state">لا توجد جزاءات خلال آخر 30 يوم</td></tr>`;

  // آخر 14 يوم حضور
  const last14 = getDateRangeKeys(14).map(k => {
    const s = (ATTENDANCE_LOG[k] || {})[emp.id];
    return { date: k, status: s };
  }).reverse();

  return `
    <div class="card">
      <div class="card-title"><span class="bar"></span> بطاقة الفرد</div>
      <div class="info-row"><span class="lbl">الاسم</span><span class="val">${emp.name}</span></div>
      <div class="info-row"><span class="lbl">الرقم العسكري</span><span class="val">${emp.militaryNo}</span></div>
      <div class="info-row"><span class="lbl">الرتبة</span><span class="val">${emp.rank}</span></div>
      <div class="info-row"><span class="lbl">التخصص</span><span class="val">${emp.specialty}</span></div>
      <div class="info-row"><span class="lbl">حالة اليوم</span><span class="val">${todayStatus} (${group === 'field_in' ? 'داخل الطابور' : group === 'field_out' ? 'خارج الطابور' : 'غير نازل'})</span></div>
    </div>

    <div class="card">
      <div class="card-title"><span class="bar"></span> درجة الانضباط</div>
      <div class="two-col">
        <div class="kpi-box gold"><div class="kpi-num">${score30.percentage}%</div><div class="kpi-label">آخر 30 يوم</div></div>
        <div class="kpi-box blue"><div class="kpi-num">${score90.percentage}%</div><div class="kpi-label">آخر 90 يوم</div></div>
      </div>
      <div style="text-align:center;margin-top:12px;">
        <span class="badge ${level.cls}" style="font-size:14px;padding:8px 20px;">${level.label}</span>
      </div>
      <div class="info-row" style="margin-top:10px;"><span class="lbl">أيام بدون مخالفات (30 يوم)</span><span class="val">${score30.cleanDays} / ${score30.totalDays}</span></div>
      <div class="info-row"><span class="lbl">عدد الجزاءات (30 يوم)</span><span class="val">${score30.penaltiesCount}</span></div>
    </div>

    <div class="card">
      <div class="card-title"><span class="bar"></span> سجل الجزاءات (آخر 30 يوم)</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>التاريخ</th><th>نوع الجزاء</th><th>المدة</th></tr></thead>
          <tbody>${penaltyRows}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="bar"></span> سجل الحضور (آخر 14 يوم)</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>التاريخ</th><th>الحالة</th></tr></thead>
          <tbody>
            ${last14.map(d => `<tr><td>${d.date}</td><td>${d.status || '—'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ==================== صفحة: الجزاءات ====================

function renderPenaltiesPage() {
  const activeEmployees = EMPLOYEES.filter(e => e.active);
  return `
    <div class="card">
      <div class="card-title"><span class="bar"></span> تسجيل جزاء جديد</div>
      <label>الفرد</label>
      <select id="penEmp">
        ${activeEmployees.map(e => `<option value="${e.id}">${e.name} — ${e.militaryNo}</option>`).join('')}
      </select>
      <label>التاريخ</label>
      <input type="date" id="penDate" value="${dateStr(new Date())}">
      <label>نوع الجزاء</label>
      <select id="penType" onchange="toggleHoursField(this.value)">
        ${PENALTY_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>
      <div id="hoursFieldWrap">
        <label>عدد الساعات (لجزاء ميداني)</label>
        <input type="number" id="penHours" placeholder="مثال: 6" min="1">
      </div>
      <label>ملاحظة (اختياري)</label>
      <input type="text" id="penNote" placeholder="تفاصيل إضافية">
      <button class="gold" onclick="addPenalty()">➕ تسجيل الجزاء</button>
    </div>
    <div id="penaltiesListWrap"></div>
  `;
}

function toggleHoursField(type) {
  const wrap = document.getElementById('hoursFieldWrap');
  if (wrap) wrap.style.display = (type === 'جزاء ميداني') ? 'block' : 'none';
}

function renderPenaltiesList() {
  const wrap = document.getElementById('penaltiesListWrap');
  if (!wrap) return;

  toggleHoursField(document.getElementById('penType') ? document.getElementById('penType').value : PENALTY_TYPES[0]);

  const sorted = [...PENALTIES_LOG].sort((a, b) => b.date.localeCompare(a.date));
  const rows = sorted.map((p, idx) => {
    const emp = EMPLOYEES.find(e => e.id === p.empId);
    const realIdx = PENALTIES_LOG.indexOf(p);
    return `
      <tr>
        <td>${p.date}</td>
        <td style="text-align:right">${emp ? emp.name : '—'}</td>
        <td>${p.type}</td>
        <td>${p.hours ? p.hours + ' س' : '—'}</td>
        <td><button class="small danger" onclick="removePenalty(${realIdx})">حذف</button></td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="card">
      <div class="card-title"><span class="bar"></span> سجل الجزاءات (${sorted.length})</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>التاريخ</th><th>الفرد</th><th>النوع</th><th>المدة</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty-state">لا توجد جزاءات مسجلة</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

function addPenalty() {
  const empId = document.getElementById('penEmp').value;
  const date = document.getElementById('penDate').value;
  const type = document.getElementById('penType').value;
  const hours = document.getElementById('penHours').value;
  const note = document.getElementById('penNote').value.trim();

  if (!empId || !date) {
    alert('الرجاء اختيار الفرد والتاريخ');
    return;
  }

  const entry = { empId, date, type, note };
  if (type === 'جزاء ميداني') {
    entry.hours = parseInt(hours) || 1;
  }
  PENALTIES_LOG.push(entry);

  document.getElementById('penNote').value = '';
  document.getElementById('penHours').value = '';
  renderPenaltiesList();
}

function removePenalty(index) {
  if (!confirm('هل تريد حذف هذا الجزاء؟')) return;
  PENALTIES_LOG.splice(index, 1);
  renderPenaltiesList();
}

// ==================== صفحة: الموظفون ====================

function renderEmployeesPage() {
  return `
    <div class="card">
      <div class="card-title"><span class="bar"></span> إضافة فرد جديد</div>
      <label>الرقم العسكري</label>
      <input type="text" id="newMilitaryNo" placeholder="مثال: 400123">
      <label>الاسم الكامل</label>
      <input type="text" id="newName" placeholder="مثال: عبدالله القحطاني">
      <label>الرتبة</label>
      <select id="newRank">
        ${RANKS.map(r => `<option value="${r}">${r}</option>`).join('')}
      </select>
      <label>التخصص</label>
      <select id="newSpecialty">
        ${SPECIALTIES.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <button class="gold" onclick="addEmployee()">➕ إضافة الفرد</button>
    </div>
    <div id="employeesListWrap"></div>
    <div class="watermark-note">🔧 هذه بيانات وهمية بالكامل لأغراض العرض والاختبار فقط</div>
  `;
}

function renderEmployeesList() {
  const wrap = document.getElementById('employeesListWrap');
  if (!wrap) return;
  const activeEmployees = EMPLOYEES.filter(e => e.active);
  const rows = activeEmployees.map(emp => `
    <tr>
      <td>${emp.militaryNo}</td>
      <td style="text-align:right">${emp.name}</td>
      <td>${emp.rank}</td>
      <td>${emp.specialty}</td>
      <td><button class="small danger" onclick="removeEmployee('${emp.id}')">حذف</button></td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <div class="card">
      <div class="card-title"><span class="bar"></span> قائمة الأفراد (${activeEmployees.length})</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>الرقم العسكري</th><th>الاسم</th><th>الرتبة</th><th>التخصص</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function addEmployee() {
  const militaryNo = document.getElementById('newMilitaryNo').value.trim();
  const name = document.getElementById('newName').value.trim();
  const rank = document.getElementById('newRank').value;
  const specialty = document.getElementById('newSpecialty').value;

  if (!militaryNo || !name) {
    alert('الرجاء إدخال الرقم العسكري والاسم');
    return;
  }
  if (EMPLOYEES.some(e => e.militaryNo === militaryNo)) {
    alert('الرقم العسكري مسجل مسبقاً');
    return;
  }

  const newId = 'MIL-' + Date.now();
  EMPLOYEES.push({ id: newId, militaryNo, name, rank, specialty, active: true });

  document.getElementById('newMilitaryNo').value = '';
  document.getElementById('newName').value = '';
  renderEmployeesList();
}

function removeEmployee(empId) {
  if (!confirm('هل تريد حذف هذا الفرد؟ (سيبقى سجله التاريخي محفوظاً لكن سيُستبعد من القوائم الحالية)')) return;
  const emp = EMPLOYEES.find(e => e.id === empId);
  if (emp) emp.active = false;
  renderEmployeesList();
}

// ==================== التصيير الرئيسي ====================

function render(skipFocusFix) {
  renderTabs();
  renderBottomNav();

  const pagesEl = document.getElementById('pages');
  let html = '';
  if (state.currentTab === 'dashboard') html = renderDashboardPage();
  else if (state.currentTab === 'daily') html = renderDailyPage();
  else if (state.currentTab === 'penalties') html = renderPenaltiesPage();
  else if (state.currentTab === 'discipline') html = renderDisciplinePage();
  else if (state.currentTab === 'inquiry') html = renderInquiryPage();
  else if (state.currentTab === 'employees') html = renderEmployeesPage();

  pagesEl.innerHTML = `<div class="page active">${html}</div>`;

  if (state.currentTab === 'dashboard') {
    setTimeout(() => { drawTrendChart(); drawStatusPie(); }, 10);
  }

  if (state.currentTab === 'inquiry') {
    renderInquiryResults();
  }

  if (state.currentTab === 'employees') {
    renderEmployeesList();
  }

  if (state.currentTab === 'penalties') {
    renderPenaltiesList();
  }

  document.getElementById('todayBadge').textContent = '📅 ' + dateStr(new Date());
}

// ==================== التهيئة ====================

renderCannonBackground();
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
