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
let isTimerRunning = false; 

function startTimerLogic() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 300; 
    isTimerRunning = true;
    io.emit('updateTimer', { time: formatTime(timeLeft), visible: true });

    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            io.emit('updateTimer', { time: formatTime(timeLeft), visible: true });
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            isTimerRunning = false;
            io.emit('updateTimer', { time: "TIME OUT!", visible: true });
        }
    }, 1000);
}

function stopTimerLogic() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    isTimerRunning = false;
    timeLeft = 300; 
    io.emit('updateTimer', { time: formatTime(timeLeft), visible: false });
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

app.get('/', (req, res) => {
    res.setHeader('ngrok-skip-browser-warning', 'true'); 
    res.send(`
        <html>
            <head>
                <title>TikTok Live Score</title>
                <style>
                    body { background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; margin: 0; overflow: hidden; }
                    #timer { 
                        font-size: 54px; font-weight: bold; color: #ffc107; 
                        text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;
                        opacity: 0; max-height: 0; transform: translateY(-20px); transition: all 0.5s ease-in-out; margin-bottom: 0;
                    }
                    #timer.show { opacity: 1; max-height: 80px; transform: translateY(0); margin-bottom: 10px; }
                    #score { font-size: 110px; font-weight: bold; color: #dc3545; text-shadow: -3px -3px 0 #fff, 3px -3px 0 #fff, -3px 3px 0 #fff, 3px 3px 0 #fff; }
                </style>
            </head>
            <body>
                <div id="timer">05:00</div>
                <div id="score">0/10</div>
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    socket.on('updateTimer', (data) => {
                        const timerDiv = document.getElementById('timer');
                        timerDiv.innerText = data.time;
                        if (data.visible) { timerDiv.classList.add('show'); } else { timerDiv.classList.remove('show'); }
                    });
                    socket.on('updateScore', (data) => {
                        const s = document.getElementById('score');
                        s.innerText = data.score + '/10';
                        s.style.color = data.score > 0 ? '#28a745' : '#dc3545';
                    });
                </script>
            </body>
        </html>
    `);
});

