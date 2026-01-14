/**
 * ============================================================
 * [UserManager.gs]
 * 사용자 관리: 등록, 조회, 권한, 연속일수
 * 이메일은 Script Properties에만 저장 (시트에 노출 안 함)
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 캐싱 레이어 (성능 최적화)
// ─────────────────────────────────────────────────────────

/**
 * 스크립트 실행 중 사용자 데이터 캐시
 * GAS는 단일 스레드이므로 실행 중 캐시가 안전함
 */
let _usersCache = null;
let _usersCacheDirty = false;

/**
 * 캐시된 사용자 데이터 조회 (읽기 전용)
 * @returns {Object} { email: userData, ... }
 */
function _getCachedUsers() {
  if (_usersCache === null) {
    const props = PropertiesService.getScriptProperties();
    _usersCache = JSON.parse(props.getProperty('users') || '{}');
  }
  return _usersCache;
}

/**
 * 캐시된 사용자 데이터 조회 (수정 가능)
 * 수정 후 반드시 _saveUsersCache() 호출 필요
 * @returns {Object} { email: userData, ... }
 */
function _getCachedUsersForWrite() {
  if (_usersCache === null) {
    const props = PropertiesService.getScriptProperties();
    _usersCache = JSON.parse(props.getProperty('users') || '{}');
  }
  _usersCacheDirty = true;
  return _usersCache;
}

/**
 * 캐시된 사용자 데이터 저장
 */
function _saveUsersCache() {
  if (_usersCache !== null && _usersCacheDirty) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('users', JSON.stringify(_usersCache));
    _usersCacheDirty = false;
  }
}

/**
 * 캐시 무효화 (외부에서 데이터 변경 시)
 */
function invalidateUsersCache() {
  _usersCache = null;
  _usersCacheDirty = false;
}

// ─────────────────────────────────────────────────────────
// 사용자 조회
// ─────────────────────────────────────────────────────────

/**
 * 이메일로 사용자 정보 조회
 * @param {string} email
 * @returns {Object|null} 사용자 정보 또는 null
 */
function getUser(email) {
  const users = _getCachedUsers();
  return users[email] || null;
}

/**
 * 현재 접속자 정보 조회
 * @returns {Object|null}
 */
function getCurrentUser() {
  const email = Session.getActiveUser().getEmail();
  if (!email) return null;
  return getUser(email);
}

/**
 * 현재 접속자 이메일 조회
 * @returns {string}
 */
function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

/**
 * 인스타그램 핸들로 사용자 조회
 * @param {string} instagram
 * @returns {Object|null} { email, userData }
 */
function getUserByInstagram(instagram) {
  const users = _getCachedUsers();

  for (const email in users) {
    if (users[email].instagram === instagram) {
      return { email: email, ...users[email] };
    }
  }
  return null;
}

/**
 * 행 번호로 사용자 조회
 * @param {number} row
 * @returns {Object|null} { email, userData }
 */
function getUserByRow(row) {
  const users = _getCachedUsers();

  for (const email in users) {
    if (users[email].row === row) {
      return { email: email, ...users[email] };
    }
  }
  return null;
}

/**
 * 모든 사용자 목록 조회
 * @returns {Object} { email: userData, ... }
 */
function getAllUsers() {
  return _getCachedUsers();
}


// ─────────────────────────────────────────────────────────
// 사용자 등록/수정
// ─────────────────────────────────────────────────────────

/**
 * 신규 사용자 등록
 * @param {string} email - 이메일
 * @param {string} instagram - 인스타그램 핸들 (@포함)
 * @param {string[]} [cohorts] - 코호트 목록 (기본: ['@각자'])
 * @returns {Object} 등록된 사용자 정보
 */
