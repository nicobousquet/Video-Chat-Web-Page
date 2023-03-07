const HTTPS_PORT = 8443;

var localStream;      // Local video stream 
var peerConnection;   // Connection with the remote peer
var uuid;             // Uniquely identifies the local peer
var signalingServer;  // Signaling server

/* Definition of variables for accessing and controlling video elements */
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

/* Definition of variables for accessing and controlling interface buttons */
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');

// Functions associated to button click
startButton.addEventListener('click', start);
callButton.addEventListener('click', call);
hangupButton.addEventListener('click', hangup);

// Initial state of buttons
callButton.disabled = true;
hangupButton.disabled = true;

const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};

// ---------------------------

var peerConnectionConfig = {
    // TODO: Provide configuration
    'iceServers': [
        {'urls': 'stun:stun.services.mozilla.com'},
        {'urls': 'stun:stun.l.google.com:19302'}]
};

// Creates an UUID for the peer and initializes the signaling server
window.onload = function () {
    uuid = createUUID();

    signalingServer = new WebSocket('wss://' + window.location.hostname + ':' + HTTPS_PORT);
    signalingServer.onmessage = gotMessageFromServer;

}

// This function is called when the client presses startButton
async function start() {
    if (navigator.mediaDevices) {
        // TODO: Define media constraints
        var mediaConstraints = {
            audio: true,            // We want an audio track
            video: true,
        };
        // TODO: Get media stream and show it on the website
        console.log('Requesting local stream');
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        console.log('Received local stream');
        localVideo.srcObject = stream;
        localStream = stream;
    } else {
        alert('Your browser does not support getUserMedia API');
    }

    startButton.disabled = true;
    callButton.disabled = false;
}

// This function is called when the client presses callButton
async function call(event) {

    // TODO: Create an RTCPeerConnection
    console.log('RTCPeerConnection configuration:', peerConnectionConfig);
    peerConnection = new RTCPeerConnection(peerConnectionConfig);

    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;

    // TODO: Add the tracks of the local stream to be sent to the remote peer
    console.log('Starting call');
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length > 0) {
        console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
        console.log(`Using audio device: ${audioTracks[0].label}`);
    }

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    console.log('Added local stream to peerConnection');

    if (event) {
        // TODO: Create an SDP connection offer and once done call onDescription
        console.log('peerConnection createOffer start');
        const offer = await peerConnection.createOffer(offerOptions);
        await onDescription(offer);
    }

    callButton.disabled = true;
    hangupButton.disabled = false;
}

// End call by closing the peerConnection
function hangup() {
    console.log('Ending call');

    peerConnection.close();

    hangupButton.disabled = true;
    callButton.disabled = false;
}

// --- Auxiliary functions -----------------------------------------------------------

// Called when a message is received from the signaling server
async function gotMessageFromServer(message) {

    var json; // The json object in the message

    if (!peerConnection)
        await call();

    json = JSON.parse(message.data);

    // Ignore our own messages
    if (json.uuid == uuid)
        return;


    if (json.sdp) {
        // The message contains a Session Description offer or answer
        // TODO: Set the remote peer's session description.
        //       In case the SDP contains an offer, create an answer and send it to the
        //       signaling server
        try {
            await peerConnection.setRemoteDescription(json.object);
        } catch (e) {
            errorHandler(e);
        }

        if (json.type === 'offer') {
            // Since the 'remote' side has no media stream we need
            // to pass in the right constraints in order for it to
            // accept the incoming offer of audio and video.
            try {
                const answer = await peerConnection.createAnswer();
                await onDescription(answer);
            } catch (e) {
                errorHandler(e);
            }
        }
    } else if (json.ice) {
        // The message contains an ICE candidate
        // TODO: Add the ICE candidate to the RTCPeerConnection
        try {
            let test = peerConnection.signalingState;
            await (peerConnection.addIceCandidate(json.ice));
        } catch (e) {
            errorHandler(e);
        }
    }
}

// Called when an ICE candidate has been added to the local peer using
// RTCPeerConnection.setLocalDescription() 
function gotIceCandidate(event) {
    console.log('got Ice candidate');

    if (event.candidate != null) {
        // TODO: Transmit the ICE candidate to the remote peer over the signaling channel
        //       Include the local UUID to ignore messages received from ourself
        signalingServer.send(JSON.stringify({'uuid': uuid, 'ice': event.candidate}));
    }
}

// Called when service description offer or answer has been created
async function onDescription(desc) {
    console.log('got description');

    //TODO: Set Local Description and send it to the signaling server
    //      Include the local UUID to ignore messages received from ourself
    console.log(`Offer from peerConnection\n${desc.sdp}`);
    console.log('peerConnection setLocalDescription start');
    await peerConnection.setLocalDescription(desc);
    signalingServer.send(JSON.stringify({'uuid': uuid, 'type': desc.type, 'sdp': desc.sdp, 'object': desc}));
}

// Called when remote stream is received
let inboundStream = null;

function gotRemoteStream(event) {
    console.log('got remote stream');
    //TODO: Show the remote stream on the website
    if (event.streams && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
    } else {
        if (!inboundStream) {
            inboundStream = new MediaStream();
            remoteVideo.srcObject = inboundStream;
        }
        inboundStream.addTrack(event.track);
    }
}

function errorHandler(error) {
    console.log(error);
}

// Creates sort of a unique identifier for the client
// Taken from http://stackoverflow.com/a/105074/515584
function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
