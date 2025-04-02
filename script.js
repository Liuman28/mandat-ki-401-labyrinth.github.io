// ==================== Глобальні змінні ====================
const canvas = document.getElementById("mazeCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("darkOverlay");
const difficultySelect = document.getElementById("difficultySelect");
const customSizeInput = document.getElementById("customSize");

let trapsEnabled = true;
let multiLevel = false; // Режим кампанії
let currentLevel = 1;
let cols = 20, rows = 20;
let cellSize = 600 / cols;

let squareGrid = [];
let squareStack = [];
let solutionSet = new Set();

const player = { x: 0, y: 0, pixelX: 0, pixelY: 0, radius: 0 };

let timeLimit = 60;
let timeRemaining = timeLimit;
let timerInterval = null;
let bacchanaliaInterval = null;  // Для режиму "Вакханалія"

// Глобальні змінні для фінішу
let finishX = 0;
let finishY = 0;

// Флаг, щоб finishLevel() викликався лише один раз
let levelFinished = false;

// ==================== Функції генерації лабіринту ====================
function cellKey(x, y) {
  return `${x},${y}`;
}

function initGrid() {
  squareGrid = [];
  for (let y = 0; y < rows; y++) {
    let row = [];
    for (let x = 0; x < cols; x++) {
      row.push({
        x, y,
        walls: { top: true, right: true, bottom: true, left: true },
        visited: false,
        trap: false
      });
    }
    squareGrid.push(row);
  }
  console.log("Grid ініціалізовано");
}

function getNeighbor(cell) {
  const directions = [
    { dx: 0, dy: -1, wall: "top", opposite: "bottom" },
    { dx: 1, dy: 0, wall: "right", opposite: "left" },
    { dx: 0, dy: 1, wall: "bottom", opposite: "top" },
    { dx: -1, dy: 0, wall: "left", opposite: "right" }
  ];
  let neighbors = [];
  for (let d of directions) {
    let nx = cell.x + d.dx, ny = cell.y + d.dy;
    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
      let neighbor = squareGrid[ny][nx];
      if (!neighbor.visited) neighbors.push({ neighbor, wall: d.wall, opposite: d.opposite });
    }
  }
  if (neighbors.length > 0) return neighbors[Math.floor(Math.random() * neighbors.length)];
  return undefined;
}

function removeWalls(current, next, wall, opposite) {
  current.walls[wall] = false;
  next.walls[opposite] = false;
}

function generateMaze() {
  squareStack = [];
  const start = squareGrid[0][0];
  start.visited = true;
  squareStack.push(start);
  while (squareStack.length > 0) {
    let current = squareStack[squareStack.length - 1];
    let nextInfo = getNeighbor(current);
    if (nextInfo) {
      let { neighbor, wall, opposite } = nextInfo;
      neighbor.visited = true;
      removeWalls(current, neighbor, wall, opposite);
      squareStack.push(neighbor);
    } else {
      squareStack.pop();
    }
  }
  console.log("Maze згенеровано");
}

// Функція вибору фінішної клітинки (20%-50% від max відстані)
function chooseFinishCell() {
  let dist = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  let queue = [];
  dist[0][0] = 0;
  queue.push({ x: 0, y: 0 });
  while (queue.length > 0) {
    let cell = queue.shift();
    let d = dist[cell.y][cell.x];
    const directions = [
      { dx: 0, dy: -1, wall: "top" },
      { dx: 1, dy: 0, wall: "right" },
      { dx: 0, dy: 1, wall: "bottom" },
      { dx: -1, dy: 0, wall: "left" }
    ];
    for (let dir of directions) {
      let nx = cell.x + dir.dx, ny = cell.y + dir.dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        if (!squareGrid[cell.y][cell.x].walls[dir.wall] && dist[ny][nx] > d + 1) {
          dist[ny][nx] = d + 1;
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }
  let maxDist = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (dist[y][x] < Infinity && dist[y][x] > maxDist) {
        maxDist = dist[y][x];
      }
    }
  }
  // Встановлюємо діапазон, наприклад від 70% до 90% від maxDist
  const minSteps = Math.ceil(0.7 * maxDist);
  const maxSteps = Math.floor(0.9 * maxDist);
  let candidates = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (x === 0 && y === 0) continue; // не вибираємо старт
      if (dist[y][x] >= minSteps && dist[y][x] <= maxSteps) {
        candidates.push({ x, y, steps: dist[y][x] });
      }
    }
  }
  if (candidates.length > 0) {
    let choice = candidates[Math.floor(Math.random() * candidates.length)];
    console.log(`Фініш обрано: (${choice.x}, ${choice.y}), шлях = ${choice.steps} кроків (maxDist = ${maxDist})`);
    return { finishX: choice.x, finishY: choice.y };
  }
  console.log("Кандидатів для finish не знайдено, використовується стандартний фініш");
  return { finishX: cols - 1, finishY: rows - 1 };
}

