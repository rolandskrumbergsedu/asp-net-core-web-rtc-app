﻿var hubUrl = document.location.pathname + 'ConnectionHub';

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

    // TO DO: Rest of the logic
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

    //const videoTracks = localStream.getVideoTracks();
    //const audioTracks = localStream.getAudioTracks();

    localVideo.srcObject = stream;
};

sendHubSignal = (candidate, partnerClientId) => {
    console.log('candidate', candidate);
    console.log('SignalR: Called sendhubsignal');

    signalRConnection
        .invoke('sendsignal', candidate, partnerClientId)
        .catch(errorHandler);
};

signalRConnection.onclose(e => {
    if (e) {
        console.log('SignalR: Closed with error.');
        console.log(e);
    }
    else {
        console.log('SignalR: Disconnected.');
    }
});

signalRConnection.on('updateUserList', (userList) => {
    console.log('SignalR: Called updateUserList with data - ' + JSON.stringify(userList));
    $('#users-length').text(userList.length);
    $('#users-data li.user').remove();

    $.each(userList, function (index) {
        var status = '';
        if (userList[index].username === $('#upper-username').text()) {
            myConnectionId = userList[index].connectionId;
            status = 'Me';
        }
        status = userList[index].inCall ? 'In call' : 'Available';

        var listString = '<li class="list-group-item user" data-cid="' + userList[index].connectionId + '" data-username="' + userList[index].username + '">';
        listString += '<a href="#"><span class="username">' + userList[index].username + '</span>';
        listString += '<span class="user-status"> ' + status + '</span></a></li>';
        $('#users-data').append(listString);
    });
});

const errorHandler = (error) => {
    console.log(error);
};