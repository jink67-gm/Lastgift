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

후보는 배포 목록에 넣지 않는다. 게임에 넣을 때 실제 모델 파일을 저장소에 복사하고 위 표로 옮긴다.
증빙 보관 경로: `docs/asset-evidence/quaternius-animated-animals/`

| 확인일 | 모델명 | 제작자 | 공식 팩 URL | 개별 모델 URL | 실제 라이선스 표기 | 동봉 파일 확인 | 채택 상태 |
|---|---|---|---|---|---|---|---|
| 2026-11-25 | Shiba Inu (시바견, 콩이 후보) | Quaternius | https://quaternius.com/packs/ultimateanimatedanimals.html | https://poly.pizza/m/y4wdQpg767 | 팩 페이지 `License` → `CC0`(creativecommons.org/publicdomain/zero/1.0/) · 개별 페이지 "퍼블릭 도메인(CC0)", 포함 항목 "애니메이션 동물 팩 12개 모델" | 동봉 `License.txt` "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication" 확인(사용자 화면 캡처). 모델 파일은 아직 저장소에 없음 | 후보(CC0 확인 완료) |
| 2026-11-25 | Husky (허스키, 콩이 후보) | Quaternius | https://quaternius.com/packs/ultimateanimatedanimals.html | https://poly.pizza/m/wcWiuEqwzq | 팩 페이지 `License` → `CC0` · 개별 페이지 "퍼블릭 도메인(CC0)", 포함 항목 "애니메이션 동물 팩 12개 모델" | 위와 같은 동봉 `License.txt` 확인. 모델 파일은 아직 저장소에 없음 | 후보(CC0 확인 완료) |

### 2026-11-25 확인 기록(Shiba Inu·Husky)

| 확인 대상 | 결과(원문) | 확인 방법 · 증빙 |
|---|---|---|
| 팩 페이지 라이선스 | 팩 정보 칸 `License` → `<a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>`, "free to use in personal and commercial projects" | 직접 받아 HTML 확인 |
| 팩 페이지 위쪽 「License」 버튼 | `/license.html`(QAL)로 가는 사이트 공통 메뉴. 팩 전용 표기 아님 | HTML 확인 |
| 제작자 FAQ | "Each kit's license is listed in the details panel on the right of its page, and it's also included as a .txt file in the download." / "each kit uses either CC0 or the QAL License" | 웹 읽기 |
| Poly Pizza 시바견 | 제목 "시바견 - Quaternius 제작", 제작자 쿼터니우스, "2021년 9월 7일 • FBX/GLTF 형식 • 퍼블릭 도메인(CC0)", 포함 항목 "애니메이션 동물 팩 12개 모델" | 사용자 화면 캡처(브라우저 번역 화면) `2026-11-25_polypizza_shiba-inu.jpg` |
| Poly Pizza 허스키 | 제목 "허스키 - Quaternius 제작", 제작자 쿼터니우스, "2021년 9월 7일 • FBX/GLTF 형식 • 퍼블릭 도메인(CC0)", 포함 항목 "애니메이션 동물 팩 12개 모델" | 사용자 화면 캡처 `2026-11-25_polypizza_husky.jpg` |
| Poly Pizza 번들 | 제작자 쿼터니우스, "12가지 종류의 동물…개인 및 상업 프로젝트에서 무료로 사용", "최종 업데이트: 2022년 7월 9일 • 라이선스: 퍼블릭 도메인(CC0)" | 사용자 화면 캡처 `2026-11-25_polypizza_bundle.jpg` |
| 내려받은 팩의 `License.txt` | "LowPoly Models by @Quaternius … License: CC0 1.0 Universal (CC0 1.0) Public Domain Dedication https://creativecommons.org/publicdomain/zero/1.0/" | 사용자 화면 캡처 `2026-11-25_License-txt.jpg` |
| 자동 접속 | poly.pizza는 Cloudflare 봇 차단으로 자동 확인 불가. 우회하지 않고 사용자 캡처로 대신함 | - |

판정: 공식 팩 페이지·두 개별 모델 페이지·번들 페이지·동봉 `License.txt`가 모두 **CC0**로 일치한다. 다른 조건은 발견되지 않았다.
남은 일(채택할 때): 실제 모델 파일(glTF)을 원본 zip과 함께 저장소에 넣고, 원본 파일명·배포 경로·수정 내역(축소·재색상·본 보완)을 위 표에 기록한다.
`License.txt` 캡처에는 팩 이름이 보이지 않으므로, 원본 zip을 넣을 때 그 안의 `License.txt`를 함께 보관해 다시 확인한다.

## 코드 의존성(소프트웨어 라이선스, 별도 관리)

| 패키지 | 버전 | 라이선스 |
|---|---|---|
| three | 0.187.0 | MIT |