function computeSolutionPath() {
  let queue = [];
  let visitedArr = Array.from({ length: rows }, () => Array(cols).fill(false));
  let predecessor = Array.from({ length: rows }, () => Array(cols).fill(null));
  queue.push(squareGrid[0][0]);
  visitedArr[0][0] = true;
  while (queue.length > 0) {
    let cell = queue.shift();
    if (cell.x === finishX && cell.y === finishY) break;
    const directions = [
      { dx: 0, dy: -1, wall: "top" },
      { dx: 1, dy: 0, wall: "right" },
      { dx: 0, dy: 1, wall: "bottom" },
      { dx: -1, dy: 0, wall: "left" }
    ];
    for (let d of directions) {
      if (!cell.walls[d.wall]) {
        let nx = cell.x + d.dx, ny = cell.y + d.dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visitedArr[ny][nx]) {
          visitedArr[ny][nx] = true;
          predecessor[ny][nx] = cell;
          queue.push(squareGrid[ny][nx]);
        }
      }
    }
  }
  solutionSet.clear();
  let cell = squareGrid[finishY][finishX];
  while (cell) {
    solutionSet.add(cellKey(cell.x, cell.y));
    cell = predecessor[cell.y][cell.x];
  }
  console.log("Solution path обчислено");
}

function generateTraps() {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if ((x === 0 && y === 0) || (x === finishX && y === finishY)) continue;
      if (solutionSet.has(cellKey(x, y))) continue;
      if (Math.random() < 0.1) squareGrid[y][x].trap = true;
    }
  }
  console.log("Пастки згенеровано");
}

// ==================== Режим "Вакханалія" ====================
function startBacchanaliaMode() {
  if (bacchanaliaInterval) clearInterval(bacchanaliaInterval);
  bacchanaliaInterval = setInterval(() => {
    regenerateMazeBacchanalia();
  }, 1000);
}

function stopBacchanaliaMode() {
  if (bacchanaliaInterval) clearInterval(bacchanaliaInterval);
  bacchanaliaInterval = null;
}

function regenerateMazeBacchanalia() {
  const savedX = player.x;
  const savedY = player.y;
  initGrid();
  generateMaze();
  computeSolutionPath();
  if (trapsEnabled) generateTraps();
  player.x = savedX;
  player.y = savedY;
  player.pixelX = savedX * cellSize + cellSize / 2;
  player.pixelY = savedY * cellSize + cellSize / 2;
  drawEverything();
}

// ==================== Малювання ====================
function drawEverything() {
  ctx.clearRect(0, 0, 600, 600);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, 600, 600);
  drawMaze();
  drawPlayer();
  if (document.getElementById("darkModeToggle").checked) {
    overlay.style.display = "block";
    updateDarkOverlay();
  } else {
    overlay.style.display = "none";
  }
}

function drawMaze() {
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let cell = squareGrid[y][x];
      let x1 = x * cellSize;
      let y1 = y * cellSize;
      if (cell.walls.top) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + cellSize, y1);
        ctx.stroke();
      }
      if (cell.walls.right) {
        ctx.beginPath();
        ctx.moveTo(x1 + cellSize, y1);
        ctx.lineTo(x1 + cellSize, y1 + cellSize);
        ctx.stroke();
      }
      if (cell.walls.bottom) {
        ctx.beginPath();
        ctx.moveTo(x1 + cellSize, y1 + cellSize);
        ctx.lineTo(x1, y1 + cellSize);
        ctx.stroke();
      }
      if (cell.walls.left) {
        ctx.beginPath();
        ctx.moveTo(x1, y1 + cellSize);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
  }
}

