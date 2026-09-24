/**
 * app.js
 * Mission-Critical Live Auction Trading Floor Controller
 * Sotheby's + Bloomberg Terminal Aesthetic
 */

// --- 1. WEB AUDIO API SYNTHESIZER ---
class AuctionAudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('sothebys_audio_muted') === 'true';
  }

  initContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('sothebys_audio_muted', this.muted);
    return this.muted;
  }

  // Metallic Price Tick / Gavel Tap for new bid
  playBidTick() {
    if (this.muted) return;
    try {
      this.initContext();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // Anti-Snipe Extension Chime (Dual tone alert)
  playExtendChime() {
    if (this.muted) return;
    try {
      this.initContext();
      const now = this.ctx.currentTime;
      
      [587.33, 880].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.25, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // Outbid Alarm (Urgent descending warning)
  playOutbidAlarm() {
    if (this.muted) return;
    try {
      this.initContext();
      const now = this.ctx.currentTime;
      
      [784, 523.25].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.22, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.25);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // Gavel Hammer Strike on SOLD
  playGavelSold() {
    if (this.muted) return;
    try {
      this.initContext();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.4);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }
}

// --- 2. TRADING FLOOR APP CONTROLLER ---
class TradingFloorApp {
  constructor() {
    this.socketClient = new AuctionSocketClient();
    this.audio = new AuctionAudioEngine();

    this.currentAuctionId = 'lot-101';
    this.username = localStorage.getItem('sothebys_bidder_name') || this.generateRandomBidder();
    localStorage.setItem('sothebys_bidder_name', this.username);

    this.currentAuction = null;
    this.allAuctions = [];
    this.initialDuration = 90; // baseline for progress calculation

    this.dom = {
      userBadge: document.getElementById('user-badge-name'),
      userModal: document.getElementById('user-modal'),
      usernameInput: document.getElementById('modal-username-input'),
      audioToggleBtn: document.getElementById('audio-toggle-btn'),
      audioToggleIcon: document.getElementById('audio-toggle-icon'),
      lotSwitcher: document.getElementById('lot-switcher-bar'),
      
      // Hero Card
      lotNumber: document.getElementById('lot-number-pill'),
      viewerCount: document.getElementById('viewer-count-text'),
      lotCategory: document.getElementById('lot-category-tag'),
      lotTitle: document.getElementById('lot-title-text'),
      lotDesc: document.getElementById('lot-desc-text'),
      lotImage: document.getElementById('lot-hero-image'),
      
      // Price
      heroPrice: document.getElementById('hero-price-amount'),
      leaderStatus: document.getElementById('price-leader-status'),
      leaderName: document.getElementById('price-leader-name'),
      
      // Countdown
      countdownBox: document.getElementById('countdown-box'),
      countdownDigits: document.getElementById('countdown-digits'),
      countdownFill: document.getElementById('countdown-bar-fill'),
      
      // Console
      biddingConsole: document.getElementById('bidding-console'),
      minBidHighlight: document.getElementById('min-bid-highlight'),
      quickIncGrid: document.getElementById('quick-increments-grid'),
      bidInput: document.getElementById('manual-bid-input'),
      bidSubmitBtn: document.getElementById('bid-submit-btn'),
      consoleError: document.getElementById('console-error-msg'),
      
      // Sold Overlay
      soldOverlay: document.getElementById('sold-stage-overlay'),
      soldWinnerName: document.getElementById('sold-winner-name'),
      soldFinalPrice: document.getElementById('sold-final-price'),
      
      // Outbid Alarm
      outbidBanner: document.getElementById('outbid-alert-banner'),
      outbidText: document.getElementById('outbid-desc-text'),
      rebidActionBtn: document.getElementById('rebid-action-btn'),
      dismissOutbidBtn: document.getElementById('dismiss-outbid-btn'),
      
      // Anti Snipe Toast
      snipeToast: document.getElementById('anti-snipe-toast'),
      snipeToastDesc: document.getElementById('snipe-toast-desc'),
      
      // Tape Feed
      tapeList: document.getElementById('tape-scroll-list'),
      tapeCount: document.getElementById('tape-count-pill')
    };

    this.init();
  }

  generateRandomBidder() {
    const titles = ['Lord', 'Lady', 'Duchess', 'Baron', 'Sir', 'Count'];
    const names = ['Sterling', 'Kensington', 'Vanderbilt', 'Sinclair', 'Fairfax', 'Rothschild'];
    const rTitle = titles[Math.floor(Math.random() * titles.length)];
    const rName = names[Math.floor(Math.random() * names.length)];
    return `${rTitle} ${rName}`;
  }

  formatCurrency(num) {
    return '$' + Number(num || 0).toLocaleString('en-US');
  }

  formatTime(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--:--';
    }
  }

  async init() {
    this.renderUserBadge();
    this.updateAudioButtonState();
    this.setupEventListeners();
    await this.fetchLotCatalog();

    this.socketClient.connect();
    this.setupSocketEvents();

    // Join default room
    this.socketClient.joinAuction(this.currentAuctionId, this.username);
  }

  renderUserBadge() {
    if (this.dom.userBadge) {
      this.dom.userBadge.textContent = this.username;
    }
  }

  updateAudioButtonState() {
    if (!this.dom.audioToggleBtn) return;
    if (this.audio.muted) {
      this.dom.audioToggleBtn.innerHTML = '🔇 <span style="font-size:0.75rem">MUTED</span>';
      this.dom.audioToggleBtn.style.opacity = '0.6';
    } else {
      this.dom.audioToggleBtn.innerHTML = '🔊 <span style="font-size:0.75rem">AUDIO ON</span>';
      this.dom.audioToggleBtn.style.opacity = '1';
    }
  }

  setupEventListeners() {
    // Audio toggle
    if (this.dom.audioToggleBtn) {
      this.dom.audioToggleBtn.addEventListener('click', () => {
        this.audio.toggleMute();
        this.updateAudioButtonState();
      });
    }

    // User modal
    const userBtn = document.getElementById('user-profile-btn');
    if (userBtn) {
      userBtn.addEventListener('click', () => {
        this.dom.usernameInput.value = this.username;
        this.dom.userModal.classList.add('open');
      });
    }

    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
      this.dom.userModal.classList.remove('open');
    });

    document.getElementById('modal-save-btn')?.addEventListener('click', () => {
      const newName = this.dom.usernameInput.value.trim();
      if (newName) {
        this.username = newName;
        localStorage.setItem('sothebys_bidder_name', this.username);
        this.renderUserBadge();
        this.dom.userModal.classList.remove('open');
        // Rejoin auction with new identity
        this.socketClient.joinAuction(this.currentAuctionId, this.username);
      }
    });

    // Bid submit
    this.dom.bidSubmitBtn?.addEventListener('click', () => this.handleBidSubmit());

    // Enter key in bid input
    this.dom.bidInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleBidSubmit();
      }
    });

    // Dismiss outbid banner
    this.dom.dismissOutbidBtn?.addEventListener('click', () => {
      this.dom.outbidBanner.classList.remove('visible');
    });

    // Re-bid quick action from banner
    this.dom.rebidActionBtn?.addEventListener('click', () => {
      this.dom.outbidBanner.classList.remove('visible');
      if (this.currentAuction) {
        const minReq = this.currentAuction.currentBid + this.currentAuction.minIncrement;
        this.dom.bidInput.value = minReq;
        this.handleBidSubmit();
      }
    });

    // Global click listener to unlock Web Audio on first gesture
    document.addEventListener('click', () => {
      this.audio.initContext();
    }, { once: true });
  }

  async fetchLotCatalog() {
    try {
      const res = await fetch('/api/auctions');
      const data = await res.json();
      if (data && data.auctions) {
        this.allAuctions = data.auctions;
        this.renderLotSwitcher();
      }
    } catch (err) {
      console.error('Error fetching catalog:', err);
    }
  }

  renderLotSwitcher() {
    if (!this.dom.lotSwitcher) return;
    this.dom.lotSwitcher.innerHTML = '';

    this.allAuctions.forEach((lot) => {
      const card = document.createElement('div');
      card.className = `lot-tab ${lot.id === this.currentAuctionId ? 'active' : ''}`;
      card.id = `lot-tab-${lot.id}`;

      card.innerHTML = `
        <div class="lot-tab-meta">
          <div class="lot-num">${lot.lotNumber}</div>
          <div class="lot-name" title="${lot.title}">${lot.title}</div>
        </div>
        <div class="lot-tab-price">
          <div class="tab-curr-bid font-mono" id="tab-price-${lot.id}">${this.formatCurrency(lot.currentBid)}</div>
          <span class="tab-status-tag ${lot.status}" id="tab-status-${lot.id}">${lot.status.toUpperCase()}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (this.currentAuctionId !== lot.id) {
          this.switchLot(lot.id);
        }
      });

      this.dom.lotSwitcher.appendChild(card);
    });
  }

  switchLot(auctionId) {
    this.currentAuctionId = auctionId;
    this.dom.outbidBanner.classList.remove('visible');
    this.clearError();

    // Update active tab styling
    document.querySelectorAll('.lot-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`lot-tab-${auctionId}`)?.classList.add('active');

    // Join room on server
    this.socketClient.joinAuction(auctionId, this.username);
  }

  setupSocketEvents() {
    // 1. Initial authoritative state
    this.socketClient.on('auction:init', (data) => {
      if (!data || !data.auction) return;
      this.currentAuction = data.auction;
      this.initialDuration = Math.max(data.auction.timeRemainingSeconds, 60);
      this.renderFullAuctionState();
    });

    // 2. Server 1-second countdown tick
    this.socketClient.on('auction:time_tick', (data) => {
      if (!data || data.auctionId !== this.currentAuctionId) return;
      if (this.currentAuction) {
        this.currentAuction.timeRemainingSeconds = data.timeRemainingSeconds;
      }
      this.renderCountdown(data.timeRemainingSeconds);
    });

    // 3. User joined / viewer count update
    this.socketClient.on('user:joined', (data) => {
      if (data && data.auctionId === this.currentAuctionId && this.dom.viewerCount) {
        this.dom.viewerCount.textContent = `${data.totalViewers} Active Observers`;
      }
    });

    // 4. Successful bid placed in room
    this.socketClient.on('bid:success', (data) => {
      if (!data || data.auctionId !== this.currentAuctionId) {
        this.updateLotTabPrice(data.auctionId, data.currentBid);
        return;
      }

      this.currentAuction.currentBid = data.currentBid;
      this.currentAuction.currentHighestBidder = data.currentHighestBidder;
      this.currentAuction.minIncrement = data.minIncrement;
      this.currentAuction.bidHistory = data.bidHistory;

      // Unlock UI
      this.unlockBidButton();
      this.clearError();

      // Audio & Visual pulse
      this.audio.playBidTick();
      this.renderPrice();
      this.renderLeaderStatus();
      this.renderBiddingConsole();
      this.updateLotTabPrice(data.auctionId, data.currentBid);
    });

    // 5. Targeted outbid alert for displaced highest bidder
    this.socketClient.on('bid:outbid', (data) => {
      if (!data) return;
      this.audio.playOutbidAlarm();
      this.showOutbidBanner(data);
    });

    // 6. Bid rejected (inline error feedback)
    this.socketClient.on('bid:rejected', (data) => {
      this.unlockBidButton();
      this.showError(data.reason || 'Bid was not accepted.');
    });

    // 7. Anti-snipe timer extension
    this.socketClient.on('auction:extended', (data) => {
      if (!data || data.auctionId !== this.currentAuctionId) return;
      this.audio.playExtendChime();
      this.triggerAntiSnipeAnimation(data.newTimeRemainingSeconds, data.message);
    });

    // 8. Auction sold / closed
    this.socketClient.on('auction:sold', (data) => {
      if (!data || data.auctionId !== this.currentAuctionId) {
        this.updateLotTabStatus(data?.auctionId, 'ended');
        return;
      }
      this.audio.playGavelSold();
      this.renderSoldState(data);
      this.updateLotTabStatus(data.auctionId, 'ended');
    });

    // 9. Auditable Activity feed tape event
    this.socketClient.on('auction:activity', (data) => {
      if (!data || data.auctionId !== this.currentAuctionId) return;
      this.prependTapeRow(data.activity);
    });

    // 10. Global reset
    this.socketClient.on('auction:reset_all', () => {
      this.fetchLotCatalog().then(() => {
        this.socketClient.joinAuction(this.currentAuctionId, this.username);
      });
    });
  }

  renderFullAuctionState() {
    if (!this.currentAuction) return;
    const a = this.currentAuction;

    if (this.dom.lotNumber) this.dom.lotNumber.textContent = a.lotNumber;
    if (this.dom.viewerCount) this.dom.viewerCount.textContent = `${a.totalViewers || 1} Active Observers`;
    if (this.dom.lotCategory) this.dom.lotCategory.textContent = a.category || 'Live Catalog';
    if (this.dom.lotTitle) this.dom.lotTitle.textContent = a.title;
    if (this.dom.lotDesc) this.dom.lotDesc.textContent = a.description;
    if (this.dom.lotImage && a.imageUrl) this.dom.lotImage.src = a.imageUrl;

    this.renderPrice();
    this.renderLeaderStatus();
    this.renderCountdown(a.timeRemainingSeconds);
    this.renderBiddingConsole();
    this.renderActivityTape(a.bidHistory);

    if (a.status === 'ended') {
      this.renderSoldState({
        winner: a.currentHighestBidder,
        finalAmount: a.currentBid,
        bidCount: a.bidHistory.length
      });
    } else {
      this.dom.soldOverlay.classList.remove('visible');
      this.dom.biddingConsole.style.display = 'flex';
    }
  }

  renderPrice() {
    if (!this.dom.heroPrice || !this.currentAuction) return;
    this.dom.heroPrice.textContent = this.formatCurrency(this.currentAuction.currentBid);

    // Trigger flash animation
    this.dom.heroPrice.classList.remove('price-flash');
    void this.dom.heroPrice.offsetWidth; // trigger reflow
    this.dom.heroPrice.classList.add('price-flash');
  }

  renderLeaderStatus() {
    if (!this.dom.leaderStatus || !this.currentAuction) return;
    const leader = this.currentAuction.currentHighestBidder;
    const isUserLeader = leader && leader.toLowerCase() === this.username.toLowerCase();

    if (!leader) {
      this.dom.leaderStatus.className = 'price-leader-status';
      this.dom.leaderStatus.innerHTML = `<span>Starting Reserve Price</span>`;
    } else if (isUserLeader) {
      this.dom.leaderStatus.className = 'price-leader-status is-user-leading';
      this.dom.leaderStatus.innerHTML = `<span>★ YOU ARE THE CURRENT HIGHEST BIDDER</span>`;
    } else {
      this.dom.leaderStatus.className = 'price-leader-status';
      this.dom.leaderStatus.innerHTML = `<span>Current Leader:</span> <span class="leader-name" id="price-leader-name">${leader}</span>`;
    }
  }

  renderCountdown(seconds) {
    if (!this.dom.countdownDigits || !this.dom.countdownFill) return;
    const sec = Math.max(0, seconds);

    const mins = Math.floor(sec / 60);
    const remainderSec = sec % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(remainderSec).padStart(2, '0')}`;
    this.dom.countdownDigits.textContent = formatted;

    // Remove existing urgency classes
    this.dom.countdownDigits.classList.remove('urgency-amber', 'urgency-crimson');
    this.dom.countdownFill.classList.remove('urgency-amber', 'urgency-crimson');

    // Urgency coloring
    if (sec <= 15) {
      this.dom.countdownDigits.classList.add('urgency-crimson');
      this.dom.countdownFill.classList.add('urgency-crimson');
    } else if (sec <= 30) {
      this.dom.countdownDigits.classList.add('urgency-amber');
      this.dom.countdownFill.classList.add('urgency-amber');
    }

    // Bar width percentage
    const maxDur = Math.max(this.initialDuration, 20);
    const pct = Math.min(100, Math.max(0, (sec / maxDur) * 100));
    this.dom.countdownFill.style.width = `${pct}%`;
  }

  renderBiddingConsole() {
    if (!this.currentAuction) return;
    const curr = this.currentAuction.currentBid;
    const inc = this.currentAuction.minIncrement;
    const minRequired = curr + inc;

    if (this.dom.minBidHighlight) {
      this.dom.minBidHighlight.textContent = this.formatCurrency(minRequired);
    }

    // Set input placeholder/default
    if (this.dom.bidInput) {
      this.dom.bidInput.placeholder = minRequired;
      if (!this.dom.bidInput.value || Number(this.dom.bidInput.value) < minRequired) {
        this.dom.bidInput.value = minRequired;
      }
    }

    // Quick increment buttons (+1x, +2x, +5x)
    if (this.dom.quickIncGrid) {
      this.dom.quickIncGrid.innerHTML = '';
      [
        { label: '+Min', mult: 1 },
        { label: '+2× Min', mult: 2 },
        { label: '+5× Min', mult: 5 }
      ].forEach(({ label, mult }) => {
        const val = curr + (inc * mult);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quick-inc-btn';
        btn.innerHTML = `
          <span class="quick-inc-label">${label}</span>
          <span class="quick-inc-val font-mono">${this.formatCurrency(val)}</span>
        `;
        btn.addEventListener('click', () => {
          this.dom.bidInput.value = val;
          this.handleBidSubmit();
        });
        this.dom.quickIncGrid.appendChild(btn);
      });
    }
  }

  handleBidSubmit() {
    if (!this.currentAuction || this.currentAuction.status !== 'active') return;

    const rawVal = this.dom.bidInput.value.replace(/[^0-9]/g, '');
    const amount = Number(rawVal);
    const minReq = this.currentAuction.currentBid + this.currentAuction.minIncrement;

    if (isNaN(amount) || amount < minReq) {
      this.showError(`Bid must be at least ${this.formatCurrency(minReq)}`);
      return;
    }

    if (this.currentAuction.currentHighestBidder && this.currentAuction.currentHighestBidder.toLowerCase() === this.username.toLowerCase()) {
      this.showError('You are already the highest bidder');
      return;
    }

    // Optimistic UI Lock
    this.lockBidButton();
    this.clearError();

    // Place bid via server-authoritative socket
    this.socketClient.placeBid(this.currentAuctionId, this.username, amount);
  }

  lockBidButton() {
    if (!this.dom.bidSubmitBtn) return;
    this.dom.bidSubmitBtn.disabled = true;
    this.dom.bidSubmitBtn.classList.add('pending');
    this.dom.bidSubmitBtn.innerHTML = '<span>TRANSMITTING...</span>';
    if (this.dom.quickIncGrid) {
      this.dom.quickIncGrid.querySelectorAll('button').forEach(b => b.disabled = true);
    }
  }

  unlockBidButton() {
    if (!this.dom.bidSubmitBtn) return;
    this.dom.bidSubmitBtn.disabled = false;
    this.dom.bidSubmitBtn.classList.remove('pending');
    this.dom.bidSubmitBtn.innerHTML = '<span>PLACE BID</span>';
    if (this.dom.quickIncGrid) {
      this.dom.quickIncGrid.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  }

  showError(msg) {
    if (this.dom.consoleError) {
      this.dom.consoleError.textContent = `⚠ ${msg}`;
      this.dom.consoleError.classList.add('visible');
    }
  }

  clearError() {
    if (this.dom.consoleError) {
      this.dom.consoleError.classList.remove('visible');
      this.dom.consoleError.textContent = '';
    }
  }

  showOutbidBanner(data) {
    if (!this.dom.outbidBanner || !this.dom.outbidText) return;
    this.dom.outbidText.textContent = `${data.newHighestBidder} placed ${this.formatCurrency(data.newBid)}. Submit counter-bid immediately!`;
    this.dom.outbidBanner.classList.add('visible');
  }

  triggerAntiSnipeAnimation(newSeconds, message) {
    // Snap pulse on timer box
    if (this.dom.countdownBox) {
      this.dom.countdownBox.classList.remove('snap-pulse');
      void this.dom.countdownBox.offsetWidth;
      this.dom.countdownBox.classList.add('snap-pulse');
    }

    // Render toast
    if (this.dom.snipeToast && this.dom.snipeToastDesc) {
      this.dom.snipeToastDesc.textContent = message || 'Auction extended by +20 seconds.';
      this.dom.snipeToast.classList.add('show');
      setTimeout(() => {
        this.dom.snipeToast.classList.remove('show');
      }, 3500);
    }

    this.renderCountdown(newSeconds);
  }

  renderSoldState(data) {
    if (this.dom.soldOverlay && this.dom.biddingConsole) {
      this.dom.biddingConsole.style.display = 'none';
      this.dom.soldOverlay.classList.add('visible');

      if (this.dom.soldWinnerName) {
        this.dom.soldWinnerName.textContent = data.winner ? data.winner : 'NO WINNING BIDDER';
      }
      if (this.dom.soldFinalPrice) {
        this.dom.soldFinalPrice.textContent = this.formatCurrency(data.finalAmount);
      }
    }
    if (this.dom.leaderStatus) {
      this.dom.leaderStatus.className = 'price-leader-status';
      this.dom.leaderStatus.innerHTML = `<span>HAMMER DOWN — LOT CONCLUDED</span>`;
    }
    this.renderCountdown(0);
  }

  renderActivityTape(history) {
    if (!this.dom.tapeList) return;
    this.dom.tapeList.innerHTML = '';

    if (!history || history.length === 0) {
      this.dom.tapeList.innerHTML = `<div class="tape-empty-state">No bids logged yet. Place first bid to open trading floor.</div>`;
      if (this.dom.tapeCount) this.dom.tapeCount.textContent = '0';
      return;
    }

    if (this.dom.tapeCount) this.dom.tapeCount.textContent = String(history.length);
    history.forEach(item => {
      this.appendTapeRow(item, false);
    });
  }

  prependTapeRow(activity) {
    if (!this.dom.tapeList) return;
    const empty = this.dom.tapeList.querySelector('.tape-empty-state');
    if (empty) empty.remove();

    const row = document.createElement('div');
    const isSnipe = activity.type === 'extended';
    const isSold = activity.type === 'sold';

    row.className = `tape-row newest-highlight ${isSnipe ? 'is-snipe-event' : ''} ${isSold ? 'is-sold-event' : ''}`;

    let tagHtml = `<span class="tape-tag bid">BID</span>`;
    if (isSnipe) tagHtml = `<span class="tape-tag snipe">+20s EXTEND</span>`;
    if (isSold) tagHtml = `<span class="tape-tag sold">SOLD</span>`;

    row.innerHTML = `
      <div class="tape-time">${this.formatTime(activity.timestamp)}</div>
      <div class="tape-bidder-info">
        <span class="tape-bidder-name">${activity.bidder || 'Server Notice'}</span>
        <span class="tape-bidder-meta">${isSnipe ? activity.message : (isSold ? 'Hammer Down Realized' : 'Verified Bid')}</span>
      </div>
      <div class="tape-amount-block">
        <div class="tape-amount">${this.formatCurrency(activity.amount)}</div>
        ${tagHtml}
      </div>
    `;

    this.dom.tapeList.insertBefore(row, this.dom.tapeList.firstChild);

    // Update count
    if (this.dom.tapeCount) {
      const current = parseInt(this.dom.tapeCount.textContent || '0', 10);
      this.dom.tapeCount.textContent = String(current + 1);
    }

    setTimeout(() => {
      row.classList.remove('newest-highlight');
    }, 2500);
  }

  appendTapeRow(item, isNew = false) {
    const row = document.createElement('div');
    row.className = `tape-row ${isNew ? 'newest-highlight' : ''}`;
    row.innerHTML = `
      <div class="tape-time">${this.formatTime(item.timestamp)}</div>
      <div class="tape-bidder-info">
        <span class="tape-bidder-name">${item.bidder}</span>
        <span class="tape-bidder-meta">Verified Bid</span>
      </div>
      <div class="tape-amount-block">
        <div class="tape-amount">${this.formatCurrency(item.amount)}</div>
        <span class="tape-tag bid">BID</span>
      </div>
    `;
    this.dom.tapeList.appendChild(row);
  }

  updateLotTabPrice(auctionId, price) {
    const el = document.getElementById(`tab-price-${auctionId}`);
    if (el) {
      el.textContent = this.formatCurrency(price);
    }
  }

  updateLotTabStatus(auctionId, status) {
    const el = document.getElementById(`tab-status-${auctionId}`);
    if (el) {
      el.className = `tab-status-tag ${status}`;
      el.textContent = status.toUpperCase();
    }
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new TradingFloorApp();
});
