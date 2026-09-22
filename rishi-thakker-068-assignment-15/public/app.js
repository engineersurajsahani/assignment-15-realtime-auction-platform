const socket = io();

const joinSection = document.getElementById("joinSection");
const floorSection = document.getElementById("floorSection");

const auctionIdInput = document.getElementById("auctionIdInput");
const usernameInput = document.getElementById("usernameInput");
const joinButton = document.getElementById("joinButton");
const joinError = document.getElementById("joinError");

const outbidAlert = document.getElementById("outbidAlert");
const soldBanner = document.getElementById("soldBanner");
const viewerCount = document.getElementById("viewerCount");
const timerDisplay = document.getElementById("timerDisplay");

const itemTitle = document.getElementById("itemTitle");
const itemDescription = document.getElementById("itemDescription");
const currentBidDisplay = document.getElementById("currentBidDisplay");
const minIncrementDisplay = document.getElementById("minIncrementDisplay");
const highestBidderDisplay = document.getElementById("highestBidderDisplay");

const bidAmountInput = document.getElementById("bidAmountInput");
const placeBidButton = document.getElementById("placeBidButton");
const bidError = document.getElementById("bidError");

const bidHistoryList = document.getElementById("bidHistoryList");

let auctionId = null;
let minIncrement = 0;

function renderBidHistory(history) {
  bidHistoryList.innerHTML = "";
  history.forEach((entry) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${entry.bidder} — ₹${entry.amount}</span><span class="time">${entry.timestamp}</span>`;
    bidHistoryList.appendChild(li);
  });
}

joinButton.addEventListener("click", () => {
  auctionId = auctionIdInput.value.trim();
  const username = usernameInput.value.trim();

  if (!auctionId || !username) {
    joinError.textContent = "Enter both an auction ID and your name.";
    return;
  }

  joinError.textContent = "";
  socket.emit("auction:join", { auctionId, username });
});

socket.on("auction:init", ({ item, bidHistory, timeRemaining }) => {
  joinSection.classList.add("hidden");
  floorSection.classList.remove("hidden");

  minIncrement = item.minIncrement;

  itemTitle.textContent = item.title;
  itemDescription.textContent = item.description;
  currentBidDisplay.textContent = `₹${item.currentBid}`;
  minIncrementDisplay.textContent = `₹${item.minIncrement}`;
  highestBidderDisplay.textContent = item.highestBidder
    ? `Highest bidder: ${item.highestBidder}`
    : "No bids yet";
  timerDisplay.textContent = `${timeRemaining}s`;

  renderBidHistory(bidHistory);

  if (item.status === "ended") {
    disableBidding();
  }
});

socket.on("user:joined", ({ totalViewers }) => {
  viewerCount.textContent = `${totalViewers} watching`;
});

socket.on("auction:time_tick", ({ timeRemaining }) => {
  timerDisplay.textContent = `${timeRemaining}s`;
});

socket.on("bid:success", ({ newBid, highestBidder, bidHistory, timeRemaining }) => {
  bidError.textContent = "";
  currentBidDisplay.textContent = `₹${newBid}`;
  highestBidderDisplay.textContent = `Highest bidder: ${highestBidder}`;
  timerDisplay.textContent = `${timeRemaining}s`;
  renderBidHistory(bidHistory);
  bidAmountInput.value = "";
});

socket.on("bid:rejected", ({ reason }) => {
  bidError.textContent = reason;
});

socket.on("bid:outbid", ({ message }) => {
  outbidAlert.textContent = message;
  outbidAlert.classList.remove("hidden");
});

socket.on("auction:extended", ({ timeRemaining, message }) => {
  timerDisplay.textContent = `${timeRemaining}s`;
  outbidAlert.textContent = message;
  outbidAlert.classList.remove("hidden");
});

socket.on("auction:sold", ({ winner, finalPrice }) => {
  soldBanner.textContent = winner
    ? `SOLD to ${winner} for ₹${finalPrice}!`
    : "Auction ended with no bids.";
  soldBanner.classList.remove("hidden");
  disableBidding();
});

function disableBidding() {
  bidAmountInput.disabled = true;
  placeBidButton.disabled = true;
}

placeBidButton.addEventListener("click", () => {
  const amount = Number(bidAmountInput.value);

  if (!amount || amount <= 0) {
    bidError.textContent = "Enter a valid bid amount.";
    return;
  }

  bidError.textContent = "";
  socket.emit("bid:place", { auctionId, amount });
});