function drawPlayer() {
  ctx.fillStyle = "rgba(0,255,0,0.3)";
  ctx.fillRect(finishX * cellSize, finishY * cellSize, cellSize, cellSize);
  ctx.fillStyle = "#ff0";
  ctx.beginPath();
  ctx.arc(player.pixelX, player.pixelY, player.radius, 0, Math.PI * 2);
  ctx.fill();
}

// ==================== Рух гравця ====================
function initPlayer() {
  player.x = 0;
  player.y = 0;
  player.pixelX = cellSize / 2;
  player.pixelY = cellSize / 2;
  player.radius = cellSize / 4;
  levelFinished = false;
}

function teleportPlayer() {
  let newX, newY;
  do {
    newX = Math.floor(Math.random() * cols);
    newY = Math.floor(Math.random() * rows);
  } while (squareGrid[newY][newX].trap);
  player.x = newX;
  player.y = newY;
  player.pixelX = newX * cellSize + cellSize / 2;
  player.pixelY = newY * cellSize + cellSize / 2;
  drawEverything();
}

function animatePlayerMove(targetX, targetY) {
  const startX = player.pixelX;
  const startY = player.pixelY;
  const endX = targetX * cellSize + cellSize / 2;
  const endY = targetY * cellSize + cellSize / 2;
  const duration = 200;
  let startTime = null;
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    let progress = (timestamp - startTime) / duration;
    if (progress > 1) progress = 1;
    player.pixelX = startX + (endX - startX) * progress;
    player.pixelY = startY + (endY - startY) * progress;
    drawEverything();
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      player.x = targetX;
      player.y = targetY;
      let cell = squareGrid[player.y][player.x];
      if (cell.trap) {
        cell.trap = false;
        setTimeout(() => {
          alert("Пастка спрацювала! Вас телепортують.");
          teleportPlayer();
        }, 50);
      }
      if (player.x === finishX && player.y === finishY && !levelFinished) {
        levelFinished = true;
        setTimeout(() => {
          finishLevel();
        }, 50);
      }
    }
  }
  requestAnimationFrame(animate);
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  let direction = null;
  if (e.key === "ArrowUp") direction = "up";
  else if (e.key === "ArrowDown") direction = "down";
  else if (e.key === "ArrowLeft") direction = "left";
  else if (e.key === "ArrowRight") direction = "right";
  if (direction) attemptMove(direction);
});

function attemptMove(direction) {
  let current = squareGrid[player.y][player.x];
  let targetX = player.x, targetY = player.y;
  if (direction === "up" && !current.walls.top) targetY--;
  else if (direction === "right" && !current.walls.right) targetX++;
  else if (direction === "down" && !current.walls.bottom) targetY++;
  else if (direction === "left" && !current.walls.left) targetX--;
  if (targetX < 0 || targetX >= cols || targetY < 0 || targetY >= rows) return;
  animatePlayerMove(targetX, targetY);
}

// ==================== Таймер ====================
function startTimer() {
  timeRemaining = timeLimit;
  updateRightPanelText();
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateRightPanelText();
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      alert("Час вичерпано! Гру завершено.");
    }
  }, 1000);
}

// ==================== Оновлення overlay ====================
function updateDarkOverlay() {
  overlay.style.background = `
    radial-gradient(
      circle at ${player.pixelX}px ${player.pixelY}px,
      rgba(0,0,0,0) 80px,
      rgba(0,0,0,0.95) 81px
    )
  `;
}

// ==================== Завершення рівня ====================
function finishLevel() {
  clearInterval(timerInterval);
  if (multiLevel) {
    currentLevel++;
    alert(`Рівень пройдено! Переходимо до рівня ${currentLevel}...`);
    nextLevel();
  } else {
    alert("Вітаємо! Ви вийшли з лабіринту!");
  }
}

