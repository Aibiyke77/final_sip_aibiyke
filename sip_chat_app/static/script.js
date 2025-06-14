const socket = io();

let localStream;
let peerConnection;

const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Создание и настройка peerConnection
async function createPeerConnection(to) {
    peerConnection = new RTCPeerConnection(config);

    // Запрашиваем аудио у пользователя при необходимости
    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    // Добавляем аудиодорожки в peerConnection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Отправка ICE кандидатов
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            const from = document.getElementById("username").value.trim();
            const iceMsg = `ICE\nFrom: ${from}\nTo: ${to}\nBody:${JSON.stringify(event.candidate)}`;
            socket.emit('sip_message', iceMsg);
        }
    };

    // Обработка удалённых аудиопотоков
    peerConnection.ontrack = (event) => {
        const remoteAudio = document.getElementById("remoteAudio");
        if (remoteAudio.srcObject !== event.streams[0]) {
            remoteAudio.srcObject = event.streams[0];
            console.log('Получен удалённый аудиопоток');
        }
    };
}

// Отправка INVITE (SIP-сообщение)
function sendInvite() {
    const from = document.getElementById("username").value.trim();
    const to = document.getElementById("to_user").value.trim();
    if (!from || !to) {
        alert("Введите имя и кому отправляете");
        return;
    }
    const sipMessage = `INVITE sip:${to}@sip.local SIP/2.0\nFrom: ${from}\nTo: ${to}`;
    socket.emit("sip_message", sipMessage);
}

// Отправка текстового SIP-сообщения
function sendMessage() {
    const from = document.getElementById("username").value.trim();
    const text = document.getElementById("message").value.trim();
    if (!from || !text) {
        alert("Введите имя и сообщение");
        return;
    }
    const sipMessage = `MESSAGE sip:* SIP/2.0\nFrom: ${from}\nBody: ${text}`;
    socket.emit("sip_message", sipMessage);
    document.getElementById("message").value = "";
}

// Инициация звонка (создание оффера)
async function startCall() {
    const from = document.getElementById("username").value.trim();
    const to = document.getElementById("to_user").value.trim();
    if (!from || !to) {
        alert("Введите имя и кому звоните");
        return;
    }
    await createPeerConnection(to);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const sipOffer = `OFFER sip:${to}@sip.local SIP/2.0\nFrom: ${from}\nTo: ${to}\nBody:${JSON.stringify(offer)}`;
    socket.emit('sip_message', sipOffer);
}

// Принятие входящего звонка
async function acceptCall(from, offer) {
    await createPeerConnection(from);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    const myName = document.getElementById("username").value.trim();
    const sipAnswer = `ANSWER sip:${from}@sip.local SIP/2.0\nFrom: ${myName}\nTo: ${from}\nBody:${JSON.stringify(answer)}`;
    socket.emit('sip_message', sipAnswer);
}

// Обработка входящих SIP-сообщений
socket.on('sip_message', async (data) => {
    const lines = data.split('\n');
    const type = lines[0].split(' ')[0];
    const fromLine = lines.find(line => line.startsWith('From:'));
    const toLine = lines.find(line => line.startsWith('To:'));
    const bodyLine = lines.find(line => line.startsWith('Body:'));

    const from = fromLine ? fromLine.substring(5).trim() : null;
    const to = toLine ? toLine.substring(3).trim() : null;
    const body = bodyLine ? bodyLine.substring(5).trim() : null;

    const myName = document.getElementById("username").value.trim();

    // Игнорируем сообщения, которые не адресованы нам
    if (to && to !== myName && to !== '*') return;

    if (type === 'OFFER') {
        const offer = JSON.parse(body);
        console.log("Получено OFFER от", from);
        await acceptCall(from, offer);

    } else if (type === 'ANSWER') {
        const answer = JSON.parse(body);
        console.log("Получено ANSWER");
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

    } else if (type === 'ICE') {
        const candidate = JSON.parse(body);
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("ICE кандидат добавлен");
        }

    } else {
        // Обработка обычных сообщений в чат
        const chat = document.getElementById("chat");
        chat.innerHTML += data + "\n\n";
        chat.scrollTop = chat.scrollHeight;
    }
});
