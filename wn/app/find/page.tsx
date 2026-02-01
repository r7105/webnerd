"use client";

import { useEffect, useRef } from "react";

export default function FindPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scoreboard = document.getElementById("scoreboard");
    const overlay = document.getElementById("gameOverOverlay");
    const finalScore = document.getElementById("finalScore");
    const retryButton = document.getElementById("retryButton");
    const fullscreenButton = document.getElementById("fullscreenButton");
    const shopOverlay = document.getElementById("shopOverlay");
    const coinCount = document.getElementById("coinCount");
    const sessionStart = Date.now();

    let player = {
      x: 400,
      y: 300,
      width: 20,
      height: 20,
      speed: 5,
      fireRate: 10,
      health: 100,
      invincible: false,
    };
    let keys: Record<string, boolean> = {};
    let score = 0;
    let coins = 0;
    let coinsOnGround: Array<{ x: number; y: number; width: number; height: number }> = [];
    let enemies = [
      { x: 100, y: 100, width: 20, height: 20, speed: 2, health: 50, patrol: [{ x: 100, y: 100 }, { x: 300, y: 100 }], patrolIndex: 0, shootTimer: 0 },
      { x: 700, y: 200, width: 20, height: 20, speed: 3, health: 75, patrol: [{ x: 700, y: 200 }, { x: 500, y: 400 }], patrolIndex: 0, shootTimer: 0 },
    ];
    let bullets: Array<{ x: number; y: number; angle: number; speed: number; damage?: number; source: "player" | "enemy" }> = [];
    let mouse = { x: 0, y: 0 };
    let powerUps: Array<{ x: number; y: number; width: number; height: number; type: string }> = [];
    let activePowerUp: string | null = null;
    let powerUpTimer = 0;
    let lastFireTime = 0;
    let animationFrameId = 0;
    let shopOpen = false;

    const gunTypes = {
      pistol: { fireRate: 200, bulletSpeed: 15, bulletDamage: 10 },
      shotgun: { fireRate: 500, bulletSpeed: 12, bulletDamage: 5, pellets: 8, spread: 0.2 },
      machineGun: { fireRate: 100, bulletSpeed: 20, bulletDamage: 5 },
    } as const;

    let currentGun: keyof typeof gunTypes = "pistol";

    function enterFullscreen() {
      if (canvas.requestFullscreen) {
        canvas
          .requestFullscreen()
          .then(() => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
          })
          .catch(() => {
            return;
          });
      }
    }

    function updateCoinCount() {
      if (coinCount) coinCount.textContent = String(coins);
    }

    function dropCoin(x: number, y: number) {
      coinsOnGround.push({ x, y, width: 10, height: 10 });
    }

    function drawCoins() {
      coinsOnGround.forEach((coin) => {
        ctx.fillStyle = "yellow";
        ctx.fillRect(coin.x, coin.y, coin.width, coin.height);
      });
    }

    function checkCoinCollection() {
      coinsOnGround.forEach((coin, index) => {
        if (
          player.x < coin.x + coin.width &&
          player.x + player.width > coin.x &&
          player.y < coin.y + coin.height &&
          player.y + player.height > coin.y
        ) {
          coins += 1;
          coinsOnGround.splice(index, 1);
          updateCoinCount();
        }
      });
    }

    function toggleShop() {
      shopOpen = !shopOpen;
      if (shopOverlay) shopOverlay.style.display = shopOpen ? "block" : "none";
    }

    function closeShop() {
      shopOpen = false;
      if (shopOverlay) shopOverlay.style.display = "none";
    }

    function purchaseItem(item: string) {
      if (item === "healthPotion" && coins >= 10) {
        coins -= 10;
        player.health = 100;
        updateCoinCount();
      } else if (item === "speedBoost" && coins >= 20) {
        coins -= 20;
        player.speed = 10;
        updateCoinCount();
        setTimeout(() => {
          player.speed = 5;
        }, 5000);
      } else {
        alert("Not enough coins or invalid item!");
      }
    }

    (window as any).purchaseItem = purchaseItem;
    (window as any).closeShop = closeShop;

    function shootBullet() {
      const now = Date.now();
      const gun = gunTypes[currentGun];

      if (now - lastFireTime > gun.fireRate) {
        lastFireTime = now;
        if (currentGun === "shotgun") {
          for (let i = 0; i < gun.pellets; i += 1) {
            const angle =
              Math.atan2(mouse.y - (player.y + player.height / 2), mouse.x - (player.x + player.width / 2)) +
              (Math.random() - 0.5) * gun.spread;
            bullets.push({
              x: player.x + player.width / 2,
              y: player.y + player.height / 2,
              angle,
              speed: gun.bulletSpeed,
              damage: gun.bulletDamage,
              source: "player",
            });
          }
        } else {
          const angle = Math.atan2(
            mouse.y - (player.y + player.height / 2),
            mouse.x - (player.x + player.width / 2)
          );
          bullets.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            angle,
            speed: gun.bulletSpeed,
            damage: gun.bulletDamage,
            source: "player",
          });
        }
      }
    }

    function drawAimingLine() {
      const gradient = ctx.createLinearGradient(
        player.x + player.width / 2,
        player.y + player.height / 2,
        mouse.x,
        mouse.y
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.5)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(player.x + player.width / 2, player.y + player.height / 2);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
    }

    function drawPowerUps() {
      powerUps.forEach((powerUp) => {
        let color = "white";
        if (powerUp.type === "speed") color = "green";
        if (powerUp.type === "rapidFire") color = "orange";
        if (powerUp.type === "invincibility") color = "purple";
        if (powerUp.type === "healing") color = "pink";

        ctx.fillStyle = color;
        ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
        ctx.fillStyle = "black";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(powerUp.type.charAt(0).toUpperCase(), powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
      });
    }

    function checkPowerUpCollection() {
      powerUps.forEach((powerUp, index) => {
        if (
          player.x < powerUp.x + powerUp.width &&
          player.x + player.width > powerUp.x &&
          player.y < powerUp.y + powerUp.height &&
          player.y + player.height > powerUp.y
        ) {
          activatePowerUp(powerUp.type);
          powerUps.splice(index, 1);
        }
      });
    }

    function activatePowerUp(type: string) {
      activePowerUp = type;
      powerUpTimer = 300;

      if (type === "speed") {
        player.speed = 10;
      } else if (type === "rapidFire") {
        player.fireRate = 5;
      } else if (type === "invincibility") {
        player.invincible = true;
      } else if (type === "healing") {
        player.health = 100;
      }
    }

    function updatePowerUpTimer() {
      if (powerUpTimer > 0) {
        powerUpTimer -= 1;
        if (powerUpTimer === 0) {
          deactivatePowerUp();
        }
      }
    }

    function deactivatePowerUp() {
      if (activePowerUp === "speed") {
        player.speed = 5;
      } else if (activePowerUp === "rapidFire") {
        player.fireRate = 10;
      } else if (activePowerUp === "invincibility") {
        player.invincible = false;
      }
      activePowerUp = null;
    }

    function drawHealthBar() {
      const barWidth = 200;
      const barHeight = 20;
      const x = 10;
      const y = 40;
      const healthPercentage = player.health / 100;

      ctx.fillStyle = "gray";
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.fillStyle = "green";
      ctx.fillRect(x, y, barWidth * healthPercentage, barHeight);
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, barWidth, barHeight);
    }

    function damageEnemy(bulletIndex: number | null, enemyIndex: number, damage = 10) {
      const enemy = enemies[enemyIndex];
      if (bulletIndex !== null) {
        bullets.splice(bulletIndex, 1);
      }
      enemy.health -= damage;
      if (enemy.health <= 0) {
        enemies.splice(enemyIndex, 1);
        score += 10;
        if (Math.random() < 0.5) {
          dropCoin(enemy.x, enemy.y);
        }
      }
    }

    function updateScore() {
      ctx.fillStyle = "white";
      ctx.font = "20px Arial";
      ctx.fillText(`Score: ${score}`, 10, 20);
      if (scoreboard) scoreboard.textContent = `Score: ${score}`;
    }

    function updateEnemies() {
      enemies.forEach((enemy) => {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 200) {
          const target = enemy.patrol[enemy.patrolIndex];
          const patrolDx = target.x - enemy.x;
          const patrolDy = target.y - enemy.y;
          const patrolDistance = Math.sqrt(patrolDx * patrolDx + patrolDy * patrolDy);

          if (patrolDistance < 5) {
            enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length;
          } else {
            enemy.x += (patrolDx / patrolDistance) * enemy.speed;
            enemy.y += (patrolDy / patrolDistance) * enemy.speed;
          }
        } else {
          enemy.x += (dx / distance) * enemy.speed;
          enemy.y += (dy / distance) * enemy.speed;
        }

        enemy.shootTimer = (enemy.shootTimer || 0) + 1;
        if (enemy.shootTimer > 100) {
          const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          bullets.push({
            x: enemy.x + enemy.width / 2,
            y: enemy.y + enemy.height / 2,
            angle,
            speed: 5,
            source: "enemy",
          });
          enemy.shootTimer = 0;
        }

        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, 0, Math.PI * 2);
        ctx.fill();

        const healthBarWidth = 20;
        const healthBarHeight = 4;
        const healthPercentage = enemy.health / 50;
        ctx.fillStyle = "gray";
        ctx.fillRect(enemy.x, enemy.y - 10, healthBarWidth, healthBarHeight);
        ctx.fillStyle = "green";
        ctx.fillRect(enemy.x, enemy.y - 10, healthBarWidth * healthPercentage, healthBarHeight);
        ctx.strokeStyle = "black";
        ctx.strokeRect(enemy.x, enemy.y - 10, healthBarWidth, healthBarHeight);
      });
    }

    function updateBullets() {
      bullets.forEach((bullet, index) => {
        bullet.x += Math.cos(bullet.angle) * bullet.speed;
        bullet.y += Math.sin(bullet.angle) * bullet.speed;

        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
          bullets.splice(index, 1);
        }

        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x - Math.cos(bullet.angle) * 10, bullet.y - Math.sin(bullet.angle) * 10);
        ctx.stroke();
      });
    }

    function checkCollisions() {
      bullets.forEach((bullet, bulletIndex) => {
        if (bullet.source === "player") {
          enemies.forEach((enemy, enemyIndex) => {
            if (bullet.x < enemy.x + enemy.width && bullet.x > enemy.x && bullet.y < enemy.y + enemy.height && bullet.y > enemy.y) {
              damageEnemy(bulletIndex, enemyIndex, bullet.damage || 10);
            }
          });
        }
      });

      enemies.forEach((enemy, enemyIndex) => {
        if (
          player.x < enemy.x + enemy.width &&
          player.x + player.width > enemy.x &&
          player.y < enemy.y + enemy.height &&
          player.y + player.height > enemy.y
        ) {
          if (!player.invincible) {
            player.health -= 10;
            if (player.health <= 0) {
              endGame();
              return;
            }
          }
          damageEnemy(null, enemyIndex);
        }
      });

      bullets.forEach((bullet, bulletIndex) => {
        if (
          bullet.source === "enemy" &&
          !player.invincible &&
          bullet.x < player.x + player.width &&
          bullet.x > player.x &&
          bullet.y < player.y + player.height &&
          bullet.y > player.y
        ) {
          player.health -= 10;
          bullets.splice(bulletIndex, 1);
          if (player.health <= 0) {
            endGame();
          }
        }
      });
    }

    function spawnEnemies() {
      enemies = [
        {
          x: Math.random() * (canvas.width - 20),
          y: Math.random() * (canvas.height - 20),
          width: 20,
          height: 20,
          speed: 2,
          health: 50,
          patrol: [
            { x: Math.random() * canvas.width, y: Math.random() * canvas.height },
            { x: Math.random() * canvas.width, y: Math.random() * canvas.height },
          ],
          patrolIndex: 0,
          shootTimer: 0,
        },
        {
          x: Math.random() * (canvas.width - 20),
          y: Math.random() * (canvas.height - 20),
          width: 20,
          height: 20,
          speed: 3,
          health: 75,
          patrol: [
            { x: Math.random() * canvas.width, y: Math.random() * canvas.height },
            { x: Math.random() * canvas.width, y: Math.random() * canvas.height },
          ],
          patrolIndex: 0,
          shootTimer: 0,
        },
      ];
    }

    function spawnPowerUp() {
      const types = ["speed", "rapidFire", "invincibility"];
      const type = types[Math.floor(Math.random() * types.length)];
      powerUps.push({
        x: Math.random() * (canvas.width - 20),
        y: Math.random() * (canvas.height - 20),
        width: 20,
        height: 20,
        type,
      });
    }

    function endGame() {
      cancelAnimationFrame(animationFrameId);
      if (overlay) overlay.classList.remove("hidden");
      if (finalScore) finalScore.textContent = String(score);
      if (retryButton) {
        retryButton.onclick = () => {
          player = { x: 400, y: 300, width: 20, height: 20, speed: 5, fireRate: 10, health: 100, invincible: false };
          bullets = [];
          enemies = [];
          powerUps = [];
          score = 0;
          coins = 0;
          coinsOnGround = [];
          if (overlay) overlay.classList.add("hidden");
          spawnEnemies();
          gameLoop();
        };
      }
    }

    function gameLoop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (keys["ArrowUp"] && player.y > 0) player.y -= player.speed;
      if (keys["ArrowDown"] && player.y < canvas.height - player.height) player.y += player.speed;
      if (keys["ArrowLeft"] && player.x > 0) player.x -= player.speed;
      if (keys["ArrowRight"] && player.x < canvas.width - player.width) player.x += player.speed;
      if (keys["w"] && player.y > 0) player.y -= player.speed;
      if (keys["s"] && player.y < canvas.height - player.height) player.y += player.speed;
      if (keys["a"] && player.x > 0) player.x -= player.speed;
      if (keys["d"] && player.x < canvas.width - player.width) player.x += player.speed;

      ctx.fillStyle = "blue";
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2, 0, Math.PI * 2);
      ctx.fill();

      drawAimingLine();
      updateEnemies();
      updateBullets();
      checkCollisions();
      checkCoinCollection();
      updateScore();
      drawCoins();
      drawPowerUps();
      checkPowerUpCollection();
      updatePowerUpTimer();
      drawHealthBar();

      if (enemies.length === 0) {
        spawnEnemies();
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    }

    function handleKeyDown(e: KeyboardEvent) {
      keys[e.key] = true;
      if (e.key === "1") currentGun = "pistol";
      if (e.key === "2") currentGun = "shotgun";
      if (e.key === "3") currentGun = "machineGun";
      if (e.key === "e") toggleShop();
      if (e.key === " ") shootBullet();
    }

    function handleKeyUp(e: KeyboardEvent) {
      keys[e.key] = false;
    }

    function handleMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }

    function handleMouseDown(e: MouseEvent) {
      if (e.button === 0) shootBullet();
    }

    function handleFullscreenChange() {
      const rect = canvas.getBoundingClientRect();
      mouse.x = Math.min(mouse.x, rect.width);
      mouse.y = Math.min(mouse.y, rect.height);

      if (overlay) {
        if (document.fullscreenElement) {
          overlay.style.width = "80%";
          overlay.style.height = "50%";
          overlay.style.fontSize = "2em";
        } else {
          overlay.style.width = "";
          overlay.style.height = "";
          overlay.style.fontSize = "";
        }
      }
    }

    function handleFullscreenButton() {
      if (!document.fullscreenElement) {
        enterFullscreen();
      } else {
        document.exitFullscreen().then(() => {
          canvas.width = 800;
          canvas.height = 600;
        });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    if (fullscreenButton) fullscreenButton.addEventListener("click", handleFullscreenButton);

    const powerUpInterval = window.setInterval(spawnPowerUp, 10000);

    enterFullscreen();
    spawnEnemies();
    updateCoinCount();
    gameLoop();

    return () => {
      const seconds = Math.floor((Date.now() - sessionStart) / 1000);
      if (seconds > 10) {
        const payload = JSON.stringify({ gameSlug: "find", seconds });
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon("/api/stats/playtime", blob);
        } else {
          fetch("/api/stats/playtime", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          });
        }
      }
      cancelAnimationFrame(animationFrameId);
      window.clearInterval(powerUpInterval);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      if (fullscreenButton) fullscreenButton.removeEventListener("click", handleFullscreenButton);
      delete (window as any).purchaseItem;
      delete (window as any).closeShop;
    };
  }, []);

  return (
    <div className="find-page">
      <canvas ref={canvasRef} id="gameCanvas" width={800} height={600} />
      <div id="scoreboard">Score: 0</div>
      <div id="gameOverOverlay" className="hidden">
        <h1>Game Over</h1>
        <p>
          Your Score: <span id="finalScore">0</span>
        </p>
        <button id="retryButton">Retry</button>
      </div>
      <div id="shopOverlay">
        <h1>Shop</h1>
        <p>
          Coins: <span id="coinCount">0</span>
        </p>
        <button onClick={() => (window as any).purchaseItem?.("healthPotion")}>Health Potion - 10 Coins</button>
        <button onClick={() => (window as any).purchaseItem?.("speedBoost")}>Speed Boost - 20 Coins</button>
        <button onClick={() => (window as any).closeShop?.()}>Close</button>
      </div>
      <button id="fullscreenButton">Go Fullscreen</button>

      <style jsx global>{`
        body {
          margin: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background-color: #222;
          color: white;
          font-family: Arial, sans-serif;
        }

        canvas {
          border: 2px solid white;
          background-color: black;
          cursor: crosshair;
        }

        #scoreboard {
          position: absolute;
          top: 10px;
          left: 10px;
          font-size: 20px;
          font-weight: bold;
          color: white;
        }

        #fullscreenButton {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 10px 20px;
          font-size: 16px;
          cursor: pointer;
          background-color: white;
          color: black;
          border: none;
          border-radius: 5px;
          z-index: 1000;
        }

        #gameOverOverlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          font-family: Arial, sans-serif;
          z-index: 1000;
        }

        #gameOverOverlay.hidden {
          display: none;
        }

        #gameOverOverlay button {
          padding: 10px 20px;
          font-size: 18px;
          cursor: pointer;
          background-color: white;
          color: black;
          border: none;
          border-radius: 5px;
          margin-top: 20px;
        }

        #shopOverlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          z-index: 1002;
          display: none;
        }

        #shopOverlay button {
          padding: 10px 20px;
          font-size: 16px;
          cursor: pointer;
          margin: 5px;
        }
      `}</style>
    </div>
  );
}
