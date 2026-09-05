// Real-Time Live Auction & Bidding Floor - Client Application

let socket = null;
let currentAuctionId = 'AUC_VINTAGE_99';
let currentUser = '';
let currentBid = 50000;
let minIncrement = 2000;
let isAuctionActive = true;

// Utility: Format Currency
function formatINR(val) {
  return parseInt(val, 10).toLocaleString('en-IN');
}

// Utility: Format Time Seconds to MM:SS
function formatTime(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Alert Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('alert-banner-container');
  const toast = document.createElement('div');
  toast.className = `alert-toast toast-${type}`;

  let icon = '🔔';
  if (type === 'outbid') icon = '⚠️';
  if (type === 'snipe') icon = '⚡';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Sound Cues (Synthetic Web Audio)
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'bid') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'outbid') {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Audio context not allowed before interaction
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Clear any old shared localStorage
  localStorage.removeItem('auction_user');

  const modal = document.getElementById('username-modal');
  const formLogin = document.getElementById('form-user-login');
  const userHandleInput = document.getElementById('input-user-handle');
  const roomSelector = document.getElementById('select-auction-room');
  const formBid = document.getElementById('form-place-bid');
  const bidInput = document.getElementById('input-bid-amount');
  const btnRestart = document.getElementById('btn-restart-auction');
  const userBadgeBtn = document.getElementById('user-badge-btn');
  const quickButtons = document.querySelectorAll('.btn-quick');

  // Use sessionStorage (tab-isolated) so different tabs can have different bidder names
  const savedUser = sessionStorage.getItem('auction_tab_user');
  if (savedUser) {
    currentUser = savedUser;
    modal.classList.add('hidden');
    initSocketConnection();
  } else {
    modal.classList.remove('hidden');
  }

  // Allow clicking badge to change name in current tab
  if (userBadgeBtn) {
    userBadgeBtn.style.cursor = 'pointer';
    userBadgeBtn.title = 'Click to switch bidder name';
    userBadgeBtn.addEventListener('click', () => {
      userHandleInput.value = currentUser || '';
      modal.classList.remove('hidden');
      userHandleInput.focus();
    });
  }

  formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredName = userHandleInput.value.trim();
    if (enteredName) {
      currentUser = enteredName;
      sessionStorage.setItem('auction_tab_user', currentUser);
      modal.classList.add('hidden');
      initSocketConnection();
    }
  });

  // Room Switch
  roomSelector.addEventListener('change', (e) => {
    currentAuctionId = e.target.value;
    if (socket) {
      socket.emit('auction:join', {
        auctionId: currentAuctionId,
        username: currentUser
      });
    }
  });

  // Quick Bid Buttons
  quickButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const addVal = parseInt(btn.getAttribute('data-add'), 10);
      const calculatedBid = currentBid + addVal;
      bidInput.value = calculatedBid;
    });
  });

  // Bid Form Submission
  formBid.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!isAuctionActive) {
      showToast('This auction is closed', 'outbid');
      return;
    }

    const amount = parseInt(bidInput.value, 10);
    if (socket) {
      socket.emit('bid:place', {
        auctionId: currentAuctionId,
        amount: amount
      });
    }
  });

  // Restart Auction Lot Demo
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (socket) {
        socket.emit('auction:restart', { auctionId: currentAuctionId });
      }
    });
  }
});

function initSocketConnection() {
  document.getElementById('current-username-display').textContent = currentUser;

  if (!socket) {
    socket = io();
    setupSocketListeners();
  }

  // Re-join with the updated username
  socket.emit('auction:join', {
    auctionId: currentAuctionId,
    username: currentUser
  });
}

