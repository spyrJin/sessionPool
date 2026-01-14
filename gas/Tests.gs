/**
 * ============================================================
 * [Tests.gs]
 * 세션풀 시스템 통합 테스트 모음
 * 
 * 실행 방법:
 * 1. GAS 에디터에서 함수 선택 후 실행
 * 2. View > Execution log에서 결과 확인
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 🧪 테스트 유틸리티
// ─────────────────────────────────────────────────────────

let testResults = [];
let currentTestSuite = '';

function startTestSuite(name) {
  currentTestSuite = name;
  Logger.log('\n' + '='.repeat(60));
  Logger.log('🧪 테스트 스위트: ' + name);
  Logger.log('='.repeat(60));
}

function assert(condition, testName, details) {
  const status = condition ? '✅ PASS' : '❌ FAIL';
  const message = status + ' | ' + testName + (details ? ' | ' + details : '');
  Logger.log(message);
  testResults.push({
    suite: currentTestSuite,
    name: testName,
    passed: condition,
    details: details
  });
  return condition;
}

function assertEqual(actual, expected, testName) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  const details = passed ? '' : 'Expected: ' + JSON.stringify(expected) + ', Got: ' + JSON.stringify(actual);
  return assert(passed, testName, details);
}

function summarizeTests() {
  Logger.log('\n' + '='.repeat(60));
  Logger.log('📊 테스트 결과 요약');
  Logger.log('='.repeat(60));
  
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const total = testResults.length;
  
  Logger.log('총 테스트: ' + total);
  Logger.log('✅ 성공: ' + passed);
  Logger.log('❌ 실패: ' + failed);
  Logger.log('성공률: ' + Math.round(passed / total * 100) + '%');
  
  if (failed > 0) {
    Logger.log('\n실패한 테스트:');
    testResults.filter(r => !r.passed).forEach(r => {
      Logger.log('  - [' + r.suite + '] ' + r.name);
      if (r.details) Logger.log('    ' + r.details);
    });
  }
  
  return { passed, failed, total };
}


// ─────────────────────────────────────────────────────────
// 🧪 1. 그룹 크기 계산 테스트
// ─────────────────────────────────────────────────────────

function test_calculateGroupSizes() {
  startTestSuite('그룹 크기 계산 (calculateGroupSizes)');
  
  // 테스트 케이스: [입력 인원수, 예상 그룹 크기 배열]
  const testCases = [
    [1, []],           // 1명: 그룹 불가
    [2, [2]],          // 2명: 2인 그룹 1개
    [3, [3]],          // 3명: 3인 그룹 1개
    [4, [2, 2]],       // 4명: 2+2 (3+1 방지!)
    [5, [3, 2]],       // 5명: 3+2
    [6, [3, 3]],       // 6명: 3+3
    [7, [3, 2, 2]],    // 7명: 3+2+2
    [8, [3, 3, 2]],    // 8명: 3+3+2
    [9, [3, 3, 3]],    // 9명: 3+3+3
    [10, [3, 3, 2, 2]], // 10명: 3+3+2+2
    [11, [3, 3, 3, 2]], // 11명: 3+3+3+2
    [12, [3, 3, 3, 3]]  // 12명: 3+3+3+3
  ];
  
  testCases.forEach(([n, expected]) => {
    const result = calculateGroupSizes(n);
    assertEqual(result, expected, n + '명 → [' + expected.join(', ') + ']');
  });
  
  // 핵심 규칙 검증: 4명일 때 반드시 2+2
  const fourPeople = calculateGroupSizes(4);
  assert(
    fourPeople.indexOf(1) === -1, 
    '4명일 때 1인 그룹 없음 (3+1 방지)',
    '결과: [' + fourPeople.join(', ') + ']'
  );
}


// ─────────────────────────────────────────────────────────
// 🧪 2. 그룹 분배 테스트
// ─────────────────────────────────────────────────────────

function test_distributeToGroups() {
  startTestSuite('그룹 분배 (distributeToGroups)');
  
  // 테스트 데이터 생성 헬퍼
  function makeUsers(count, baseStreak) {
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push({
        row: i + 2,
        instagram: '@user' + i,
        streak: baseStreak - i * 5,
        session: '테스트 세션',
        cohort: '@각자'
      });
    }
    return users;
  }
  
  // 테스트 1: 2명 → 1그룹(2명), leftover 없음
  const users2 = makeUsers(2, 50);
  const result2 = distributeToGroups(users2, 'test');
  assertEqual(result2.groups.length, 1, '2명 → 그룹 1개');
  assertEqual(result2.groups[0].members.length, 2, '2명 그룹 크기 = 2');
  assertEqual(result2.leftover, null, '2명 → leftover 없음');
  
  // 테스트 2: 3명 → 1그룹(3명), leftover 없음
  const users3 = makeUsers(3, 50);
  const result3 = distributeToGroups(users3, 'test');
  assertEqual(result3.groups.length, 1, '3명 → 그룹 1개');
  assertEqual(result3.groups[0].members.length, 3, '3명 그룹 크기 = 3');
  assertEqual(result3.leftover, null, '3명 → leftover 없음');
  
  // 테스트 3: 4명 → 2그룹(2+2), leftover 없음 ⭐핵심
  const users4 = makeUsers(4, 50);
  const result4 = distributeToGroups(users4, 'test');
  assertEqual(result4.groups.length, 2, '4명 → 그룹 2개');
  assert(
    result4.groups[0].members.length === 2 && result4.groups[1].members.length === 2,
    '4명 → 2+2 분할 (3+1 아님)',
    '그룹 크기: ' + result4.groups.map(g => g.members.length).join(', ')
  );
  assertEqual(result4.leftover, null, '4명 → leftover 없음');
  
  // 테스트 4: 5명 → 1그룹(3명) + 1그룹(2명), leftover 없음
  const users5 = makeUsers(5, 50);
  const result5 = distributeToGroups(users5, 'test');
  assertEqual(result5.groups.length, 2, '5명 → 그룹 2개');
  assertEqual(result5.leftover, null, '5명 → leftover 없음');
  
  // 테스트 5: 1명 → 0그룹, leftover 1명
  const users1 = makeUsers(1, 50);
  const result1 = distributeToGroups(users1, 'test');
  assertEqual(result1.groups.length, 0, '1명 → 그룹 0개');
  assert(result1.leftover !== null, '1명 → leftover 있음');
  
  // 테스트 6: 정렬 순서 유지 확인 (Streak 내림차순)
  const sortedUsers = makeUsers(6, 100);
  sortedUsers.sort((a, b) => b.streak - a.streak);
  const sortedResult = distributeToGroups(sortedUsers, 'test');
  const firstGroupStreaks = sortedResult.groups[0].members.map(m => m.streak);
  assert(
    firstGroupStreaks[0] >= firstGroupStreaks[1] && firstGroupStreaks[1] >= firstGroupStreaks[2],
    '그룹 내 Streak 순서 유지',
    'Streaks: ' + firstGroupStreaks.join(', ')
  );
}


// ─────────────────────────────────────────────────────────
// 🧪 3. 매칭 엔진 통합 테스트
// ─────────────────────────────────────────────────────────

function test_runMatchingEngine() {
  startTestSuite('매칭 엔진 통합 (runMatchingEngine)');
  
  // 시나리오: 여러 세션에서 다양한 인원이 참여
  const testUsers = [
    // @sloth_idea 세션: 4명 → 2+2 그룹
    { row: 2, instagram: '@jinmo', streak: 76, session: '15:00 @sloth_idea', cohort: '@sloth_idea' },
    { row: 3, instagram: '@ijaka', streak: 72, session: '15:00 @sloth_idea', cohort: '@sloth_idea' },
    { row: 4, instagram: '@soeun', streak: 20, session: '15:00 @sloth_idea', cohort: '@sloth_idea' },
    { row: 5, instagram: '@newbie', streak: 0, session: '15:00 @sloth_idea', cohort: '@sloth_idea' },
    
    // @session_pool 세션: 1명 → Universal Pool로 이동
    { row: 6, instagram: '@loner_sp', streak: 10, session: '05:00 @session_pool', cohort: '@session_pool' },
    
    // 몰입 @각자 세션: 4명 → 2+2 그룹
    { row: 7, instagram: '@user_a', streak: 50, session: '몰입 @각자', cohort: '@각자' },
    { row: 8, instagram: '@user_b', streak: 45, session: '몰입 @각자', cohort: '@각자' },
    { row: 9, instagram: '@user_c', streak: 5, session: '몰입 @각자', cohort: '@각자' },
    { row: 10, instagram: '@user_d', streak: 2, session: '몰입 @각자', cohort: '@각자' },
    
    // 회복 @각자 세션: 1명 → Universal Pool로 이동
    { row: 11, instagram: '@loner_recover', streak: 100, session: '회복 @각자', cohort: '@각자' }
  ];
  
  const result = runMatchingEngine(testUsers);
  
  // 검증 1: 그룹 생성됨
  assert(result.groups.length > 0, '그룹이 생성됨', '그룹 수: ' + result.groups.length);
  
  // 검증 2: 모든 그룹이 2-3명
  const invalidGroups = result.groups.filter(g => g.members.length < 2 || g.members.length > 3);
  assertEqual(invalidGroups.length, 0, '모든 그룹이 2-3명');
  
  // 검증 3: @sloth_idea 4명 → 2+2 그룹
  const slothGroups = result.groups.filter(g => g.session === '15:00 @sloth_idea');
  assertEqual(slothGroups.length, 2, '@sloth_idea 4명 → 2그룹');
  assert(
    slothGroups.every(g => g.members.length === 2),
    '@sloth_idea 4명 → 2+2 분할',
    '그룹 크기: ' + slothGroups.map(g => g.members.length).join(', ')
  );
  
  // 검증 4: 몰입 @각자 4명 → 2+2 그룹
  const immerseGroups = result.groups.filter(g => g.session === '몰입 @각자');
  assertEqual(immerseGroups.length, 2, '몰입 @각자 4명 → 2그룹');
  
  // 검증 5: Universal Pool 처리 (낙오자 2명: @loner_sp, @loner_recover)
  const universalGroups = result.groups.filter(g => g.type === 'UNIVERSAL');
  assert(universalGroups.length > 0 || result.lobbyUsers.length > 0, 
    'Universal Pool 또는 Lobby 처리됨',
    'Universal 그룹: ' + universalGroups.length + ', Lobby: ' + result.lobbyUsers.length);
  
  // 검증 6: 총 인원수 확인 (모든 사용자가 그룹 또는 Lobby에 배정)
  const groupedCount = result.groups.reduce((sum, g) => sum + g.members.length, 0);
  const totalAssigned = groupedCount + result.lobbyUsers.length;
  assertEqual(totalAssigned, testUsers.length, '모든 사용자 배정됨 (' + totalAssigned + '/' + testUsers.length + ')');
  
  // 로그: 결과 상세
  Logger.log('\n--- 매칭 결과 상세 ---');
  result.groups.forEach((g, i) => {
    Logger.log('그룹 ' + (i + 1) + ' [' + g.session + '] (' + g.type + '): ' + 
      g.members.map(m => m.instagram + '(' + m.streak + ')').join(', '));
  });
  if (result.lobbyUsers.length > 0) {
    Logger.log('Lobby: ' + result.lobbyUsers.map(u => u.instagram).join(', '));
  }
}


// ─────────────────────────────────────────────────────────
// 🧪 4. 시간/블록 계산 테스트
// ─────────────────────────────────────────────────────────

function test_timeCalculations() {
  startTestSuite('시간/블록 계산');
  
  // getBlockColumnForTime 테스트
  // CONFIG.START_HOUR = 5 (05:00 시작), B열(2)부터 시작
  
  const timeTests = [
    { hour: 5, minute: 0, expectedCol: 2, label: '05:00 → B열(2)' },
    { hour: 5, minute: 29, expectedCol: 2, label: '05:29 → B열(2)' },
    { hour: 5, minute: 30, expectedCol: 3, label: '05:30 → C열(3)' },
    { hour: 6, minute: 0, expectedCol: 4, label: '06:00 → D열(4)' },
    { hour: 12, minute: 0, expectedCol: 16, label: '12:00 → P열(16)' },
    { hour: 23, minute: 30, expectedCol: 39, label: '23:30 → 39열' },
    { hour: 0, minute: 0, expectedCol: 40, label: '00:00 (자정) → 40열' },
    { hour: 4, minute: 30, expectedCol: 49, label: '04:30 → 49열 (마지막)' }
  ];
  
  timeTests.forEach(t => {
    const result = getBlockColumnForTime(t.hour, t.minute);
    assertEqual(result, t.expectedCol, t.label);
  });
  
  // getTimeLabel 테스트 (역변환)
  const labelTests = [
    { col: 2, expectedLabel: '05:00' },
    { col: 3, expectedLabel: '05:30' },
    { col: 4, expectedLabel: '06:00' },
    { col: 40, expectedLabel: '00:00' },
    { col: 49, expectedLabel: '04:30' }
  ];
  
  labelTests.forEach(t => {
    const result = getTimeLabel(t.col);
    assertEqual(result, t.expectedLabel, '열 ' + t.col + ' → ' + t.expectedLabel);
  });
  
  // isGateOpen 테스트
  // 게이트 열림: 00-04분, 30-34분
  function makeDate(hour, minute) {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  }
  
  const gateTests = [
    { minute: 0, expected: true, label: '00분 → 게이트 열림' },
    { minute: 4, expected: true, label: '04분 → 게이트 열림' },
    { minute: 5, expected: false, label: '05분 → 게이트 닫힘' },
    { minute: 29, expected: false, label: '29분 → 게이트 닫힘' },
    { minute: 30, expected: true, label: '30분 → 게이트 열림' },
    { minute: 34, expected: true, label: '34분 → 게이트 열림' },
    { minute: 35, expected: false, label: '35분 → 게이트 닫힘' },
    { minute: 59, expected: false, label: '59분 → 게이트 닫힘' }
  ];
  
  gateTests.forEach(t => {
    const testDate = makeDate(12, t.minute);
    const result = isGateOpen(testDate);
    assertEqual(result, t.expected, t.label);
  });
}


// ─────────────────────────────────────────────────────────
// 🧪 5. 파싱 유틸리티 테스트
// ─────────────────────────────────────────────────────────

function test_parsingUtils() {
  startTestSuite('파싱 유틸리티');
  
  // parseStreak 테스트
  const streakTests = [
    { label: '🔥76 @jinmo', expected: 76 },
    { label: '⭐00 @newbie', expected: 0 },
    { label: '🔥123 @user', expected: 123 },
    { label: '잘못된 라벨', expected: 0 },
    { label: '', expected: 0 },
    { label: null, expected: 0 }
  ];
  
  streakTests.forEach(t => {
    const result = parseStreak(t.label);
    assertEqual(result, t.expected, 'parseStreak("' + t.label + '") = ' + t.expected);
  });
  
  // parseInstagram 테스트
  const instaTests = [
    { label: '🔥76 @jinmo_yang', expected: '@jinmo_yang' },
    { label: '⭐00 @newbie', expected: '@newbie' },
    { label: '🔥10 @user_123', expected: '@user_123' },
    { label: '잘못된', expected: null },
    { label: '', expected: null }
  ];
  
  instaTests.forEach(t => {
    const result = parseInstagram(t.label);
    assertEqual(result, t.expected, 'parseInstagram("' + t.label + '") = ' + t.expected);
  });
  
  // extractCohortName 테스트
  const cohortTests = [
    { session: '15:00 @sloth_idea', expected: '@sloth_idea' },
    { session: '몰입 @각자', expected: '@각자' },
    { session: '05:00 @session_pool', expected: '@session_pool' },
    { session: '회복 @각자', expected: '@각자' },
    { session: '', expected: '@각자' },  // 기본값
    { session: null, expected: '@각자' }
  ];
  
  cohortTests.forEach(t => {
    const result = extractCohortName(t.session);
    assertEqual(result, t.expected, 'extractCohortName("' + t.session + '") = ' + t.expected);
  });
  
  // isImmersionSession 테스트
  const immersionTests = [
    { session: '몰입 @각자', expected: true },
    { session: '15:00 @sloth_idea', expected: true },  // 시간 지정 = 몰입
    { session: '회복 @각자', expected: false }
  ];
  
  immersionTests.forEach(t => {
    const result = isImmersionSession(t.session);
    assertEqual(result, t.expected, 'isImmersionSession("' + t.session + '") = ' + t.expected);
  });
}


// ─────────────────────────────────────────────────────────
// 🧪 6. Meet 배정 테스트
// ─────────────────────────────────────────────────────────

function test_meetAssigner() {
  startTestSuite('Meet 방 배정 (assignMeetRooms)');
  
  const testGroups = [
    {
      members: [
        { row: 2, instagram: '@user1', streak: 50, session: '몰입 @각자' },
        { row: 3, instagram: '@user2', streak: 40, session: '몰입 @각자' }
      ],
      session: '몰입 @각자',
      cohort: '@각자',
      avgStreak: 45,
      type: 'COHORT'
    },
    {
      members: [
        { row: 4, instagram: '@user3', streak: 30, session: '몰입 @각자' },
        { row: 5, instagram: '@user4', streak: 20, session: '몰입 @각자' }
      ],
      session: '몰입 @각자',
      cohort: '@각자',
      avgStreak: 25,
      type: 'COHORT'
    }
  ];
  
  const testLobbyUsers = [
    { row: 6, instagram: '@lonely', streak: 5, session: '회복 @각자', originSession: '회복 @각자' }
  ];
  
  const assignments = assignMeetRooms(testGroups, testLobbyUsers);
  
  // 검증 1: 배정 수 = 그룹 멤버 수 + Lobby 수
  const expectedCount = testGroups.reduce((sum, g) => sum + g.members.length, 0) + testLobbyUsers.length;
  assertEqual(assignments.length, expectedCount, '배정 수 = ' + expectedCount);
  
  // 검증 2: 모든 배정에 Meet 링크 존재
  const hasAllLinks = assignments.every(a => a.meetLink && a.meetLink.startsWith('https://'));
  assert(hasAllLinks, '모든 배정에 Meet 링크 존재');
  
  // 검증 3: 같은 그룹은 같은 방
  const group1Members = assignments.filter(a => a.row === 2 || a.row === 3);
  if (group1Members.length === 2) {
    assertEqual(group1Members[0].meetLink, group1Members[1].meetLink, '같은 그룹 = 같은 방');
  }
  
  // 검증 4: 다른 그룹은 다른 방 (Round-Robin)
  const group1Link = assignments.find(a => a.row === 2)?.meetLink;
  const group2Link = assignments.find(a => a.row === 4)?.meetLink;
  if (group1Link && group2Link) {
    assert(group1Link !== group2Link, '다른 그룹 = 다른 방 (Round-Robin)');
  }
  
  // 검증 5: Lobby 사용자는 Lobby 방
  const lobbyAssignment = assignments.find(a => a.row === 6);
  assert(lobbyAssignment && lobbyAssignment.type === 'LOBBY', 'Lobby 사용자 타입 = LOBBY');
  assertEqual(lobbyAssignment?.meetLink, CONFIG.LOBBY_ROOM, 'Lobby 방 URL 일치');
  
  // 로그: 배정 결과
  Logger.log('\n--- 배정 결과 ---');
  assignments.forEach(a => {
    Logger.log('Row ' + a.row + ': ' + a.displayText + ' → ' + a.meetLink.substring(0, 40) + '...');
  });
}


// ─────────────────────────────────────────────────────────
// 🧪 7. Edge Case 테스트
// ─────────────────────────────────────────────────────────

function test_edgeCases() {
  startTestSuite('Edge Cases');
  
  // 테스트 1: 0명 참여
  const emptyResult = runMatchingEngine([]);
  assertEqual(emptyResult.groups.length, 0, '0명 → 그룹 0개');
  assertEqual(emptyResult.lobbyUsers.length, 0, '0명 → Lobby 0명');
  
  // 테스트 2: 1명만 참여 → Lobby
  const singleUser = [{ row: 2, instagram: '@only', streak: 10, session: '몰입 @각자', cohort: '@각자' }];
  const singleResult = runMatchingEngine(singleUser);
  assertEqual(singleResult.groups.length, 0, '1명 → 그룹 0개');
  assertEqual(singleResult.lobbyUsers.length, 1, '1명 → Lobby 1명');
  
  // 테스트 3: 2명 참여 (최소 그룹)
  const twoUsers = [
    { row: 2, instagram: '@user1', streak: 50, session: '몰입 @각자', cohort: '@각자' },
    { row: 3, instagram: '@user2', streak: 40, session: '몰입 @각자', cohort: '@각자' }
  ];
  const twoResult = runMatchingEngine(twoUsers);
  assertEqual(twoResult.groups.length, 1, '2명 → 그룹 1개');
  assertEqual(twoResult.groups[0].members.length, 2, '2명 그룹 크기 = 2');
  
  // 테스트 4: 모두 다른 세션 (각자 1명) → 모두 Universal Pool → 재그룹화
  const differentSessions = [
    { row: 2, instagram: '@user1', streak: 50, session: '몰입 @각자', cohort: '@각자' },
    { row: 3, instagram: '@user2', streak: 40, session: '회복 @각자', cohort: '@각자' },
    { row: 4, instagram: '@user3', streak: 30, session: '15:00 @sloth_idea', cohort: '@sloth_idea' }
  ];
  const diffResult = runMatchingEngine(differentSessions);
  
  // 3명이 각각 다른 세션 → Universal Pool에서 3명 그룹 생성
  const totalAssigned = diffResult.groups.reduce((sum, g) => sum + g.members.length, 0) + diffResult.lobbyUsers.length;
  assertEqual(totalAssigned, 3, '다른 세션 3명 → 모두 배정됨');
  
  // 테스트 5: 동일 Streak일 때 안정적 정렬
  const sameStreakUsers = [
    { row: 2, instagram: '@user_a', streak: 50, session: '몰입 @각자', cohort: '@각자' },
    { row: 3, instagram: '@user_b', streak: 50, session: '몰입 @각자', cohort: '@각자' },
    { row: 4, instagram: '@user_c', streak: 50, session: '몰입 @각자', cohort: '@각자' }
  ];
  const sameStreakResult = runMatchingEngine(sameStreakUsers);
  assertEqual(sameStreakResult.groups.length, 1, '동일 Streak 3명 → 그룹 1개');
  assertEqual(sameStreakResult.groups[0].members.length, 3, '그룹 크기 = 3');
}


// ─────────────────────────────────────────────────────────
// 🚀 전체 테스트 실행
// ─────────────────────────────────────────────────────────

/**
 * 🚀 모든 테스트 실행 (이 함수를 GAS 에디터에서 실행)
 */
