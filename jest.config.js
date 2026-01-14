module.exports = {
  testEnvironment: 'node',
  verbose: true,
  // .gs 파일은 테스트 대상이 아니지만 로더를 통해 로드됩니다.
  // 테스트 파일은 .test.js 확장자를 가집니다.
  testMatch: ['**/test/**/*.test.js'],
};
