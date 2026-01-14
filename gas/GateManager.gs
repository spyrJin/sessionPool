/**
 * ============================================================
 * [GateManager.gs]
 * 게이트 관리: 열림/닫힘 처리, 열 잠금/해제
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 게이트 열림 처리
// ─────────────────────────────────────────────────────────

/**
 * 게이트 열림 시 실행
 * @param {number} column - 시간 블록 열 번호
 */
function onGateOpen(column) {
  // 유효성 검사
  if (!column || isNaN(column) || column < 2) {
    column = getCurrentBlockColumn(); // 재시도
    if (!column || isNaN(column)) {
      systemLog('ERROR', '게이트 열림 실패: 유효하지 않은 열 번호', { column: column });
      return;
    }
  }

  systemLog('GATE', '게이트 열림', { column: column, time: getTimeLabel(column) });
  
  const sheet = getMainSheet();
  const lastRow = sheet.getLastRow();
  
  // 1. 해당 열 잠금 해제
  unlockColumn(column);
  
  // 2. 현재 열 강조 (노란색)
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, column, lastRow - 1, 1);
    dataRange.setBackground(CONFIG.COLORS.CURRENT_BLOCK);
  }
  
  // 3. 헤더 셀 강조
  sheet.getRange(1, column)
    .setBackground('#FFC107')  // 진한 노란색
    .setFontColor('#000000');
  
  // 4. HUD 업데이트
  updateHUD();
  
  systemLog('GATE', '게이트 열림 처리 완료', { column: column });
}


// ─────────────────────────────────────────────────────────
// 게이트 닫힘 처리 (핵심)
// ─────────────────────────────────────────────────────────

/**
 * 게이트 닫힘 시 실행 (핵심 처리)
 * 1. 데이터 수집
 * 2. 정렬 + 그룹화 (MatchingEngine)
 * 3. Meet 배정 (MeetAssigner)
 * 4. 시트 업데이트
 * 5. 열 잠금
 * 
 * @param {number} column - 시간 블록 열 번호
 */
function onGateClose(column) {
  // 유효성 검사
  if (!column || isNaN(column) || column < 2) {
    systemLog('ERROR', '게이트 닫힘 실패: 유효하지 않은 열 번호', { column: column });
    return;
  }

  // 동시 실행 방지를 위한 Lock
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(30000);  // 30초 대기
    
    systemLog('GATE', '게이트 닫힘 시작', { column: column, time: getTimeLabel(column) });
    
    const sheet = getMainSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      systemLog('GATE', '참여자 없음 (빈 시트)', { column: column });
      lockColumn(column);
      return;
    }
    
    // 1. 참여자 데이터 수집
    const participants = collectParticipants(sheet, column);
    
    if (participants.length === 0) {
      systemLog('GATE', '참여자 없음', { column: column });
      lockColumn(column);
      updateHUD();
      return;
    }
    
    systemLog('GATE', '참여자 수집 완료', { count: participants.length });
    
    // 2. 매칭 엔진 실행 (정렬 + 그룹화 + Universal Pool)
    const matchResult = runMatchingEngine(participants);
    
    systemLog('GATE', '매칭 완료', { 
      groups: matchResult.groups.length,
      lobby: matchResult.lobbyUsers.length
    });
    
    // 3. Meet 방 배정
    const assignments = assignMeetRooms(matchResult.groups, matchResult.lobbyUsers);
    
    // 4. 시트에 결과 쓰기
    applyAssignmentsToSheet(sheet, column, assignments);
    
    // 5. 시트 정렬 (세션 → 연속일수)
    sortSheetByColumn(sheet, column);
    
    // 6. 열 잠금
    lockColumn(column);
    
    // 7. 지나간 열 색상 변경
    markPastColumn(column);
    
    // 8. HUD 업데이트
    updateHUD();
    
    // 9. 참여자 연속일수 기록
    recordParticipantsStreak(participants);
    
    systemLog('GATE', '게이트 닫힘 처리 완료', { column: column });
    
  } catch (error) {
    systemLog('ERROR', '게이트 닫힘 오류', { 
      column: column, 
      error: error.toString() 
    });
  } finally {
    lock.releaseLock();
  }
}


// ─────────────────────────────────────────────────────────
// 데이터 수집
// ─────────────────────────────────────────────────────────

/**
 * 해당 열에서 세션 선택한 참여자 데이터 수집
 * @param {Sheet} sheet
 * @param {number} column
 * @returns {Array} 참여자 배열
 */