function runAllTests() {
  testResults = [];  // 결과 초기화
  
  Logger.log('🚀 세션풀 테스트 시작: ' + new Date().toLocaleString());
  Logger.log('');
  
  try {
    test_calculateGroupSizes();
    test_distributeToGroups();
    test_runMatchingEngine();
    test_timeCalculations();
    test_parsingUtils();
    test_meetAssigner();
    test_edgeCases();
  } catch (error) {
    Logger.log('❌ 테스트 실행 중 오류: ' + error.toString());
    Logger.log(error.stack);
  }
  
  const summary = summarizeTests();
  
  Logger.log('\n🏁 테스트 완료: ' + new Date().toLocaleString());
  
  return summary;
}


// ─────────────────────────────────────────────────────────
// 🎯 개별 테스트 실행 함수 (빠른 디버깅용)
// ─────────────────────────────────────────────────────────

/**
 * 매칭 엔진만 테스트
 */
function runMatchingTest() {
  testResults = [];
  test_runMatchingEngine();
  summarizeTests();
}

/**
 * 시간 계산만 테스트
 */
function runTimeTest() {
  testResults = [];
  test_timeCalculations();
  summarizeTests();
}

/**
 * Edge Case만 테스트
 */
function runEdgeCaseTest() {
  testResults = [];
  test_edgeCases();
  summarizeTests();
}


