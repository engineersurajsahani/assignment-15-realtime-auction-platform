const socket = io();

const state = {
  auctionId: "AUC_VINTAGE_99",
  username: "",
  totalSeconds: 60,
  timeRemaining: 60,
  currentBid: 50000,
  minIncrement: 2000,
  status: "active",
  highestBidder: null,
  joined: false
};

const $ = (id) => document.getElementById(id);

const els = {
  viewerCount: $("viewerCount"),
  auctionId: $("auctionId"),
  itemTitle: $("itemTitle"),
  itemDescription: $("itemDescription"),
  startingPrice: $("startingPrice"),
  minIncrement: $("minIncrement"),
  currentBid: $("currentBid"),
  statusChip: $("statusChip"),
  countdown: $("countdown"),
  timerState: $("timerState"),
  progressBar: $("progressBar"),
  leaderAvatar: $("leaderAvatar"),
  highestBidder: $("highestBidder"),
  bidAmount: $("bidAmount"),
  placeBidBtn: $("placeBidBtn"),
  bidHistory: $("bidHistory"),
  username: $("username"),
  joinBtn: $("joinBtn"),
  joinPanel: $("joinPanel"),
  connectionText: $("connectionText"),
  toastContainer: $("toastContainer"),
  resultModal: $("resultModal"),
  resultIcon: $("resultIcon"),
  resultEyebrow: $("resultEyebrow"),
  resultTitle: $("resultTitle"),
  resultMessage: $("resultMessage"),
  closeResult: $("closeResult")
};

function money(value) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function initials(name) {
  return name ? name.trim().slice(0, 2).toUpperCase() : "—";
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function setConnection(text, connected = false) {
  els.connectionText.innerHTML = `<i></i> ${text}`;
  els.connectionText.classList.toggle("connected", connected);
}

function toast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  els.toastContainer.appendChild(node);

  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateX(18px)";
    node.style.transition = "all .25s ease";
    setTimeout(() => node.remove(), 260);
  }, 3600);
}

function updateTimer(seconds) {
  state.timeRemaining = Math.max(0, Number(seconds) || 0);
  els.countdown.textContent = formatTime(state.timeRemaining);

  const percent = state.totalSeconds
    ? Math.max(0, Math.min(100, (state.timeRemaining / state.totalSeconds) * 100))
    : 0;

  els.progressBar.style.width = `${percent}%`;

  if (state.timeRemaining <= 10 && state.timeRemaining > 0) {
    els.countdown.style.color = "var(--danger)";
    els.timerState.textContent = "Closing soon";
  } else {
    els.countdown.style.color = "";
    els.timerState.textContent = state.status === "active" ? "Accepting bids" : "Auction closed";
  }
}

function updateLeader(name) {
  state.highestBidder = name || null;
  els.highestBidder.textContent = name || "No bids yet";
  els.leaderAvatar.textContent = initials(name);
}

function renderHistory(history = []) {
  if (!history.length) {
    els.bidHistory.innerHTML = `
      <div class="empty-state">
        <span>◌</span>
        <p>Waiting for the first bid…</p>
      </div>`;
    return;
  }

  els.bidHistory.innerHTML = history.slice(0, 20).map((bid, index) => `
    <div class="bid-row">
      <div class="bid-mini-avatar">${initials(bid.bidder)}</div>
      <div class="bid-row-main">
        <strong>${escapeHtml(bid.bidder)}</strong>
        <span>${index === 0 ? "Leading bid" : relativeTime(bid.timestamp)}</span>
      </div>
      <div class="bid-row-price">
        <strong>${money(bid.amount)}</strong>
        ${index === 0 ? "<span>TOP BID</span>" : ""}
      </div>
    </div>
  `).join("");
}

