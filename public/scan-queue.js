const LAST_QR_SCAN_KEY = 'last_qr_scan';
const SCAN_REPEAT_WINDOW_MS = 5000;

// --- BACKGROUND SCAN QUEUE ENGINE ---
/**
 * Persists scans in `scan_queue` and processes the oldest pending item first.
 * Pending items survive reloads; 401 pauses processing for a new login, while
 * network, 429, and 5xx failures remain pending for retry. Completed history is
 * retained for the UI and trimmed by clearOldHistory().
 */
class ScanQueue {
  constructor() {
    try {
      this.queue = JSON.parse(localStorage.getItem('scan_queue') || '[]');
    } catch (e) {
      console.error("Failed to read localStorage:", e);
      this.queue = [];
    }

    // Self-healing: Reset any stuck 'processing' status back to 'pending' on load
    let modified = false;
    this.queue.forEach(item => {
      if (item.status === 'processing') {
        item.status = 'pending';
        modified = true;
      }
    });
    if (modified) this.save();

    this.isProcessing = false;
    const initialPending = this.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
    this.totalInBatch = initialPending;
    this.cleanExpiredItems();
    this.expireTimer = setInterval(() => this.cleanExpiredItems(), 15000);
  }

  save() {
    this.clearOldHistory(); // Slice first
    try {
      localStorage.setItem('scan_queue', JSON.stringify(this.queue));
    } catch (e) {
      console.error("Failed to write localStorage:", e);
    }
    const pendingCount = this.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
    if (pendingCount === 0) this.totalInBatch = 0;
    else if (this.totalInBatch < pendingCount) this.totalInBatch = pendingCount;
    window.dispatchEvent(new CustomEvent('scanqueuechange', { detail: this.queue }));
  }

  dismiss(id) {
    const index = this.queue.findIndex(item => item.id === id);
    if (index < 0) return false;
    const item = this.queue[index];
    if (item.status === 'pending' || item.status === 'processing') return false;

    this.queue.splice(index, 1);
    this.save();
    window.showToast('Riwayat pemindaian dihapus', 'info', {
      actionLabel: 'Urungkan',
      duration: 5000,
      onAction: () => this.restore(item, index)
    });
    return true;
  }

  restore(item, index) {
    if (!item || this.queue.some(existing => existing.id === item.id)) return false;
    this.queue.splice(Math.min(index, this.queue.length), 0, item);
    this.save();
    return true;
  }

  add(studentId, week) {
    const timestamp = Date.now();

    let lastScan = null;
    try {
      lastScan = JSON.parse(localStorage.getItem(LAST_QR_SCAN_KEY) || 'null');
    } catch {
      localStorage.removeItem(LAST_QR_SCAN_KEY);
    }
    if (lastScan?.studentId === studentId && lastScan.expiresAt > timestamp) {
      return false;
    }
    const expiresAt = timestamp + SCAN_REPEAT_WINDOW_MS;
    localStorage.setItem(LAST_QR_SCAN_KEY, JSON.stringify({ studentId, expiresAt }));
    setTimeout(() => {
      try {
        const current = JSON.parse(localStorage.getItem(LAST_QR_SCAN_KEY) || 'null');
        if (current?.studentId === studentId && current.expiresAt <= Date.now()) localStorage.removeItem(LAST_QR_SCAN_KEY);
      } catch {
        localStorage.removeItem(LAST_QR_SCAN_KEY);
      }
    }, SCAN_REPEAT_WINDOW_MS);

    const id = 'scan_' + Math.random().toString(36).substring(2, 9) + '_' + timestamp;
    const item = {
      id,
      studentId,
      week,
      status: 'pending',
      name: '',
      image: '',
      errorMsg: '',
      timestamp
    };

    this.queue.unshift(item); // Add to the top of list
    const pendingCount = this.queue.filter(q => q.status === 'pending' || q.status === 'processing').length;
    if (this.totalInBatch === 0 || this.totalInBatch < pendingCount) {
      this.totalInBatch = pendingCount;
    } else {
      this.totalInBatch += 1;
    }
    this.save();
    
    // Trigger immediate sequential processing loop
    this.process();
    return true;
  }