// ─────────────────────────────────────────────────────────
// 🎯 실제 시트 테스트 (UI 없이 실행)
// ─────────────────────────────────────────────────────────

/**
 * 테스트 사용자 생성 (UI 확인 없이)
 */
function createTestUsersNoUI() {
  const testUsers = [
    { email: 'test1@test.com', instagram: '@jinmo_yang', cohorts: ['@각자', '@session_pool', '@sloth_idea'] },
    { email: 'test2@test.com', instagram: '@ijaka_life', cohorts: ['@각자', '@session_pool', '@sloth_idea'] },
    { email: 'test3@test.com', instagram: '@soeun_kim', cohorts: ['@각자', '@sloth_idea'] },
    { email: 'test4@test.com', instagram: '@jacob_dayz', cohorts: ['@각자', '@session_pool'] },
    { email: 'test5@test.com', instagram: '@yechan_k', cohorts: ['@각자'] },
    { email: 'test6@test.com', instagram: '@sunhye_u', cohorts: ['@각자', '@session_pool'] },
    { email: 'test7@test.com', instagram: '@newbie_123', cohorts: ['@각자'] },
    { email: 'test8@test.com', instagram: '@user_alpha', cohorts: ['@각자'] },
    { email: 'test9@test.com', instagram: '@user_beta', cohorts: ['@각자'] },
    { email: 'test10@test.com', instagram: '@user_gamma', cohorts: ['@각자'] }
  ];
  
  const streaks = [76, 72, 72, 50, 45, 24, 10, 5, 2, 0];
  
  Logger.log('🚀 테스트 사용자 생성 시작...');
  
  testUsers.forEach((userData, index) => {
    const user = registerUser(userData.email, userData.instagram, userData.cohorts);
    updateUser(userData.email, { streak: streaks[index] });
    updateUserLabel(userData.email);
    Logger.log('✅ ' + userData.instagram + ' (Streak: ' + streaks[index] + ') 생성됨');
  });
  
  Logger.log('🎉 테스트 사용자 ' + testUsers.length + '명 생성 완료!');
}