function nextLevel() {
  const diffs = [10, 20, 30];
  const randDiff = diffs[Math.floor(Math.random() * diffs.length)];
  cols = randDiff;
  rows = randDiff;
  cellSize = 600 / cols;
  if (randDiff === 10) timeLimit = 60;
  else if (randDiff === 20) timeLimit = 90;
  else if (randDiff === 30) timeLimit = 120;
  const randomDark = Math.random() < 0.5;
  document.getElementById("darkModeToggle").checked = randomDark;
  const randomTime = Math.random() < 0.5;
  document.getElementById("timeToggle").checked = !randomTime;
  if (randDiff !== 10) {
    const finish = chooseFinishCell();
    finishX = finish.finishX;
    finishY = finish.finishY;
  } else {
    finishX = cols - 1;
    finishY = rows - 1;
  }
  initGrid();
  generateMaze();
  computeSolutionPath();
  if (trapsEnabled) generateTraps();
  initPlayer();
  updateRightPanelText();
  drawEverything();
  if (!document.getElementById("timeToggle").checked) {
    startTimer();
  }
  if (document.getElementById("bacchanaliaToggle").checked) {
    startBacchanaliaMode();
  } else {
    stopBacchanaliaMode();
  }
}

function updateRightPanelText() {
  const statusTextEl = document.getElementById("statusText");
  const timerDisplayEl = document.getElementById("timerDisplay");
  const noTime = document.getElementById("timeToggle").checked;
  multiLevel = document.getElementById("multiLevelToggle").checked;
  if (multiLevel) {
    statusTextEl.textContent = `Кампанія: рівень ${currentLevel}`;
  } else {
    statusTextEl.textContent = `Рівень: ${cols}x${rows}`;
  }
  if (noTime) {
    timerDisplayEl.style.display = "none";
  } else {
    timerDisplayEl.style.display = "inline";
    timerDisplayEl.textContent = `Час: ${timeRemaining}`;
  }
}

// ==================== Режим "Вакханалія" ====================
function startBacchanaliaMode() {
  if (bacchanaliaInterval) clearInterval(bacchanaliaInterval);
  bacchanaliaInterval = setInterval(() => {
    regenerateMazeBacchanalia();
  }, 1000);
}

function stopBacchanaliaMode() {
  if (bacchanaliaInterval) clearInterval(bacchanaliaInterval);
  bacchanaliaInterval = null;
}

function regenerateMazeBacchanalia() {
  const savedX = player.x;
  const savedY = player.y;
  initGrid();
  generateMaze();
  computeSolutionPath();
  if (trapsEnabled) generateTraps();
  player.x = savedX;
  player.y = savedY;
  player.pixelX = savedX * cellSize + cellSize / 2;
  player.pixelY = savedY * cellSize + cellSize / 2;
  drawEverything();
}

// ==================== Пасхалка: Код Конамі ====================
const konamiSequence = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let konamiPosition = 0;
document.addEventListener("keydown", function(e) {
  const key = e.key.toLowerCase();
  if (key === konamiSequence[konamiPosition].toLowerCase()) {
    konamiPosition++;
    if (konamiPosition === konamiSequence.length) {
      activateKonamiEasterEgg();
      konamiPosition = 0;
    }
  } else {
    konamiPosition = 0;
  }
});

function generateFireworks() {
  let fwContainer = document.createElement("div");
  fwContainer.id = "fireworksContainer";
  fwContainer.style.position = "fixed";
  fwContainer.style.top = "0";
  fwContainer.style.left = "0";
  fwContainer.style.width = "100%";
  fwContainer.style.height = "100%";
  fwContainer.style.pointerEvents = "none";
  fwContainer.style.zIndex = "10000";
  document.body.appendChild(fwContainer);
  const colors = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"];
  for (let i = 0; i < 1000; i++) {
    let firework = document.createElement("div");
    firework.style.position = "absolute";
    firework.style.width = "12px";
    firework.style.height = "12px";
    firework.style.background = colors[Math.floor(Math.random() * colors.length)];
    firework.style.borderRadius = "50%";
    firework.style.left = Math.random() * 100 + "%";
    firework.style.top = Math.random() * 100 + "%";
    firework.style.opacity = "1";
    firework.style.transition = "all 1s ease-out";
    fwContainer.appendChild(firework);
    setTimeout(() => {
      firework.style.transform = `translateY(-${Math.random() * 200 + 50}px)`;
      firework.style.opacity = "0";
    }, Math.random() * 3000);
  }
  setTimeout(() => {
    fwContainer.remove();
  }, 3000);
}

