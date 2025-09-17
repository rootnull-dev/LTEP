(function() {
 'use strict';
 let protectionEnabled = true;
 function protectCanvas() {
 const originalGetContext = HTMLCanvasElement.prototype.getContext;
 const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
 const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
 HTMLCanvasElement.prototype.getContext = function(type, ...args) {
 if (protectionEnabled && (type === '2d' || type === 'webgl' || type === 'webgl2')) {
 const context = originalGetContext.call(this, type, ...args);
 if (context && type === '2d') {
 const originalFillText = context.fillText;
 context.fillText = function(...args) {
 const result = originalFillText.apply(this, args);
 this.fillRect(0, 0, 0.1, 0.1);
 return result;
 };
 }
 return context;
 }
 return originalGetContext.call(this, type, ...args);
 };
 HTMLCanvasElement.prototype.toDataURL = function(...args) {
 if (protectionEnabled) {
 const originalData = originalToDataURL.apply(this, args);
 return originalData.replace(/.$/, Math.random().toString(36).charAt(2));
 }
 return originalToDataURL.apply(this, args);
 };
 CanvasRenderingContext2D.prototype.getImageData = function(...args) {
 if (protectionEnabled) {
 const imageData = originalGetImageData.apply(this, args);
 if (imageData.data.length > 0) {
 imageData.data[imageData.data.length - 1] = Math.floor(Math.random() * 256);
 }
 return imageData;
 }
 return originalGetImageData.apply(this, args);
 };
 }
 function protectWebGL() {
 const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
 const originalGetExtension = WebGLRenderingContext.prototype.getExtension;
 WebGLRenderingContext.prototype.getParameter = function(parameter) {
 if (protectionEnabled) {
 switch (parameter) {
 case this.RENDERER:
 return 'Generic Renderer';
 case this.VENDOR:
 return 'Generic Vendor';
 case this.VERSION:
 return 'WebGL 1.0';
 case this.SHADING_LANGUAGE_VERSION:
 return 'WebGL GLSL ES 1.0';
 }
 }
 return originalGetParameter.call(this, parameter);
 };
 WebGLRenderingContext.prototype.getExtension = function(name) {
 if (protectionEnabled && name.includes('WEBGL_debug_renderer_info')) {
 return null;
 }
 return originalGetExtension.call(this, name);
 };
 }
 function protectAudio() {
 const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
 const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
 AudioContext.prototype.createAnalyser = function() {
 if (protectionEnabled) {
 }
 return originalCreateAnalyser.call(this);
 };
 if (AnalyserNode.prototype.getFloatFrequencyData) {
 AnalyserNode.prototype.getFloatFrequencyData = function(array) {
 if (protectionEnabled) {
 originalGetFloatFrequencyData.call(this, array);
 for (let i = 0; i < array.length; i++) {
 array[i] += (Math.random() - 0.5) * 0.0001;
 }
 return;
 }
 return originalGetFloatFrequencyData.call(this, array);
 };
 }
 }
 function protectFonts() {
 if (document.fonts && document.fonts.check) {
 const originalCheck = document.fonts.check;
 document.fonts.check = function(font, text) {
 if (protectionEnabled) {
 }
 return originalCheck.call(this, font, text);
 };
 }
 }
 function protectScreen() {
 if (!protectionEnabled) return;
 try {
 const features = {
 colorDepth: (globalThis.screen && screen.colorDepth) ?? null,
 pixelDepth: (globalThis.screen && screen.pixelDepth) ?? null,
 width: (globalThis.screen && screen.width) ?? null,
 height: (globalThis.screen && screen.height) ?? null
 };
 } catch (error) {
 console.warn('[LTEP] Screen protection initialization failed:', error.message);
 }
 }
 function protectTimezone() {
 const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
 Date.prototype.getTimezoneOffset = function() {
 if (protectionEnabled) {
 return 0;
 }
 return originalGetTimezoneOffset.call(this);
 };
 }
 function protectBattery() {
 if (navigator.getBattery) {
 const originalGetBattery = navigator.getBattery;
 navigator.getBattery = function() {
 if (protectionEnabled) {
 return Promise.reject(new Error('Battery API blocked for privacy'));
 }
 return originalGetBattery.call(this);
 };
 }
 }
 function protectDeviceMemory() {
 if (!protectionEnabled || !('deviceMemory' in navigator)) return;
 try {
 const desc = Object.getOwnPropertyDescriptor(navigator, 'deviceMemory');
 if (desc && desc.configurable) {
 Object.defineProperty(navigator, 'deviceMemory', {
 get: () => 4, 
 configurable: true
 });
 } else {
 }
 } catch (error) {
 console.warn('[LTEP] Device memory protection failed:', error.message);
 }
 }
 function protectHardwareConcurrency() {
 if (!protectionEnabled || !('hardwareConcurrency' in navigator)) return;
 try {
 const desc = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');
 if (desc && desc.configurable) {
 Object.defineProperty(navigator, 'hardwareConcurrency', {
 get: () => 4, 
 configurable: true
 });
 } else {
 }
 } catch (error) {
 console.warn('[LTEP] Hardware concurrency protection failed:', error.message);
 }
 }
 function initializeProtection() {
 chrome.runtime.sendMessage({
 type: 'CHECK_SITE_PROTECTION',
 hostname: window.location.hostname
 }).then(response => {
 if (response && response.enabled !== undefined) {
 protectionEnabled = response.enabled;
 }
 if (protectionEnabled) {
 protectCanvas();
 protectWebGL();
 protectAudio();
 protectFonts();
 protectScreen();
 protectTimezone();
 protectBattery();
 protectDeviceMemory();
 protectHardwareConcurrency();
 }
 }).catch(error => {
 console.error('[LTEP] Error checking site protection:', error);
 });
 }
 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', initializeProtection);
 } else {
 initializeProtection();
 }
 chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 if (message.type === 'PROTECTION_TOGGLED') {
 protectionEnabled = message.enabled;
 }
 });
})();