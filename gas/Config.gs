/**
 * ============================================================
 * [Config.gs]
 * 세션풀 시스템 전역 설정 및 상수 정의
 * ============================================================
 */

const CONFIG = {
  // ─────────────────────────────────────────────────────────
  // 기본 설정
  // ─────────────────────────────────────────────────────────
  SHEET_NAME: 'SessionPool',      // 메인 시트 탭 이름
  START_HOUR: 5,                   // 하루 시작 시간 (05:00)
  GATE_DURATION_MINUTES: 5,        // 게이트 열림 시간 (분)
  BLOCK_DURATION_MINUTES: 30,      // 블록 단위 (분)
  TOTAL_BLOCKS: 48,                // 하루 총 블록 수 (48 * 30분 = 24시간)
  
  // ─────────────────────────────────────────────────────────
  // 그룹화 설정
  // ─────────────────────────────────────────────────────────
  GROUP_MIN_SIZE: 2,               // 최소 그룹 인원
  GROUP_MAX_SIZE: 3,               // 최대 그룹 인원
  
  // ─────────────────────────────────────────────────────────
  // 관리자 이메일 목록
  // ─────────────────────────────────────────────────────────
  ADMIN_EMAILS: [
    'admin@sessionpool.com',       // 실제 관리자 이메일로 교체
    'jinmo0303@gmail.com'          // 추가된 관리자
  ],
  
  // ─────────────────────────────────────────────────────────
  // 색상 팔레트
  // ─────────────────────────────────────────────────────────
  COLORS: {
    // 헤더
    HEADER_BG: '#1A73E8',
    HEADER_TEXT: '#FFFFFF',
    
    // 시간 상태
    CURRENT_BLOCK: '#FFF3CD',      // 현재 블록 (노란색)
    LOCKED: '#F5F5F5',             // 잠김/지난 블록 (회색)
    FUTURE: '#FFFFFF',             // 미래 블록 (흰색)
    
    // 세션 타입
    IMMERSE: '#E3F2FD',            // 몰입 배경 (파란색)
    IMMERSE_TEXT: '#1565C0',       // 몰입 글자
    RECOVER: '#E8F5E9',            // 회복 배경 (초록색)
    RECOVER_TEXT: '#2E7D32',       // 회복 글자
    
    // 게이트 상태
    GATE_OPEN: '#C8E6C9',          // 게이트 열림 (연두)
    GATE_CLOSED: '#FFCDD2',        // 게이트 닫힘 (연한 빨강)
    
    // 예외 상태
    WAITING: '#FFE0B2',            // 대기 (주황)
    WAITING_TEXT: '#E65100',
    
    // 그룹 구분
    GROUP_BORDER: '#424242'        // 그룹 경계선
  },
  
  // ─────────────────────────────────────────────────────────
  // 기본 코호트 설정 (모든 사용자 기본 접근)
  // ─────────────────────────────────────────────────────────
  DEFAULT_COHORT: '@각자',
  
  // ─────────────────────────────────────────────────────────
  // 기본 세션 옵션 (모든 사용자)
  // ─────────────────────────────────────────────────────────
  DEFAULT_SESSIONS: [
    '몰입 @각자',
    '회복 @각자'
  ],
  
  // ─────────────────────────────────────────────────────────
  // 코호트 정보 (크리에이터별 설정)
  // 실제 운영 시 Script Properties에서 동적 관리
  // ─────────────────────────────────────────────────────────
  COHORTS: {
    '@각자': {
      owner: 'system',
      rooms: [
        'https://meet.google.com/jqw-kgwm-oct',
        'https://meet.google.com/wwv-igfg-rfw',
        'https://meet.google.com/zao-awjn-kku'
      ],
      sessions: []  // 기본 세션은 DEFAULT_SESSIONS에서 관리
    },
    '@session_pool': {
      owner: 'sessionpool@gmail.com',
      rooms: [
        'https://meet.google.com/jqw-kgwm-oct',
        'https://meet.google.com/wwv-igfg-rfw',
        'https://meet.google.com/zao-awjn-kku'
      ],
      sessions: ['05:00', '21:00']  // 세션 시간
    },
    '@sloth_time': {
      owner: 'sloth@gmail.com',
      rooms: [
        'https://meet.google.com/sgx-uzjc-ruz',
        'https://meet.google.com/tcf-sgws-npv',
        'https://meet.google.com/ije-khhd-auh'
      ],
      sessions: ['15:00']  // 구글폼 작성자만 접근 가능
    }
  },
  
  // ─────────────────────────────────────────────────────────
  // 상설 대기방 (Universal Pool에서도 매칭 안 된 최후의 1인용)
  // ─────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────
  // 사용자 데이터 폴더 (구글폼 응답 시트들이 있는 곳)
  // ─────────────────────────────────────────────────────────
  USER_DATA_FOLDER_ID: '1dlDLaIjuzRR7lTxzS32bmTzK0RUzM1DJ',
  // ─────────────────────────────────────────────────────────
  // 이메일 서비스 (Resend)
  // ─────────────────────────────────────────────────────────
  // API 키는 Script Properties에서 'RESEND_API_KEY'로 관리 (보안)
  SENDER_EMAIL: 'onboarding@resend.dev', // 테스트용 (프로덕션 시 도메인 인증 후 변경)
  LOBBY_ROOM: 'https://meet.google.com/sessionpool-lobby',
  
  // ─────────────────────────────────────────────────────────
  // 메시지 템플릿
  // ─────────────────────────────────────────────────────────
  MESSAGES: {
    GATE_OPEN: '🟢 선택 가능',
    GATE_CLOSED: '🔴 몰입 중',
    WAITING: '⏳ 대기 중 (파트너 찾는 중)',
    LOBBY: '🏠 대기방 (누군가 올 때까지)',
    NO_PERMISSION: '⚠️ 권한 없음',
    EDIT_DENIED: '⚠️ 편집 불가',
    NOT_YOUR_ROW: '⚠️ 본인 행만 편집 가능',
    GATE_CLOSED_MSG: '⚠️ 게이트가 닫혔습니다'
  }
};

/**
 * 코호트 정보 조회 (Script Properties 우선, 없으면 CONFIG)
 */
function getCohortConfig(cohortName) {
  // Script Properties에서 동적 코호트 조회 시도
  const props = PropertiesService.getScriptProperties();
  const dynamicCohorts = JSON.parse(props.getProperty('cohorts') || '{}');
  
  if (dynamicCohorts[cohortName]) {
    return dynamicCohorts[cohortName];
  }
  
  // 기본 CONFIG에서 조회
  return CONFIG.COHORTS[cohortName] || null;
}

/**
 * 코호트의 Meet 방 목록 조회
 */
function getCohortRooms(cohortName) {
  const cohort = getCohortConfig(cohortName);
  return cohort ? cohort.rooms : CONFIG.COHORTS[CONFIG.DEFAULT_COHORT].rooms;
}

/**
 * 모든 활성 코호트 목록 조회
 */
function getAllCohorts() {
  const props = PropertiesService.getScriptProperties();
  const dynamicCohorts = JSON.parse(props.getProperty('cohorts') || '{}');
  
  // CONFIG와 동적 코호트 병합
  const allCohorts = { ...CONFIG.COHORTS, ...dynamicCohorts };
  return Object.keys(allCohorts);
}
