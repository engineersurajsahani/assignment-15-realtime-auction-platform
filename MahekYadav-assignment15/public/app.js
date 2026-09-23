const socket = io();

const auctionId = "AUC_VINTAGE_99";

let joined = false;
let currentBid = 50000;
let minIncrement = 2000;

const connectionStatus = document.getElementById("connectionStatus");
const itemTitle = document.getElementById("itemTitle");
const itemDescription = document.getElementById("itemDescription");
const currentBidEl = document.getElementById("currentBid");
const highestBidderEl = document.getElementById("highestBidder");
const viewerCountEl = document.getElementById("viewerCount");
const timerEl = document.getElementById("timer");
const minimumBidEl = document.getElementById("minimumBid");
const bidHistoryEl = document.getElementById("bidHistory");
const activityCountEl = document.getElementById("activityCount");
const joinForm = document.getElementById("joinForm");
const usernameInput = document.getElementById("username");
const bidSection = document.getElementById("bidSection");
const bidAmountInput = document.getElementById("bidAmount");
const bidButton = document.getElementById("bidButton");
const messageEl = document.getElementById("message");
const alertEl = document.getElementById("alert");

socket.on("connect", () => {
  connectionStatus.textContent = "Connected";
  connectionStatus.className = "status online";
});

socket.on("disconnect", () => {
  connectionStatus.textContent = "Disconnected";
  connectionStatus.className = "status offline";
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();

  if (!username) return;

  socket.emit("auction:join", {
    auctionId,
    username
  });
});

bidButton.addEventListener("click", () => {
  const amount = Number(bidAmountInput.value);

  socket.emit("bid:place", {
    auctionId,
    amount
  });

  bidAmountInput.value = "";
});

socket.on("auction:init", (data) => {
  joined = true;

  itemTitle.textContent = data.item.title;
  itemDescription.textContent = data.item.description;

  currentBid = data.item.currentBid;
  minIncrement = data.item.minIncrement;

  updateBidDisplay();
  updateTimer(data.timeRemaining);
  renderHistory(data.bidHistory);

  viewerCountEl.textContent = data.totalViewers;

  joinForm.classList.add("hidden");
  bidSection.classList.remove("hidden");

  showMessage(`Welcome ${usernameInput.value.trim()}! You can now bid.`);
});

socket.on("user:joined", (data) => {
  viewerCountEl.textContent = data.totalViewers;
});

socket.on("user:left", (data) => {
  viewerCountEl.textContent = data.totalViewers;
});

socket.on("auction:time_tick", (data) => {
  updateTimer(data.timeRemaining);
});

socket.on("bid:success", (data) => {
  currentBid = data.currentBid;
  highestBidderEl.textContent = data.highestBidder;

  updateBidDisplay();
  updateTimer(data.timeRemaining);
  renderHistory(data.bidHistory);

  showMessage(`${data.highestBidder} placed ₹${formatMoney(data.currentBid)}`);
});

socket.on("bid:outbid", (data) => {
  showAlert(data.message);
  showMessage(data.message);
});

socket.on("bid:rejected", (data) => {
  showMessage(data.reason, true);
});

socket.on("auction:extended", (data) => {
  updateTimer(data.timeRemaining);
  showAlert(data.message);
});

socket.on("auction:sold", (data) => {
  updateTimer(0);

  if (data.status === "sold") {
    showAlert(
      `Auction sold to ${data.winner} for ₹${formatMoney(data.finalPrice)}`
    );
    showMessage(
      `Auction ended. Winner: ${data.winner} — ₹${formatMoney(
        data.finalPrice
      )}`
    );
  } else {
    showAlert("Auction ended without a winning bid.");
    showMessage("Auction ended without a winning bid.", true);
  }

  bidButton.disabled = true;
  bidAmountInput.disabled = true;
});

function updateBidDisplay() {
  currentBidEl.textContent = `₹${formatMoney(currentBid)}`;

  const minimum = currentBid + minIncrement;
  minimumBidEl.textContent = `₹${formatMoney(minimum)}`;
  bidAmountInput.min = minimum;
  bidAmountInput.placeholder = `Min ₹${formatMoney(minimum)}`;

  highestBidderEl.textContent =
    highestBidderEl.textContent || "—";
}

function updateTimer(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  timerEl.textContent =
    `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;

  if (seconds <= 15 && seconds > 0) {
    timerEl.classList.add("danger");
  } else {
    timerEl.classList.remove("danger");
  }
}

function renderHistory(history) {
  activityCountEl.textContent = `${history.length} ${
    history.length === 1 ? "bid" : "bids"
  }`;

  if (!history.length) {
    bidHistoryEl.innerHTML = '<p class="empty">No bids yet.</p>';
    return;
  }

  bidHistoryEl.innerHTML = history
    .map(
      (bid) => `
        <div class="history-item">
          <div>
            <strong>${escapeHtml(bid.bidder)}</strong>
            <span>${escapeHtml(bid.timestamp)}</span>
          </div>
          <strong>₹${formatMoney(bid.amount)}</strong>
        </div>
      `
    )
    .join("");
}

function showMessage(message, error = false) {
  messageEl.textContent = message;
  messageEl.className = error ? "message error" : "message";
}

function showAlert(message) {
  alertEl.textContent = message;
  alertEl.classList.remove("hidden");

  setTimeout(() => {
    alertEl.classList.add("hidden");
  }, 4000);
}

function formatMoney(amount) {
  return Number(amount).toLocaleString("en-IN");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}