/**
 * 세션 선택 시뮬레이션 (UI 확인 없이)
 */
function simulateSessionSelectionNoUI() {
  const sheet = getMainSheet();
  const currentCol = getCurrentBlockColumn();
  
  // 모든 사용자가 선택 가능한 @각자 세션만 사용
  const testSessions = [
    '몰입 @각자',            // @jinmo_yang
    '몰입 @각자',            // @ijaka_life
    '몰입 @각자',            // @soeun_kim
    '몰입 @각자',            // @jacob_dayz
    '몰입 @각자',            // @yechan_k
    '몰입 @각자',            // @sunhye_u
    '회복 @각자',            // @newbie_123
    '회복 @각자',            // @user_alpha
    '회복 @각자',            // @user_beta
    '회복 @각자'             // @user_gamma
  ];
  
  Logger.log('🚀 세션 데이터 입력 시작...');
  Logger.log('현재 열: ' + currentCol + ' (' + getTimeLabel(currentCol) + ')');
  
  testSessions.forEach((session, index) => {
    sheet.getRange(index + 2, currentCol).setValue(session);
    Logger.log('Row ' + (index + 2) + ': ' + session);
  });
  
  Logger.log('🎉 테스트 데이터 입력 완료!');
  Logger.log('👉 이제 forceGateCloseNoUI() 를 실행하세요');
}