function collectParticipants(sheet, column) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  // A열 (사용자명) + 해당 열 데이터 읽기
  const userLabels = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const sessionValues = sheet.getRange(2, column, lastRow - 1, 1).getValues();
  const formulas = sheet.getRange(2, column, lastRow - 1, 1).getFormulas();
  
  const participants = [];
  
  for (let i = 0; i < userLabels.length; i++) {
    const label = userLabels[i][0];
    const session = sessionValues[i][0];
    const formula = formulas[i][0];
    
    // 빈 셀이거나 이미 처리된(HYPERLINK) 셀은 스킵
    if (!label || !session) continue;
    if (formula && formula.includes('HYPERLINK')) continue;
    
    // 라벨 파싱
    const streak = parseStreak(label);
    const instagram = parseInstagram(label);
    
    if (!instagram) continue;
    
    participants.push({
      row: i + 2,           // 실제 행 번호 (헤더 제외)
      label: label,
      instagram: instagram,
      streak: streak,
      session: String(session),
      cohort: extractCohortName(session)
    });
  }
  
  return participants;
}


// ─────────────────────────────────────────────────────────
// 시트 업데이트
// ─────────────────────────────────────────────────────────

/**
 * 배정 결과를 시트에 적용 (배치 최적화)
 * @param {Sheet} sheet
 * @param {number} column
 * @param {Array} assignments
 */
function applyAssignmentsToSheet(sheet, column, assignments) {
  if (assignments.length === 0) return;

  // 1. 모든 대상 셀의 A1 표기법 생성
  const cellNotations = assignments.map(a =>
    sheet.getRange(a.row, column).getA1Notation()
  );

  // 2. RangeList로 공통 작업 배치 처리
  const rangeList = sheet.getRangeList(cellNotations);

  // 공통 스타일 일괄 적용
  rangeList.clearDataValidations();
  rangeList.setNumberFormat('General');
  rangeList.setFontWeight('bold');
  rangeList.setHorizontalAlignment('center');

  // 3. 개별 값/색상 적용 (수식, 배경색, 글자색은 개별 처리 필요)
  // 배경색별로 그룹화하여 배치 처리
  const bgColorGroups = {};
  const textColorGroups = {};

  assignments.forEach((assignment, index) => {
    const notation = cellNotations[index];

    // 수식 적용 (개별)
    sheet.getRange(notation).setFormula(
      '=HYPERLINK("' + assignment.meetLink + '", "' + assignment.displayText + '")'
    );

    // 배경색 그룹화
    if (!bgColorGroups[assignment.bgColor]) {
      bgColorGroups[assignment.bgColor] = [];
    }
    bgColorGroups[assignment.bgColor].push(notation);

    // 글자색 그룹화
    if (!textColorGroups[assignment.textColor]) {
      textColorGroups[assignment.textColor] = [];
    }
    textColorGroups[assignment.textColor].push(notation);

    // 노트 추가 (개별)
    if (assignment.note) {
      sheet.getRange(notation).setNote(assignment.note);
    }
  });

  // 4. 배경색 배치 적용
  for (const bgColor in bgColorGroups) {
    sheet.getRangeList(bgColorGroups[bgColor]).setBackground(bgColor);
  }

  // 5. 글자색 배치 적용
  for (const textColor in textColorGroups) {
    sheet.getRangeList(textColorGroups[textColor]).setFontColor(textColor);
  }
}

/**
 * 시트 정렬 (해당 열 기준)
 * 1차: 세션명 (오름차순)
 * 2차: 연속일수 (내림차순, A열)
 */
function sortSheetByColumn(sheet, column) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= 1) return;
  
  // 데이터 범위 (헤더 제외)
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  
  // 정렬
  dataRange.sort([
    { column: column, ascending: true },   // 세션명 기준
    { column: 1, ascending: false }        // A열(연속일수) 기준 내림차순
  ]);
  
  systemLog('GATE', '시트 정렬 완료', { column: column });
}

/**
 * 참여자들의 연속일수 기록
 * @param {Array} participants
 */
function recordParticipantsStreak(participants) {
  if (participants.length === 0) return;

  const users = getAllUsers();

  // Instagram → Email 역방향 조회 맵 생성 (O(n) -> O(1) 조회)
  const instagramToEmail = {};
  for (const email in users) {
    instagramToEmail[users[email].instagram] = email;
  }

  // 참여자별 연속일수 기록 (O(1) 조회)
  participants.forEach(p => {
    const email = instagramToEmail[p.instagram];
    if (email) {
      recordParticipation(email);
    }
  });
}


// ─────────────────────────────────────────────────────────
// 열 잠금/해제
// ─────────────────────────────────────────────────────────

/**
 * 특정 열 잠금
 * @param {number} column
 */
function lockColumn(column) {
  const sheet = getMainSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return;
  
  const range = sheet.getRange(2, column, lastRow - 1, 1);
  
  // 기존 보호 제거
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  protections.forEach(p => {
    if (p.getDescription() === 'Lock-Col' + column) {
      p.remove();
    }
  });
  
  // 새 보호 설정 (경고만)
  const protection = range.protect();
  protection.setDescription('Lock-Col' + column);
  protection.setWarningOnly(true);
  
  systemLog('GATE', '열 잠금', { column: column });
}

/**
 * 특정 열 잠금 해제
 * @param {number} column
 */
