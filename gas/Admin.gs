/**
 * ============================================================
 * [Admin.gs]
 * 관리자 전용 기능: 사용자 관리, 권한 제어, 시스템 초기화
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 관리자 권한 확인
// ─────────────────────────────────────────────────────────

function isAdmin(email) {
  if (!email) email = Session.getActiveUser().getEmail();
  return CONFIG.ADMIN_EMAILS.includes(email);
}

function requireAdmin() {
  const email = Session.getActiveUser().getEmail();
  if (!isAdmin(email)) {
    throw new Error('관리자 권한이 필요합니다.');
  }
}

function addAdminMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 관리자')
    .addItem('➕ 사용자 등록', 'promptRegisterUser')
    .addItem('🗑️ 사용자 삭제', 'promptDeleteUser')
    .addItem('🔄 행 동기화 (Row Sync)', 'runRowReconciliation')
    .addSeparator()
    .addItem('🏫 코호트 등록', 'promptRegisterCohort')
    .addItem('🔑 권한 관리', 'promptManageAccess')
    .addSeparator()
    .addItem('🛠️ 강제 게이트 닫기', 'forceGateClose')
    .addItem('🔓 강제 게이트 열기', 'forceGateOpen')
    .addItem('🧪 테스트 사용자 생성', 'createTestUsers')
    .addSeparator()
    .addItem('📧 이메일 템플릿 시트 생성', 'createEmailTemplateSheet')
    .addItem('🔐 보안 로그 보기', 'viewSecurityLogs')
    .addItem('🧹 데이터 초기화 (Reset)', 'resetSheetData')
    .addToUi();
}


// ─────────────────────────────────────────────────────────
// 사용자 관리 UI
// ─────────────────────────────────────────────────────────

function promptRegisterUser() {
  requireAdmin();
  const ui = SpreadsheetApp.getUi();
  
  const emailRes = ui.prompt('사용자 등록', '이메일 주소:', ui.ButtonSet.OK_CANCEL);
  if (emailRes.getSelectedButton() !== ui.Button.OK) return;
  
  const instaRes = ui.prompt('사용자 등록', '인스타그램 핸들 (@포함):', ui.ButtonSet.OK_CANCEL);
  if (instaRes.getSelectedButton() !== ui.Button.OK) return;
  
  const email = emailRes.getResponseText().trim();
  const instagram = instaRes.getResponseText().trim();
  
  if (!email || !instagram) {
    ui.alert('이메일과 인스타그램 핸들을 모두 입력해주세요.');
    return;
  }
  
  registerUser(email, instagram);
  ui.alert('등록 완료', instagram + ' (' + email + ') 등록되었습니다.', ui.ButtonSet.OK);
}

function promptDeleteUser() {
  requireAdmin();
  const ui = SpreadsheetApp.getUi();

  const emailRes = ui.prompt('사용자 삭제', '삭제할 사용자의 이메일:', ui.ButtonSet.OK_CANCEL);
  if (emailRes.getSelectedButton() !== ui.Button.OK) return;

  const email = emailRes.getResponseText().trim();

  // 안전한 삭제 함수 사용 (Lock 포함)
  if (deleteUserSafe(email)) {
    ui.alert('삭제 완료', email + ' 사용자가 삭제되었습니다.', ui.ButtonSet.OK);
  } else {
    ui.alert('삭제 실패', '사용자를 찾을 수 없습니다.', ui.ButtonSet.OK);
  }
}


// ─────────────────────────────────────────────────────────
// 데이터 초기화 (Reset)
// ─────────────────────────────────────────────────────────

/**
 * [관리자용] 시트 데이터 초기화
 */
function resetSheetData() {
  // UI 상호작용은 컨텍스트 확인 후 실행
  try {
    const ui = SpreadsheetApp.getUi();
    const confirm = ui.alert(
      '⚠️ 데이터 초기화 경고',
      '모든 세션 데이터가 삭제됩니다. 계속하시겠습니까?',
      ui.ButtonSet.YES_NO
    );
    if (confirm !== ui.Button.YES) return;
  } catch (e) {
    // 에디터 실행 시 UI 생략
    console.log('UI 생략: 에디터에서 실행됨');
  }
  
  const sheet = getMainSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow > 1 && lastCol > 1) {
    const dataRange = sheet.getRange(2, 2, lastRow - 1, lastCol - 1);
    dataRange.clearContent();
    dataRange.clearFormat();
    dataRange.clearNote();
    dataRange.clearDataValidations();
    
    // 보호 해제
    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(p => p.remove());
    
    // 스타일 복구
    applySheetStyles();
    refreshAllDropdowns();
  }
  
  console.log('시트 초기화 완료');
}


// ─────────────────────────────────────────────────────────
// 이메일 템플릿 관리 (ADMIN_EMAIL 시트)
// ─────────────────────────────────────────────────────────

/**
 * [ADMIN_EMAIL] 시트 생성 및 기본 템플릿 초기화
 * 에디터 실행 시 UI 에러 방지 처리됨
 */
function createEmailTemplateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = '[ADMIN_EMAIL]';
  
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    console.log('이미 [' + sheetName + '] 시트가 존재합니다.');
    return;
  }
  
  sheet = ss.insertSheet(sheetName);
  
  // 헤더 설정
  const headers = ['Key (수정금지)', '설명', '이메일 제목 (Subject)', 'HTML 본문 (Body)', '테스트 발송 (이메일 입력)'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 스타일
  sheet.getRange(1, 1, 1, headers.length).setBackground('#4285F4').setFontColor('white').setFontWeight('bold');
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 300);
  sheet.setColumnWidth(4, 500);
  sheet.setColumnWidth(5, 200);
  
  // 기본 템플릿 데이터
  const defaultData = [
    [
      'WELCOME_SLOTH', 
      'SessionPool 챌린지 신청자용 웰컴 레터', 
      '[SessionPool] 챌린지 참여 신청이 완료되었습니다 🦥', 
      '<div style="padding:20px;"><h1>환영합니다!</h1><p>매일 15:00에 만나요.</p></div>',
      'test@example.com'
    ],
    [
      'WELCOME_BASIC', 
      '일반 세션풀 신청자용 웰컴 레터', 
      '[SessionPool] 환영합니다! 몰입 세션 참여 안내', 
      '<div style="padding:20px;"><h2>세션풀에 오신 것을 환영합니다.</h2><p>링크: <a href="#">입장하기</a></p></div>',
      ''
    ]
  ];
  
  sheet.getRange(2, 1, defaultData.length, 5).setValues(defaultData);
  sheet.getRange('A:E').setVerticalAlignment('top').setWrap(true);
  
  console.log('이메일 관리 시트가 생성되었습니다.');
}
