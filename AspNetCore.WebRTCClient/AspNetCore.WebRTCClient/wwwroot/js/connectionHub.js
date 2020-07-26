var hubUrl = document.location.pathname + 'ConnectionHub';

var signalRConnection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl)
    .build();

var peerConnectionConfig = {
    "iceServers": ICE_SERVERS
}

var localVideo = null;
var remoteVideo = null;

var connections = {};

$(document).ready(function () {
    initializeSignalR();

    localVideo = document.getElementById('local-video');
    remoteVideo = document.getElementById('remote-video');

    $(document).on('click', '.user', function () {
        console.log('Calling user...');

        var targetConnectionId = $(this).attr('data-cid');

        if ($('body').attr('data-mode') !== 'idle') {
            alertify.error('Sorry, you are already in a call. Conferencing is not yet implemented.');
            return;
        }

        if (targetConnectionId !== myConnectionId) {
            signalRConnection.invoke('callUser', {
                "connectionId": targetConnectionId
            });

            $('body').attr('data-mode', 'calling');
            $('#call-status').text('Calling...');
        } else {
            alertify.error('Cant call yourself.');
        }
    });

    $('.hangup').click(function () {
        console.log('Hanging up...');

        if ($('body').attr('data-mode') !== 'idle') {
            signalRConnection.invoke('hangUp');
            closeAllConnections();
            $('body').attr('data-mode', 'idle');
            $('#call-status').text('Idle')
        };
    });

});

function receivedCandidateSignal(connection, candidate) {
    console.log('WebRTC: Adding full candidate.', candidate);

    var candidate = new RTCIceCandidate(candidate);

    connection.addIceCandidate(candidate)
        .catch(e => {
            console.log('Failed to add ICE candidate.', e);
        });
};

function receivedSdpSignal(connection, partnerClientId, sdp) {
    console.log('WebRTC: Processing SDP signal.');

    var desc = new RTCSessionDescription(sdp);
    connection.setRemoteDescription(desc)
        .then(function () {
            console.log('Getting user devices.');
            return navigator.mediaDevices.getUserMedia(WEBRTC_CONSTRAINTS);
        })
        .then(function (stream) {
            console.log('Setting local stream.');

            localVideo.srcObject = stream;

            stream.getTracks().forEach(
                transceiver = track => connection.addTransceiver(track, { streams: [stream] }));
            console.log('Local stream set.');
        })
        .then(function () {
            console.log('WebRTC: Creating answer.');
            return connection.createAnswer();
        })
        .then(function (answer) {
            console.log('WebRTC: Setting answer as local description.');
            return connection.setLocalDescription(answer);
        })
        .then(function () {
            console.log('WebRTC: Sending answer as SDP.');
            sendHubSignal(JSON.stringify({ "sdp": connection.localDescription }), partnerClientId);
        })
        .catch(handleGetUserMediaError);
};

function newSignal(partnerClientId, data) {
    console.log('WebRTC: Called newSignal()');

    var signal = JSON.parse(data);
    var connection = getConnection(partnerClientId);

    if (signal.sdp) {
        console.log('WebRTC: Received SDP signal');
        receivedSdpSignal(connection, partnerClientId, signal.sdp);
    } else if (signal.candidate) {
        console.log('WebRTC: Received Candidate signal');
        receivedCandidateSignal(connection, signal.candidate);
    } else {
        console.log('WebRTC: Adding null candidate');
        connection.addIceCandidate(null, () => console.log('Added null candidate'), () => console.log('WebRTC: Cannot add null candidate.'));
    } 
};

function initializeSignalR() {
    signalRConnection.start()
        .then(() => {
            console.log("SignalR connected.");
            askUsername();
        })
        .catch((error) => { console.log(error) });
};

function setUsername(username) {
    console.log('SignalR: Setting username.');

    signalRConnection.invoke('Join', username)
        .catch((err) => {
            console.log(err);
        });

    $('#upper-username').text(username);

};

