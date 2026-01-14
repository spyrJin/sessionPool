const { loadGasCode } = require('./gas-loader');

// 필요한 파일 로드
const files = ['MatchingEngine.gs', 'Utils.gs', 'Config.gs'];

describe('Matching Engine Tests', () => {
  let gas;

  beforeEach(() => {
    // GAS 코드 로드 및 전역 객체 모킹
    gas = loadGasCode(files);
    
    // systemLog 함수 모킹 (MatchingEngine에서 사용됨)
    gas.systemLog = jest.fn();
  });

  // 1. 4명 분할 규칙 테스트
  test('4 users in same session should split into 2+2 groups', () => {
    const users = [
      { instagram: '@u1', streak: 10, session: 'Session A', cohort: 'A' },
      { instagram: '@u2', streak: 20, session: 'Session A', cohort: 'A' },
      { instagram: '@u3', streak: 30, session: 'Session A', cohort: 'A' },
      { instagram: '@u4', streak: 40, session: 'Session A', cohort: 'A' }
    ];

    const result = gas.runMatchingEngine(users);
    
    // 총 그룹 수는 2개여야 함
    expect(result.groups.length).toBe(2);
    
    // 각 그룹의 인원은 2명이어야 함
    expect(result.groups[0].members.length).toBe(2);
    expect(result.groups[1].members.length).toBe(2);
    
    // Lobby 유저는 없어야 함
    expect(result.lobbyUsers.length).toBe(0);
  });

  // 2. Universal Pool 이동 테스트
  test('Single users from different sessions should merge in Universal Pool', () => {
    const users = [
      { instagram: '@u1', streak: 10, session: 'Session A', cohort: 'A' }, // A세션 1명
      { instagram: '@u2', streak: 20, session: 'Session B', cohort: 'B' }, // B세션 1명
      { instagram: '@u3', streak: 30, session: 'Session C', cohort: 'C' }  // C세션 1명
    ];

    const result = gas.runMatchingEngine(users);

    // 3명이 모여서 1개의 그룹이 되어야 함
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].members.length).toBe(3);
    
    // 그룹 타입이 UNIVERSAL이어야 함
    expect(result.groups[0].type).toBe('UNIVERSAL');
  });

  // 3. Lobby 배정 테스트
  test('Single user left alone should go to Lobby', () => {
    const users = [
      { instagram: '@lonely', streak: 5, session: 'Session A', cohort: 'A' }
    ];

    const result = gas.runMatchingEngine(users);

    // 그룹은 생성되지 않음
    expect(result.groups.length).toBe(0);
    
    // Lobby에 1명 있어야 함
    expect(result.lobbyUsers.length).toBe(1);
    expect(result.lobbyUsers[0].instagram).toBe('@lonely');
    expect(result.lobbyUsers[0].destination).toBe('LOBBY');
  });

  // 4. 정렬 순서 테스트
  test('Users should be sorted by streak descending', () => {
    const users = [
      { instagram: '@low', streak: 10, session: 'Session A', cohort: 'A' },
      { instagram: '@high', streak: 100, session: 'Session A', cohort: 'A' },
      { instagram: '@mid', streak: 50, session: 'Session A', cohort: 'A' }
    ];

    const result = gas.runMatchingEngine(users);

    // 3명이므로 1개 그룹
    expect(result.groups.length).toBe(1);
    
    const members = result.groups[0].members;
    
    // 정렬 확인: High(100) -> Mid(50) -> Low(10)
    expect(members[0].streak).toBe(100);
    expect(members[1].streak).toBe(50);
    expect(members[2].streak).toBe(10);
  });

  // 5. 복합 케이스 (그룹핑 + Universal Pool)
  test('Complex case: Grouping and Universal Pool mix', () => {
    const users = [
      // Session A: 2명 -> 1그룹
      { instagram: '@a1', streak: 10, session: 'A', cohort: 'A' },
      { instagram: '@a2', streak: 10, session: 'A', cohort: 'A' },
      
      // Session B: 1명 -> Universal로 이동
      { instagram: '@b1', streak: 10, session: 'B', cohort: 'B' },
      
      // Session C: 1명 -> Universal로 이동
      { instagram: '@c1', streak: 10, session: 'C', cohort: 'C' }
    ];

    const result = gas.runMatchingEngine(users);

    // 총 2개 그룹 예상 (A그룹, Universal그룹)
    expect(result.groups.length).toBe(2);
    
    // 그룹 타입 확인
    const types = result.groups.map(g => g.type);
    expect(types).toContain('COHORT');
    expect(types).toContain('UNIVERSAL');
  });
});
