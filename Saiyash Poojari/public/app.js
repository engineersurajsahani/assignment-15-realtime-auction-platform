document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const state = {
    username: "",
    wallet: 100000,
    currentAuctionId: "AUC_VINTAGE_99",
    currentAuction: null,
    timeRemaining: 60
  };

  const elements = {
    socketStatus: document.getElementById("socket-status"),
    auctionSelector: document.getElementById("auction-selector"),
    demoResetBtn: document.getElementById("demo-reset-btn"),
    displayUsername: document.getElementById("display-username"),
    displayWallet: document.getElementById("display-wallet"),
    
    itemCategory: document.getElementById("item-category"),
    itemStatusBadge: document.getElementById("item-status-badge"),
    antiSnipeBanner: document.getElementById("anti-snipe-banner"),
    viewersCount: document.getElementById("viewers-num"),
    itemTitle: document.getElementById("item-title"),
    itemDescription: document.getElementById("item-description"),
    startingPrice: document.getElementById("starting-price"),
    minIncrement: document.getElementById("min-increment"),
    currentBidAmount: document.getElementById("current-bid-amount"),
    highestBidderName: document.getElementById("highest-bidder-name"),
    timerBox: document.getElementById("timer-box"),
    timerSeconds: document.getElementById("timer-seconds"),

    yourBidStatus: document.getElementById("your-bid-status"),
    bidAlert: document.getElementById("bid-feedback-alert"),
    quickMinBtn: document.getElementById("quick-min-btn"),
    quick5kBtn: document.getElementById("quick-5k-btn"),
    quick10kBtn: document.getElementById("quick-10k-btn"),
    bidForm: document.getElementById("bid-form"),
    bidAmountInput: document.getElementById("bid-amount-input"),
    placeBidBtn: document.getElementById("place-bid-btn"),
    bidCountBadge: document.getElementById("bid-count-badge"),
    bidHistoryTbody: document.getElementById("bid-history-tbody"),

    outbidToast: document.getElementById("outbid-toast"),
    outbidToastMessage: document.getElementById("outbid-toast-message"),
    counterBidBtn: document.getElementById("counter-bid-btn"),
    closeOutbidToastBtn: document.getElementById("close-outbid-toast"),

    soldModal: document.getElementById("sold-modal"),
    soldWinnerName: document.getElementById("sold-winner-name"),
    soldFinalPrice: document.getElementById("sold-final-price"),
    soldMessage: document.getElementById("sold-message"),
    soldCloseBtn: document.getElementById("sold-close-btn"),
    soldResetBtn: document.getElementById("sold-reset-btn"),

    joinModal: document.getElementById("join-modal"),
    joinForm: document.getElementById("join-form"),
    usernameInput: document.getElementById("username-input"),
    walletInput: document.getElementById("wallet-input")
  };

  socket.on("connect", () => {
    elements.socketStatus.textContent = "Connected";
    elements.socketStatus.className = "status-badge connected";
    socket.emit("auction:list");
  });

  socket.on("disconnect", () => {
    elements.socketStatus.textContent = "Disconnected";
    elements.socketStatus.className = "status-badge disconnected";
  });

  socket.on("auction:catalog", (catalog) => {
    elements.auctionSelector.innerHTML = "";
    catalog.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = `${item.title} (₹${item.currentBid.toLocaleString('en-IN')})`;
      if (item.id === state.currentAuctionId) {
        opt.selected = true;
      }
      elements.auctionSelector.appendChild(opt);
    });
  });

  socket.on("auction:init", ({ item, bidHistory, timeRemaining, totalViewers }) => {
    state.currentAuction = item;
    state.currentAuctionId = item.id;
    state.timeRemaining = timeRemaining;

    elements.itemCategory.textContent = item.category || "General";
    elements.itemTitle.textContent = item.title;
    elements.itemDescription.textContent = item.description;
    elements.startingPrice.textContent = `₹${item.startingPrice.toLocaleString('en-IN')}`;
    elements.minIncrement.textContent = `+₹${item.minIncrement.toLocaleString('en-IN')}`;
    elements.viewersCount.textContent = totalViewers || 1;

    updateStatusBadge(item.status);
    updatePriceDisplay(item.currentBid, item.highestBidder);
    updateTimerDisplay(timeRemaining);
    renderBidHistory(bidHistory);
    updateBidInputConstraints();

    elements.soldModal.classList.add("hidden");
    elements.outbidToast.classList.add("hidden");
  });

  socket.on("user:joined", ({ username, totalViewers }) => {
    elements.viewersCount.textContent = totalViewers;
  });

  socket.on("user:left", ({ username, totalViewers }) => {
    elements.viewersCount.textContent = totalViewers;
  });

  socket.on("auction:time_tick", ({ auctionId, timeRemaining }) => {
    if (auctionId !== state.currentAuctionId) return;
    state.timeRemaining = timeRemaining;
    updateTimerDisplay(timeRemaining);
  });

  socket.on("bid:success", ({ currentBid, highestBidder, bidHistory }) => {
    if (state.currentAuction) {
      state.currentAuction.currentBid = currentBid;
      state.currentAuction.highestBidder = highestBidder;
      state.currentAuction.bidHistory = bidHistory;
    }

    updatePriceDisplay(currentBid, highestBidder);
    renderBidHistory(bidHistory);
    updateBidInputConstraints();
    clearBidAlert();
  });

  socket.on("bid:outbid", ({ message }) => {
    elements.outbidToastMessage.textContent = message;
    elements.outbidToast.classList.remove("hidden");

    elements.yourBidStatus.textContent = "Outbid";
    elements.yourBidStatus.className = "badge outbid";

    showBidAlert("alert-danger", message);
  });

  socket.on("bid:rejected", ({ reason }) => {
    showBidAlert("alert-danger", reason);
  });

  socket.on("auction:extended", ({ timeRemaining, message }) => {
    state.timeRemaining = timeRemaining;
    updateTimerDisplay(timeRemaining);

    elements.antiSnipeBanner.classList.remove("hidden");
    setTimeout(() => {
      elements.antiSnipeBanner.classList.add("hidden");
    }, 4000);
  });

  socket.on("auction:sold", ({ winner, finalPrice, message }) => {
    updateStatusBadge("ended");

    elements.soldWinnerName.textContent = winner;
    elements.soldFinalPrice.textContent = `₹${finalPrice.toLocaleString('en-IN')}`;
    elements.soldMessage.textContent = message;
    elements.soldModal.classList.remove("hidden");

    disableBiddingForm();
  });

  socket.on("auction:reset_event", ({ message }) => {
    showBidAlert("alert-success", message);
    enableBiddingForm();
  });

  function updateStatusBadge(status) {
    if (status === "active") {
      elements.itemStatusBadge.textContent = "Active";
      elements.itemStatusBadge.className = "status-pill active";
      enableBiddingForm();
    } else {
      elements.itemStatusBadge.textContent = "Ended";
      elements.itemStatusBadge.className = "status-pill ended";
      disableBiddingForm();
    }
  }

  function updatePriceDisplay(currentBid, highestBidder) {
    elements.currentBidAmount.textContent = currentBid.toLocaleString('en-IN');

    if (highestBidder) {
      elements.highestBidderName.textContent = highestBidder;
      if (highestBidder === state.username) {
        elements.yourBidStatus.textContent = "Leading";
        elements.yourBidStatus.className = "badge leading";
      } else {
        elements.yourBidStatus.textContent = "Behind";
        elements.yourBidStatus.className = "badge outbid";
      }
    } else {
      elements.highestBidderName.textContent = "No Bids Yet";
      elements.yourBidStatus.textContent = "Ready";
      elements.yourBidStatus.className = "badge";
    }
  }

  function updateTimerDisplay(timeRemaining) {
    elements.timerSeconds.textContent = timeRemaining;
    if (timeRemaining <= 15 && timeRemaining > 0) {
      elements.timerBox.classList.add("timer-low");
    } else {
      elements.timerBox.classList.remove("timer-low");
    }
  }

  function renderBidHistory(bidHistory) {
    elements.bidHistoryTbody.innerHTML = "";
    elements.bidCountBadge.textContent = `${bidHistory.length} Bids`;

    if (!bidHistory || bidHistory.length === 0) {
      elements.bidHistoryTbody.innerHTML = `
        <tr class="empty-row"><td colspan="3">No bids placed yet.</td></tr>`;
      return;
    }

    bidHistory.forEach((bid, index) => {
      const tr = document.createElement("tr");
      if (index === 0) tr.className = "new-row";

      tr.innerHTML = `
        <td>${bid.timestamp}</td>
        <td><strong>${escapeHtml(bid.bidder)}</strong></td>
        <td>₹${bid.amount.toLocaleString('en-IN')}</td>
      `;
      elements.bidHistoryTbody.appendChild(tr);
    });
  }

  function updateBidInputConstraints() {
    if (!state.currentAuction) return;
    const minInc = state.currentAuction.minIncrement || 2000;
    const currentPrice = state.currentAuction.currentBid || state.currentAuction.startingPrice;
    const minValidBid = currentPrice + minInc;

    elements.bidAmountInput.min = minValidBid;
    elements.bidAmountInput.placeholder = `Min bid: ₹${minValidBid.toLocaleString('en-IN')}`;
    elements.quickMinBtn.textContent = `+Min (₹${minInc.toLocaleString('en-IN')})`;
  }

  function showBidAlert(className, message) {
    elements.bidAlert.className = `alert ${className}`;
    elements.bidAlert.textContent = message;
    elements.bidAlert.classList.remove("hidden");
  }

  function clearBidAlert() {
    elements.bidAlert.classList.add("hidden");
  }

  function disableBiddingForm() {
    elements.placeBidBtn.disabled = true;
    elements.quickMinBtn.disabled = true;
    elements.quick5kBtn.disabled = true;
    elements.quick10kBtn.disabled = true;
    elements.bidAmountInput.disabled = true;
  }

  function enableBiddingForm() {
    elements.placeBidBtn.disabled = false;
    elements.quickMinBtn.disabled = false;
    elements.quick5kBtn.disabled = false;
    elements.quick10kBtn.disabled = false;
    elements.bidAmountInput.disabled = false;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  elements.joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = elements.usernameInput.value.trim();
    const wallet = Number(elements.walletInput.value) || 100000;

    if (!username) return;

    state.username = username;
    state.wallet = wallet;

    elements.displayUsername.textContent = username;
    elements.displayWallet.textContent = `₹${wallet.toLocaleString('en-IN')}`;
    elements.joinModal.classList.add("hidden");

    socket.emit("auction:join", {
      auctionId: state.currentAuctionId,
      username: state.username
    });
  });

  elements.auctionSelector.addEventListener("change", (e) => {
    state.currentAuctionId = e.target.value;
    socket.emit("auction:join", {
      auctionId: state.currentAuctionId,
      username: state.username || "Bidder"
    });
  });

  elements.bidForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number(elements.bidAmountInput.value);
    if (!amount || amount <= 0) return;

    if (amount > state.wallet) {
      showBidAlert("alert-danger", `Insufficient wallet balance! Available: ₹${state.wallet.toLocaleString('en-IN')}`);
      return;
    }

    socket.emit("bid:place", {
      auctionId: state.currentAuctionId,
      amount
    });

    elements.bidAmountInput.value = "";
  });

  elements.quickMinBtn.addEventListener("click", () => {
    if (!state.currentAuction) return;
    const minValid = state.currentAuction.currentBid + state.currentAuction.minIncrement;
    elements.bidAmountInput.value = minValid;
    elements.bidForm.requestSubmit();
  });

  elements.quick5kBtn.addEventListener("click", () => {
    if (!state.currentAuction) return;
    const target = state.currentAuction.currentBid + 5000;
    elements.bidAmountInput.value = target;
    elements.bidForm.requestSubmit();
  });

  elements.quick10kBtn.addEventListener("click", () => {
    if (!state.currentAuction) return;
    const target = state.currentAuction.currentBid + 10000;
    elements.bidAmountInput.value = target;
    elements.bidForm.requestSubmit();
  });

  elements.closeOutbidToastBtn.addEventListener("click", () => {
    elements.outbidToast.classList.add("hidden");
  });

  elements.counterBidBtn.addEventListener("click", () => {
    elements.outbidToast.classList.add("hidden");
    if (state.currentAuction) {
      const minValid = state.currentAuction.currentBid + state.currentAuction.minIncrement;
      elements.bidAmountInput.value = minValid;
      elements.bidAmountInput.focus();
    }
  });

  elements.demoResetBtn.addEventListener("click", () => {
    socket.emit("auction:reset", { auctionId: state.currentAuctionId });
  });

  elements.soldResetBtn.addEventListener("click", () => {
    elements.soldModal.classList.add("hidden");
    socket.emit("auction:reset", { auctionId: state.currentAuctionId });
  });

  elements.soldCloseBtn.addEventListener("click", () => {
    elements.soldModal.classList.add("hidden");
  });
});
