/**
 * ============================================================
 * [Utils.gs]
 * 시간 계산, 포맷팅, 파싱 등 유틸리티 함수
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 시간 및 날짜 포맷팅
// ─────────────────────────────────────────────────────────

function padZero(num) {
  return num < 10 ? '0' + num : String(num);
}

function formatSeconds(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min + ':' + padZero(sec);
}

function getTodayString() {
  const now = new Date();
  return now.getFullYear() + '-' + padZero(now.getMonth() + 1) + '-' + padZero(now.getDate());
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + padZero(d.getMonth() + 1) + '-' + padZero(d.getDate());
}

/**
 * HTML 엔티티 이스케이프 (XSS 방지)
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// ─────────────────────────────────────────────────────────
// 시트 열(Column) 변환
// ─────────────────────────────────────────────────────────

function columnToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

function letterToColumn(letter) {
  let column = 0, length = letter.length;
  for (let i = 0; i < length; i++) {
    column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  return column;
}


// ─────────────────────────────────────────────────────────
// 시간 블록 계산 (핵심 로직)
// ─────────────────────────────────────────────────────────

/**
 * 현재 시간 기준 블록 정보 반환
 */
function getCurrentBlockInfo() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  const column = getBlockColumnForTime(hour, minute);
  
  // 현재 블록 내 경과 분 (0~29분)
  let currentMinuteInBlock = minute % 30;
  if (minute >= 30) currentMinuteInBlock = minute - 30;
  
  return {
    column: column,
    label: getTimeLabel(column),
    currentMinuteInBlock: currentMinuteInBlock
  };
}

/**
 * 특정 시각에 해당하는 시트 열 번호 반환
 * CONFIG.START_HOUR(05:00)부터 30분 단위
 * B열(2)부터 시작
 */
function getBlockColumnForTime(hour, minute) {
  // 시작 시간 이전(새벽)이면 마지막 블록으로 처리하거나 다음 날로 넘김
  // 여기서는 편의상 05:00 이전은 전날 밤샘으로 간주하지 않고, 
  // 그냥 05:00 전까지는 대기 상태로 처리 (하지만 열 번호는 계산)
  
  let totalMinutes = (hour * 60) + minute;
  const startMinutes = CONFIG.START_HOUR * 60;
  
  // 05:00 이전(00:00~04:59)은 24시간을 더해서 계산 (다음날 새벽까지 이어지는 경우 대비)
  if (hour < CONFIG.START_HOUR) {
    totalMinutes += 24 * 60;
  }
  
  const diffMinutes = totalMinutes - startMinutes;
  
  // 30분 단위 블록 수
  const blockIndex = Math.floor(diffMinutes / 30);
  
  // B열(2)부터 시작
  const column = 2 + blockIndex;
  
  // 유효 범위 체크 (2 ~ 2 + 48)
  if (column < 2) return 2;
  // 최대 열 제한 없음 (밤샘 세션 확장 가능성)
  
  return column;
}

/**
 * 현재 시간에 해당하는 열 번호 조회 (헤더 매칭 방식 X, 계산 방식 O)
 */
function getCurrentBlockColumn() {
  const now = new Date();
  const col = getBlockColumnForTime(now.getHours(), now.getMinutes());
  
  // 유효성 검사
  if (isNaN(col) || col < 2) return 2; // 기본값
  return col;
}

/**
 * 열 번호를 시간 라벨로 변환 (역계산)
 * 예: 2 -> "05:00", 3 -> "05:30"
 */
function getTimeLabel(column) {
  if (isNaN(column) || column < 2) return "05:00"; // 기본값

  const blockIndex = column - 2;
  const totalMinutes = (CONFIG.START_HOUR * 60) + (blockIndex * 30);
  
  let hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  
  // 24시 넘어가면 00시로 표기
  if (hour >= 24) hour -= 24;
  
  return padZero(hour) + ':' + padZero(minute);
}


// ─────────────────────────────────────────────────────────
// 게이트 상태 확인
// ─────────────────────────────────────────────────────────

/**
 * 현재 게이트 열림/닫힘 상태 반환
 */
function getGateStatus() {
  const now = new Date();
  const isOpen = isGateOpen(now);
  const info = getCurrentBlockInfo();
  
  let message = '';
  let displayTime = '';
  let type = '';
  
  // 5분 게이트 로직
  // 00-05분: 열림 (선택 가능)
  // 05-30분: 닫힘 (확실성 창)
  // 30-35분: 열림
  // 35-00분: 닫힘
  
  const minute = now.getMinutes();
  const second = now.getSeconds();
  
  const minInBlock = minute % 30; // 0~29
  
  if (minInBlock < 5) {
    // 열림 (남은 시간 카운트다운)
    const remainingSec = (5 * 60) - (minInBlock * 60 + second);
    message = CONFIG.MESSAGES.GATE_OPEN;
    displayTime = formatSeconds(remainingSec);
    type = 'OPEN';
  } else {
    // 닫힘 (다음 게이트까지 남은 시간)
    const remainingSec = (30 * 60) - (minInBlock * 60 + second);
    message = CONFIG.MESSAGES.GATE_CLOSED;
    displayTime = formatSeconds(remainingSec);
    type = 'CLOSED';
  }
  
  return {
    isOpen: isOpen,
    message: message,
    displayTime: displayTime,
    type: type,
    currentBlockLabel: info.label
  };
}

/**
 * 특정 시각에 게이트가 열려있는지 확인
 */
function isGateOpen(date) {
  if (!date) date = new Date();
  const minute = date.getMinutes();
  
  // 매 시 00~04분, 30~34분 열림
  return (minute >= 0 && minute < 5) || (minute >= 30 && minute < 35);
}


