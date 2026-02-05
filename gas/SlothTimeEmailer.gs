/**
 * ============================================================
 * [SlothTimeEmailer.gs]
 * SlothTime 이메일 자동화 - 내일 세션 준비 및 발송
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 메인 실행 함수
// ─────────────────────────────────────────────────────────

/**
 * 내일 SlothTime 세션 준비 및 이메일 발송
 * 관리자 메뉴에서 호출됨
 */
function runSlothTimeTomorrow() {
  requireAdmin();

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    SpreadsheetApp.getUi().alert('다른 SlothTime 작업이 진행 중입니다.');
    return;
  }

  try {
    var ui = SpreadsheetApp.getUi();
    var cfg = CONFIG.SLOTHTIME;
    var tz = cfg.TIMEZONE;

    // 1. 내일 날짜 계산
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var dateStr = Utilities.formatDate(tomorrow, tz, 'yyyy-MM-dd');
    var dayOfWeek = tomorrow.getDay();

    // 2. 제외 요일 체크
    if (cfg.SKIP_DAYS.indexOf(dayOfWeek) !== -1) {
      ui.alert('안내', dateStr + '은(는) 제외 요일입니다. 발송하지 않습니다.', ui.ButtonSet.OK);
      return;
    }

    // 3. 중복 실행 체크
    var props = PropertiesService.getScriptProperties();
    var lastPrepared = props.getProperty('slothtime_lastPreparedDate');
    if (lastPrepared === dateStr) {
      var dup = ui.alert('경고',
        dateStr + ' 세션이 이미 준비되었습니다.\n다시 발송하시겠습니까?',
        ui.ButtonSet.YES_NO);
      if (dup !== ui.Button.YES) return;
    }

    // 4. 수신자 추출
    var emails = _getSlothTimeEmails();
    if (emails.length === 0) {
      ui.alert('안내', '유효한 수신자가 없습니다. 시트를 확인하세요.', ui.ButtonSet.OK);
      return;
    }

    // 5. 확인 다이얼로그
    var confirm = ui.alert('SlothTime 발송 확인',
      '날짜: ' + dateStr + '\n' +
      '시간: ' + cfg.SESSION.START + ' (' + tz + ')\n' +
      '수신자: ' + emails.length + '명\n\n발송하시겠습니까?',
      ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) return;

    // 6. Doc 복사
    var title = dateStr + ' ' + cfg.SESSION.START + ' ' + cfg.SESSION.LABEL;
    var doc = _copySlothTimeTemplate(title, emails);

    // 7. Meet 생성
    var startTime = _parseSessionTime(dateStr, cfg.SESSION.START, tz);
    var endTime = new Date(startTime.getTime() + cfg.SESSION.DURATION_MIN * 60 * 1000);
    var meet = _createSlothTimeMeet(title, startTime, endTime);

    // 8. 이메일 발송
    var sentCount = _sendSlothTimeEmails(emails, dateStr, cfg.SESSION.START, meet.meetLink, doc.url);

    // 9. 상태 저장
    props.setProperty('slothtime_lastPreparedDate', dateStr);

    // 10. 완료 알림
    systemLog('SLOTH', 'Session prepared', { date: dateStr, recipients: emails.length, sent: sentCount });
    ui.alert('완료',
      'SlothTime 발송 완료!\n\n' +
      '날짜: ' + dateStr + '\n' +
      '발송: ' + sentCount + '/' + emails.length + '명\n' +
      'Doc: ' + doc.url + '\n' +
      'Meet: ' + meet.meetLink,
      ui.ButtonSet.OK);

  } catch (error) {
    Logger.log('[SLOTH ERROR] ' + error.toString() + '\n' + (error.stack || ''));
    _notifySlothTimeError('runSlothTimeTomorrow', error);
    try {
      SpreadsheetApp.getUi().alert('오류',
        'SlothTime 실행 중 오류가 발생했습니다.\n' + error.message,
        SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) { /* UI 접근 불가 */ }
  } finally {
    lock.releaseLock();
  }
}


// ─────────────────────────────────────────────────────────
// 수신자 추출
// ─────────────────────────────────────────────────────────

/**
 * 외부 시트에서 이메일 목록 추출 (검증 + 중복 제거)
 * @returns {string[]}
 */
