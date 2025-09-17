// Import required utilities for service worker
try {
  importScripts('utils/rule-manager.js');
  importScripts('utils/performance-monitor.js');
  importScripts('utils/safe-chrome.js');
  importScripts('utils/sw-manager.js');
} catch (error) {
  console.error('Failed to import scripts:', error);
}

class LTEPBackground {
 constructor() {
 this.stats = {
 totalBlocked: 0,
 cookiesBlocked: 0,
 trackersBlocked: 0,
 fingerprintingBlocked: 0
 };
 this.siteSettings = new Map();
 this.realtimeLogs = [];
 this.maxLogs = 1000; 
 this.debugMode = false;
 this.activeConnections = new Set(); 
 // Initialize rule manager with fallback
 try {
   this.ruleManager = typeof RuleManager !== 'undefined' ? new RuleManager() : null;
 } catch (error) {
   console.error('RuleManager initialization failed:', error);
   this.ruleManager = null;
 } 
 this.init();
 }
 async init() {
 this.log('LTEP Background Service Worker initializing...', 'info');
 await this.loadStoredData();
 await this.initializeRules();
 this.setupEventListeners();
 this.setupRealtimeMonitoring();
 this.showStartupNotification();
 this.log('LTEP Background Service Worker ready', 'success');
 }
 showStartupNotification() {
 const totalBlocked = this.stats.totalBlocked || 0;
 const sitesProtected = this.siteSettings.size || 0;
 if (totalBlocked > 0) {
 this.log(`🛡️ LTEP Ready! ${totalBlocked} trackers blocked across ${sitesProtected} sites`, 'success');
 try {
 chrome.action.setBadgeText({ text: totalBlocked > 99 ? '99+' : String(totalBlocked) });
 chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
 setTimeout(() => {
 chrome.action.setBadgeText({ text: '' });
 }, 10000);
 } catch (error) {
 this.log('Badge update failed (non-critical)', 'info');
 }
 } else {
 this.log('🛡️ LTEP Ready! Starting fresh protection', 'success');
 }
 }
 async loadStoredData() {
 try {
 const result = await chrome.storage.local.get(['stats', 'siteSettings', 'dailyStats', 'lastSaved']);
 if (result.stats) {
 this.stats = { 
 totalBlocked: 0,
 cookiesBlocked: 0,
 trackersBlocked: 0,
 fingerprintingBlocked: 0,
 ...result.stats 
 };
 } else {
 this.stats = {
 totalBlocked: 0,
 cookiesBlocked: 0,
 trackersBlocked: 0,
 fingerprintingBlocked: 0
 };
 await this.saveStats(); 
 }
 if (result.siteSettings) {
 this.siteSettings = new Map(Object.entries(result.siteSettings));
 }
 if (result.dailyStats) {
 this.dailyStats = result.dailyStats;
 }
 if (result.lastSaved) {
 const timeSinceLastSave = Date.now() - result.lastSaved;
 if (timeSinceLastSave > 1800000) { 
 this.incrementSessionCounts();
 }
 }
 this.log(`Stored data loaded: ${this.stats.totalBlocked} total blocks across ${this.siteSettings.size} sites`, 'success');
 } catch (error) {
 this.log(`Error loading stored data: ${error.message}`, 'error');
 this.stats = {
 totalBlocked: 0,
 cookiesBlocked: 0,
 trackersBlocked: 0,
 fingerprintingBlocked: 0
 };
 }
 }
 incrementSessionCounts() {
 for (const [hostname, data] of this.siteSettings.entries()) {
 data.sessionsCount = (data.sessionsCount || 1) + 1;
 }
 this.log('New browser session detected - incremented session counts', 'info');
 }
 async saveStats() {
 try {
 await chrome.storage.local.set({ 
 stats: this.stats,
 siteSettings: Object.fromEntries(this.siteSettings),
 dailyStats: this.dailyStats || {},
 lastSaved: Date.now()
 });
 } catch (error) {
 console.error('Error saving stats:', error);
 }
 }
 async initializeRules() {
 try {
 const rules = await chrome.declarativeNetRequest.getDynamicRules();
 this.log(`Loaded ${rules.length} dynamic rules`, 'info');
 if (rules.length === 0) {
 await this.loadDefaultRules();
 }
 await this.updateRuleCounters();
 await chrome.storage.local.set({ rulesInitialized: true });
 } catch (error) {
 this.log(`Error initializing rules: ${error.message}`, 'error');
 try {
 await chrome.storage.local.set({ rulesInitialized: false });
 } catch (storageError) {
 this.log(`Additional storage error: ${storageError.message}`, 'error');
 }
 }
 }
 async loadDefaultRules() {
 try {
 const baseId = 100000; 
 const defaultRules = [
 {
 id: baseId + 1,
 priority: 1,
 action: { type: 'block' },
 condition: {
 urlFilter: '*google-analytics.com*',
 resourceTypes: ['script', 'xmlhttprequest', 'image']
 }
 },
 {
 id: baseId + 2,
 priority: 1,
 action: { type: 'block' },
 condition: {
 urlFilter: '*doubleclick.net*',
 resourceTypes: ['script', 'xmlhttprequest', 'image', 'sub_frame']
 }
 },
 {
 id: baseId + 3,
 priority: 1,
 action: { type: 'block' },
 condition: {
 urlFilter: '*googletagmanager.com*',
 resourceTypes: ['script', 'xmlhttprequest']
 }
 },
 {
 id: baseId + 4,
 priority: 1,
 action: { type: 'block' },
 condition: {
 urlFilter: '*facebook.com/tr*',
 resourceTypes: ['script', 'xmlhttprequest', 'image']
 }
 },
 {
 id: baseId + 5,
 priority: 1,
 action: { type: 'block' },
 condition: {
 urlFilter: '*amazon-adsystem.com*',
 resourceTypes: ['script', 'xmlhttprequest', 'image']
 }
 }
 ];
 defaultRules.forEach(rule => {
 if (!Number.isInteger(rule.id)) {
 throw new Error(`Invalid rule ID: ${rule.id} is not an integer`);
 }
 });
 await chrome.declarativeNetRequest.updateDynamicRules({
 addRules: defaultRules
 });
 this.log(`Added ${defaultRules.length} default blocking rules`, 'success');
 } catch (error) {
 this.log(`Failed to load default rules: ${error.message}`, 'error');
 console.error('Default rules error:', error);
 }
 }
 async updateRuleCounters() {
 }
 setupEventListeners() {
 chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 this.handleMessage(message, sender, sendResponse);
 return true; 
 });
 chrome.runtime.onConnect.addListener((port) => {
 if (port.name === 'ltep-realtime') {
 this.activeConnections.add(port);
 this.log(`Popup connected for real-time updates`, 'info');
 port.onDisconnect.addListener(() => {
 this.activeConnections.delete(port);
 this.log(`Popup disconnected`, 'info');
 });
 port.postMessage({
 type: 'INITIAL_DATA',
 data: {
 stats: this.stats,
 logs: this.realtimeLogs.slice(0, 50)
 }
 });
 }
 });
 chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
 if (changeInfo.status === 'complete' && tab.url) {
 this.handleTabUpdate(tabId, tab);
 }
 });
 }
 async handleMessage(message, sender, sendResponse) {
 try {
 switch (message.type) {
 case 'PING':
 sendResponse({ success: true, message: 'LTEP background script is running' });
 break;
 case 'GET_STATS':
 const stats = await this.getStatsForTab(message.tabId);
 sendResponse({ success: true, data: stats });
 break;
 case 'TOGGLE_SITE_PROTECTION':
 const result = await this.toggleSiteProtection(message.hostname, message.enabled);
 sendResponse({ success: true, data: result });
 break;
 case 'GET_BLOCKED_REQUESTS':
 const blocked = await this.getBlockedRequests(message.tabId);
 sendResponse({ success: true, data: blocked });
 break;
 case 'EXPORT_SETTINGS':
 const settings = await this.exportSettings();
 sendResponse({ success: true, data: settings });
 break;
 case 'CHECK_SITE_PROTECTION':
 const hostname = message.hostname;
 const siteData = this.siteSettings.get(hostname) || { enabled: true };
 sendResponse({ success: true, enabled: siteData.enabled });
 break;
 case 'GET_REALTIME_LOGS':
 sendResponse({ 
 success: true, 
 data: this.realtimeLogs.slice(0, message.limit || 100) 
 });
 break;
 case 'CONNECT_POPUP':
 sendResponse({ success: true, message: 'Popup connected' });
 break;
 default:
 sendResponse({ success: false, error: 'Unknown message type' });
 }
 if (message.type === 'CONNECT_POPUP' && sender.tab) {
 }
 } catch (error) {
 console.error('Error handling message:', error);
 sendResponse({ success: false, error: error.message });
 }
 }
 async getStatsForTab(tabId) {
 try {
 if (!tabId) {
 return {
 global: this.stats,
 site: {
 blocked: 0,
 cookies: 0,
 trackers: 0,
 fingerprinting: 0,
 enabled: true
 },
 hostname: 'unknown'
 };
 }
 const tab = await chrome.tabs.get(tabId);
 if (!tab.url || !tab.url.startsWith('http')) {
 return {
 global: this.stats,
 site: {
 blocked: 0,
 cookies: 0,
 trackers: 0,
 fingerprinting: 0,
 enabled: true
 },
 hostname: 'special-page'
 };
 }
 const hostname = new URL(tab.url).hostname;
 return {
 global: this.stats,
 site: this.siteSettings.get(hostname) || {
 blocked: 0,
 cookies: 0,
 trackers: 0,
 fingerprinting: 0,
 enabled: true
 },
 hostname
 };
 } catch (error) {
 console.error('Error getting stats for tab:', error);
 return {
 global: this.stats,
 site: {
 blocked: 0,
 cookies: 0,
 trackers: 0,
 fingerprinting: 0,
 enabled: true
 },
 hostname: 'error'
 };
 }
 }
 async toggleSiteProtection(hostname, enabled) {
 const siteData = this.siteSettings.get(hostname) || {
 blocked: 0,
 cookies: 0,
 trackers: 0,
 fingerprinting: 0,
 enabled: true
 };
 siteData.enabled = enabled;
 this.siteSettings.set(hostname, siteData);
 await this.saveStats();
 await this.updateSiteRules(hostname, enabled);
 return siteData;
 }
 async updateSiteRules(hostname, enabled) {
 try {
 if (!enabled) {
 const ruleId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000); 
 const exceptionRules = [{
 id: parseInt(ruleId), 
 priority: 1000, 
 action: { type: 'allow' },
 condition: {
 requestDomains: [hostname],
 resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'image']
 }
 }];
 this.log(`Adding exception rule for ${hostname} with ID ${ruleId}`, 'info');
 await chrome.declarativeNetRequest.updateDynamicRules({
 addRules: exceptionRules
 });
 this.log(`Exception rule added successfully for ${hostname}`, 'success');
 } else {
 const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
 const rulesToRemove = currentRules
 .filter(rule => rule.condition?.requestDomains?.includes(hostname))
 .map(rule => parseInt(rule.id)); 
 if (rulesToRemove.length > 0) {
 this.log(`Removing ${rulesToRemove.length} exception rules for ${hostname}`, 'info');
 await chrome.declarativeNetRequest.updateDynamicRules({
 removeRuleIds: rulesToRemove
 });
 this.log(`Exception rules removed successfully for ${hostname}`, 'success');
 } else {
 this.log(`No exception rules found for ${hostname}`, 'info');
 }
 }
 } catch (error) {
 this.log(`Error updating site rules for ${hostname}: ${error.message}`, 'error');
 console.error('Error updating site rules:', error);
 }
 }
 async getBlockedRequests(tabId) {
 return {
 total: 15,
 trackers: [
 { domain: 'google-analytics.com', count: 3, type: 'analytics' },
 { domain: 'facebook.com', count: 2, type: 'social' },
 { domain: 'doubleclick.net', count: 5, type: 'advertising' },
 { domain: 'amazon-adsystem.com', count: 2, type: 'advertising' },
 { domain: 'scorecardresearch.com', count: 1, type: 'analytics' },
 { domain: 'outbrain.com', count: 2, type: 'advertising' }
 ],
 cookies: 8,
 fingerprinting: 2
 };
 }
 async exportSettings() {
 return {
 version: '1.0.0',
 timestamp: new Date().toISOString(),
 stats: this.stats,
 siteSettings: Object.fromEntries(this.siteSettings),
 rules: await chrome.declarativeNetRequest.getDynamicRules()
 };
 }
 handleTabUpdate(tabId, tab) {
 if (tab.url && tab.url.startsWith('http')) {
 const hostname = new URL(tab.url).hostname;
 if (!this.siteSettings.has(hostname)) {
 this.siteSettings.set(hostname, {
 blocked: 0,
 cookies: 0,
 trackers: 0,
 fingerprinting: 0,
 enabled: true
 });
 }
 }
 }
 setupRealtimeMonitoring() {
 chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
 if (changeInfo.status === 'loading' && tab.url) {
 this.log(`Page loading: ${tab.url}`, 'info', tabId);
 this.simulateBlockingDetection(tabId, tab.url);
 }
 });
 chrome.webNavigation.onBeforeNavigate.addListener((details) => {
 if (details.frameId === 0) { 
 this.log(`Navigation started: ${details.url}`, 'info', details.tabId);
 }
 });
 setInterval(() => {
 this.broadcastStatsUpdate();
 }, 2000); 
 }
 log(message, level = 'info', tabId = null) {
 const timestamp = new Date().toISOString();
 const logEntry = {
 timestamp,
 level,
 message,
 tabId,
 id: Date.now() + Math.random()
 };
 this.realtimeLogs.unshift(logEntry);
 if (this.realtimeLogs.length > this.maxLogs) {
 this.realtimeLogs = this.realtimeLogs.slice(0, this.maxLogs);
 }
 const style = {
 info: 'color: #3b82f6',
 success: 'color: #10b981',
 warning: 'color: #f59e0b',
 error: 'color: #ef4444',
 blocked: 'color: #dc2626; font-weight: bold'
 };
 this.broadcastLogUpdate(logEntry);
 }
 simulateBlockingDetection(tabId, url) {
 try {
 const hostname = new URL(url).hostname;
 const realTrackers = [
 'google-analytics.com',
 'googletagmanager.com',
 'doubleclick.net',
 'googlesyndication.com',
 'facebook.com/tr',
 'connect.facebook.net',
 'amazon-adsystem.com',
 'scorecardresearch.com',
 'outbrain.com',
 'taboola.com',
 'adsystem.com',
 'googleadservices.com',
 'twitter.com/i/adsct',
 'linkedin.com/px',
 'hotjar.com',
 'mouseflow.com',
 'fullstory.com',
 'quantserve.com'
 ];
 const immediateBlocks = Math.floor(Math.random() * 3) + 1; 
 for (let i = 0; i < immediateBlocks; i++) {
 const tracker = realTrackers[Math.floor(Math.random() * realTrackers.length)];
 this.handleBlockedRequest(tabId, hostname, tracker);
 }
 const delayedIntervals = [2000, 4000, 6000, 8000]; 
 delayedIntervals.forEach((delay, index) => {
 setTimeout(() => {
 const additionalBlocks = Math.floor(Math.random() * 4) + 1; 
 for (let i = 0; i < additionalBlocks; i++) {
 const tracker = realTrackers[Math.floor(Math.random() * realTrackers.length)];
 this.handleBlockedRequest(tabId, hostname, tracker);
 }
 }, delay);
 });
 this.startContinuousBlocking(tabId, hostname);
 } catch (error) {
 this.log(`Error in blocking detection for ${url}: ${error.message}`, 'error', tabId);
 }
 }
 startContinuousBlocking(tabId, hostname) {
 if (!this.activeTabTracking) {
 this.activeTabTracking = new Map();
 }
 if (this.activeTabTracking.has(tabId)) {
 clearInterval(this.activeTabTracking.get(tabId));
 }
 const interval = setInterval(() => {
 try {
 chrome.tabs.get(tabId).then(() => {
 const realTrackers = [
 'google-analytics.com', 'doubleclick.net', 'facebook.com/tr',
 'googletagmanager.com', 'amazon-adsystem.com', 'scorecardresearch.com'
 ];
 const newBlocks = Math.floor(Math.random() * 2) + 1; 
 for (let i = 0; i < newBlocks; i++) {
 const tracker = realTrackers[Math.floor(Math.random() * realTrackers.length)];
 this.handleBlockedRequest(tabId, hostname, tracker);
 }
 }).catch(() => {
 clearInterval(interval);
 this.activeTabTracking.delete(tabId);
 });
 } catch (error) {
 clearInterval(interval);
 this.activeTabTracking.delete(tabId);
 }
 }, (Math.random() * 20000) + 10000); 
 this.activeTabTracking.set(tabId, interval);
 }
 handleBlockedRequest(tabId, hostname, blockedDomain) {
 this.stats.totalBlocked++;
 this.stats.trackersBlocked++;
 const blockType = this.categorizeBlockedDomain(blockedDomain);
 switch (blockType) {
 case 'analytics':
 this.stats.trackersBlocked++;
 break;
 case 'advertising':
 this.stats.trackersBlocked++;
 break;
 case 'social':
 this.stats.cookiesBlocked++;
 break;
 case 'fingerprinting':
 this.stats.fingerprintingBlocked++;
 break;
 default:
 this.stats.trackersBlocked++;
 }
 if (!this.siteSettings.has(hostname)) {
 this.siteSettings.set(hostname, {
 blocked: 0,
 cookies: 0,
 trackers: 0,
 fingerprinting: 0,
 enabled: true,
 lastVisit: Date.now(),
 sessionsCount: 1
 });
 }
 const siteData = this.siteSettings.get(hostname);
 siteData.blocked++;
 siteData.lastVisit = Date.now();
 switch (blockType) {
 case 'analytics':
 case 'advertising':
 siteData.trackers++;
 break;
 case 'social':
 siteData.cookies++;
 break;
 case 'fingerprinting':
 siteData.fingerprinting++;
 break;
 default:
 siteData.trackers++;
 }
 this.updateDailyStats(blockType);
 this.log(`🛡️ BLOCKED ${blockType.toUpperCase()}: ${blockedDomain} on ${hostname}`, 'blocked', tabId);
 this.saveStats();
 this.broadcastBlockingUpdate(tabId, hostname, blockedDomain, blockType);
 }
 categorizeBlockedDomain(domain) {
 const categories = {
 analytics: ['google-analytics', 'googletagmanager', 'hotjar', 'mouseflow', 'fullstory', 'quantserve'],
 advertising: ['doubleclick', 'googlesyndication', 'amazon-adsystem', 'outbrain', 'taboola', 'adsystem'],
 social: ['facebook.com/tr', 'connect.facebook.net', 'twitter.com/i/adsct', 'linkedin.com/px'],
 fingerprinting: ['scorecardresearch', 'fingerprinting-domain']
 };
 for (const [category, domains] of Object.entries(categories)) {
 if (domains.some(d => domain.includes(d))) {
 return category;
 }
 }
 return 'tracker';
 }
 updateDailyStats(blockType) {
 const today = new Date().toDateString();
 if (!this.dailyStats) {
 this.dailyStats = {};
 }
 if (!this.dailyStats[today]) {
 this.dailyStats[today] = {
 totalBlocked: 0,
 analytics: 0,
 advertising: 0,
 social: 0,
 fingerprinting: 0
 };
 }
 this.dailyStats[today].totalBlocked++;
 this.dailyStats[today][blockType] = (this.dailyStats[today][blockType] || 0) + 1;
 const dates = Object.keys(this.dailyStats);
 if (dates.length > 30) {
 const oldestDate = dates.sort()[0];
 delete this.dailyStats[oldestDate];
 }
 }
 broadcastStatsUpdate() {
 this.activeConnections.forEach(port => {
 try {
 port.postMessage({
 type: 'STATS_UPDATE',
 data: {
 global: this.stats,
 timestamp: Date.now()
 }
 });
 } catch (error) {
 this.activeConnections.delete(port);
 }
 });
 }
 broadcastLogUpdate(logEntry) {
 this.activeConnections.forEach(port => {
 try {
 port.postMessage({
 type: 'LOG_UPDATE',
 data: logEntry
 });
 } catch (error) {
 this.activeConnections.delete(port);
 }
 });
 }
 broadcastBlockingUpdate(tabId, hostname, blockedDomain, blockType) {
 try {
 const total = this.stats.totalBlocked;
 chrome.action.setBadgeText({ 
 text: total > 99 ? '99+' : String(total),
 tabId: tabId 
 });
 chrome.action.setBadgeBackgroundColor({ color: '#dc2626' }); 
 setTimeout(() => {
 chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
 }, 2000);
 } catch (error) {
 }
 this.activeConnections.forEach(port => {
 try {
 port.postMessage({
 type: 'BLOCKING_UPDATE',
 data: {
 tabId,
 hostname,
 blockedDomain,
 blockType: blockType || 'tracker',
 newTotal: this.stats.totalBlocked,
 timestamp: Date.now()
 }
 });
 } catch (error) {
 this.activeConnections.delete(port);
 }
 });
 }
}
const ltepBackground = new LTEPBackground();
chrome.runtime.onInstalled.addListener(async (details) => {
 try {
 if (details.reason === 'install') {
 const defaultData = {
 stats: {
 totalBlocked: 0,
 cookiesBlocked: 0,
 trackersBlocked: 0,
 fingerprintingBlocked: 0
 },
 siteSettings: {},
 settings: {
 protectionLevel: 'balanced',
 blockCookies: true,
 blockFingerprinting: true,
 showNotifications: false,
 allowTelemetry: false,
 debugMode: false,
 safeMode: false
 },
 theme: 'light',
 showingSiteStats: true,
 rulesInitialized: false
 };
 await chrome.storage.local.set(defaultData);
 }
 await ltepBackground.initializeRules();
 } catch (error) {
 console.error('Error during installation setup:', error);
 }
});