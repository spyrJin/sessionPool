const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.js', // .spec.js 파일만 Playwright 테스트로 인식
  use: {
    headless: true,
    viewport: { width: 375, height: 667 }, // 구글 사이드바와 비슷한 모바일 비율
    baseURL: 'file://' + __dirname,
  },
});
