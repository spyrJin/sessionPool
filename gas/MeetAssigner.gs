/**
 * ============================================================
 * [MeetAssigner.gs]
 * Meet 방 배정 및 하이퍼링크 생성
 * 
 * 역할:
 * 1. 그룹에 코호트별 방 배정 (Round-Robin)
 * 2. Lobby 사용자에게 상설 대기방 배정
 * 3. 시트에 적용할 assignment 객체 생성
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 메인 배정 함수
// ─────────────────────────────────────────────────────────

/**
 * 그룹과 Lobby 사용자에게 Meet 방 배정
 * @param {Array} groups - 매칭된 그룹 배열
 * @param {Array} lobbyUsers - Lobby 배정 사용자 배열
 * @returns {Array} assignment 객체 배열
 */
function assignMeetRooms(groups, lobbyUsers) {
  const assignments = [];
  
  // 코호트별 방 인덱스 추적 (Round-Robin용)
  const roomIndexes = {};
  
  // 1. 그룹 배정
  groups.forEach((group, groupIndex) => {
    const cohort = extractCohortForGroup(group);
    const rooms = getCohortRooms(cohort);
    
    if (rooms.length === 0) {
      systemLog('MEET', '방 풀 없음', { cohort: cohort });
      return;
    }
    
    // Round-Robin 인덱스
    if (roomIndexes[cohort] === undefined) {
      roomIndexes[cohort] = 0;
    }
    
    const roomIndex = roomIndexes[cohort] % rooms.length;
    const meetLink = rooms[roomIndex];
    roomIndexes[cohort]++;
    
    systemLog('MEET', '그룹 배정', { 
      groupIndex: groupIndex + 1,
      cohort: cohort,
      room: 'Room ' + (roomIndex + 1),
      members: group.members.length
    });
    
    // 그룹 내 각 멤버에게 동일한 방 배정
    group.members.forEach((member, memberIndex) => {
      assignments.push(createAssignment(
        member,
        meetLink,
        group,
        memberIndex === 0  // 첫 번째 멤버에게만 노트 추가
      ));
    });
  });
  
  // 2. Lobby 사용자 배정
  lobbyUsers.forEach(user => {
    const meetLink = CONFIG.LOBBY_ROOM;
    
    systemLog('MEET', 'Lobby 배정', { user: user.instagram });
    
    assignments.push(createLobbyAssignment(user, meetLink));
  });
  
  systemLog('MEET', '방 배정 완료', { 
    totalAssignments: assignments.length 
  });
  
  return assignments;
}


// ─────────────────────────────────────────────────────────
// Assignment 객체 생성
// ─────────────────────────────────────────────────────────

/**
 * 일반 그룹 멤버용 assignment 생성
 * @param {Object} member - 멤버 정보
 * @param {string} meetLink - Meet URL
 * @param {Object} group - 그룹 정보
 * @param {boolean} includeNote - 노트 포함 여부
 * @returns {Object} assignment 객체
 */
function createAssignment(member, meetLink, group, includeNote) {
  const isImmerse = isImmersionSession(member.session);
  
  // 표시 텍스트 (세션명 유지)
  const displayText = member.session;
  
  // 색상 결정
  let bgColor, textColor;
  if (isImmerse) {
    bgColor = CONFIG.COLORS.IMMERSE;
    textColor = CONFIG.COLORS.IMMERSE_TEXT;
  } else {
    bgColor = CONFIG.COLORS.RECOVER;
    textColor = CONFIG.COLORS.RECOVER_TEXT;
  }
  
  // 노트 내용 (파트너 정보)
  let note = null;
  if (includeNote) {
    note = createGroupNote(group);
  }
  
  return {
    row: member.row,
    meetLink: meetLink,
    displayText: displayText,
    bgColor: bgColor,
    textColor: textColor,
    note: note,
    type: group.type  // 'COHORT' 또는 'UNIVERSAL'
  };
}

/**
 * Lobby 사용자용 assignment 생성
 * @param {Object} user - 사용자 정보
 * @param {string} meetLink - Lobby URL
 * @returns {Object} assignment 객체
 */
function createLobbyAssignment(user, meetLink) {
  return {
    row: user.row,
    meetLink: meetLink,
    displayText: user.session + ' (대기방)',
    bgColor: CONFIG.COLORS.WAITING,
    textColor: CONFIG.COLORS.WAITING_TEXT,
    note: '🏠 대기방\n다른 참여자를 기다리는 중입니다.\n원래 세션: ' + (user.originSession || user.session),
    type: 'LOBBY'
  };
}


// ─────────────────────────────────────────────────────────
// 그룹 노트 생성
// ─────────────────────────────────────────────────────────

/**
 * 그룹 정보 노트 생성 (셀에 표시)
 * @param {Object} group
 * @returns {string}
 */
function createGroupNote(group) {
  const lines = [];
  
  // 그룹 타입
  if (group.type === 'UNIVERSAL') {
    lines.push('🌐 Universal Pool 매칭');
  } else {
    lines.push('👥 ' + group.session);
  }
  
  lines.push('');
  lines.push('파트너:');
  
  // 멤버 목록
  group.members.forEach(m => {
    lines.push('  • ' + m.instagram + ' (🔥' + m.streak + ')');
  });
  
  lines.push('');
  lines.push('평균 연속일수: ' + group.avgStreak + '일');
  
  return lines.join('\n');
}


