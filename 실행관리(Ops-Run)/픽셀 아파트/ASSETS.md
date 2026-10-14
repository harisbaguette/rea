# 픽셀 아파트 에셋

| 에셋 | 작가·팩 | 이용 조건 | 실제 파일 | 원본 파일 |
|---|---|---|---|---|
| 일상복 주민 | Pipoya / PIPOYA FREE RPG Character Sprites 32x32 | 개인·상업 작품 및 수정 허용. 소재 자체 재배포·재판매 금지. 작품 포함 허용. 크레딧 선택 | `assets/pipoya/resident.png` | `Female/Female 17-1.png` |
| 흰 고양이 | Pipoya / 같은 팩 | 위와 같음 | `assets/pipoya/cat.png` | `Animal/Cat 01-1.png` |
| 이용 고지 | Pipoya | 공식 팩의 이용 조건과 작가의 작품 판매 허용 답변 보존 | `assets/pipoya/LICENSE.txt` | 팩에는 별도 고지 파일 없음 |

## 원 출처

- 공식 상세: https://pipoya.itch.io/pipoya-free-rpg-character-sprites-32x32
- 작가 무료 소재 이용 규약: https://pipoya.net/sozai/terms-of-use/
- 무료 다운로드 진입: https://pipoya.itch.io/pipoya-free-rpg-character-sprites-32x32/purchase 의 “No thanks, just take me to the downloads”
- 원본 ZIP: `PIPOYA FREE RPG Character Sprites 32x32.zip` (itch.io upload_id `4257933`)
- 파일 다운로드 요청 주소: https://pipoya.itch.io/pipoya-free-rpg-character-sprites-32x32/file/4257933
- 실제 다운로드 URL(서명 만료 가능): https://itchio-mirror.cb031a832f44726753d6267436f3b414.r2.cloudflarestorage.com/upload2/game/480199/4257933?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=3edfcce40115d057d0b5606758e7e9ee%2F20261014%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20261014T020901Z&X-Amz-Expires=60&X-Amz-SignedHeaders=host&X-Amz-Signature=0cfdf439701ac6beec8b72c0bf22126d8ba952c9d22fe3a92849bff583f4a482
- 원본 ZIP SHA-256: 902dd6f9022da851af8510c0a7a19fa9a06c38d1201c23d86723d8d5a1f75c33
- 크레딧 권장 표기: `ぴぽや https://pipoya.net/`
- AI 학습: 명시적 허락 확인 안 됨. 이 프로젝트에서는 이미지 생성·학습 입력으로 사용하지 않음.

## 프레임 규격

두 PNG 모두 96×128 RGBA. 셀은 32×32, 여백·간격 없음.

| 방향 | 행 번호 | y | 프레임 x |
|---|---:|---:|---|
| 아래 | 0 | 0 | 0, 32, 64 |
| 왼쪽 | 1 | 32 | 0, 32, 64 |
| 오른쪽 | 2 | 64 | 0, 32, 64 |
| 위 | 3 | 96 | 0, 32, 64 |

- 자를 영역: `(col*32, row*32, col*32+32, row*32+32)`
- 정지: `col=1`. 전용 idle 루프는 없으며 정지 포즈임.
- 걷기: `col=[0,1,2,1]` 순환, 프레임당 150~200ms 권장.
- LCD: 원본 1배(32×32 셀) 또는 nearest-neighbor 2배(64×64 셀). 비정수 확대와 보간 금지.
- 실측 최대 불투명 영역은 인물 24×31px, 고양이 29×31px. 2배 시 가로 이동 여백을 남길 것.

## 채택

동일 팩의 사람·동물을 사용해 픽셀 격자와 윤곽을 맞췄다. 판타지 갑옷 대신 일상복 주민을 골라 아파트 맥락에 맞췄다. 전체 386개 PNG 중 2개만 포함한다. PNG는 원본 그대로이며 런타임에서 셀을 잘라 쓴다.