/**
 * 강제 게이트 닫기 (UI 확인 없이)
 */
function forceGateCloseNoUI() {
  const column = getCurrentBlockColumn();
  Logger.log('🚀 게이트 닫기 시작: 열 ' + column + ' (' + getTimeLabel(column) + ')');
  
  onGateClose(column);
  
  Logger.log('🎉 게이트 닫기 완료! 시트를 확인하세요.');
}

/**
 * 전체 테스트 한번에 실행
 */
function runFullIntegrationTest() {
  Logger.log('═'.repeat(60));
  Logger.log('🧪 통합 테스트 시작');
  Logger.log('═'.repeat(60));
  
  // Step 1: 테스트 사용자 생성
  Logger.log('\n📌 Step 1: 테스트 사용자 생성');
  createTestUsersNoUI();
  
  // Step 2: 세션 선택 시뮬레이션
  Logger.log('\n📌 Step 2: 세션 선택 시뮬레이션');
  simulateSessionSelectionNoUI();
  
  // Step 3: 게이트 닫기 (매칭 실행)
  Logger.log('\n📌 Step 3: 게이트 닫기 (매칭 실행)');
  forceGateCloseNoUI();
  
  Logger.log('\n' + '═'.repeat(60));
  Logger.log('🎉 통합 테스트 완료! 시트를 확인하세요.');
  Logger.log('═'.repeat(60));
}

