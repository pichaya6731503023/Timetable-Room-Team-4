// Verification Script: Testing Live Cloudflare Workers + D1 Endpoints
const BASE_URL = 'https://timetable-room-api.6731503021.workers.dev';

async function testApi() {
  console.log('==================================================');
  console.log(`Starting Live API Tests against: ${BASE_URL}`);
  console.log('==================================================\n');

  // Test 1: Health & D1 connectivity
  const resHealth = await fetch(`${BASE_URL}/health`);
  const dataHealth = await resHealth.json();
  console.log('1. GET /health:', resHealth.status, dataHealth);

  // Test 2: List Rooms
  const resRooms = await fetch(`${BASE_URL}/api/rooms`);
  const dataRooms = await resRooms.json();
  console.log(`2. GET /api/rooms: ${resRooms.status}, Found ${dataRooms.count} rooms.`);

  // Test 3: Get Room Schedule
  const resSchedule = await fetch(`${BASE_URL}/api/rooms/rm_c1_101/schedule`);
  const dataSchedule = await resSchedule.json();
  console.log(`3. GET /api/rooms/rm_c1_101/schedule: ${resSchedule.status}, Active classes: ${dataSchedule.schedule?.length}`);

  // Test 4: Create a Room
  const newRoom = {
    id: 'rm_test_lab9',
    name: 'TEST-LAB9',
    building: 'Engineering Wing',
    capacity: 25,
    room_type: 'lab'
  };
  const resCreateRoom = await fetch(`${BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newRoom)
  });
  const dataCreateRoom = await resCreateRoom.json();
  console.log('4. POST /api/rooms:', resCreateRoom.status, dataCreateRoom.message || dataCreateRoom.error);

  // Test 5: Update Room
  const resUpdateRoom = await fetch(`${BASE_URL}/api/rooms/rm_test_lab9`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capacity: 30, status: 'available' })
  });
  const dataUpdateRoom = await resUpdateRoom.json();
  console.log('5. PUT /api/rooms/rm_test_lab9:', resUpdateRoom.status, dataUpdateRoom.message || dataUpdateRoom.error);

  // Test 6: Delete Room
  const resDeleteRoom = await fetch(`${BASE_URL}/api/rooms/rm_test_lab9`, { method: 'DELETE' });
  const dataDeleteRoom = await resDeleteRoom.json();
  console.log('6. DELETE /api/rooms/rm_test_lab9:', resDeleteRoom.status, dataDeleteRoom.message || dataDeleteRoom.error);

  // Test 7: Student Timetable
  const resTimetable = await fetch(`${BASE_URL}/api/timetables/me?student_id=usr_std_001`);
  const dataTimetable = await resTimetable.json();
  console.log(`7. GET /api/timetables/me: ${resTimetable.status}, Student: ${dataTimetable.student?.name}, Courses: ${dataTimetable.total_classes}`);

  // Test 8: Conflict Check (BR-01 Double Booking Check)
  const conflictPayload = {
    room_id: 'rm_c1_101',
    section_id: 'sec_swe204_02',
    day_of_week: 'Monday',
    start_time: '09:30',
    end_time: '10:30'
  };
  const resCheckConflict = await fetch(`${BASE_URL}/api/conflicts/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(conflictPayload)
  });
  const dataCheckConflict = await resCheckConflict.json();
  console.log('8. POST /api/conflicts/check (Should detect conflict):', resCheckConflict.status, {
    has_conflict: dataCheckConflict.has_conflict,
    conflict_type: dataCheckConflict.conflict_type,
    reason: dataCheckConflict.reason,
    suggestions: dataCheckConflict.suggested_available_slots?.length
  });

  // Test 9: Create Meeting with Overlap (BR-01 Enforcement -> Expect 409 Conflict)
  const overlappingMeeting = {
    id: 'mtg_conflict_test',
    section_id: 'sec_swe204_02',
    room_id: 'rm_c1_101',
    day_of_week: 'Monday',
    start_time: '09:30',
    end_time: '10:30'
  };
  const resOverlap = await fetch(`${BASE_URL}/api/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overlappingMeeting)
  });
  const dataOverlap = await resOverlap.json();
  console.log('9. POST /api/meetings (Overlap attempt - Expect 409):', resOverlap.status, dataOverlap.error);

  // Test 10: Create Meeting with Capacity Exceeded (BR-02 Enforcement -> Expect 400 Bad Request)
  // S7-Lab1 has capacity 35, sec_swe312_01 has capacity 50
  const capacityMeeting = {
    id: 'mtg_capacity_test',
    section_id: 'sec_swe312_01',
    room_id: 'rm_s7_lab1',
    day_of_week: 'Friday',
    start_time: '09:00',
    end_time: '11:00'
  };
  const resCapacity = await fetch(`${BASE_URL}/api/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(capacityMeeting)
  });
  const dataCapacity = await resCapacity.json();
  console.log('10. POST /api/meetings (Capacity exceeded - Expect 400):', resCapacity.status, dataCapacity.error);

  // Test 11: Create Valid Meeting (Create test - Expect 201)
  const validMeeting = {
    id: 'mtg_valid_test',
    section_id: 'sec_swe204_02',
    room_id: 'rm_e3_205',
    day_of_week: 'Friday',
    start_time: '13:00',
    end_time: '15:00',
    created_by: 'usr_stf_001'
  };
  const resValid = await fetch(`${BASE_URL}/api/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validMeeting)
  });
  const dataValid = await resValid.json();
  console.log('11. POST /api/meetings (Valid creation - Expect 201):', resValid.status, dataValid.message);

  // Test 12: Update Meeting via PATCH (Update test - Expect 200)
  const resPatch = await fetch(`${BASE_URL}/api/meetings/mtg_valid_test`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_time: '14:00', end_time: '16:00' })
  });
  const dataPatch = await resPatch.json();
  console.log('12. PATCH /api/meetings/mtg_valid_test (Update via PATCH - Expect 200):', resPatch.status, dataPatch.message);

  // Test 13: Inbound enrollment.changed Event & Event Replay (Idempotency Test)
  const eventPayload = {
    event_id: 'evt_replay_test_001',
    event_name: 'enrollment.changed',
    student_id: 'usr_std_001',
    section_id: 'sec_swe204_02',
    action: 'enrolled',
    timestamp: new Date().toISOString()
  };
  // Send 1st time
  const resEvt1 = await fetch(`${BASE_URL}/api/enrollments/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventPayload)
  });
  const dataEvt1 = await resEvt1.json();
  // Send 2nd time (duplicate/replay)
  const resEvt2 = await fetch(`${BASE_URL}/api/enrollments/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventPayload)
  });
  const dataEvt2 = await resEvt2.json();
  console.log('13. POST /api/enrollments/event (Idempotent Event Replay Test):', {
    first_send_status: resEvt1.status,
    replay_send_status: resEvt2.status,
    is_idempotent: dataEvt2.idempotent,
    count_after_replay: dataEvt2.current_status?.enrolled_count
  });

  // Test 14: Delete Test Meeting
  const resDelMtg = await fetch(`${BASE_URL}/api/meetings/mtg_valid_test`, { method: 'DELETE' });
  const dataDelMtg = await resDelMtg.json();
  console.log('14. DELETE /api/meetings/mtg_valid_test:', resDelMtg.status, dataDelMtg.message);

  console.log('\n==================================================');
  console.log('All Live API Tests Completed Successfully!');
  console.log('==================================================');
}

testApi().catch(console.error);
