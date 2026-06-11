const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in ms

window.ImageCache = {
  get: function(studentId) {
    if (!studentId) return null;
    const key = `img_cache_${studentId.toLowerCase()}`;
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;
      
      const item = JSON.parse(itemStr);
      const now = Date.now();
      
      if (now - item.ts > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      
      return item.data;
    } catch (e) {
      console.error(`Error reading image cache for ${studentId}:`, e);
      return null;
    }
  },

  set: function(studentId, dataUrl) {
    if (!studentId || !dataUrl) return;
    const key = `img_cache_${studentId.toLowerCase()}`;
    try {
      const item = {
        data: dataUrl,
        ts: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.warn(`Failed to write to localStorage for ${studentId}:`, e);
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        this.clearAll();
        try {
          const item = { data: dataUrl, ts: Date.now() };
          localStorage.setItem(key, JSON.stringify(item));
        } catch (retryErr) {
          console.error('Failed to cache image even after clearing storage:', retryErr);
        }
      }
    }
  },

  clearAll: function() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('img_cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      console.log('Cleared all image cache from localStorage');
    } catch (e) {
      console.error('Error clearing image cache:', e);
    }
  },

  compressAndCacheElement: function(studentId, imgEl) {
    if (!studentId || !imgEl || imgEl.src.startsWith('data:') || imgEl.src.includes('assets/favicon.png')) {
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const maxDim = 300; 
      let width = imgEl.naturalWidth || imgEl.width;
      let height = imgEl.naturalHeight || imgEl.height;
      
      if (!width || !height) return;
      
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(imgEl, 0, 0, width, height);
      
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      this.set(studentId, compressedDataUrl);
    } catch (e) {
      console.warn(`Error compressing image element for ${studentId}:`, e);
    }
  }
};