// ─────────────────────────────────────────────────────────
// [실전 테스트] 관리자 이메일 발송 테스트
// ─────────────────────────────────────────────────────────
function testEmailToJinmo() {
  const targetEmail = 'jinmo0303@gmail.com';
  const targetSheetUrl = 'https://docs.google.com/spreadsheets/d/1MQup9hz60TgbPOlMPBNMpkJeLJ59zAtPGqMKMVtIGmU/edit';
  
  Logger.log('=== 이메일 발송 테스트 시작 ===');
  Logger.log('수신자: ' + targetEmail);
  Logger.log('링크: ' + targetSheetUrl);
  
  // 가짜 유저 데이터 생성
  const testUsers = [
    { 
      email: targetEmail, 
      instagram: '@jinmo_admin', 
      name: '관리자' 
    }
  ];
  
  // 실제 발송 함수 호출
  try {
    sendLinkToAllUsers(testUsers, targetSheetUrl);
    Logger.log('✅ 발송 명령 완료! (Resend 로그 확인 필요)');
  } catch (e) {
    Logger.log('❌ 발송 실패: ' + e.toString());
  }
}

// ─────────────────────────────────────────────────────────
// [진단] 시트 및 템플릿 상태 확인
// ─────────────────────────────────────────────────────────
function debugSheetStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  Logger.log('=== 시트 목록 진단 ===');
  let targetSheetFound = false;
  
  sheets.forEach(s => {
    const name = s.getName();
    Logger.log(`- [${name}] (공백 포함 길이: ${name.length})`);
    if (name === '[ADMIN_EMAIL]') targetSheetFound = true;
  });
  
  if (!targetSheetFound) {
    Logger.log('❌ [ADMIN_EMAIL] 시트를 찾을 수 없습니다. 이름 앞뒤 공백을 확인하세요.');
    return;
  }
  
  Logger.log('✅ [ADMIN_EMAIL] 시트 발견!');
  
  const sheet = ss.getSheetByName('[ADMIN_EMAIL]');
  const data = sheet.getDataRange().getValues();
  
  Logger.log('=== 데이터 확인 (상위 5행) ===');
  data.slice(0, 5).forEach((row, i) => {
    Logger.log(`Row ${i+1}: [${row[0]}] / [${row[2]}]`);
  });
  
  // DAILY_LINK 찾기
  const found = data.find(row => row[0] === 'DAILY_LINK');
  if (found) {
    Logger.log('✅ DAILY_LINK 키 발견됨!');
  } else {
    Logger.log('❌ DAILY_LINK 키를 찾을 수 없습니다. A열에 정확히 입력되었는지 확인하세요.');
  }
}

