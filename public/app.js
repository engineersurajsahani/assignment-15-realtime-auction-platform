const socket = io();

const AUCTION_ID = "AUC_VINTAGE_99";

let username = "";
let currentBid = 50000;
let minIncrement = 2000;


// Elements
const joinSection = document.getElementById("joinSection");
const auctionSection = document.getElementById("auctionSection");

const usernameInput = document.getElementById("username");
const joinBtn = document.getElementById("joinBtn");
const joinMessage = document.getElementById("joinMessage");

const itemTitle = document.getElementById("itemTitle");
const itemDescription = document.getElementById("itemDescription");

const timer = document.getElementById("timer");
const currentBidElement = document.getElementById("currentBid");
const highestBidderElement = document.getElementById("highestBidder");
const minimumBidElement = document.getElementById("minimumBid");

const bidAmountInput = document.getElementById("bidAmount");
const bidBtn = document.getElementById("bidBtn");
const bidMessage = document.getElementById("bidMessage");

const viewerCount = document.getElementById("viewerCount");
const bidHistory = document.getElementById("bidHistory");

const notification = document.getElementById("notification");


// Format money
function formatMoney(amount) {
  return Number(amount).toLocaleString("en-IN");
}


// Show notification
function showNotification(message) {
  notification.textContent = message;
  notification.classList.remove("hidden");

  setTimeout(() => {
    notification.classList.add("hidden");
  }, 4000);
}


// Join auction
joinBtn.addEventListener("click", () => {
  const enteredUsername = usernameInput.value.trim();

  if (!enteredUsername) {
    joinMessage.textContent = "Please enter a username.";
    return;
  }

  username = enteredUsername;

  socket.emit("auction:join", {
    auctionId: AUCTION_ID,
    username
  });

  joinMessage.textContent = "Joining auction...";
});


// Receive auction information
socket.on("auction:init", (data) => {
  const item = data.item;

  currentBid = item.currentBid;
  minIncrement = item.minIncrement;

  itemTitle.textContent = item.title;
  itemDescription.textContent = item.description;

  currentBidElement.textContent = formatMoney(currentBid);

  highestBidderElement.textContent =
    item.highestBidder?.username || "No bids yet";

  updateMinimumBid();

  timer.textContent = data.timeRemaining;

  renderBidHistory(data.bidHistory);

  joinSection.classList.add("hidden");
  auctionSection.classList.remove("hidden");
});


// Timer updates
socket.on("auction:time_tick", (data) => {
  timer.textContent = data.timeRemaining;

  if (data.timeRemaining <= 10) {
    timer.classList.add("danger");
  } else {
    timer.classList.remove("danger");
  }

  if (data.timeRemaining <= 0) {
    bidBtn.disabled = true;
    bidAmountInput.disabled = true;
  }
});


// Update current bid after successful bid
socket.on("bid:success", (data) => {
  currentBid = data.newBid;

  currentBidElement.textContent =
    formatMoney(data.newBid);

  highestBidderElement.textContent =
    data.highestBidder.username;

  updateMinimumBid();

  renderBidHistory(data.bidHistory);

  bidMessage.textContent =
    "Bid placed successfully!";

  bidAmountInput.value = "";
});


// Outbid notification
socket.on("bid:outbid", (data) => {
  showNotification(`⚠️ ${data.message}`);
});


// Bid rejected
socket.on("bid:rejected", (data) => {
  bidMessage.textContent = data.reason;
});


// Anti-snipe extension
socket.on("auction:extended", (data) => {
  showNotification(`⏱️ ${data.message}`);
});


// Auction sold
socket.on("auction:sold", (data) => {
  bidBtn.disabled = true;
  bidAmountInput.disabled = true;

  if (data.winner) {
    showNotification(
      `🔨 Auction sold to ${data.winner.username} for ₹${formatMoney(data.finalPrice)}`
    );
  } else {
    showNotification(
      "🔨 Auction ended with no bids."
    );
  }
});


// Viewer count
socket.on("user:joined", (data) => {
  viewerCount.textContent = data.totalViewers;
});


// Place bid
bidBtn.addEventListener("click", () => {
  const amount = Number(bidAmountInput.value);

  const minimumRequired =
    currentBid + minIncrement;

  if (!amount) {
    bidMessage.textContent =
      "Please enter a bid amount.";

    return;
  }

  if (amount < minimumRequired) {
    bidMessage.textContent =
      `Minimum bid is ₹${formatMoney(minimumRequired)}.`;

    return;
  }

  socket.emit("bid:place", {
    auctionId: AUCTION_ID,
    amount
  });
});


// Allow Enter key to place bid
bidAmountInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    bidBtn.click();
  }
});


// Update minimum bid
function updateMinimumBid() {
  const minimumRequired =
    currentBid + minIncrement;

  minimumBidElement.textContent =
    `₹${formatMoney(minimumRequired)}`;

  bidAmountInput.min = minimumRequired;
  bidAmountInput.placeholder =
    `Minimum ₹${formatMoney(minimumRequired)}`;
}


// Render bid history
function renderBidHistory(history) {
  if (!history || history.length === 0) {
    bidHistory.innerHTML =
      "<p>No bids yet.</p>";

    return;
  }

  bidHistory.innerHTML = history
    .map((bid) => {
      const date = new Date(bid.timestamp);

      return `
        <div class="bid-row">
          <div>
            <strong>${bid.bidder}</strong>
            <small>${date.toLocaleTimeString()}</small>
          </div>

          <strong>₹${formatMoney(bid.amount)}</strong>
        </div>
      `;
    })
    .join("");
}


// Socket connection status
socket.on("connect", () => {
  console.log("Connected to auction server:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Disconnected from auction server.");
});