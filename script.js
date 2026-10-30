// Keep the main game numbers together so they are easy to find and adjust.
const GAME_LENGTH = 5 * 60;
const FILL_SPEED = 35;
const FILL_PREVIEW_TIME = 1800;

// Each place has its own base score and lane on the map.
const destinations = [
	{ id: 'school', name: 'School', points: 100, lane: 0 },
	{ id: 'home', name: 'Homes', points: 50, lane: 1 },
	{ id: 'business', name: 'Business', points: 150, lane: 2 }
];

const screens = {
	title: document.querySelector('#title-screen'),
	fill: document.querySelector('#fill-screen'),
	map: document.querySelector('#map-screen'),
	gameOver: document.querySelector('#game-over-screen')
};

const game = {
	secondsLeft: GAME_LENGTH,
	totalScore: 0,
	scores: { school: 0, home: 0, business: 0 },
	fillPercent: 0,
	carrierLane: 1,
	carrierHeight: 0,
	selectedDestination: null,
	phase: 'title',
	isHoldingPump: false,
	ended: false
};

let gameTimer = null;
let fillTimer = null;
let fillPreviewTimer = null;

const fillTimerText = document.querySelector('#fill-timer');
const mapTimerText = document.querySelector('#map-timer');
const fillScoreText = document.querySelector('#fill-score');
const mapScoreText = document.querySelector('#map-score');
const bucket = document.querySelector('.bucket');
const bucketWater = document.querySelector('#bucket-water');
const fillPercentText = document.querySelector('#fill-percent');
const fillStatus = document.querySelector('#fill-status');
const pumpButton = document.querySelector('#pump-button');
const pumpInstruction = document.querySelector('#pump-instruction');
const mapStage = document.querySelector('#map-stage');
const carrier = document.querySelector('#carrier');
const mapFeedback = document.querySelector('#map-feedback');
const pumpMoreButton = document.querySelector('#pump-more-button');
const destinationButtons = document.querySelectorAll('.destination');

// Only one screen is visible at a time, just like moving between game scenes.
function showScreen(screenToShow) {
	Object.values(screens).forEach((screen) => {
		screen.hidden = screen !== screenToShow;
	});
}

