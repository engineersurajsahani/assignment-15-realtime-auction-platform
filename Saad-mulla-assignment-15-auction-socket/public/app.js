const socket = io();

const auctionId = "AUC_VINTAGE_99";
let username = prompt("Enter your Bidder Name:") || `Bidder_${Math.floor(Math.random() * 1000)}`;

let currentAuction = null;

// DOM Elements
const userDisplay = document.getElementById('user-display');
const viewerCount = document.getElementById('viewer-count');
const alertBanner = document.getElementById('alert-banner');
const itemTitle = document.getElementById('item-title');
const itemDesc = document.getElementById('item-description');
const currentBidEl = document.getElementById('current-bid');
const highestBidderEl = document.getElementById('highest-bidder');
const timerDisplay = document.getElementById('timer-display');
const timerBox = document.getElementById('timer-box');
const auctionStatus = document.getElementById('auction-status');
const bidInput = document.getElementById('bid-input');
const btnPlaceBid = document.getElementById('btn-place-bid');
const btnQuickBid = document.getElementById('btn-quick-bid');
const bidHistoryEl = document.getElementById('bid-history');

userDisplay.textContent = `👤 ${username}`;

// Audio Cues (Synthesized via Web Audio API)
function playTone(freq = 440, type = 'sine', duration = 0.15) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

// 1. Join Room
socket.emit('auction:join', { auctionId, username });

// 2. Hydrate Room State
socket.on('auction:init', (data) => {
  currentAuction = data.item;
  itemTitle.textContent = currentAuction.title;
  itemDesc.textContent = currentAuction.description;
  updatePriceDisplay(currentAuction.currentBid, currentAuction.highestBidder);
  updateTimerDisplay(data.timeRemaining);
  renderHistory(data.bidHistory);
  
  if (currentAuction.status === 'ended') {
    endAuctionUI(currentAuction.highestBidder);
  }
});

// 3. Time Tick Synchronizer
socket.on('auction:time_tick', (data) => {
  updateTimerDisplay(data.timeRemaining);
});

// 4. Audience Counter
socket.on('user:joined', (data) => {
  viewerCount.textContent = `👀 Viewers: ${data.totalViewers}`;
});

// 5. Bid Success Broadcast
socket.on('bid:success', (data) => {
  playTone(600, 'triangle', 0.2);
  updatePriceDisplay(data.newBid, data.highestBidder);
  renderHistory(data.bidHistory);
  updateTimerDisplay(data.timeRemaining);
});

// 6. Targeted Outbid Alert
socket.on('bid:outbid', (data) => {
  playTone(200, 'sawtooth', 0.4);
  showAlert(data.message, 'outbid');
});

// 7. Anti-Snipe Extension Alert
socket.on('auction:extended', (data) => {
  playTone(800, 'sine', 0.3);
  showAlert(data.message, 'extended');
  updateTimerDisplay(data.timeRemaining);
});

// 8. Bid Rejected Handler
socket.on('bid:rejected', (data) => {
  playTone(150, 'square', 0.2);
  showAlert(`⚠️ Bid Rejected: ${data.reason}`, 'rejected');
});

// 9. Auction Sold Broadcast
socket.on('auction:sold', (data) => {
  playTone(1000, 'sine', 0.5);
  endAuctionUI(data.winner);
});

// Event Listeners
btnPlaceBid.addEventListener('click', () => {
  const amount = Number(bidInput.value);
  if (!amount) return;
  socket.emit('bid:place', { auctionId, amount });
  bidInput.value = '';
});

btnQuickBid.addEventListener('click', () => {
  if (!currentAuction) return;
  const nextMinBid = currentAuction.currentBid + currentAuction.minIncrement;
  socket.emit('bid:place', { auctionId, amount: nextMinBid });
});

// UI Helper Functions
function updatePriceDisplay(price, bidder) {
  if (currentAuction) currentAuction.currentBid = price;
  currentBidEl.textContent = `₹${price.toLocaleString('en-IN')}`;
  highestBidderEl.textContent = bidder ? `Highest Bidder: ${bidder}` : 'Highest Bidder: None';
  
  if (currentAuction) {
    btnQuickBid.textContent = `+ Quick ₹${currentAuction.minIncrement.toLocaleString('en-IN')}`;
  }
}

function updateTimerDisplay(seconds) {
  timerDisplay.textContent = `${seconds}s`;
  if (seconds <= 10 && seconds > 0) {
    timerBox.classList.add('warning');
  } else {
    timerBox.classList.remove('warning');
  }
}

function showAlert(message, type) {
  alertBanner.textContent = message;
  alertBanner.className = `banner ${type}`;
  setTimeout(() => {
    alertBanner.className = 'banner hidden';
  }, 4000);
}

function renderHistory(history) {
  if (!history || history.length === 0) {
    bidHistoryEl.innerHTML = '<li class="empty-msg">No bids placed yet.</li>';
    return;
  }
  
  bidHistoryEl.innerHTML = history.map(item => `
    <li>
      <span class="bidder">${item.bidder}</span>
      <span class="amount">₹${item.amount.toLocaleString('en-IN')}</span>
      <span class="time">${item.timestamp}</span>
    </li>
  `).join('');
}

function endAuctionUI(winner) {
  auctionStatus.textContent = 'SOLD / ENDED';
  auctionStatus.className = 'badge ended';
  btnPlaceBid.disabled = true;
  btnQuickBid.disabled = true;
  bidInput.disabled = true;
  showAlert(`🏆 Auction Ended! Winner: ${winner || 'No Bids'}`, 'extended');
}