function registerUser(email, instagram, cohorts) {
  const users = _getCachedUsersForWrite();

  // 이미 등록된 경우
  if (users[email]) {
    systemLog('USER', '이미 등록된 사용자', { email: email, instagram: instagram });
    return users[email];
  }

  // 인스타그램 핸들 정규화
  const normalizedInstagram = instagram.startsWith('@') ? instagram : '@' + instagram;

  // 새 행 번호 계산
  const sheet = getMainSheet();
  const newRow = sheet.getLastRow() + 1;

  // 사용자 데이터 생성
  users[email] = {
    instagram: normalizedInstagram,
    row: newRow,
    streak: 0,
    cohorts: cohorts || [CONFIG.DEFAULT_COHORT],
    lastParticipation: '',
    registeredAt: new Date().toISOString()
  };

  // Script Properties에 저장
  _saveUsersCache();

  // 시트에 이름표 추가 (이메일 제외, 인스타핸들만)
  const label = '⭐00 ' + normalizedInstagram;
  sheet.getRange(newRow, 1).setValue(label);

  // 드롭다운 설정
  applyDropdownToUser(newRow, users[email].cohorts);

  systemLog('USER', '신규 사용자 등록', {
    email: email,
    instagram: normalizedInstagram,
    row: newRow
  });

  return users[email];
}

/**
 * 사용자 정보 업데이트
 * @param {string} email
 * @param {Object} updates - 업데이트할 필드들
 */
function updateUser(email, updates) {
  const users = _getCachedUsersForWrite();

  if (!users[email]) {
    systemLog('USER', '업데이트 실패: 사용자 없음', { email: email });
    return null;
  }

  // 업데이트 적용
  Object.assign(users[email], updates);
  _saveUsersCache();

  systemLog('USER', '사용자 정보 업데이트', { email: email, updates: updates });

  return users[email];
}

/**
 * 사용자 삭제
 * @param {string} email
 * @returns {boolean} 성공 여부
 */
function deleteUser(email) {
  const users = _getCachedUsersForWrite();

  if (!users[email]) {
    systemLog('USER', '삭제 실패: 사용자 없음', { email: email });
    return false;
  }

  const user = users[email];
  const row = user.row;
  const instagram = user.instagram;

  // 1. Script Properties에서 제거
  delete users[email];

  // 2. 시트에서 행 삭제
  const sheet = getMainSheet();
  sheet.deleteRow(row);

  // 3. 다른 사용자들의 row 번호 조정
  Object.keys(users).forEach(e => {
    if (users[e].row > row) {
      users[e].row -= 1;
    }
  });

  _saveUsersCache();

  systemLog('USER', '사용자 삭제', { email: email, instagram: instagram, row: row });

  return true;
}


// ─────────────────────────────────────────────────────────
// 코호트 권한 관리
// ─────────────────────────────────────────────────────────

/**
 * 사용자에게 코호트 권한 부여
 * @param {string} email
 * @param {string} cohortName
 * @returns {boolean}
 */
function grantCohortAccess(email, cohortName) {
  const users = _getCachedUsersForWrite();

  if (!users[email]) {
    systemLog('AUTH', '권한 부여 실패: 사용자 없음', { email: email });
    return false;
  }

  if (users[email].cohorts.includes(cohortName)) {
    systemLog('AUTH', '이미 권한 있음', { email: email, cohort: cohortName });
    return true;
  }

  users[email].cohorts.push(cohortName);
  _saveUsersCache();

  // 드롭다운 갱신
  applyDropdownToUser(users[email].row, users[email].cohorts);

  systemLog('AUTH', '코호트 권한 부여', { email: email, cohort: cohortName });

  return true;
}

/**
 * 사용자에게서 코호트 권한 제거
 * @param {string} email
 * @param {string} cohortName
 * @returns {boolean}
 */
function revokeCohortAccess(email, cohortName) {
  const users = _getCachedUsersForWrite();

  if (!users[email]) return false;

  const index = users[email].cohorts.indexOf(cohortName);
  if (index === -1) return true;  // 이미 없음

  users[email].cohorts.splice(index, 1);
  _saveUsersCache();

  // 드롭다운 갱신
  applyDropdownToUser(users[email].row, users[email].cohorts);

  systemLog('AUTH', '코호트 권한 제거', { email: email, cohort: cohortName });

  return true;
}