// ─────────────────────────────────────────────────────────
// 🆕 신규 기능 통합 테스트 (2024-01 업데이트)
// ─────────────────────────────────────────────────────────

/**
 * 모든 신규 기능 테스트 실행
 * - API 키 관리 (보안 개선)
 * - 사용자 데이터 캐싱 (성능 개선)
 * - 행 동기화 (안정성 개선)
 * - 배치 업데이트 (성능 개선)
 */
function runNewFeaturesTest() {
  testResults = [];

  Logger.log('');
  Logger.log('╔══════════════════════════════════════════════════════════╗');
  Logger.log('║     🆕 신규 기능 통합 테스트 (2024-01 업데이트)          ║');
  Logger.log('╚══════════════════════════════════════════════════════════╝');

  // 1. API 키 관리 테스트
  testApiKeyManagement();

  // 2. 캐싱 레이어 테스트
  testCachingLayer();

  // 3. 행 동기화 테스트
  testRowReconciliation();

  // 4. 함수 존재 여부 테스트
  testNewFunctionsExist();

  // 5. 매칭 엔진 테스트 (기존 기능 호환성)
  testMatchingEngineCompatibility();

  // 결과 요약
  summarizeTests();

  return testResults;
}

/**
 * 1. API 키 관리 테스트
 */
function testApiKeyManagement() {
  startTestSuite('API 키 관리 (보안)');

  // 함수 존재 확인
  assert(typeof getResendApiKey === 'function', 'getResendApiKey 함수 존재');
  assert(typeof setResendApiKey === 'function', 'setResendApiKey 함수 존재');

  // API 키 조회 테스트 (값은 로그에 노출하지 않음)
  try {
    const apiKey = getResendApiKey();
    const hasKey = apiKey !== null && apiKey !== undefined;
    assert(true, 'getResendApiKey 실행 성공', hasKey ? '키 설정됨' : '키 미설정');
  } catch (e) {
    assert(false, 'getResendApiKey 실행', e.toString());
  }

  // Config에서 API 키 제거 확인
  const configHasKey = CONFIG.RESEND_API_KEY !== undefined;
  assert(!configHasKey, 'CONFIG에서 API 키 제거됨', configHasKey ? '아직 CONFIG에 존재!' : '정상');
}

/**
 * 2. 캐싱 레이어 테스트
 */
