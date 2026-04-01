// ==UserScript==
// @name         二维码扫描器和链接提取
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  扫描网页中的二维码，提取链接并在旁边显示
// @author       Your Name
// @match        *://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACw=
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js
// ==/UserScript==

(function() {
    'use strict';

    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
        .qr-code-link-container {
            position: absolute;
            top: 0;
            left: 0;
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            max-width: 300px;
            word-break: break-all;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
        }
        .qr-code-link-container a {
            color: #4da6ff;
            text-decoration: none;
            word-break: break-all;
        }
        .qr-code-link-container a:hover {
            color: #80bfff;
            text-decoration: underline;
        }
        .qr-code-link-label {
            font-weight: bold;
            margin-bottom: 5px;
            color: #4da6ff;
        }
        .qr-code-scanner-badge {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 12px;
            cursor: pointer;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            user-select: none;
        }
        .qr-toggle {
            display: inline-block;
            margin-left: 5px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    // QR码扫描器类
    class QRCodeScanner {
        constructor() {
            this.enabled = true;
            this.foundCodes = new Map();
            this.init();
        }

        init() {
            this.createBadge();
            this.scanPage();
            // 每2秒扫描一次
            setInterval(() => this.scanPage(), 2000);
        }

        createBadge() {
            const badge = document.createElement('div');
            badge.className = 'qr-code-scanner-badge';
            badge.innerHTML = `✓ QR码扫描 <span class="qr-toggle">[关闭]</span>`;
            badge.style.display = this.enabled ? 'block' : 'none';

            const toggle = badge.querySelector('.qr-toggle');
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
                toggle.textContent = this.enabled ? '[关闭]' : '[启用]';
            });

            document.body.appendChild(badge);
            this.badge = badge;
        }

        toggle() {
            this.enabled = !this.enabled;
            if (this.enabled) {
                this.showAllLinks();
            } else {
                this.hideAllLinks();
            }
        }

        hideAllLinks() {
            document.querySelectorAll('.qr-code-link-container').forEach(el => {
                el.style.display = 'none';
            });
        }

        showAllLinks() {
            document.querySelectorAll('.qr-code-link-container').forEach(el => {
                el.style.display = 'block';
            });
        }

        scanPage() {
            if (!this.enabled) return;

            const images = document.querySelectorAll('img');
            images.forEach((img, index) => {
                try {
                    // 跳过已扫描的图像
                    if (this.foundCodes.has(img)) return;

                    // 检查图像是否已加载
                    if (!img.complete) return;

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    if (!ctx) return;

                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;

                    ctx.drawImage(img, 0, 0);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height);

                    if (code) {
                        this.foundCodes.set(img, code.data);
                        this.displayLink(img, code.data);
                    }
                } catch (e) {
                    // 无声处理跨域或其他错误
                }
            });

            // 也扫描canvas元素
            const canvases = document.querySelectorAll('canvas');
            canvases.forEach((canvas) => {
                if (this.foundCodes.has(canvas)) return;

                try {
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height);

                    if (code) {
                        this.foundCodes.set(canvas, code.data);
                        this.displayLink(canvas, code.data);
                    }
                } catch (e) {
                    // 无声处理
                }
            });
        }

        displayLink(element, qrData) {
            // 检查是否是有效的链接
            let displayText = qrData;
            let isLink = /^https?:\/\/|^www\.|^ftp:\/\//.test(qrData);

            // 创建提示容器
            const container = document.createElement('div');
            container.className = 'qr-code-link-container';
            container.style.display = this.enabled ? 'block' : 'none';

            if (isLink) {
                container.innerHTML = `
                    <div class="qr-code-link-label">二维码链接:</div>
                    <a href="${this.escapeHtml(qrData)}" target="_blank">${this.escapeHtml(qrData)}</a>
                    <button style="display:block; margin-top:5px; padding:4px 8px; background:#4da6ff; color:white; border:none; border-radius:2px; cursor:pointer; font-size:11px;">打开链接</button>
                `;

                const button = container.querySelector('button');
                button.addEventListener('click', () => {
                    window.open(qrData, '_blank');
                });
            } else {
                container.innerHTML = `
                    <div class="qr-code-link-label">二维码内容:</div>
                    <div>${this.escapeHtml(qrData.substring(0, 100))}${qrData.length > 100 ? '...' : ''}</div>
                `;
            }

            // 将容器添加到DOM
            if (element.parentNode) {
                element.parentNode.insertBefore(container, element);
                element.parentNode.style.position = 'relative';
            }
        }

        escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }
    }

    // 等待DOM加载完成后启动扫描器
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new QRCodeScanner();
        });
    } else {
        new QRCodeScanner();
    }
})();