/**
 * 사용자의 코호트 권한 확인
 * @param {string} email
 * @param {string} cohortName
 * @returns {boolean}
 */
function hasCohortAccess(email, cohortName) {
  const user = getUser(email);
  if (!user) return false;

  // @각자는 모든 사용자 허용
  if (cohortName === CONFIG.DEFAULT_COHORT) return true;

  return user.cohorts.includes(cohortName);
}

/**
 * 세션 선택에 대한 권한 검증
 * @param {string} email
 * @param {string} sessionValue - 예: "15:00 @sloth_idea"
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateSessionAccess(email, sessionValue) {
  const user = getUser(email);
  
  if (!user) {
    return { valid: false, reason: '등록되지 않은 사용자' };
  }
  
  const cohortName = extractCohortName(sessionValue);
  
  // @각자는 모든 사용자 허용
  if (cohortName === CONFIG.DEFAULT_COHORT) {
    return { valid: true };
  }
  
  // 사용자 코호트 목록에 있는지 확인
  if (!user.cohorts.includes(cohortName)) {
    return { valid: false, reason: cohortName + ' 코호트 권한 없음' };
  }
  
  return { valid: true };
}


// ─────────────────────────────────────────────────────────
// 드롭다운 관리
// ─────────────────────────────────────────────────────────

/**
 * 사용자 권한에 따른 드롭다운 옵션 생성
 * @param {string[]} userCohorts
 * @returns {string[]}
 */
function generateDropdownOptions(userCohorts) {
  const options = [];
  
  // 1. 기본 옵션 (모든 사용자)
  CONFIG.DEFAULT_SESSIONS.forEach(session => {
    options.push(session);
  });
  
  // 2. 코호트별 세션 옵션 (권한 있는 것만)
  userCohorts.forEach(cohortName => {
    if (cohortName === CONFIG.DEFAULT_COHORT) return;
    
    const cohort = getCohortConfig(cohortName);
    if (cohort && cohort.sessions) {
      cohort.sessions.forEach(sessionTime => {
        options.push(sessionTime + ' ' + cohortName);
      });
    }
  });
  
  return options;
}

/**
 * 특정 사용자 행에 드롭다운 적용
 * @param {number} row
 * @param {string[]} userCohorts
 */
function applyDropdownToUser(row, userCohorts) {
  const sheet = getMainSheet();
  const options = generateDropdownOptions(userCohorts);
  
  // 드롭다운 규칙 생성
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(false)
    .build();
  
  // B열부터 끝까지 (시간 블록 전체)
  const lastCol = sheet.getLastColumn();
  if (lastCol > 1) {
    const range = sheet.getRange(row, 2, 1, lastCol - 1);
    range.setDataValidation(rule);
  }
}

/**
 * 모든 사용자의 드롭다운 갱신
 */
function refreshAllDropdowns() {
  const users = getAllUsers();
  
  Object.keys(users).forEach(email => {
    const user = users[email];
    applyDropdownToUser(user.row, user.cohorts);
  });
  
  systemLog('USER', '전체 드롭다운 갱신 완료', { count: Object.keys(users).length });
}


// ─────────────────────────────────────────────────────────
// 연속일수 관리
// ─────────────────────────────────────────────────────────

/**
 * 세션 참여 기록 (연속일수 업데이트)
 * @param {string} email
 */
function recordParticipation(email) {
  const users = _getCachedUsersForWrite();

  if (!users[email]) return;

  const today = getTodayString();
  const lastDate = users[email].lastParticipation;

  // 이미 오늘 기록됨
  if (lastDate === today) {
    systemLog('STREAK', '오늘 이미 기록됨', { instagram: users[email].instagram });
    return;
  }

  const yesterday = getYesterdayString();

  // 연속일수 계산
  if (lastDate === yesterday) {
    // 연속 유지 → +1
    users[email].streak += 1;
    systemLog('STREAK', '연속 유지', {
      instagram: users[email].instagram,
      streak: users[email].streak
    });
  } else if (!lastDate) {
    // 첫 참여
    users[email].streak = 1;
    systemLog('STREAK', '첫 참여', { instagram: users[email].instagram });
  } else {
    // 연속 끊김 → 리셋
    users[email].streak = 1;
    systemLog('STREAK', '연속 리셋', { instagram: users[email].instagram });
  }

  // 마지막 참여일 업데이트
  users[email].lastParticipation = today;
  _saveUsersCache();

  // 시트 A열 이름표 업데이트
  updateUserLabel(email);
}

