import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import * as tiktokLiveModule from 'tiktok-live-connector';

const TikTokLiveClass = tiktokLiveModule.TikTokLiveConnection || tiktokLiveModule.default;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

let currentScore = 0;
let timeLeft = 300; 
let timerInterval = null;

// ตัวแปรสำหรับจำประวัติคอมโบของขวัญเพื่อแก้ปัญหาแต้มเบิ้ล
// โครงสร้าง: { 'ชื่อคนดู_IDของขวัญ': จำนวนคอมโบล่าสุด }
let giftComboTracker = {};

function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            io.emit('updateTimer', formatTime(timeLeft));
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            io.emit('updateTimer', "TIME OUT!");
        }
    }, 1000);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

app.get('/', (req, res) => {
    // ข้ามหน้าแจ้งเตือนแรกของ ngrok ทันที
    res.setHeader('ngrok-skip-browser-warning', 'true'); 

    res.send(`
        <html>
            <head>
                <title>TikTok Live Score & Timer</title>
                <style>
                    body {
                        background: transparent; 
                        color: #333333; 
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        justify-content: center; 
                        min-height: 100vh; 
                        font-family: sans-serif;
                        margin: 0;
                        padding: 20px;
                        box-sizing: border-box;
                        position: relative;
                        overflow: hidden; 
                    }
                    .toggle-container {
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        z-index: 999;
                    }
                    .btn-toggle {
                        padding: 6px 12px;
                        font-size: 12px;
                        font-weight: bold;
                        cursor: pointer;
                        border: 1px solid #cccccc;
                        border-radius: 20px;
                        color: #666666;
                        background-color: rgba(255, 255, 255, 0.8); 
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                        transition: all 0.3s ease;
                    }
                    .btn-toggle.active {
                        background-color: #007bff;
                        color: white;
                        border-color: #007bff;
                    }
                    #timer {
                        font-size: 48px;
                        font-weight: bold;
                        color: #ffc107; 
                        text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
                        margin-bottom: -10px;
                    }
                    .score-title {
                        font-size: 24px; 
                        color: #666666;
                        font-weight: bold;
                        text-shadow: 1px 1px 2px rgba(255,255,255,0.8); 
                    }
                    #score {
                        font-size: 120px; 
                        font-weight: bold; 
                        color: #dc3545; 
                        margin: 5px 0;
                        transition: color 0.3s ease;
                        text-shadow: -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff; 
                    }
                    .test-container {
                        border: 2px dashed #cccccc;
                        border-radius: 12px;
                        background: rgba(255, 255, 255, 0.95); 
                        padding: 20px;
                        max-width: 800px;
                        width: 100%;
                        display: none; 
                        opacity: 0;
                        transition: opacity 0.3s ease;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        margin-top: 20px;
                    }
                    .test-container.show {
                        display: block;
                        opacity: 1;
                    }
                    .test-title {
                        font-size: 18px;
                        font-weight: bold;
                        color: #555555;
                        margin-bottom: 15px;
                        text-align: center;
                    }
                    .btn-group {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                        gap: 10px;
                        margin-bottom: 15px;
                    }
                    .btn {
                        padding: 12px;
                        font-size: 14px;
                        font-weight: bold;
                        cursor: pointer;
                        border: none;
                        border-radius: 8px;
                        color: white;
                        transition: transform 0.1s, background 0.2s;
                    }
                    .btn:active { transform: scale(0.95); }
                    .btn-plus { background-color: #28a745; }
                    .btn-plus:hover { background-color: #218838; }
                    .btn-minus { background-color: #dc3545; }
                    .btn-minus:hover { background-color: #c82333; }
                </style>
            </head>
            <body>
                <div class="toggle-container">
                    <button id="toggleBtn" class="btn-toggle" onclick="toggleTestPanel()">⚙️ เปิดตัวจำลอง</button>
                </div>

                <div id="timer">${formatTime(timeLeft)}</div>

                <div class="score-title">คะแนนปัจจุบัน</div>
                <div id="score">WIN 0/10</div>

                <div id="testPanel" class="test-container">
                    <div class="test-title">🧪 แผงปุ่มทดสอบระบบจำลอง</div>
                    
                    <div style="font-weight: bold; color: #28a745; margin-bottom: 5px;">➕ ฝั่งบวกคะแนน:</div>
                    <div class="btn-group">
                        <button class="btn btn-plus" onclick="triggerTest('5655')">🌹 Rose (+1)</button>
                        <button class="btn btn-plus" onclick="triggerTest('5779')">❤️ I Love You (+10)</button>
                        <button class="btn btn-plus" onclick="triggerTest('7264')">👑 Mishaka Bear (+100)</button>
                        <button class="btn btn-plus" onclick="triggerTest('7168')">🐼 Money Gun (+500)</button>
                    </div>

                    <div style="font-weight: bold; color: #dc3545; margin-bottom: 5px;">➖ ฝั่งลบคะแนน:</div>
                    <div class="btn-group">
                        <button class="btn btn-minus" onclick="triggerTest('5269')">📱 TikTok (-1)</button>
                        <button class="btn btn-minus" onclick="thought= 'test combo fix';triggerTest('19448')">🐌 Slowmotion (-10)</button>
                        <button class="btn btn-minus" onclick="triggerTest('5585')">🎉 Confetti (-100)</button>
                        <button class="btn btn-minus" onclick="triggerTest('13072')">🐉 Dragon Crown (-500)</button>
                    </div>
                </div>

                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    
                    socket.on('updateTimer', (timeString) => {
                        document.getElementById('timer').innerText = timeString;
                    });

                    socket.on('updateScore', (data) => {
                        const scoreElement = document.getElementById('score');
                        scoreElement.innerText = 'WIN ' + data.score + '/10';

                        if (data.score > 0) {
                            scoreElement.style.color = '#28a745';
                        } else if (data.score < 1) {
                            scoreElement.style.color = '#dc3545';
                        }
                    });

                    function triggerTest(giftId) {
                        socket.emit('testGiftEvent', { giftId: giftId });
                    }

                    function toggleTestPanel() {
                        const panel = document.getElementById('testPanel');
                        const btn = document.getElementById('toggleBtn');
                        if (panel.classList.contains('show')) {
                            panel.classList.remove('show');
                            btn.classList.remove('active');
                            btn.innerText = "⚙️ เปิดตัวจำลอง";
                        } else {
                            panel.classList.add('show');
                            btn.classList.add('active');
                            btn.innerText = "❌ ปิดตัวจำลอง";
                        }
                    }
                </script>
            </body>
        </html>
    `);
});