// ─────────────────────────────────────────────────────────
// 파싱 유틸리티
// ─────────────────────────────────────────────────────────

/**
 * 셀 라벨에서 Streak 추출 (🔥76 @user -> 76)
 */
function parseStreak(label) {
  if (!label) return 0;
  const match = label.match(/[🔥⭐](\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * 셀 라벨에서 인스타 핸들 추출 (🔥76 @user -> @user)
 */
function parseInstagram(label) {
  if (!label) return null;
  const match = label.match(/(@[\w_.]+)/);
  return match ? match[1] : null;
}

/**
 * 세션 값에서 코호트 이름 추출
 */
function extractCohortName(sessionValue) {
  if (!sessionValue) return CONFIG.DEFAULT_COHORT;
  
  // "15:00 @sloth_idea" -> "@sloth_idea"
  const match = sessionValue.match(/(@[\w_.]+)$/);
  return match ? match[1] : CONFIG.DEFAULT_COHORT;
}

/**
 * 세션 값에서 시간 추출
 */
function extractSessionTime(sessionValue) {
  if (!sessionValue) return null;
  
  // "15:00 @sloth_idea" -> "15:00"
  const match = sessionValue.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

/**
 * 몰입 세션인지 확인 (회복 등 제외)
 */
function isImmersionSession(sessionValue) {
  if (!sessionValue) return false;
  
  // '회복' 키워드가 있으면 몰입 아님
  if (sessionValue.includes('회복')) return false;
  
  // 그 외(시간 지정, '몰입')는 모두 몰입 세션
  return true;
}

/**
 * 회복 세션인지 확인
 */
function isRecoverySession(sessionValue) {
  return sessionValue && sessionValue.includes('회복');
}


// ─────────────────────────────────────────────────────────
// 시트 캐싱 (성능 최적화)
// ─────────────────────────────────────────────────────────

let _cachedMainSheet = null;
let _cachedSheetId = null;

// ─────────────────────────────────────────────────────────
// 시스템 로그 (간단 버전)
// ─────────────────────────────────────────────────────────

function systemLog(category, action, details) {
  const log = '[' + new Date().toISOString() + '] [' + category + '] ' + action;
  const detailStr = details ? ' | ' + JSON.stringify(details) : '';
  Logger.log(log + detailStr);
}

/**
 * 메인 시트 객체 반환 (원격 시트 지원 + 캐싱)
 * - activeSheetId가 설정되어 있으면 해당 스프레드시트의 시트 반환
 * - 없으면 현재 스프레드시트의 시트 반환
 * - 캐싱으로 성능 최적화
 */
function getMainSheet() {
  const activeSheetId = getActiveSheetId();

  // 캐시 히트 확인
  if (_cachedMainSheet && _cachedSheetId === activeSheetId) {
    return _cachedMainSheet;
  }

  let ss;
  if (activeSheetId) {
    // 원격 시트 열기 (마스터에서 오늘의 시트 제어)
    try {
      ss = SpreadsheetApp.openById(activeSheetId);
    } catch (e) {
      // 원격 시트 열기 실패 시 관리자 알림 + 에러 발생 (silent fallback 제거)
      systemLog('ERROR', '원격 시트 열기 실패', { activeSheetId: activeSheetId, error: e.toString() });

      // 관리자에게 긴급 알림
      try {
        GmailApp.sendEmail(
          CONFIG.ADMIN_EMAILS[0],
          '[긴급] SessionPool 활성 시트 접근 실패',
          `activeSheetId가 유효하지 않습니다.\nID: ${activeSheetId}\n\n마스터 시트에서 '마스터로 복귀'를 실행하세요.`
        );
      } catch (emailError) {
        systemLog('ERROR', '관리자 알림 이메일 발송 실패', { error: emailError.toString() });
      }

      throw new Error('원격 시트 접근 불가: ' + activeSheetId + '. 마스터에서 복구 필요.');
    }
  } else {
    // 기본: 현재 스프레드시트
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  // 캐시 저장
  _cachedMainSheet = sheet;
  _cachedSheetId = activeSheetId;

  return sheet;
}

/**
 * 메인 시트 캐시 무효화
 */
function invalidateMainSheetCache() {
  _cachedMainSheet = null;
  _cachedSheetId = null;
}

/**
 * 마스터 시트 객체 반환 (항상 현재 스프레드시트)
 *
 * 사용 시점:
 * - 사용자 등록/삭제 (마스터 DB에만 저장)
 * - 트리거 설정 (마스터에만 설치)
 * - 관리자 메뉴 작업
 *
 * 참고: getMainSheet()는 activeSheetId가 설정되면 원격 시트를 반환함.
 * 마스터 전용 작업에는 반드시 이 함수를 사용할 것.
 */
function getMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }
  return sheet;
}

// ─────────────────────────────────────────────────────────
// 초기 설정용 유틸리티
// ─────────────────────────────────────────────────────────

/**
 * 48개 시간 블록 헤더 생성 (05:00 ~ 04:30)
 * @returns {string[]} 시간 라벨 배열
 */
function generateTimeHeaders() {
  const headers = ['👤 사용자']; // A열 헤더
  
  const startHour = CONFIG.START_HOUR; // 5
  const totalBlocks = CONFIG.TOTAL_BLOCKS; // 48
  
  for (let i = 0; i < totalBlocks; i++) {
    const totalMinutes = (startHour * 60) + (i * 30);
    
    let hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    
    // 24시 넘어가면 00시로 표기 (24 -> 00, 25 -> 01)
    if (hour >= 24) hour -= 24;
    
    const label = padZero(hour) + ':' + padZero(minute);
    headers.push(label);
  }
  
  return headers;
}
