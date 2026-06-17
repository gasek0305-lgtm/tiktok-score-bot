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

// 1. หน้าจอหลัก (สำหรับใส่ใน OBS) - จะไม่มีปุ่มอะไรเลย โชว์แค่คะแนนกับเวลา คลีนๆ
app.get('/', (req, res) => {
    res.setHeader('ngrok-skip-browser-warning', 'true'); 
    res.send(`
        <html>
            <head>
                <title>TikTok Live Score</title>
                <style>
                    body { background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; margin: 0; }
                    #timer { font-size: 54px; font-weight: bold; color: #ffc107; text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000; }
                    #score { font-size: 110px; font-weight: bold; color: #dc3545; text-shadow: -3px -3px 0 #fff, 3px -3px 0 #fff, -3px 3px 0 #fff, 3px 3px 0 #fff; margin-top: 10px; }
                </style>
            </head>
            <body>
                <div id="timer">05:00</div>
                <div id="score">WIN 0/10</div>
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    socket.on('updateTimer', (t) => document.getElementById('timer').innerText = t);
                    socket.on('updateScore', (d) => {
                        const s = document.getElementById('score');
                        s.innerText = 'WIN ' + d.score + '/10';
                        s.style.color = d.score > 0 ? '#28a745' : '#dc3545';
                    });
                </script>
            </body>
        </html>
    `);
});

// 2. หน้าควบคุมลับสำหรับแอดมิน (สำหรับเปิดในมือถือ/คอมอีกแท็บ) เพื่อกดเพิ่มลดคะแนนเอง
app.get('/admin', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Admin Control Panel</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: sans-serif; padding: 20px; text-align: center; background: #f4f6f9; }
                    h2 { color: #333; }
                    .btn-group { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; max-width: 400px; margin: 20px auto; }
                    .btn { padding: 20px; font-size: 18px; font-weight: bold; color: white; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .btn-plus { background: #28a745; }
                    .btn-minus { background: #dc3545; }
                    .btn-reset { background: #6c757d; grid-column: span 2; padding: 15px; }
                </style>
            </head>
            <body>
                <h2>🎮 แผงควบคุมคะแนน (แอดมิน)</h2>
                <p>ใช้สำหรับกดปรับคะแนนสดๆ ในไลฟ์ด้วยตัวเอง</p>
                <div class="btn-group">
                    <button class="btn btn-plus" onclick="changeScore(1)">➕ เพิ่ม (+1)</button>
                    <button class="btn btn-minus" onclick="changeScore(-1)">➖ ลด (-1)</button>
                    <button class="btn btn-plus" onclick="changeScore(10)">➕ เพิ่ม (+10)</button>
                    <button class="btn btn-minus" onclick="changeScore(-10)">➖ ลด (-10)</button>
                    <button class="btn btn-reset" onclick="resetGame()">🔄 รีเซ็ตเกมใหม่ (0 แต้ม / 5 นาที)</button>
                </div>
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    function changeScore(val) { socket.emit('adminChangeScore', { value: val }); }
                    function resetGame() { if(confirm('ต้องการรีเซ็ตคะแนนและเวลาใช่ไหม?')) { socket.emit('adminResetGame'); } }
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

// ระบบจัดการคำสั่งจากแอดมิน
io.on('connection', (socket) => {
    socket.on('adminChangeScore', (data) => {
        updateScore(data.value, "Admin Manual Adjust");
    });
    socket.on('adminResetGame', () => {
        currentScore = 0;
        timeLeft = 300;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        io.emit('updateScore', { score: currentScore, msg: "Game Reset" });
        io.emit('updateTimer', formatTime(timeLeft));
        console.log("🔄 แอดมินสั่งรีเซ็ตระบบใหม่");
    });
});

// เชื่อมต่อ TikTok
const tiktokConnection = new TikTokLiveClass("https://www.tiktok.com/@sekza03/live", {
    sessionid: "644082c09b889deb60d7f1c1767642ef"
});

tiktokConnection.connect().then(() => console.log("✅ บอทเชื่อมต่อแล้ว!")).catch(err => console.error(err));

// ระบบประมวลผลของขวัญจากสตรีมจริง (กันรัว)
tiktokConnection.on('gift', data => {
    if (data.giftType === 1 && !data.repeatEnd) return;
    const amount = data.repeatCount || 1;
    processGiftLogic(data.giftId, amount);
});

server.listen(3000, () => console.log('🚀 บอทรันแล้วที่ http://localhost:3000'));
