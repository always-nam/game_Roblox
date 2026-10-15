# 게임 목록

게임마다 폴더 하나(`NNN-영문이름`)를 쓰고, 이 폴더가 바뀌어 push되면
`.github/workflows/roblox-publish.yml`이 그 게임만 테스트 → 빌드 → Roblox에 게시합니다.

| 번호 | 게임 | 상태 | 주소 |
|---|---|---|---|
| 001 | 불 끄기 퍼즐 (Lights Out) | 모바일 테스트 대기 | https://www.roblox.com/games/78438712568892 |

## 새 게임 추가 순서
1. (남대표님) Roblox Studio에서 새 Experience 게시 → 명령줄에서 `print(game.GameId, game.PlaceId)` 로 ID 확인
2. (Claude) `games/NNN-이름/` 폴더 생성: `game.json`(universeId, placeId), `default.project.json`, `src/`, `README.md`(기획·진행 상황)
3. push → 자동 게시 → 게임 주소로 모바일 테스트

## 주의
- 게임 내용은 GitHub 코드에서만 수정합니다. Studio에서 고친 내용은 다음 자동 게시 때 덮어써집니다.
- 썸네일·설명·영상 등 Creator Hub 설정은 게임 파일과 별개입니다.
- API 키(Secret `ROBLOX_API_KEY`)는 60일간 사용하지 않으면 자동 만료됩니다.
