-- 순수 Lua 5.1 호환 테스트: LightsOut 규칙 검증
local LightsOut = dofile("src/shared/LightsOut.lua")

local function check(cond, msg)
	if not cond then error("FAIL: " .. msg, 2) end
	print("ok - " .. msg)
end

local function countOn(p)
	local n = 0
	for r = 1, p.size do for c = 1, p.size do if p:isOn(r, c) then n = n + 1 end end end
	return n
end

local p = LightsOut.new(3)
check(p:isSolved(), "새 판은 모두 꺼져 있다")
p:press(2, 2)
check(countOn(p) == 5, "가운데를 누르면 5칸이 켜진다")
p:press(2, 2)
check(p:isSolved(), "같은 칸을 두 번 누르면 원상복구")
check(#p:press(1, 1) == 3, "모서리는 3칸만 반전된다")

-- 섞기 결과는 항상 미완성 상태이고, 섞을 때 누른 칸을 다시 누르면 반드시 풀린다
for trial = 1, 200 do
	local rolls = {}
	local q = LightsOut.new(5)
	q:scramble(10, function(a, b)
		local v = math.random(a, b)
		table.insert(rolls, v)
		return v
	end)
	if q:isSolved() then error("FAIL: trial " .. trial .. " 섞은 판이 이미 풀려 있음") end
	if q.moves ~= 0 then error("FAIL: trial " .. trial .. " 이동 횟수 초기화 안 됨") end
	-- repeat 재시도가 있었을 수 있으므로 마지막 회차(10번 x 좌표 2개)만 재생
	for k = #rolls - 19, #rolls, 2 do q:press(rolls[k], rolls[k + 1]) end
	if not q:isSolved() then error("FAIL: trial " .. trial .. " 풀 수 없음") end
end
print("ok - 섞인 판 200개 모두 미완성 상태이며 풀이 가능")