/**
 * 시트 A열 이름표 업데이트
 * @param {string} email
 */
function updateUserLabel(email) {
  const user = getUser(email);
  if (!user) return;
  
  const sheet = getMainSheet();
  const emoji = user.streak > 0 ? '🔥' : '⭐';
  const streak = padZero(user.streak);
  const label = emoji + streak + ' ' + user.instagram;
  
  sheet.getRange(user.row, 1).setValue(label);
}

/**
 * 모든 사용자 이름표 갱신 (배치 최적화)
 */
function refreshAllUserLabels() {
  const users = getAllUsers();
  const sheet = getMainSheet();
  const userList = Object.keys(users);

  if (userList.length === 0) return;

  // 라벨 데이터를 row → label 맵으로 생성
  const rowLabels = {};
  let minRow = Infinity;
  let maxRow = 0;

  userList.forEach(email => {
    const user = users[email];
    const emoji = user.streak > 0 ? '🔥' : '⭐';
    const streak = padZero(user.streak);
    const label = emoji + streak + ' ' + user.instagram;

    rowLabels[user.row] = label;
    minRow = Math.min(minRow, user.row);
    maxRow = Math.max(maxRow, user.row);
  });

  // 연속된 범위로 배치 업데이트 (빈 행 포함)
  if (maxRow >= minRow) {
    const numRows = maxRow - minRow + 1;
    const values = [];

    for (let row = minRow; row <= maxRow; row++) {
      values.push([rowLabels[row] || '']);
    }

    sheet.getRange(minRow, 1, numRows, 1).setValues(values);
  }

  systemLog('USER', '전체 이름표 갱신 완료', { count: userList.length });
}

/**
 * 연속일수 일일 체크 (자정에 실행)
 * 어제 참여하지 않은 사용자의 연속일수 리셋
 */
function dailyStreakCheck() {
  const users = _getCachedUsersForWrite();

  const yesterday = getYesterdayString();
  let resetCount = 0;

  Object.keys(users).forEach(email => {
    const user = users[email];

    // 어제 참여 안 했으면 리셋
    if (user.lastParticipation &&
        user.lastParticipation < yesterday &&
        user.streak > 0) {
      user.streak = 0;
      resetCount++;
      systemLog('STREAK', '연속 리셋', { instagram: user.instagram });
    }
  });

  if (resetCount > 0) {
    _saveUsersCache();
    refreshAllUserLabels();
    systemLog('DAILY', '연속일수 리셋 완료', { count: resetCount });
  }
}


// ─────────────────────────────────────────────────────────
// 행 동기화 (Row Reconciliation)
// ─────────────────────────────────────────────────────────

/**
 * 시트와 Script Properties 간 사용자 행 번호 동기화
 * 수동 편집이나 동시 삭제로 인한 불일치 해결
 * @returns {Object} { fixed: number, errors: string[] }
 */
