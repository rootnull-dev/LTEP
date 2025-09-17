class ServiceWorkerManager {
 constructor() {
 this.isReady = false;
 this.maxRetries = 5;
 this.baseDelay = 300;
 }
 async ensureSWReady(retries = this.maxRetries) {
 for (let i = 0; i < retries; i++) {
 try {
 const response = await chrome.runtime.sendMessage({ 
 type: 'PING',
 timestamp: Date.now()
 });
 if (response && response.success) {
 this.isReady = true;
 return true;
 }
 } catch (error) {
 console.warn(`SW ping attempt ${i + 1}/${retries} failed:`, error.message);
 }
 const delay = this.baseDelay * (i + 1);
 await this.sleep(delay);
 }
 console.error('🚨 Service Worker not ready after all retries');
 this.isReady = false;
 return false;
 }
 async safeStorageOperation(operation, data) {
 try {
 if (!this.isReady) {
 await this.ensureSWReady();
 }
 if (operation === 'get') {
 const result = await chrome.storage.local.get(data);
 return this.applyDefaults(result, data);
 } else if (operation === 'set') {
 await chrome.storage.local.set(data);
 return { success: true };
 }
 } catch (error) {
 console.error(`Storage ${operation} failed:`, error);
 if (operation === 'get') {
 return this.applyDefaults({}, data);
 }
 return { success: false, error: error.message };
 }
 }
 applyDefaults(result, keys) {
 const defaults = {
 stats: {
 totalBlocked: 0,
 cookiesBlocked: 0,
 trackersBlocked: 0,
 fingerprintingBlocked: 0
 },
 siteSettings: {},
 theme: 'light',
 showingSiteStats: true,
 settings: {
 protectionLevel: 'balanced',
 blockCookies: true,
 blockFingerprinting: true,
 showNotifications: false,
 allowTelemetry: false,
 debugMode: false,
 safeMode: false
 }
 };
 if (typeof keys === 'string') {
 return { [keys]: result[keys] || defaults[keys] || null };
 } else if (Array.isArray(keys)) {
 const safeResult = {};
 keys.forEach(key => {
 safeResult[key] = result[key] || defaults[key] || null;
 });
 return safeResult;
 } else if (typeof keys === 'object') {
 return { ...keys, ...result };
 }
 return result;
 }
 async safeMessage(message, options = {}) {
 const { retries = 3, timeout = 5000 } = options;
 for (let i = 0; i < retries; i++) {
 try {
 if (!this.isReady && message.type !== 'PING') {
 await this.ensureSWReady();
 }
 const response = await Promise.race([
 chrome.runtime.sendMessage(message),
 this.timeoutPromise(timeout)
 ]);
 if (response) {
 return response;
 }
 } catch (error) {
 console.warn(`Message attempt ${i + 1}/${retries} failed:`, error.message);
 if (i === retries - 1) {
 return {
 success: false,
 error: error.message || 'Communication failed',
 isTimeout: error.message === 'Operation timed out'
 };
 }
 await this.sleep(200 * (i + 1));
 }
 }
 return {
 success: false,
 error: 'Service Worker not responding',
 isTimeout: false
 };
 }
 async safeRulesOperation(operation, data) {
 try {
 if (!this.isReady) {
 await this.ensureSWReady();
 }
 if (operation === 'get') {
 const rules = await chrome.declarativeNetRequest.getDynamicRules();
 return rules || [];
 } else if (operation === 'update') {
 await chrome.declarativeNetRequest.updateDynamicRules(data);
 return { success: true };
 }
 } catch (error) {
 console.error(`Rules ${operation} failed:`, error);
 if (operation === 'get') {
 return []; 
 }
 return { success: false, error: error.message };
 }
 }
 sleep(ms) {
 return new Promise(resolve => setTimeout(resolve, ms));
 }
 timeoutPromise(ms) {
 return new Promise((_, reject) => {
 setTimeout(() => reject(new Error('Operation timed out')), ms);
 });
 }
 getReadyStatus() {
 return this.isReady;
 }
 resetStatus() {
 this.isReady = false;
 }
}
if (typeof window !== 'undefined') {
 window.ServiceWorkerManager = ServiceWorkerManager;
 window.swManager = new ServiceWorkerManager();
}
if (typeof module !== 'undefined' && module.exports) {
 module.exports = ServiceWorkerManager;
}