function _getSlothTimeEmails() {
  var cfg = CONFIG.SLOTHTIME;
  var ss = SpreadsheetApp.openById(cfg.SHEET.ID);
  var sheet = _getSheetByGid(ss, cfg.SHEET.GID);
  if (!sheet) {
    throw new Error('시트 탭을 찾을 수 없습니다 (GID: ' + cfg.SHEET.GID + ')');
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  // 헤더에서 이메일 열 찾기 (퍼지 매칭)
  var headers = data[0];
  var emailCol = -1;
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim().toLowerCase();
    if (h === '이메일' || h === 'email' || h === 'e-mail') {
      emailCol = i;
      break;
    }
  }
  if (emailCol === -1) {
    throw new Error('"이메일" 또는 "email" 헤더를 찾을 수 없습니다');
  }

  // 추출 + 검증 + 정규화 + 중복 제거
  var emails = [];
  var seen = {};
  for (var r = 1; r < data.length; r++) {
    var raw = String(data[r][emailCol]).trim().toLowerCase();
    if (raw && _isValidEmail(raw) && !seen[raw]) {
      seen[raw] = true;
      emails.push(raw);
    }
  }
  return emails;
}

/**
 * GID로 시트 탭 찾기
 * @param {Spreadsheet} ss
 * @param {number} gid
 * @returns {Sheet|null}
 */
function _getSheetByGid(ss, gid) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) {
      return sheets[i];
    }
  }
  return null;
}


// ─────────────────────────────────────────────────────────
// Doc 복사
// ─────────────────────────────────────────────────────────

/**
 * 템플릿 문서 복사 + 권한 부여
 * @param {string} title
 * @param {string[]} editors
 * @returns {{id: string, url: string}}
 */
function _copySlothTimeTemplate(title, editors) {
  var cfg = CONFIG.SLOTHTIME;
  var template = DriveApp.getFileById(cfg.TEMPLATE.DOC_ID);
  var folder = DriveApp.getFolderById(cfg.OUTPUT_FOLDER_ID);
  var copy = template.makeCopy(title, folder);

  // 링크 공유 설정 (비구글 계정도 접근 가능)
  copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);

  // 개별 편집자 권한 (Google 계정만, 실패 시 skip)
  var result = _grantEditorsSmart(copy.getId(), editors, cfg.DRIVE_NON_GOOGLE_POLICY);
  if (result.skipped.length > 0) {
    systemLog('SLOTH', 'Editor grant skipped', { count: result.skipped.length });
  }

  return {
    id: copy.getId(),
    url: copy.getUrl()
  };
}


// ─────────────────────────────────────────────────────────
// Meet 생성
// ─────────────────────────────────────────────────────────

/**
 * Calendar 이벤트 + Meet 링크 생성
 * @param {string} title
 * @param {Date} startTime
 * @param {Date} endTime
 * @returns {{eventId: string, meetLink: string, htmlLink: string}}
 */
function _createSlothTimeMeet(title, startTime, endTime) {
  var cfg = CONFIG.SLOTHTIME;
  var result = _createCalendarMeetStrict({
    calendarId: 'primary',
    summary: cfg.TITLE_PREFIX + ': ' + title,
    description: cfg.SESSION.LABEL,
    startTime: startTime,
    endTime: endTime,
    timezone: cfg.TIMEZONE,
    sendUpdates: 'none'
  });

  if (!result.meetLink) {
    throw new Error('Meet 링크 생성에 실패했습니다');
  }

  return result;
}


// ─────────────────────────────────────────────────────────
// 이메일 발송
// ─────────────────────────────────────────────────────────

/**
 * HTML 이메일 개별 발송
 * @param {string[]} emails
 * @param {string} date
 * @param {string} time
 * @param {string} meetLink
 * @param {string} docUrl
 * @returns {number} 발송 성공 수
 */
function _sendSlothTimeEmails(emails, date, time, meetLink, docUrl) {
  var cfg = CONFIG.SLOTHTIME;

  var template = HtmlService.createTemplateFromFile('slothtime-email');
  template.date = date;
  template.time = time;
  template.tzLabel = 'KST';
  template.meetLink = meetLink;
  template.docUrl = docUrl;

  var htmlBody = template.evaluate().getContent();
  var subject = '[' + cfg.MAIL.SUBJECT_PREFIX + '] ' + date + ' ' + cfg.SESSION.LABEL;
  var plainText = date + ' ' + time + ' ' + cfg.SESSION.LABEL +
    '\nMeet: ' + meetLink + '\nDoc: ' + docUrl;

  var sentCount = 0;
  for (var i = 0; i < emails.length; i++) {
    try {
      GmailApp.sendEmail(emails[i], subject, plainText, {
        htmlBody: htmlBody,
        name: cfg.MAIL.SENDER_NAME
      });
      sentCount++;
    } catch (e) {
      Logger.log('[SLOTH] Email failed for ' + emails[i] + ': ' + e.message);
    }
  }
  return sentCount;
}


// ─────────────────────────────────────────────────────────
// 날짜/시간 파싱
// ─────────────────────────────────────────────────────────