function testCachingLayer() {
  startTestSuite('사용자 데이터 캐싱 (성능)');

  // 캐시 함수 존재 확인
  assert(typeof _getCachedUsers === 'function', '_getCachedUsers 함수 존재');
  assert(typeof _getCachedUsersForWrite === 'function', '_getCachedUsersForWrite 함수 존재');
  assert(typeof _saveUsersCache === 'function', '_saveUsersCache 함수 존재');
  assert(typeof invalidateUsersCache === 'function', 'invalidateUsersCache 함수 존재');

  // 캐시 무효화 테스트
  try {
    invalidateUsersCache();
    assert(true, '캐시 무효화 성공');
  } catch (e) {
    assert(false, '캐시 무효화', e.toString());
  }

  // 캐시 로드 테스트
  try {
    const users1 = getAllUsers();
    const users2 = getAllUsers(); // 캐시에서 로드되어야 함
    const userCount = Object.keys(users1).length;
    assert(true, '사용자 데이터 로드 성공', userCount + '명');
    assert(JSON.stringify(users1) === JSON.stringify(users2), '캐시 일관성 확인');
  } catch (e) {
    assert(false, '사용자 데이터 로드', e.toString());
  }
}

/**
 * 3. 행 동기화 테스트
 */
function testRowReconciliation() {
  startTestSuite('행 동기화 (안정성)');

  // 함수 존재 확인
  assert(typeof reconcileUserRows === 'function', 'reconcileUserRows 함수 존재');
  assert(typeof runRowReconciliation === 'function', 'runRowReconciliation 함수 존재');
  assert(typeof deleteUserSafe === 'function', 'deleteUserSafe 함수 존재');

  // 동기화 실행 테스트 (읽기 전용)
  try {
    const result = reconcileUserRows();
    assert(result !== null && result !== undefined, '동기화 실행 성공');
    assert(typeof result.fixed === 'number', 'fixed 카운트 반환', result.fixed + '개 수정');
    assert(Array.isArray(result.errors), 'errors 배열 반환', result.errors.length + '개 오류');
  } catch (e) {
    assert(false, '동기화 실행', e.toString());
  }
}

/**
 * 4. 신규 함수 존재 여부 테스트
 */
function testNewFunctionsExist() {
  startTestSuite('신규 함수 존재 확인');

  // UserManager.gs
  assert(typeof hasCohortAccess === 'function', 'hasCohortAccess 함수 존재 (오타 수정됨)');

  // Admin.gs - 메뉴에 추가된 함수들
  assert(typeof runRowReconciliation === 'function', 'runRowReconciliation (관리자 메뉴)');
  assert(typeof viewSecurityLogs === 'function', 'viewSecurityLogs (관리자 메뉴)');

  // GateManager.gs - 최적화된 함수
  assert(typeof applyAssignmentsToSheet === 'function', 'applyAssignmentsToSheet (배치 최적화)');
  assert(typeof recordParticipantsStreak === 'function', 'recordParticipantsStreak (N+1 수정)');

  // UserManager.gs - 배치 최적화
  assert(typeof refreshAllUserLabels === 'function', 'refreshAllUserLabels (배치 최적화)');
}

/**
 * 5. 매칭 엔진 호환성 테스트
 */
function testMatchingEngineCompatibility() {
  startTestSuite('매칭 엔진 호환성');

  // 4명 → 2+2 규칙 테스트
  const testUsers = [
    { row: 2, instagram: '@u1', streak: 40, session: 'Test', cohort: '@각자' },
    { row: 3, instagram: '@u2', streak: 30, session: 'Test', cohort: '@각자' },
    { row: 4, instagram: '@u3', streak: 20, session: 'Test', cohort: '@각자' },
    { row: 5, instagram: '@u4', streak: 10, session: 'Test', cohort: '@각자' }
  ];

  try {
    const result = runMatchingEngine(testUsers);

    assert(result.groups.length === 2, '4명 → 2그룹 생성');
    assert(result.groups[0].members.length === 2, '첫 그룹 2명');
    assert(result.groups[1].members.length === 2, '두번째 그룹 2명');
    assert(result.lobbyUsers.length === 0, 'Lobby 없음');

    // 연속일수 정렬 확인 (높은 순)
    const firstGroup = result.groups[0];
    assert(
      firstGroup.members[0].streak >= firstGroup.members[1].streak,
      '연속일수 내림차순 정렬'
    );
  } catch (e) {
    assert(false, '매칭 엔진 실행', e.toString());
  }

  // Universal Pool 테스트
  const soloUsers = [
    { row: 2, instagram: '@a', streak: 10, session: 'A', cohort: '@각자' },
    { row: 3, instagram: '@b', streak: 20, session: 'B', cohort: '@각자' }
  ];

  try {
    const result = runMatchingEngine(soloUsers);
    assert(result.groups.length === 1, 'Universal Pool 매칭');
    assert(result.groups[0].type === 'UNIVERSAL', 'UNIVERSAL 타입');
  } catch (e) {
    assert(false, 'Universal Pool 테스트', e.toString());
  }
}