function reconcileUserRows() {
  const users = _getCachedUsersForWrite();
  const sheet = getMainSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { fixed: 0, errors: [] };
  }

  // 1. 시트에서 모든 A열 라벨 읽기 (행 2부터)
  const labels = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  // 2. 시트 라벨에서 Instagram → Row 맵 생성
  const sheetUserRows = {};
  labels.forEach((row, index) => {
    const label = row[0];
    if (!label) return;

    const instagram = parseInstagram(label);
    if (instagram) {
      sheetUserRows[instagram] = index + 2; // 실제 행 번호 (헤더 제외)
    }
  });

  // 3. Script Properties의 사용자들과 비교 및 수정
  let fixedCount = 0;
  const errors = [];

  Object.keys(users).forEach(email => {
    const user = users[email];
    const instagram = user.instagram;

    if (!sheetUserRows[instagram]) {
      // 시트에 없는 사용자 - 오류 기록 (자동 삭제는 위험)
      errors.push(`${instagram}: 시트에 없음 (row ${user.row})`);
      return;
    }

    const actualRow = sheetUserRows[instagram];

    if (user.row !== actualRow) {
      // 행 번호 불일치 - 수정
      systemLog('RECONCILE', '행 번호 수정', {
        instagram: instagram,
        oldRow: user.row,
        newRow: actualRow
      });
      users[email].row = actualRow;
      fixedCount++;
    }
  });

  // 4. 수정된 내용 저장
  if (fixedCount > 0) {
    _saveUsersCache();
    systemLog('RECONCILE', '동기화 완료', { fixed: fixedCount });
  }

  return { fixed: fixedCount, errors: errors };
}

/**
 * 행 동기화 실행 (관리자용 UI)
 */
function runRowReconciliation() {
  const result = reconcileUserRows();

  let message = '✅ 행 동기화 완료\n\n';
  message += `수정된 항목: ${result.fixed}개\n`;

  if (result.errors.length > 0) {
    message += `\n⚠️ 문제 발견 (${result.errors.length}건):\n`;
    result.errors.forEach(e => {
      message += `  - ${e}\n`;
    });
  }

  SpreadsheetApp.getUi().alert('행 동기화', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 사용자 삭제 (안전한 버전 - 동기화 포함)
 * @param {string} email
 * @returns {boolean} 성공 여부
 */
function deleteUserSafe(email) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    // Lock 획득 후 캐시 무효화 (다른 실행에서 변경되었을 수 있음)
    invalidateUsersCache();
    const users = _getCachedUsersForWrite();

    if (!users[email]) {
      systemLog('USER', '삭제 실패: 사용자 없음', { email: email });
      return false;
    }

    const user = users[email];
    const row = user.row;
    const instagram = user.instagram;

    // 1. Script Properties에서 제거
    delete users[email];

    // 2. 시트에서 행 삭제
    const sheet = getMainSheet();
    sheet.deleteRow(row);

    // 3. 다른 사용자들의 row 번호 조정
    Object.keys(users).forEach(e => {
      if (users[e].row > row) {
        users[e].row -= 1;
      }
    });

    _saveUsersCache();

    systemLog('USER', '사용자 삭제 (안전)', { email: email, instagram: instagram, row: row });

    return true;

  } catch (error) {
    systemLog('ERROR', '사용자 삭제 오류', { email: email, error: error.toString() });
    return false;
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────
// 사이드바용 API
// ─────────────────────────────────────────────────────────

/**
 * 현재 사용자의 상태 정보 (사이드바용)
 * @returns {Object}
 */
function getMyStatus() {
  const email = getCurrentUserEmail();
  const user = getUser(email);
  
  if (!user) {
    return {
      registered: false,
      message: '등록되지 않은 사용자입니다.'
    };
  }
  
  // 현재 블록에서 Meet 링크 확인
  const currentColumn = getCurrentBlockColumn();
  const sheet = getMainSheet();
  const cellValue = sheet.getRange(user.row, currentColumn).getFormula();
  
  let meetLink = null;
  if (cellValue && cellValue.includes('HYPERLINK')) {
    // =HYPERLINK("url", "text") 형식에서 URL 추출
    const match = cellValue.match(/HYPERLINK\("([^"]+)"/);
    if (match) meetLink = match[1];
  }
  
  const gateStatus = getGateStatus();
  
  return {
    registered: true,
    instagram: user.instagram,
    streak: user.streak,
    row: user.row,
    cohorts: user.cohorts,
    meetLink: meetLink,
    gateStatus: gateStatus.isOpen ? 'open' : 'closed',
    gateMessage: gateStatus.message,
    remainingTime: gateStatus.displayTime
  };
}