function showEasterEggOverlay() {
  let overlayElem = document.createElement("div");
  overlayElem.id = "easterEggOverlay";
  overlayElem.style.position = "fixed";
  overlayElem.style.top = "0";
  overlayElem.style.left = "0";
  overlayElem.style.width = "100%";
  overlayElem.style.height = "100%";
  overlayElem.style.background = "rgba(0, 0, 0, 0.8)";
  overlayElem.style.display = "flex";
  overlayElem.style.justifyContent = "center";
  overlayElem.style.alignItems = "center";
  overlayElem.style.zIndex = "10001";
  overlayElem.innerHTML = "<h1 style='color: #ffcc00; font-size: 48px; text-align: center;'>Вітаємо! Ти знайшов пасхалку!</h1>";
  document.body.appendChild(overlayElem);
  setTimeout(() => {
    overlayElem.remove();
  }, 5000);
}

function activateKonamiEasterEgg() {
  generateFireworks();
  setTimeout(() => {
    showEasterEggOverlay();
  }, 3000);
}

// ==================== Запуск гри ====================
function startGame() {
  multiLevel = document.getElementById("multiLevelToggle").checked;
  currentLevel = 1;
  let diffVal = difficultySelect.value;
  if (diffVal === "custom") {
    diffVal = parseInt(customSizeInput.value) || 25;
  } else {
    diffVal = parseInt(diffVal);
  }
  cols = diffVal; rows = diffVal;
  cellSize = 600 / cols;
  if (diffVal === 10) timeLimit = 60;
  else if (diffVal === 20) timeLimit = 90;
  else if (diffVal === 30) timeLimit = 120;
  else {
    timeLimit = Math.max(60, Math.floor(60 * (diffVal / 10)));
  }
  trapsEnabled = document.getElementById("trapsToggle").checked;
  if (timerInterval) clearInterval(timerInterval);
  if (diffVal === 10) {
    finishX = cols - 1;
    finishY = rows - 1;
  } else {
    const finish = chooseFinishCell();
    finishX = finish.finishX;
    finishY = finish.finishY;
  }
  initGrid();
  generateMaze();
  computeSolutionPath();
  if (trapsEnabled) generateTraps();
  initPlayer();
  drawEverything();
  updateRightPanelText();
  if (!document.getElementById("timeToggle").checked) {
    startTimer();
  }
  if (document.getElementById("bacchanaliaToggle").checked) {
    startBacchanaliaMode();
  } else {
    stopBacchanaliaMode();
  }
}

document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("placeholder").style.display = "none";
  document.getElementById("mazeCanvas").style.display = "block";
  const darkMode = document.getElementById("darkModeToggle").checked;
  overlay.style.display = darkMode ? "block" : "none";
  startGame();
});

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  let direction = null;
  if (e.key === "ArrowUp") direction = "up";
  else if (e.key === "ArrowDown") direction = "down";
  else if (e.key === "ArrowLeft") direction = "left";
  else if (e.key === "ArrowRight") direction = "right";
  if (direction) attemptMove(direction);
});

function attemptMove(direction) {
  let current = squareGrid[player.y][player.x];
  let targetX = player.x, targetY = player.y;
  if (direction === "up" && !current.walls.top) targetY--;
  else if (direction === "right" && !current.walls.right) targetX++;
  else if (direction === "down" && !current.walls.bottom) targetY++;
  else if (direction === "left" && !current.walls.left) targetX--;
  if (targetX < 0 || targetX >= cols || targetY < 0 || targetY >= rows) return;
  animatePlayerMove(targetX, targetY);
}

