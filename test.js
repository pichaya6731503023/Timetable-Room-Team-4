/**
 * ====================================================================
 *  Test Script — Timetable & Room API (Team 4)
 *  Identity & Academic Core Platform
 *  Cloudflare Workers + Hono + D1 (SQLite)
 * ====================================================================
 *  วิธีรัน:
 *    node test.js                        ← ทดสอบ Production (Live)
 *    node test.js --local                ← ทดสอบ Local (wrangler dev)
 * ====================================================================
 */

const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const BASE_URL = isLocal
  ? 'http://localhost:8787'
  : 'https://timetable-room-api.6731503021.workers.dev';

// ── ANSI Color helpers ───────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  white:  '\x1b[37m',
  gray:   '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgRed:   '\x1b[41m',
};

// ── State tracking ───────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let totalTests = 0;
const results = [];

// ── Utilities ────────────────────────────────────────────────────────
function printHeader(title) {
  const line = '═'.repeat(60);
  console.log(`\n${c.cyan}${c.bold}${line}${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ${title}${c.reset}`);
  console.log(`${c.cyan}${c.bold}${line}${c.reset}\n`);
}

function printSection(num, title) {
  console.log(`\n${c.blue}${c.bold}┌─ TEST GROUP ${num}: ${title} ${'─'.repeat(Math.max(0, 45 - title.length))}┐${c.reset}`);
}

