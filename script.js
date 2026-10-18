(function(){
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const leftScoreEl = document.getElementById('leftScore');
  const rightScoreEl = document.getElementById('rightScore');

  const menuOverlay = document.getElementById('menuOverlay');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const endOverlay = document.getElementById('endOverlay');
  const startBtn = document.getElementById('startBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const newMatchBtn = document.getElementById('newMatchBtn');
  const resetBtn = document.getElementById('resetBtn');
  const soundToggle = document.getElementById('soundToggle');
  const winnerText = document.getElementById('winnerText');
  const endMessage = document.getElementById('endMessage');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  const WIN_SCORE = 10;

  const DIFFICULTY = {
    easy: { aiSpeed: 2.4, reaction: 0.14, maxBounce: 1.04, tracking: 0.92 },
    medium: { aiSpeed: 3.6, reaction: 0.2, maxBounce: 1.2, tracking: 1.0 },
    hard: { aiSpeed: 5.1, reaction: 0.28, maxBounce: 1.38, tracking: 1.12 }
  };

  let selectedDifficulty = 'medium';
  let soundOn = true;
  let gameState = 'menu';

  let audioCtx = null;
  function ensureAudio(){
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function setSoundOn(value){
    soundOn = value;
    soundToggle.textContent = 'Sound: ' + (soundOn ? 'On' : 'Off');
    if (soundOn) {
      ensureAudio();
    }
  }

  function playTone(freq, duration = 0.08, type = 'sine', volume = 0.04, slideTo = null){
    if (!soundOn || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), audioCtx.currentTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.02);
  }

  function playPaddleHit(){
    playTone(260 + Math.random() * 90, 0.05, 'square', 0.05, 380);
  }

  function playWallHit(){
    playTone(160, 0.06, 'triangle', 0.035, 110);
  }

  function playScore(){
    playTone(360, 0.11, 'sawtooth', 0.045, 180);
    setTimeout(() => playTone(420, 0.09, 'sawtooth', 0.04, 200), 55);
  }

  function playWin(){
    playTone(600, 0.12, 'triangle', 0.055, 180);
    setTimeout(() => playTone(800, 0.12, 'triangle', 0.045, 220), 90);
    setTimeout(() => playTone(960, 0.15, 'triangle', 0.04, 260), 180);
  }

  function playPause(){
    playTone(220, 0.05, 'square', 0.03, 180);
  }

  function playStart(){
    playTone(280, 0.06, 'triangle', 0.03, 200);
  }

  const PADDLE_WIDTH = 12;
  const PADDLE_HEIGHT = 100;
  const PADDLE_MARGIN = 10;

  const leftPaddle = {
    x: PADDLE_MARGIN,
    y: (HEIGHT - PADDLE_HEIGHT) / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT
  };

  const rightPaddle = {
    x: WIDTH - PADDLE_WIDTH - PADDLE_MARGIN,
    y: (HEIGHT - PADDLE_HEIGHT) / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT
  };

  const ball = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    radius: 8,
    speed: 5,
    dx: 5,
    dy: 0
  };

  let leftScore = 0;
  let rightScore = 0;
  let mouseY = null;
  let mouseMoved = false;
  let keys = { ArrowUp:false, ArrowDown:false };

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function setDifficulty(level){
    selectedDifficulty = level;
    document.querySelectorAll('.difficulty').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === level);
    });
  }

  function hideAllOverlays(){
    menuOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');
  }

  function showMenu(){
    gameState = 'menu';
    hideAllOverlays();
    menuOverlay.classList.remove('hidden');
  }

  function showPause(){
    gameState = 'paused';
    hideAllOverlays();
    pauseOverlay.classList.remove('hidden');
  }

  function showEnd(winner){
    gameState = 'ended';
    hideAllOverlays();
    winnerText.textContent = winner === 'player' ? 'Player Wins!' : 'Computer Wins!';
    endMessage.textContent = winner === 'player'
      ? 'You took the match. Hit the button to play again.'
      : 'The computer won this round. Hit the button to retry.';
    endOverlay.classList.remove('hidden');
  }

  function resetBall(servingToRight = Math.random() >= 0.5){
    ball.x = WIDTH / 2;
    ball.y = HEIGHT / 2;
    ball.speed = 5;
    const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8);
    const dir = servingToRight ? 1 : -1;
    ball.dx = dir * ball.speed * Math.cos(angle);
    ball.dy = ball.speed * Math.sin(angle);
  }

  function resetMatch(){
    leftScore = 0;
    rightScore = 0;
    leftScoreEl.textContent = leftScore;
    rightScoreEl.textContent = rightScore;
    resetBall();
  }

  function startMatch(){
    ensureAudio();
    playStart();
    resetMatch();
    hideAllOverlays();
    gameState = 'playing';
  }

  function handlePauseToggle(){
    if (gameState === 'playing') {
      playPause();
      showPause();
    } else if (gameState === 'paused') {
      playPause();
      hideAllOverlays();
      gameState = 'playing';
    }
  }

  function computeAiTarget(){
    const targetY = ball.y;
    const centerY = rightPaddle.y + (rightPaddle.height / 2);
    return clamp(targetY, rightPaddle.height / 2, HEIGHT - rightPaddle.height / 2);
  }

  function updateAI(){
    const conf = DIFFICULTY[selectedDifficulty];
    const target = computeAiTarget();
    const centerY = rightPaddle.y + rightPaddle.height / 2;
    const delta = target - centerY;
    const follow = delta * conf.reaction;
    rightPaddle.y += follow;
    rightPaddle.y = clamp(rightPaddle.y, 0, HEIGHT - rightPaddle.height);
  }

  function handlePaddleHit(paddle){
    if (soundOn) playPaddleHit();

    const conf = DIFFICULTY[selectedDifficulty];
    const paddleCenter = paddle.y + paddle.height / 2;
    const relative = (ball.y - paddleCenter) / (paddle.height / 2);
    const angle = relative * conf.maxBounce;

    const direction = paddle === leftPaddle ? 1 : -1;
    ball.speed += 0.2;
    ball.dx = direction * ball.speed * Math.cos(angle);
    ball.dy = ball.speed * Math.sin(angle);
  }

  function checkWinState(){
    if (leftScore >= WIN_SCORE || rightScore >= WIN_SCORE) {
      if (soundOn) playWin();
      const winner = leftScore > rightScore ? 'player' : 'computer';
      showEnd(winner);
      return true;
    }
    return false;
  }

  function scorePoint(side){
    if (side === 'left') {
      leftScore++;
      leftScoreEl.textContent = leftScore;
    } else {
      rightScore++;
      rightScoreEl.textContent = rightScore;
    }
    if (soundOn) playScore();

    if (!checkWinState()) {
      const serveToRight = side === 'left';
      resetBall(serveToRight);
    }
  }

  function update(){
    if (gameState !== 'playing') return;

    if (keys.ArrowUp) leftPaddle.y -= 6;
    if (keys.ArrowDown) leftPaddle.y += 6;

    if (mouseMoved && mouseY !== null) {
      const desired = mouseY - leftPaddle.height / 2;
      leftPaddle.y += (desired - leftPaddle.y) * 0.35;
    }

    leftPaddle.y = clamp(leftPaddle.y, 0, HEIGHT - leftPaddle.height);
    updateAI();

    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.dy = -ball.dy;
      if (soundOn) playWallHit();
    } else if (ball.y + ball.radius >= HEIGHT) {
      ball.y = HEIGHT - ball.radius;
      ball.dy = -ball.dy;
      if (soundOn) playWallHit();
    }

    if (ball.x - ball.radius <= leftPaddle.x + leftPaddle.width){
      if (ball.y >= leftPaddle.y && ball.y <= leftPaddle.y + leftPaddle.height){
        ball.x = leftPaddle.x + leftPaddle.width + ball.radius;
        handlePaddleHit(leftPaddle);
      }
    }

    if (ball.x + ball.radius >= rightPaddle.x){
      if (ball.y >= rightPaddle.y && ball.y <= rightPaddle.y + rightPaddle.height){
        ball.x = rightPaddle.x - ball.radius;
        handlePaddleHit(rightPaddle);
      }
    }

    if (ball.x + ball.radius < 0) {
      scorePoint('right');
    } else if (ball.x - ball.radius > WIDTH) {
      scorePoint('left');
    }
  }

  function drawNet(){
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const step = 14;
    const height = 10;
    for (let y = 0; y < HEIGHT; y += step) {
      ctx.fillRect(WIDTH / 2 - 1, y, 2, height);
    }
  }

  function roundRectFill(x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function draw(){
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#fff';
    roundRectFill(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height, 8);
    roundRectFill(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height, 8);

    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    drawNet();
  }

  function loop(){
    update();
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    mouseMoved = true;
  });

  canvas.addEventListener('mouseleave', () => {
    mouseMoved = false;
  });

  canvas.addEventListener('click', () => {
    ensureAudio();
    canvas.focus();
  });

  window.addEventListener('keydown', (e) => {
    ensureAudio();

    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      keys[e.code] = true;
      e.preventDefault();
    } else if (e.code === 'Space') {
      e.preventDefault();
      handlePauseToggle();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      keys[e.code] = false;
      e.preventDefault();
    }
  });

  canvas.addEventListener('touchstart', (e) => {
    ensureAudio();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseY = (touch.clientY - rect.top) * (canvas.height / rect.height);
    mouseMoved = true;
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseY = (touch.clientY - rect.top) * (canvas.height / rect.height);
  }, { passive: true });

  document.querySelectorAll('.difficulty').forEach(btn => {
    btn.addEventListener('click', () => setDifficulty(btn.dataset.level));
  });

  startBtn.addEventListener('click', startMatch);
  resumeBtn.addEventListener('click', () => {
    hideAllOverlays();
    gameState = 'playing';
  });
  newMatchBtn.addEventListener('click', startMatch);

  resetBtn.addEventListener('click', () => {
    ensureAudio();
    resetMatch();
    if (gameState !== 'menu') {
      hideAllOverlays();
      gameState = 'playing';
    }
  });

  soundToggle.addEventListener('click', () => {
    setSoundOn(!soundOn);
  });

  setDifficulty(selectedDifficulty);
  setSoundOn(true);
  resetMatch();
  showMenu();
  requestAnimationFrame(loop);
})();
