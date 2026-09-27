const socket = io();

const loginPage = document.getElementById('loginPage');
const auctionPage = document.getElementById('auctionPage');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('usernameInput');

let username = '';
const auctionId = 'AUC_VINTAGE_99'; // Default for assignment

joinBtn.addEventListener('click', () => {
  if (usernameInput.value.trim()) {
    username = usernameInput.value.trim();
    loginPage.classList.remove('active');
    auctionPage.classList.add('active');
    socket.emit('auction:join', { auctionId, username });
  }
});

// UI Elements
const itemTitle = document.getElementById('itemTitle');
const itemDesc = document.getElementById('itemDesc');
const currentBidDisplay = document.getElementById('currentBidDisplay');
const highestBidderDisplay = document.getElementById('highestBidderDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const viewersCount = document.getElementById('viewersCount');
const bidInput = document.getElementById('bidInput');
const placeBidBtn = document.getElementById('placeBidBtn');
const bidHistoryList = document.getElementById('bidHistoryList');
const alertsContainer = document.getElementById('alertsContainer');

function showAlert(message, type = 'info') {
  const alertEl = document.createElement('div');
  alertEl.className = `alert ${type}`;
  alertEl.innerText = message;
  alertsContainer.appendChild(alertEl);
  setTimeout(() => alertEl.remove(), 4000);
}

function renderHistory(history) {
  bidHistoryList.innerHTML = history.map(h => `<li><strong>${h.bidder}</strong> bid ₹${h.amount} <span class="time">${h.timestamp}</span></li>`).join('');
}

// Socket Listeners
socket.on('auction:init', ({ item, bidHistory, timeRemaining }) => {
  itemTitle.innerText = item.title;
  itemDesc.innerText = item.description;
  currentBidDisplay.innerText = `₹${item.currentBid}`;
  highestBidderDisplay.innerText = item.highestBidder ? item.highestBidder.username : 'None';
  timerDisplay.innerText = `${timeRemaining}s`;
  renderHistory(bidHistory);
});

socket.on('user:joined', ({ totalViewers }) => {
  viewersCount.innerText = totalViewers;
});

socket.on('user:left', ({ totalViewers }) => {
  viewersCount.innerText = totalViewers;
});

socket.on('auction:time_tick', ({ timeRemaining }) => {
  timerDisplay.innerText = `${timeRemaining}s`;
  if (timeRemaining <= 10) timerDisplay.classList.add('danger');
  else timerDisplay.classList.remove('danger');
});

socket.on('bid:success', ({ currentBid, highestBidder, bidHistory, timeRemaining }) => {
  currentBidDisplay.innerText = `₹${currentBid}`;
  highestBidderDisplay.innerText = highestBidder;
  timerDisplay.innerText = `${timeRemaining}s`;
  renderHistory(bidHistory);
  showAlert(`New highest bid from ${highestBidder}: ₹${currentBid}`, 'success');
});

socket.on('bid:outbid', ({ message }) => {
  showAlert(message, 'error');
});

socket.on('bid:rejected', ({ reason }) => {
  showAlert(reason, 'error');
});

socket.on('auction:extended', ({ message }) => {
  showAlert(message, 'info');
});

socket.on('auction:sold', ({ winner, finalPrice, status }) => {
  timerDisplay.innerText = 'SOLD';
  timerDisplay.classList.add('sold');
  placeBidBtn.disabled = true;
  showAlert(`Auction ended! Winner: ${winner} at ₹${finalPrice}`, 'success');
});

// Place Bid
placeBidBtn.addEventListener('click', () => {
  const amount = parseInt(bidInput.value);
  if (amount) {
    socket.emit('bid:place', { auctionId, amount });
    bidInput.value = '';
  }
});
