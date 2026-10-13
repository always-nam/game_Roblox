# 로블록스 게임1 test — 불 끄기(Lights Out) 퍼즐

타일을 클릭하면 그 타일과 상하좌우 타일의 불이 켜지거나 꺼집니다. **모든 불을 끄면 클리어**, 다음 레벨(3×3 → 4×4 → 5×5)로 넘어갑니다.

맵(바닥·스폰·퍼즐판·안내판)은 전부 스크립트가 만들기 때문에 Roblox Studio에서 맵을 꾸미지 않아도 됩니다.

## 폴더 구성
| 경로 | 역할 |
|---|---|
| `default.project.json` | Rojo 프로젝트 설정 (파일 → 게임 파일 매핑) |
| `src/shared/LightsOut.lua` | 퍼즐 규칙 (Roblox API 없는 순수 로직) |
| `src/server/PuzzleBoard.server.lua` | 맵 생성, 클릭 처리, 레벨 진행 |
| `tests/` | 퍼즐 규칙 자동 테스트 |

## 빌드
```bash
rojo build -o LightsOut.rbxl
```
만들어진 `LightsOut.rbxl`을 Roblox Studio로 열고 ▶ Play로 테스트합니다.

## 테스트
```bash
pip install lupa
python3 tests/run.py
```

## 자동 게시 (GitHub Actions)
이 폴더가 바뀌어 push되면 `.github/workflows/roblox-publish.yml`이 테스트 → 빌드 → Roblox 게시를 자동으로 합니다.
저장소 **Settings → Secrets and variables → Actions**에 아래 3개를 등록해야 게시까지 진행됩니다 (없으면 빌드까지만).

| 종류 | 이름 | 값 |
|---|---|---|
| Secret | `ROBLOX_API_KEY` | Creator Hub에서 만든 Open Cloud API 키 (universe-places 쓰기 권한) |
| Variable | `ROBLOX_UNIVERSE_ID` | 게임의 Universe ID |
| Variable | `ROBLOX_PLACE_ID` | 게임의 Place ID |

게임 주소: `https://www.roblox.com/games/<ROBLOX_PLACE_ID>`

## 진행 상태
- [x] 폴더 생성
- [x] 퍼즐 규칙 + 맵 생성 스크립트
- [x] 규칙 자동 테스트
- [ ] Studio에서 실제 플레이 확인 (남대표님)
- [x] 자동 게시 워크플로 작성
- [ ] 게임 생성 + API 키/ID 등록 (남대표님)
