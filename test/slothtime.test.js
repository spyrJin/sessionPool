const { loadGasCode } = require('./gas-loader');

const files = [
  'Config.gs',
  'Utils.gs',
  'SlothTimeEmailer.gs'
];

describe('SlothTime Email Automation', () => {
  let gas;

  beforeEach(() => {
    gas = loadGasCode(files);
    gas.systemLog = jest.fn();
  });

  // ─────────────────────────────────────────────────────
  // _isValidEmail
  // ─────────────────────────────────────────────────────
  describe('_isValidEmail', () => {
    test('accepts valid emails', () => {
      expect(gas._isValidEmail('user@example.com')).toBe(true);
      expect(gas._isValidEmail('a@b.co')).toBe(true);
      expect(gas._isValidEmail('user+tag@domain.org')).toBe(true);
    });

    test('rejects invalid emails', () => {
      expect(gas._isValidEmail('')).toBe(false);
      expect(gas._isValidEmail(null)).toBe(false);
      expect(gas._isValidEmail(undefined)).toBe(false);
      expect(gas._isValidEmail('not-an-email')).toBe(false);
      expect(gas._isValidEmail('@no-local.com')).toBe(false);
      expect(gas._isValidEmail('no-domain@')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // _dedup
  // ─────────────────────────────────────────────────────
  describe('_dedup', () => {
    test('removes duplicates', () => {
      expect(gas._dedup(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
    });

    test('handles empty/null input', () => {
      expect(gas._dedup([])).toEqual([]);
      expect(gas._dedup(null)).toEqual([]);
      expect(gas._dedup(undefined)).toEqual([]);
    });

    test('preserves order', () => {
      expect(gas._dedup(['c', 'a', 'b', 'a'])).toEqual(['c', 'a', 'b']);
    });
  });

  // ─────────────────────────────────────────────────────
  // _getSlothTimeEmails
  // ─────────────────────────────────────────────────────
  describe('_getSlothTimeEmails', () => {
    test('extracts valid emails from sheet data', () => {
      // Mock: CONFIG에 시트 설정
      gas.CONFIG.SLOTHTIME.SHEET.ID = 'mock-sheet-id';
      gas.CONFIG.SLOTHTIME.SHEET.GID = 123456;

      // Mock: SpreadsheetApp.openById가 시트 데이터 반환
      const mockSheet = {
        getSheetId: () => 123456,
        getDataRange: () => ({
          getValues: () => [
            ['이름', '이메일'],
            ['Alice', 'alice@test.com'],
            ['Bob', 'bob@test.com'],
            ['Charlie', 'invalid-email'],
            ['Dave', 'alice@test.com'],  // duplicate
            ['Eve', ''],                  // empty
          ]
        })
      };
      gas.SpreadsheetApp.openById = jest.fn().mockReturnValue({
        getSheets: () => [mockSheet]
      });

      const emails = gas._getSlothTimeEmails();
      expect(emails).toEqual(['alice@test.com', 'bob@test.com']);
    });

    test('throws if email header not found', () => {
      gas.CONFIG.SLOTHTIME.SHEET.ID = 'mock-sheet-id';
      gas.CONFIG.SLOTHTIME.SHEET.GID = 123456;

      const mockSheet = {
        getSheetId: () => 123456,
        getDataRange: () => ({
          getValues: () => [
            ['이름', '전화번호'],
            ['Alice', '010-1234']
          ]
        })
      };
      gas.SpreadsheetApp.openById = jest.fn().mockReturnValue({
        getSheets: () => [mockSheet]
      });

      expect(() => gas._getSlothTimeEmails()).toThrow('이메일');
    });

    test('returns empty for sheet with only headers', () => {
      gas.CONFIG.SLOTHTIME.SHEET.ID = 'mock-sheet-id';
      gas.CONFIG.SLOTHTIME.SHEET.GID = 123456;

      const mockSheet = {
        getSheetId: () => 123456,
        getDataRange: () => ({
          getValues: () => [['이메일']]
        })
      };
      gas.SpreadsheetApp.openById = jest.fn().mockReturnValue({
        getSheets: () => [mockSheet]
      });

      expect(gas._getSlothTimeEmails()).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────
  // _grantEditorsSmart
  // ─────────────────────────────────────────────────────
  describe('_grantEditorsSmart', () => {
    test('grants editors and returns result', () => {
      const result = gas._grantEditorsSmart('file-id', ['a@b.com', 'c@d.com'], 'skip');
      expect(result.granted).toEqual(['a@b.com', 'c@d.com']);
      expect(result.skipped).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    test('skips failed addEditor when policy is skip', () => {
      // Make addEditor throw for specific email
      gas.DriveApp.getFileById = jest.fn().mockReturnValue({
        addEditor: jest.fn().mockImplementation((email) => {
          if (email === 'nongoogle@outlook.com') throw new Error('not a Google account');
        })
      });

      const result = gas._grantEditorsSmart('file-id', ['ok@gmail.com', 'nongoogle@outlook.com'], 'skip');
      expect(result.granted).toEqual(['ok@gmail.com']);
      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0].email).toBe('nongoogle@outlook.com');
    });
  });

  // ─────────────────────────────────────────────────────
  // _createCalendarMeetStrict
  // ─────────────────────────────────────────────────────
  describe('_createCalendarMeetStrict', () => {
    test('creates event and returns meet link', () => {
      const start = new Date('2026-02-07T15:00:00+09:00');
      const end = new Date('2026-02-07T17:00:00+09:00');

      const result = gas._createCalendarMeetStrict({
        calendarId: 'primary',
        summary: 'Test Session',
        startTime: start,
        endTime: end,
        timezone: 'Asia/Seoul'
      });

      expect(result.eventId).toBe('mock-event-id');
      expect(result.meetLink).toContain('meet.google.com');
      expect(result.htmlLink).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────
  // _parseSessionTime
  // ─────────────────────────────────────────────────────
  describe('_parseSessionTime', () => {
    test('parses date + time into Date object', () => {
      const result = gas._parseSessionTime('2026-02-07', '15:00', 'Asia/Seoul');
      expect(result instanceof Date).toBe(true);
      expect(result.toISOString()).toBe('2026-02-07T06:00:00.000Z'); // 15:00 KST = 06:00 UTC
    });
  });

  // ─────────────────────────────────────────────────────
  // CONFIG.SLOTHTIME
  // ─────────────────────────────────────────────────────
  describe('CONFIG.SLOTHTIME', () => {
    test('has required fields', () => {
      const cfg = gas.CONFIG.SLOTHTIME;
      expect(cfg.TIMEZONE).toBe('Asia/Seoul');
      expect(cfg.SESSION.START).toBe('15:00');
      expect(cfg.SESSION.DURATION_MIN).toBe(120);
      expect(cfg.SESSION.LABEL).toBeTruthy();
      expect(cfg.MAIL.SENDER_NAME).toBeTruthy();
      expect(cfg.MAIL.SUBJECT_PREFIX).toBeTruthy();
    });

    test('SKIP_DAYS includes Sunday (0)', () => {
      expect(gas.CONFIG.SLOTHTIME.SKIP_DAYS).toContain(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // _notifyOwnerError
  // ─────────────────────────────────────────────────────
  describe('_notifyOwnerError', () => {
    test('sends error email to first admin', () => {
      gas.GmailApp._sent = [];
      gas._notifyOwnerError('Test Error', 'Error body');
      expect(gas.GmailApp._sent.length).toBe(1);
      expect(gas.GmailApp._sent[0].subject).toBe('Test Error');
      expect(gas.GmailApp._sent[0].recipient).toBe(gas.CONFIG.ADMIN_EMAILS[0]);
    });
  });
});