function askUsername() {
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

function generateRandomUsername() {

    console.log('SignalR: Generating random username.');

    let username = 'User ' + Math.floor((Math.random() * 10000) + 1);

    alertify.success('Your generated username: ' + username);

    setUsername(username);
};

function getConnection(partnerClientId) {
    console.log('WebRTC: Called getConnection()');
    if (connections[partnerClientId]) {
        console.log('WebRTC: Connections partner client exists.');
        return connections[partnerClientId];
    }
    else {
        console.log('WebRTC: Initializing new connection.');
        return initializeConnection(partnerClientId);
    }
};

function initiateOffer(partnerClientId) {
    console.log('WebRTC: Called initiateOffer.');
    var connection = getConnection(partnerClientId);

    navigator.mediaDevices.getUserMedia(WEBRTC_CONSTRAINTS)
        .then(function (stream) {
            document.getElementById('local-video').srcObject = stream;
            stream.getTracks().forEach(
                transceiver = track => connection.addTransceiver(track, {streams: [stream] }));
        })
        .catch(handleGetUserMediaError);

    console.log('WebRTC: Added local stream.');
};

function handleGetUserMediaError(e) {
    switch (e.name) {
        case "NotFoundError":
            console.log("Unable to open a call because no camera and/or microphone were found.");
            break;
        case "SecurityError":
        case "PermissionDeniedError":
            console.log("Security issue accessing user media.");
            break;
        default:
            console.log("Error accessing user media.", e);
            break;
    }

    //closeAllConnections();
}

function closeConnection(partnerClientId) {
    console.log('WebRTC: Closing connection ' + partnerClientId);
    var connection = connections[partnerClientId];

    if (connection) {
        connection.ontrack = null;
        connection.onremovetrack = null;
        connection.onremovestream = null;
        connection.onicecandidate = null;
        connection.oniceconnectionstatechange = null;
        connection.onicegatheringstatechange = null;
        connection.onsignalingstatechange = null;
        connection.onnegotiationneeded = null;

        if (localVideo.srcObject) {
            localVideo.srcObject.getTracks().forEach(track => track.stop());
        }

        if (remoteVideo.srcObject) {
            remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        }

        connection.close();
        connection = null;
    }

    localVideo.removeAttribute('src');
    localVideo.removeAttribute('srcObject');
    remoteVideo.removeAttribute('src');
    remoteVideo.removeAttribute('srcObject');
}

function closeAllConnections() {
    console.log('WebRTC: Closing all connections.');
    for (var connectionId in connections) {
        closeConnection(connectionId);
    }
};

function handleIceCandidate(evt, partnerClientId) {
    console.log('WebRTC: ICE Candidate callback.');
    if (evt.candidate) {
        console.log('WebRTC: New ICE candidate.');
        sendHubSignal(JSON.stringify({ "candidate": evt.candidate }), partnerClientId);
    } else {
        console.log('WebRTC: ICE candidate gathering done.');
        sendHubSignal(JSON.stringify({ "candidate": null }), partnerClientId);
    }
}

function handleTrackEvent(event) {
    console.log('WebRTC: Adding remote track.');
    remoteVideo.srcObject = event.streams[0];
}

function handleRemoveTrackEvent(event) {
    console.log('WebRTC: Removing remote track.');
    var stream = remoteVideo.srcObject;
    var trackList = stream.getTracks();

    if (trackList.length == 0) {
        closeAllConnections();
    }
}

function handleNegotiationNeededEvent(connection, evt, partnerClientId) {
    connection.createOffer()
        .then(function (offer) {

            console.log('WebRTC: Created offer.');
            console.log('WebRTC: Setting local description.');

            return connection.setLocalDescription(offer);
        })
        .then(function () {
            console.log('SignalR: Sending local description as SDP to partner.');
            sendHubSignal(JSON.stringify({
                "sdp": connection.localDescription
            }), partnerClientId);
        })
        .catch(errorHandler);
}

function handleICEConnectionStateChangeEvent(connection, event) {
    console.log('ICE connection state changed to: ' + connection.iceConnectionState);
    switch (connection.iceConnectionState) {
        case 'closed':
        case 'failed':
            closeAllConnections();
            break;
    }
}

function handleSignalingStateChangeEvent(connection, event) {
    console.log('Signaling state changed to: ' + connection.signalingState);
    switch (connection.signalingState) {
        case 'closed':
            closeAllConnections();
            break;
    }
}

function handleICEGatheringStateChangeEvent(connection, event) {
    console.log('Signaling state changed to: ' + connection.iceGatheringState);
}

function initializeConnection(partnerClientId) {
    console.log('WebRTC: Initializing connection..');

    var connection = new RTCPeerConnection(peerConnectionConfig);

    connection.onicecandidate = evt => handleIceCandidate(evt, partnerClientId);
    connection.ontrack = evt => handleTrackEvent(evt);
    connection.onnegotiationneeded = evt => handleNegotiationNeededEvent(connection, evt, partnerClientId);
    connection.onremovetrack = evt => handleRemoveTrackEvent(evt);
    connection.oniceconnectionstatechange = evt => handleICEConnectionStateChangeEvent(connection, evt);
    connection.onicegatheringstatechange = evt => handleICEGatheringStateChangeEvent(connection, evt);
    connection.onsignalingstatechange = evt => handleSignalingStateChangeEvent(connection, evt);

    connections[partnerClientId] = connection;
    return connection;

};

function sendHubSignal(message, partnerClientId) {
    console.log('message', message);
    console.log('SignalR: Called sendhubsignal');

    signalRConnection
        .invoke('sendsignal', message, partnerClientId)
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

signalRConnection.on('incomingCall', (callingUser) => {
    console.log('SignalR: Incoming call from ' + JSON.stringify(callingUser));

    alertify.confirm(callingUser.username + ' is calling. Do you want to chat?', function (e) {
        if (e) {
            //Accepted
            signalRConnection
                .invoke('AnswerCall', true, callingUser)
                .catch(err => console.log(err));

            $('body').attr('data-mode', 'incall');
            $('#call-status').text('In call')
        } else {
            signalRConnection
                .invoke('AnswerCall', false, callingUser)
                .catch(err => console.log(err));
        }
    });
});

signalRConnection.on('receiveSignal', (signalingUser, signal) => {
    newSignal(signalingUser.connectionId, signal);
});

signalRConnection.on('callAccepted', (acceptingUser) => {
    console.log('SignalR: Call accepted from: ' + JSON.stringify(acceptingUser) + '. Initiating WebRTC call and offering my stream up..');

    initiateOffer(acceptingUser.connectionId);
    $('body').attr('data-mode', 'incall');
    $('#call-status').text('In call')

});

signalRConnection.on('callDeclined', (decliningUser, reason) => {
    console.log('SignalR: Call declined from: ' + JSON.stringify(decliningUser));

    alertify.error(reason);

    $('body').attr('data-mode', 'idle');
    $('#call-status').text('Idle');
});

signalRConnection.on('callEnded', (signalingUser, signal) => {
    console.log('SignalR: Call with ' + JSON.stringify(signalingUser) + ' has ended: ' + signal);

    alertify.error(reason);

    closeConnection(signalingUser.connectionId);

    $('body').attr('data-mode', 'idle');
    $('#call-status').text('Idle');
});

const errorHandler = (error) => {
    console.log(error);
};