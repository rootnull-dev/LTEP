class RuleManager {
 constructor() {
 this.baseRuleId = 100000; 
 this.nextRuleId = this.baseRuleId;
 this.siteExceptionRules = new Map(); 
 }
 generateRuleId() {
 const id = this.nextRuleId++;
 if (!Number.isInteger(id) || id <= 0) {
 throw new Error(`Invalid rule ID generated: ${id}`);
 }
 return id;
 }
 createSiteExceptionRule(hostname) {
 const ruleId = this.generateRuleId();
 const rule = {
 id: ruleId,
 priority: 1000, 
 action: { type: 'allow' },
 condition: {
 requestDomains: [hostname],
 resourceTypes: [
 'main_frame',
 'sub_frame', 
 'script',
 'xmlhttprequest',
 'image',
 'stylesheet',
 'font',
 'media'
 ]
 }
 };
 this.validateRule(rule);
 if (!this.siteExceptionRules.has(hostname)) {
 this.siteExceptionRules.set(hostname, []);
 }
 this.siteExceptionRules.get(hostname).push(ruleId);
 return rule;
 }
 getSiteExceptionRuleIds(hostname) {
 return this.siteExceptionRules.get(hostname) || [];
 }
 removeSiteExceptionRules(hostname, removedIds) {
 if (this.siteExceptionRules.has(hostname)) {
 const currentRules = this.siteExceptionRules.get(hostname);
 const remainingRules = currentRules.filter(id => !removedIds.includes(id));
 if (remainingRules.length === 0) {
 this.siteExceptionRules.delete(hostname);
 } else {
 this.siteExceptionRules.set(hostname, remainingRules);
 }
 }
 }
 validateRule(rule) {
 if (!rule.id || !Number.isInteger(rule.id) || rule.id <= 0) {
 throw new Error(`Invalid rule ID: ${rule.id} (must be positive integer)`);
 }
 if (!rule.action || !rule.action.type) {
 throw new Error('Rule must have action with type');
 }
 if (!rule.condition) {
 throw new Error('Rule must have condition');
 }
 const validActions = ['block', 'allow', 'redirect', 'upgradeScheme', 'modifyHeaders'];
 if (!validActions.includes(rule.action.type)) {
 throw new Error(`Invalid action type: ${rule.action.type}`);
 }
 if (rule.condition.resourceTypes) {
 const validTypes = [
 'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 
 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 
 'media', 'websocket', 'webtransport', 'webbundle'
 ];
 const invalidTypes = rule.condition.resourceTypes.filter(
 type => !validTypes.includes(type)
 );
 if (invalidTypes.length > 0) {
 throw new Error(`Invalid resource types: ${invalidTypes.join(', ')}`);
 }
 }
 }
 createDefaultBlockingRules() {
 const rules = [
 {
 urlFilter: '*google-analytics.com*',
 resourceTypes: ['script', 'xmlhttprequest', 'image']
 },
 {
 urlFilter: '*doubleclick.net*',
 resourceTypes: ['script', 'xmlhttprequest', 'image', 'sub_frame']
 },
 {
 urlFilter: '*googletagmanager.com*',
 resourceTypes: ['script', 'xmlhttprequest']
 },
 {
 urlFilter: '*facebook.com/tr*',
 resourceTypes: ['script', 'xmlhttprequest', 'image']
 },
 {
 urlFilter: '*connect.facebook.net*',
 resourceTypes: ['script', 'xmlhttprequest']
 },
 {
 urlFilter: '*amazon-adsystem.com*',
 resourceTypes: ['script', 'xmlhttprequest', 'image']
 },
 {
 urlFilter: '*scorecardresearch.com*',
 resourceTypes: ['script', 'xmlhttprequest', 'image']
 },
 {
 urlFilter: '*outbrain.com*',
 resourceTypes: ['script', 'xmlhttprequest', 'image', 'sub_frame']
 },
 {
 urlFilter: '*taboola.com*',
 resourceTypes: ['script', 'xmlhttprequest', 'image', 'sub_frame']
 },
 {
 urlFilter: '*googlesyndication.com*',
 resourceTypes: ['script', 'xmlhttprequest', 'image', 'sub_frame']
 }
 ];
 return rules.map(ruleTemplate => {
 const rule = {
 id: this.generateRuleId(),
 priority: 1,
 action: { type: 'block' },
 condition: {
 urlFilter: ruleTemplate.urlFilter,
 resourceTypes: ruleTemplate.resourceTypes
 }
 };
 this.validateRule(rule);
 return rule;
 });
 }
 getStats() {
 return {
 nextRuleId: this.nextRuleId,
 siteExceptionsCount: this.siteExceptionRules.size,
 totalExceptionRules: Array.from(this.siteExceptionRules.values())
 .reduce((total, rules) => total + rules.length, 0)
 };
 }
 reset() {
 this.nextRuleId = this.baseRuleId;
 this.siteExceptionRules.clear();
 }
}
if (typeof window !== 'undefined') {
 window.RuleManager = RuleManager;
 window.ruleManager = new RuleManager();
}
if (typeof module !== 'undefined' && module.exports) {
 module.exports = RuleManager;
}