  async process() {
    if (this.isProcessing) return;

    // Find the oldest pending item
    const pendingItem = [...this.queue].reverse().find(item => item.status === 'pending');
    if (!pendingItem) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    pendingItem.status = 'processing';
    this.save();

    try {
      const token = sessionStorage.getItem('authToken');
      const response = await fetch("/api/absensi", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ studentId: pendingItem.studentId, week: pendingItem.week }),
      });

      if (!response.ok) {
        // Insert this check in process() immediately after checking response status:
        if (response.status === 401) {
          pendingItem.status = 'pending';
          this.isProcessing = false;
          this.save();
          window.expireSession?.();
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          window.triggerVisualFlash?.('error');
          window.setAppState?.(0);
          return; // Stop queue loop
        }

        // Transient server errors (5xx) or rate limits (429) should be retried.
        if (response.status >= 500 || response.status === 429) {
          pendingItem.status = 'pending';
          pendingItem.errorMsg = `HTTP ${response.status} (Menunggu retry)`;
          this.isProcessing = false;
          this.save();
          // Trigger retry after 5 seconds
          setTimeout(() => this.process(), 5000);
          return; // Stop current loop
        } else {
          // Permanent client errors (e.g. 400, 404)
          pendingItem.status = 'error';
          pendingItem.errorMsg = `HTTP ${response.status}`;
          
          window.showToast(pendingItem.errorMsg || 'Gagal sinkronisasi', 'error', {
            badge: `Gagal · Topik ${pendingItem.week}`
          });

          window.triggerVisualFlash?.('error');
        }
      } else {
        const data = await response.json();
        
        if (data.status === "ok") {
          pendingItem.status = 'success';
          pendingItem.name = data.name;
          const localMatch = this.queue.find(item => item.studentId === pendingItem.studentId && item.image);
          pendingItem.image = data.image || (localMatch ? localMatch.image : '');
          
          window.showToast(data.name || 'Katekumen', 'success', {
            badge: `Hadir · Topik ${pendingItem.week}`
          });

          window.triggerVisualFlash?.('success', true);
          if (navigator.vibrate) navigator.vibrate(200);
        } else if (data.status === "duplicate") {
          pendingItem.status = 'duplicate';
          pendingItem.name = data.name || 'Presensi Sudah Tercatat';
          const localMatch = this.queue.find(item => item.studentId === pendingItem.studentId && item.image);
          pendingItem.image = data.image || (localMatch ? localMatch.image : '');
          
          window.showToast(data.name || 'Katekumen', 'duplicate', {
            badge: `Duplikat · Topik ${pendingItem.week}`
          });

          window.triggerVisualFlash?.('duplicate', true);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        } else {
          pendingItem.status = 'error';
          pendingItem.errorMsg = data.message || 'Gagal sinkronisasi';
          
          window.showToast(pendingItem.errorMsg || 'Gagal sinkronisasi', 'error', {
            badge: `Gagal · Topik ${pendingItem.week}`
          });

          if (window.triggerVisualFlash?.('error', true) && navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
      }
    } catch (error) {
      console.error("Queue sync network error:", error);
      pendingItem.status = 'pending'; // Revert back to pending to retry when online
      this.save();
      
      this.isProcessing = false;
      setTimeout(() => this.process(), 5000);
      return; // Stop processing loop until back online
    }

    this.isProcessing = false;
    this.save();
    
    // Continue processing remaining items in queue
    setTimeout(() => this.process(), 500);
  }

  clearOldHistory() {
    if (this.queue.length > 20) {
      // Separate pending/processing items and completed items
      const pendingItems = this.queue.filter(item => item.status === 'pending' || item.status === 'processing');
      const completedItems = this.queue.filter(item => item.status !== 'pending' && item.status !== 'processing');
      
      // Calculate how many completed items we are allowed to keep
      const allowedCompletedCount = Math.max(0, 20 - pendingItems.length);
      const prunedCompleted = completedItems.slice(0, allowedCompletedCount);
      
      // Combine them using a Set of allowed IDs to preserve original order
      const allowedIds = new Set([
        ...pendingItems.map(item => item.id),
        ...prunedCompleted.map(item => item.id)
      ]);
      this.queue = this.queue.filter(item => allowedIds.has(item.id));
    }
  }

  cleanExpiredItems() {
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    const initialLength = this.queue.length;

    // Keep items if they are pending/processing (so offline scans are not lost before syncing),
    // or if they are less than 30 minutes old.
    this.queue = this.queue.filter(item => {
      const isPendingOrProcessing = item.status === 'pending' || item.status === 'processing';
      const itemTime = item.timestamp || 0;
      const isExpired = (now - itemTime) >= thirtyMinutes;
      return isPendingOrProcessing || !isExpired;
    });

    if (this.queue.length !== initialLength) {
      this.save();
    }
  }
}

// Instantiate globally
window.scanQueue = new ScanQueue();
