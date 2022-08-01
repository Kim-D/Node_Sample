import express from "express";
import http from "http";
import SocketIO from "socket.io";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));

app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

wsServer.on("connection", (socket) => {
    socket.on("join_room", async (roomName) => {
        await socket.join(roomName);
        //console.log('==== room client - ', socket.adapter.rooms.get(roomName));
        socket.to(roomName).emit("welcome", socket.id);
    });

    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => socket.to(room).emit("leave", socket.id));
    });

    socket.on("roomExit", (roomName) => {
        socket.leave(roomName);
        socket.to(roomName).emit("leave", socket.id);
    });

    socket.on("offer", (offer, receiveSocketId) => {
        socket.to(receiveSocketId).emit("offer", offer, socket.id);
    });

    socket.on("answer", (answer, receiveSocketId) => {
        socket.to(receiveSocketId).emit("answer", answer, socket.id);
        //socket.rooms.forEach((room) => socket.to(room).emit("answer", answer, socket.id));
    });

    socket.on("ice", (ice, receiveSocketId) => {
        socket.to(receiveSocketId).emit("ice", ice, socket.id);
    });
});

const handleListen = () => console.log('Listening on http://localhost:3000');
httpServer.listen(3000, handleListen);