function updateScore(amount, message) {
    currentScore += amount;
    io.emit('updateScore', { score: currentScore, msg: message });
    console.log(`📈 อัปเดต: ${currentScore} | ${message}`);
    startTimer(); 
}

function processGiftLogic(giftId, amount) {
    if (giftId == '5655') updateScore(1 * amount, "Rose +1");
    else if (giftId == '5779') updateScore(10 * amount, "I Love You +10");
    else if (giftId == '7264') updateScore(100 * amount, "Mishaka Bear +100");
    else if (giftId == '7168') updateScore(500 * amount, "Money Gun +500");
    else if (giftId == '5269') updateScore(-1 * amount, "TikTok -1");
    else if (giftId == '19448') updateScore(-10 * amount, "Slowmotion -10");
    else if (giftId == '5585') updateScore(-100 * amount, "Confetti -100");
    else if (giftId == '13072') updateScore(-500 * amount, "Dragon Crown -500");
}

io.on('connection', (socket) => {
    socket.emit('updateTimer', formatTime(timeLeft));
    
    socket.on('testGiftEvent', (data) => {
        // แผงปุ่มเทสเป็นชิ้นเดี่ยวอยู่แล้ว ให้บวก 1 ตลอด
        processGiftLogic(data.giftId, 1);
    });
});

const tiktokConnection = new TikTokLiveClass("https://www.tiktok.com/@sekza03/live", {
    sessionid: "644082c09b889deb60d7f1c1767642ef"
});

tiktokConnection.connect().then(() => console.log("✅ บอทเชื่อมต่อแล้ว!")).catch(err => console.error(err));

// 🛡️ ส่วนประมวลผลของขวัญแบบป้องกันแต้มเบิ้ล 100%
tiktokConnection.on('gift', data => {
    const giftId = data.giftId;
    const currentCombo = data.repeatCount || 1;
    // สร้างคีย์จำเฉพาะตัว เช่น "Somchai_5655"
    const trackerKey = `${data.userId}_${giftId}`; 

    // ถ้าเป็นของขวัญชิ้นเดียวทั่วไป (ไม่ใช่สายคอมโบ)
    if (data.giftType !== 1) {
        processGiftLogic(giftId, currentCombo);
        return;
    }

    // --- เริ่มต้นระบบป้องกันการนับแต้มเบิ้ลสำหรับสายคอมโบรัวๆ ---
    const lastCombo = giftComboTracker[trackerKey] || 0;

    if (currentCombo > lastCombo) {
        // หาจำนวนที่เพิ่มขึ้นมาจริงๆ ในรอบนี้ (เช่น จากคอมโบ 5 ขยับเป็น 6 แปลว่าส่งเพิ่มมา 1)
        const realAddedAmount = currentCombo - lastCombo;
        
        // อัปเดตยอดคอมโบล่าสุดเก็บไว้ในระบบจำ
        giftComboTracker[trackerKey] = currentCombo;
        
        // ส่งเฉพาะจำนวนที่เพิ่มขึ้นจริงไปคำนวณแต้ม
        processGiftLogic(giftId, realAddedAmount);
    }

    // หากคอมโบจบลง (repeatEnd = true) ให้ล้างประวัติคนนี้เพื่อรองรับการส่งรอบใหม่
    if (data.repeatEnd) {
        delete giftComboTracker[trackerKey];
    }
});

// เคลียร์ขยะในหน่วยความจำของคอมโบทุกๆ 10 นาที ป้องกัน RAM บวมระยะยาว
setInterval(() => {
    giftComboTracker = {};
}, 600000);

server.listen(3000, () => console.log('🚀 เปิดดูที่ http://localhost:3000'));