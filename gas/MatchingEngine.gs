/**
 * ============================================================
 * [MatchingEngine.gs]
 * 핵심 매칭 엔진: 정렬, 그룹화, Universal Pool
 * 
 * 로직 흐름:
 * 1. 세션별 분류
 * 2. 각 세션 내 연속일수 정렬 (내림차순)
 * 3. 2~3명 그룹화 (4명→2+2 규칙)
 * 4. 낙오자(1명) → Universal Pool
 * 5. Universal Pool 재매칭
 * 6. 최종 1명 → Lobby 배정
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// 메인 매칭 함수
// ─────────────────────────────────────────────────────────

/**
 * 매칭 엔진 실행
 * @param {Array} participants - 참여자 배열
 * @returns {Object} { groups: [...], lobbyUsers: [...] }
 */
function runMatchingEngine(participants) {
  systemLog('MATCH', '매칭 엔진 시작', { participantCount: participants.length });
  
  // 1. 세션별 분류
  const sessionGroups = groupBySession(participants);
  
  systemLog('MATCH', '세션별 분류 완료', { 
    sessions: Object.keys(sessionGroups).length,
    breakdown: Object.keys(sessionGroups).map(k => k + ':' + sessionGroups[k].length)
  });
  
  // 2. 각 세션 처리 (정렬 + 그룹화)
  const allGroups = [];
  const universalPool = [];
  
  Object.keys(sessionGroups).forEach(sessionName => {
    const sessionUsers = sessionGroups[sessionName];
    
    // 연속일수 정렬 (내림차순: 높은 사람이 위로)
    sessionUsers.sort((a, b) => b.streak - a.streak);
    
    // 그룹화 (2~3명)
    const result = distributeToGroups(sessionUsers, sessionName);
    
    allGroups.push(...result.groups);
    
    // 낙오자는 Universal Pool로
    if (result.leftover) {
      result.leftover.originSession = sessionName;
      universalPool.push(result.leftover);
    }
  });
  
  systemLog('MATCH', '1차 그룹화 완료', { 
    groups: allGroups.length,
    universalPool: universalPool.length 
  });
  
  // 3. Universal Pool 처리
  const lobbyUsers = [];
  
  if (universalPool.length > 0) {
    // Universal Pool도 연속일수 정렬
    universalPool.sort((a, b) => b.streak - a.streak);
    
    systemLog('MATCH', 'Universal Pool 처리', { 
      users: universalPool.map(u => u.instagram + '(' + u.streak + ')')
    });
    
    // Universal Pool 그룹화
    const poolResult = distributeToGroups(universalPool, 'Universal Pool');
    
    allGroups.push(...poolResult.groups);
    
    // Universal Pool에서도 남은 최후의 1명 → Lobby
    if (poolResult.leftover) {
      poolResult.leftover.destination = 'LOBBY';
      lobbyUsers.push(poolResult.leftover);
      systemLog('MATCH', 'Lobby 배정', { user: poolResult.leftover.instagram });
    }
  }
  
  systemLog('MATCH', '매칭 엔진 완료', { 
    totalGroups: allGroups.length,
    lobbyUsers: lobbyUsers.length 
  });
  
  return {
    groups: allGroups,
    lobbyUsers: lobbyUsers
  };
}


// ─────────────────────────────────────────────────────────
// 세션별 분류
// ─────────────────────────────────────────────────────────

/**
 * 참여자를 세션별로 분류
 * @param {Array} participants
 * @returns {Object} { sessionName: [users], ... }
 */
function groupBySession(participants) {
  const groups = {};
  
  participants.forEach(user => {
    const session = user.session;
    if (!groups[session]) {
      groups[session] = [];
    }
    groups[session].push(user);
  });
  
  return groups;
}


// ─────────────────────────────────────────────────────────
// 그룹 분배 로직 (핵심)
// ─────────────────────────────────────────────────────────

/**
 * 사용자 목록을 2~3명 그룹으로 분배
 * 
 * 핵심 규칙:
 * - 최소 2명, 최대 3명
 * - 4명 → 2+2 (3+1 방지)
 * - 5명 이상 → 3명씩 먼저
 * - 1명 남으면 leftover로 반환
 * 
 * @param {Array} sortedUsers - 정렬된 사용자 배열
 * @param {string} sessionName - 세션 이름
 * @returns {Object} { groups: [...], leftover: user|null }
 */
