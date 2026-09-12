const socket = io();

const joinPanel = document.getElementById("joinPanel");
const auctionPanel = document.getElementById("auctionPanel");
const usernameInput = document.getElementById("username");
const joinBtn = document.getElementById("joinBtn");
const joinError = document.getElementById("joinError");

const currentBid = document.getElementById("currentBid");
const highestBidder = document.getElementById("highestBidder");
const timer = document.getElementById("timer");
const timerMessage = document.getElementById("timerMessage");
const viewers = document.getElementById("viewers");
const bidAmount = document.getElementById("bidAmount");
const bidBtn = document.getElementById("bidBtn");
const bidError = document.getElementById("bidError");
const alertBox = document.getElementById("alert");
const history = document.getElementById("history");
const status = document.getElementById("status");

const auctionId = "AUC_VINTAGE_99";
let joined = false;

function formatMoney(amount) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function renderHistory(items) {
  history.innerHTML = "";

  if (!items.length) {
    history.innerHTML = "<p class='empty'>No bids yet.</p>";
    return;
  }

  items.forEach((bid) => {
    const row = document.createElement("div");
    row.className = "history-row";

    row.innerHTML = `
      <div>
        <strong>${bid.bidder}</strong>
        <small>${bid.timestamp}</small>
      </div>
      <strong>${formatMoney(bid.amount)}</strong>
    `;

    history.appendChild(row);
  });
}

function showAlert(message, type = "normal") {
  alertBox.textContent = message;
  alertBox.className = `alert ${type}`;

  setTimeout(() => {
    alertBox.classList.add("hidden");
  }, 4000);
}

function updateBidControls() {
  const current = Number(
    currentBid.textContent.replace(/[₹,]/g, "")
  );

  bidAmount.min = current + 2000;
  bidAmount.placeholder = String(current + 2000);
}

joinBtn.addEventListener("click", () => {
  const username = usernameInput.value.trim();

  if (!username) {
    joinError.textContent = "Enter a username";
    return;
  }

  socket.emit("auction:join", {
    auctionId,
    username
  });
});

bidBtn.addEventListener("click", () => {
  bidError.textContent = "";

  const amount = Number(bidAmount.value);

  socket.emit("bid:place", {
    auctionId,
    amount
  });
});

bidAmount.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    bidBtn.click();
  }
});

socket.on("auction:init", (data) => {
  joined = true;

  joinPanel.classList.add("hidden");
  auctionPanel.classList.remove("hidden");

  currentBid.textContent = formatMoney(data.item.currentBid);
  highestBidder.textContent = data.item.highestBidder || "No bids yet";
  timer.textContent = formatTime(data.timeRemaining);
  viewers.textContent = data.item.totalViewers;
  status.textContent = data.item.status.toUpperCase();

  renderHistory(data.bidHistory);
  updateBidControls();
});

socket.on("user:joined", (data) => {
  viewers.textContent = data.totalViewers;
});

socket.on("auction:time_tick", (data) => {
  timer.textContent = formatTime(data.timeRemaining);

  if (data.timeRemaining <= 10 && data.timeRemaining > 0) {
    timerMessage.textContent = "Closing soon";
  }
});

socket.on("bid:success", (data) => {
  currentBid.textContent = formatMoney(data.currentBid);
  highestBidder.textContent = data.highestBidder;
  timer.textContent = formatTime(data.timeRemaining);
  status.textContent = "ACTIVE";

  renderHistory(data.bidHistory);
  updateBidControls();

  bidAmount.value = "";
  showAlert(`${data.highestBidder} placed ${formatMoney(data.currentBid)}`, "success");
});

socket.on("bid:outbid", (data) => {
  showAlert(data.message, "outbid");
});

socket.on("bid:rejected", (data) => {
  bidError.textContent = data.reason;
  showAlert(data.reason, "error");
});

socket.on("auction:extended", (data) => {
  timer.textContent = formatTime(data.timeRemaining);
  timerMessage.textContent = "Anti-snipe protection activated";
  showAlert(data.message, "extended");
});

socket.on("auction:sold", (data) => {
  status.textContent = "SOLD";
  timer.textContent = "00:00";
  timerMessage.textContent = data.winner
    ? `Won by ${data.winner}`
    : "No winning bidder";

  bidBtn.disabled = true;
  bidAmount.disabled = true;

  showAlert(
    data.winner
      ? `Auction sold to ${data.winner} for ${formatMoney(data.finalPrice)}`
      : "Auction ended with no winner",
    "sold"
  );
});