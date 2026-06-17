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

// ฟังก์ชันเริ่มจับเวลา
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

// หน้าเว็บแสดงผล + หน้าปุ่มกดเทสระบบจำลอง
app.get('/', (req, res) => {
    res.setHeader('ngrok-skip-browser-warning', 'true'); 
    res.send(`
        <html>
            <head>
                <title>TikTok Live Score</title>
                <style>
                    body { 
                        background: transparent; 
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        justify-content: center; 
                        min-height: 100vh; 
                        font-family: sans-serif; 
                        margin: 0; 
                        position: relative;
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
                    #timer { font-size: 48px; font-weight: bold; color: #ffc107; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000; }
                    #score { font-size: 100px; font-weight: bold; color: #dc3545; text-shadow: -2px -2px 0 #fff, 2px -2px 0 #fff; }
                    
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
                    .test-title { font-size: 18px; font-weight: bold; color: #555555; margin-bottom: 15px; text-align: center; }
                    .btn-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 15px; }
                    .btn { padding: 12px; font-size: 14px; font-weight: bold; cursor: pointer; border: none; border-radius: 8px; color: white; transition: transform 0.1s; }
                    .btn:active { transform: scale(0.95); }
                    .btn-plus { background-color: #28a745; }
                    .btn-minus { background-color: #dc3545; }
                </style>
            </head>
            <body>
                <div class="toggle-container">
                    <button id="toggleBtn" class="btn-toggle" onclick="toggleTestPanel()">⚙️ เปิดตัวจำลอง</button>
                </div>

                <div id="timer">05:00</div>
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
                        <button class="btn btn-minus" onclick="triggerTest('19448')">🐌 Slowmotion (-10)</button>
                        <button class="btn btn-minus" onclick="triggerTest('5585')">🎉 Confetti (-100)</button>
                        <button class="btn btn-minus" onclick="triggerTest('13072')">🐉 Dragon Crown (-500)</button>
                    </div>
                </div>

                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    socket.on('updateTimer', (t) => document.getElementById('timer').innerText = t);
                    socket.on('updateScore', (d) => {
                        const s = document.getElementById('score');
                        s.innerText = 'WIN ' + d.score + '/10';
                        s.style.color = d.score > 0 ? '#28a745' : '#dc3545';
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

// ฟังก์ชันคำนวณคะแนน
function updateScore(amount, message) {
    currentScore += amount;
    io.emit('updateScore', { score: currentScore, msg: message });
    console.log(`📈 อัปเดต: ${currentScore} | ${message}`);
    startTimer(); 
}

function processGiftLogic(giftId, amount) {
    const gifts = {
        '5655': { val: 1, name: "Rose" },
        '5779': { val: 10, name: "I Love You" },
        '7264': { val: 100, name: "Mishaka Bear" },
        '7168': { val: 500, name: "Money Gun" },
        '5269': { val: -1, name: "TikTok" },
        '19448': { val: -10, name: "Slowmotion" },
        '5585': { val: -100, name: "Confetti" },
        '13072': { val: -500, name: "Dragon Crown" }
    };

    if (gifts[giftId]) {
        updateScore(gifts[giftId].val * amount, gifts[giftId].name);
    }
}

// ระบบรอรับค่าจากปุ่มเทสหน้าเว็บ
io.on('connection', (socket) => {
    socket.on('testGiftEvent', (data) => {
        processGiftLogic(data.giftId, 1); // กดเทสทีละปุ่มให้เพิ่ม/ลดรอบละ 1 ชิ้น
    });
});

// เชื่อมต่อ TikTok
const tiktokConnection = new TikTokLiveClass("https://www.tiktok.com/@sekza03/live", {
    sessionid: "644082c09b889deb60d7f1c1767642ef"
});

tiktokConnection.connect().then(() => console.log("✅ บอทเชื่อมต่อแล้ว!")).catch(err => console.error(err));

// ระบบประมวลผลของขวัญ (กันรัวจากสตรีมจริง)
tiktokConnection.on('gift', data => {
    // ถ้ารูปแบบของขวัญเป็นคอมโบ และคนดูยังกดไม่จบ ให้รอจนกว่า repeatEnd จะเป็น true
    if (data.giftType === 1 && !data.repeatEnd) return;

    // คำนวณยอดรวมเมื่อหยุดกดคอมโบแล้ว
    const amount = data.repeatCount || 1;
    processGiftLogic(data.giftId, amount);
});

server.listen(3000, () => console.log('🚀 บอทรันแล้วที่ http://localhost:3000'));