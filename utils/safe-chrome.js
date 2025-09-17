class SafeChrome {
 constructor() {
 this.defaultTimeout = 800;
 this.tabCache = new Map();
 this.metricsCache = new Map();
 }
 safe(promise, timeoutMs = this.defaultTimeout) {
 return Promise.race([
 promise,
 new Promise((_, reject) => 
 setTimeout(() => reject(new Error('timeout')), timeoutMs)
 )
 ]).catch(error => ({ 
 error: error.message || String(error),
 isTimeout: error.message === 'timeout'
 }));
 }
 async getActiveTab(forceRefresh = false) {
 const cacheKey = 'activeTab';
 const cacheAge = 2000; 
 if (!forceRefresh && this.tabCache.has(cacheKey)) {
 const cached = this.tabCache.get(cacheKey);
 if (Date.now() - cached.timestamp < cacheAge) {
 return cached.tab;
 }
 }
 try {
 const result = await this.safe(
 chrome.tabs.query({ active: true, lastFocusedWindow: true }),
 1000
 );
 if (result.error) {
 throw new Error(`Tab query failed: ${result.error}`);
 }
 const [tab] = result;
 if (!tab) {
 throw new Error('No active tab found');
 }
 this.tabCache.set(cacheKey, {
 tab,
 timestamp: Date.now()
 });
 return tab;
 } catch (error) {
 console.error('getActiveTab failed:', error);
 throw error;
 }
 }
 async getTabById(tabId) {
 if (!tabId || typeof tabId !== 'number') {
 throw new Error('Invalid tab ID provided');
 }
 try {
 const result = await this.safe(chrome.tabs.get(tabId), 500);
 if (result.error) {
 if (result.error.includes('No tab with id')) {
 console.warn(`Tab ${tabId} not found, falling back to active tab`);
 return this.getActiveTab();
 }
 throw new Error(result.error);
 }
 return result;
 } catch (error) {
 console.error(`getTabById(${tabId}) failed:`, error);
 throw error;
 }
 }
 debounce(fn, delay = 150) {
 let timeoutId;
 return (...args) => {
 clearTimeout(timeoutId);
 timeoutId = setTimeout(() => fn.apply(this, args), delay);
 };
 }
 async getCookiesSafe(url) {
 if (!url || !url.startsWith('http')) {
 return [];
 }
 try {
 const result = await this.safe(chrome.cookies.getAll({ url }), 1000);
 if (result.error) {
 console.warn('Cookies query failed:', result.error);
 return [];
 }
 return result || [];
 } catch (error) {
 console.error('getCookiesSafe failed:', error);
 return [];
 }
 }
 async getDynamicRulesSafe() {
 try {
 const result = await this.safe(
 chrome.declarativeNetRequest.getDynamicRules(),
 1000
 );
 if (result.error) {
 console.warn('Dynamic rules query failed:', result.error);
 return [];
 }
 return result || [];
 } catch (error) {
 console.error('getDynamicRulesSafe failed:', error);
 return [];
 }
 }
 async sendMessageSafe(message, timeout = 1000) {
 try {
 const result = await this.safe(chrome.runtime.sendMessage(message), timeout);
 if (result.error) {
 return { success: false, error: result.error, isTimeout: result.isTimeout };
 }
 return result || { success: false, error: 'No response' };
 } catch (error) {
 console.error('sendMessageSafe failed:', error);
 return { success: false, error: error.message };
 }
 }
 clearCaches() {
 this.tabCache.clear();
 this.metricsCache.clear();
 }
 getCacheStats() {
 return {
 tabCache: this.tabCache.size,
 metricsCache: this.metricsCache.size
 };
 }
}
if (typeof window !== 'undefined') {
 window.SafeChrome = SafeChrome;
 window.safeChrome = new SafeChrome();
}
if (typeof module !== 'undefined' && module.exports) {
 module.exports = SafeChrome;
}