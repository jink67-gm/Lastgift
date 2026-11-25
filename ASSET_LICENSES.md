# 에셋 라이선스

외부 게임 에셋은 CC0-1.0이 확인된 파일만 쓴다(명세서 §9). 지금 게임에 들어간 외부 에셋은 없다(아래 「확보한 팩」은 원본 보관만).

| 에셋 | 제작자 | URL | 라이선스 | 취득일 | 원본 파일 | 배포 경로 | 수정 내역 |
|---|---|---|---|---|---|---|---|
| 요정 모델·모자 무늬 4종 | 직접 제작(코드) | - | 프로젝트 소유 | 2026-11-25 | - | `src/scene/elf.ts` | - |
| 광장 소품(썰매, 눈더미, 산타, 트리, 집, 벤치, 가로등) | 직접 제작(코드) | - | 프로젝트 소유 | 2026-11-25 | - | `src/scene/plaza.ts` | - |
| 선물 5종(스케치북, 색연필 통, 재봉틀 상자, 리본 축구공, 트리 수리 상자)·대상 고리 | 직접 제작(코드) | - | 프로젝트 소유 | 2026-11-25 | - | `src/scene/gifts.ts` | - |
| 2장 수선집(뒤뜰·덧문·걸쇠·받침대·통로·작업실·작업대·빨간 코트·체력 막대·교대 표시) | 직접 제작(코드) | - | 프로젝트 소유 | 2026-11-25 | - | `src/scene/chapter2.ts` | - |
| 행동 그림 8종(들기, 놓기, 함께 들기, 놓을 수 없음, 교대, 걸쇠, 문 밀기, 빈 손) | 직접 제작(SVG) | - | 프로젝트 소유 | 2026-11-25 | - | `src/ui/actionIcons.ts` | - |

글꼴은 번들하지 않고 기기 기본 글꼴을 쓴다.

## 확보한 외부 에셋 팩(원본 보관, 아직 게임에 넣지 않음)

| 확인일 | 팩 | 제작자 | 공식 URL | 동봉 라이선스 원문 | 원본 보관 | 증빙 | 채택 상태 |
|---|---|---|---|---|---|---|---|
| 2026-11-25 | Holiday Kit 2.0 (GLB·FBX·OBJ 각 99개, 텍스처 `colormap.png` 공용) | Kenney | https://kenney.nl/assets/holiday-kit | "License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/" · "Creation date: 11-12-2024" | `assets-src/kenney/kenney_holiday-kit_2.0.zip` (SHA256 `fde4d514…8dd769`) | `docs/asset-evidence/kenney/holiday-kit_2.0_License.txt` | 확보(CC0 확인). STEP 04에서 쓸 파일만 복사 예정 |
| 2026-11-25 | Mini Characters 2.0 (GLB·FBX·OBJ 각 43개, 사람 20종·보조기구·소품) | Kenney | https://kenney.nl/assets/mini-characters | 같은 문구 · "Creation date: 07-11-2026" | `assets-src/kenney/kenney_mini-characters_2.0.zip` (SHA256 `add348e9…d1bb7`) | `docs/asset-evidence/kenney/mini-characters_2.0_License.txt` | 확보(CC0 확인). STEP 04에서 쓸 파일만 복사 예정 |

두 팩 모두 Kenney가 만든 파일만 들어 있다(제3자 파일 없음). 사용자가 kenney.nl에서 내려받아 올린 zip이다.

### 2026-11-25 첫 검수(명세서 §9)

비교 화면: `docs/asset-evidence/kenney/2026-11-25_scale-check.png` (지금 게임의 요정 키 약 1.36 m, 재봉틀 상자 1.4 × 0.6 m와 나란히)

| 확인 항목 | 결과 |
|---|---|
| 단위·기준점 | 1단위 = 1 m로 보면 문틀 `cabin-doorway` 높이 1.0, 벽 한 칸 1.0 × 1.0. 모든 모델의 원점이 바닥(최저 y ≈ 0)이라 그대로 세울 수 있다 |
| 사람 키 | `character-female-a` 약 0.81, `character-male-b` 약 0.67(같은 팩 문 높이 1.0과 맞는 비율) |
| 트리 | `tree-decorated-snow` 높이 2.29, 꼭대기 별 있음(4장 트리 후보) |
| 문 | `cabin-door-rotate`에 `open`, `close`, `open-and-close` 애니메이션 있음(2장 덧문 후보) |
| 사람 애니메이션 | 모든 캐릭터 공통 32개: `idle`, `walk`, `sprint`, `pick-up`, `holding-both`(상자 들기), `interact-right/left`(스위치·문), `emote-yes/no`, `sit`, `crouch` 등. 손 흔들기·브이·볼 비비기는 없음 |
| 지금 게임과의 크기 차이 | Kenney 사람·문은 지금 요정(1.36 m)·덧문(2.1 m)보다 작다. 그대로 쓰면 맞지 않으므로 STEP 04에서 Kenney 모델 전체에 같은 배율(약 ×2: 문 2.0 m, 어른 약 1.6 m)을 주고, 요정은 사람보다 작게(약 ×1.4) 맞추는 안을 검토 |
| 참고 | `character-female-a`는 목발을 짚은 모습(접근성 다양성 캐릭터). 팩에 휠체어·흰 지팡이·보청기 소품도 있다 |
| 양말 | `sock-red`(높이 0.62)는 있지만 산타 얼굴 자수는 없음 → 5장 빈 양말은 직접 덧그림 필요 |

