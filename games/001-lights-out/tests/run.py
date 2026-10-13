# 로컬 테스트 실행기: pip install lupa 후 `python3 tests/run.py` (프로젝트 폴더에서)
import lupa
lupa.LuaRuntime().execute('dofile("tests/LightsOut.spec.lua")')