function setupSocketListeners() {
  // 1. Hydrate Room State
  socket.on('auction:init', (data) => {
    const item = data.item;
    currentBid = item.currentBid;
    minIncrement = item.minIncrement;
    isAuctionActive = item.status === 'active';

    // Populate UI
    document.getElementById('item-title').textContent = item.title;
    document.getElementById('item-category').textContent = item.category;
    document.getElementById('item-description').textContent = item.description;
    document.getElementById('item-image').src = item.image;
    document.getElementById('price-digits').textContent = formatINR(currentBid);
    document.getElementById('leader-name').textContent = item.highestBidder || 'None yet';
    document.getElementById('viewer-count').textContent = data.totalViewers || 1;

    updateNextMinBid(currentBid + minIncrement);
    updateCountdown(data.timeRemaining);
    renderBidHistory(data.bidHistory || []);

    if (isAuctionActive) {
      document.getElementById('sold-banner').classList.add('hidden');
      document.getElementById('btn-submit-bid').disabled = false;
      document.getElementById('lot-status-pill').textContent = '🟢 LIVE BIDDING';
      document.getElementById('lot-status-pill').style.background = 'rgba(16, 185, 129, 0.9)';
    } else {
      showSoldState(item.highestBidder, item.currentBid);
    }
  });

  // 2. Clock Tick
  socket.on('auction:time_tick', ({ auctionId, timeRemaining }) => {
    if (auctionId === currentAuctionId) {
      updateCountdown(timeRemaining);
    }
  });

  // 3. Viewer Count Update
  socket.on('user:joined', ({ totalViewers }) => {
    document.getElementById('viewer-count').textContent = totalViewers;
  });

  // 4. Successful Bid
  socket.on('bid:success', (data) => {
    if (data.auctionId === currentAuctionId) {
      currentBid = data.currentBid;
      document.getElementById('price-digits').textContent = formatINR(currentBid);
      document.getElementById('leader-name').textContent = data.highestBidder;
      updateNextMinBid(data.minNextBid);
      renderBidHistory(data.bidHistory);
      playSound('bid');

      // Ticker pulse animation
      const priceCard = document.querySelector('.price-card');
      priceCard.style.boxShadow = '0 0 35px rgba(245, 158, 11, 0.6)';
      setTimeout(() => {
        priceCard.style.boxShadow = '';
      }, 500);
    }
  });

  // 5. Targeted Outbid Alert
  socket.on('bid:outbid', (data) => {
    showToast(data.message, 'outbid');
    playSound('outbid');
  });

  // 6. Bid Rejection
  socket.on('bid:rejected', (data) => {
    showToast(data.reason, 'outbid');
  });

  // 7. Anti-Snipe Extension
  socket.on('auction:extended', (data) => {
    showToast(data.message, 'snipe');
    updateCountdown(data.timeRemaining);
  });

  // 8. Auction Sold / Ended
  socket.on('auction:sold', (data) => {
    if (data.auctionId === currentAuctionId) {
      isAuctionActive = false;
      showSoldState(data.winner, data.finalPrice);
      showToast(data.message, 'snipe');
    }
  });
}

function updateCountdown(seconds) {
  const timerDigits = document.getElementById('timer-digits');
  const timerCard = document.getElementById('timer-card');
  timerDigits.textContent = formatTime(seconds);

  if (seconds <= 15 && seconds > 0) {
    timerDigits.classList.add('timer-urgent');
    timerCard.style.borderColor = '#ef4444';
  } else {
    timerDigits.classList.remove('timer-urgent');
    timerCard.style.borderColor = 'rgba(255, 255, 255, 0.08)';
  }
}

function updateNextMinBid(minAmount) {
  document.getElementById('min-bid-display').textContent = `₹${formatINR(minAmount)}`;
  const input = document.getElementById('input-bid-amount');
  input.min = minAmount;
  input.value = minAmount;
  input.placeholder = minAmount;
}

function renderBidHistory(history) {
  const list = document.getElementById('history-list');
  const count = document.getElementById('history-count');
  count.textContent = `${history.length} Bids Placed`;

  if (!history || history.length === 0) {
    list.innerHTML = '<div class="history-empty">No bids submitted yet. Be the first to bid!</div>';
    return;
  }

  list.innerHTML = history.map(row => `
    <div class="history-row">
      <div class="bidder-meta">
        <span class="bidder-name">${row.bidder}</span>
        <span class="bidder-time">${row.timestamp}</span>
      </div>
      <div class="bidder-amount">₹${formatINR(row.amount)}</div>
    </div>
  `).join('');
}

function showSoldState(winner, price) {
  document.getElementById('lot-status-pill').textContent = '🔴 AUCTION CLOSED';
  document.getElementById('lot-status-pill').style.background = 'rgba(239, 68, 68, 0.9)';
  document.getElementById('sold-banner').classList.remove('hidden');
  document.getElementById('sold-winner-text').textContent = `Winning Bidder: ${winner || 'None'}`;
  document.getElementById('sold-price-text').textContent = `Final Hammer Price: ₹${formatINR(price)}`;
  document.getElementById('btn-submit-bid').disabled = true;
}