## 외부 에셋 후보(아직 게임에 넣지 않음)

후보는 배포 목록에 넣지 않는다. 게임에 넣을 때 실제 모델 파일을 저장소에 복사하고 위 표로 옮긴다.
증빙 보관 경로: `docs/asset-evidence/quaternius-animated-animals/`, `docs/asset-evidence/quaternius-modular-women/`

| 확인일 | 모델명 | 제작자 | 공식 팩 URL | 개별 모델 URL | 실제 라이선스 표기 | 동봉 파일 확인 | 채택 상태 |
|---|---|---|---|---|---|---|---|
| 2026-11-25 | Shiba Inu (시바견, 콩이 후보) | Quaternius | https://quaternius.com/packs/ultimateanimatedanimals.html | https://poly.pizza/m/y4wdQpg767 | 팩 페이지 `License` → `CC0`(creativecommons.org/publicdomain/zero/1.0/) · 개별 페이지 "퍼블릭 도메인(CC0)", 포함 항목 "애니메이션 동물 팩 12개 모델" | 동봉 `License.txt` "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication" 확인(사용자 화면 캡처). 모델 파일은 아직 저장소에 없음 | 후보(CC0 확인 완료) |
| 2026-11-25 | Hooded Adventurer (요정 몸 후보) | Quaternius | https://quaternius.com/packs/ultimatemodularwomen.html | Poly Pizza ID `y9KWOVG21R`(받은 파일 이름 기준) | 팩 페이지 `License` → `CC0`(creativecommons.org/publicdomain/zero/1.0/), "10 Different characters with 24 animations… free to use in personal and commercial projects" · Poly Pizza "2022년 4월 10일 • FBX/GLTF 형식 • 퍼블릭 도메인(CC0)", 제작자 쿼터니우스, 포함 항목 "궁극의 모듈형 여성용 팩 10개 모델" | 받은 GLB 직접 확인: 파일 안 라이선스 표기 없음(generator "FBX2glTF v0.9.7"), 동작 24개·4부분 구조가 팩 설명과 일치. 원본 `assets-src/quaternius/Hooded_Adventurer_by_Quaternius_-_y9KWOVG21R.glb`(SHA256 `703d20f5…3608b`). 팩 zip의 `License.txt`는 미확인 | 후보(CC0 확인 완료) |
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

### 2026-11-25 Hooded Adventurer 확인 기록

| 확인 대상 | 결과(원문) | 확인 방법 · 증빙 |
|---|---|---|
| 공식 팩 페이지 | "Quaternius • Ultimate Modular Women Pack", 정보 칸 `License` → `CC0`, "February 2022 10 Different characters with 24 animations! Each character is divided into 4 models" | 직접 받아 HTML 확인 |
| Poly Pizza 개별 페이지 | 제작자 쿼터니우스, "2022년 4월 10일 • FBX /GLTF 형식 • 퍼블릭 도메인(CC0)", 포함 항목 "궁극의 모듈형 여성용 팩 10개 모델". 캡처 위쪽이 잘려 모델 이름은 화면에 없음 | 사용자 캡처(브라우저 번역) `2026-11-25_polypizza_hooded-adventurer.jpg` |
| 받은 파일 | 동작 24개(Idle, Walk, Run, Wave, Interact 등), 메시 4부분(Head·Body·Legs·Feet)+칼, 뼈 62개 → 팩 설명과 일치 | 직접 분석 |

미니 요정 꾸미기 시제품(머리 1.75배·다리 짧게·옷 다시 칠하기·후드 숨김·눈 검정·이마~눈썹 위까지 덮는 요정 모자·뾰족 귀):
`tools/prototypes/mini-elf-hooded.html`, 화면 `docs/asset-evidence/quaternius-modular-women/2026-11-25_mini-elf-prototype_*.png`. 게임에는 아직 넣지 않았다.

## 코드 의존성(소프트웨어 라이선스, 별도 관리)

| 패키지 | 버전 | 라이선스 |
|---|---|---|
| three | 0.187.0 | MIT |
