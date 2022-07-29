const socket = io();

const myFaceVideo = document.getElementById("myFace");
const muteButton = document.getElementById("mute");
const cameraButton = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

const welcome = document.getElementById("welcome");
const call = document.getElementById("call");
const peerStreams = document.getElementById("peerStreams");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let peerConnections = new Map();

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach((camera) => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if (currentCamera.label === camera.label) {
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        });
    } catch (e) {
        console.log(e)
    }
}

async function getMedia(deviceId) {
    const initialConstrains = {
        audio: true,
        video: { facingMode: "user" },
    };
    const cameraConstrains = {
        audio: true,
        video: { deviceId: { exact: deviceId } },
    };

    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstrains : initialConstrains
        );
        myFaceVideo.srcObject = myStream;
        if (!deviceId) {
            await getCameras();
        }
    } catch (e) {
        console.log(e);
    }
}

//getMedia();

function handleMuteClick() {
    myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    if (!muted) {
        muteButton.innerText = "Unmute";
        muted = true;
    } else {
        muteButton.innerText = "Mute";
        muted = false;
    }
}

function handleCameraClick() {
    myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
    if (cameraOff) {
        cameraButton.innerText = "Turn Camera Off";
        cameraOff = false;
    } else {
        cameraButton.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange() {
    await getMedia(camerasSelect.value);
    for (var [key, value] of peerConnections) {
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = value.getSenders().find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

function getRemoteStreamVideo(stream) {
    const videos = peerStreams.querySelectorAll("video");
    for (let i = 0;  i < videos.length; i++) {
        if (stream instanceof MediaStream) {
            if (videos[i].srcObject.id === stream.id) {
                return videos[i];
            }
        } else if (stream instanceof MediaStreamTrack) {
            if (videos[i].srcObject.getVideoTracks()[0].id === stream.id) {
                return videos[i];
            }
        }
    }
}

muteButton.addEventListener("click", handleMuteClick);
cameraButton.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcom Form (join a room)

welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket Code
//A
socket.on("welcome", async (socketId) => {
    makeConnection(socketId);
    const peerConnection = peerConnections.get(socketId);
    const offer = await peerConnection.createOffer();
    peerConnection.setLocalDescription(offer);
    socket.emit("offer", offer, socketId);
});
//B
socket.on("offer", async (offer, socketId) => {
    makeConnection(socketId);
    const peerConnection = peerConnections.get(socketId);
    peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    peerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, socketId);
});
//A - 확인 필요
//have-local-offer
//have-remote-offer
socket.on("answer", (answer, socketId) => {
    console.log('answer - ', socketId);
    const peerConnection = peerConnections.get(socketId);
    console.log('answer signalingState - ', peerConnection.signalingState);
    if (!peerConnection.remoteDescription  && (peerConnection.signalingState === "have-local-offer" || peerConnection.signalingState === "have-remote-offer")) {
        peerConnection.setRemoteDescription(answer);
    }
});

socket.on("ice", (ice, socketId) => {
    if (ice) {
        const peerConnection = peerConnections.get(socketId);
        if (peerConnection) {
            peerConnection.addIceCandidate(ice);
        }
    }
});
//signalingState = "stable"
socket.on("leave", (socketId) => {
    console.log('leave - ', socketId);
    const peerConnection = peerConnections.get(socketId);
    console.log('leave - ', peerConnection);
    //video view 삭제, peerConnection close, Map 에서 삭제
    //getRemoteStreams() not work! in safari
    let remoteStream;
    if (peerConnection.getRemoteStreams) {
        remoteStream = peerConnection.getRemoteStreams()[0];
    } else {
        remoteStream = peerConnection.getReceivers().find((receiver) => receiver.track.kind === "video").track;
    }
    const remoteStreamVideo = getRemoteStreamVideo(remoteStream);
    console.log('leave remoteStreamVideo - ', remoteStreamVideo);
    if (remoteStreamVideo) {
        peerStreams.removeChild(remoteStreamVideo);
    }
    peerConnection.close();
    peerConnections.delete(socketId);
});

// WEB RTC Code

function makeConnection(socketId) {
    let peerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                ],
            },
        ],
    });
    peerConnection.addEventListener("icecandidate", handleIce);
    //safari 에서 사용 안됨
    //peerConnection.addEventListener("addstream", handleAddStream);
    if (peerConnection.addTrack !== undefined) {
        peerConnection.ontrack = event => {
            event.streams.forEach(stream => handleAddStream(stream));
        }
    } else {
        peerConnection.onaddstream = event => {
            handleAddStream(event.stream);
        }
    }
    myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream));
    peerConnections.set(socketId, peerConnection);
}

function handleIce(data) {
    console.log('handleIce - ', data.candidate);
    for (let [key, value] of peerConnections) {
        if (value === data.target) {
            console.log('handleIce - ', key);
            socket.emit("ice", data.candidate, key);
            break;
        }
    }
}

//video#peerFace(autoplay, playsinline, width="400", height="400")

function handleAddStream(stream) {
    const addedVideo = getRemoteStreamVideo(stream);
    console.log('handleAddStream isAddedVideo - ', addedVideo);
    if (!addedVideo) {
        const peerFace = document.createElement("video");
        peerFace.autoplay = true;
        peerFace.playsinline = true;
        peerFace.width = 400;
        peerFace.height = 400;
        peerFace.srcObject = stream;
    
        peerStreams.appendChild(peerFace);
    } 
}