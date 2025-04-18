const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables
let player = { x: 400, y: 300, width: 20, height: 20, speed: 5 };
let keys = {};
let score = 0;

// Enemy variables
let enemies = [
  { x: 100, y: 100, width: 20, height: 20, speed: 2 },
  { x: 700, y: 200, width: 20, height: 20, speed: 3 },
];

// Bullet variables
let bullets = [];

// Mouse variables
let mouse = { x: 0, y: 0 };

// Event listeners for movement
document.addEventListener('keydown', (e) => (keys[e.key] = true));
document.addEventListener('keyup', (e) => (keys[e.key] = false));

// Track mouse movement
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

// Shoot bullets
document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    bullets.push({ x: player.x + player.width / 2 - 2, y: player.y, width: 4, height: 10, speed: 7 });
  }
});

// Fire bullets on left click
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // Left mouse button
    const angle = Math.atan2(mouse.y - (player.y + player.height / 2), mouse.x - (player.x + player.width / 2));
    bullets.push({
      x: player.x + player.width / 2,
      y: player.y + player.height / 2,
      angle: angle,
      speed: 7,
    });
  }
});

// Game loop
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Player movement
  if (keys['ArrowUp']) player.y -= player.speed;
  if (keys['ArrowDown']) player.y += player.speed;
  if (keys['ArrowLeft']) player.x -= player.speed;
  if (keys['ArrowRight']) player.x += player.speed;

  // Draw player as a circle
  ctx.fillStyle = 'blue';
  ctx.beginPath();
  ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw aiming line
  drawAimingLine();

  // Update and draw enemies
  updateEnemies();

  // Update and draw bullets
  updateBullets();

  // Check for collisions
  checkCollisions();

  // Update score
  updateScore();

  requestAnimationFrame(gameLoop);
}

// Update and draw enemies
function updateEnemies() {
  enemies.forEach((enemy) => {
    // Move enemies down the screen
    enemy.y += enemy.speed;

    // Reset enemy position if it goes off-screen
    if (enemy.y > canvas.height) {
      enemy.y = -enemy.height;
      enemy.x = Math.random() * (canvas.width - enemy.width);
    }

    // Draw enemy as a circle
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Update and draw bullets
function updateBullets() {
  bullets.forEach((bullet, index) => {
    // Move bullet in the direction of the angle
    bullet.x += Math.cos(bullet.angle) * bullet.speed;
    bullet.y += Math.sin(bullet.angle) * bullet.speed;

    // Remove bullet if it goes off-screen
    if (
      bullet.x < 0 || bullet.x > canvas.width ||
      bullet.y < 0 || bullet.y > canvas.height
    ) {
      bullets.splice(index, 1);
    }

    // Draw bullet as a line
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bullet.x, bullet.y); // Start of the line (bullet's current position)
    ctx.lineTo(
      bullet.x - Math.cos(bullet.angle) * 10, // End of the line (10px behind the bullet)
      bullet.y - Math.sin(bullet.angle) * 10
    );
    ctx.stroke();
  });
}

// Check for collisions
function checkCollisions() {
  bullets.forEach((bullet, bulletIndex) => {
    enemies.forEach((enemy, enemyIndex) => {
      if (
        bullet.x < enemy.x + enemy.width &&
        bullet.x + bullet.width > enemy.x &&
        bullet.y < enemy.y + enemy.height &&
        bullet.y + bullet.height > enemy.y
      ) {
        // Remove bullet and enemy on collision
        bullets.splice(bulletIndex, 1);
        enemies.splice(enemyIndex, 1);
        score += 10;
      }
    });
  });

  enemies.forEach((enemy) => {
    if (
      player.x < enemy.x + enemy.width &&
      player.x + player.width > enemy.x &&
      player.y < enemy.y + enemy.height &&
      player.y + player.height > enemy.y
    ) {
      alert('Game Over!');
      document.location.reload();
    }
  });
}

function updateScore() {
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText(`Score: ${score}`, 10, 20);
}

function drawAimingLine() {
  ctx.strokeStyle = 'white';
  ctx.beginPath();
  ctx.moveTo(player.x + player.width / 2, player.y + player.height / 2);
  ctx.lineTo(mouse.x, mouse.y);
  ctx.stroke();
}

// Start the game
gameLoop();