/**
 * ============================================================
 * [Triggers.gs]
 * 시간 기반 자동화 트리거 관리
 * 
 * 트리거 종류:
 * 1. 5분 타이머: 게이트 열림/닫힘 처리
 * 2. 자정 타이머: 연속일수 리셋 체크
 * 3. 아침 타이머: 이름표 갱신
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 메인 트리거 함수 (5분마다 실행)
// ─────────────────────────────────────────────────────────

/**
 * 5분마다 실행되는 메인 트리거
 * GAS 트리거에서 이 함수를 5분 간격으로 설정
 */
function onTimeTrigger() {
  const now = new Date();
  const minute = now.getMinutes();
  const currentColumn = getCurrentBlockColumn();
  
  systemLog('TRIGGER', '실행', { 
    time: Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss'),
    column: currentColumn,
    minute: minute
  });
  
  try {
    // 게이트 열림 시점 (00분, 30분)
    if (minute === 0 || minute === 30) {
      onGateOpen(currentColumn);
    }
    
    // 게이트 닫힘 시점 (05분, 35분)
    if (minute === 5 || minute === 35) {
      onGateClose(currentColumn);
    }
    
    // HUD 및 현재 블록 강조 업데이트 (항상)
    updateHUD();
    highlightCurrentBlock();
    
    // 트리거 실행 기록
    recordTriggerExecution(now);
    
  } catch (error) {
    systemLog('ERROR', '트리거 오류', { error: error.toString() });
  }
}


// ─────────────────────────────────────────────────────────
// 일일 트리거 (자정)
// ─────────────────────────────────────────────────────────

/**
 * 매일 자정에 실행
 * - 연속일수 리셋 체크
 * - 시트 초기화 (전날 데이터 정리)
 */
function onDailyMidnight() {
  systemLog('DAILY', '자정 트리거 시작');
  
  try {
    // 1. 연속일수 리셋 체크
    dailyStreakCheck();
    
    // 2. 시트 초기화 (선택: 전날 데이터 아카이브)
    // archiveYesterdayData();
    
    // 3. 시트 데이터 영역 클리어 (헤더 제외)
    clearDailyData();
    
    systemLog('DAILY', '자정 트리거 완료');
    
  } catch (error) {
    systemLog('ERROR', '자정 트리거 오류', { error: error.toString() });
  }
}

/**
 * 매일 아침 (예: 04:30) 실행
 * - 이름표 갱신
 * - 시트 준비
 */
function onDailyMorning() {
  systemLog('DAILY', '아침 트리거 시작');
  
  try {
    // 1. 모든 사용자 이름표 갱신
    refreshAllUserLabels();
    
    // 2. 모든 드롭다운 갱신
    refreshAllDropdowns();
    
    // 3. HUD 초기화
    updateHUD();
    
    systemLog('DAILY', '아침 트리거 완료');
    
  } catch (error) {
    systemLog('ERROR', '아침 트리거 오류', { error: error.toString() });
  }
}


// ─────────────────────────────────────────────────────────
// 시트 초기화
// ─────────────────────────────────────────────────────────

/**
 * 일일 데이터 클리어 (B열 이후 데이터만)
 */
function clearDailyData() {
  const sheet = getMainSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= 1 || lastCol <= 1) return;
  
  // B열부터 마지막 열까지 데이터 영역 클리어
  const dataRange = sheet.getRange(2, 2, lastRow - 1, lastCol - 1);
  
  // 값, 수식, 서식 클리어
  dataRange.clearContent();
  dataRange.clearNote();
  dataRange.setBackground('#FFFFFF');
  dataRange.setFontColor('#000000');
  dataRange.setFontWeight('normal');
  
  // 보호 해제
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  protections.forEach(p => {
    if (p.getDescription().startsWith('Lock-Col')) {
      p.remove();
    }
  });
  
  systemLog('DAILY', '데이터 클리어 완료');
}


// ─────────────────────────────────────────────────────────
// 트리거 설정/관리
// ─────────────────────────────────────────────────────────

/**
 * 모든 트리거 초기 설정 (관리자용 - 최초 1회 실행)
 */
