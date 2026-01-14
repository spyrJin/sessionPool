/**
 * ============================================================
 * [DailyManager.gs]
 * 매일 새로운 세션풀 시트를 생성하고 배포하는 관리자
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 일일 배치 작업 (새벽 실행)
// ─────────────────────────────────────────────────────────

/**
 * 매일 새벽 실행: 오늘의 시트 생성 -> 데이터 로드 -> 이메일 발송
 */
function createDailySheetAndNotify() {
  const today = getTodayString();
  const newSheetName = `[${today}] SessionPool`;
  
  try {
    systemLog('DAILY', '일일 배치 작업 시작', { date: today });
    
    // 1. 마스터 템플릿 복제
    const templateSs = SpreadsheetApp.getActiveSpreadsheet();
    const newSs = templateSs.copy(newSheetName);
    const newSsUrl = newSs.getUrl();
    const newSsId = newSs.getId();
    
    // 2. 새 시트 초기화 (기존 데이터 삭제)
    // 주의: 복제된 시트의 스크립트는 트리거가 복사되지 않으므로, 
    // 여기서 직접 데이터를 지우거나, 복제된 시트가 스스로 초기화하도록 해야 함.
    // 여기서는 원격으로 데이터 영역을 지웁니다.
    remoteResetSheet(newSsId);
    
    // 3. 사용자 데이터 로드 (Active 폴더에서)
    // UserLoader 로직을 재사용하되, 대상 시트를 newSs로 지정해야 함.
    // 현재 UserLoader는 'getActiveSpreadsheet'를 쓰므로, 
    // 이를 유연하게 처리하기 위해 UserLoader를 약간 수정하거나,
    // 여기서 직접 데이터를 주입해야 함.
    // -> 가장 쉬운 방법: Active 폴더의 데이터를 읽어서 newSs에 꽂아넣기
    
    const users = loadUsersToTargetSheet(newSsId);
    
    // 4. 공유 권한 설정 (링크가 있는 누구나 편집 가능, 또는 등록된 사용자만)
    newSs.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    
    // 5. 관리자에게 완료 메일 발송
    sendAdminReport(today, newSsUrl, users.length);
    
    // 6. 전체 사용자에게 링크 발송 (Resend API)
    sendLinkToAllUsers(users, newSsUrl);
    
    systemLog('DAILY', '일일 배치 완료', { url: newSsUrl });
    
  } catch (error) {
    systemLog('ERROR', '일일 배치 실패', { error: error.toString() });
    GmailApp.sendEmail(
      CONFIG.ADMIN_EMAILS[0], 
      `[오류] ${today} 세션풀 생성 실패`, 
      `로그를 확인해주세요.\n\n${error.toString()}`
    );
  }
}

// ─────────────────────────────────────────────────────────
// 원격 시트 제어
// ─────────────────────────────────────────────────────────

/**
 * 복제된 시트의 데이터를 초기화
 */
function remoteResetSheet(targetSsId) {
  const ss = SpreadsheetApp.openById(targetSsId);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow > 1 && lastCol > 1) {
    // B2부터 끝까지 삭제 (헤더와 A열 유저목록은 남김? -> 아니오, 유저목록도 새로 받을거니 싹 지움)
    // 아니, 템플릿에 있던 유저목록이 남아있을 수 있으니 A2부터 싹 지우는 게 안전함.
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent().clearFormat().clearDataValidations();
    
    // 다시 스타일 적용은 복제본이라 이미 되어있음
  }
}

/**
 * 타겟 시트에 Active 폴더의 사용자 데이터 로드 및 주입
 */