function relativeTime(timestamp) {
  const time = new Date(timestamp);
  if (Number.isNaN(time.getTime())) return "Recent bid";

  const seconds = Math.max(0, Math.floor((Date.now() - time.getTime()) / 1000));
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateBidControls() {
  const minimum = state.currentBid + state.minIncrement;
  els.bidAmount.min = minimum;
  els.bidAmount.placeholder = minimum.toLocaleString("en-IN");
  els.placeBidBtn.disabled = !state.joined || state.status !== "active";
}

function applyAuction(data) {
  const item = data.item || {};

  state.auctionId = item.id || state.auctionId;
  state.currentBid = Number(item.currentBid) || state.currentBid;
  state.minIncrement = Number(item.minIncrement) || state.minIncrement;
  state.status = item.status || state.status;
  state.totalSeconds = Math.max(state.totalSeconds, Number(data.timeRemaining) || 60);

  els.auctionId.textContent = state.auctionId;
  els.itemTitle.textContent = item.title || els.itemTitle.textContent;
  els.itemDescription.textContent = item.description || els.itemDescription.textContent;
  els.startingPrice.textContent = money(item.startingPrice || 50000);
  els.minIncrement.textContent = money(state.minIncrement);
  els.currentBid.textContent = money(state.currentBid);

  updateLeader(data.highestBidder?.username || null);
  renderHistory(data.bidHistory || []);
  updateTimer(data.timeRemaining ?? state.timeRemaining);
  updateStatus(state.status);
  updateBidControls();
}

function updateStatus(status) {
  state.status = status;
  const isActive = status === "active";

  els.statusChip.innerHTML = isActive
    ? "<span></span> LIVE"
    : "<span></span> CLOSED";

  els.statusChip.style.color = isActive ? "var(--accent)" : "var(--danger)";
  els.statusChip.style.background = isActive
    ? "rgba(200,243,107,.08)"
    : "rgba(255,107,107,.08)";

  els.statusChip.style.borderColor = isActive
    ? "rgba(200,243,107,.18)"
    : "rgba(255,107,107,.18)";

  updateBidControls();
}

function joinAuction() {
  const username = els.username.value.trim();

  if (!username) {
    toast("Please enter a display name first.", "danger");
    els.username.focus();
    return;
  }

  state.username = username;
  socket.emit("auction:join", {
    auctionId: state.auctionId,
    username
  });
}

function placeBid() {
  if (!state.joined) {
    toast("Join the auction before placing a bid.", "danger");
    return;
  }

  const amount = Number(els.bidAmount.value);
  const minimum = state.currentBid + state.minIncrement;

  if (!Number.isFinite(amount) || amount < minimum) {
    toast(`Minimum valid bid is ${money(minimum)}.`, "danger");
    els.bidAmount.focus();
    return;
  }

  socket.emit("bid:place", {
    auctionId: state.auctionId,
    amount
  });

  els.placeBidBtn.disabled = true;
}

document.querySelectorAll(".quick-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const base = state.currentBid + state.minIncrement;
    const step = Number(button.dataset.step) || 0;
    els.bidAmount.value = base + step;
    els.bidAmount.focus();
  });
});

els.joinBtn.addEventListener("click", joinAuction);
els.placeBidBtn.addEventListener("click", placeBid);

els.username.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinAuction();
});

els.bidAmount.addEventListener("keydown", (event) => {
  if (event.key === "Enter") placeBid();
});

els.closeResult.addEventListener("click", () => {
  els.resultModal.classList.add("hidden");
});

socket.on("connect", () => {
  setConnection("Connected to auction server", true);
});

socket.on("disconnect", () => {
  setConnection("Connection lost — trying to reconnect…", false);
});

socket.on("auction:init", (data) => {
  state.joined = true;
  els.joinPanel.querySelector(".join-copy").textContent =
    `You are participating as ${state.username}.`;
  els.joinBtn.textContent = "JOINED ✓";
  els.joinBtn.disabled = true;
  els.username.disabled = true;

  applyAuction(data);
  toast(`Welcome to the floor, ${state.username}.`, "success");
});

socket.on("user:joined", ({ totalViewers }) => {
  els.viewerCount.textContent = `${totalViewers} watching`;
});

socket.on("viewer:update", ({ totalViewers }) => {
  els.viewerCount.textContent = `${totalViewers} watching`;
});

socket.on("auction:time_tick", ({ timeRemaining }) => {
  updateTimer(timeRemaining);

  if (timeRemaining === 10) {
    toast("Only 10 seconds left — place your bid!", "warning");
  }
});

socket.on("bid:success", (data) => {
  state.currentBid = Number(data.currentBid);
  els.currentBid.textContent = money(state.currentBid);
  updateLeader(data.highestBidder);
  renderHistory(data.bidHistory);
  updateTimer(data.timeRemaining);
  updateBidControls();

  if (data.highestBidder === state.username) {
    toast(`You're leading at ${money(state.currentBid)}.`, "success");
  } else {
    toast(`${data.highestBidder} is now leading at ${money(state.currentBid)}.`, "success");
  }
});

socket.on("bid:outbid", ({ message }) => {
  toast(`OUTBID — ${message}`, "danger");
});

socket.on("bid:rejected", ({ reason }) => {
  toast(reason, "danger");
  updateBidControls();
});

socket.on("auction:extended", ({ timeRemaining, message }) => {
  updateTimer(timeRemaining);
  toast(message, "warning");
});

socket.on("auction:sold", ({ winner, finalPrice, status }) => {
  state.status = "ended";
  updateStatus("ended");
  updateTimer(0);

  const won = winner && winner === state.username;

  els.resultIcon.textContent = won ? "♛" : status === "sold" ? "✓" : "—";
  els.resultEyebrow.textContent = status === "sold" ? "AUCTION COMPLETE" : "AUCTION CLOSED";
  els.resultTitle.textContent = status === "sold" ? (won ? "You won the lot!" : "Sold!") : "No sale";
  els.resultMessage.textContent = status === "sold"
    ? `${winner} won the 1967 Vintage Fender Stratocaster for ${money(finalPrice)}.`
    : "The auction ended without a successful bid.";

  els.resultModal.classList.remove("hidden");

  if (won) {
    toast("Congratulations — you won the auction!", "success");
  }
});

socket.on("auction:error", ({ message }) => {
  toast(message, "danger");
});

updateTimer(state.timeRemaining);
updateBidControls();
