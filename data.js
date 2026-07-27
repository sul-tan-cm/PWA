// ============================================
// بيانات تجريبية وهمية بالكامل - للعرض فقط
// ============================================

const STATUS_CATEGORIES = {
  // نازل الميدان - داخل الطابور
  'موجود': { group: 'field_in', label: 'موجود (داخل الطابور)' },
  // نازل الميدان - خارج الطابور
  'مرخوص': { group: 'field_out', label: 'مرخوص (خارج الطابور)' },
  'مكلف لواء': { group: 'field_out', label: 'مكلف لواء (خارج الطابور)' },
  'مكلف كتيبة': { group: 'field_out', label: 'مكلف كتيبة (خارج الطابور)' },
  'خفارة': { group: 'field_out', label: 'خفارة (خارج الطابور)' },
  // غير نازل الميدان
  'مجمد': { group: 'not_field', label: 'مجمد' },
  'شاغر': { group: 'not_field', label: 'شاغر' },
  'إجازة ميدانية': { group: 'not_field', label: 'إجازة ميدانية' },
  'إجازة مرضية': { group: 'not_field', label: 'إجازة مرضية / مستشفى' },
  'ملحق': { group: 'not_field', label: 'ملحق' },
  'مفرز': { group: 'not_field', label: 'مفرز' },
  'سجن': { group: 'not_field', label: 'سجن' },
  'متأخر': { group: 'not_field', label: 'متأخر' },
  'دورة': { group: 'not_field', label: 'دورة' },
  'غياب': { group: 'not_field', label: 'غياب' },
  'لم يباشر': { group: 'not_field', label: 'لم يباشر' }
};

const STATUS_LIST_FIELD_IN = ['موجود'];
const STATUS_LIST_FIELD_OUT = ['مرخوص', 'مكلف لواء', 'مكلف كتيبة', 'خفارة'];
const STATUS_LIST_NOT_FIELD = ['مجمد', 'شاغر', 'إجازة ميدانية', 'إجازة مرضية', 'ملحق', 'مفرز', 'سجن', 'متأخر', 'دورة', 'غياب', 'لم يباشر'];
const STATUS_LIST_ALL = [...STATUS_LIST_FIELD_IN, ...STATUS_LIST_FIELD_OUT, ...STATUS_LIST_NOT_FIELD];

// المخالفات المؤثرة على الانضباط (من سجل الحضور + صفحة الجزاءات)
const ATTENDANCE_VIOLATIONS = ['متأخر', 'غياب'];
const PENALTY_TYPES = ['خفارة (جزاء)', 'حسم رخصة', 'حسم راتب', 'جزاء ميداني'];

const RANKS = ['رقيب أول', 'رقيب', 'عريف', 'جندي أول', 'جندي'];
const SPECIALTIES = ['مدفعية', 'اتصالات', 'قيادة مركبات', 'صيانة', 'رصد ومراقبة', 'إمداد'];

// ---------- توليد قائمة موظفين وهمية ----------
const FIRST_NAMES = ['عبدالله', 'محمد', 'فهد', 'سلطان', 'خالد', 'ناصر', 'تركي', 'بندر', 'سعود', 'ماجد', 'عمر', 'يوسف', 'راشد', 'حمد', 'فيصل', 'وليد', 'زياد', 'سامي', 'باسل', 'أنس'];
const LAST_NAMES = ['القحطاني', 'العتيبي', 'الشهري', 'الحربي', 'الغامدي', 'الزهراني', 'الدوسري', 'المطيري', 'العنزي', 'الشمري'];

function buildEmployees(count) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    list.push({
      id: 'MIL-' + String(1000 + i),
      militaryNo: String(400000 + i * 7),
      name: first + ' ' + last,
      rank: RANKS[i % RANKS.length],
      specialty: SPECIALTIES[i % SPECIALTIES.length],
      active: true
    });
  }
  return list;
}

const EMPLOYEES = buildEmployees(40);

// ---------- توليد سجل حضور وهمي لآخر 60 يوم ----------
function dateStr(d) {
  return d.toISOString().split('T')[0];
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const ATTENDANCE_LOG = {}; // { 'YYYY-MM-DD': { empId: status } }

(function generateAttendance() {
  const today = new Date();
  for (let dayOffset = 59; dayOffset >= 0; dayOffset--) {
    const d = new Date(today);
    d.setDate(d.getDate() - dayOffset);
    const key = dateStr(d);
    ATTENDANCE_LOG[key] = {};

    EMPLOYEES.forEach((emp, idx) => {
      const r = seededRandom(dayOffset * 137 + idx * 31 + 7);
      let status;
      if (r < 0.55) status = 'موجود';
      else if (r < 0.62) status = 'خفارة';
      else if (r < 0.68) status = 'مرخوص';
      else if (r < 0.72) status = 'مكلف كتيبة';
      else if (r < 0.75) status = 'مكلف لواء';
      else if (r < 0.80) status = 'دورة';
      else if (r < 0.84) status = 'إجازة ميدانية';
      else if (r < 0.87) status = 'إجازة مرضية';
      else if (r < 0.90) status = 'متأخر';
      else if (r < 0.93) status = 'غياب';
      else if (r < 0.95) status = 'مفرز';
      else if (r < 0.97) status = 'ملحق';
      else if (r < 0.985) status = 'سجن';
      else status = 'شاغر';

      ATTENDANCE_LOG[key][emp.id] = status;
    });
  }
})();

// ---------- توليد سجل جزاءات وهمي ----------
const PENALTIES_LOG = []; // { empId, date, type, hours (لجزاء ميداني), note }

(function generatePenalties() {
  const today = new Date();
  EMPLOYEES.forEach((emp, idx) => {
    const penaltyCount = Math.floor(seededRandom(idx * 53 + 11) * 4); // 0-3 جزاءات لكل موظف
    for (let p = 0; p < penaltyCount; p++) {
      const daysAgo = Math.floor(seededRandom(idx * 91 + p * 17) * 55) + 1;
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      const typeIdx = Math.floor(seededRandom(idx * 61 + p * 29) * PENALTY_TYPES.length);
      const type = PENALTY_TYPES[typeIdx];
      const entry = {
        empId: emp.id,
        date: dateStr(d),
        type: type,
        note: ''
      };
      if (type === 'جزاء ميداني') {
        entry.hours = Math.floor(seededRandom(idx * 17 + p * 3) * 12) + 2; // 2-14 ساعة
      }
      PENALTIES_LOG.push(entry);
    }
  });
})();