/**
 * 날짜 문자열 + 시간 문자열 → Date 객체
 * @param {string} dateStr - "2026-02-07"
 * @param {string} timeStr - "15:00"
 * @param {string} tz - "Asia/Seoul"
 * @returns {Date}
 */
function _parseSessionTime(dateStr, timeStr, tz) {
  // ISO 문자열로 파싱 (KST = +09:00)
  var isoStr = dateStr + 'T' + timeStr + ':00+09:00';
  return new Date(isoStr);
}


// ─────────────────────────────────────────────────────────
// 에러 알림
// ─────────────────────────────────────────────────────────

/**
 * SlothTime 에러 알림 (관리자에게 이메일)
 * @param {string} funcName
 * @param {Error} error
 */
function _notifySlothTimeError(funcName, error) {
  var subject = '[SlothTime 오류] ' + funcName;
  var body = 'Function: ' + funcName + '\n' +
    'Time: ' + new Date().toISOString() + '\n' +
    'Error: ' + error.toString() + '\n' +
    'Stack: ' + (error.stack || 'N/A');

  _notifyOwnerError(subject, body);
}


// ─────────────────────────────────────────────────────────
// 설정 확인 / 검증
// ─────────────────────────────────────────────────────────

/**
 * 현재 SlothTime 설정을 다이얼로그로 표시
 */
function showSlothTimeConfig() {
  requireAdmin();
  var cfg = CONFIG.SLOTHTIME;
  var ui = SpreadsheetApp.getUi();

  var info = '=== SlothTime 설정 ===\n\n' +
    '세션: ' + cfg.SESSION.START + ' / ' + cfg.SESSION.DURATION_MIN + '분\n' +
    '라벨: ' + cfg.SESSION.LABEL + '\n' +
    '타임존: ' + cfg.TIMEZONE + '\n' +
    '제외 요일: ' + cfg.SKIP_DAYS.join(', ') + ' (0=일)\n\n' +
    '템플릿 DOC_ID: ' + (cfg.TEMPLATE.DOC_ID || '(미설정)') + '\n' +
    '출력 폴더 ID: ' + (cfg.OUTPUT_FOLDER_ID || '(미설정)') + '\n' +
    '수신자 시트 ID: ' + (cfg.SHEET.ID || '(미설정)') + '\n' +
    '이메일 헤더: ' + cfg.SHEET.EMAIL_HEADER + '\n\n' +
    '발신자: ' + cfg.MAIL.SENDER_NAME + '\n' +
    '비구글 정책: ' + cfg.DRIVE_NON_GOOGLE_POLICY;

  ui.alert('SlothTime 설정', info, ui.ButtonSet.OK);
}

/**
 * SlothTime 설정 유효성 검증
 */
function validateSlothTimeSetup() {
  requireAdmin();
  var cfg = CONFIG.SLOTHTIME;
  var ui = SpreadsheetApp.getUi();
  var errors = [];

  // 템플릿 문서 접근 확인
  if (!cfg.TEMPLATE.DOC_ID) {
    errors.push('TEMPLATE.DOC_ID가 설정되지 않았습니다');
  } else {
    try {
      DriveApp.getFileById(cfg.TEMPLATE.DOC_ID);
    } catch (e) {
      errors.push('템플릿 문서 접근 불가: ' + cfg.TEMPLATE.DOC_ID);
    }
  }

  // 출력 폴더 접근 확인
  if (!cfg.OUTPUT_FOLDER_ID) {
    errors.push('OUTPUT_FOLDER_ID가 설정되지 않았습니다');
  } else {
    try {
      DriveApp.getFolderById(cfg.OUTPUT_FOLDER_ID);
    } catch (e) {
      errors.push('출력 폴더 접근 불가: ' + cfg.OUTPUT_FOLDER_ID);
    }
  }

  // 수신자 시트 접근 확인
  if (!cfg.SHEET.ID) {
    errors.push('SHEET.ID가 설정되지 않았습니다');
  } else {
    try {
      var ss = SpreadsheetApp.openById(cfg.SHEET.ID);
      var sheet = _getSheetByGid(ss, cfg.SHEET.GID);
      if (!sheet) {
        errors.push('시트 탭을 찾을 수 없습니다 (GID: ' + cfg.SHEET.GID + ')');
      }
    } catch (e) {
      errors.push('수신자 시트 접근 불가: ' + cfg.SHEET.ID);
    }
  }

  // Calendar API 확인
  try {
    Calendar.Events;
  } catch (e) {
    errors.push('Calendar Advanced Service가 활성화되지 않았습니다');
  }

  if (errors.length === 0) {
    ui.alert('검증 완료', '모든 설정이 올바릅니다!', ui.ButtonSet.OK);
  } else {
    ui.alert('검증 실패', '오류:\n\n- ' + errors.join('\n- '), ui.ButtonSet.OK);
  }
}
