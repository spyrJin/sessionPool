/**
 * ============================================================
 * [Setup.gs]
 * 초기 설정: 시트 생성, 헤더, 트리거, 코호트 등록
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 메인 진입점 (시트 열 때)
// ─────────────────────────────────────────────────────────

/**
 * 시트 열 때 자동 실행
 */
function onOpen() {
  // 초기화 데이터 확인 및 로드 (복제된 시트용)
  loadInitialDataFromSheet();
  const ui = SpreadsheetApp.getUi();
  
  // 기본 메뉴 추가
  ui.createMenu('⚡ 세션풀')
    .addItem('🚀 내 세션 열기', 'showSidebar')
    .addItem('🔄 현재 상태 새로고침', 'refreshCurrentView')
    .addSeparator()
    .addItem('📋 내 정보', 'showMyInfo')
    .addToUi();
  
  // 관리자 메뉴 추가
  if (isAdmin()) {
    addAdminMenu();
  }
  
  // 현재 사용자 드롭다운 갱신
  setupCurrentUserDropdown();
  
  // HUD 및 현재 블록 강조
  updateHUD();
  highlightCurrentBlock();
}

/**
 * 현재 사용자 드롭다운 설정
 */
function setupCurrentUserDropdown() {
  try {
    const email = Session.getActiveUser().getEmail();
    const user = getUser(email);
    
    if (user) {
      applyDropdownToUser(user.row, user.cohorts);
    }
  } catch (e) {
    // 권한 없는 경우 무시
  }
}


// ─────────────────────────────────────────────────────────
// 초기 설정 위저드
// ─────────────────────────────────────────────────────────

/**
 * 세션풀 초기 설정 (최초 1회 실행)
 */
function initialSetup() {
  const ui = SpreadsheetApp.getUi();
  
  const confirm = ui.alert(
    '세션풀 초기 설정',
    '세션풀 시스템을 초기 설정하시겠습니까?\n\n' +
    '다음 작업이 수행됩니다:\n' +
    '• SessionPool 시트 생성\n' +
    '• 48개 시간 헤더 생성\n' +
    '• 트리거 설정\n' +
    '• 기본 코호트 등록',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (confirm !== ui.Button.OK) return;
  
  try {
    // 1. 시트 생성
    createMainSheet();
    
    // 2. 헤더 생성
    createTimeHeaders();
    
    // 3. 스타일 적용
    applySheetStyles();
    
    // 4. 기본 코호트 등록
    registerDefaultCohorts();
    
    // 5. 트리거 설정
    setupAllTriggers();
    
    // 6. onEdit 트리거 설치
    installOnEditTrigger();
    
    ui.alert('설정 완료', 
      '세션풀 초기 설정이 완료되었습니다!\n\n' +
      '다음 단계:\n' +
      '1. 사용자 등록 (관리자 메뉴)\n' +
      '2. 코호트 설정 (필요 시)\n' +
      '3. Meet 방 링크 설정 (Config.gs)',
      ui.ButtonSet.OK);
    
  } catch (error) {
    ui.alert('오류', '설정 중 오류가 발생했습니다:\n' + error.toString(), ui.ButtonSet.OK);
    systemLog('ERROR', '초기 설정 실패', { error: error.toString() });
  }
}


// ─────────────────────────────────────────────────────────
// 시트 생성
// ─────────────────────────────────────────────────────────

/**
 * 메인 시트 생성
 */
function createMainSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (sheet) {
    systemLog('SETUP', '기존 시트 존재', { name: CONFIG.SHEET_NAME });
    return sheet;
  }
  
  // 새 시트 생성
  sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  
  // 열 너비 설정
  sheet.setColumnWidth(1, 150);  // A열 (사용자명)
  for (let i = 2; i <= 49; i++) {
    sheet.setColumnWidth(i, 100);  // B~AW열 (시간 블록)
  }
  
  // 행 높이 설정
  sheet.setRowHeight(1, 50);  // 헤더
  
  // 1행 고정
  sheet.setFrozenRows(1);
  
  // A열 고정
  sheet.setFrozenColumns(1);
  
  systemLog('SETUP', '시트 생성 완료', { name: CONFIG.SHEET_NAME });
  
  return sheet;
}


