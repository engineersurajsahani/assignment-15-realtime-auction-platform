const socket = io();
const auctionId = "AUC_VINTAGE_99";
let username = "";
let currentBid = 50000;

const $ = id => document.getElementById(id);
const money = n => "₹" + Number(n).toLocaleString("en-IN");
const timerText = s => `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;

$("joinBtn").onclick = join;
$("username").addEventListener("keydown", e => { if (e.key === "Enter") join(); });
function join() {
  username = $("username").value.trim() || "Guest";
  $("joinModal").classList.add("hidden");
  socket.emit("auction:join", { auctionId, username });
}

$("bidBtn").onclick = placeBid;
$("bidAmount").addEventListener("keydown", e => { if (e.key === "Enter") placeBid(); });
document.querySelectorAll(".quick-bids").forEach(box => box.addEventListener("click", e => {
  const btn = e.target.closest("button"); if (!btn) return;
  $("bidAmount").value = currentBid + Number(btn.dataset.add);
}));

function placeBid() {
  const amount = Number($("bidAmount").value);
  socket.emit("bid:place", { auctionId, amount });
}

function renderHistory(items) {
  $("history").innerHTML = items.length ? items.map((b, i) => `
    <div class="bid-row ${i === 0 ? "top" : ""}">
      <div class="avatar">${b.bidder.charAt(0).toUpperCase()}</div>
      <div class="bid-info"><strong>${escapeHtml(b.bidder)}</strong><small>${b.timestamp}</small></div>
      <strong class="bid-value">${money(b.amount)}</strong>
    </div>`).join("") : `<div class="empty">No bids yet.<br>Be the first to make a move.</div>`;
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

socket.on("auction:init", data => {
  const a = data.item; currentBid = a.currentBid;
  updateBid(a.currentBid, a.highestBidder?.username || "No bids yet");
  tick(data.timeRemaining); renderHistory(data.bidHistory);
});
socket.on("auction:time_tick", d => tick(d.timeRemaining));
socket.on("user:joined", d => $("viewerCount").textContent = d.totalViewers);
socket.on("bid:success", d => {
  currentBid = d.currentBid; updateBid(d.currentBid, d.highestBidder);
  renderHistory(d.bidHistory); $("bidAmount").value = "";
});
socket.on("bid:rejected", d => showToast(d.reason, "error"));
socket.on("bid:outbid", d => showToast(d.message, "error"));
socket.on("auction:extended", d => { tick(d.timeRemaining); showToast("⚡ " + d.message, "success"); });
socket.on("auction:sold", d => {
  tick(0); $("timerStatus").innerHTML = "● Auction ended";
  showToast(d.winner ? `Sold to ${d.winner} for ${money(d.finalPrice)}` : "Auction ended", "success");
  $("bidBtn").disabled = true;
});

function updateBid(bid, leader) {
  $("currentBid").textContent = money(bid);
  $("leader").textContent = leader;
  $("minBid").textContent = "Minimum valid bid: " + money(bid + 2000);
  $("bidAmount").min = bid + 2000;
}
function tick(s) {
  $("timer").textContent = timerText(Math.max(0, s));
  $("timer").classList.toggle("urgent", s <= 15 && s > 0);
  if (s <= 0) $("timerStatus").innerHTML = "● Auction ended";
}
let toastTimer;
function showToast(msg, type) {
  clearTimeout(toastTimer); $("toast").textContent = msg; $("toast").className = `toast show ${type}`;
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3500);
}