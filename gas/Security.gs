/**
 * ============================================================
 * [Security.gs]
 * 보안: 편집 검증, 권한 체크, 보안 로깅
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// onEdit 트리거 (편집 시 자동 실행)
// ─────────────────────────────────────────────────────────

/**
 * 셀 편집 시 자동 실행 (Installable Trigger로 설정 필요)
 * @param {Object} e - 이벤트 객체
 */
function onEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const sheetName = sheet.getName();
    
    // 세션풀 시트만 검증
    if (sheetName !== CONFIG.SHEET_NAME) return;
    
    const editedRow = range.getRow();
    const editedCol = range.getColumn();
    const newValue = e.value;
    const oldValue = e.oldValue;
    
    // 현재 사용자 정보
    const email = Session.getActiveUser().getEmail();
    
    // 1. 차단 사용자 체크
    if (isBanned(email)) {
      revertEdit(e);
      logSecurityEvent(email, 'BANNED_EDIT_ATTEMPT', editedRow, editedCol);
      showEditDeniedAlert('차단된 사용자입니다.');
      return;
    }
    
    // 2. 헤더 행 보호 (1행)
    if (editedRow === 1) {
      revertEdit(e);
      logSecurityEvent(email, 'HEADER_EDIT_ATTEMPT', editedRow, editedCol);
      showEditDeniedAlert('헤더 행은 편집할 수 없습니다.');
      return;
    }
    
    // 3. A열 보호 (사용자 이름)
    if (editedCol === 1) {
      revertEdit(e);
      logSecurityEvent(email, 'NAME_COL_EDIT_ATTEMPT', editedRow, editedCol);
      showEditDeniedAlert('사용자명 열은 편집할 수 없습니다.');
      return;
    }
    
    // 4. 본인 행 확인
    const user = getUser(email);
    
    if (!user) {
      // 미등록 사용자
      revertEdit(e);
      logSecurityEvent(email, 'UNREGISTERED_EDIT', editedRow, editedCol);
      showEditDeniedAlert('등록되지 않은 사용자입니다.\n관리자에게 문의하세요.');
      return;
    }
    
    if (editedRow !== user.row) {
      // 타인 행 편집 시도
      revertEdit(e);
      logSecurityEvent(email, 'OTHER_ROW_EDIT', editedRow, editedCol);
      showEditDeniedAlert('본인 행(' + user.row + '행)만 편집할 수 있습니다.\n시도한 행: ' + editedRow + '행');
      return;
    }
    
    // 5. 게이트 상태 확인
    if (!isGateOpen()) {
      revertEdit(e);
      logSecurityEvent(email, 'GATE_CLOSED_EDIT', editedRow, editedCol);
      showEditDeniedAlert('게이트가 닫혀있습니다.\n다음 게이트(00분 또는 30분)에 다시 시도해주세요.');
      return;
    }
    
    // 6. 현재 블록만 편집 가능
    const currentColumn = getCurrentBlockColumn();
    if (editedCol !== currentColumn) {
      revertEdit(e);
      logSecurityEvent(email, 'WRONG_COLUMN_EDIT', editedRow, editedCol);
      showEditDeniedAlert('현재 시간 블록(' + getTimeLabel(currentColumn) + ')만 편집할 수 있습니다.');
      return;
    }
    
    // 7. 코호트 권한 확인
    if (newValue) {
      const validation = validateSessionAccess(email, newValue);
      if (!validation.valid) {
        revertEdit(e);
        logSecurityEvent(email, 'COHORT_ACCESS_DENIED', editedRow, editedCol, { session: newValue });
        showEditDeniedAlert('권한 없음: ' + validation.reason);
        return;
      }
    }
    
    // 모든 검증 통과
    systemLog('EDIT', '편집 승인', {
      user: user.instagram,
      row: editedRow,
      col: editedCol,
      value: newValue
    });
    
  } catch (error) {
    systemLog('ERROR', 'onEdit 오류', { error: error.toString() });
  }
}


// ─────────────────────────────────────────────────────────
// 편집 되돌리기
// ─────────────────────────────────────────────────────────

/**
 * 편집 되돌리기
 * @param {Object} e - 이벤트 객체
 */
function revertEdit(e) {
  const range = e.range;
  
  if (e.oldValue !== undefined) {
    range.setValue(e.oldValue);
  } else {
    range.clearContent();
  }
}

/**
 * 편집 거부 알림 표시
 * @param {string} message
 */
function showEditDeniedAlert(message) {
  try {
    SpreadsheetApp.getUi().alert(
      '⚠️ 편집 불가',
      message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // UI 접근 불가 시 무시 (트리거에서 실행될 때)
  }
}


// ─────────────────────────────────────────────────────────
// 보안 로깅
// ─────────────────────────────────────────────────────────

/**
 * 보안 이벤트 로그 기록
 * @param {string} email
 * @param {string} eventType
 * @param {number} row
 * @param {number} col
 * @param {Object} [extra]
 */
function logSecurityEvent(email, eventType, row, col, extra) {
  const props = PropertiesService.getScriptProperties();
  const logs = JSON.parse(props.getProperty('security_logs') || '[]');
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    email: email,
    event: eventType,
    row: row,
    col: col
  };
  
  if (extra) {
    logEntry.extra = extra;
  }
  
  logs.push(logEntry);
  
  // 최근 100개만 유지
  while (logs.length > 100) {
    logs.shift();
  }
  
  props.setProperty('security_logs', JSON.stringify(logs));
  
  systemLog('SECURITY', eventType, { email: email, row: row, col: col });
}

