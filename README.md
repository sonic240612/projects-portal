# 프로젝트 모음집

**🔗 https://projects-portal-beta.vercel.app**

제가 만든 서비스들을 한 번에 확인할 수 있는 포털 페이지입니다.

## Playground

게임과 재미 중심 프로젝트

| 프로젝트 | 설명 | GitHub | Vercel |
|----------|------|--------|--------|
| open-survivor | 뱀서류 생존 게임 | [바로가기](https://github.com/sonic240612/open-survivor) | [바로가기](https://open-survivor.vercel.app) |
| LADDER | 사다리 타기 게임 | [바로가기](https://github.com/sonic240612/LADDER) | [바로가기](https://ladder-roulette.vercel.app) |
| TikaTuka | 주사위 보드게임 | [바로가기](https://github.com/sonic240612/TikaTuka) | [바로가기](https://tikatuka-one.vercel.app) |
| Mars Panic!!! | 비공개 프로젝트 | - | - |
| iF | AI 캐릭터 채팅 & 인터랙티브 스토리텔링 플랫폼 | [바로가기](https://github.com/sonic240612/iF) | [바로가기](https://if-chat-plum.vercel.app) |

## Tools

실용적인 도구 프로젝트

| 프로젝트 | 설명 | GitHub | Vercel |
|----------|------|--------|--------|
| 어디가?(WhereTo?) | 랜덤 장소 추천 서비스 | [바로가기](https://github.com/sonic240612/whereto) | [바로가기](https://whereto-swart.vercel.app) |
| PixelCircle | 픽셀 아트용 정밀 픽셀 원형 생성기 | [바로가기](https://github.com/sonic240612/pixel-circle) | [바로가기](https://pixel-circle.vercel.app) |

## Lab

AI 에이전트와 협업 방식을 탐구하는 실험적 프로젝트

| 프로젝트 | 설명 | GitHub |
|----------|------|--------|
| Lodex | 로컬 LLM과 OpenRouter를 연결하는 데스크톱 AI 에이전트 | [바로가기](https://github.com/sonic240612/Lodex) |
| hand-in-hand | 여러 사람이 하나의 Codex 세션을 이어가는 협업 프로토타입 | [바로가기](https://github.com/sonic240612/hand-in-hand) |

## Life

일상과 생산성 프로젝트

| 프로젝트 | 설명 | GitHub | Vercel |
|----------|------|--------|--------|
| HueWorld | 실시간 글로벌 무드 맵 | [바로가기](https://github.com/sonic240612/HueWorld) | [바로가기](https://hueworld.vercel.app) |
| zen_pebble | 디지털 디톡스 & 인내심 테스트 | [바로가기](https://github.com/sonic240612/zen_pebble) | [바로가기](https://zen-pebble.vercel.app) |
| Focus Forest | Pomodoro 타이머 & 스케줄 플래너 | [바로가기](https://github.com/sonic240612/Focus-Forest) | [바로가기](https://focus-forest-jet.vercel.app) |

## 기능

- **카테고리 탭** — All / Playground / Tools / Lab / Life로 프로젝트 분류
- **정렬** — Newest / Oldest 버튼으로 최신순·오래된 순 정렬
- **Simple 테마** — Light / Dark 모드 전환 지원
- **초기 밝기 모드** — 저장된 모드가 없으면 접속 기기의 Light / Dark 설정으로 시작. 모드 버튼으로 직접 선택한 값은 다음 방문에도 우선 적용
- **iPhone 화면 여백** — 배경은 화면 끝까지 이어지고, 헤더·탭은 다이나믹 아일랜드 안전 영역을 피해 배치. 페이지 끝에 하단 안전 여백을 두어 마지막 내용까지 스크롤 가능
- **Animated 테마** — 파티클 효과와 함께하는 다크 스타일
- **Liquid Glass 테마** — Apple의 조작 계층/콘텐츠 계층 구분을 참고한 웹 구현. 배경을 실제로 굴절시키는 캡슐, 미세한 색분산, 포인터 반사광, 눌림에 반응하는 광학 두께, 스프링으로 움직이는 드래그 가능한 선택 렌즈를 제공하며 Light / Dark 모드 지원
- **모션 제어** — Liquid Glass 효과는 처음 방문할 때 기본으로 켜짐. 시스템의 움직임 줄이기 설정과 별개로 상단 반짝임 버튼에서 켜거나 끌 수 있으며, 직접 끈 선택은 다음 방문에도 유지
- **프로젝트 아이콘** — Liquid Glass 카드에 프로젝트별 SVG 아이콘 표시. Lodex 원본 앱 아이콘과 hand-in-hand의 기존 브랜드 마크를 사용하고 나머지 10개는 서비스 성격에 맞춰 제작
- **디자인 전환** — 상단 모드 버튼 오른쪽에서 Animated → Simple → Liquid Glass 순환 전환. 기존 디자인 선택도 유지
- **접근성** — 키보드 포커스, 사이트 내 모션 끄기, 시스템 투명도 줄이기·고대비 설정, 배경 흐림 미지원 브라우저의 대체 배경 지원
- 테마·카테고리·정렬·모션 상태는 `localStorage`에 저장되어 유지됨

Liquid Glass는 Apple의 네이티브 렌더러가 아닌 웹 재현입니다. Chromium에서는 SVG 변위 필터로 실제 배경 굴절을 적용하고, Safari·Firefox 등에서는 CSS 배경 흐림과 반사광으로 대체합니다. 모션을 끄면 정적인 유리 표현을 유지하고, 투명도 감소·고대비 설정에서는 불투명한 배경으로 대체합니다. 외부 라이브러리 없이 구현했으며 스프링이 정착하면 애니메이션 계산도 멈춥니다.

디자인 참고: [Meet Liquid Glass (WWDC25)](https://developer.apple.com/videos/play/wwdc2025/219/), [Apple HIG — Materials](https://developer.apple.com/design/human-interface-guidelines/materials).
