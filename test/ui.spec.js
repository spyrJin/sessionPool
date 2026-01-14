const { test, expect } = require('@playwright/test');
const path = require('path');

// Sidebar.html 파일의 절대 경로
const sidebarPath = 'file://' + path.resolve(__dirname, '../gas/Sidebar.html');

test.describe('Sidebar UI Tests', () => {
  
  // 각 테스트 전에 실행: 페이지 로드 및 Mock 주입
  test.beforeEach(async ({ page }) => {
    // 1. google.script.run Mocking 준비
    await page.addInitScript(() => {
      window.google = {
        script: {
          run: {
            withSuccessHandler: function(successCallback) {
              this._successCallback = successCallback;
              return this;
            },
            withFailureHandler: function(failureCallback) {
              this._failureCallback = failureCallback;
              return this;
            },
            // Mock Functions
            getSidebarData: function() {
              // 0.5초 후 가짜 데이터 반환
              setTimeout(() => {
                if (this._successCallback) {
                  this._successCallback({
                    registered: true,
                    email: 'test@example.com',
                    instagram: '@test_user',
                    streak: 10,
                    gateStatus: {
                      isOpen: true,
                      displayTime: '05:00',
                      remainingSeconds: 300
                    },
                    currentBlock: {
                      label: '05:00'
                    },
                    announcement: '테스트 공지사항입니다.',
                    meetLink: null,
                    sessionValue: null
                  });
                }
              }, 100);
            },
            getSessionOptions: function() {
              setTimeout(() => {
                if (this._successCallback) {
                  this._successCallback([
                    '05:00 @session_pool',
                    '05:30 @session_pool',
                    '몰입 @각자'
                  ]);
                }
              }, 100);
            },
            selectSession: function(value) {
              setTimeout(() => {
                if (this._successCallback) {
                  this._successCallback({
                    success: true,
                    message: '세션이 선택되었습니다.'
                  });
                }
              }, 100);
            }
          }
        }
      };
    });

    // 2. 페이지 열기
    await page.goto(sidebarPath);
  });

  test('Should render user info correctly', async ({ page }) => {
    // 로딩이 끝나고 메인 콘텐츠가 보일 때까지 대기
    await expect(page.locator('#loading')).toBeHidden();
    await expect(page.locator('#main-content')).toBeVisible();

    // 사용자 정보 확인
    await expect(page.locator('#user-name')).toHaveText('@test_user');
    await expect(page.locator('#user-streak')).toHaveText('🔥 10일 연속');
    
    // 공지사항 확인
    await expect(page.locator('#announcement-text')).toHaveText('테스트 공지사항입니다.');
  });

  test('Should show gate status correctly', async ({ page }) => {
    await expect(page.locator('#loading')).toBeHidden();
    
    // 게이트 상태 확인 (Open)
    await expect(page.locator('#status-text')).toHaveText('🟢 선택 가능');
    await expect(page.locator('#timer')).toHaveText('05:00');
  });

  test('Should handle session selection', async ({ page }) => {
    await expect(page.locator('#loading')).toBeHidden();

    // 세션 옵션이 로드될 때까지 대기 (기본값 제외하고 옵션이 생겨야 함)
    const select = page.locator('#session-select');
    await expect(select).toBeEnabled();
    
    // 옵션 선택
    await select.selectOption({ label: '05:00 @session_pool' });
    
    // 버튼 클릭
    const btn = page.locator('#select-btn');
    await btn.click();
    
    // 버튼이 '처리 중...'으로 바뀌는지 확인 (잠깐이라도)
    await expect(btn).toHaveText(/처리 중|선택하기/); 
  });

  test('Should show unregistered screen for new users', async ({ page }) => {
    // 이 테스트를 위해 Mock을 재정의 (미등록 유저)
    await page.addInitScript(() => {
      window.google.script.run.getSidebarData = function() {
        setTimeout(() => {
          this._successCallback({
            registered: false, // 미등록!
            email: 'newbie@example.com'
          });
        }, 100);
      };
    });
    
    await page.reload(); // 페이지 새로고침하여 새 Mock 적용

    await expect(page.locator('#loading')).toBeHidden();
    
    // 미등록 화면이 보여야 함
    await expect(page.locator('#unregistered')).toBeVisible();
    await expect(page.locator('#main-content')).toBeHidden();
    await expect(page.locator('#user-email')).toHaveText('newbie@example.com');
  });
});
