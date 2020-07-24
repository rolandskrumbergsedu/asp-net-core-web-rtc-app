var hubUrl = document.location.pathname + 'ConnectionHub';

var signalRConnection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, signalR.HttpTransportType.WebSockets)
    .build();

var peerConnectionConfig = {
    "iceServers": ICE_SERVERS
}

var localStream = null;
var localVideo = null;
var remoteVideo = null;

$(document).ready(function () {
    initializeSignalR();

    localVideo = document.getElementById('local-video');
    remoteVideo = document.getElementById('remote-video');
});

const initializeSignalR = () => {
    signalRConnection.start()
        .then(() => {
            console.log("SignalR connected.");
            askUsername();
        })
        .catch((error) => { console.log(error) });
};

const setUsername = (username) => {
    console.log('SignalR: Setting username.');

    signalRConnection.invoke('Join', username)
        .catch((err) => {
            console.log(err);
        });

    $('#upper-username').text(username);

   initializeUserMedia();
};

const askUsername = () => {
    console.log("SignalR: Asking username.");

    alertify.prompt('Select a username', 'What is your name?', '', (evt, usernameFromPrompt) => {
        if (usernameFromPrompt !== '') {
            setUsername(usernameFromPrompt);
        }
        else {
            generateRandomUsername();
        }
    }, () => {
            generateRandomUsername();
    });
};

const generateRandomUsername = () => {

    console.log('SignalR: Generating random username.');

    let username = 'User ' + Math.floor((Math.random() * 10000) + 1);

    alertify.success('Your generated username: ' + username);

    setUsername(username);
};

const initializeUserMedia = () => {
    console.log('WebRTC: Initialize user media.');
    navigator.getUserMedia(WEBRTC_CONSTRAINTS, userMediaSuccess, errorHandler);
};

const userMediaSuccess = (stream) => {
    console.log('WebRTC: Got user media.');
    localStream = stream;

    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();

    localVideo.srcObject = stream;
};

const errorHandler = () => {

};