/**
 * ============================================================
 * [UserLoader.gs]
 * 구글 폼 응답 시트를 분석하여 조건부 사용자 등록 및 메일 발송
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 메인 로더 함수
// ─────────────────────────────────────────────────────────

function loadUsersFromDriveFolder() {
  const folderId = CONFIG.USER_DATA_FOLDER_ID;
  if (!folderId) return;
  
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
    
    let stats = { newUsers: 0, updatedUsers: 0, skipped: 0 };
    
    systemLog('LOADER', '폴더 스캔 시작', { folderId: folderId });
    
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      
      const baseCohort = detectCohortFromFileName(fileName);
      const result = processSheetData(file.getId(), baseCohort);
      
      stats.newUsers += result.newUsers;
      stats.updatedUsers += result.updatedUsers;
    }
    
    refreshAllDropdowns();
    
    systemLog('LOADER', '로딩 완료', stats);
    return stats;
    
  } catch (error) {
    systemLog('ERROR', '사용자 로드 실패', { error: error.toString() });
  }
}


// ─────────────────────────────────────────────────────────
// 데이터 처리 로직 (조건부 필터링 포함)
// ─────────────────────────────────────────────────────────

function processSheetData(sheetId, baseCohort) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= 1) return { newUsers: 0, updatedUsers: 0 };
  
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const header = values[0];
  
  const colIdx = findSmartColumnIndexes(header);
  
  if (colIdx.email === -1) return { newUsers: 0, updatedUsers: 0 };
  
  let newCount = 0;
  let updateCount = 0;
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const email = String(row[colIdx.email]).trim();
    let name = colIdx.name > -1 ? String(row[colIdx.name]).trim() : '';
    
    let instagram = colIdx.instagram > -1 ? String(row[colIdx.instagram]).trim() : '';
    if (!instagram) instagram = name || email.split('@')[0];
    if (!instagram.startsWith('@')) instagram = '@' + instagram;
    
    if (!email) continue;
    
    let cohortsToAdd = [];
    
    if (baseCohort) cohortsToAdd.push(baseCohort);
    
    if (colIdx.slothChallenge > -1) {
      const answer = String(row[colIdx.slothChallenge]);
      if (answer.startsWith('네') || answer.includes('Yes')) {
        cohortsToAdd.push('@sloth_time');
      }
    }
    
    if (cohortsToAdd.length === 0) continue;
    
    const result = registerOrUpdateUser(email, instagram, cohortsToAdd);
    
    if (result.isNew) {
      newCount++;
      sendWelcomeEmail(email, instagram, cohortsToAdd);
    } else {
      updateCount++;
    }
  }
  
  return { newUsers: newCount, updatedUsers: updateCount };
}


// ─────────────────────────────────────────────────────────
// 스마트 컬럼 감지
// ─────────────────────────────────────────────────────────

function findSmartColumnIndexes(headerRow) {
  const idx = { 
    email: -1, 
    instagram: -1, 
    name: -1,
    slothChallenge: -1, 
    newsletter: -1      
  };
  
  headerRow.forEach((col, i) => {
    const text = String(col).toLowerCase().replace(/\s/g, '');
    
    if (text.includes('email') || text.includes('이메일')) idx.email = i;
    else if (text.includes('instagram') || text.includes('인스타')) idx.instagram = i;
    else if (text.includes('이름') || text.includes('name')) idx.name = i;
    
    else if (text.includes('챌린지') && (text.includes('sloth') || text.includes('슬로'))) idx.slothChallenge = i;
    else if (text.includes('뉴스레터')) idx.newsletter = i;
  });
  
  return idx;
}


// ─────────────────────────────────────────────────────────
// 사용자 등록/업데이트
// ─────────────────────────────────────────────────────────

function registerOrUpdateUser(email, instagram, cohorts) {
  const existingUser = getUser(email);
  
  if (existingUser) {
    let changed = false;
    cohorts.forEach(c => {
      if (!existingUser.cohorts.includes(c)) {
        grantCohortAccess(email, c);
        changed = true;
      }
    });
    return { isNew: false, updated: changed };
  } else {
    registerUser(email, instagram, cohorts);
    return { isNew: true, updated: false };
  }
}

function detectCohortFromFileName(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('sessionpool') || lower.includes('세션풀')) return '@session_pool';
  return null;
}


// ─────────────────────────────────────────────────────────
// 📧 이메일 발송 (Resend API + 템플릿)
// ─────────────────────────────────────────────────────────

function sendWelcomeEmail(email, instagram, cohorts) {
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  
  // 1. 템플릿 키 결정
  const templateKey = cohorts.includes("@sloth_time") ? "WELCOME_SLOTH" : "WELCOME_BASIC";
  
  // 2. 시트에서 템플릿 로드 (ResendManager.gs 함수 사용)
  let template = null;
  try {
    template = getEmailTemplate(templateKey);
  } catch (e) {
    // getEmailTemplate이 없거나 실패할 경우 무시
  }
  
  let subject = "";
  let htmlBody = "";
  
  if (template) {
    // 시트 템플릿 사용 (변수 치환)
    subject = template.subject;
    // 변수 치환: ${instagram}, ${sheetUrl}
    htmlBody = template.html
      .replace(/\$\{instagram\}/g, instagram)
      .replace(/\$\{sheetUrl\}/g, sheetUrl);
  } else {
    // [백업] 시트가 없거나 키가 없으면 하드코딩 값 사용
    if (templateKey === "WELCOME_SLOTH") {
      subject = "[SessionPool] 챌린지 참여 신청이 완료되었습니다 🦥";
      htmlBody = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1>환영합니다 ${instagram}님!</h1>
          <p>SessionPool을 통해 신청해주셔서 감사합니다.</p>
          <hr>
          <p>매일 15:00에 만나요.</p>
          <a href="${sheetUrl}">🚀 입장하기</a>
          <br><br>
          <p style="color:red; font-size:12px;">* 관리자 알림: [ADMIN_EMAIL] 시트를 생성하여 이 내용을 수정할 수 있습니다.</p>
        </div>
      `;
    } else {
      subject = "[SessionPool] 환영합니다";
      htmlBody = `
        <div style="font-family: sans-serif; padding: 20px;">
          <p>환영합니다 ${instagram}님.</p>
          <a href="${sheetUrl}">입장 링크</a>
        </div>
      `;
    }
  }
  
  return sendEmailViaResend(email, subject, htmlBody);
}