function distributeToGroups(sortedUsers, sessionName) {
  const groups = [];
  let remaining = sortedUsers.slice();  // 복사본
  
  while (remaining.length > 0) {
    const n = remaining.length;
    let size = 0;
    
    if (n === 1) {
      // 1명 남음 → leftover
      return {
        groups: groups,
        leftover: remaining[0]
      };
    }
    else if (n === 2) {
      // 2명 → 2명 그룹
      size = 2;
    }
    else if (n === 3) {
      // 3명 → 3명 그룹
      size = 3;
    }
    else if (n === 4) {
      // 4명 → 2+2 (3+1 방지!)
      size = 2;
    }
    else {
      // 5명 이상 → 3명씩
      size = 3;
    }
    
    // 그룹 생성
    const groupMembers = remaining.slice(0, size);
    remaining = remaining.slice(size);
    
    groups.push({
      members: groupMembers,
      session: sessionName,
      cohort: groupMembers[0].cohort,  // 첫 번째 멤버의 코호트 (대표)
      avgStreak: calculateAvgStreak(groupMembers),
      type: sessionName === 'Universal Pool' ? 'UNIVERSAL' : 'COHORT'
    });
  }
  
  return {
    groups: groups,
    leftover: null
  };
}


// ─────────────────────────────────────────────────────────
// 그룹 크기 계산 (참고용)
// ─────────────────────────────────────────────────────────

/**
 * N명을 2~3명 그룹으로 최적 분배 시 그룹 크기 배열 계산
 * @param {number} n - 총 인원
 * @returns {number[]} - 각 그룹 인원 수 배열
 */
function calculateGroupSizes(n) {
  if (n < 2) return [];
  if (n === 2) return [2];
  if (n === 3) return [3];
  if (n === 4) return [2, 2];  // 3+1 방지
  
  const sizes = [];
  let remaining = n;
  
  while (remaining > 0) {
    if (remaining === 2) {
      sizes.push(2);
      remaining = 0;
    }
    else if (remaining === 4) {
      // 4명 남으면 2+2 (3+1 방지)
      sizes.push(2);
      sizes.push(2);
      remaining = 0;
    }
    else {
      // 그 외엔 3명씩
      sizes.push(3);
      remaining -= 3;
    }
  }
  
  return sizes;
}


// ─────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────

/**
 * 그룹 멤버들의 평균 연속일수 계산
 * @param {Array} members
 * @returns {number}
 */
function calculateAvgStreak(members) {
  if (members.length === 0) return 0;
  const total = members.reduce((sum, m) => sum + m.streak, 0);
  return Math.round(total / members.length);
}

/**
 * 그룹 정보 문자열 생성 (디버깅/노트용)
 * @param {Object} group
 * @returns {string}
 */
function formatGroupInfo(group) {
  const memberInfo = group.members.map(m => m.instagram + '(' + m.streak + ')').join(', ');
  return '[' + group.session + '] ' + memberInfo + ' (avg:' + group.avgStreak + ')';
}


// ─────────────────────────────────────────────────────────
// 테스트/디버깅용
// ─────────────────────────────────────────────────────────

/**
 * 매칭 엔진 테스트 (가상 데이터)
 */
function testMatchingEngine() {
  // 테스트 데이터 (시뮬레이션과 동일)
  const testUsers = [
    { row: 2, instagram: '@jinmo', streak: 76, session: '15:00 @sloth_idea', cohort: '@sloth_idea' },
    { row: 3, instagram: '@ijaka', streak: 72, session: '15:00 @sloth_idea', cohort: '@sloth_idea' },
    { row: 4, instagram: '@loner_1', streak: 10, session: '05:00 @session_pool', cohort: '@session_pool' },
    { row: 5, instagram: '@soeun', streak: 20, session: '15:00 @sloth_idea', cohort: '@sloth_idea' },
    { row: 6, instagram: '@newbie', streak: 0, session: '15:00 @sloth_idea', cohort: '@sloth_idea' },
    { row: 7, instagram: '@user_a', streak: 50, session: '몰입 @각자', cohort: '@각자' },
    { row: 8, instagram: '@user_b', streak: 45, session: '몰입 @각자', cohort: '@각자' },
    { row: 9, instagram: '@user_c', streak: 5, session: '몰입 @각자', cohort: '@각자' },
    { row: 10, instagram: '@user_d', streak: 2, session: '몰입 @각자', cohort: '@각자' },
    { row: 11, instagram: '@loner_2', streak: 100, session: '회복 @각자', cohort: '@각자' }
  ];
  
  Logger.log('=== 매칭 엔진 테스트 시작 ===');
  Logger.log('입력: ' + testUsers.length + '명');
  
  const result = runMatchingEngine(testUsers);
  
  Logger.log('=== 결과 ===');
  Logger.log('그룹 수: ' + result.groups.length);
  
  result.groups.forEach((group, i) => {
    Logger.log('그룹 ' + (i + 1) + ': ' + formatGroupInfo(group));
  });
  
  if (result.lobbyUsers.length > 0) {
    Logger.log('Lobby: ' + result.lobbyUsers.map(u => u.instagram).join(', '));
  }
  
  return result;
}

/**
 * 그룹 크기 계산 테스트
 */
function testGroupSizes() {
  for (let n = 1; n <= 15; n++) {
    const sizes = calculateGroupSizes(n);
    Logger.log(n + '명 → [' + sizes.join(', ') + ']');
  }
}
