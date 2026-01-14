/**
 * ============================================================
 * [UI.gs]
 * UI 관련 기능: 사이드바, HUD, 시각적 피드백
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 사이드바
// ─────────────────────────────────────────────────────────

/**
 * 개인화 사이드바 표시
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('🚀 세션풀')
    .setWidth(300);
  
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 사이드바에서 호출: 현재 상태 조회
 * @returns {Object}
 */
function getSidebarData() {
  const email = Session.getActiveUser().getEmail();
  const user = getUser(email);
  const gateStatus = getGateStatus();
  const currentBlock = getCurrentBlockInfo();
  
  // 미등록 사용자
  if (!user) {
    return {
      registered: false,
      email: email,
      gateStatus: gateStatus,
      currentBlock: currentBlock
    };
  }
  
  // 현재 블록에서 Meet 링크 확인
  const sheet = getMainSheet();
  const cellValue = sheet.getRange(user.row, currentBlock.column).getValue();
  const cellFormula = sheet.getRange(user.row, currentBlock.column).getFormula();
  
  let meetLink = null;
  let sessionValue = cellValue;
  
  if (cellFormula && cellFormula.includes('HYPERLINK')) {
    // =HYPERLINK("url", "text") 형식에서 URL 추출
    const match = cellFormula.match(/HYPERLINK\("([^"]+)"/);
    if (match) meetLink = match[1];
    
    // 텍스트 추출
    const textMatch = cellFormula.match(/HYPERLINK\("[^"]+",\s*"([^"]+)"/);
    if (textMatch) sessionValue = textMatch[1];
  }
  
  // 파트너 정보 (같은 방 사용자)
  const partners = [];
  if (meetLink) {
    const lastRow = sheet.getLastRow();
    for (let row = 2; row <= lastRow; row++) {
      if (row === user.row) continue;
      
      const rowFormula = sheet.getRange(row, currentBlock.column).getFormula();
      if (rowFormula && rowFormula.includes(meetLink)) {
        const label = sheet.getRange(row, 1).getValue();
        partners.push(parseInstagram(label) || label);
      }
    }
  }
  
  return {
    registered: true,
    email: email,
    instagram: user.instagram,
    streak: user.streak,
    row: user.row,
    cohorts: user.cohorts,
    
    gateStatus: gateStatus,
    currentBlock: currentBlock,
    
    sessionValue: sessionValue,
    meetLink: meetLink,
    partners: partners,
    
    announcement: getAnnouncement()
  };
}


// ─────────────────────────────────────────────────────────
// 사이드바 액션
// ─────────────────────────────────────────────────────────

/**
 * 사이드바에서 세션 선택
 * @param {string} sessionValue
 * @returns {Object} { success, message }
 */
function selectSession(sessionValue) {
  const email = Session.getActiveUser().getEmail();
  const user = getUser(email);
  
  if (!user) {
    return { success: false, message: '등록되지 않은 사용자입니다.' };
  }
  
  // 권한 검증
  const validation = validateEditPermission(email, user.row, getCurrentBlockColumn(), sessionValue);
  if (!validation.allowed) {
    const messages = {
      'BANNED': '차단된 사용자입니다.',
      'GATE_CLOSED': '게이트가 닫혀있습니다.',
      'WRONG_COLUMN': '현재 블록이 아닙니다.',
      'NO_COHORT_ACCESS': '해당 코호트 권한이 없습니다.'
    };
    return { success: false, message: messages[validation.reason] || '선택할 수 없습니다.' };
  }
  
  // 시트에 값 입력
  const sheet = getMainSheet();
  const currentCol = getCurrentBlockColumn();
  sheet.getRange(user.row, currentCol).setValue(sessionValue);
  
  systemLog('UI', '세션 선택 (사이드바)', { user: user.instagram, session: sessionValue });
  
  return { success: true, message: '선택 완료!' };
}

/**
 * 사이드바에서 세션 옵션 조회
 * @returns {string[]}
 */
function getSessionOptions() {
  const email = Session.getActiveUser().getEmail();
  const user = getUser(email);
  
  if (!user) return [];
  
  return generateDropdownOptions(user.cohorts);
}


// ─────────────────────────────────────────────────────────
// HUD (Heads-Up Display)
// ─────────────────────────────────────────────────────────

/**
 * HUD 업데이트 (A1 셀)
 * 이 함수는 GateManager.gs에도 있지만, UI 목적으로 여기에도 배치
 */
function updateHUDDisplay() {
  const sheet = getMainSheet();
  const gateStatus = getGateStatus();
  const currentBlock = getCurrentBlockInfo();
  
  const a1Cell = sheet.getRange('A1');
  
  // 공지사항 확인
  const announcement = getAnnouncement();
  
  let displayText = '';
  
  if (announcement) {
    displayText = '📢 ' + announcement + '\n\n';
  }
  
  if (gateStatus.isOpen) {
    displayText += gateStatus.message + '\n';
    displayText += '⏱️ ' + gateStatus.displayTime + '\n';
    displayText += '👤 사용자';
    a1Cell.setBackground(CONFIG.COLORS.GATE_OPEN);
  } else {
    displayText += gateStatus.message + '\n';
    displayText += '⏱️ ' + gateStatus.displayTime + '\n';
    displayText += '👤 사용자';
    a1Cell.setBackground(CONFIG.COLORS.GATE_CLOSED);
  }
  
  a1Cell.setValue(displayText);
  a1Cell.setFontWeight('bold');
  a1Cell.setVerticalAlignment('middle');
  a1Cell.setHorizontalAlignment('center');
  a1Cell.setWrap(true);
}


// ─────────────────────────────────────────────────────────
// 시각적 피드백
// ─────────────────────────────────────────────────────────

/**
 * 성공 피드백 (셀 깜빡임 효과)
 * @param {number} row
 * @param {number} col
 */
function showSuccessFeedback(row, col) {
  const sheet = getMainSheet();
  const cell = sheet.getRange(row, col);
  const originalBg = cell.getBackground();
  
  // 초록색으로 잠시 변경
  cell.setBackground('#4CAF50');
  
  // 1초 후 원래 색상으로 복원
  Utilities.sleep(1000);
  cell.setBackground(originalBg);
}

/**
 * 에러 피드백 (셀 깜빡임 효과)
 * @param {number} row
 * @param {number} col
 */
function showErrorFeedback(row, col) {
  const sheet = getMainSheet();
  const cell = sheet.getRange(row, col);
  const originalBg = cell.getBackground();
  
  // 빨간색으로 잠시 변경
  cell.setBackground('#F44336');
  
  // 1초 후 원래 색상으로 복원
  Utilities.sleep(1000);
  cell.setBackground(originalBg);
}


// ─────────────────────────────────────────────────────────
// 사용자 행 찾기 도우미
// ─────────────────────────────────────────────────────────

/**
 * 내 행으로 이동
 */
function goToMyRow() {
  const email = Session.getActiveUser().getEmail();
  const user = getUser(email);
  
  if (!user) {
    SpreadsheetApp.getUi().alert('알림', '등록되지 않은 사용자입니다.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  const sheet = getMainSheet();
  const currentCol = getCurrentBlockColumn();
  
  // 내 행의 현재 블록 셀로 이동
  const cell = sheet.getRange(user.row, currentCol);
  sheet.setActiveRange(cell);
  
  // 셀 강조
  cell.setBackground('#FFF176');  // 밝은 노란색
  
  SpreadsheetApp.getActiveSpreadsheet().toast(
    user.instagram + ' (행 ' + user.row + ')',
    '📍 내 위치',
    3
  );
}


// ─────────────────────────────────────────────────────────
// 토스트 메시지
// ─────────────────────────────────────────────────────────

/**
 * 토스트 메시지 표시
 * @param {string} message
 * @param {string} [title]
 * @param {number} [seconds]
 */
function showToast(message, title, seconds) {
  SpreadsheetApp.getActiveSpreadsheet().toast(
    message,
    title || '세션풀',
    seconds || 3
  );
}


// ─────────────────────────────────────────────────────────
// 그룹 시각화
// ─────────────────────────────────────────────────────────

/**
 * 그룹 색상 번갈아 적용 (시각적 구분)
 * @param {Sheet} sheet
 * @param {number} column
 * @param {Array} groups
 */
function applyGroupColors(sheet, column, groups) {
  const colors = ['#E3F2FD', '#E8F5E9', '#FFF3E0', '#F3E5F5', '#E0F7FA'];
  let colorIndex = 0;
  
  groups.forEach(group => {
    const color = colors[colorIndex % colors.length];
    
    group.members.forEach(member => {
      sheet.getRange(member.row, column).setBackground(color);
    });
    
    colorIndex++;
  });
}


// ─────────────────────────────────────────────────────────
// 대화상자
// ─────────────────────────────────────────────────────────

/**
 * 확인 대화상자
 * @param {string} title
 * @param {string} message
 * @returns {boolean}
 */
function showConfirmDialog(title, message) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(title, message, ui.ButtonSet.YES_NO);
  return response === ui.Button.YES;
}

/**
 * 입력 대화상자
 * @param {string} title
 * @param {string} prompt
 * @returns {string|null}
 */
function showInputDialog(title, prompt) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(title, prompt, ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() === ui.Button.OK) {
    return response.getResponseText();
  }
  return null;
}


// ─────────────────────────────────────────────────────────
// 디버깅용 UI
// ─────────────────────────────────────────────────────────

/**
 * 디버그 정보 표시
 */
function showDebugInfo() {
  requireAdmin();
  
  const currentBlock = getCurrentBlockInfo();
  const gateStatus = getGateStatus();
  const triggerStatus = getTriggerStatus();
  
  const info = 
    '=== 디버그 정보 ===\n\n' +
    '현재 시간: ' + new Date().toLocaleString() + '\n\n' +
    '📍 현재 블록\n' +
    '  • 열: ' + currentBlock.column + '\n' +
    '  • 라벨: ' + currentBlock.label + '\n' +
    '  • 분: ' + currentBlock.currentMinuteInBlock + '\n\n' +
    '🚪 게이트\n' +
    '  • 상태: ' + (gateStatus.isOpen ? '열림' : '닫힘') + '\n' +
    '  • 타입: ' + gateStatus.type + '\n' +
    '  • 남은 시간: ' + gateStatus.displayTime + '\n\n' +
    '⏰ 트리거\n' +
    '  • 상태: ' + triggerStatus.status + '\n' +
    '  • 마지막 실행: ' + triggerStatus.lastExecution + '\n' +
    '  • 총 실행: ' + triggerStatus.triggerCount + '회';
  
  SpreadsheetApp.getUi().alert('디버그 정보', info, SpreadsheetApp.getUi().ButtonSet.OK);
}
