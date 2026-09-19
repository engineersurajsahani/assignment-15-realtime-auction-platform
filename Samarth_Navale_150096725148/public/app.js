const socket = io();

let currentBidVal = 50000;
let minIncrementVal = 2000;
const auctionId = 'AUC_VINTAGE_99';

const joinBox = document.getElementById('joinBox');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const auctionContent = document.getElementById('auctionContent');

const itemTitle = document.getElementById('itemTitle');
const itemDesc = document.getElementById('itemDesc');
const currentPrice = document.getElementById('currentPrice');
const highestBidder = document.getElementById('highestBidder');
const timerText = document.getElementById('timerText');
const viewersCount = document.getElementById('viewersCount');
const historyList = document.getElementById('historyList');

const outbidAlert = document.getElementById('outbidAlert');
const extendedAlert = document.getElementById('extendedAlert');
const errorAlert = document.getElementById('errorAlert');

const customBidInput = document.getElementById('customBidInput');
const placeBidBtn = document.getElementById('placeBidBtn');
const quickBidMin = document.getElementById('quickBidMin');
const quickBid5k = document.getElementById('quickBid5k');
const quickBid10k = document.getElementById('quickBid10k');

const joinAuction = () => {
  const uname = usernameInput.value.trim() || 'Bidder';
  socket.emit('auction:join', { auctionId, username: uname });
  joinBox.style.display = 'none';
  auctionContent.style.display = 'block';
};

joinBtn.addEventListener('click', joinAuction);

const renderHistory = (history) => {
  historyList.innerHTML = '';
  if (Array.isArray(history)) {
    history.forEach((h) => {
      const li = document.createElement('li');
      li.textContent = `₹${h.amount.toLocaleString()} by ${h.bidder} (${h.timestamp})`;
      historyList.appendChild(li);
    });
  }
};

const sendBid = (amt) => {
  errorAlert.style.display = 'none';
  socket.emit('bid:place', {
    auctionId,
    amount: amt
  });
};

placeBidBtn.addEventListener('click', () => {
  const val = Number(customBidInput.value);
  if (val) {
    sendBid(val);
    customBidInput.value = '';
  }
});

quickBidMin.addEventListener('click', () => sendBid(currentBidVal + minIncrementVal));
quickBid5k.addEventListener('click', () => sendBid(currentBidVal + 5000));
quickBid10k.addEventListener('click', () => sendBid(currentBidVal + 10000));

socket.on('auction:init', ({ item, bidHistory, timeRemaining, totalViewers }) => {
  itemTitle.textContent = item.title;
  itemDesc.textContent = item.description;
  currentBidVal = item.currentBid;
  minIncrementVal = item.minIncrement;
  currentPrice.textContent = `₹${item.currentBid.toLocaleString()}`;
  highestBidder.textContent = item.highestBidder || 'None';
  timerText.textContent = `${timeRemaining}s`;
  viewersCount.textContent = totalViewers || 1;
  renderHistory(bidHistory);
});

socket.on('auction:time_tick', ({ timeRemaining }) => {
  timerText.textContent = `${timeRemaining}s`;
});

socket.on('bid:success', ({ currentBid, highestBidder: leader, bidHistory, timeRemaining }) => {
  currentBidVal = currentBid;
  currentPrice.textContent = `₹${currentBid.toLocaleString()}`;
  highestBidder.textContent = leader;
  timerText.textContent = `${timeRemaining}s`;
  renderHistory(bidHistory);
  outbidAlert.style.display = 'none';
});

socket.on('bid:outbid', ({ message }) => {
  outbidAlert.textContent = message;
  outbidAlert.style.display = 'block';
});

socket.on('bid:rejected', ({ reason }) => {
  errorAlert.textContent = reason;
  errorAlert.style.display = 'block';
  setTimeout(() => {
    errorAlert.style.display = 'none';
  }, 4000);
});

socket.on('auction:extended', ({ message }) => {
  extendedAlert.textContent = message;
  extendedAlert.style.display = 'block';
  setTimeout(() => {
    extendedAlert.style.display = 'none';
  }, 4000);
});

socket.on('auction:sold', ({ winner, finalPrice }) => {
  timerText.textContent = 'AUCTION CLOSED';
  timerText.style.color = '#666';
  extendedAlert.textContent = `🔨 SOLD to ${winner} for ₹${finalPrice.toLocaleString()}!`;
  extendedAlert.style.display = 'block';
  document.querySelectorAll('button').forEach((b) => (b.disabled = true));
});

socket.on('user:joined', ({ totalViewers }) => {
  viewersCount.textContent = totalViewers;
});
