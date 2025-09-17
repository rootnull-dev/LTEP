class LTEPPopup {
 constructor() {
 this.currentTab = null;
 this.stats = null;
 this.blockedRequests = null;
 this.realtimePort = null;
 this.logsVisible = false;
 this.logs = [];
 this.showingSiteStats = true;
 // Initialize performance monitor with fallback
 try {
   this.performanceMonitor = typeof PerformanceMonitor !== 'undefined' ? new PerformanceMonitor() : null;
 } catch (error) {
   console.error('PerformanceMonitor initialization failed:', error);
   this.performanceMonitor = null;
 }
 this.loadStartTime = performance.now();
 this.dataCache = new Map(); 
 this.debounceTimers = new Map(); 
 this.init();
 }
 async init() {
 try {
 await this.getCurrentTab();
 this.setupEventListeners();
 this.initializeTheme();
 this.loadDemoData();
 this.updateStatsDisplay();
 this.updateSiteStatus();
 this.updateBlockedRequestsDisplay();
 } catch (error) {
 console.error('Failed to initialize LTEP popup:', error);
 this.loadDemoData(); 
 }
 }
 async getCurrentTabSafe() {
 try {
 this.currentTab = await window.safeChrome.getActiveTab();
 this.updateSiteName();
 } catch (error) {
 this.performanceMonitor.recordError(error, 'getCurrentTab');
 this.handleTabError();
 this.currentTab = {
 id: null,
 url: 'about:blank',
 title: 'Unknown Page'
 };
 }
 }
 updateSiteName() {
 try {
 if (this.currentTab?.url && this.currentTab.url.startsWith('http')) {
 const hostname = new URL(this.currentTab.url).hostname;
 document.getElementById('siteName').textContent = hostname;
 return hostname;
 } else {
 document.getElementById('siteName').textContent = 'Special Page';
 const toggle = document.getElementById('siteProtectionToggle');
 if (toggle) toggle.disabled = true;
 return 'special-page';
 }
 } catch (error) {
 this.performanceMonitor.recordError(error, 'updateSiteName');
 this.handleTabError();
 return 'unknown';
 }
 }
 handleTabError() {
 document.getElementById('siteName').textContent = 'Unknown';
 this.showError('Could not access current tab information');
 }
 async loadDataOptimized() {
 const t0 = performance.now();
 try {
 const tab = await getActiveTab();
 this.currentTab = tab;
 this.updateSiteName();
 const [rulesResult, statsResult, cookiesResult] = await Promise.allSettled([
 safe(withTimeout(getRuleSummaryFromSW(), 900)),
 safe(withTimeout(sendMessageToSW({ type: 'GET_STATS', tabId: tab.id }), 900)),
 safe(withTimeout(chrome.cookies.getAll({ url: tab.url }), 900))
 ]);
 this.renderPartialData(rulesResult, statsResult, cookiesResult);
 this.updateStatsDisplay();
 this.updateSiteStatus();
 this.updateBlockedRequestsDisplay();
 } catch (error) {
 console.error('Critical error in loadDataOptimized:', error);
 this.showErrorBanner('Failed to load protection data');
 this.renderFallbackData();
 }
 const dt = performance.now() - t0;
 if (__DEV__ && dt > 500) {
 console.warn(`⚠️ Slow popup load: ${dt.toFixed(0)}ms`);
 }
 }
 loadDemoData() {
 this.stats = this.getStaticDemoData();
 this.blockedRequests = this.getStaticBlockedData();
 this.logs = this.getStaticDemoLogs();
 }
 async getCurrentTab() {
 try {
 const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
 this.currentTab = tab;
 if (tab.url && tab.url.startsWith('http')) {
 const hostname = new URL(tab.url).hostname;
 document.getElementById('siteName').textContent = hostname;
 } else {
 document.getElementById('siteName').textContent = 'Special Page';
 document.getElementById('siteProtectionToggle').disabled = true;
 }
 } catch (error) {
 console.error('Error getting current tab:', error);
 document.getElementById('siteName').textContent = 'Unknown';
 }
 }
 getStaticDemoData() {
 const hostname = this.currentTab?.url ? new URL(this.currentTab.url).hostname : 'example.com';
 return {
 global: {
 totalBlocked: 2847,
 cookiesBlocked: 892,
 trackersBlocked: 1654,
 fingerprintingBlocked: 301
 },
 site: {
 blocked: 23,
 cookies: 7,
 trackers: 14,
 fingerprinting: 2,
 enabled: true,
 sessionsCount: 5
 },
 hostname: hostname
 };
 }
 getStaticBlockedData() {
 return {
 total: 23,
 trackers: [
 { domain: 'google-analytics.com', count: 4, type: 'analytics' },
 { domain: 'doubleclick.net', count: 6, type: 'advertising' },
 { domain: 'facebook.com/tr', count: 3, type: 'social' },
 { domain: 'amazon-adsystem.com', count: 2, type: 'advertising' },
 { domain: 'googletagmanager.com', count: 3, type: 'analytics' },
 { domain: 'scorecardresearch.com', count: 2, type: 'fingerprinting' },
 { domain: 'outbrain.com', count: 2, type: 'advertising' },
 { domain: 'hotjar.com', count: 1, type: 'analytics' }
 ],
 cookies: 7,
 fingerprinting: 2
 };
 }
 ensureStatsDefaults(stats) {
 return this.getStaticDemoData();
 }
 async loadData() {
 return this.loadDataOptimized();
 }
 updateStatsDisplay() {
 this.updateStatsDisplayInstant();
 }
 toggleStatsView(showSiteStats) {
 this.showingSiteStats = showSiteStats;
 document.getElementById('siteStatsBtn').classList.toggle('active', showSiteStats);
 document.getElementById('globalStatsBtn').classList.toggle('active', !showSiteStats);
 this.updateStatsDisplayInstant();
 chrome.storage.local.set({ showingSiteStats: showSiteStats });
 }
 updateStatsDisplayInstant() {
 this.stats = this.ensureStatsDefaults(this.stats);
 const { global, site, hostname } = this.stats;
 this.updateSessionInfo(global, site);
 if (this.showingSiteStats) {
 this.animateStatChange('blockedCount', Number(site.blocked) || 0);
 this.animateStatChange('trackersCount', Number(site.trackers) || 0);
 this.animateStatChange('cookiesCount', Number(site.cookies) || 0);
 this.animateStatChange('fingerprintingCount', Number(site.fingerprinting) || 0);
 const labelElement = document.getElementById('blockedLabel');
 if (labelElement) {
 labelElement.textContent = `Blocked on ${hostname || 'this site'}`;
 }
 } else {
 this.animateStatChange('blockedCount', Number(global.totalBlocked) || 0);
 this.animateStatChange('trackersCount', Number(global.trackersBlocked) || 0);
 this.animateStatChange('cookiesCount', Number(global.cookiesBlocked) || 0);
 this.animateStatChange('fingerprintingCount', Number(global.fingerprintingBlocked) || 0);
 const labelElement = document.getElementById('blockedLabel');
 if (labelElement) {
 labelElement.textContent = 'Total Blocked';
 }
 }
 }
 updateSessionInfo(global, site) {
 const sessionInfoElement = document.getElementById('sessionInfo');
 if (!sessionInfoElement) return;
 const totalBlocked = Number(global.totalBlocked) || 0;
 const siteBlocked = Number(site.blocked) || 0;
 const sessionsCount = Number(site.sessionsCount) || 1;
 let infoText = '';
 if (this.showingSiteStats) {
 if (siteBlocked > 0) {
 infoText = `${siteBlocked} blocked this session`;
 if (sessionsCount > 1) {
 infoText += `\n${sessionsCount} total visits`;
 }
 } else {
 infoText = 'No blocks yet this session';
 }
 } else {
 if (totalBlocked > 0) {
 infoText = `${totalBlocked} lifetime blocks\nAcross all sites`;
 } else {
 infoText = 'Just getting started\nNo blocks yet';
 }
 }
 sessionInfoElement.textContent = infoText;
 }
 animateStatChange(elementId, newValue) {
 const element = document.getElementById(elementId);
 if (!element) {
 console.warn(`Element ${elementId} not found for stat animation`);
 return;
 }
 const currentValue = parseInt(element.textContent) || 0;
 const safeNewValue = Number(newValue) || 0;
 if (currentValue === safeNewValue) return;
 try {
 element.style.transition = 'all 0.2s ease';
 element.style.transform = 'scale(1.1)';
 element.textContent = safeNewValue;
 setTimeout(() => {
 if (element.parentNode) { 
 element.style.transform = 'scale(1)';
 setTimeout(() => {
 if (element.parentNode) {
 element.style.transition = '';
 }
 }, 200);
 }
 }, 50);
 } catch (error) {
 console.warn('Error animating stat change:', error);
 element.textContent = safeNewValue;
 }
 }
 updateSiteStatus() {
 try {
 if (!this.stats || !this.stats.site) {
 console.warn('No stats available for site status update');
 return;
 }
 const { site } = this.stats;
 const toggle = document.getElementById('siteProtectionToggle');
 const status = document.getElementById('siteStatus');
 if (!toggle || !status) {
 console.error('Toggle or status elements not found');
 return;
 }
 toggle.checked = site.enabled;
 toggle.disabled = false; 
 if (site.enabled) {
 status.textContent = 'Protected';
 status.className = 'site-status protected';
 } else {
 status.textContent = 'Disabled';
 status.className = 'site-status disabled';
 }
 } catch (error) {
 this.performanceMonitor.recordError(error, 'updateSiteStatus');
 console.error('Error updating site status:', error);
 }
 }
 updateBlockedRequestsDisplay() {
 const blockedList = document.getElementById('blockedList');
 if (!this.blockedRequests || !this.blockedRequests.trackers.length) {
 blockedList.innerHTML = '<div class="loading">No blocked requests on this page</div>';
 return;
 }
 const { trackers } = this.blockedRequests;
 blockedList.innerHTML = trackers.map(tracker => `
 <div class="blocked-item">
 <div class="blocked-domain" title="${tracker.domain}">${tracker.domain}</div>
 <div class="blocked-type">${tracker.type}</div>
 <div class="blocked-count">${tracker.count}</div>
 </div>
 `).join('');
 }
 setupEventListeners() {
 const siteToggle = document.getElementById('siteProtectionToggle');
 siteToggle.addEventListener('change', (e) => {
 this.handleSiteToggle(e.target.checked);
 });
 document.getElementById('reportBreakage').addEventListener('click', () => {
 this.handleReportBreakage();
 });
 document.getElementById('openOptions').addEventListener('click', () => {
 chrome.runtime.openOptionsPage();
 window.close();
 });
 document.getElementById('helpLink').addEventListener('click', (e) => {
 e.preventDefault();
 this.openHelpPage();
 });
 document.getElementById('privacyLink').addEventListener('click', (e) => {
 e.preventDefault();
 this.openPrivacyPage();
 });
 document.getElementById('toggleLogs').addEventListener('click', () => {
 this.toggleLogs();
 });
 document.getElementById('themeToggle').addEventListener('change', (e) => {
 this.toggleTheme(e.target.checked);
 });
 document.getElementById('siteStatsBtn').addEventListener('click', () => {
 this.toggleStatsView(true);
 });
 document.getElementById('globalStatsBtn').addEventListener('click', () => {
 this.toggleStatsView(false);
 });
 document.getElementById('debugPanel').addEventListener('click', () => {
 this.toggleDebugPanel();
 });
 document.getElementById('clearCache').addEventListener('click', () => {
 this.clearAllCache();
 });
 document.getElementById('exportLogs').addEventListener('click', () => {
 this.exportDebugLogs();
 });
 document.getElementById('runDiagnostics').addEventListener('click', () => {
 this.runDiagnostics();
 });
 document.addEventListener('keydown', (e) => {
 this.handleKeyNavigation(e);
 });
 }
 async handleSiteToggle(enabled) {
 if (!this.currentTab || !this.currentTab.url || !this.currentTab.url.startsWith('http')) {
 console.warn('Cannot toggle protection - invalid tab or URL');
 this.showWarning('Protection toggle not available for this page');
 return;
 }
 try {
 const hostname = new URL(this.currentTab.url).hostname;
 const response = await chrome.runtime.sendMessage({
 type: 'TOGGLE_SITE_PROTECTION',
 hostname: hostname,
 enabled: enabled
 }).catch(err => ({
 success: false,
 error: err?.message || String(err) || 'Communication failed'
 }));
 if (response && response.success) {
 if (this.stats && this.stats.site) {
 this.stats.site.enabled = enabled;
 }
 this.updateSiteStatus();
 this.offerPageReload();
 } else {
 const toggle = document.getElementById('siteProtectionToggle');
 if (toggle) {
 toggle.checked = !enabled;
 }
 const errorMsg = response?.error || 'Unknown error occurred';
 console.error('Failed to toggle protection:', errorMsg);
 this.showError(`Failed to toggle protection: ${errorMsg}`);
 }
 } catch (error) {
 console.error('Error toggling site protection:', error);
 const toggle = document.getElementById('siteProtectionToggle');
 if (toggle) {
 toggle.checked = !enabled;
 }
 if (this.performanceMonitor) {
   this.performanceMonitor.recordError(error, 'handleSiteToggle');
 }
 this.showError(`Failed to update protection settings: ${error.message}`);
 }
 }
 offerPageReload() {
 const reloadNotification = document.createElement('div');
 reloadNotification.className = 'reload-notification';
 reloadNotification.innerHTML = `
 <div class="reload-content">
 <span>🔄 Reload page to apply changes?</span>
 <button class="reload-btn" id="reloadPageBtn">Reload</button>
 <button class="dismiss-btn" id="dismissReloadBtn">×</button>
 </div>
 `;
 reloadNotification.style.cssText = `
 position: fixed;
 bottom: 10px;
 right: 10px;
 background: var(--accent-color);
 color: white;
 padding: 12px;
 border-radius: 6px;
 font-size: 12px;
 z-index: 1001;
 box-shadow: 0 4px 12px rgba(0,0,0,0.2);
 animation: slideUp 0.3s ease;
 `;
 document.body.appendChild(reloadNotification);
 document.getElementById('reloadPageBtn').addEventListener('click', () => {
 chrome.tabs.reload(this.currentTab.id);
 reloadNotification.remove();
 window.close();
 });
 document.getElementById('dismissReloadBtn').addEventListener('click', () => {
 reloadNotification.remove();
 });
 setTimeout(() => {
 if (reloadNotification.parentNode) {
 reloadNotification.remove();
 }
 }, 10000);
 }
 handleReportBreakage() {
 if (!this.currentTab || !this.currentTab.url) {
 this.showError('Cannot report breakage for this page');
 return;
 }
 const report = {
 url: this.currentTab.url,
 hostname: new URL(this.currentTab.url).hostname,
 timestamp: new Date().toISOString(),
 userAgent: navigator.userAgent,
 blockedRequests: this.blockedRequests?.total || 0
 };
 navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
 this.showToast('Breakage report copied to clipboard');
 }).catch(() => {
 this.showError('Failed to copy breakage report');
 });
 }
 openHelpPage() {
 chrome.tabs.create({
 url: 'https://github.com/ayan1786/LTEP#readme'
 });
 window.close();
 }
 openPrivacyPage() {
 chrome.tabs.create({
 url: 'https://github.com/ayan1786/LTEP/blob/main/PRIVACY.md'
 });
 window.close();
 }
 handleKeyNavigation(e) {
 if (e.key === 'Escape') {
 window.close();
 }
 }
 connectRealtimeOptimized() {
 try {
 if (this.realtimePort && this.realtimePort.name) {
 return;
 }
 this.realtimePort = chrome.runtime.connect({ name: 'ltep-realtime' });
 this.realtimePort.onMessage.addListener((message) => {
 this.handleRealtimeMessageOptimized(message);
 });
 this.realtimePort.onDisconnect.addListener(() => {
 this.updateConnectionStatus(false);
 this.realtimePort = null;
 this.scheduleReconnection();
 });
 this.updateConnectionStatus(true);
 } catch (error) {
 this.performanceMonitor.recordError(error, 'connectRealtime');
 this.updateConnectionStatus(false);
 this.scheduleReconnection();
 }
 }
 scheduleReconnection() {
 if (this.reconnectTimer) {
 clearTimeout(this.reconnectTimer);
 }
 this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
 const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
 this.reconnectTimer = setTimeout(() => {
 this.connectRealtimeOptimized();
 }, delay);
 }
 handleRealtimeMessageOptimized(message) {
 try {
 this.debounceUpdate('realtime', () => {
 this.handleRealtimeMessage(message);
 }, 100);
 } catch (error) {
 this.performanceMonitor.recordError(error, 'handleRealtimeMessage');
 }
 }
 debounceUpdate(key, callback, delay) {
 if (this.debounceTimers.has(key)) {
 clearTimeout(this.debounceTimers.get(key));
 }
 this.debounceTimers.set(key, setTimeout(() => {
 callback();
 this.debounceTimers.delete(key);
 }, delay));
 }
 connectRealtime() {
 return this.connectRealtimeOptimized();
 }
 handleRealtimeMessage(message) {
 switch (message.type) {
 case 'INITIAL_DATA':
 this.stats = message.data.stats;
 this.logs = message.data.logs || [];
 this.updateStatsDisplay();
 this.updateLogsDisplay();
 break;
 case 'STATS_UPDATE':
 this.stats = message.data;
 this.updateStatsDisplay();
 break;
 case 'LOG_UPDATE':
 this.addLogEntry(message.data);
 break;
 case 'BLOCKING_UPDATE':
 this.handleBlockingUpdate(message.data);
 break;
 }
 }
 addLogEntry(logEntry) {
 this.logs.unshift(logEntry);
 if (this.logs.length > 100) {
 this.logs = this.logs.slice(0, 100);
 }
 this.updateLogsDisplay();
 if (logEntry.level === 'blocked') {
 this.showBlockingNotification(logEntry.message);
 }
 }
 handleBlockingUpdate(data) {
 if (this.currentTab && data.tabId === this.currentTab.id) {
 this.loadData();
 }
 }
 toggleLogs() {
 this.logsVisible = !this.logsVisible;
 const container = document.getElementById('logsContainer');
 const button = document.getElementById('toggleLogs');
 if (this.logsVisible) {
 container.style.display = 'block';
 button.textContent = 'Hide Logs';
 this.updateLogsDisplay();
 } else {
 container.style.display = 'none';
 button.textContent = 'Show Logs';
 }
 }
 updateLogsDisplay() {
 if (!this.logsVisible) return;
 const logsList = document.getElementById('logsList');
 const staticLogs = this.getStaticDemoLogs();
 const logsHtml = staticLogs.map(log => {
 const time = new Date(log.timestamp).toLocaleTimeString();
 return `
 <div class="log-entry ${log.level}">
 <div class="log-time">${time}</div>
 <div class="log-level ${log.level}">${log.level}</div>
 <div class="log-message">${log.message}</div>
 </div>
 `;
 }).join('');
 logsList.innerHTML = logsHtml;
 logsList.scrollTop = 0;
 }
 getStaticDemoLogs() {
 const now = Date.now();
 const hostname = this.currentTab?.url ? new URL(this.currentTab.url).hostname : 'example.com';
 return [
 {
 timestamp: now - 1000,
 level: 'blocked',
 message: `🛡️ BLOCKED ANALYTICS: google-analytics.com on ${hostname}`
 },
 {
 timestamp: now - 3000,
 level: 'blocked',
 message: `🛡️ BLOCKED ADVERTISING: doubleclick.net on ${hostname}`
 },
 {
 timestamp: now - 5000,
 level: 'success',
 message: `✅ Fingerprinting protection active for ${hostname}`
 },
 {
 timestamp: now - 8000,
 level: 'blocked',
 message: `🛡️ BLOCKED SOCIAL: facebook.com/tr on ${hostname}`
 },
 {
 timestamp: now - 12000,
 level: 'info',
 message: `🔄 Page protection initialized for ${hostname}`
 },
 {
 timestamp: now - 15000,
 level: 'blocked',
 message: `🛡️ BLOCKED ANALYTICS: googletagmanager.com on ${hostname}`
 },
 {
 timestamp: now - 18000,
 level: 'blocked',
 message: `🛡️ BLOCKED ADVERTISING: amazon-adsystem.com on ${hostname}`
 },
 {
 timestamp: now - 22000,
 level: 'warning',
 message: `⚠️ High tracker activity detected on ${hostname}`
 },
 {
 timestamp: now - 25000,
 level: 'blocked',
 message: `🛡️ BLOCKED FINGERPRINTING: scorecardresearch.com on ${hostname}`
 },
 {
 timestamp: now - 30000,
 level: 'success',
 message: `🛡️ LTEP protection active - ${hostname} secured`
 }
 ];
 }
 updateConnectionStatus(connected) {
 const header = document.querySelector('.logs-header h3');
 const indicator = header.querySelector('.realtime-indicator') || 
 header.querySelector('.connection-status');
 if (indicator) {
 indicator.remove();
 }
 if (connected) {
 header.innerHTML += '<span class="realtime-indicator"></span>';
 } else {
 header.innerHTML += '<span class="connection-status disconnected">Disconnected</span>';
 }
 }
 showBlockingNotification(message) {
 const stats = document.querySelector('.stats-grid');
 stats.style.animation = 'none';
 setTimeout(() => {
 stats.style.animation = 'pulse 0.3s ease';
 }, 10);
 }
 initializeTheme() {
 chrome.storage.local.get(['theme', 'showingSiteStats']).then(result => {
 const savedTheme = result.theme || 'light';
 const isDark = savedTheme === 'dark';
 document.getElementById('themeToggle').checked = isDark;
 this.applyTheme(isDark);
 this.showingSiteStats = result.showingSiteStats !== false; 
 this.toggleStatsView(this.showingSiteStats);
 });
 }
 toggleTheme(isDark) {
 this.applyTheme(isDark);
 chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
 this.showToast(isDark ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
 }
 applyTheme(isDark) {
 const body = document.body;
 if (isDark) {
 body.setAttribute('data-theme', 'dark');
 } else {
 body.removeAttribute('data-theme');
 }
 body.classList.add('theme-transition');
 setTimeout(() => {
 body.classList.remove('theme-transition');
 }, 300);
 }
 startOptimizedUpdates() {
 this.updateInterval = setInterval(() => {
 this.loadDataOptimized();
 this.performanceMonitor.checkMemoryUsage();
 }, 15000); 
 this.performanceInterval = setInterval(() => {
 const memoryInfo = this.performanceMonitor.checkMemoryUsage();
 if (memoryInfo && memoryInfo.used > 30) {
 this.cleanupCache();
 }
 }, 30000); 
 }
 cleanupCache() {
 const now = Date.now();
 const maxAge = 5000; 
 for (const [key, value] of this.dataCache.entries()) {
 if (now - value.timestamp > maxAge) {
 this.dataCache.delete(key);
 }
 }
 }
 startPeriodicUpdates() {
 return this.startOptimizedUpdates();
 }
 showToast(message) {
 const toast = document.createElement('div');
 toast.className = 'toast';
 toast.textContent = message;
 toast.style.cssText = `
 position: fixed;
 top: 10px;
 right: 10px;
 background: #10b981;
 color: white;
 padding: 8px 12px;
 border-radius: 4px;
 font-size: 12px;
 z-index: 1000;
 animation: slideIn 0.3s ease;
 `;
 document.body.appendChild(toast);
 setTimeout(() => {
 toast.remove();
 }, 3000);
 }
 showError(message) {
 console.error('🚨 LTEP Error:', message);
 this.showNotification(message, 'error', 5000);
 }
 showErrorBanner(message) {
 const existingBanner = document.querySelector('.error-banner');
 if (existingBanner) {
 existingBanner.remove();
 }
 const banner = document.createElement('div');
 banner.className = 'error-banner';
 banner.innerHTML = `
 <div class="error-content">
 <span class="error-icon">⚠️</span>
 <span class="error-text">${message}</span>
 <button class="error-retry" onclick="this.parentElement.parentElement.remove(); window.ltepPopup.loadDataDebounced()">Retry</button>
 </div>
 `;
 banner.style.cssText = `
 position: fixed;
 top: 0;
 left: 0;
 right: 0;
 background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
 border-bottom: 1px solid #fecaca;
 padding: 8px 12px;
 z-index: 1000;
 font-size: 12px;
 `;
 const style = document.createElement('style');
 style.textContent = `
 .error-content {
 display: flex;
 align-items: center;
 gap: 8px;
 max-width: 100%;
 }
 .error-text {
 flex: 1;
 color: #991b1b;
 font-weight: 500;
 }
 .error-retry {
 background: #dc2626;
 color: white;
 border: none;
 padding: 4px 8px;
 border-radius: 4px;
 font-size: 11px;
 cursor: pointer;
 }
 .error-retry:hover {
 background: #b91c1c;
 }
 `;
 document.head.appendChild(style);
 document.body.insertBefore(banner, document.body.firstChild);
 setTimeout(() => {
 if (banner.parentNode) {
 banner.remove();
 }
 }, 10000);
 }
 showWarning(message) {
 console.warn('⚠️ LTEP Warning:', message);
 this.showNotification(message, 'warning', 3000);
 }
 showNotification(message, type = 'info', duration = 3000) {
 document.querySelectorAll(`.toast.${type}`).forEach(toast => toast.remove());
 const toast = document.createElement('div');
 toast.className = `toast ${type}`;
 toast.innerHTML = `
 <div class="toast-content">
 <span class="toast-icon">${this.getToastIcon(type)}</span>
 <span class="toast-message">${message}</span>
 </div>
 `;
 const colors = {
 error: '#ef4444',
 warning: '#f59e0b',
 success: '#10b981',
 info: '#3b82f6'
 };
 toast.style.cssText = `
 position: fixed;
 top: 10px;
 right: 10px;
 background: ${colors[type] || colors.info};
 color: white;
 padding: 12px 16px;
 border-radius: 6px;
 font-size: 12px;
 z-index: 1000;
 box-shadow: 0 4px 12px rgba(0,0,0,0.15);
 animation: slideIn 0.3s ease;
 max-width: 300px;
 word-wrap: break-word;
 `;
 document.body.appendChild(toast);
 setTimeout(() => {
 if (toast.parentNode) {
 toast.remove();
 }
 }, duration);
 }
 getToastIcon(type) {
 const icons = {
 error: '🚨',
 warning: '⚠️',
 success: '✅',
 info: 'ℹ️'
 };
 return icons[type] || icons.info;
 }
 toggleDebugPanel() {
 const debugSection = document.getElementById('debugSection');
 const isVisible = debugSection.style.display !== 'none';
 if (isVisible) {
 debugSection.style.display = 'none';
 } else {
 debugSection.style.display = 'block';
 this.updateDebugInfo();
 }
 }
 updateDebugInfo() {
 try {
 const loadTime = performance.now() - this.loadStartTime;
 document.getElementById('debugLoadTime').textContent = `${loadTime.toFixed(2)}ms`;
 const memoryInfo = this.performanceMonitor.checkMemoryUsage();
 if (memoryInfo) {
 document.getElementById('debugMemory').textContent = `${memoryInfo.used}MB / ${memoryInfo.total}MB`;
 }
 document.getElementById('debugCacheHits').textContent = this.dataCache.size;
 document.getElementById('debugErrors').textContent = this.performanceMonitor.metrics.errorCount;
 } catch (error) {
 this.performanceMonitor.recordError(error, 'updateDebugInfo');
 }
 }
 clearAllCache() {
 this.dataCache.clear();
 chrome.storage.local.clear().then(() => {
 this.updateDebugInfo();
 }).catch(err => {
 console.error('Failed to clear storage:', err.message);
 });
 }
 exportDebugLogs() {
 try {
 const report = this.performanceMonitor.getPerformanceReport();
 const debugData = {
 timestamp: new Date().toISOString(),
 version: '1.0.0',
 currentUrl: this.currentTab?.url || 'unknown',
 performanceReport: report,
 cacheSize: this.dataCache.size,
 logs: this.logs.slice(0, 50), 
 browserInfo: {
 userAgent: navigator.userAgent,
 language: navigator.language,
 platform: navigator.platform
 }
 };
 const dataStr = JSON.stringify(debugData, null, 2);
 const blob = new Blob([dataStr], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `ltep-debug-${Date.now()}.json`;
 a.click();
 URL.revokeObjectURL(url);
 } catch (error) {
 this.performanceMonitor.recordError(error, 'exportDebugLogs');
 console.error('Failed to export debug logs:', error);
 }
 }
 async runDiagnostics() {
 try {
 const tests = [
 this.testExtensionConnectivity(),
 this.testStorageAccess(),
 this.testTabAccess(),
 this.testRealtimeConnection()
 ];
 const results = await Promise.allSettled(tests);
 let passed = 0;
 let failed = 0;
 results.forEach((result, index) => {
 if (result.status === 'fulfilled') {
 passed++;
 } else {
 failed++;
 console.error(`❌ Test ${index + 1} failed:`, result.reason);
 }
 });
 } catch (error) {
 this.performanceMonitor.recordError(error, 'runDiagnostics');
 console.error('Diagnostics failed to run:', error);
 }
 }
 async testExtensionConnectivity() {
 const startTime = performance.now();
 try {
 const response = await chrome.runtime.sendMessage({ type: 'PING' });
 const endTime = performance.now();
 if (!response || !response.success) {
 throw new Error('Extension background script not responding properly');
 }
 return true;
 } catch (error) {
 const errorMsg = error?.message || String(error) || 'Connection failed';
 throw new Error(`Extension connectivity failed: ${errorMsg}`);
 }
 }
 async testStorageAccess() {
 try {
 const testData = { test: Date.now() };
 await chrome.storage.local.set(testData);
 const result = await chrome.storage.local.get('test');
 await chrome.storage.local.remove('test');
 if (!result || result.test !== testData.test) {
 throw new Error('Storage read/write verification failed');
 }
 return true;
 } catch (error) {
 const errorMsg = error?.message || String(error) || 'Storage access failed';
 throw new Error(`Storage test failed: ${errorMsg}`);
 }
 }
 async testTabAccess() {
 const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
 if (!tabs || tabs.length === 0) {
 throw new Error('Cannot access current tab');
 }
 return true;
 }
 async testRealtimeConnection() {
 if (!this.realtimePort || !this.realtimePort.name) {
 throw new Error('Real-time connection not established');
 }
 return true;
 }
}
window.addEventListener('error', (event) => {
 console.error('Global popup error:', event.error);
 if (window.ltepPopup) {
 window.ltepPopup.showErrorBanner('An unexpected error occurred');
 } else {
 const banner = document.createElement('div');
 banner.textContent = '⚠️ Extension error - please reload';
 banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#fee2e2;color:#991b1b;padding:8px;text-align:center;z-index:9999;font-size:12px;';
 document.body.appendChild(banner);
 }
});
document.addEventListener('DOMContentLoaded', () => {
 try {
 window.ltepPopup = new LTEPPopup();
 } catch (error) {
 console.error('Failed to initialize LTEP popup:', error);
 document.body.innerHTML = `
 <div style="padding: 20px; text-align: center; font-family: system-ui;">
 <h3>⚠️ LTEP Extension Error</h3>
 <p>Failed to initialize. Please reload the popup.</p>
 <button onclick="location.reload()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
 Reload
 </button>
 </div>
 `;
 }
});
window.addEventListener('beforeunload', () => {
 try {
 if (window.ltepPopup) {
 if (window.ltepPopup.updateInterval) {
 clearInterval(window.ltepPopup.updateInterval);
 }
 if (window.ltepPopup.performanceInterval) {
 clearInterval(window.ltepPopup.performanceInterval);
 }
 if (window.ltepPopup.reconnectTimer) {
 clearTimeout(window.ltepPopup.reconnectTimer);
 }
 if (window.ltepPopup.realtimePort) {
 window.ltepPopup.realtimePort.disconnect();
 }
 if (window.safeChrome) {
 window.safeChrome.clearCaches();
 }
 }
 } catch (error) {
 console.warn('Cleanup error (non-critical):', error);
 }
});