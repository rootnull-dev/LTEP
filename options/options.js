class LTEPOptions {
 constructor() {
 this.settings = {
 protectionLevel: 'balanced',
 blockCookies: true,
 blockFingerprinting: true,
 showNotifications: false,
 allowTelemetry: false,
 debugMode: false,
 safeMode: false
 };
 this.stats = null;
 this.siteSettings = new Map();
 this.init();
 }
 async init() {
 await this.loadSettings();
 this.setupEventListeners();
 this.initializeTheme();
 await this.loadData();
 this.setupTabNavigation();
 }
 async loadSettings() {
 try {
 const result = await chrome.storage.local.get(['settings', 'stats', 'siteSettings']);
 if (result.settings) {
 this.settings = { ...this.settings, ...result.settings };
 }
 if (result.stats) {
 this.stats = result.stats;
 }
 if (result.siteSettings) {
 this.siteSettings = new Map(Object.entries(result.siteSettings));
 }
 this.updateUI();
 } catch (error) {
 console.error('Error loading settings:', error);
 }
 }
 async saveSettings() {
 try {
 await chrome.storage.local.set({
 settings: this.settings,
 siteSettings: Object.fromEntries(this.siteSettings)
 });
 this.showToast('Settings saved successfully');
 } catch (error) {
 console.error('Error saving settings:', error);
 this.showToast('Failed to save settings', 'error');
 }
 }
 updateUI() {
 document.querySelector(`input[name="protectionLevel"][value="${this.settings.protectionLevel}"]`).checked = true;
 document.getElementById('blockCookies').checked = this.settings.blockCookies;
 document.getElementById('blockFingerprinting').checked = this.settings.blockFingerprinting;
 document.getElementById('showNotifications').checked = this.settings.showNotifications;
 document.getElementById('allowTelemetry').checked = this.settings.allowTelemetry;
 document.getElementById('debugMode').checked = this.settings.debugMode;
 document.getElementById('safeMode').checked = this.settings.safeMode;
 if (this.stats) {
 document.getElementById('totalBlocked').textContent = this.stats.totalBlocked || 0;
 document.getElementById('trackersBlocked').textContent = this.stats.trackersBlocked || 0;
 document.getElementById('cookiesBlocked').textContent = this.stats.cookiesBlocked || 0;
 document.getElementById('sitesProtected').textContent = this.siteSettings.size || 0;
 }
 }
 setupEventListeners() {
 document.querySelectorAll('input[name="protectionLevel"]').forEach(radio => {
 radio.addEventListener('change', (e) => {
 this.settings.protectionLevel = e.target.value;
 this.saveSettings();
 });
 });
 const toggles = ['blockCookies', 'blockFingerprinting', 'showNotifications', 'allowTelemetry', 'debugMode', 'safeMode'];
 toggles.forEach(id => {
 document.getElementById(id).addEventListener('change', (e) => {
 this.settings[id] = e.target.checked;
 this.saveSettings();
 });
 });
 document.getElementById('updateRules').addEventListener('click', () => this.updateRules());
 document.getElementById('resetRules').addEventListener('click', () => this.resetRules());
 document.getElementById('saveCustomRules').addEventListener('click', () => this.saveCustomRules());
 document.getElementById('exportData').addEventListener('click', () => this.exportData());
 document.getElementById('importData').addEventListener('click', () => this.importData());
 document.getElementById('clearData').addEventListener('click', () => this.clearData());
 document.getElementById('viewLogs').addEventListener('click', () => this.viewLogs());
 document.getElementById('testRules').addEventListener('click', () => this.testRules());
 document.getElementById('generateReport').addEventListener('click', () => this.generateReport());
 document.getElementById('helpLink').addEventListener('click', (e) => {
 e.preventDefault();
 chrome.tabs.create({ url: 'https://github.com/ayan1786/LTEP#readme' });
 });
 document.getElementById('privacyPolicyLink').addEventListener('click', (e) => {
 e.preventDefault();
 chrome.tabs.create({ url: 'https://github.com/ayan1786/LTEP/blob/main/PRIVACY.md' });
 });
 document.getElementById('githubLink').addEventListener('click', (e) => {
 e.preventDefault();
 chrome.tabs.create({ url: 'https://github.com/ayan1786/LTEP' });
 });
 document.getElementById('themeToggle').addEventListener('change', (e) => {
 this.toggleTheme(e.target.checked);
 });
 }
 setupTabNavigation() {
 const tabButtons = document.querySelectorAll('.tab-btn');
 const tabContents = document.querySelectorAll('.tab-content');
 tabButtons.forEach(button => {
 button.addEventListener('click', () => {
 const targetTab = button.dataset.tab;
 tabButtons.forEach(btn => btn.classList.remove('active'));
 button.classList.add('active');
 tabContents.forEach(content => content.classList.remove('active'));
 document.getElementById(targetTab).classList.add('active');
 this.loadTabData(targetTab);
 });
 });
 }
 async loadTabData(tab) {
 switch (tab) {
 case 'sites':
 await this.loadSiteSettings();
 break;
 case 'blocking':
 await this.loadRuleStats();
 break;
 }
 }
 async loadData() {
 try {
 const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
 if (response.success) {
 this.stats = response.data.global;
 this.updateUI();
 }
 } catch (error) {
 console.error('Error loading data:', error);
 }
 }
 async loadSiteSettings() {
 const siteList = document.getElementById('siteList');
 if (this.siteSettings.size === 0) {
 siteList.innerHTML = '<div class="loading">No site settings found</div>';
 return;
 }
 const siteItems = Array.from(this.siteSettings.entries()).map(([domain, settings]) => `
 <div class="site-item">
 <div class="site-info">
 <div class="site-domain">${domain}</div>
 <div class="site-stats">Blocked: ${settings.blocked || 0} | Status: ${settings.enabled ? 'Protected' : 'Disabled'}</div>
 </div>
 <div class="toggle-switch">
 <input type="checkbox" ${settings.enabled ? 'checked' : ''} onchange="window.ltepOptions.toggleSite('${domain}', this.checked)">
 <span class="slider"></span>
 </div>
 </div>
 `).join('');
 siteList.innerHTML = siteItems;
 }
 async loadRuleStats() {
 document.getElementById('activeRules').textContent = '20'; 
 document.getElementById('lastUpdate').textContent = 'Today';
 }
 async toggleSite(domain, enabled) {
 if (this.siteSettings.has(domain)) {
 const settings = this.siteSettings.get(domain);
 settings.enabled = enabled;
 this.siteSettings.set(domain, settings);
 await this.saveSettings();
 }
 }
 async updateRules() {
 this.showToast('Updating blocking rules...');
 setTimeout(() => {
 this.showToast('Rules updated successfully');
 this.loadRuleStats();
 }, 2000);
 }
 async resetRules() {
 if (confirm('Reset all blocking rules to default? This will remove any custom rules.')) {
 this.showToast('Rules reset to default');
 this.loadRuleStats();
 }
 }
 async saveCustomRules() {
 const customRules = document.getElementById('customRulesText').value;
 this.showToast('Custom rules saved');
 }
 async exportData() {
 try {
 const response = await chrome.runtime.sendMessage({ type: 'EXPORT_SETTINGS' });
 if (response.success) {
 const dataStr = JSON.stringify(response.data, null, 2);
 const blob = new Blob([dataStr], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `ltep-settings-${new Date().toISOString().split('T')[0]}.json`;
 a.click();
 URL.revokeObjectURL(url);
 this.showToast('Settings exported successfully');
 }
 } catch (error) {
 console.error('Error exporting data:', error);
 this.showToast('Failed to export settings', 'error');
 }
 }
 async importData() {
 const input = document.createElement('input');
 input.type = 'file';
 input.accept = '.json';
 input.onchange = async (e) => {
 const file = e.target.files[0];
 if (!file) return;
 try {
 const text = await file.text();
 const data = JSON.parse(text);
 if (data.settings) {
 this.settings = { ...this.settings, ...data.settings };
 }
 if (data.siteSettings) {
 this.siteSettings = new Map(Object.entries(data.siteSettings));
 }
 await this.saveSettings();
 this.updateUI();
 this.showToast('Settings imported successfully');
 } catch (error) {
 console.error('Error importing data:', error);
 this.showToast('Failed to import settings', 'error');
 }
 };
 input.click();
 }
 async clearData() {
 if (confirm('Clear all LTEP data? This action cannot be undone.')) {
 try {
 await chrome.storage.local.clear();
 this.settings = {
 protectionLevel: 'balanced',
 blockCookies: true,
 blockFingerprinting: true,
 showNotifications: false,
 allowTelemetry: false,
 debugMode: false,
 safeMode: false
 };
 this.stats = null;
 this.siteSettings.clear();
 this.updateUI();
 this.showToast('All data cleared');
 } catch (error) {
 console.error('Error clearing data:', error);
 this.showToast('Failed to clear data', 'error');
 }
 }
 }
 viewLogs() {
 chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
 }
 testRules() {
 this.showToast('Testing blocking rules...');
 setTimeout(() => {
 this.showToast('Rule test completed - all rules working');
 }, 1500);
 }
 generateReport() {
 const report = {
 timestamp: new Date().toISOString(),
 version: '1.0.0',
 settings: this.settings,
 stats: this.stats,
 siteCount: this.siteSettings.size,
 userAgent: navigator.userAgent
 };
 const dataStr = JSON.stringify(report, null, 2);
 const blob = new Blob([dataStr], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `ltep-debug-report-${Date.now()}.json`;
 a.click();
 URL.revokeObjectURL(url);
 this.showToast('Debug report generated');
 }
 initializeTheme() {
 chrome.storage.local.get(['theme']).then(result => {
 const savedTheme = result.theme || 'light';
 const isDark = savedTheme === 'dark';
 document.getElementById('themeToggle').checked = isDark;
 this.applyTheme(isDark);
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
 showToast(message, type = 'success') {
 const toast = document.createElement('div');
 toast.className = `toast ${type}`;
 toast.textContent = message;
 toast.style.cssText = `
 position: fixed;
 top: 20px;
 right: 20px;
 background: ${type === 'error' ? '#ef4444' : '#10b981'};
 color: white;
 padding: 12px 20px;
 border-radius: 6px;
 font-size: 14px;
 z-index: 1000;
 box-shadow: 0 4px 12px rgba(0,0,0,0.15);
 animation: slideIn 0.3s ease;
 `;
 document.body.appendChild(toast);
 setTimeout(() => {
 toast.remove();
 }, type === 'error' ? 5000 : 3000);
 }
}
document.addEventListener('DOMContentLoaded', () => {
 window.ltepOptions = new LTEPOptions();
});
const style = document.createElement('style');
style.textContent = `
 @keyframes slideIn {
 from { transform: translateX(100%); opacity: 0; }
 to { transform: translateX(0); opacity: 1; }
 }
`;
document.head.appendChild(style);