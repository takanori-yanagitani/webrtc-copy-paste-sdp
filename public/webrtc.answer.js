const ireduce = (f, iterator, first) => {
  let result = first
  for(const i of iterator) result = f(result, i)
  return result
}

const gum = options => window.navigator.mediaDevices.getUserMedia(options || {
  audio: false,
  video: {
    width: 1280,
    height: 720,
  },
})

const rpc = options => new RTCPeerConnection(options || { iceServers: [] })

const log = msg => console.info(new Date().toISOString() + ": " + msg)

const post = (body, type) => fetch("/", {
  method: "POST",
  headers: { "Content-Type": type },
  body,
})

const playRemote = (video, event) => {
  console.log({video, event})
  return Promise.resolve(video && video.play && event && event.streams)
  .then(streams => streams && streams[0])
  .then(stream => stream && new Promise(resolve => {
    video.srcObject = stream
    video.play()
    resolve()
  }))
}

const onIceCandidate = event => {
  const { candidate } = event || {}
  console.log({
    candidate,
    event,
  })
}

const onIceConnectionStateChange = (event, peer, remote) => {
  const close = () => {
    return Promise.resolve(peer && peer.iceConnectionState)
    .then(state => state === "closed")
    .then(is_closed => ! is_closed)
    .then(not_closed => not_closed && peer && peer.close && new Promise(resolve => {
      peer.close()
      resolve()
    }))
    .then(closed => remote && remote.pause && new Promise(resolve => {
      remote.pause()
      remote.srcObject = null
      resolve()
    }))
  }
  switch(peer && peer.iceConnectionState){
    default: break
    case "disconnected": return console.info("disconnected.")
    case "closed": return close() || console.info("closed.")
    case "failed": return close() || console.warn("failed.")
  }
}

const main = () => {
  return gum()
  .then(mediaStream => {
    const local    = document.getElementById("local")
    return mediaStream && new Promise(resolve => {
      local.srcObject = mediaStream
      local.addEventListener("loadedmetadata", resolve)
    })
    .then(e => local.play && local.play())
    .then(played => mediaStream)
  })
  .then(mediaStream => mediaStream && mediaStream.getTracks && new Promise(resolve => {
    const receive  = document.getElementById("receive")
    const send     = document.getElementById("send")
    const setOffer = document.getElementById("setOffer")
    const remote   = document.getElementById("remote")
    const sendLocalDescription = description => {
      const { sdp } = description || {}
      send.value = sdp
    }
    setOffer.addEventListener("click", () => {
      const { value } = receive || {}
      return value && Promise.resolve(value)
      .then(sdp => new RTCSessionDescription({
        sdp,
        type: "offer",
      }))
      .then(offer => {
        const peer = rpc()
        peer.addEventListener("track", e => playRemote(remote, e), false)
        peer.addEventListener("icecandidate", e => onIceCandidate(e), false)
        peer.addEventListener("iceconnectionstatechange", e => onIceConnectionStateChange(e, peer, remote), false)
        const tracks = mediaStream.getTracks()
        tracks.forEach(track => peer.addTrack(track, mediaStream))
        return offer && peer.setRemoteDescription(offer)
        .then(set => peer.createAnswer())
        .then(answer => answer && peer.setLocalDescription(answer))
        .then(set => peer.localDescription)
        .then(sendLocalDescription)
      })
    }, false)
    resolve()
  }))
}

Promise.resolve()
.then(main)
.catch(console.error)
