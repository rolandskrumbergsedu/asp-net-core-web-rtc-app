const WEBRTC_CONSTRAINTS = { audio: true, video: true };
var ICE_SERVERS = [];

$.getJSON("api/iceservers", (data) => {
    ICE_SERVERS = data;
});

window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || windows.mozRTCSessionDescription || window.webkitRTCSessionDescription;
