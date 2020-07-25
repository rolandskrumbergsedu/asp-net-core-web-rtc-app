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

attachMediaStream = (e) => {
    console.log('Called attachMediaStream()');

    remoteVideo.srcObject = e.stream;
};

const receivedCandidateSignal = (connection, partnerClientId, candidate) => {
    console.log('WebRTC: Adding full candidate.', candidate);

    connection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(e => {
            console.log('Failed to add ICE candidate.', e);
        });
};

const receivedSdpSignal = (connection, partnerClientId, sdp) => {
    console.log('WebRTC: Processing SDP signal.');

    connection.setRemoteDescription(new RTCSessionDescription(sdp), () => {
        console.log('WebRTC: Setting remote description.');
        if (connection.remoteDescription.type = 'offer') {
            console.log('WebRTC: Remote description type is offer.');
            connection.addStream(localStream);
            console.log('WebRTC: Added local stream to connection.');
            connection.createAnswer()
                .then((desc) => {
                    console.log('WebRTC: Creating answer..');
                    connection.setLocalDescription(desc, () => {
                        console.log('WebRTC: Setting local description.')
                        sendHubSignal(JSON.stringify({ "sdp": connection.localDescription }), partnerClientId);
                    }, errorHandler);

                }, errorHandler);
        } else if (connection.remoteDescription.type = 'answer') {
            console.log('WebRTC: Remote description type is answer.');
        }

    }, errorHandler);
};

const newSignal = (partnerClientId, data) => {
    console.log('WebRTC: Called newSignal()');

    var signal = JSON.parse(data);
    var connection = getConnection(partnerClientId);

    if (signal.idp) {
        console.log('WebRTC: Received SDP signal');
        receivedSdpSignal(connection, partnerClientId, signal.sdp);
    } else if (signal.candidate) {
        console.log('WebRTC: Received Candidate signal');
        receivedCandidateSignal(connection, partnerClientId, signal.candidate);
    } else {
        console.log('WebRTC: Adding null candidate');
        connection.addIceCandidate(null, () => console.log('Added null candidate'), () => console.log('WebRTC: Cannot add null candidate.'));
    } 
};

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

const getConnection = (partnerClientId) => {
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

const initiateOffer = (partnerClientId, stream) => {
    console.log('WebRTC: Called initiateOffer.');
    var connection = getConnection(partnerClientId);

    connection.addStream(stream);
    console.log('WebRTC: Added local stream.');

    connection.createOffer()
        .then(offer => {
            console.log('WebRTC: Created offer.');
            console.log('WebRTC: Description after offer - ', offer);
            connection.setLocalDescription(offer)
                .then(() => {
                    console.log('WebRTC: Set local description.');
                    console.log('WebRTC: Connection before sending offer - ', connection);
                    setTimeout(() => {
                        sendHubSignal(JSON.stringify({"sdp": connection.localDescription}), partnerClientId);
                    }, 1000);
                })
                .catch(err => console.error('WebRTC: Error while setting local description', err));
        })
        .catch(err => console.error('WebRTC: Error while creating offer', err));
};

const userMediaSuccess = (stream) => {
    console.log('WebRTC: Got user media.');
    localStream = stream;
    localVideo.srcObject = stream;
};

const onStreamRemoved = (connection, stream) => {
    console.log('WebRTC: Stream removed.')
    console.log('Stream: ', stream);
    console.log('Connection: ', connection);
};

const closeConnection = (partnerClientId) => {
    console.log('WebRTC: Closing connection ' + partnerClientId);
    var connection = connections[partnerClientId];

    if (connection) {
        onStreamRemoved(null, null);
        connection.close();
        delete connections[partnerClientId];
    }
}

const closeAllConnections = () => {
    console.log('WebRTC: Closing all connections.');
    for (var connectionId in connections) {
        closeConnection(connectionId);
    }
};

const callbackRemoveStream = () => {
    console.log('WebRTC: Called callbackRemoveStream()');

    remoteVideo.srcObject = null;
};

const callbackAddStream = (connection, evt) => {
    console.log('WebRTC: Called callbackAddStream()');

    attachMediaStream(evt);
};

const callbackIceCandidate = (connection, evt, partnerClientId) => {
    console.log('WebRTC: ICE Candidate callback.');
    if (evt.candidate) {
        console.log('WebRTC: New ICE candidate.');
        sendHubSignal(JSON.stringify({ "candidate": evt.candidate }), partnerClientId);
    } else {
        console.log('WebRTC: ICE candidate gathering done.');
        sendHubSignal(JSON.stringify({ "candidate": null }), partnerClientId);
    }
}

const initializeConnection = (partnerClientId) => {
    console.log('WebRTC: Initializing connection..');

    var connection = new RTCPeerConnection(peerConnectionConfig);

    connection.onicecandidate = evt => callbackIceCandidate(connection, evt, partnerClientId);
    connection.onaddstream = evt => callbackAddStream(connection, evt);
    connection.onremovestream = evt => callbackRemoveStream(connection, evt);

    connections[partnerClientId] = connection;
    return connection;

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

    initiateOffer(acceptingUser.connectionId, localStream);
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