function animatePlayerMove(targetX, targetY) {
  const startX = player.pixelX;
  const startY = player.pixelY;
  const endX = targetX * cellSize + cellSize / 2;
  const endY = targetY * cellSize + cellSize / 2;
  const duration = 200;
  let startTime = null;
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    let progress = (timestamp - startTime) / duration;
    if (progress > 1) progress = 1;
    player.pixelX = startX + (endX - startX) * progress;
    player.pixelY = startY + (endY - startY) * progress;
    drawEverything();
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      player.x = targetX;
      player.y = targetY;
      let cell = squareGrid[player.y][player.x];
      if (cell.trap) {
        cell.trap = false;
        setTimeout(() => {
          alert("Пастка спрацювала! Вас телепортують.");
          teleportPlayer();
        }, 50);
      }
      if (player.x === finishX && player.y === finishY && !levelFinished) {
        levelFinished = true;
        setTimeout(() => {
          finishLevel();
        }, 50);
      }
    }
  }
  requestAnimationFrame(animate);
}

function startTimer() {
  timeRemaining = timeLimit;
  updateRightPanelText();
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateRightPanelText();
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      alert("Час вичерпано! Гру завершено.");
    }
  }, 1000);
}

function updateDarkOverlay() {
  overlay.style.background = `
    radial-gradient(
      circle at ${player.pixelX}px ${player.pixelY}px,
      rgba(0,0,0,0) 80px,
      rgba(0,0,0,0.95) 81px
    )
  `;
}

function finishLevel() {
  clearInterval(timerInterval);
  if (multiLevel) {
    currentLevel++;
    alert(`Рівень пройдено! Переходимо до рівня ${currentLevel}...`);
    nextLevel();
  } else {
    alert("Вітаємо! Ви вийшли з лабіринту!");
  }
}

function nextLevel() {
  const diffs = [10, 20, 30];
  const randDiff = diffs[Math.floor(Math.random() * diffs.length)];
  cols = randDiff;
  rows = randDiff;
  cellSize = 600 / cols;
  if (randDiff === 10) timeLimit = 60;
  else if (randDiff === 20) timeLimit = 90;
  else if (randDiff === 30) timeLimit = 120;
  const randomDark = Math.random() < 0.5;
  document.getElementById("darkModeToggle").checked = randomDark;
  const randomTime = Math.random() < 0.5;
  document.getElementById("timeToggle").checked = !randomTime;
  if (randDiff !== 10) {
    const finish = chooseFinishCell();
    finishX = finish.finishX;
    finishY = finish.finishY;
  } else {
    finishX = cols - 1;
    finishY = rows - 1;
  }
  initGrid();
  generateMaze();
  computeSolutionPath();
  if (trapsEnabled) generateTraps();
  initPlayer();
  updateRightPanelText();
  drawEverything();
  if (!document.getElementById("timeToggle").checked) {
    startTimer();
  }
  if (document.getElementById("bacchanaliaToggle").checked) {
    startBacchanaliaMode();
  } else {
    stopBacchanaliaMode();
  }
}

function updateRightPanelText() {
  const statusTextEl = document.getElementById("statusText");
  const timerDisplayEl = document.getElementById("timerDisplay");
  const noTime = document.getElementById("timeToggle").checked;
  multiLevel = document.getElementById("multiLevelToggle").checked;
  if (multiLevel) {
    statusTextEl.textContent = `Кампанія: рівень ${currentLevel}`;
  } else {
    statusTextEl.textContent = `Рівень: ${cols}x${rows}`;
  }
  if (noTime) {
    timerDisplayEl.style.display = "none";
  } else {
    timerDisplayEl.style.display = "inline";
    timerDisplayEl.textContent = `Час: ${timeRemaining}`;
  }
}