function formatTime(seconds) {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Update both HUDs together so the timer and score never drift between screens.
function updateHud() {
	const timeText = formatTime(game.secondsLeft);
	const scoreText = `${game.totalScore} pts`;
	fillTimerText.textContent = timeText;
	mapTimerText.textContent = timeText;
	fillScoreText.textContent = scoreText;
	mapScoreText.textContent = scoreText;
}

function startGame() {
	clearInterval(gameTimer);
	game.secondsLeft = GAME_LENGTH;
	game.totalScore = 0;
	game.scores = { school: 0, home: 0, business: 0 };
	game.ended = false;
	game.phase = 'filling';
	document.querySelector('#celebration').hidden = true;
	updateHud();
	startFillScreen();

	// The five-minute countdown begins only after Play now is selected.
	gameTimer = setInterval(() => {
		game.secondsLeft -= 1;
		updateHud();
		if (game.secondsLeft <= 0) endGame();
	}, 1000);
}

function startFillScreen() {
	if (game.ended) return;

	game.phase = 'filling';
	game.fillPercent = 0;
	game.isHoldingPump = false;
	clearInterval(fillTimer);
	clearTimeout(fillPreviewTimer);
	pumpButton.disabled = false;
	pumpButton.setAttribute('aria-pressed', 'false');
	pumpInstruction.innerHTML = 'Press and hold<br>to pump';
	fillStatus.textContent = 'Your bucket is ready.';
	updateFillDisplay();
	showScreen(screens.fill);
}

function updateFillDisplay() {
	// The bucket has a small head space, so 100% lines up with the dotted mark.
	bucketWater.style.height = `${game.fillPercent * 0.8}%`;
	fillPercentText.textContent = `${game.fillPercent}%`;
	bucket.setAttribute('aria-label', `Water bucket, ${game.fillPercent} percent full`);
}

function beginPumping() {
	if (game.phase !== 'filling' || game.isHoldingPump || game.ended) return;

	game.isHoldingPump = true;
	pumpButton.setAttribute('aria-pressed', 'true');
	fillStatus.textContent = 'Pumping water...';
	pumpInstruction.textContent = 'Keep holding';

	// One small step per tick makes the fill rate simple to tune.
	fillTimer = setInterval(() => {
		game.fillPercent = Math.min(100, game.fillPercent + 1);
		updateFillDisplay();

		if (game.fillPercent === 100) finishFilling();
	}, FILL_SPEED);
}

function stopPumping() {
	if (!game.isHoldingPump || game.phase !== 'filling') return;

	game.isHoldingPump = false;
	pumpButton.setAttribute('aria-pressed', 'false');
	clearInterval(fillTimer);
	finishFilling();
}

function finishFilling() {
	if (game.phase !== 'filling' || game.ended) return;

	game.phase = 'preview';
	game.isHoldingPump = false;
	clearInterval(fillTimer);
	pumpButton.disabled = true;
	pumpButton.setAttribute('aria-pressed', 'false');
	pumpInstruction.textContent = 'Bucket ready!';
	fillStatus.textContent = `${game.fillPercent}% filled. Get ready to choose a destination.`;

	// Leave the final water level visible briefly before opening the map.
	fillPreviewTimer = setTimeout(showMap, FILL_PREVIEW_TIME);
}

function showMap() {
	if (game.ended || game.secondsLeft <= 0) return;

	game.phase = 'map';
	game.carrierLane = 1;
	game.carrierHeight = 0;
	game.selectedDestination = null;
	mapFeedback.textContent = 'Use the arrows to slide in any direction.';
	updateMap();
	showScreen(screens.map);
}

function updateMap() {
	const lanePositions = ['16.7%', '50%', '83.3%'];
	carrier.style.setProperty('--carrier-x', lanePositions[game.carrierLane]);
	carrier.style.setProperty('--carrier-bottom', `calc(4% + ${game.carrierHeight * 20}%)`);

	// Reaching the top of a lane selects its community destination.
	if (game.carrierHeight >= 3) {
		game.selectedDestination = destinations[game.carrierLane];
	} else {
		game.selectedDestination = null;
	}

	destinationButtons.forEach((button) => {
		const isSelected = game.selectedDestination?.id === button.dataset.destination;
		button.setAttribute('aria-pressed', String(isSelected));
	});

	pumpMoreButton.disabled = !game.selectedDestination;
	if (game.selectedDestination) {
		mapFeedback.textContent = `${game.selectedDestination.name} selected. Confirm to deliver your water.`;
	}
}

function moveCarrier(direction) {
	if (game.phase !== 'map' || game.ended) return;

	if (direction === 'left') game.carrierLane = Math.max(0, game.carrierLane - 1);
	if (direction === 'right') game.carrierLane = Math.min(2, game.carrierLane + 1);
	if (direction === 'up') game.carrierHeight = Math.min(3, game.carrierHeight + 1);
	if (direction === 'down') game.carrierHeight = Math.max(0, game.carrierHeight - 1);
	updateMap();

	if (!game.selectedDestination) {
		mapFeedback.textContent = 'Keep sliding toward a community stop.';
	}
}

function selectDestination(destinationId) {
	if (game.phase !== 'map' || game.ended) return;

	const destination = destinations.find((place) => place.id === destinationId);
	if (!destination) return;

	// Tapping a destination is a direct option; the carrier still moves there.
	game.carrierLane = destination.lane;
	game.carrierHeight = 3;
	updateMap();
}

function deliverWater() {
	if (!game.selectedDestination || game.phase !== 'map' || game.ended) return;

	const destination = game.selectedDestination;
	const pointsEarned = game.fillPercent < 60
		? Math.floor(destination.points / 2)
		: destination.points;

	game.scores[destination.id] += pointsEarned;
	game.totalScore += pointsEarned;
	updateHud();

	const fillMessage = game.fillPercent < 60 ? 'Half points for a fill below 60%' : 'Full points for a strong fill';
	mapFeedback.textContent = `${destination.name} received water: +${pointsEarned} points. ${fillMessage}.`;

	// Every delivery starts a fresh fill, so players make one stop per bucket.
	startFillScreen();
}

function buildConfetti() {
	const confetti = document.querySelector('#confetti');
	const colors = ['#ffc907', '#2e9df7', '#4fcb53', '#ff902a', '#f5402c', '#ffffff'];
	confetti.replaceChildren();

	// Each piece gets a slightly different path and timing for a full-screen burst.
	for (let pieceNumber = 0; pieceNumber < 120; pieceNumber += 1) {
		const piece = document.createElement('span');
		piece.className = 'confetti-piece';
		piece.style.setProperty('--confetti-x', `${Math.random() * 100}%`);
		piece.style.setProperty('--confetti-color', colors[pieceNumber % colors.length]);
		piece.style.setProperty('--confetti-delay', `${Math.random() * 0.8}s`);
		piece.style.setProperty('--confetti-duration', `${1.7 + Math.random() * 1.6}s`);
		confetti.append(piece);
	}
}

function endGame() {
	if (game.ended) return;

	game.ended = true;
	game.phase = 'over';
	game.secondsLeft = 0;
	game.isHoldingPump = false;
	clearInterval(gameTimer);
	clearInterval(fillTimer);
	clearTimeout(fillPreviewTimer);
	updateHud();

	pumpButton.disabled = true;
	buildConfetti();
	document.querySelector('#celebration').hidden = false;
}

function showGameOver() {
	document.querySelector('#celebration').hidden = true;
	document.querySelector('#school-score').textContent = `+${game.scores.school} pts`;
	document.querySelector('#home-score').textContent = `+${game.scores.home} pts`;
	document.querySelector('#business-score').textContent = `+${game.scores.business} pts`;
	document.querySelector('#total-score').textContent = `${game.totalScore} pts`;
	showScreen(screens.gameOver);
}

function returnToTitle() {
	clearInterval(gameTimer);
	clearInterval(fillTimer);
	clearTimeout(fillPreviewTimer);
	document.querySelector('#celebration').hidden = true;
	game.ended = false;
	game.phase = 'title';
	showScreen(screens.title);
}

document.querySelector('#play-button').addEventListener('click', startGame);
document.querySelector('#replay-button').addEventListener('click', returnToTitle);
document.querySelector('#skip-celebration').addEventListener('click', showGameOver);
pumpMoreButton.addEventListener('click', deliverWater);

// Pointer events support mouse, pen, and touchscreen with the same hold logic.
pumpButton.addEventListener('pointerdown', (event) => {
	event.preventDefault();
	beginPumping();
});
window.addEventListener('pointerup', stopPumping);
window.addEventListener('pointercancel', stopPumping);

// Keyboard users can hold Space or Enter just as they would hold the pump.
pumpButton.addEventListener('keydown', (event) => {
	if (event.key === ' ' || event.key === 'Enter') {
		event.preventDefault();
		beginPumping();
	}
});
window.addEventListener('keyup', (event) => {
	if (event.key === ' ' || event.key === 'Enter') stopPumping();
});

document.querySelectorAll('[data-direction]').forEach((button) => {
	button.addEventListener('click', () => moveCarrier(button.dataset.direction));
});

destinationButtons.forEach((button) => {
	button.addEventListener('click', () => selectDestination(button.dataset.destination));
});

// Arrow keys and simple swipes give players more than one way to move on the map.
window.addEventListener('keydown', (event) => {
	if (game.phase !== 'map' || !event.key.startsWith('Arrow')) return;

	event.preventDefault();
	moveCarrier(event.key.slice(5).toLowerCase());
});

let swipeStart = null;
mapStage.addEventListener('pointerdown', (event) => {
	if (event.target.closest('button')) return;
	swipeStart = { x: event.clientX, y: event.clientY };
});
mapStage.addEventListener('pointerup', (event) => {
	if (!swipeStart) return;

	const horizontalDistance = event.clientX - swipeStart.x;
	const verticalDistance = event.clientY - swipeStart.y;
	swipeStart = null;

	if (Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < 28) return;
	if (Math.abs(horizontalDistance) > Math.abs(verticalDistance)) {
		moveCarrier(horizontalDistance > 0 ? 'right' : 'left');
	} else {
		moveCarrier(verticalDistance < 0 ? 'up' : 'down');
	}
});
mapStage.addEventListener('pointercancel', () => { swipeStart = null; });

// The title screen is the initial state; no timer runs until Play now is clicked.
showScreen(screens.title);
