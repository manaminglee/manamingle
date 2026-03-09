import { io } from "socket.io-client";
const socket1 = io("http://localhost:3000", { path: '/socket.io', transports: ['websocket'] });
const socket2 = io("http://localhost:3000", { path: '/socket.io', transports: ['websocket'] });

let s1id = null;
let s2id = null;

socket1.on("connect", () => {
    console.log("S1 Connected!", socket1.id);
    s1id = socket1.id;
    socket1.emit("find-partner", { mode: "text", interest: "test" });
});

socket2.on("connect", () => {
    console.log("S2 Connected!", socket2.id);
    s2id = socket2.id;
    socket2.emit("find-partner", { mode: "text", interest: "test" });
});

socket1.on("partner-found", (data) => {
    console.log("S1 matched with:", data.peer.socketId, "Room:", data.roomId);
    socket1.emit("send-message", { roomId: data.roomId, text: "Hello from 1!" });
});

socket2.on("partner-found", (data) => {
    console.log("S2 matched with:", data.peer.socketId, "Room:", data.roomId);
});

socket2.on("chat-message", (msg) => {
    if (msg.nickname === "Anonymous" && msg.text === "Hello from 1!") {
        console.log("✅ S2 Received Message:", msg.text);
        socket2.emit("send-message", { roomId: msg.roomId, text: "Hello from 2!" });
    }
});

socket1.on("chat-message", (msg) => {
    if (msg.nickname === "Anonymous" && msg.text === "Hello from 2!" && !msg.fromSelf) {
        console.log("✅ S1 Received Message:", msg.text);
        console.log("🚀 Text Chat Matchmaking AND Messaging works perfectly!");
        process.exit(0);
    }
});

setTimeout(() => {
    console.log("❌ Timeout! Failed.");
    process.exit(1);
}, 6000);
