-- 맵(바닥, 스폰, 퍼즐판, 안내판)을 코드로 만들고 퍼즐 진행을 관리한다.
-- 퍼즐판은 서버의 모든 플레이어가 함께 푸는 공용 판이다.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local LightsOut = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("LightsOut"))

local TILE_SIZE = 6
local TILE_GAP = 1
local COLOR_ON = Color3.fromRGB(255, 214, 64)
local COLOR_OFF = Color3.fromRGB(45, 52, 70)

-- 레벨이 오를수록 판이 커지고 더 많이 섞인다
local LEVELS = {
	{ size = 3, presses = 3 },
	{ size = 4, presses = 5 },
	{ size = 5, presses = 7 },
	{ size = 5, presses = 10 },
}

local function makePart(props)
	local part = Instance.new("Part")
	part.Anchored = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in pairs(props) do
		part[key] = value
	end
	return part
end

local world = Instance.new("Folder")
world.Name = "PuzzleWorld"
world.Parent = workspace

makePart({
	Name = "Floor",
	Size = Vector3.new(120, 1, 120),
	Position = Vector3.new(0, -0.5, 0),
	Color = Color3.fromRGB(90, 140, 90),
	Material = Enum.Material.Grass,
	Parent = world,
})

local spawnLocation = Instance.new("SpawnLocation")
spawnLocation.Anchored = true
spawnLocation.Size = Vector3.new(8, 1, 8)
spawnLocation.Position = Vector3.new(0, 0.5, 30)
spawnLocation.Neutral = true
spawnLocation.Parent = world

-- 안내판
local sign = makePart({
	Name = "Sign",
	Size = Vector3.new(30, 12, 1),
	Position = Vector3.new(0, 8, -25),
	Color = Color3.fromRGB(30, 30, 40),
	Parent = world,
})
local gui = Instance.new("SurfaceGui")
gui.Face = Enum.NormalId.Back -- 스폰(+Z) 쪽을 향하는 면
gui.CanvasSize = Vector2.new(600, 240)
gui.Parent = sign
local label = Instance.new("TextLabel")
label.Size = UDim2.fromScale(1, 1)
label.BackgroundTransparency = 1
label.TextColor3 = Color3.new(1, 1, 1)
label.TextScaled = true
label.Font = Enum.Font.GothamBold
label.Parent = gui

local boardFolder = Instance.new("Folder")
boardFolder.Name = "Board"
boardFolder.Parent = world

local levelIndex = 1
local puzzle
local tiles = {}
local busy = false
local buildLevel -- 아래에서 정의 (클리어 시 다음 레벨 생성에 사용)

local function setSign(text)
	label.Text = text
end

local function refreshSign()
	setSign(string.format(
		"불 끄기 퍼즐 - 레벨 %d\n타일을 클릭하면 주변 불이 바뀝니다\n모든 불을 끄세요!  (이동 %d회)",
		levelIndex,
		puzzle.moves
	))
end

local function paintTile(row, col)
	local tile = tiles[row][col]
	local on = puzzle:isOn(row, col)
	tile.Color = on and COLOR_ON or COLOR_OFF
	tile.Material = on and Enum.Material.Neon or Enum.Material.SmoothPlastic
end

local function onTileClicked(row, col)
	if busy then
		return
	end
	for _, cell in ipairs(puzzle:playerPress(row, col)) do
		paintTile(cell[1], cell[2])
	end
	refreshSign()

	if puzzle:isSolved() then
		busy = true
		setSign(string.format("레벨 %d 클리어! (이동 %d회)\n다음 레벨 준비 중...", levelIndex, puzzle.moves))
		task.wait(3)
		levelIndex = levelIndex % #LEVELS + 1
		buildLevel()
		busy = false
	end
end

buildLevel = function()
	boardFolder:ClearAllChildren()
	tiles = {}

	local level = LEVELS[levelIndex]
	puzzle = LightsOut.new(level.size)
	puzzle:scramble(level.presses)

	local span = level.size * TILE_SIZE + (level.size - 1) * TILE_GAP
	local origin = -span / 2 + TILE_SIZE / 2
	for row = 1, level.size do
		tiles[row] = {}
		for col = 1, level.size do
			local tile = makePart({
				Name = string.format("Tile_%d_%d", row, col),
				Size = Vector3.new(TILE_SIZE, 1, TILE_SIZE),
				Position = Vector3.new(
					origin + (col - 1) * (TILE_SIZE + TILE_GAP),
					0.5,
					origin + (row - 1) * (TILE_SIZE + TILE_GAP) - 5
				),
				Parent = boardFolder,
			})
			local detector = Instance.new("ClickDetector")
			detector.MaxActivationDistance = 60
			detector.Parent = tile
			detector.MouseClick:Connect(function()
				onTileClicked(row, col)
			end)
			tiles[row][col] = tile
			paintTile(row, col)
		end
	end
	refreshSign()
end

buildLevel()