// ─────────────────────────────────────────────────────────
// 헤더 생성
// ─────────────────────────────────────────────────────────

/**
 * 시간 헤더 생성 (1행)
 */
function createTimeHeaders() {
  const sheet = getMainSheet();
  const headers = generateTimeHeaders();
  
  // A1:AW1에 헤더 입력
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  
  // 헤더 스타일
  headerRange.setBackground(CONFIG.COLORS.HEADER_BG);
  headerRange.setFontColor(CONFIG.COLORS.HEADER_TEXT);
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  headerRange.setVerticalAlignment('middle');
  
  // A1 셀 특별 처리 (HUD)
  const a1Cell = sheet.getRange('A1');
  a1Cell.setValue('👤 사용자');
  a1Cell.setWrap(true);
  
  systemLog('SETUP', '헤더 생성 완료', { columns: headers.length });
}


// ─────────────────────────────────────────────────────────
// 스타일 적용
// ─────────────────────────────────────────────────────────

/**
 * 시트 기본 스타일 적용
 */
function applySheetStyles() {
  const sheet = getMainSheet();
  
  // 전체 폰트
  sheet.getRange('A:AW').setFontFamily('Google Sans');
  sheet.getRange('A:AW').setFontSize(10);
  
  // 데이터 영역 정렬
  sheet.getRange('A2:AW').setHorizontalAlignment('center');
  sheet.getRange('A2:AW').setVerticalAlignment('middle');
  
  // A열 (사용자명) 왼쪽 정렬
  sheet.getRange('A:A').setHorizontalAlignment('left');
  
  // 테두리
  const lastRow = Math.max(sheet.getLastRow(), 2);
  const dataRange = sheet.getRange(1, 1, lastRow, 49);
  dataRange.setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);
  
  systemLog('SETUP', '스타일 적용 완료');
}


// ─────────────────────────────────────────────────────────
// 기본 코호트 등록
// ─────────────────────────────────────────────────────────

/**
 * 기본 코호트 등록
 */
function registerDefaultCohorts() {
  const props = PropertiesService.getScriptProperties();
  
  // CONFIG의 코호트 정보를 Script Properties에 저장
  const cohorts = {};
  
  Object.keys(CONFIG.COHORTS).forEach(cohortName => {
    cohorts[cohortName] = CONFIG.COHORTS[cohortName];
  });
  
  props.setProperty('cohorts', JSON.stringify(cohorts));
  
  systemLog('SETUP', '기본 코호트 등록 완료', { count: Object.keys(cohorts).length });
}

/**
 * 새 코호트 등록
 * @param {Object} cohortData - { name, owner, ownerInstagram, rooms, sessions }
 */
function registerCohort(cohortData) {
  const props = PropertiesService.getScriptProperties();
  const cohorts = JSON.parse(props.getProperty('cohorts') || '{}');
  
  cohorts[cohortData.name] = {
    owner: cohortData.owner,
    ownerInstagram: cohortData.ownerInstagram,
    rooms: cohortData.rooms,
    sessions: cohortData.sessions || [],
    createdAt: new Date().toISOString()
  };
  
  props.setProperty('cohorts', JSON.stringify(cohorts));
  
  systemLog('SETUP', '코호트 등록', { name: cohortData.name });
}

/**
 * 코호트 등록 프롬프트 (관리자용)
 */
