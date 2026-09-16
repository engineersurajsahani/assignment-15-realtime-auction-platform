const socket = io();
const auctionId = 'AUC_VINTAGE_99';
const username = prompt('Enter your name:') || 'Bidder-' + Math.floor(Math.random() * 1000);

socket.on('connect', () => {
  socket.emit('auction:join', { auctionId, username });
});

const el = (id) => document.getElementById(id);

socket.on('auction:init', ({ item, bidHistory, timeRemaining }) => {
  el('title').textContent = item.title;
  el('description').textContent = item.description;
  el('price').textContent = `₹${item.currentBid.toLocaleString()}`;
  el('bidder').textContent = item.highestBidder ? `Highest bidder: ${item.highestBidder}` : 'No bids yet';
  el('timer').textContent = `⏱ ${timeRemaining}s`;
  renderHistory(bidHistory);
});

socket.on('auction:time_tick', ({ timeRemaining }) => {
  el('timer').textContent = `⏱ ${timeRemaining}s`;
});

socket.on('bid:success', ({ currentBid, highestBidder, bidHistory, timeRemaining }) => {
  el('price').textContent = `₹${currentBid.toLocaleString()}`;
  el('bidder').textContent = `Highest bidder: ${highestBidder}`;
  el('timer').textContent = `⏱ ${timeRemaining}s`;
  renderHistory(bidHistory);
});

socket.on('bid:outbid', ({ message }) => {
  showAlert(message);
});

socket.on('bid:rejected', ({ reason }) => {
  showAlert(reason);
});

socket.on('auction:extended', ({ message }) => {
  showAlert(message);
  el('timer').classList.add('extended');
  setTimeout(() => el('timer').classList.remove('extended'), 500);
});

socket.on('auction:sold', ({ winner, finalPrice }) => {
  el('alerts').textContent = `🔨 SOLD to ${winner || 'no one'} for ₹${finalPrice.toLocaleString()}!`;
  el('bidBtn').disabled = true;
});

socket.on('user:joined', ({ totalViewers }) => {
  el('viewers').textContent = `👀 ${totalViewers} viewers`;
});

function showAlert(message) {
  el('alerts').textContent = message;
  setTimeout(() => { if (el('alerts').textContent === message) el('alerts').textContent = ''; }, 4000);
}

function renderHistory(bidHistory) {
  el('history').innerHTML = bidHistory
    .map(b => `<div class="hist-item">${b.bidder} — ₹${b.amount.toLocaleString()} at ${b.timestamp}</div>`)
    .join('');
}

el('bidBtn').addEventListener('click', () => {
  const amount = parseFloat(el('bidInput').value);
  if (!amount) return;
  socket.emit('bid:place', { auctionId, amount });
  el('bidInput').value = '';
});