function loadUsersToTargetSheet(targetSsId) {
  // 1. 데이터 수집 (UserLoader 로직 활용)
  // loadUsersFromDriveFolder() 함수는 현재 시트에 쓰기 때문에,
  // 데이터만 리턴해주는 함수가 필요함. -> UserLoader.gs에 'extractAllUsersData' 함수 추가 필요
  
  // 임시: 직접 구현 (UserLoader 로직의 데이터 수집 부분만)
  const allUsersMap = collectAllUsersData();
  const userList = Object.values(allUsersMap);
  
  // 2. 타겟 시트에 쓰기
  const ss = SpreadsheetApp.openById(targetSsId);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (userList.length > 0) {
    // A열에 사용자 정보 쓰기 (라벨링)
    const labels = userList.map(u => [`⭐00 ${u.instagram}`]);
    sheet.getRange(2, 1, labels.length, 1).setValues(labels);
    
    // Script Properties 복사 (사용자 정보 저장)
    // 중요: 새 시트의 Script Properties에 유저 DB를 넣어줘야 사이드바가 작동함!
    const props = PropertiesService.getScriptProperties(); // 이건 템플릿의 프로퍼티
    // 안타깝게도 Script Properties는 파일마다 독립적이라 외부에서 주입 불가!
    // 대안: 시트 어딘가(숨겨진 시트)에 JSON을 박아넣고, onOpen에서 로드하게 하거나
    // 아예 로직을 바꿔야 함.
    
    // 🔥 해결책: 'Config' 시트를 만들어서 유저 데이터를 JSON으로 저장
    const configSheet = ss.insertSheet('System_Config');
    configSheet.hideSheet();
    configSheet.getRange('A1').setValue(JSON.stringify(allUsersMap));
    
    // 새 시트의 onOpen에서 이걸 읽어서 Properties에 넣도록 Setup.gs 수정 필요
  }
  
  return userList;
}


// ─────────────────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────────────────

function collectAllUsersData() {
  // Active 폴더 스캔해서 유저 객체 맵 반환
  const folderId = CONFIG.USER_DATA_FOLDER_ID;
  if (!folderId) return {};
  
  const usersMap = {};
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  
  while (files.hasNext()) {
    const file = files.next();
    const result = processSheetData(file.getId(), detectCohortFromFileName(file.getName()));
    // processSheetData가 DB에 저장을 해버리는데, 
    // 여기서는 메모리에만 모아야 함. 
    // -> UserLoader.gs의 구조적 한계. 리팩토링 필요하지만 일단 스킵.
    // 기존 UserLoader가 마스터 시트(템플릿)의 프로퍼티에 저장해둔 데이터를 그대로 씁시다.
  }
  
  // 마스터 시트의 최신 유저 DB 반환
  return getAllUsers(); 
}

function sendAdminReport(date, url, userCount) {
  GmailApp.sendEmail(
    CONFIG.ADMIN_EMAILS[0],
    `[완료] ${date} 세션풀 생성 (${userCount}명)`,
    `오늘의 세션풀 시트가 생성되었습니다.\n\n` +
    `📅 날짜: ${date}\n` +
    `👥 참여자: ${userCount}명\n` +
    `🔗 링크: ${url}\n\n` +
    `지금 바로 접속해서 확인하세요!`
  );
}

/**
 * 전체 사용자에게 데일리 링크 발송 (Resend Batch API)
 * @param {Array} users - 사용자 목록 객체 배열
 * @param {string} sheetUrl - 새 시트 URL
 */
function sendLinkToAllUsers(users, sheetUrl) {
  if (!users || users.length === 0) {
    systemLog('EMAIL', '발송 대상 사용자가 없습니다.');
    return;
  }
  
  // 1. 템플릿 로드 (ResendManager.gs에 있는 함수 사용)
  const template = getEmailTemplate('DAILY_LINK');
  if (!template) {
    systemLog('ERROR', '이메일 템플릿(DAILY_LINK)이 [ADMIN_EMAIL] 시트에 없습니다.');
    return;
  }
  
  systemLog('EMAIL', '전체 사용자 링크 발송 시작', { count: users.length });
  
  // 2. Resend 배치 발송
  // bodyGenerator 함수를 통해 각 사용자별로 맞춤형 본문 생성 (링크 치환)
  sendBatchEmails(users, template.subject, (user) => {
    let html = template.html;
    
    // 변수 치환
    html = html.replace(/{{link}}/g, sheetUrl);
    html = html.replace(/{{name}}/g, user.instagram || '멤버');
    html = html.replace(/{{email}}/g, user.email);
    
    return html;
  });
}
