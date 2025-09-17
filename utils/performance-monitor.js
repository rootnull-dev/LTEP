class PerformanceMonitor {
 constructor() {
 this.metrics = {
 popupLoadTime: [],
 apiResponseTime: [],
 memoryUsage: [],
 errorCount: 0,
 lagSpikes: []
 };
 this.isMonitoring = false;
 this.startTime = null;
 }
 startMonitoring() {
 this.isMonitoring = true;
 this.startTime = performance.now();
 }
 stopMonitoring() {
 if (!this.isMonitoring) return;
 const endTime = performance.now();
 const totalTime = endTime - this.startTime;
 this.isMonitoring = false;
 }
 recordPopupLoad(startTime, endTime) {
 const loadTime = endTime - startTime;
 this.metrics.popupLoadTime.push(loadTime);
 const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : !chrome.runtime.getManifest().version_name?.includes('production');
 if (isDev && loadTime > 500) {
 console.warn(`⚠️ Slow popup load: ${loadTime.toFixed(2)}ms`);
 this.metrics.lagSpikes.push({
 type: 'popup_load',
 time: loadTime,
 timestamp: performance.now()
 });
 }
 return loadTime;
 }
 recordApiCall(apiName, startTime, endTime) {
 const responseTime = endTime - startTime;
 this.metrics.apiResponseTime.push({
 api: apiName,
 time: responseTime,
 timestamp: performance.now()
 });
 const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true; 
 if (isDev && responseTime > 500) {
 console.warn(`⚠️ Slow API call (${apiName}): ${responseTime.toFixed(0)}ms`);
 }
 return responseTime;
 }
 static recordApiCall(apiName, fn) {
 const start = performance.now();
 return Promise.resolve().then(fn).finally(() => {
 const ms = performance.now() - start;
 const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
 if (isDev && ms > 500) {
 console.warn(`⚠️ Slow API call (${apiName}): ${ms.toFixed(0)}ms`);
 }
 });
 }
 recordError(error, context) {
 this.metrics.errorCount++;
 console.error(`🚨 LTEP Error in ${context}:`, error);
 if (typeof chrome !== 'undefined' && chrome.runtime) {
 chrome.runtime.sendMessage({
 type: 'PERFORMANCE_ERROR',
 error: {
 message: error.message,
 stack: error.stack,
 context: context,
 timestamp: Date.now()
 }
 }).catch(() => {}); 
 }
 }
 checkMemoryUsage() {
 if (performance.memory) {
 const memoryInfo = {
 used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
 total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
 limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
 };
 this.metrics.memoryUsage.push({
 ...memoryInfo,
 timestamp: Date.now()
 });
 if (memoryInfo.used > 50) {
 console.warn(`⚠️ High memory usage: ${memoryInfo.used}MB`);
 }
 return memoryInfo;
 }
 return null;
 }
 getPerformanceReport() {
 const avgPopupLoad = this.metrics.popupLoadTime.length > 0 
 ? this.metrics.popupLoadTime.reduce((a, b) => a + b, 0) / this.metrics.popupLoadTime.length 
 : 0;
 const avgApiResponse = this.metrics.apiResponseTime.length > 0
 ? this.metrics.apiResponseTime.reduce((a, b) => a + b.time, 0) / this.metrics.apiResponseTime.length
 : 0;
 return {
 averagePopupLoad: `${avgPopupLoad.toFixed(2)}ms`,
 averageApiResponse: `${avgApiResponse.toFixed(2)}ms`,
 totalErrors: this.metrics.errorCount,
 lagSpikes: this.metrics.lagSpikes.length,
 memoryPeaks: this.metrics.memoryUsage.filter(m => m.used > 30).length,
 recommendations: this.getRecommendations()
 };
 }
 getRecommendations() {
 const recommendations = [];
 const avgPopupLoad = this.metrics.popupLoadTime.length > 0 
 ? this.metrics.popupLoadTime.reduce((a, b) => a + b, 0) / this.metrics.popupLoadTime.length 
 : 0;
 if (avgPopupLoad > 200) {
 recommendations.push('Optimize popup loading - consider lazy loading components');
 }
 if (this.metrics.errorCount > 0) {
 recommendations.push('Fix JavaScript errors for better stability');
 }
 if (this.metrics.lagSpikes.length > 3) {
 recommendations.push('Multiple lag spikes detected - review async operations');
 }
 const highMemoryUsage = this.metrics.memoryUsage.filter(m => m.used > 50).length;
 if (highMemoryUsage > 0) {
 recommendations.push('Memory usage is high - consider implementing cleanup');
 }
 if (recommendations.length === 0) {
 recommendations.push('Performance is optimal! 🚀');
 }
 return recommendations;
 }
}
if (typeof window !== 'undefined') {
 window.PerformanceMonitor = PerformanceMonitor;
}
if (typeof module !== 'undefined' && module.exports) {
 module.exports = PerformanceMonitor;
}