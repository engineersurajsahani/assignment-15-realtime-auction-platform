const $ = (id) => document.getElementById(id);

const socket = io();

let auction = null; // current auction meta from auction:init
let username = null;
let currentAuctionId = null;
let walletBalance = 0;
let minIncrement = 0;

const formatter = new Intl.NumberFormat("en-IN");
const inr = (n) => `₹${formatter.format(Number(n) || 0)}`;

const state = {
  statusEl: $("conn-status"),
  entrance: $("entrance"),
  auctionView: $("auction-view"),
  auctionSelect: $("auction-select"),
  usernameInput: $("username-input"),
  joinBtn: $("join-btn"),
  lotImage: $("lot-image"),
  lotTitle: $("lot-title"),
  lotDesc: $("lot-desc"),
  lotId: $("lot-id"),
  currentBid: $("current-bid"),
  minInc: $("min-inc"),
  leader: $("leading-bidder"),
  timer: $("timer"),
  timerBox: $("timer-box"),
  wallet: $("wallet-balance"),
  bidAmount: $("bid-amount"),
  bidBtn: $("bid-btn"),
  bidControls: $("bid-controls"),
  bidClosed: $("bid-closed"),
  history: $("bid-history"),
  viewers: $("viewer-count"),
  toastStack: $("toast-stack"),
  soldModal: $("sold-modal"),
  soldTitle: $("sold-title"),
  soldMessage: $("sold-message"),
};

function playTone(freqs, duration = 0.09, type = "square", gain = 0.06) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      const t = ctx.currentTime + i * (duration + 0.04);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    });
  } catch (_) {}
}

function toast(message, kind = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  state.toastStack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 250);
  }, 4200);
}