function unlockColumn(column) {
  const sheet = getMainSheet();
  
  // 보호 제거
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  protections.forEach(p => {
    if (p.getDescription() === 'Lock-Col' + column) {
      p.remove();
    }
  });
  
  systemLog('GATE', '열 잠금 해제', { column: column });
}


// ─────────────────────────────────────────────────────────
// UI 업데이트
// ─────────────────────────────────────────────────────────

/**
 * 지나간 열 색상 변경
 * @param {number} currentColumn
 */
function markPastColumn(currentColumn) {
  const sheet = getMainSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return;
  
  // 이전 열들을 회색으로 변경
  for (let col = 2; col < currentColumn; col++) {
    const range = sheet.getRange(2, col, lastRow - 1, 1);
    
    // 이미 설정된 배경색은 유지 (하이퍼링크 셀)
    const values = range.getFormulas();
    for (let i = 0; i < values.length; i++) {
      if (!values[i][0].includes('HYPERLINK')) {
        sheet.getRange(i + 2, col).setBackground(CONFIG.COLORS.LOCKED);
      }
    }
  }
}

/**
 * 현재 시간 블록 강조
 */
function highlightCurrentBlock() {
  const sheet = getMainSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const currentColumn = getCurrentBlockColumn();
  
  if (lastRow <= 1 || lastCol <= 1) return;
  
  // 1. 헤더 초기화 후 현재 열 강조
  const headerRange = sheet.getRange(1, 2, 1, lastCol - 1);
  headerRange.setBackground(CONFIG.COLORS.HEADER_BG);
  headerRange.setFontColor(CONFIG.COLORS.HEADER_TEXT);
  
  // 현재 열 헤더 강조
  sheet.getRange(1, currentColumn)
    .setBackground('#FFC107')
    .setFontColor('#000000');
  
  // 2. 데이터 영역: 현재 열 강조
  if (isGateOpen()) {
    sheet.getRange(2, currentColumn, lastRow - 1, 1)
      .setBackground(CONFIG.COLORS.CURRENT_BLOCK);
  }
}

/**
 * HUD 업데이트 (A1 셀)
 */
function updateHUD() {
  const sheet = getMainSheet();
  const gateStatus = getGateStatus();
  
  const a1Cell = sheet.getRange('A1');
  
  if (gateStatus.isOpen) {
    a1Cell.setValue(gateStatus.message + '\n' + gateStatus.displayTime + ' 남음\n👤 사용자');
    a1Cell.setBackground(CONFIG.COLORS.GATE_OPEN);
  } else {
    a1Cell.setValue(gateStatus.message + '\n' + gateStatus.displayTime + ' 남음\n👤 사용자');
    a1Cell.setBackground(CONFIG.COLORS.GATE_CLOSED);
  }
  
  a1Cell.setFontWeight('bold');
  a1Cell.setVerticalAlignment('middle');
  a1Cell.setHorizontalAlignment('center');
}


// ─────────────────────────────────────────────────────────
// 강제 실행 (관리자용)
// ─────────────────────────────────────────────────────────

/**
 * 현재 열 강제 게이트 닫기
 */
function forceGateClose() {
  let column = getCurrentBlockColumn();
  
  // 열 번호 유효성 검사 및 보정
  if (!column || isNaN(column) || column < 2) {
    // 2번째 열(05:00)을 기본값으로 사용
    column = 2; 
    SpreadsheetApp.getActiveSpreadsheet().toast('열 번호를 찾을 수 없어 기본값(05:00)을 사용합니다.', '알림', 3);
  }
  
  onGateClose(column);
  
  SpreadsheetApp.getUi().alert(
    '강제 실행 완료',
    column + '열(' + getTimeLabel(column) + ') 게이트 닫힘 처리가 완료되었습니다.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * 현재 열 강제 게이트 열기
 */
function forceGateOpen() {
  let column = getCurrentBlockColumn();
  
  // 열 번호 유효성 검사 및 보정
  if (!column || isNaN(column) || column < 2) {
    // 2번째 열(05:00)을 기본값으로 사용
    column = 2;
    SpreadsheetApp.getActiveSpreadsheet().toast('열 번호를 찾을 수 없어 기본값(05:00)을 사용합니다.', '알림', 3);
  }

  onGateOpen(column);
  
  SpreadsheetApp.getUi().alert(
    '강제 실행 완료',
    column + '열(' + getTimeLabel(column) + ') 게이트 열림 처리가 완료되었습니다.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * 특정 열 강제 처리 (관리자용)
 * @param {number} column
 */
function forceProcessColumn(column) {
  if (!column) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
      '열 번호 입력',
      '처리할 열 번호를 입력하세요 (B열=2):',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (response.getSelectedButton() !== ui.Button.OK) return;
    column = parseInt(response.getResponseText());
  }
  
  if (isNaN(column) || column < 2) {
    SpreadsheetApp.getUi().alert('유효하지 않은 열 번호입니다.');
    return;
  }
  
  onGateClose(column);
  
  SpreadsheetApp.getUi().alert(
    '처리 완료',
    column + '열 처리가 완료되었습니다.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
