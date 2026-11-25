# 에셋 라이선스

외부 게임 에셋은 CC0-1.0이 확인된 파일만 쓴다(명세서 §9). 현재 외부 에셋은 없다.

| 에셋 | 제작자 | URL | 라이선스 | 취득일 | 원본 파일 | 배포 경로 | 수정 내역 |
|---|---|---|---|---|---|---|---|
| 요정 모델·모자 무늬 4종 | 직접 제작(코드) | - | 프로젝트 소유 | 2026-11-25 | - | `src/scene/elf.ts` | - |
| 광장 소품(썰매, 눈더미, 산타, 트리, 집, 벤치, 가로등) | 직접 제작(코드) | - | 프로젝트 소유 | 2026-11-25 | - | `src/scene/plaza.ts` | - |
| 선물 5종(스케치북, 색연필 통, 재봉틀 상자, 리본 축구공, 트리 수리 상자)·대상 고리 | 직접 제작(코드) | - | 프로젝트 소유 | 2026-11-25 | - | `src/scene/gifts.ts` | - |
| 2장 수선집(뒤뜰·덧문·걸쇠·받침대·통로·작업실·작업대·빨간 코트·체력 막대·교대 표시) | 직접 제작(코드) | - | 프로젝트 소유 | 2026-11-25 | - | `src/scene/chapter2.ts` | - |
| 행동 그림 8종(들기, 놓기, 함께 들기, 놓을 수 없음, 교대, 걸쇠, 문 밀기, 빈 손) | 직접 제작(SVG) | - | 프로젝트 소유 | 2026-11-25 | - | `src/ui/actionIcons.ts` | - |

글꼴은 번들하지 않고 기기 기본 글꼴을 쓴다.

## 외부 에셋 후보(아직 게임에 넣지 않음)

후보는 배포 목록에 넣지 않는다. 채택하려면 실제로 내려받은 파일과 동봉 라이선스 `.txt`가 CC0인지 확인해야 한다.

| 확인일 | 모델명 | 제작자 | 공식 팩 URL | 개별 모델 URL | 실제 라이선스 표기 | 동봉 파일 확인 | 채택 상태 |
|---|---|---|---|---|---|---|---|
| 2026-11-25 | Shiba Inu (콩이 후보) | Quaternius(팩 제작자 기준. 개별 페이지 미확인) | https://quaternius.com/packs/ultimateanimatedanimals.html | https://poly.pizza/m/y4wdQpg767 | 팩 페이지: `License` → `CC0`(링크 https://creativecommons.org/publicdomain/zero/1.0/). 개별 페이지: **이번에 확인 못 함**(Cloudflare 봇 차단) | 미검증(내려받은 파일 없음) | 후보 · 보류 |
| 2026-11-25 | Husky (콩이 후보) | Quaternius(팩 제작자 기준. 개별 페이지 미확인) | https://quaternius.com/packs/ultimateanimatedanimals.html | https://poly.pizza/m/wcWiuEqwzq | 팩 페이지: `License` → `CC0`(같은 링크). 개별 페이지: **이번에 확인 못 함**(Cloudflare 봇 차단) | 미검증(내려받은 파일 없음) | 후보 · 보류 |

### 2026-11-25 확인 기록(Shiba Inu·Husky)

| 확인 대상 | 결과(원문) | 확인 방법 |
|---|---|---|
| 팩 페이지 라이선스 | 팩 정보 칸 `License` → `<a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>`, "free to use in personal and commercial projects" | 직접 받아 HTML 확인 |
| 팩 페이지의 모델 목록 | "This pack includes 12 different animals" — **Shiba Inu·Husky 이름은 나오지 않음** | 직접 받아 검색 |
| 팩 페이지 위쪽 「License」 버튼 | `/license.html`(QAL)로 가는 사이트 공통 메뉴. 팩 전용 표기 아님 | HTML 확인 |
| 제작자 FAQ | "Each kit's license is listed in the details panel on the right of its page, and it's also included as a .txt file in the download." / "each kit uses either CC0 or the QAL License" | 웹 읽기 |
| 사이트 QAL 문서 | "Quaternius Asset License (QAL) v1.0", "Last updated: 8/28/2026". CC0는 언급 없음. "the version in effect at the time you obtained the Assets governs" | 웹 읽기 |
| Poly Pizza 개별 모델 2개·번들 목록 | **확인 못 함.** 네트워크 허용 뒤에도 "Just a moment… Performing security verification"(Cloudflare 봇 차단)에서 멈춤. 우회하지 않음 | curl·Chromium |
| 이전 조사 값(이번에 재확인 못 함) | 두 모델 모두 제작자 Quaternius, "Public Domain (CC0)", 번들에 포함 | 사용자 제공 이전 조사 |

판정: 팩 페이지와 FAQ 기준으로 이 팩은 CC0로 표시된다. 다만 (1) 두 모델이 이 팩에 속한다는 근거와 개별 라이선스 표기를 이번에 직접 확인하지 못했고,
(2) 내려받은 파일과 동봉 `.txt`를 확인하지 않았으므로 **CC0 기준 충족은 미확정**이다. 채택 전에 할 일:
- 팩을 공식 배포처(팩 페이지의 Download)에서 받아, 동봉 라이선스 `.txt`가 CC0인지와 Shiba Inu·Husky 파일이 들어 있는지 확인하고 원본 zip을 보관.
- Poly Pizza 개별 페이지는 사람이 브라우저로 열어 화면을 저장(증빙)하거나, 동봉 파일 확인으로 대신한다.

## 코드 의존성(소프트웨어 라이선스, 별도 관리)

| 패키지 | 버전 | 라이선스 |
|---|---|---|
| three | 0.187.0 | MIT |