async function loadAuctions() {
  const res = await fetch("/api/auctions");
  const data = await res.json();
  state.auctionSelect.innerHTML = "";
  data.auctions.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${a.title} · starting ${inr(a.startingPrice)}`;
    opt.dataset.status = a.status;
    state.auctionSelect.appendChild(opt);
  });
  return data.auctions;
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function renderHistory(history) {
  state.history.innerHTML = "";
  if (!history || history.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-history";
    li.textContent = "No bids yet — be the first!";
    state.history.appendChild(li);
    return;
  }
  history.forEach((entry) => {
    const li = document.createElement("li");
    if (entry.bidder === username) li.classList.add("mine");
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = entry.bidder;
    const amount = document.createElement("span");
    amount.className = "amount";
    amount.textContent = inr(entry.amount);
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = entry.timestamp || "";
    li.append(who, amount, when);
    state.history.appendChild(li);
  });
}

function renderState({ item, bidHistory, timeRemaining, walletBalance: wallet }) {
  minIncrement = item.minIncrement;
  walletBalance = wallet;

  state.lotImage.src = item.image || "";
  state.lotTitle.textContent = item.title;
  state.lotDesc.textContent = item.description;
  state.lotId.textContent = item.id;
  state.currentBid.textContent = inr(item.currentBid);
  state.minInc.textContent = inr(minIncrement);
  state.leader.textContent = item.highestBidder || "Nobody yet";
  state.wallet.textContent = inr(wallet);

  const remaining = Math.max(0, timeRemaining);
  state.timer.textContent = formatTime(remaining);
  state.timerBox.classList.toggle("snipe", remaining <= 10 && item.status === "active");

  const isOpen = item.status === "active";
  state.bidControls.classList.toggle("hidden", !isOpen);
  state.bidClosed.hidden = isOpen;

  refreshBidAmount();
  renderHistory(bidHistory);
}

function refreshBidAmount() {
  const current = parseInt(state.currentBid.textContent.replace(/[^0-9]/g, ""), 10) || 0;
  const next = current + minIncrement;
  state.bidAmount.placeholder = `Min bid ${inr(next)}`;
  state.bidAmount.min = next;
}

function enterFloor(data) {
  state.entrance.classList.add("hidden");
  state.auctionView.classList.remove("hidden");
  renderState(data);
}

function backToLobby() {
  currentAuctionId = null;
  state.auctionView.classList.add("hidden");
  state.entrance.classList.remove("hidden");
  loadAuctions();
}

async function join() {
  username = state.usernameInput.value.trim();
  const auctionId = state.auctionSelect.value;
  if (!username) {
    toast("Enter your name to join the floor", "danger");
    state.usernameInput.focus();
    return;
  }
  currentAuctionId = auctionId;
  state.joinBtn.disabled = true;
  state.joinBtn.textContent = "Joining floor…";
  socket.emit("auction:join", { auctionId, username });
}

function placeBid() {
  const raw = state.bidAmount.value;
  const amount = Number(raw);
  if (!currentAuctionId || !amount || amount <= 0) {
    toast("Enter a valid bid amount", "danger");
    return;
  }
  socket.emit("bid:place", { auctionId: currentAuctionId, amount });
}

function setQuick(mult) {
  const current = parseInt(state.currentBid.textContent.replace(/[^0-9]/g, ""), 10) || 0;
  const next = current + minIncrement * mult;
  state.bidAmount.value = next;
}

/* ---------- Socket wiring ---------- */

socket.on("connect", () => {
  state.statusEl.classList.add("connected");
  state.statusEl.innerHTML = '<span class="pulse"></span> Connected';
  loadAuctions();
});

socket.on("disconnect", () => {
  state.statusEl.classList.remove("connected");
  state.statusEl.innerHTML = '<span class="pulse"></span> Reconnecting';
});

socket.on("auction:error", ({ message }) => {
  state.joinBtn.disabled = false;
  state.joinBtn.textContent = "Enter Auction Room";
  toast(message, "danger");
});

socket.on("auction:init", (data) => {
  state.joinBtn.disabled = false;
  state.joinBtn.textContent = "Enter Auction Room";
  enterFloor(data);
});

socket.on("auction:time_tick", ({ timeRemaining }) => {
  if (!state.auctionView.classList.contains("hidden")) {
    state.timer.textContent = formatTime(timeRemaining);
    state.timerBox.classList.toggle(
      "snipe",
      timeRemaining <= 10 && !state.bidControls.classList.contains("hidden")
    );
  }
});

socket.on("user:joined", ({ totalViewers }) => {
  state.viewers.textContent = totalViewers;
});

socket.on("bid:success", ({ newBid, highestBidder, bidHistory, timeRemaining, minIncrement: inc }) => {
  state.currentBid.textContent = inr(newBid);
  state.leader.textContent = highestBidder;
  state.timer.textContent = formatTime(timeRemaining);
  if (inc) minIncrement = inc;
  state.minInc.textContent = inr(minIncrement);
  renderHistory(bidHistory);
  refreshBidAmount();
  playTone([880], 0.08);

  if (highestBidder === username) {
    toast(`You are now the highest bidder at ${inr(newBid)}`, "ok");
  }
});

socket.on("bid:placed", ({ walletBalance: bal }) => {
  walletBalance = bal;
  state.wallet.textContent = inr(bal);
  state.bidAmount.value = "";
});

socket.on("bid:outbid", ({ message }) => {
  toast(message, "danger");
  playTone([440, 330], 0.15, "sawtooth", 0.05);
});

socket.on("bid:rejected", ({ reason }) => {
  toast(reason, "danger");
});

socket.on("auction:extended", ({ timeRemaining, message }) => {
  state.timer.textContent = formatTime(timeRemaining);
  toast(message || "Anti-snipe triggered!", "warn");
  playTone([520, 660], 0.1, "triangle", 0.05);
});

socket.on("auction:sold", ({ winner, finalPrice, title }) => {
  state.bidControls.classList.add("hidden");
  state.bidClosed.hidden = false;
  state.currentBid.textContent = inr(finalPrice);
  state.leader.textContent = winner || "No bids";

  state.soldTitle.textContent = winner ? "Sold!" : "No winning bid";
  state.soldMessage.textContent = winner
    ? `${winner} won "${title}" for ${inr(finalPrice)}`
    : `"${title}" closed with no winning bid.`;
  state.soldModal.classList.remove("hidden");
  playTone([660, 880, 1100], 0.12, "square", 0.05);
});

/* ---------- Event listeners ---------- */

state.joinBtn.addEventListener("click", join);
state.usernameInput.addEventListener("keydown", (e) => e.key === "Enter" && join());
state.bidBtn.addEventListener("click", placeBid);
state.bidAmount.addEventListener("keydown", (e) => e.key === "Enter" && placeBid());
$("qp1").addEventListener("click", () => setQuick(1));
$("qp2").addEventListener("click", () => setQuick(2));
$("qp5").addEventListener("click", () => setQuick(5));
$("leave-btn").addEventListener("click", backToLobby);
$("leave-btn-2").addEventListener("click", backToLobby);
$("sold-close").addEventListener("click", () => {
  state.soldModal.classList.add("hidden");
  backToLobby();
});