function startGame() {
  multiLevel = document.getElementById("multiLevelToggle").checked;
  currentLevel = 1;
  let diffVal = difficultySelect.value;
  if (diffVal === "custom") {
    diffVal = parseInt(customSizeInput.value) || 25;
  } else {
    diffVal = parseInt(diffVal);
  }
  cols = diffVal; rows = diffVal;
  cellSize = 600 / cols;
  if (diffVal === 10) timeLimit = 60;
  else if (diffVal === 20) timeLimit = 90;
  else if (diffVal === 30) timeLimit = 120;
  else {
    timeLimit = Math.max(60, Math.floor(60 * (diffVal / 10)));
  }
  trapsEnabled = document.getElementById("trapsToggle").checked;
  if (timerInterval) clearInterval(timerInterval);
  if (diffVal === 10) {
    finishX = cols - 1;
    finishY = rows - 1;
  } else {
    const finish = chooseFinishCell();
    finishX = finish.finishX;
    finishY = finish.finishY;
  }
  initGrid();
  generateMaze();
  computeSolutionPath();
  if (trapsEnabled) generateTraps();
  initPlayer();
  drawEverything();
  updateRightPanelText();
  if (!document.getElementById("timeToggle").checked) {
    startTimer();
  }
  if (document.getElementById("bacchanaliaToggle").checked) {
    startBacchanaliaMode();
  } else {
    stopBacchanaliaMode();
  }
}

document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("placeholder").style.display = "none";
  document.getElementById("mazeCanvas").style.display = "block";
  const darkMode = document.getElementById("darkModeToggle").checked;
  overlay.style.display = darkMode ? "block" : "none";
  startGame();
});

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  let direction = null;
  if (e.key === "ArrowUp") direction = "up";
  else if (e.key === "ArrowDown") direction = "down";
  else if (e.key === "ArrowLeft") direction = "left";
  else if (e.key === "ArrowRight") direction = "right";
  if (direction) attemptMove(direction);
});

function attemptMove(direction) {
  let current = squareGrid[player.y][player.x];
  let targetX = player.x, targetY = player.y;
  if (direction === "up" && !current.walls.top) targetY--;
  else if (direction === "right" && !current.walls.right) targetX++;
  else if (direction === "down" && !current.walls.bottom) targetY++;
  else if (direction === "left" && !current.walls.left) targetX--;
  if (targetX < 0 || targetX >= cols || targetY < 0 || targetY >= rows) return;
  animatePlayerMove(targetX, targetY);
}

function animatePlayerMove(targetX, targetY) {
  const startX = player.pixelX;
  const startY = player.pixelY;
  const endX = targetX * cellSize + cellSize / 2;
  const endY = targetY * cellSize + cellSize / 2;
  const duration = 200;
  let startTime = null;
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    let progress = (timestamp - startTime) / duration;
    if (progress > 1) progress = 1;
    player.pixelX = startX + (endX - startX) * progress;
    player.pixelY = startY + (endY - startY) * progress;
    drawEverything();
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      player.x = targetX;
      player.y = targetY;
      let cell = squareGrid[player.y][player.x];
      if (cell.trap) {
        cell.trap = false;
        setTimeout(() => {
          alert("Пастка спрацювала! Вас телепортують.");
          teleportPlayer();
        }, 50);
      }
      if (player.x === finishX && player.y === finishY && !levelFinished) {
        levelFinished = true;
        setTimeout(() => {
          finishLevel();
        }, 50);
      }
    }
  }
  requestAnimationFrame(animate);
}

function startTimer() {
  timeRemaining = timeLimit;
  updateRightPanelText();
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateRightPanelText();
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      alert("Час вичерпано! Гру завершено.");
    }
  }, 1000);
}

function updateDarkOverlay() {
  overlay.style.background = `
    radial-gradient(
      circle at ${player.pixelX}px ${player.pixelY}px,
      rgba(0,0,0,0) 80px,
      rgba(0,0,0,0.95) 81px
    )
  `;
}

function finishLevel() {
  clearInterval(timerInterval);
  if (multiLevel) {
    currentLevel++;
    alert(`Рівень пройдено! Переходимо до рівня ${currentLevel}...`);
    nextLevel();
  } else {
    alert("Вітаємо! Ви вийшли з лабіринту!");
  }
}