function setupAllTriggers() {
  const ui = SpreadsheetApp.getUi();
  
  // 기존 트리거 모두 제거
  removeAllTriggers();
  
  // 1. 5분 타이머 트리거
  ScriptApp.newTrigger('onTimeTrigger')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  // 2. 자정 트리거 (매일 00:00~01:00)
  ScriptApp.newTrigger('onDailyMidnight')
    .timeBased()
    .atHour(0)
    .everyDays(1)
    .create();
  
  // 3. 아침 트리거 (매일 04:30)
  ScriptApp.newTrigger('onDailyMorning')
    .timeBased()
    .atHour(4)
    .nearMinute(30)
    .everyDays(1)
    .create();
  
  systemLog('SETUP', '트리거 설정 완료');
  
  ui.alert(
    '트리거 설정 완료',
    '다음 트리거가 설정되었습니다:\n\n' +
    '• 5분마다: 게이트 열림/닫힘 처리\n' +
    '• 매일 00:00: 연속일수 리셋 체크\n' +
    '• 매일 04:30: 이름표/드롭다운 갱신',
    ui.ButtonSet.OK
  );
}

/**
 * 모든 트리거 제거
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  
  systemLog('SETUP', '기존 트리거 모두 제거', { count: triggers.length });
}

/**
 * 현재 트리거 목록 조회
 */
function listAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  
  Logger.log('=== 현재 트리거 목록 ===');
  triggers.forEach((trigger, i) => {
    Logger.log((i + 1) + '. ' + trigger.getHandlerFunction() + 
      ' [' + trigger.getEventType() + ']');
  });
  
  return triggers.length;
}


// ─────────────────────────────────────────────────────────
// 트리거 모니터링
// ─────────────────────────────────────────────────────────

/**
 * 트리거 실행 기록
 * @param {Date} executionTime
 */
function recordTriggerExecution(executionTime) {
  const props = PropertiesService.getScriptProperties();
  
  props.setProperty('lastTriggerExecution', executionTime.toISOString());
  
  // 실행 횟수 카운트
  const count = parseInt(props.getProperty('triggerExecutionCount') || '0');
  props.setProperty('triggerExecutionCount', String(count + 1));
}

/**
 * 마지막 트리거 실행 시간 조회
 * @returns {Date|null}
 */
function getLastTriggerExecution() {
  const props = PropertiesService.getScriptProperties();
  const lastExec = props.getProperty('lastTriggerExecution');
  
  return lastExec ? new Date(lastExec) : null;
}

/**
 * 트리거 상태 확인
 * @returns {Object}
 */
function getTriggerStatus() {
  const lastExec = getLastTriggerExecution();
  const now = new Date();
  
  let status = 'UNKNOWN';
  let minutesSinceLastExec = null;
  
  if (lastExec) {
    minutesSinceLastExec = Math.floor((now - lastExec) / 1000 / 60);
    
    if (minutesSinceLastExec <= 6) {
      status = 'HEALTHY';
    } else if (minutesSinceLastExec <= 15) {
      status = 'DELAYED';
    } else {
      status = 'FAILED';
    }
  }
  
  return {
    status: status,
    lastExecution: lastExec ? lastExec.toISOString() : null,
    minutesSinceLastExec: minutesSinceLastExec,
    triggerCount: parseInt(PropertiesService.getScriptProperties().getProperty('triggerExecutionCount') || '0')
  };
}

/**
 * 트리거 상태 체크 및 알림 (관리자용)
 */
function checkTriggerHealth() {
  const status = getTriggerStatus();
  
  if (status.status === 'FAILED') {
    // 트리거 실패 감지 시 알림 (이메일 등)
    systemLog('ALERT', '트리거 실패 감지', status);
    
    // 선택: 관리자에게 이메일 발송
    // sendTriggerAlert(status);
  }
  
  return status;
}


// ─────────────────────────────────────────────────────────
// 수동 실행 함수 (테스트/디버깅용)
// ─────────────────────────────────────────────────────────

/**
 * 현재 시간 기준 트리거 수동 실행
 */
function manualTriggerExecution() {
  systemLog('MANUAL', '수동 트리거 실행');
  onTimeTrigger();
}

/**
 * 특정 시간대 시뮬레이션 (테스트용)
 * @param {number} hour
 * @param {number} minute
 */
function simulateTrigger(hour, minute) {
  // 주의: 실제 트리거처럼 동작하지만, 현재 열이 아닌 지정 시간의 열을 처리
  const column = getBlockColumnForTime(hour, minute);
  
  Logger.log('=== 시뮬레이션 ===');
  Logger.log('시간: ' + padZero(hour) + ':' + padZero(minute));
  Logger.log('열: ' + column);
  
  if (minute === 0 || minute === 30) {
    Logger.log('→ 게이트 열림 처리');
    onGateOpen(column);
  } else if (minute === 5 || minute === 35) {
    Logger.log('→ 게이트 닫힘 처리');
    onGateClose(column);
  } else {
    Logger.log('→ 처리 없음 (게이트 시간 아님)');
  }
}