/**
 * 보안 로그 조회
 * @param {number} [limit] - 조회할 개수 (기본: 전체)
 * @returns {Array}
 */
function getSecurityLogs(limit) {
  const props = PropertiesService.getScriptProperties();
  const logs = JSON.parse(props.getProperty('security_logs') || '[]');
  
  if (limit) {
    return logs.slice(-limit);
  }
  return logs;
}

/**
 * 보안 로그 보기 (관리자용)
 */
function viewSecurityLogs() {
  requireAdmin();
  
  const logs = getSecurityLogs(20);
  
  if (logs.length === 0) {
    SpreadsheetApp.getUi().alert('보안 로그', '기록된 보안 이벤트가 없습니다.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  let message = '최근 보안 이벤트 (' + logs.length + '개):\n\n';
  
  logs.reverse().forEach(log => {
    message += '[' + log.event + ']\n';
    message += '  시간: ' + log.timestamp + '\n';
    message += '  위치: Row ' + log.row + ', Col ' + log.col + '\n';
    if (log.extra) {
      message += '  상세: ' + JSON.stringify(log.extra) + '\n';
    }
    message += '\n';
  });
  
  SpreadsheetApp.getUi().alert('보안 로그', message, SpreadsheetApp.getUi().ButtonSet.OK);
}


// ─────────────────────────────────────────────────────────
// 보안 감사 (Audit)
// ─────────────────────────────────────────────────────────

/**
 * 시트에 이메일 노출 검사
 * @returns {Array} 노출된 이메일 목록
 */
function auditEmailExposure() {
  const sheet = getMainSheet();
  const data = sheet.getDataRange().getValues();
  
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const exposures = [];
  
  data.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) return;
      const value = String(cell);
      const matches = value.match(emailPattern);
      
      if (matches) {
        exposures.push({
          row: rowIndex + 1,
          col: colIndex + 1,
          email: matches[0]
        });
      }
    });
  });
  
  if (exposures.length > 0) {
    systemLog('SECURITY', '이메일 노출 감지', { count: exposures.length });
  }
  
  return exposures;
}

/**
 * 이메일 노출 검사 실행 (관리자용)
 */
function runEmailAudit() {
  requireAdmin();
  
  const exposures = auditEmailExposure();
  
  if (exposures.length === 0) {
    SpreadsheetApp.getUi().alert('보안 감사', '✅ 이메일 노출이 발견되지 않았습니다.', SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    let message = '⚠️ 이메일 노출 발견: ' + exposures.length + '건\n\n';
    exposures.forEach(e => {
      message += 'Row ' + e.row + ', Col ' + e.col + ': ' + e.email + '\n';
    });
    SpreadsheetApp.getUi().alert('보안 감사', message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}


// ─────────────────────────────────────────────────────────
// 권한 검증 헬퍼
// ─────────────────────────────────────────────────────────

/**
 * 편집 권한 종합 검증
 * @param {string} email
 * @param {number} row
 * @param {number} col
 * @param {string} value
 * @returns {Object} { allowed: boolean, reason: string }
 */
function validateEditPermission(email, row, col, value) {
  // 1. 차단 여부
  if (isBanned(email)) {
    return { allowed: false, reason: 'BANNED' };
  }
  
  // 2. 사용자 등록 여부
  const user = getUser(email);
  if (!user) {
    return { allowed: false, reason: 'UNREGISTERED' };
  }
  
  // 3. 본인 행 여부
  if (row !== user.row) {
    return { allowed: false, reason: 'NOT_YOUR_ROW' };
  }
  
  // 4. 게이트 상태
  if (!isGateOpen()) {
    return { allowed: false, reason: 'GATE_CLOSED' };
  }
  
  // 5. 현재 블록 여부
  const currentCol = getCurrentBlockColumn();
  if (col !== currentCol) {
    return { allowed: false, reason: 'WRONG_COLUMN' };
  }
  
  // 6. 코호트 권한
  if (value) {
    const validation = validateSessionAccess(email, value);
    if (!validation.valid) {
      return { allowed: false, reason: 'NO_COHORT_ACCESS' };
    }
  }
  
  return { allowed: true, reason: null };
}


// ─────────────────────────────────────────────────────────
// onEdit 트리거 설치 (최초 1회)
// ─────────────────────────────────────────────────────────

/**
 * onEdit Installable 트리거 설치
 * Simple 트리거로는 Session 정보 접근 불가하므로 Installable로 설치 필요
 */
function installOnEditTrigger() {
  // 기존 onEdit 트리거 제거
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 새 트리거 설치
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  
  systemLog('SETUP', 'onEdit 트리거 설치 완료');
  
  SpreadsheetApp.getUi().alert('완료', 'onEdit 트리거가 설치되었습니다.', SpreadsheetApp.getUi().ButtonSet.OK);
}