function promptRegisterCohort() {
  requireAdmin();
  const ui = SpreadsheetApp.getUi();
  
  // 코호트 이름
  const nameRes = ui.prompt('코호트 등록', '코호트 이름 (@포함):', ui.ButtonSet.OK_CANCEL);
  if (nameRes.getSelectedButton() !== ui.Button.OK) return;
  
  // 운영자 이메일
  const ownerRes = ui.prompt('코호트 등록', '운영자 이메일:', ui.ButtonSet.OK_CANCEL);
  if (ownerRes.getSelectedButton() !== ui.Button.OK) return;
  
  // 운영자 인스타
  const instaRes = ui.prompt('코호트 등록', '운영자 인스타그램 핸들:', ui.ButtonSet.OK_CANCEL);
  if (instaRes.getSelectedButton() !== ui.Button.OK) return;
  
  // 세션 시간
  const sessionsRes = ui.prompt('코호트 등록', '세션 시간 (쉼표 구분, 예: 05:00,21:00):', ui.ButtonSet.OK_CANCEL);
  if (sessionsRes.getSelectedButton() !== ui.Button.OK) return;
  
  // 방 링크 (3개)
  const roomsRes = ui.prompt('코호트 등록', 'Meet 방 링크 3개 (쉼표 구분):', ui.ButtonSet.OK_CANCEL);
  if (roomsRes.getSelectedButton() !== ui.Button.OK) return;
  
  const sessions = sessionsRes.getResponseText().split(',').map(s => s.trim()).filter(s => s);
  const rooms = roomsRes.getResponseText().split(',').map(r => r.trim()).filter(r => r);
  
  if (rooms.length < 3) {
    ui.alert('오류', 'Meet 방 링크를 3개 입력해주세요.', ui.ButtonSet.OK);
    return;
  }
  
  registerCohort({
    name: nameRes.getResponseText().trim(),
    owner: ownerRes.getResponseText().trim(),
    ownerInstagram: instaRes.getResponseText().trim(),
    sessions: sessions,
    rooms: rooms.slice(0, 3)
  });
  
  ui.alert('완료', '코호트가 등록되었습니다.', ui.ButtonSet.OK);
}


// ─────────────────────────────────────────────────────────
// 테스트 데이터 생성
// ─────────────────────────────────────────────────────────

/**
 * 테스트용 더미 사용자 생성
 */
function createTestUsers() {
  requireAdmin();
  const ui = SpreadsheetApp.getUi();
  
  const confirm = ui.alert('테스트 데이터',
    '테스트용 사용자 10명을 생성하시겠습니까?',
    ui.ButtonSet.YES_NO);
  
  if (confirm !== ui.Button.YES) return;
  
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
  
  // 연속일수 랜덤 설정
  const streaks = [76, 72, 72, 50, 45, 24, 10, 5, 2, 0];
  
  testUsers.forEach((userData, index) => {
    const user = registerUser(userData.email, userData.instagram, userData.cohorts);
    
    // 연속일수 직접 설정
    updateUser(userData.email, { streak: streaks[index] });
    updateUserLabel(userData.email);
  });
  
  ui.alert('완료', '테스트 사용자 ' + testUsers.length + '명이 생성되었습니다.', ui.ButtonSet.OK);
}

/**
 * 테스트용 세션 선택 시뮬레이션
 */
function simulateSessionSelection() {
  requireAdmin();
  const ui = SpreadsheetApp.getUi();
  
  const confirm = ui.alert('세션 선택 시뮬레이션',
    '현재 블록에 테스트 데이터를 입력하시겠습니까?',
    ui.ButtonSet.YES_NO);
  
  if (confirm !== ui.Button.YES) return;
  
  const sheet = getMainSheet();
  const currentCol = getCurrentBlockColumn();
  
  // 테스트 세션 데이터
  const testSessions = [
    '15:00 @sloth_idea',
    '15:00 @sloth_idea',
    '15:00 @sloth_idea',
    '15:00 @sloth_idea',
    '05:00 @session_pool',
    '몰입 @각자',
    '몰입 @각자',
    '몰입 @각자',
    '몰입 @각자',
    '회복 @각자'
  ];
  
  // 데이터 입력
  testSessions.forEach((session, index) => {
    sheet.getRange(index + 2, currentCol).setValue(session);
  });
  
  ui.alert('완료', 
    '테스트 데이터가 입력되었습니다.\n\n' +
    '열: ' + currentCol + ' (' + getTimeLabel(currentCol) + ')\n' +
    '데이터: ' + testSessions.length + '개\n\n' +
    '"강제 게이트 닫기"를 실행하여 매칭을 테스트하세요.',
    ui.ButtonSet.OK);
}


