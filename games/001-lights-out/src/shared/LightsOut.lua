-- Lights Out 퍼즐 규칙 (Roblox API를 쓰지 않는 순수 로직)
-- 칸을 누르면 그 칸과 상하좌우 칸의 불이 반전된다. 모든 불을 끄면 클리어.

local LightsOut = {}
LightsOut.__index = LightsOut

local NEIGHBORS = {
	{ 0, 0 },
	{ 1, 0 },
	{ -1, 0 },
	{ 0, 1 },
	{ 0, -1 },
}

function LightsOut.new(size)
	local self = setmetatable({}, LightsOut)
	self.size = size
	self.moves = 0
	self.cells = {}
	for row = 1, size do
		self.cells[row] = {}
		for col = 1, size do
			self.cells[row][col] = false
		end
	end
	return self
end

function LightsOut:isOn(row, col)
	return self.cells[row][col]
end

-- 누른 칸 기준으로 반전된 칸 목록을 돌려준다 (화면 갱신용)
function LightsOut:press(row, col)
	local changed = {}
	for _, offset in ipairs(NEIGHBORS) do
		local r, c = row + offset[1], col + offset[2]
		if r >= 1 and r <= self.size and c >= 1 and c <= self.size then
			self.cells[r][c] = not self.cells[r][c]
			table.insert(changed, { r, c })
		end
	end
	return changed
end

-- 플레이어 입력: 이동 횟수를 센다
function LightsOut:playerPress(row, col)
	self.moves = self.moves + 1
	return self:press(row, col)
end

function LightsOut:isSolved()
	for row = 1, self.size do
		for col = 1, self.size do
			if self.cells[row][col] then
				return false
			end
		end
	end
	return true
end

-- 꺼진 판에서 무작위로 눌러 섞으므로 항상 풀 수 있는 문제가 된다
function LightsOut:scramble(presses, random)
	random = random or math.random
	repeat
		for row = 1, self.size do
			for col = 1, self.size do
				self.cells[row][col] = false
			end
		end
		for _ = 1, presses do
			self:press(random(1, self.size), random(1, self.size))
		end
	until not self:isSolved()
	self.moves = 0
end

return LightsOut