app.get('/admin', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Admin System Test Panel</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: sans-serif; padding: 15px; text-align: center; background: #f4f6f9; margin: 0; }
                    h2 { color: #333; margin-top: 10px; font-size: 22px; }
                    .section-title { text-align: left; max-width: 450px; margin: 15px auto 5px auto; font-weight: bold; color: #666; font-size: 14px; }
                    .btn-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 450px; margin: 0 auto 15px auto; }
                    .btn { padding: 15px; font-size: 16px; font-weight: bold; color: white; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 3px 5px rgba(0,0,0,0.1); }
                    .btn-plus { background: #28a745; }
                    .btn-minus { background: #dc3545; }
                    .btn-start { background: #20c997; font-size: 18px; }
                    .btn-stop { background: #fd7e14; font-size: 18px; }
                    .btn-reset { background: #6c757d; grid-column: span 2; padding: 12px; font-size: 14px; }
                    #logContainer { max-width: 450px; margin: 15px auto; background: #222; color: #00ff00; border-radius: 10px; padding: 15px; text-align: left; box-shadow: inset 0 0 10px #000; font-family: monospace; font-size: 12px; }
                    .log-title { color: #fff; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 5px; display: flex; justify-content: space-between; }
                    #logs { max-height: 150px; overflow-y: auto; list-style: none; padding: 0; margin: 0; }
                    #logs li { margin-bottom: 6px; line-height: 1.4; border-bottom: 1px dashed #333; padding-bottom: 4px; }
                    .log-time { color: #888; } .log-success { color: #00ff00; } .log-admin { color: #00bcff; }
                </style>
            </head>
            <body>
                <h2>🎮 แผงควบคุม & ระบบเทสบอท</h2>
                <div class="section-title">⏱️ ควบคุมตัวจับเวลา (Timer Control):</div>
                <div class="btn-group">
                    <button class="btn btn-start" onclick="controlTimer('start')">▶️ เปิด (แสดงเวลา 5 นาที)</button>
                    <button class="btn btn-stop" onclick="controlTimer('stop')">⏹️ ปิด (ซ่อนเวลา/รีเซ็ต)</button>
                </div>
                <div class="section-title">🕹️ ปุ่มปรับคะแนนจำลอง (Manual):</div>
                <div class="btn-group">
                    <button class="btn btn-plus" onclick="changeScore(1)">➕ เพิ่ม (+1)</button>
                    <button class="btn btn-minus" onclick="changeScore(-1)">➖ ลด (-1)</button>
                    <button class="btn btn-plus" onclick="changeScore(10)">➕ เพิ่ม (+10)</button>
                    <button class="btn btn-minus" onclick="changeScore(-10)">➖ ลด (-10)</button>
                    <button class="btn btn-reset" onclick="resetGame()">🔄 รีเซ็ตคะแนนเกมใหม่ (เหลือ 0 แต้ม)</button>
                </div>
                <div class="section-title">🧪 ปุ่มจำลองการส่งกิฟต์จริงจาก TikTok:</div>
                <div class="btn-group">
                    <button class="btn" style="background:#ff851b;" onclick="testGift('5655')">🌹 เทสกุหลาบ 1 ชิ้น</button>
                    <button class="btn" style="background:#7fdbff; color:#333;" onclick="testGift('5269')">📱 เทส TikTok 1 ชิ้น</button>
                </div>
                <div id="logContainer">
                    <div class="log-title"><span>📋 บันทึกการตรวจจับระบบ (Logs)</span><span style="cursor:pointer; color:#ff4136;" onclick="clearLogs()">[ล้างจอ]</span></div>
                    <ul id="logs"><li><span class="log-time">[ระบบ]</span> เริ่มต้นระบบตรวจสอบ... บอทพร้อมทำงาน</li></ul>
                </div>
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    function controlTimer(action) { socket.emit('adminControlTimer', { action: action }); }
                    function changeScore(val) { socket.emit('adminChangeScore', { value: val }); }
                    function resetGame() { if(confirm('ต้องการรีเซ็ตคะแนนเป็น 0 ใช่ไหม?')) { socket.emit('adminResetGame'); } }
                    function testGift(id) { socket.emit('adminTestGift', { giftId: id }); }
                    function clearLogs() { document.getElementById('logs').innerHTML = ''; }
                    socket.on('logToAdmin', (data) => {
                        const logsUl = document.getElementById('logs'); const li = document.createElement('li'); const timeStr = new Date().toLocaleTimeString();
                        if(data.type === 'admin') { li.innerHTML = \`<span class="log-time">[\${timeStr}]</span> <span class="log-admin">[แอดมิน]</span> \${data.text}\`; } 
                        else { li.innerHTML = \`<span class="log-time">[\${timeStr}]</span> <span class="log-success">[TikTok]</span> \${data.text}\`; }
                        logsUl.insertBefore(li, logsUl.firstChild);
                    });
                </script>
            </body>
        </html>
    `);
});

function updateScore(amount, message, isAdmin = false) {
    currentScore += amount;
    io.emit('updateScore', { score: currentScore, msg: message });
    io.emit('logToAdmin', {
        type: isAdmin ? 'admin' : 'tiktok',
        text: `${message} | แต้มที่ปรับ: ${amount > 0 ? '+' + amount : amount} | คะแนนรวม: ${currentScore}`
    });
    console.log(`📈 อัปเดต: ${currentScore} | ${message}`);
}

function processGiftLogic(giftId, amount, sourceName = "User") {
    const gifts = {
        '5655': { val: 1, name: "Rose" },
        '5779': { val: 10, name: "I Love You" },
        '7264': { val: 100, name: "Mishaka Bear" },
        '7168': { val: 500, name: "Money Gun" },
        '5269': { val: -1, name: "TikTok" },
        '19448': { val: -10, name: "Slow motion" },
        '5585': { val: -100, name: "Confetti" },
        '13072': { val: -500, name: "Dragon Crown" }
    };

    if (gifts[giftId]) {
        const totalChange = gifts[giftId].val * amount;
        updateScore(totalChange, `${sourceName} ส่ง ${gifts[giftId].name} จำนวน ${amount} ชิ้น`, false);
    }
}

io.on('connection', (socket) => {
    socket.on('adminControlTimer', (data) => {
        if (data.action === 'start') { startTimerLogic(); } else if (data.action === 'stop') { stopTimerLogic(); }
    });
    socket.on('adminChangeScore', (data) => { updateScore(data.value, "กดปุ่มปรับมือด้วยตัวเอง", true); });
    socket.on('adminTestGift', (data) => { processGiftLogic(data.giftId, 1, "บอทจำลองระบบเทส"); }); // ปุ่มเทสให้ส่งค่า 1 ชิ้นปกติ
    socket.on('adminResetGame', () => {
        currentScore = 0;
        io.emit('updateScore', { score: currentScore, msg: "Game Reset" });
        io.emit('logToAdmin', { type: 'admin', text: '🔄 สั่งรีเซ็ตแต้มคะแนนเป็น 0 เรียบร้อย' });
    });
});

const tiktokConnection = new TikTokLiveClass("https://www.tiktok.com/@sekza03/live", {
    sessionid: "644082c09b889deb60d7f1c1767642ef"
});

tiktokConnection.connect().then(() => console.log("✅ บอทเชื่อมต่อแล้ว!")).catch(err => console.error(err));

// 🛡️ ระบบกรองสัญญาณของขวัญเวอร์ชันแก้ไขปัญหาแต้มเกินคอมโบ (+1 เสมอ)
tiktokConnection.on('gift', data => {
    const senderName = data.uniqueId || "คนดูในไลฟ์";

    // 1. ถ้าเป็นของขวัญประเภท "รัวคอมโบได้" (เช่น กุหลาบ)
    if (data.giftType === 1) {
        // ให้รอคิดเงิน "จังหวะสุดท้ายที่คนดูหยุดกด (repeatEnd)" ทีเดียวเท่านั้น! จังหวะรัวระหว่างทางข้ามไปเลย
        if (data.repeatEnd) {
            const finalAmount = data.repeatCount || 1;
            processGiftLogic(data.giftId, finalAmount, senderName);
        }
    } 
    // 2. ถ้าเป็นของขวัญชิ้นใหญ่ (กดทีเดียวส่งเลย ไม่คอมโบ เช่น ไอเลิฟยู, หมี, มงกุฎ)
    else {
        const singleAmount = data.repeatCount || 1;
        processGiftLogic(data.giftId, singleAmount, senderName);
    }
});

server.listen(3000, () => console.log('🚀 บอทรันแล้วที่ http://localhost:3000'));