function assert(testName, condition, actual, expected, httpStatus) {
  totalTests++;
  const statusLabel = httpStatus ? ` [HTTP ${httpStatus}]` : '';
  if (condition) {
    passed++;
    const marker = `${c.bgGreen}${c.bold} PASS ${c.reset}`;
    console.log(`  ${marker} ${c.green}${testName}${statusLabel}${c.reset}`);
    results.push({ name: testName, passed: true });
  } else {
    failed++;
    const marker = `${c.bgRed}${c.bold} FAIL ${c.reset}`;
    console.log(`  ${marker} ${c.red}${testName}${statusLabel}${c.reset}`);
    if (expected !== undefined) {
      console.log(`         ${c.gray}Expected: ${JSON.stringify(expected)}${c.reset}`);
      console.log(`         ${c.gray}Actual  : ${JSON.stringify(actual)}${c.reset}`);
    }
    results.push({ name: testName, passed: false, actual, expected });
  }
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

// ════════════════════════════════════════════════════════════════════
//  MAIN TEST SUITE
// ════════════════════════════════════════════════════════════════════
async function runTests() {

  printHeader(`🎓 Timetable & Room — API Test Suite\n  Target: ${BASE_URL}`);

  // ──────────────────────────────────────────────────────────────────
  printSection('A', 'System Health & API Info');
  // ──────────────────────────────────────────────────────────────────

  // A-1: Health check
  {
    const { status, data } = await api('GET', '/health');
    assert('GET /health → status 200', status === 200, status, 200, status);
    assert('Database is connected', data.database_connected === true, data.database_connected, true);
    if (data.edge_region) {
      console.log(`         ${c.gray}Edge region: ${data.edge_region}${c.reset}`);
    }
  }

  // A-2: API info endpoint
  {
    const { status, data } = await api('GET', '/api');
    assert('GET /api → status 200', status === 200, status, 200, status);
    assert('API info returns project name', data.project?.includes('Timetable'), data.project, 'contains "Timetable"');
    assert('API info returns team info', data.team === 'Team 4', data.team, 'Team 4');
    assert('API lists all endpoint groups', !!(data.endpoints?.rooms && data.endpoints?.meetings && data.endpoints?.conflicts), null, 'rooms, meetings, conflicts present');
  }

  // ──────────────────────────────────────────────────────────────────
  printSection('B', 'Room Management (CRUD)');
  // ──────────────────────────────────────────────────────────────────

  // B-1: List all rooms
  {
    const { status, data } = await api('GET', '/api/rooms');
    assert('GET /api/rooms → 200', status === 200, status, 200, status);
    assert('Rooms list is an array', Array.isArray(data.data), typeof data.data, 'array');
    assert('Rooms count matches data length', data.count === data.data?.length, data.count, data.data?.length);
    console.log(`         ${c.gray}Total rooms in DB: ${data.count}${c.reset}`);
  }

  // B-2: Filter rooms by building
  {
    const { status, data } = await api('GET', '/api/rooms?building=Building+C1');
    assert('GET /api/rooms?building=Building C1 → 200', status === 200, status, 200, status);
    assert('All returned rooms are in Building C1',
      data.data?.every(r => r.building === 'Building C1'),
      data.data?.map(r => r.building), 'all "Building C1"');
  }

  // B-3: Filter rooms by min_capacity
  {
    const { status, data } = await api('GET', '/api/rooms?min_capacity=100');
    assert('GET /api/rooms?min_capacity=100 → 200', status === 200, status, 200, status);
    assert('All returned rooms have capacity ≥ 100',
      data.data?.every(r => r.capacity >= 100),
      data.data?.map(r => r.capacity), 'all ≥ 100');
  }

  // B-4: Get specific room
  {
    const { status, data } = await api('GET', '/api/rooms/rm_c1_101');
    assert('GET /api/rooms/rm_c1_101 → 200', status === 200, status, 200, status);
    assert('Room data has correct id', data.data?.id === 'rm_c1_101', data.data?.id, 'rm_c1_101');
  }

  // B-5: Get room schedule
  {
    const { status, data } = await api('GET', '/api/rooms/rm_c1_101/schedule');
    assert('GET /api/rooms/rm_c1_101/schedule → 200', status === 200, status, 200, status);
    assert('Schedule contains room info', !!data.room, !!data.room, true);
    assert('Schedule array is present', Array.isArray(data.schedule), typeof data.schedule, 'array');
    console.log(`         ${c.gray}Active meetings in rm_c1_101: ${data.schedule?.length}${c.reset}`);
  }

  // B-6: 404 for non-existent room
  {
    const { status, data } = await api('GET', '/api/rooms/rm_does_not_exist_xyz');
    assert('GET /api/rooms/:invalid → 404', status === 404, status, 404, status);
    assert('Error message is "Room not found"', data.error === 'Room not found', data.error, 'Room not found');
  }

  // B-7: Create room (will be cleaned up later)
  {
    const { status, data } = await api('POST', '/api/rooms', {
      id: 'rm_test_tmp_001',
      name: 'TEST-ROOM-TMP',
      building: 'Test Building',
      capacity: 40,
      room_type: 'lecture',
      status: 'available'
    });
    // accept 201 (created) or 409 (already exists from prior run - idempotent)
    assert('POST /api/rooms → 201 or 409', status === 201 || status === 409, status, '201 or 409', status);
    if (status === 201) {
      assert('Created room has correct name', data.data?.name === 'TEST-ROOM-TMP', data.data?.name, 'TEST-ROOM-TMP');
    } else {
      console.log(`         ${c.gray}Room already exists from previous test run — OK${c.reset}`);
    }
  }

  // B-8: Validate missing fields (400)
  {
    const { status, data } = await api('POST', '/api/rooms', { building: 'No Name Given' });
    assert('POST /api/rooms (missing name) → 400', status === 400, status, 400, status);
    assert('Error message mentions missing fields', data.error?.includes('Missing required fields'), data.error, 'contains "Missing required fields"');
  }

  // B-9: Update room
  {
    const { status, data } = await api('PUT', '/api/rooms/rm_test_tmp_001', {
      capacity: 50,
      status: 'maintenance'
    });
    assert('PUT /api/rooms/rm_test_tmp_001 → 200', status === 200, status, 200, status);
    assert('Capacity updated to 50', data.data?.capacity === 50, data.data?.capacity, 50);
    assert('Status updated to maintenance', data.data?.status === 'maintenance', data.data?.status, 'maintenance');
  }

  // ──────────────────────────────────────────────────────────────────
  printSection('C', 'Business Rules: Conflict Detection (BR-01 & BR-02)');
  // ──────────────────────────────────────────────────────────────────

  // C-1: Pre-check — no conflict (clean slot)
  {
    const { status, data } = await api('POST', '/api/conflicts/check', {
      room_id: 'rm_c1_101',
      section_id: 'sec_swe204_01',
      day_of_week: 'Sunday',
      start_time: '09:00',
      end_time: '11:00'
    });
    assert('POST /api/conflicts/check (clean slot) → 200', status === 200, status, 200, status);
    assert('No conflict detected for free slot', data.has_conflict === false, data.has_conflict, false);
    console.log(`         ${c.gray}${data.message}${c.reset}`);
  }

  // C-2: Pre-check — SCHEDULE_OVERLAP (BR-01)
  {
    const { status, data } = await api('POST', '/api/conflicts/check', {
      room_id: 'rm_c1_101',
      section_id: 'sec_swe204_02',
      day_of_week: 'Monday',
      start_time: '09:30',
      end_time: '10:30'
    });
    assert('POST /api/conflicts/check (overlap) → 200', status === 200, status, 200, status);
    assert('Conflict detected: SCHEDULE_OVERLAP', data.has_conflict === true && data.conflict_type === 'SCHEDULE_OVERLAP',
      { has_conflict: data.has_conflict, conflict_type: data.conflict_type },
      { has_conflict: true, conflict_type: 'SCHEDULE_OVERLAP' });
    assert('Suggested alternative slots are provided', Array.isArray(data.suggested_available_slots), typeof data.suggested_available_slots, 'array');
    console.log(`         ${c.gray}Suggested slots: ${data.suggested_available_slots?.map(s => `${s.start}-${s.end}`).join(', ') || 'none'}${c.reset}`);
  }

  // C-3: Pre-check — CAPACITY_OVERFLOW (BR-02)
  {
    // rm_s7_lab1 capacity=35, sec_swe312_01 capacity=50 → overflow
    const { status, data } = await api('POST', '/api/conflicts/check', {
      room_id: 'rm_s7_lab1',
      section_id: 'sec_swe312_01',
      day_of_week: 'Friday',
      start_time: '09:00',
      end_time: '11:00'
    });
    assert('POST /api/conflicts/check (capacity) → 200', status === 200, status, 200, status);
    assert('Conflict detected: CAPACITY_OVERFLOW', data.has_conflict === true && data.conflict_type === 'CAPACITY_OVERFLOW',
      { has_conflict: data.has_conflict, conflict_type: data.conflict_type },
      { has_conflict: true, conflict_type: 'CAPACITY_OVERFLOW' });
    assert('Alternative rooms suggested', Array.isArray(data.suggested_alternative_rooms), typeof data.suggested_alternative_rooms, 'array');
    console.log(`         ${c.gray}Alternative rooms: ${data.suggested_alternative_rooms?.map(r => `${r.name}(${r.capacity})`).join(', ') || 'none'}${c.reset}`);
  }

  // C-4: Validation — invalid time range
  {
    const { status, data } = await api('POST', '/api/conflicts/check', {
      room_id: 'rm_c1_101',
      section_id: 'sec_swe204_01',
      day_of_week: 'Monday',
      start_time: '11:00',
      end_time: '09:00'  // end before start!
    });
    assert('POST /api/conflicts/check (end < start) → 400', status === 400, status, 400, status);
  }

  // ──────────────────────────────────────────────────────────────────
  printSection('D', 'Meeting Management & Business Rule Enforcement');
  // ──────────────────────────────────────────────────────────────────

  // D-1: Attempt to create meeting with OVERLAP → 409
  {
    const { status, data } = await api('POST', '/api/meetings', {
      section_id: 'sec_swe204_02',
      room_id: 'rm_c1_101',
      day_of_week: 'Monday',
      start_time: '09:30',
      end_time: '10:30'
    });
    assert('POST /api/meetings (overlap) → 409 Conflict', status === 409, status, 409, status);
    assert('Error includes BR-01 message', data.error?.includes('BR-01'), data.error, 'contains "BR-01"');
    assert('Conflicting meeting details returned', !!data.conflicting_meeting, !!data.conflicting_meeting, true);
  }

  // D-2: Attempt to create meeting with CAPACITY OVERFLOW → 400
  {
    const { status, data } = await api('POST', '/api/meetings', {
      section_id: 'sec_swe312_01',
      room_id: 'rm_s7_lab1',
      day_of_week: 'Friday',
      start_time: '09:00',
      end_time: '11:00'
    });
    assert('POST /api/meetings (capacity overflow) → 400', status === 400, status, 400, status);
    assert('Error includes BR-02 message', data.error?.includes('BR-02'), data.error, 'contains "BR-02"');
  }

  // D-3: Create valid meeting (fresh clean slot)
  {
    const { status, data } = await api('POST', '/api/meetings', {
      id: 'mtg_test_tmp_001',
      section_id: 'sec_swe204_02',
      room_id: 'rm_test_tmp_001',  // our test room (capacity 50, status maintenance)
      day_of_week: 'Saturday',
      start_time: '09:00',
      end_time: '11:00',
      created_by: 'usr_stf_001'
    });
    // capacity 50 >= section capacity, and Saturday slot is free
    // note: room is 'maintenance' — our system still allows booking (status check is for deletion only)
    assert('POST /api/meetings (valid) → 201', status === 201 || status === 409, status, '201 or 409', status);
    if (status === 201) {
      assert('Created meeting has correct day', data.data?.day_of_week === 'Saturday', data.data?.day_of_week, 'Saturday');
      assert('Response includes room_name', !!data.data?.room_name, !!data.data?.room_name, true);
      assert('Response includes course_code', !!data.data?.course_code, !!data.data?.course_code, true);
    } else {
      console.log(`         ${c.gray}Meeting already exists from previous test run — OK${c.reset}`);
    }
  }

  // D-4: Update meeting via PATCH
  {
    const { status, data } = await api('PATCH', '/api/meetings/mtg_test_tmp_001', {
      start_time: '10:00',
      end_time: '12:00'
    });
    assert('PATCH /api/meetings/mtg_test_tmp_001 → 200', status === 200, status, 200, status);
    if (status === 200) {
      assert('start_time updated correctly', data.data?.start_time === '10:00', data.data?.start_time, '10:00');
    }
  }

  // D-5: List meetings with filter
  {
    const { status, data } = await api('GET', '/api/meetings?day_of_week=Monday');
    assert('GET /api/meetings?day_of_week=Monday → 200', status === 200, status, 200, status);
    assert('All meetings are on Monday',
      data.data?.every(m => m.day_of_week === 'Monday'),
      data.data?.map(m => m.day_of_week), 'all Monday');
    console.log(`         ${c.gray}Monday meetings: ${data.count}${c.reset}`);
  }

  // D-6: 404 for non-existent meeting
  {
    const { status, data } = await api('GET', '/api/meetings/mtg_does_not_exist_xyz');
    assert('GET /api/meetings/:invalid → 404', status === 404, status, 404, status);
  }

  // ──────────────────────────────────────────────────────────────────
  printSection('E', 'Student Timetable (FR-01, FR-03)');
  // ──────────────────────────────────────────────────────────────────

  // E-1: Get student timetable (query param)
  {
    const { status, data } = await api('GET', '/api/timetables/me?student_id=usr_std_001');
    assert('GET /api/timetables/me?student_id=usr_std_001 → 200', status === 200, status, 200, status);
    assert('Response includes student info', !!data.student, !!data.student, true);
    assert('Response includes timetable array', Array.isArray(data.timetable), typeof data.timetable, 'array');
    assert('total_classes field is present', typeof data.total_classes === 'number', typeof data.total_classes, 'number');
    assert('has_conflicts field is present', typeof data.has_conflicts === 'boolean', typeof data.has_conflicts, 'boolean');
    console.log(`         ${c.gray}Student: ${data.student?.name}, Classes: ${data.total_classes}, Has conflicts: ${data.has_conflicts}${c.reset}`);
  }

  // E-2: Timetable 404 for non-existent student
  {
    const { status } = await api('GET', '/api/timetables/me?student_id=usr_does_not_exist');
    assert('GET /api/timetables/me (invalid student) → 404', status === 404, status, 404, status);
  }

  // ──────────────────────────────────────────────────────────────────
  printSection('F', 'Enrollment & Event Hook (FR-09, FR-11)');
  // ──────────────────────────────────────────────────────────────────

  // F-1: List enrollments
  {
    const { status, data } = await api('GET', '/api/enrollments');
    assert('GET /api/enrollments → 200', status === 200, status, 200, status);
    assert('Enrollments data is array', Array.isArray(data.data), typeof data.data, 'array');
    console.log(`         ${c.gray}Total enrollments: ${data.count}${c.reset}`);
  }

  // F-2: Filter enrollments by student
  {
    const { status, data } = await api('GET', '/api/enrollments?student_id=usr_std_001');
    assert('GET /api/enrollments?student_id=usr_std_001 → 200', status === 200, status, 200, status);
    assert('All returned enrollments belong to usr_std_001',
      data.data?.every(e => e.student_id === 'usr_std_001'),
      data.data?.map(e => e.student_id), 'all usr_std_001');
  }

  // F-3: Event hook — enrollment.changed (idempotency test)
  const eventId = `evt_test_${Date.now()}`;
  const eventPayload = {
    event_id: eventId,
    event_name: 'enrollment.changed',
    student_id: 'usr_std_001',
    section_id: 'sec_swe204_01',
    action: 'enrolled',
    timestamp: new Date().toISOString()
  };

  {
    const { status: s1, data: d1 } = await api('POST', '/api/enrollments/event', eventPayload);
    assert('POST /api/enrollments/event (1st) → 200', s1 === 200, s1, 200, s1);
    assert('idempotent flag is true', d1.idempotent === true, d1.idempotent, true);
  }

  // F-4: Replay same event — idempotent
  {
    const { status: s2, data: d2 } = await api('POST', '/api/enrollments/event', eventPayload);
    assert('POST /api/enrollments/event (replay) → 200', s2 === 200, s2, 200, s2);
    assert('Replay is idempotent', d2.idempotent === true, d2.idempotent, true);
    console.log(`         ${c.gray}Enrolled count after replay: ${d2.current_status?.enrolled_count}${c.reset}`);
  }

  // F-5: Invalid event name
  {
    const { status } = await api('POST', '/api/enrollments/event', {
      event_name: 'wrong.event',
      student_id: 'usr_std_001',
      section_id: 'sec_swe204_01',
      action: 'enrolled'
    });
    assert('POST /api/enrollments/event (wrong event_name) → 400', status === 400, status, 400, status);
  }

  // ──────────────────────────────────────────────────────────────────
  printSection('G', 'AI Timetable Suggestion (Workers AI)');
  // ──────────────────────────────────────────────────────────────────

  // G-1: AI suggest endpoint
  {
    const { status, data } = await api('POST', '/api/conflicts/ai-suggest', {
      room_id: 'rm_c1_101',
      preferred_day: 'Wednesday',
      notes: 'Need a 2-hour lecture slot for a Software Engineering course'
    });
    assert('POST /api/conflicts/ai-suggest → 200', status === 200, status, 200, status);
    assert('Room info returned', !!data.room, !!data.room, true);
    assert('AI suggestion text present', typeof data.ai_suggestion === 'string' && data.ai_suggestion.length > 0,
      typeof data.ai_suggestion, 'non-empty string');
    const isAI = isLocal ? '(AI may be unavailable in local mode)' : '(Workers AI)';
    console.log(`         ${c.gray}Suggestion ${isAI}:\n         "${data.ai_suggestion?.substring(0, 120)}..."${c.reset}`);
  }

  // ──────────────────────────────────────────────────────────────────
  printSection('H', 'Cleanup — Remove Test Data');
  // ──────────────────────────────────────────────────────────────────

  // H-1: Delete test meeting
  {
    const { status } = await api('DELETE', '/api/meetings/mtg_test_tmp_001');
    assert('DELETE /api/meetings/mtg_test_tmp_001 → 200 or 404', status === 200 || status === 404, status, '200 or 404', status);
  }

  // H-2: Delete test room
  {
    const { status } = await api('DELETE', '/api/rooms/rm_test_tmp_001');
    assert('DELETE /api/rooms/rm_test_tmp_001 → 200 or 404', status === 200 || status === 404, status, '200 or 404', status);
  }

  // H-3: Confirm room is gone
  {
    const { status } = await api('GET', '/api/rooms/rm_test_tmp_001');
    assert('Confirm test room deleted (GET → 404)', status === 404, status, 404, status);
  }

  // ══════════════════════════════════════════════════════════════════
  //  SUMMARY REPORT
  // ══════════════════════════════════════════════════════════════════
  const line = '═'.repeat(60);
  console.log(`\n${c.cyan}${c.bold}${line}${c.reset}`);
  console.log(`${c.cyan}${c.bold}  📊 TEST SUMMARY${c.reset}`);
  console.log(`${c.cyan}${c.bold}${line}${c.reset}`);
  console.log(`  Total  : ${c.bold}${totalTests}${c.reset} tests`);
  console.log(`  ${c.green}${c.bold}Passed${c.reset} : ${c.green}${c.bold}${passed}${c.reset}`);
  if (failed > 0) {
    console.log(`  ${c.red}${c.bold}Failed${c.reset} : ${c.red}${c.bold}${failed}${c.reset}`);
  } else {
    console.log(`  Failed : ${failed}`);
  }

  const pct = Math.round((passed / totalTests) * 100);
  const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
  const barColor = pct === 100 ? c.green : pct >= 80 ? c.yellow : c.red;
  console.log(`\n  ${barColor}${bar}${c.reset} ${barColor}${c.bold}${pct}%${c.reset}\n`);

  if (failed > 0) {
    console.log(`${c.red}${c.bold}  ❌ Failed Tests:${c.reset}`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`     • ${c.red}${r.name}${c.reset}`);
    });
    console.log();
  } else {
    console.log(`${c.green}${c.bold}  ✅ All tests passed! System is fully operational.${c.reset}\n`);
  }

  console.log(`${c.gray}  Target : ${BASE_URL}${c.reset}`);
  console.log(`${c.gray}  Run at : ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}${c.reset}`);
  console.log(`${c.cyan}${c.bold}${line}${c.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error(`\n${c.red}${c.bold}Fatal error: ${err.message}${c.reset}`);
  if (isLocal) {
    console.error(`${c.yellow}Hint: Make sure local server is running with: npm run dev${c.reset}\n`);
  }
  process.exit(1);
});
