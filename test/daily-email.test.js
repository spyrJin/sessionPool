const { loadGasCode } = require('./gas-loader');

// 테스트에 필요한 파일들 로드
const files = [
  'DailyManager.gs', 
  'ResendManager.gs', 
  'Config.gs', 
  'Utils.gs'
];

describe('Daily Email Automation Test', () => {
  let gas;
  let mockFetch;

  beforeEach(() => {
    gas = loadGasCode(files);
    
    // 1. UrlFetchApp.fetch 모킹 (Resend API 호출 가로채기)
    mockFetch = jest.fn().mockReturnValue({
      getResponseCode: () => 200,
      getContentText: () => '{"id":"mock_email_id"}'
    });
    gas.UrlFetchApp.fetch = mockFetch;

    // 2. SpreadsheetApp 모킹 (템플릿 로드용)
    // [ADMIN_EMAIL] 시트에서 데이터를 가져오는 척 함
    const mockSheet = {
      getLastRow: () => 2,
      getRange: () => ({
        getValues: () => [
          ['DAILY_LINK', '설명', '오늘의 링크', '<p>링크: {{link}}, 이름: {{name}}</p>']
        ]
      })
    };
    
    gas.SpreadsheetApp.getActiveSpreadsheet = jest.fn().mockReturnValue({
      getSheetByName: (name) => (name === '[ADMIN_EMAIL]' ? mockSheet : null)
    });

    // 3. System Log 모킹 (콘솔 출력 방지)
    gas.systemLog = jest.fn();
    
    // 4. Sleep 모킹 (속도 향상)
    gas.Utilities.sleep = jest.fn();
  });

  test('Should send emails with correct link substitution', () => {
    // 가짜 사용자 데이터
    const users = [
      { email: 'user1@test.com', instagram: '@user1' },
      { email: 'user2@test.com', instagram: '@user2' }
    ];
    
    const newSheetUrl = 'https://docs.google.com/spreadsheets/d/new-sheet-id';

    // 테스트 실행: 링크 발송 함수 호출
    gas.sendLinkToAllUsers(users, newSheetUrl);

    // 검증 1: Resend API가 호출되었는가?
    expect(mockFetch).toHaveBeenCalled();

    // 검증 2: 호출된 API의 Payload 확인
    // 첫 번째 호출의 두 번째 인자(options)를 가져옴
    const callArgs = mockFetch.mock.calls[0];
    const url = callArgs[0];
    const options = callArgs[1];
    const payload = JSON.parse(options.payload);

    // URL 확인
    expect(url).toContain('api.resend.com/emails/batch');

    // Payload 내용 확인 (배치 발송)
    expect(payload.length).toBe(2); // 2명에게 발송
    
    // 첫 번째 유저 확인
    expect(payload[0].to[0]).toBe('user1@test.com');
    expect(payload[0].html).toContain(newSheetUrl); // 링크가 치환되었는지
    expect(payload[0].html).toContain('@user1');    // 이름이 치환되었는지
    
    // 두 번째 유저 확인
    expect(payload[1].to[0]).toBe('user2@test.com');
    expect(payload[1].html).toContain(newSheetUrl);
  });

  test('Should handle missing template gracefully', () => {
    // 템플릿 시트가 없는 상황 시뮬레이션
    gas.SpreadsheetApp.getActiveSpreadsheet = jest.fn().mockReturnValue({
      getSheetByName: () => null
    });

    const users = [{ email: 'user1@test.com' }];
    gas.sendLinkToAllUsers(users, 'http://link');

    // API 호출이 없어야 함
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
