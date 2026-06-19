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

// 1. หน้าจอหลัก (สำหรับใส่ใน OBS) - คลีน 100% ไม่มีปุ่ม ไม่มีล็อกโชว์
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
                <div id="score">0/10</div>
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    socket.on('updateTimer', (t) => document.getElementById('timer').innerText = t);
                    socket.on('updateScore', (d) => {
                        const s = document.getElementById('score');
                        s.innerText = d.score + '/10';
                        s.style.color = d.score > 0 ? '#28a745' : '#dc3545';
                    });
                </script>
            </body>
        </html>
    `);
});

// 2. หน้าแผงควบคุมแอดมิน + ระบบเทสและรายงานผลตรวจจับกิฟต์
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
                    .btn-reset { background: #6c757d; grid-column: span 2; padding: 12px; font-size: 14px; }
                    
                    /* กล่องระบบล็อกเทส */
                    #logContainer { max-width: 450px; margin: 15px auto; background: #222; color: #00ff00; border-radius: 10px; padding: 15px; text-align: left; box-shadow: inset 0 0 10px #000; font-family: 'Courier New', Courier, monospace; font-size: 12px; }
                    .log-title { color: #fff; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 5px; display: flex; justify-content: space-between; }
                    #logs { max-height: 180px; overflow-y: auto; list-style: none; padding: 0; margin: 0; }
                    #logs li { margin-bottom: 6px; line-height: 1.4; border-bottom: 1px dashed #333; padding-bottom: 4px; }
                    .log-time { color: #888; }
                    .log-success { color: #00ff00; }
                    .log-admin { color: #00bcff; }
                </style>
            </head>
            <body>
                <h2>🎮 แผงควบคุม & ระบบเทสบอท</h2>
                
                <div class="section-title">🕹️ ปุ่มปรับคะแนนจำลอง (Manual):</div>
                <div class="btn-group">
                    <button class="btn btn-plus" onclick="changeScore(1)">➕ เพิ่ม (+1)</button>
                    <button class="btn btn-minus" onclick="changeScore(-1)">➖ ลด (-1)</button>
                    <button class="btn btn-plus" onclick="changeScore(10)">➕ เพิ่ม (+10)</button>
                    <button class="btn btn-minus" onclick="changeScore(-10)">➖ ลด (-10)</button>
                    <button class="btn btn-reset" onclick="resetGame()">🔄 รีเซ็ตเกม (0 แต้ม / 5 นาที)</button>
                </div>

                <div class="section-title">🧪 ปุ่มจำลองการส่งกิฟต์จริงจาก TikTok (ใช้เทสหลังบ้าน):</div>
                <div class="btn-group">
                    <button class="btn" style="background:#ff851b;" onclick="testGift('5655')">🌹 เทสกุหลาบ 1 ชิ้น</button>
                    <button class="btn" style="background:#7fdbff; color:#333;" onclick="testGift('5269')">📱 เทส TikTok 1 ชิ้น</button>
                </div>

                <div id="logContainer">
                    <div class="log-title">
                        <span>📋 บันทึกการตรวจจับระบบ (Logs)</span>
                        <span style="cursor:pointer; color:#ff4136;" onclick="clearLogs()">[ล้างจอ]</span>
                    </div>
                    <ul id="logs">
                        <li><span class="log-time">[ระบบ]</span> เริ่มต้นระบบตรวจสอบ... บอทพร้อมทำงาน</li>
                    </ul>
                </div>

                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    
                    function changeScore(val) { socket.emit('adminChangeScore', { value: val }); }
                    function resetGame() { if(confirm('ต้องการรีเซ็ตไหม?')) { socket.emit('adminResetGame'); } }
                    function testGift(id) { socket.emit('adminTestGift', { giftId: id }); }
                    function clearLogs() { document.getElementById('logs').innerHTML = ''; }

                    // ฟังคำสั่งจาก Server เพื่อเอามาพิมพ์ลงในหน้าจอ Logs
                    socket.on('logToAdmin', (data) => {
                        const logsUl = document.getElementById('logs');
                        const li = document.createElement('li');
                        const timeStr = new Date().toLocaleTimeString();
                        
                        if(data.type === 'admin') {
                            li.innerHTML = \`<span class="log-time">[\${timeStr}]</span> <span class="log-admin">[แอดมิน]</span> \${data.text}\`;
                        } else {
                            li.innerHTML = \`<span class="log-time">[\${timeStr}]</span> <span class="log-success">[TikTok]</span> \${data.text}\`;
                        }
                        
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
    
    // ส่งข้อมูลล็อกไปแสดงผลที่หน้าจอควบคุมแอดมินด้วย
    io.emit('logToAdmin', {
        type: isAdmin ? 'admin' : 'tiktok',
        text: `คำสั่ง: ${message} | แต้มที่ปรับ: ${amount > 0 ? '+' + amount : amount} | แต้มรวมปัจจุบัน: ${currentScore}`
    });
    
    console.log(`📈 อัปเดต: ${currentScore} | ${message}`);
    startTimer(); 
}

function processGiftLogic(giftId, amount, sourceName = "User") {
    const gifts = {
        '5655': { val: 1, name: "Rose" },
        '5779': { val: 10, name: "I Love You" },
        '7264': { val: 100, name: "Mishka Bear" },
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

// ระบบจัดการคำสั่งจากหน้าแอดมิน/หน้าเทส
io.on('connection', (socket) => {
    socket.on('adminChangeScore', (data) => {
        updateScore(data.value, "กดปุ่มปรับมือด้วยตัวเอง", true);
    });
    
    // ระบบจำลองรับสัญญาณส่งกิฟต์เสมือนจริง (ปุ่มสีส้ม/ฟ้า)
    socket.on('adminTestGift', (data) => {
        processGiftLogic(data.giftId, 1, "บอทจำลองระบบเทส");
    });

    socket.on('adminResetGame', () => {
        currentScore = 0;
        timeLeft = 300;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        io.emit('updateScore', { score: currentScore, msg: "Game Reset" });
        io.emit('updateTimer', formatTime(timeLeft));
        io.emit('logToAdmin', { type: 'admin', text: '🔄 สั่งรีเซ็ตแต้มเป็น 0 และเวลาเป็น 5 นาทีเรียบร้อย' });
    });
});

// เชื่อมต่อ TikTok
const tiktokConnection = new TikTokLiveClass("https://www.tiktok.com/@sekza03/live", {
    sessionid: "644082c09b889deb60d7f1c1767642ef"
});

tiktokConnection.connect().then(() => console.log("✅ บอทเชื่อมต่อแล้ว!")).catch(err => console.error(err));

// ระบบตรวจจับกิฟต์แบบรายชิ้นจริง
tiktokConnection.on('gift', data => {
    let actualAmount = 1;

    if (data.giftType === 1 && data.repeatEnd) {
        actualAmount = data.repeatCount || 1;
    } else if (data.giftType === 1 && !data.repeatEnd) {
        actualAmount = 1;
    }

    // ดึงชื่อคนส่งมาแสดงในกล่องบันทึกข้อมูลเพื่อความแม่นยำ
    const senderName = data.uniqueId || "คนดูในไลฟ์";
    processGiftLogic(data.giftId, actualAmount, senderName);
});

server.listen(3000, () => console.log('🚀 บอทรันแล้วที่ http://localhost:3000'));