// ─────────────────────────────────────────────────────────
// 사용자 정보
// ─────────────────────────────────────────────────────────

/**
 * 내 정보 표시
 */
function showMyInfo() {
  const email = Session.getActiveUser().getEmail();
  const user = getUser(email);
  
  if (!user) {
    SpreadsheetApp.getUi().alert('내 정보', 
      '등록되지 않은 사용자입니다.\n\n이메일: ' + email + '\n\n관리자에게 문의하세요.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  const message = 
    '📧 이메일: ' + email + '\n' +
    '📱 인스타: ' + user.instagram + '\n' +
    '🔥 연속일수: ' + user.streak + '일\n' +
    '📍 행 번호: ' + user.row + '\n\n' +
    '🎯 참여 가능 코호트:\n  • ' + user.cohorts.join('\n  • ');
  
  SpreadsheetApp.getUi().alert('내 정보', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 현재 뷰 새로고침
 */
function refreshCurrentView() {
  updateHUD();
  highlightCurrentBlock();
  setupCurrentUserDropdown();
  
  SpreadsheetApp.getUi().alert('새로고침', '현재 상태가 업데이트되었습니다.', SpreadsheetApp.getUi().ButtonSet.OK);
}

// ─────────────────────────────────────────────────────────
// 🚨 긴급 사용자 등록 (수동 실행용)
// ─────────────────────────────────────────────────────────

/**
 * 관리자 본인(jinmo0303)을 강제 등록하는 함수
 * 실행 후 사이드바 새로고침 필요
 */
function quickRegisterJinmo() {
  const email = 'jinmo0303@gmail.com';
  const instagram = '@jinmo_yang'; // 원하시는 인스타 ID가 있다면 코드 수정 후 실행
  
  // 1. 사용자 등록 (모든 코호트 권한 부여)
  const user = registerUser(email, instagram, ['@각자', '@session_pool', '@sloth_idea']);
  
  if (user) {
    // 2. 테스트용 연속일수 설정 (77일)
    updateUser(email, { streak: 77 });
    updateUserLabel(email);
    
    Logger.log('✅ 사용자 등록 성공!');
    Logger.log('👉 이메일: ' + email);
    Logger.log('👉 인스타: ' + instagram);
    Logger.log('👉 행 번호: ' + user.row);
    Logger.log('🎉 이제 시트로 돌아가서 사이드바를 [새로고침] 하세요.');
  } else {
    Logger.log('❌ 등록 실패 (이미 존재하거나 오류 발생)');
  }
}

// ─────────────────────────────────────────────────────────
// 복제된 시트 초기화 (데이터 수혈)
// ─────────────────────────────────────────────────────────

/**
 * [DB_Users] 시트가 있으면 읽어서 Script Properties 초기화
 */
function loadInitialDataFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName('DB_Users');
  
  if (!dbSheet) return; // DB 시트 없으면 패스
  
  const data = dbSheet.getRange('A1').getValue();
  if (!data) return;
  
  try {
    const props = PropertiesService.getScriptProperties();
    // 이미 데이터가 있으면 덮어쓰지 않음 (최초 1회만)
    if (props.getProperty('users')) {
      // systemLog('SETUP', '이미 사용자 데이터 있음, 수혈 건너뜀');
      return;
    }
    
    const parsed = JSON.parse(data);
    props.setProperty('users', JSON.stringify(parsed));
    
    systemLog('SETUP', '사용자 데이터 수혈 완료', { count: Object.keys(parsed).length });
    
    // DB 시트 삭제 (보안상)
    ss.deleteSheet(dbSheet);
    
  } catch (e) {
    systemLog('ERROR', '데이터 수혈 실패', { error: e.toString() });
  }
}
