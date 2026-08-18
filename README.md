# PSL Mining

SASEUL 블록체인의 PSL 토큰을 시간 기반 광산 게임으로 발견하는 React Native Expo 앱입니다. Android, iOS, Web 미리보기를 지원합니다.

## 현재 구현된 MVP

- Pi, Google, Apple 로그인 UI와 로컬 개발 인증
- GPS 현재 위치 및 전 세계 지도 탐색
- Web Mercator 기반 1m × 1m Grid ID 계산
- 48m 막장, 레벨/곡괭이 속도, 24시간 광고 활성 규칙
- 자발적 퇴장 및 7일 미복귀 시 깊이 보존을 위한 도메인 모델
- 채굴 현황, 프로필, PSL_Wallet 주소 및 전체 출금 UX
- 로컬 상태 저장

실제 소셜 로그인, 광고, 당첨 Grid 커밋-리빌, PSL_Wallet 서명, SASEUL 전송은 운영 백엔드와 키 설정 후 연결해야 합니다.

## 실행

```bash
npm install
npm run android
```

iOS는 macOS/Xcode 또는 Expo 개발 빌드가 필요합니다. 웹 미리보기는 `npm run web`으로 실행합니다.

## 검증

```bash
npm run validate
npx expo export --platform web
```
