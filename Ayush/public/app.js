const socket = io();

const lobbyEl = document.getElementById('lobby');
const roomEl = document.getElementById('room');
const usernameInput = document.getElementById('usernameInput');
const auctionListEl = document.getElementById('auctionList');
const backBtn = document.getElementById('backBtn');

const roomEmoji = document.getElementById('roomEmoji');
const roomTitle = document.getElementById('roomTitle');
const roomDesc = document.getElementById('roomDesc');
const viewerCountEl = document.getElementById('viewerCount');
const currentBidEl = document.getElementById('currentBid');
const highestBidderEl = document.getElementById('highestBidder');
const timerEl = document.getElementById('timer');
const timerCard = document.getElementById('timerCard');
const bidInput = document.getElementById('bidInput');
const placeBidBtn = document.getElementById('placeBidBtn');
const quickBidsEl = document.getElementById('quickBids');
const alertBox = document.getElementById('alertBox');
const statusBanner = document.getElementById('statusBanner');
const bidHistoryEl = document.getElementById('bidHistory');
const bidSound = document.getElementById('bidSound');

let currentAuction = null;
let username = '';

function fmt(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

async function loadLobby() {
  const res = await fetch('/api/auctions');
  const auctions = await res.json();
  auctionListEl.innerHTML = '';
  auctions.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'auction-card';
    card.innerHTML = `
      <span class="badge ${a.status === 'ended' ? 'ended' : ''}">${a.status.toUpperCase()}</span>
      <div class="emoji">${a.image}</div>
      <h3>${a.title}</h3>
      <p>${a.description}</p>
      <div class="price-row">
        <span class="amount">${fmt(a.currentBid)}</span>
        <span class="viewers">👀 ${a.totalViewers}</span>
      </div>
    `;
    card.addEventListener('click', () => joinAuction(a.id));
    auctionListEl.appendChild(card);
  });
}

function joinAuction(auctionId) {
  username = usernameInput.value.trim() || `Bidder_${Math.floor(Math.random() * 1000)}`;
  socket.emit('auction:join', { auctionId, username });
}

backBtn.addEventListener('click', () => {
  roomEl.classList.add('hidden');
  lobbyEl.classList.remove('hidden');
  currentAuction = null;
  loadLobby();
});

function renderRoom() {
  const a = currentAuction;
  roomEmoji.textContent = a.image;
  roomTitle.textContent = a.title;
  roomDesc.textContent = a.description;
  currentBidEl.textContent = fmt(a.currentBid);
  highestBidderEl.textContent = a.highestBidder ? `Leading: ${a.highestBidder.username}` : 'No bids yet';
  bidInput.min = a.currentBid + a.minIncrement;
  bidInput.placeholder = `Min: ${fmt(a.currentBid + a.minIncrement)}`;

  renderQuickBids();
  renderHistory(a.bidHistory);
  setTimer(a.timeRemainingSeconds);

  const closed = a.status !== 'active';
  placeBidBtn.disabled = closed;
  bidInput.disabled = closed;
}

function renderQuickBids() {
  const a = currentAuction;
  const base = a.currentBid + a.minIncrement;
  const options = [base, base + a.minIncrement, base + a.minIncrement * 2];
  quickBidsEl.innerHTML = '';
  options.forEach((amt) => {
    const btn = document.createElement('button');
    btn.textContent = fmt(amt);
    btn.addEventListener('click', () => placeBid(amt));
    quickBidsEl.appendChild(btn);
  });
}

function renderHistory(history) {
  bidHistoryEl.innerHTML = '';
  history.forEach((h) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="bidder">${h.bidder}</span>
      <span class="amount">${fmt(h.amount)}</span>
      <span class="time">${h.timestamp}</span>
    `;
    bidHistoryEl.appendChild(li);
  });
  if (history.length === 0) {
    bidHistoryEl.innerHTML = '<li style="color:#8b949e">No bids yet — be the first!</li>';
  }
}

function setTimer(seconds) {
  timerEl.textContent = `${seconds}s`;
  timerCard.classList.toggle('urgent', seconds <= 15 && seconds > 0);
}

function showAlert(message, type) {
  alertBox.textContent = message;
  alertBox.className = `alert-box ${type}`;
  setTimeout(() => {
    alertBox.textContent = '';
    alertBox.className = 'alert-box';
  }, 4000);
}

function showBanner(message, type) {
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}`;
  statusBanner.classList.remove('hidden');
}

function playBidSound() {
  try { bidSound.currentTime = 0; bidSound.play(); } catch (e) {  }
}

function placeBid(amount) {
  if (!currentAuction) return;
  socket.emit('bid:place', { auctionId: currentAuction.id, amount: Number(amount) });
}

placeBidBtn.addEventListener('click', () => {
  const val = Number(bidInput.value);
  if (!val) return showAlert('Enter a valid bid amount', 'rejected');
  placeBid(val);
  bidInput.value = '';
});

bidInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') placeBidBtn.click();
});

socket.on('auction:init', ({ item, bidHistory, timeRemaining }) => {
  currentAuction = { ...item, bidHistory };
  currentAuction.timeRemainingSeconds = timeRemaining;
  statusBanner.classList.add('hidden');
  lobbyEl.classList.add('hidden');
  roomEl.classList.remove('hidden');
  viewerCountEl.textContent = item.totalViewers;
  renderRoom();
});

socket.on('user:joined', ({ totalViewers }) => {
  viewerCountEl.textContent = totalViewers;
});

socket.on('auction:time_tick', ({ auctionId, timeRemaining }) => {
  if (!currentAuction || currentAuction.id !== auctionId) return;
  currentAuction.timeRemainingSeconds = timeRemaining;
  setTimer(timeRemaining);
});

socket.on('bid:success', ({ auctionId, currentBid, highestBidder, bidHistory, timeRemaining }) => {
  if (!currentAuction || currentAuction.id !== auctionId) return;
  currentAuction.currentBid = currentBid;
  currentAuction.highestBidder = { username: highestBidder };
  currentAuction.bidHistory = bidHistory;
  currentAuction.timeRemainingSeconds = timeRemaining;
  playBidSound();
  renderRoom();
});

socket.on('bid:outbid', ({ auctionId, message }) => {
  if (!currentAuction || currentAuction.id !== auctionId) return;
  showAlert(message, 'outbid');
});

socket.on('bid:rejected', ({ reason }) => {
  showAlert(reason, 'rejected');
});

socket.on('auction:extended', ({ auctionId, message, timeRemaining }) => {
  if (!currentAuction || currentAuction.id !== auctionId) return;
  currentAuction.timeRemainingSeconds = timeRemaining;
  setTimer(timeRemaining);
  showBanner(`⏱️ ${message}`, 'extended');
  setTimeout(() => statusBanner.classList.add('hidden'), 3000);
});

socket.on('auction:sold', ({ auctionId, winner, finalPrice, status }) => {
  if (!currentAuction || currentAuction.id !== auctionId) return;
  currentAuction.status = 'ended';
  placeBidBtn.disabled = true;
  bidInput.disabled = true;
  if (status === 'sold') {
    showBanner(`🏆 SOLD to ${winner} for ${fmt(finalPrice)}!`, 'sold');
  } else {
    showBanner('❌ Auction ended with no winning bid.', 'unsold');
  }
});

loadLobby();