// ─────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────

/**
 * 그룹에서 코호트 추출 (방 풀 결정용)
 * @param {Object} group
 * @returns {string} 코호트명
 */
function extractCohortForGroup(group) {
  // Universal Pool은 @각자 방 사용
  if (group.type === 'UNIVERSAL') {
    return CONFIG.DEFAULT_COHORT;
  }
  
  // 코호트 세션이면 해당 코호트
  // 기본 세션이면 @각자
  if (group.cohort && group.cohort !== CONFIG.DEFAULT_COHORT) {
    return group.cohort;
  }
  
  return CONFIG.DEFAULT_COHORT;
}

/**
 * 방 URL에서 방 번호 추출 (디버깅용)
 * @param {string} url
 * @param {string[]} roomList
 * @returns {number} 1-based 인덱스
 */
function getRoomNumber(url, roomList) {
  const index = roomList.indexOf(url);
  return index >= 0 ? index + 1 : 0;
}


// ─────────────────────────────────────────────────────────
// 시트 적용 (GateManager에서 호출)
// ─────────────────────────────────────────────────────────

/**
 * Assignment 배열을 시트에 적용 (배치 처리)
 * 주의: 이 함수는 GateManager.gs의 applyAssignmentsToSheet에서 사용
 * 
 * @param {Sheet} sheet
 * @param {number} column
 * @param {Array} assignments
 */
function applyMeetAssignments(sheet, column, assignments) {
  // 배치 업데이트를 위한 데이터 준비
  const updates = assignments.map(a => ({
    row: a.row,
    formula: '=HYPERLINK("' + a.meetLink + '", "' + a.displayText + '")',
    bgColor: a.bgColor,
    textColor: a.textColor,
    note: a.note
  }));
  
  // 각 셀에 적용
  updates.forEach(u => {
    const cell = sheet.getRange(u.row, column);
    
    cell.setFormula(u.formula);
    cell.setBackground(u.bgColor);
    cell.setFontColor(u.textColor);
    cell.setFontWeight('bold');
    cell.setHorizontalAlignment('center');
    
    if (u.note) {
      cell.setNote(u.note);
    }
  });
}


// ─────────────────────────────────────────────────────────
// 그룹 경계선 표시 (선택적)
// ─────────────────────────────────────────────────────────

/**
 * 그룹 간 경계선 추가 (시각적 구분)
 * @param {Sheet} sheet
 * @param {number} column
 * @param {Array} groups
 */
function addGroupBorders(sheet, column, groups) {
  let currentRow = 2;  // 데이터 시작 행
  
  groups.forEach((group, index) => {
    if (index === 0) {
      currentRow += group.members.length;
      return;
    }
    
    // 그룹 첫 행 위에 두꺼운 테두리
    const startRow = currentRow;
    const numRows = group.members.length;
    
    const range = sheet.getRange(startRow, column, numRows, 1);
    range.setBorder(
      true, null, null, null,  // 위쪽만
      null, null,
      CONFIG.COLORS.GROUP_BORDER,
      SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );
    
    currentRow += numRows;
  });
}


// ─────────────────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────────────────

/**
 * Meet 배정 테스트
 */
function testMeetAssigner() {
  // 테스트 그룹 데이터
  const testGroups = [
    {
      members: [
        { row: 2, instagram: '@jinmo', streak: 76, session: '15:00 @sloth_idea' },
        { row: 3, instagram: '@ijaka', streak: 72, session: '15:00 @sloth_idea' }
      ],
      session: '15:00 @sloth_idea',
      cohort: '@sloth_idea',
      avgStreak: 74,
      type: 'COHORT'
    },
    {
      members: [
        { row: 4, instagram: '@user_a', streak: 50, session: '몰입 @각자' },
        { row: 5, instagram: '@user_b', streak: 45, session: '몰입 @각자' }
      ],
      session: '몰입 @각자',
      cohort: '@각자',
      avgStreak: 47,
      type: 'COHORT'
    },
    {
      members: [
        { row: 6, instagram: '@loner_1', streak: 10, session: '05:00 @session_pool', originSession: '05:00 @session_pool' },
        { row: 7, instagram: '@loner_2', streak: 100, session: '회복 @각자', originSession: '회복 @각자' }
      ],
      session: 'Universal Pool',
      cohort: '@각자',
      avgStreak: 55,
      type: 'UNIVERSAL'
    }
  ];
  
  const testLobbyUsers = [
    { row: 8, instagram: '@forever_alone', streak: 5, session: '21:00 @session_pool', originSession: '21:00 @session_pool' }
  ];
  
  Logger.log('=== Meet 배정 테스트 ===');
  
  const assignments = assignMeetRooms(testGroups, testLobbyUsers);
  
  Logger.log('배정 결과: ' + assignments.length + '개');
  
  assignments.forEach((a, i) => {
    Logger.log((i + 1) + '. Row ' + a.row + ' → ' + a.displayText + ' [' + a.type + ']');
    Logger.log('   Link: ' + a.meetLink);
  });
  
  return assignments;
}