function nextLevel() {
  const diffs = [10, 20, 30];
  const randDiff = diffs[Math.floor(Math.random() * diffs.length)];
  cols = randDiff;
  rows = randDiff;
  cellSize = 600 / cols;
  if (randDiff === 10) timeLimit = 60;
  else if (randDiff === 20) timeLimit = 90;
  else if (randDiff === 30) timeLimit = 120;
  const randomDark = Math.random() < 0.5;
  document.getElementById("darkModeToggle").checked = randomDark;
  const randomTime = Math.random() < 0.5;
  document.getElementById("timeToggle").checked = !randomTime;
  if (randDiff !== 10) {
    const finish = chooseFinishCell();
    finishX = finish.finishX;
    finishY = finish.finishY;
  } else {
    finishX = cols - 1;
    finishY = rows - 1;
  }
  initGrid();
  generateMaze();
  computeSolutionPath();
  if (trapsEnabled) generateTraps();
  initPlayer();
  updateRightPanelText();
  drawEverything();
  if (!document.getElementById("timeToggle").checked) {
    startTimer();
  }
  if (document.getElementById("bacchanaliaToggle").checked) {
    startBacchanaliaMode();
  } else {
    stopBacchanaliaMode();
  }
}

function updateRightPanelText() {
  const statusTextEl = document.getElementById("statusText");
  const timerDisplayEl = document.getElementById("timerDisplay");
  const noTime = document.getElementById("timeToggle").checked;
  multiLevel = document.getElementById("multiLevelToggle").checked;
  if (multiLevel) {
    statusTextEl.textContent = `Кампанія: рівень ${currentLevel}`;
  } else {
    statusTextEl.textContent = `Рівень: ${cols}x${rows}`;
  }
  if (noTime) {
    timerDisplayEl.style.display = "none";
  } else {
    timerDisplayEl.style.display = "inline";
    timerDisplayEl.textContent = `Час: ${timeRemaining}`;
  }
}

function startBacchanaliaMode() {
  if (bacchanaliaInterval) clearInterval(bacchanaliaInterval);
  bacchanaliaInterval = setInterval(() => {
    regenerateMazeBacchanalia();
  }, 1000);
}

function stopBacchanaliaMode() {
  if (bacchanaliaInterval) clearInterval(bacchanaliaInterval);
  bacchanaliaInterval = null;
}

function regenerateMazeBacchanalia() {
  const savedX = player.x;
  const savedY = player.y;
  initGrid();
  generateMaze();
  computeSolutionPath();
  if (trapsEnabled) generateTraps();
  player.x = savedX;
  player.y = savedY;
  player.pixelX = savedX * cellSize + cellSize / 2;
  player.pixelY = savedY * cellSize + cellSize / 2;
  drawEverything();
}

function startGame() {
  multiLevel = document.getElementById("multiLevelToggle").checked;
  currentLevel = 1;
  let diffVal = difficultySelect.value;
  if (diffVal === "custom") {
    diffVal = parseInt(customSizeInput.value) || 25;
  } else {
    diffVal = parseInt(diffVal);
  }
  cols = diffVal; rows = diffVal;
  cellSize = 600 / cols;
  if (diffVal === 10) timeLimit = 60;
  else if (diffVal === 20) timeLimit = 90;
  else if (diffVal === 30) timeLimit = 120;
  else {
    timeLimit = Math.max(60, Math.floor(60 * (diffVal / 10)));
  }
  trapsEnabled = document.getElementById("trapsToggle").checked;
  
 
  initGrid();
  generateMaze();
  
  
  if (diffVal === 10) {
    finishX = cols - 1;
    finishY = rows - 1;
  } else {
    const finish = chooseFinishCell();
    finishX = finish.finishX;
    finishY = finish.finishY;
  }
  

  computeSolutionPath();
  if (trapsEnabled) generateTraps();
  initPlayer();
  drawEverything();
  updateRightPanelText();
  if (!document.getElementById("timeToggle").checked) {
    startTimer();
  }
  if (document.getElementById("bacchanaliaToggle").checked) {
    startBacchanaliaMode();
  } else {
    stopBacchanaliaMode();
  }
}


document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("placeholder").style.display = "none";
  document.getElementById("mazeCanvas").style.display = "block";
  const darkMode = document.getElementById("darkModeToggle").checked;
  overlay.style.display = darkMode ? "block" : "none";
  startGame();
});
