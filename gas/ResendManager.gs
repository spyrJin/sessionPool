/**
 * ============================================================
 * [ResendManager.gs]
 * Resend API를 이용한 이메일 발송 관리
 * ============================================================
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';

// ─────────────────────────────────────────────────────────
// API 키 조회 (Script Properties에서 안전하게 가져오기)
// ─────────────────────────────────────────────────────────

/**
 * Resend API 키 조회 (Script Properties에서)
 * @returns {string|null}
 */
function getResendApiKey() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('RESEND_API_KEY');
}

/**
 * Resend API 키 설정 (관리자용 - 최초 1회 실행)
 * @param {string} apiKey - Resend API 키
 */
function setResendApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('유효한 API 키를 입력하세요.');
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty('RESEND_API_KEY', apiKey);
  systemLog('SETUP', 'Resend API 키 설정 완료');
}

// ─────────────────────────────────────────────────────────
// 단건 메일 발송 (웰컴 레터 등)
// ─────────────────────────────────────────────────────────

/**
 * 이메일 1통 발송
 * @param {string} to - 수신자 이메일
 * @param {string} subject - 제목
 * @param {string} htmlBody - HTML 본문
 */
function sendEmailViaResend(to, subject, htmlBody) {
  const apiKey = getResendApiKey();
  const fromEmail = CONFIG.SENDER_EMAIL;
  
  if (!apiKey || !fromEmail) {
    systemLog('ERROR', 'Resend 설정 누락 (API Key 또는 Sender Email)');
    return false;
  }
  
  const payload = {
    from: `SessionPool <${fromEmail}>`,
    to: [to],
    subject: subject,
    html: htmlBody
  };
  
  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(RESEND_API_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    if (responseCode >= 200 && responseCode < 300) {
      systemLog('EMAIL', 'Resend 발송 성공', { to: to });
      return true;
    } else {
      systemLog('ERROR', 'Resend 발송 실패', { code: responseCode, body: responseBody });
      return false;
    }
  } catch (e) {
    systemLog('ERROR', 'Resend API 호출 오류', { error: e.toString() });
    return false;
  }
}


// ─────────────────────────────────────────────────────────
// 대량 메일 발송 (뉴스레터, 데일리 링크)
// ─────────────────────────────────────────────────────────

/**
 * 여러 명에게 일괄 발송 (Batch API 사용, 최대 100명 단위 분할 처리)
 * @param {Array} recipients - [{ email, name, ... }, ...]
 * @param {string} subject - 제목
 * @param {Function} bodyGenerator - 사용자별 본문 생성 함수 (user => htmlString)
 */
function sendBatchEmails(recipients, subject, bodyGenerator) {
  const apiKey = getResendApiKey();
  const fromEmail = CONFIG.SENDER_EMAIL;
  
  if (!recipients || recipients.length === 0) return;
  
  // Resend Batch API 제한: 한 번에 최대 100개
  const BATCH_SIZE = 50; // 안전하게 50개씩 끊어서
  
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    
    const batchPayload = chunk.map(user => ({
      from: `SessionPool <${fromEmail}>`,
      to: [user.email],
      subject: subject,
      html: bodyGenerator(user)
    }));
    
    const options = {
      method: 'post',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(batchPayload),
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(RESEND_BATCH_URL, options);
      systemLog('EMAIL', `배치 발송 완료 (${i+1}~${i+chunk.length})`, { code: response.getResponseCode() });
      
      // API Rate Limit 방지용 대기
      Utilities.sleep(1000);
      
    } catch (e) {
      systemLog('ERROR', '배치 발송 중 오류', { error: e.toString() });
    }
  }
}

// ─────────────────────────────────────────────────────────
// 템플릿 로더 (시트 연동)
// ─────────────────────────────────────────────────────────

/**
 * [ADMIN_EMAIL] 시트에서 템플릿 로드
 * @param {string} key - 템플릿 키 (예: 'WELCOME_SLOTH')
 * @returns {Object|null} { subject, html }
 */
function getEmailTemplate(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('[ADMIN_EMAIL]');
  
  // 시트가 없으면 기본 하드코딩 값 사용 (안전장치)
  if (!sheet) return null;
  
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues(); // A~D열
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      return {
        subject: data[i][2], // C열: 제목
        html: data[i][3]     // D열: HTML
      };
    }
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────
// 테스트 함수
// ─────────────────────────────────────────────────────────

/**
 * UrlFetchApp 권한 요청 트리거 (이 함수를 먼저 실행하세요)
 * Run this first to trigger authorization prompt
 */
function triggerUrlFetchAuthorization() {
  const response = UrlFetchApp.fetch('https://www.google.com');
  Logger.log('✅ UrlFetchApp 권한 승인됨! Status: ' + response.getResponseCode());
  Logger.log('이제 testResendEmail()을 실행하세요.');
}

/**
 * Resend 이메일 발송 테스트
 */
function testResendEmail() {
  const success = sendEmailViaResend(
    'jinmo0303@gmail.com',
    '[SessionPool] 테스트 이메일 ✅',
    '<div style="padding:20px; font-family:sans-serif;">' +
    '<h2>🎉 이메일 발송 성공!</h2>' +
    '<p>Resend API가 정상적으로 작동합니다.</p>' +
    '<p style="color:#666;">발송 시간: ' + new Date().toLocaleString('ko-KR') + '</p>' +
    '</div>'
  );

  Logger.log(success ? '✅ 발송 성공! jinmo0303@gmail.com 받은편지함 확인' : '❌ 발송 실패');
  return success;
}
