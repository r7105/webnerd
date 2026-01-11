"use client";

import { useEffect, useRef } from "react";
import styles from "./find.module.css";

export default function FindPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scoreboard = document.getElementById("scoreboard");
    const overlay = document.getElementById("gameOverOverlay");
    const finalScoreEl = document.getElementById("finalScore");
    const retryButton = document.getElementById("retryButton");
    const shopOverlay = document.getElementById("shopOverlay");
    const coinCountEl = document.getElementById("coinCount");
    const fullscreenButton = document.getElementById("fullscreenButton");
    const healthButton = document.getElementById("healthPotionButton");
    const speedButton = document.getElementById("speedBoostButton");
    const closeShopButton = document.getElementById("closeShopButton");

    let player = {
      x: 400,
      y: 300,
      width: 20,
      height: 20,
      speed: 5,
      fireRate: 10,
      health: 100,
      invincible: false
    };
    const keys: Record<string, boolean> = {};
    let score = 0;
    let animationFrameId = 0;
    let coins = 0;
    let coinsOnGround: Array<{ x: number; y: number; width: number; height: number }> = [];
    let enemies: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      speed: number;
      health: number;
      patrol: Array<{ x: number; y: number }>;
      patrolIndex: number;
      shootTimer?: number;
    }> = [
      {
        x: 100,
        y: 100,
        width: 20,
        height: 20,
        speed: 2,
        health: 50,
        patrol: [
          { x: 100, y: 100 },
          { x: 300, y: 100 }
        ],
        patrolIndex: 0
      },
      {
        x: 700,
        y: 200,
        width: 20,
        height: 20,
        speed: 3,
        health: 75,
        patrol: [
          { x: 700, y: 200 },
          { x: 500, y: 400 }
        ],
        patrolIndex: 0
      }
    ];
    let bullets: Array<{
      x: number;
      y: number;
      angle: number;
      speed: number;
      damage?: number;
      source: "player" | "enemy";
    }> = [];
    const mouse = { x: 0, y: 0 };
    const powerUps: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      type: "speed" | "rapidFire" | "invincibility" | "healing";
    }> = [];
    let activePowerUp: typeof powerUps[number]["type"] | null = null;
    let powerUpTimer = 0;

    const gunTypes = {
      pistol: {
        fireRate: 200,
        bulletSpeed: 15,
        bulletDamage: 10
      },
      shotgun: {
        fireRate: 500,
        bulletSpeed: 12,
        bulletDamage: 5,
        pellets: 8,
        spread: 0.2
      },
      machineGun: {
        fireRate: 100,
        bulletSpeed: 20,
        bulletDamage: 5
      }
    };

    let currentGun: keyof typeof gunTypes = "pistol";
    let lastFireTime = 0;
    let shopOpen = false;

    const updateCoinCount = () => {
      if (coinCountEl) coinCountEl.textContent = String(coins);
    };

    const enterFullscreen = () => {
      if (!canvas.requestFullscreen) return;
      canvas
        .requestFullscreen()
        .then(() => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        })
        .catch((err) => {
          console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
        });
    };

    const toggleShop = () => {
      shopOpen = !shopOpen;
      if (shopOverlay) {
        shopOverlay.style.display = shopOpen ? "block" : "none";
      }
    };

    const closeShop = () => {
      shopOpen = false;
      if (shopOverlay) shopOverlay.style.display = "none";
    };

    const purchaseItem = (item: "healthPotion" | "speedBoost") => {
      if (item === "healthPotion" && coins >= 10) {
        coins -= 10;
        player.health = 100;
        updateCoinCount();
      } else if (item === "speedBoost" && coins >= 20) {
        coins -= 20;
        player.speed = 10;
        updateCoinCount();
        window.setTimeout(() => {
          player.speed = 5;
        }, 5000);
      } else {
        alert("Not enough coins or invalid item!");
      }
    };

    const dropCoin = (x: number, y: number) => {
      coinsOnGround.push({ x, y, width: 10, height: 10 });
    };

    const drawCoins = () => {
      coinsOnGround.forEach((coin) => {
        ctx.fillStyle = "yellow";
        ctx.fillRect(coin.x, coin.y, coin.width, coin.height);
      });
    };

    const checkCoinCollection = () => {
      coinsOnGround.forEach((coin, index) => {
        if (
          player.x < coin.x + coin.width &&
          player.x + player.width > coin.x &&
          player.y < coin.y + coin.height &&
          player.y + player.height > coin.y
        ) {
          coins++;
          coinsOnGround.splice(index, 1);
          updateCoinCount();
        }
      });
    };

    const shootBullet = () => {
      const now = Date.now();
      const gun = gunTypes[currentGun];
      if (now - lastFireTime <= gun.fireRate) return;
      lastFireTime = now;

      if (currentGun === "shotgun") {
        for (let i = 0; i < gun.pellets; i++) {
          const angle =
            Math.atan2(
              mouse.y - (player.y + player.height / 2),
              mouse.x - (player.x + player.width / 2)
            ) +
            (Math.random() - 0.5) * gun.spread;
          bullets.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            angle,
            speed: gun.bulletSpeed,
            damage: gun.bulletDamage,
            source: "player"
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
          source: "player"
        });
      }
    };

    const updateEnemies = () => {
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

        if (!enemy.shootTimer) enemy.shootTimer = 0;
        enemy.shootTimer++;
        if (enemy.shootTimer > 100) {
          const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          bullets.push({
            x: enemy.x + enemy.width / 2,
            y: enemy.y + enemy.height / 2,
            angle,
            speed: 5,
            source: "enemy"
          });
          enemy.shootTimer = 0;
        }

        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(
          enemy.x + enemy.width / 2,
          enemy.y + enemy.height / 2,
          enemy.width / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();

        const healthBarWidth = 20;
        const healthBarHeight = 4;
        const healthPercentage = enemy.health / 50;
        ctx.fillStyle = "gray";
        ctx.fillRect(enemy.x, enemy.y - 10, healthBarWidth, healthBarHeight);
        ctx.fillStyle = "green";
        ctx.fillRect(
          enemy.x,
          enemy.y - 10,
          healthBarWidth * healthPercentage,
          healthBarHeight
        );
        ctx.strokeStyle = "black";
        ctx.strokeRect(enemy.x, enemy.y - 10, healthBarWidth, healthBarHeight);
      });
    };

    const updateBullets = () => {
      bullets.forEach((bullet, index) => {
        bullet.x += Math.cos(bullet.angle) * bullet.speed;
        bullet.y += Math.sin(bullet.angle) * bullet.speed;

        if (
          bullet.x < 0 ||
          bullet.x > canvas.width ||
          bullet.y < 0 ||
          bullet.y > canvas.height
        ) {
          bullets.splice(index, 1);
        }

        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(
          bullet.x - Math.cos(bullet.angle) * 10,
          bullet.y - Math.sin(bullet.angle) * 10
        );
        ctx.stroke();
      });
    };

    const updateScore = () => {
      if (scoreboard) scoreboard.textContent = `Score: ${score}`;
      ctx.fillStyle = "white";
      ctx.font = "20px Arial";
      ctx.fillText(`Score: ${score}`, 10, 20);
    };

    const drawAimingLine = () => {
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
    };

    const drawPowerUps = () => {
      powerUps.forEach((powerUp) => {
        let color = "white";
        switch (powerUp.type) {
          case "speed":
            color = "green";
            break;
          case "rapidFire":
            color = "orange";
            break;
          case "invincibility":
            color = "purple";
            break;
          case "healing":
            color = "pink";
            break;
          default:
            color = "white";
        }

        ctx.fillStyle = color;
        ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);

        ctx.fillStyle = "black";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          powerUp.type.charAt(0).toUpperCase(),
          powerUp.x + powerUp.width / 2,
          powerUp.y + powerUp.height / 2
        );
      });
    };

    const checkPowerUpCollection = () => {
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
    };

    const activatePowerUp = (
      type: "speed" | "rapidFire" | "invincibility" | "healing"
    ) => {
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
    };

    const deactivatePowerUp = () => {
      if (activePowerUp === "speed") {
        player.speed = 5;
      } else if (activePowerUp === "rapidFire") {
        player.fireRate = 10;
      } else if (activePowerUp === "invincibility") {
        player.invincible = false;
      }
      activePowerUp = null;
    };

    const updatePowerUpTimer = () => {
      if (powerUpTimer > 0) {
        powerUpTimer--;
        if (powerUpTimer === 0) {
          deactivatePowerUp();
        }
      }
    };

    const drawHealthBar = () => {
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
    };

    const damageEnemy = (bulletIndex: number | null, enemyIndex: number, damage = 10) => {
      const enemy = enemies[enemyIndex];
      if (!enemy) return;
      if (bulletIndex !== null) bullets.splice(bulletIndex, 1);
      enemy.health -= damage;
      if (enemy.health <= 0) {
        enemies.splice(enemyIndex, 1);
        score += 10;
        if (Math.random() < 0.5) dropCoin(enemy.x, enemy.y);
      }
    };

    const checkCollisions = () => {
      bullets.forEach((bullet, bulletIndex) => {
        if (bullet.source === "player") {
          enemies.forEach((enemy, enemyIndex) => {
            if (
              bullet.x < enemy.x + enemy.width &&
              bullet.x > enemy.x &&
              bullet.y < enemy.y + enemy.height &&
              bullet.y > enemy.y
            ) {
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
    };

    const spawnEnemies = () => {
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
            { x: Math.random() * canvas.width, y: Math.random() * canvas.height }
          ],
          patrolIndex: 0
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
            { x: Math.random() * canvas.width, y: Math.random() * canvas.height }
          ],
          patrolIndex: 0
        }
      ];
    };

    const spawnPowerUp = () => {
      const types: Array<"speed" | "rapidFire" | "invincibility"> = [
        "speed",
        "rapidFire",
        "invincibility"
      ];
      const type = types[Math.floor(Math.random() * types.length)];
      powerUps.push({
        x: Math.random() * (canvas.width - 20),
        y: Math.random() * (canvas.height - 20),
        width: 20,
        height: 20,
        type
      });
    };

    const endGame = () => {
      cancelAnimationFrame(animationFrameId);
      if (overlay) overlay.classList.remove("hidden");
      if (finalScoreEl) finalScoreEl.textContent = String(score);
      if (retryButton) {
        retryButton.onclick = () => {
          player = {
            x: 400,
            y: 300,
            width: 20,
            height: 20,
            speed: 5,
            fireRate: 10,
            health: 100,
            invincible: false
          };
          bullets = [];
          enemies = [];
          powerUps.length = 0;
          score = 0;
          coins = 0;
          coinsOnGround = [];
          if (overlay) overlay.classList.add("hidden");
          spawnEnemies();
          gameLoop();
        };
      }
    };

    const gameLoop = () => {
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
      ctx.arc(
        player.x + player.width / 2,
        player.y + player.height / 2,
        player.width / 2,
        0,
        Math.PI * 2
      );
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

      if (enemies.length === 0) spawnEnemies();

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
      if (e.key === "1") currentGun = "pistol";
      if (e.key === "2") currentGun = "shotgun";
      if (e.key === "3") currentGun = "machineGun";
      if (e.key === "e") toggleShop();
      if (e.key === " ") shootBullet();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) shootBullet();
    };
    const onFullscreenChange = () => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = Math.min(mouse.x, rect.width);
      mouse.y = Math.min(mouse.y, rect.height);
      if (!overlay) return;
      if (document.fullscreenElement) {
        overlay.style.width = "80%";
        overlay.style.height = "50%";
        overlay.style.fontSize = "2em";
      } else {
        overlay.style.width = "";
        overlay.style.height = "";
        overlay.style.fontSize = "";
      }
    };
    const onFullscreenClick = () => {
      if (!document.fullscreenElement) {
        enterFullscreen();
      } else {
        document.exitFullscreen().then(() => {
          canvas.width = 800;
          canvas.height = 600;
        });
      }
    };
    const onHealthClick = () => purchaseItem("healthPotion");
    const onSpeedClick = () => purchaseItem("speedBoost");
    const onCloseShopClick = () => closeShop();

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    fullscreenButton?.addEventListener("click", onFullscreenClick);
    healthButton?.addEventListener("click", onHealthClick);
    speedButton?.addEventListener("click", onSpeedClick);
    closeShopButton?.addEventListener("click", onCloseShopClick);

    const powerUpInterval = window.setInterval(spawnPowerUp, 10000);

    spawnEnemies();
    gameLoop();
    updateCoinCount();
    enterFullscreen();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.clearInterval(powerUpInterval);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      fullscreenButton?.removeEventListener("click", onFullscreenClick);
      healthButton?.removeEventListener("click", onHealthClick);
      speedButton?.removeEventListener("click", onSpeedClick);
      closeShopButton?.removeEventListener("click", onCloseShopClick);
    };
  }, []);

  return (
    <main className={styles.page}>
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
        <button id="healthPotionButton">Health Potion - 10 Coins</button>
        <button id="speedBoostButton">Speed Boost - 20 Coins</button>
        <button id="closeShopButton">Close</button>
      </div>
      <button id="fullscreenButton">Go Fullscreen</button>
    </main>
  );
}
