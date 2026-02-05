import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import websocketService from '../services/websocket';
import { useAuthStore } from './auth.store';

const STUN_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const STORAGE_MIC_KEY = 'call-preferred-mic-id';
const STORAGE_CAMERA_KEY = 'call-preferred-camera-id';

const MEDIA_NOT_AVAILABLE_MSG =
  'Микрофон и камера недоступны. Откройте сайт по HTTPS и используйте современный браузер.';

function ensureMediaDevices(): void {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error(MEDIA_NOT_AVAILABLE_MSG);
  }
}

export interface IncomingCall {
  fromUserId: string;
  chatId: string;
  isVideo?: boolean;
  caller: { id: string; username: string; avatar?: string } | null;
}

export interface ActiveCall {
  chatId: string;
  callType: 'private' | 'group';
  peerUserId?: string;
  participants: string[];
  isInitiator: boolean;
  isVideo?: boolean;
}

/** Групповой созвон идёт, можно присоединиться */
export interface GroupCallAvailable {
  chatId: string;
  participants: string[];
  isVideo?: boolean;
}

export const useCallStore = defineStore('call', () => {
  const authStore = useAuthStore();
  const incomingCall = ref<IncomingCall | null>(null);
  const activeCall = ref<ActiveCall | null>(null);
  const groupCallAvailable = ref<GroupCallAvailable | null>(null);
  const isMuted = ref(false);
  const isVideoOff = ref(false);
  const isConnecting = ref(false);
  /** Удалённые видеопотоки по userId (для видеозвонка) */
  const remoteStreams = ref<Record<string, MediaStream>>({});

  const audioDevices = ref<MediaDeviceInfo[]>([]);
  const videoDevices = ref<MediaDeviceInfo[]>([]);
  const selectedMicId = ref<string | null>(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_MIC_KEY) : null);
  const selectedCameraId = ref<string | null>(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_CAMERA_KEY) : null);

  const currentUserId = computed(() => authStore.user?.id ?? null);
  const isGroupCall = computed(() => activeCall.value?.callType === 'group');
  const isVideoCall = computed(() => activeCall.value?.isVideo === true);

  let peerConnection: RTCPeerConnection | null = null;
  let peerConnections: Map<string, RTCPeerConnection> = new Map();
  let localStream: MediaStream | null = null;
  let remoteAudioRef: HTMLAudioElement | null = null;
  let localVideoRef: HTMLVideoElement | null = null;
  let combinedRemoteStream: MediaStream | null = null;

  function setRemoteAudioRef(el: HTMLAudioElement | null): void {
    remoteAudioRef = el;
    if (el && activeCall.value && !activeCall.value.isVideo) {
      el.srcObject = combinedRemoteStream || null;
    }
  }

  function setLocalVideoRef(el: HTMLVideoElement | null): void {
    localVideoRef = el;
    if (el && localStream) {
      el.srcObject = localStream;
    }
  }

  function getPeerUserId(): string | null {
    if (!activeCall.value) return null;
    return activeCall.value.peerUserId ?? null;
  }

  async function loadDevices(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      audioDevices.value = devices.filter((d) => d.kind === 'audioinput');
      videoDevices.value = devices.filter((d) => d.kind === 'videoinput');
    } catch (err) {
      console.error('loadDevices error:', err);
    }
  }

  function setSelectedMic(deviceId: string | null): void {
    selectedMicId.value = deviceId;
    if (typeof localStorage !== 'undefined') {
      if (deviceId) localStorage.setItem(STORAGE_MIC_KEY, deviceId);
      else localStorage.removeItem(STORAGE_MIC_KEY);
    }
  }

  function setSelectedCamera(deviceId: string | null): void {
    selectedCameraId.value = deviceId;
    if (typeof localStorage !== 'undefined') {
      if (deviceId) localStorage.setItem(STORAGE_CAMERA_KEY, deviceId);
      else localStorage.removeItem(STORAGE_CAMERA_KEY);
    }
  }

  async function getLocalStream(options: { video?: boolean } = {}): Promise<MediaStream> {
    ensureMediaDevices();
    const needVideo = options.video ?? false;
    if (localStream) {
      const hasVideo = localStream.getVideoTracks().length > 0;
      if (hasVideo === needVideo) return localStream;
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    const audioConstraint: MediaTrackConstraints | boolean = selectedMicId.value
      ? { deviceId: { ideal: selectedMicId.value } }
      : true;
    const videoConstraint: boolean | MediaTrackConstraints = needVideo
      ? {
          ...(selectedCameraId.value ? { deviceId: { ideal: selectedCameraId.value } } : {}),
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      : false;
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraint,
      video: videoConstraint
    });
    if (localVideoRef && needVideo) {
      localVideoRef.srcObject = localStream;
    }
    return localStream;
  }

  function createPeerConnection(
    peerUserId: string,
    onTrack?: (stream: MediaStream) => void,
    isVideo?: boolean
  ): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        websocketService.send('call:signal', {
          targetUserId: peerUserId,
          signal: { type: 'ice', candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (isVideo && onTrack) {
        onTrack(stream);
      } else if (combinedRemoteStream) {
        stream.getTracks().forEach((t) => combinedRemoteStream!.addTrack(t));
      } else if (remoteAudioRef) {
        remoteAudioRef.srcObject = stream;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'closed') {
        peerConnections.delete(peerUserId);
        if (activeCall.value?.callType === 'group' && peerConnections.size === 0 && !peerConnection) {
          cleanup();
        }
      }
    };

    return pc;
  }

  function cleanup(): void {
    peerConnection?.close();
    peerConnection = null;
    peerConnections.forEach((pc) => pc.close());
    peerConnections = new Map();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    combinedRemoteStream = null;
    remoteStreams.value = {};
    if (remoteAudioRef) {
      remoteAudioRef.srcObject = null;
    }
    if (localVideoRef) {
      localVideoRef.srcObject = null;
    }
    activeCall.value = null;
    incomingCall.value = null;
    groupCallAvailable.value = null;
    isVideoOff.value = false;
    isConnecting.value = false;
  }

  async function startCall(chatId: string, targetUserId: string, isVideo = false): Promise<void> {
    if (activeCall.value || incomingCall.value || !currentUserId.value) return;
    isMuted.value = false;
    isVideoOff.value = false;
    isConnecting.value = true;
    try {
      const stream = await getLocalStream({ video: isVideo });
      const onTrack = isVideo
        ? (remoteStream: MediaStream) => {
            remoteStreams.value = { ...remoteStreams.value, [targetUserId]: remoteStream };
          }
        : undefined;
      peerConnection = createPeerConnection(targetUserId, onTrack, isVideo);
      stream.getTracks().forEach((track) => peerConnection!.addTrack(track, stream));
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      activeCall.value = {
        chatId,
        callType: 'private',
        peerUserId: targetUserId,
        participants: [currentUserId.value, targetUserId],
        isInitiator: true,
        isVideo
      };
      websocketService.send('call:start', { chatId, targetUserId, isVideo });
    } catch (err) {
      console.error('startCall error:', err);
      cleanup();
    } finally {
      isConnecting.value = false;
    }
  }

  async function startGroupCall(chatId: string, isVideo = false): Promise<void> {
    if (activeCall.value || incomingCall.value || !currentUserId.value) return;
    isMuted.value = false;
    isVideoOff.value = false;
    isConnecting.value = true;
    try {
      await getLocalStream({ video: isVideo });
      activeCall.value = {
        chatId,
        callType: 'group',
        participants: [currentUserId.value],
        isInitiator: true,
        isVideo
      };
      groupCallAvailable.value = null;
      websocketService.send('call:start', { chatId, isVideo });
    } catch (err) {
      console.error('startGroupCall error:', err);
      cleanup();
    } finally {
      isConnecting.value = false;
    }
  }

  function setGroupCallStarted(chatId: string, participants: string[], isVideo?: boolean): void {
    if (activeCall.value?.chatId === chatId) return;
    groupCallAvailable.value = { chatId, participants, isVideo };
  }

  async function joinGroupCall(chatId: string): Promise<void> {
    if (activeCall.value || !currentUserId.value) return;
    if (groupCallAvailable.value?.chatId !== chatId) return;
    const isVideo = groupCallAvailable.value?.isVideo === true;
    isMuted.value = false;
    isVideoOff.value = false;
    isConnecting.value = true;
    groupCallAvailable.value = null;
    try {
      const stream = await getLocalStream({ video: isVideo });
      if (isVideo) {
        if (!combinedRemoteStream) combinedRemoteStream = new MediaStream();
        if (remoteAudioRef) remoteAudioRef.srcObject = null;
      } else {
        combinedRemoteStream = new MediaStream();
        if (remoteAudioRef) remoteAudioRef.srcObject = combinedRemoteStream;
      }
      websocketService.send('call:join', { chatId });
    } catch (err) {
      console.error('joinGroupCall error:', err);
      isConnecting.value = false;
    }
  }

  async function onCallJoinedGroup(
    chatId: string,
    participants: string[],
    initiatorId?: string,
    isVideo?: boolean
  ): Promise<void> {
    if (!currentUserId.value) return;
    const me = currentUserId.value;
    const isInitiator = initiatorId === me;
    isConnecting.value = true;
    try {
      const stream = localStream || (await getLocalStream({ video: isVideo }));
      if (isVideo) {
        if (!combinedRemoteStream) combinedRemoteStream = new MediaStream();
        if (remoteAudioRef) remoteAudioRef.srcObject = null;
      } else if (!combinedRemoteStream) {
        combinedRemoteStream = new MediaStream();
        if (remoteAudioRef) remoteAudioRef.srcObject = combinedRemoteStream;
      }
      const others = participants.filter((id) => id !== me);
      others.forEach((peerId) => {
        const onTrack = isVideo
          ? (remoteStream: MediaStream) => {
              remoteStreams.value = { ...remoteStreams.value, [peerId]: remoteStream };
            }
          : undefined;
        const pc = createPeerConnection(peerId, onTrack, isVideo);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        peerConnections.set(peerId, pc);
      });
      activeCall.value = {
        chatId,
        callType: 'group',
        participants: [me, ...others],
        isInitiator,
        isVideo
      };
    } finally {
      isConnecting.value = false;
    }
  }

  async function onParticipantJoined(chatId: string, userId: string): Promise<void> {
    if (!activeCall.value || activeCall.value.chatId !== chatId || activeCall.value.callType !== 'group') return;
    if (peerConnections.has(userId)) return;
    const isVideo = activeCall.value.isVideo === true;
    const stream = localStream || (await getLocalStream({ video: isVideo }));
    const onTrack = isVideo
      ? (remoteStream: MediaStream) => {
          remoteStreams.value = { ...remoteStreams.value, [userId]: remoteStream };
        }
      : undefined;
    const pc = createPeerConnection(userId, onTrack, isVideo);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    peerConnections.set(userId, pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    websocketService.send('call:signal', { targetUserId: userId, signal: { type: 'offer', sdp: offer.sdp } });
    activeCall.value = {
      ...activeCall.value,
      participants: [...activeCall.value.participants, userId]
    };
  }

  function onParticipantLeft(chatId: string, userId: string): void {
    const pc = peerConnections.get(userId);
    if (pc) {
      pc.close();
      peerConnections.delete(userId);
    }
    if (activeCall.value?.isVideo) {
      const next = { ...remoteStreams.value };
      delete next[userId];
      remoteStreams.value = next;
    }
    if (activeCall.value?.chatId === chatId && activeCall.value.participants) {
      activeCall.value = {
        ...activeCall.value,
        participants: activeCall.value.participants.filter((id) => id !== userId)
      };
    }
  }

  function onCallAccepted(chatId: string, acceptedByUserId: string): void {
    if (
      !activeCall.value ||
      activeCall.value.chatId !== chatId ||
      activeCall.value.peerUserId !== acceptedByUserId
    )
      return;
    if (!peerConnection) return;
    const offer = peerConnection.localDescription;
    if (offer) {
      websocketService.send('call:signal', {
        targetUserId: acceptedByUserId,
        signal: { type: 'offer', sdp: offer.sdp }
      });
    }
  }

  async function acceptCall(chatId: string, fromUserId: string): Promise<void> {
    if (
      activeCall.value ||
      !incomingCall.value ||
      incomingCall.value.fromUserId !== fromUserId ||
      incomingCall.value.chatId !== chatId
    )
      return;
    const isVideo = incomingCall.value.isVideo === true;
    isMuted.value = false;
    isVideoOff.value = false;
    isConnecting.value = true;
    incomingCall.value = null;
    try {
      const stream = await getLocalStream({ video: isVideo });
      const onTrack = isVideo
        ? (remoteStream: MediaStream) => {
            remoteStreams.value = { ...remoteStreams.value, [fromUserId]: remoteStream };
          }
        : undefined;
      peerConnection = createPeerConnection(fromUserId, onTrack, isVideo);
      stream.getTracks().forEach((track) => peerConnection!.addTrack(track, stream));
      activeCall.value = {
        chatId,
        callType: 'private',
        peerUserId: fromUserId,
        participants: [currentUserId.value!, fromUserId],
        isInitiator: false,
        isVideo
      };
      websocketService.send('call:accept', { chatId, fromUserId });
    } catch (err) {
      console.error('acceptCall error:', err);
      cleanup();
      websocketService.send('call:reject', { chatId, fromUserId });
    } finally {
      isConnecting.value = false;
    }
  }

  function rejectCall(chatId: string, fromUserId: string): void {
    websocketService.send('call:reject', { chatId, fromUserId });
    if (incomingCall.value?.fromUserId === fromUserId) {
      incomingCall.value = null;
    }
  }

  function hangUp(): void {
    if (activeCall.value?.callType === 'group') {
      websocketService.send('call:leave', { chatId: activeCall.value.chatId });
    } else {
      const peer = activeCall.value?.peerUserId ?? incomingCall.value?.fromUserId;
      if (peer) websocketService.send('call:hangup', { targetUserId: peer });
    }
    cleanup();
  }

  function getPCForPeer(peerUserId: string): RTCPeerConnection | null {
    if (activeCall.value?.peerUserId === peerUserId && peerConnection) return peerConnection;
    return peerConnections.get(peerUserId) ?? null;
  }

  async function handleRemoteSignal(
    fromUserId: string,
    signal: { type: string; sdp?: string; candidate?: RTCIceCandidateInit }
  ): Promise<void> {
    const pc = getPCForPeer(fromUserId);
    if (!pc) return;
    if (signal.type === 'offer' && signal.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      websocketService.send('call:signal', {
        targetUserId: fromUserId,
        signal: { type: 'answer', sdp: answer.sdp }
      });
    } else if (signal.type === 'answer' && signal.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
    } else if (signal.type === 'ice' && signal.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }

  function setMuted(muted: boolean): void {
    isMuted.value = muted;
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  function setVideoOff(off: boolean): void {
    isVideoOff.value = off;
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !off;
      });
    }
  }

  async function switchAudioInput(deviceId: string | null): Promise<void> {
    setSelectedMic(deviceId);
    if (!localStream) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    const constraint: MediaTrackConstraints | boolean = deviceId ? { deviceId: { exact: deviceId } } : true;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: constraint, video: false });
      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) {
        newStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const oldTrack = localStream.getAudioTracks()[0];
      if (oldTrack) {
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      newTrack.enabled = !isMuted.value;
      localStream.addTrack(newTrack);
      newStream.getTracks().forEach((t) => {
        if (t !== newTrack) t.stop();
      });
      const replaceInPc = (pc: RTCPeerConnection): void => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) void sender.replaceTrack(newTrack);
      };
      if (peerConnection) replaceInPc(peerConnection);
      peerConnections.forEach(replaceInPc);
    } catch (err) {
      console.error('switchAudioInput error:', err);
    }
  }

  async function switchVideoInput(deviceId: string | null): Promise<void> {
    setSelectedCamera(deviceId);
    if (!localStream) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    const constraint: MediaTrackConstraints | boolean = deviceId ? { deviceId: { exact: deviceId } } : true;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: constraint });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) {
        newStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const oldTrack = localStream.getVideoTracks()[0];
      if (oldTrack) {
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      newTrack.enabled = !isVideoOff.value;
      localStream.addTrack(newTrack);
      newStream.getTracks().forEach((t) => {
        if (t !== newTrack) t.stop();
      });
      if (localVideoRef) localVideoRef.srcObject = localStream;
      const replaceInPc = (pc: RTCPeerConnection): void => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) void sender.replaceTrack(newTrack);
      };
      if (peerConnection) replaceInPc(peerConnection);
      peerConnections.forEach(replaceInPc);
    } catch (err) {
      console.error('switchVideoInput error:', err);
    }
  }

  function setIncomingCall(payload: IncomingCall | null): void {
    incomingCall.value = payload;
  }

  function setCallEnded(): void {
    cleanup();
  }

  return {
    incomingCall,
    activeCall,
    groupCallAvailable,
    isMuted,
    isVideoOff,
    isConnecting,
    remoteStreams,
    audioDevices,
    videoDevices,
    selectedMicId,
    selectedCameraId,
    currentUserId,
    isGroupCall,
    isVideoCall,
    setRemoteAudioRef,
    setLocalVideoRef,
    getPeerUserId,
    loadDevices,
    setSelectedMic,
    setSelectedCamera,
    startCall,
    startGroupCall,
    joinGroupCall,
    setGroupCallStarted,
    onCallJoinedGroup,
    onParticipantJoined,
    onParticipantLeft,
    onCallAccepted,
    acceptCall,
    rejectCall,
    hangUp,
    handleRemoteSignal,
    setMuted,
    setVideoOff,
    switchAudioInput,
    switchVideoInput,
    setIncomingCall,
    setCallEnded,
    cleanup
  };
});
