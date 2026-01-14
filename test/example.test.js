const { loadGasCode } = require('./gas-loader');

const files = ['Config.gs', 'Utils.gs'];

describe('GAS Project Tests', () => {
  let gas;

  beforeEach(() => {
    gas = loadGasCode(files);
  });

  describe('SpreadsheetApp Mock', () => {
    test('SpreadsheetApp should be defined', () => {
      expect(gas.SpreadsheetApp).toBeDefined();
    });

    test('SpreadsheetApp.create should work', () => {
      const sheet = gas.SpreadsheetApp.create('Test Sheet');
      expect(sheet.getName()).toBe('Test Sheet');
    });
  });

  describe('Utils.gs Functions', () => {
    test('padZero should pad single digit numbers', () => {
      expect(gas.padZero(5)).toBe('05');
      expect(gas.padZero(12)).toBe('12');
      expect(gas.padZero(0)).toBe('00');
    });

    test('formatSeconds should format time correctly', () => {
      expect(gas.formatSeconds(90)).toBe('1:30');
      expect(gas.formatSeconds(60)).toBe('1:00');
      expect(gas.formatSeconds(5)).toBe('0:05');
    });

    test('columnToLetter should convert numbers to letters', () => {
      expect(gas.columnToLetter(1)).toBe('A');
      expect(gas.columnToLetter(2)).toBe('B');
      expect(gas.columnToLetter(26)).toBe('Z');
      expect(gas.columnToLetter(27)).toBe('AA');
    });

    test('letterToColumn should convert letters to numbers', () => {
      expect(gas.letterToColumn('A')).toBe(1);
      expect(gas.letterToColumn('B')).toBe(2);
      expect(gas.letterToColumn('Z')).toBe(26);
      expect(gas.letterToColumn('AA')).toBe(27);
    });

    test('parseStreak should extract streak number from label', () => {
      expect(gas.parseStreak('🔥76 @jinmo_yang')).toBe(76);
      expect(gas.parseStreak('⭐00 @newbie')).toBe(0);
      expect(gas.parseStreak('invalid')).toBe(0);
      expect(gas.parseStreak(null)).toBe(0);
    });

    test('parseInstagram should extract handle from label', () => {
      expect(gas.parseInstagram('🔥76 @jinmo_yang')).toBe('@jinmo_yang');
      expect(gas.parseInstagram('no handle')).toBeNull();
      expect(gas.parseInstagram(null)).toBeNull();
    });

    test('extractCohortName should get cohort from session value', () => {
      expect(gas.extractCohortName('15:00 @sloth_idea')).toBe('@sloth_idea');
      expect(gas.extractCohortName('몰입 @각자')).toBe('@각자');
      expect(gas.extractCohortName(null)).toBe('@각자');
    });

    test('extractSessionTime should get time from session value', () => {
      expect(gas.extractSessionTime('15:00 @sloth_idea')).toBe('15:00');
      expect(gas.extractSessionTime('몰입 @각자')).toBeNull();
    });

    test('isImmersionSession should identify immersion sessions', () => {
      expect(gas.isImmersionSession('몰입 @각자')).toBe(true);
      expect(gas.isImmersionSession('15:00 @sloth_idea')).toBe(true);
      expect(gas.isImmersionSession('회복 @각자')).toBe(false);
    });

    test('isRecoverySession should identify recovery sessions', () => {
      expect(gas.isRecoverySession('회복 @각자')).toBe(true);
      expect(gas.isRecoverySession('몰입 @각자')).toBe(false);
    });

    test('getBlockColumnForTime should calculate correct column', () => {
      expect(gas.getBlockColumnForTime(5, 0)).toBe(2);
      expect(gas.getBlockColumnForTime(5, 30)).toBe(3);
      expect(gas.getBlockColumnForTime(6, 0)).toBe(4);
    });

    test('getTimeLabel should return correct time string', () => {
      expect(gas.getTimeLabel(2)).toBe('05:00');
      expect(gas.getTimeLabel(3)).toBe('05:30');
      expect(gas.getTimeLabel(4)).toBe('06:00');
    });
  });

  describe('Config.gs', () => {
    test('CONFIG should be defined with required properties', () => {
      expect(gas.CONFIG).toBeDefined();
      expect(gas.CONFIG.SHEET_NAME).toBe('SessionPool');
      expect(gas.CONFIG.START_HOUR).toBe(5);
      expect(gas.CONFIG.GATE_DURATION_MINUTES).toBe(5);
      expect(gas.CONFIG.BLOCK_DURATION_MINUTES).toBe(30);
      expect(gas.CONFIG.TOTAL_BLOCKS).toBe(48);
    });

    test('CONFIG.COLORS should have all required color definitions', () => {
      expect(gas.CONFIG.COLORS.HEADER_BG).toBeDefined();
      expect(gas.CONFIG.COLORS.IMMERSE).toBeDefined();
      expect(gas.CONFIG.COLORS.RECOVER).toBeDefined();
      expect(gas.CONFIG.COLORS.GATE_OPEN).toBeDefined();
      expect(gas.CONFIG.COLORS.GATE_CLOSED).toBeDefined();
    });

    test('CONFIG.MESSAGES should have all required messages', () => {
      expect(gas.CONFIG.MESSAGES.GATE_OPEN).toBeDefined();
      expect(gas.CONFIG.MESSAGES.GATE_CLOSED).toBeDefined();
      expect(gas.CONFIG.MESSAGES.WAITING).toBeDefined();
    });
  });
});
