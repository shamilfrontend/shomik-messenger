import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import websocketService from '../services/websocket';
import { useAuthStore } from './auth.store';

const STUN_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export interface IncomingCall {
  fromUserId: string;
  chatId: string;
  caller: { id: string; username: string; avatar?: string } | null;
}

export interface ActiveCall {
  chatId: string;
  callType: 'private' | 'group';
  peerUserId?: string;
  participants: string[];
  isInitiator: boolean;
}

/** Групповой созвон идёт, можно присоединиться */
export interface GroupCallAvailable {
  chatId: string;
  participants: string[];
}

export const useCallStore = defineStore('call', () => {
  const authStore = useAuthStore();
  const incomingCall = ref<IncomingCall | null>(null);
  const activeCall = ref<ActiveCall | null>(null);
  const groupCallAvailable = ref<GroupCallAvailable | null>(null);
  const isMuted = ref(false);
  const isConnecting = ref(false);

  const currentUserId = computed(() => authStore.user?.id ?? null);
  const isGroupCall = computed(() => activeCall.value?.callType === 'group');

  let peerConnection: RTCPeerConnection | null = null;
  let peerConnections: Map<string, RTCPeerConnection> = new Map();
  let localStream: MediaStream | null = null;
  let remoteAudioRef: HTMLAudioElement | null = null;
  let combinedRemoteStream: MediaStream | null = null;

  function setRemoteAudioRef(el: HTMLAudioElement | null): void {
    remoteAudioRef = el;
    if (el && activeCall.value) {
      el.srcObject = combinedRemoteStream || null;
    }
  }

  function getPeerUserId(): string | null {
    if (!activeCall.value) return null;
    return activeCall.value.peerUserId ?? null;
  }

  async function getLocalStream(): Promise<MediaStream> {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return localStream;
  }

  function createPeerConnection(
    peerUserId: string,
    onTrack?: (stream: MediaStream) => void
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
      if (combinedRemoteStream) {
        stream.getTracks().forEach((t) => combinedRemoteStream!.addTrack(t));
      } else if (remoteAudioRef) {
        remoteAudioRef.srcObject = stream;
      }
      onTrack?.(stream);
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
    if (remoteAudioRef) {
      remoteAudioRef.srcObject = null;
    }
    activeCall.value = null;
    incomingCall.value = null;
    groupCallAvailable.value = null;
    isConnecting.value = false;
  }

  async function startCall(chatId: string, targetUserId: string): Promise<void> {
    if (activeCall.value || incomingCall.value || !currentUserId.value) return;
    isMuted.value = false;
    isConnecting.value = true;
    try {
      const stream = await getLocalStream();
      peerConnection = createPeerConnection(targetUserId);
      stream.getTracks().forEach((track) => peerConnection!.addTrack(track, stream));
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      activeCall.value = {
        chatId,
        callType: 'private',
        peerUserId: targetUserId,
        participants: [currentUserId.value, targetUserId],
        isInitiator: true
      };
      websocketService.send('call:start', { chatId, targetUserId });
    } catch (err) {
      console.error('startCall error:', err);
      cleanup();
    } finally {
      isConnecting.value = false;
    }
  }

  async function startGroupCall(chatId: string): Promise<void> {
    if (activeCall.value || incomingCall.value || !currentUserId.value) return;
    isMuted.value = false;
    isConnecting.value = true;
    try {
      await getLocalStream();
      activeCall.value = {
        chatId,
        callType: 'group',
        participants: [currentUserId.value],
        isInitiator: true
      };
      groupCallAvailable.value = null;
      websocketService.send('call:start', { chatId });
    } catch (err) {
      console.error('startGroupCall error:', err);
      cleanup();
    } finally {
      isConnecting.value = false;
    }
  }

  function setGroupCallStarted(chatId: string, participants: string[]): void {
    if (activeCall.value?.chatId === chatId) return;
    groupCallAvailable.value = { chatId, participants };
  }

  async function joinGroupCall(chatId: string): Promise<void> {
    if (activeCall.value || !currentUserId.value) return;
    if (groupCallAvailable.value?.chatId !== chatId) return;
    isMuted.value = false;
    isConnecting.value = true;
    groupCallAvailable.value = null;
    try {
      const stream = await getLocalStream();
      combinedRemoteStream = new MediaStream();
      if (remoteAudioRef) remoteAudioRef.srcObject = combinedRemoteStream;
      websocketService.send('call:join', { chatId });
    } catch (err) {
      console.error('joinGroupCall error:', err);
      isConnecting.value = false;
    }
  }

  async function onCallJoinedGroup(
    chatId: string,
    participants: string[],
    initiatorId?: string
  ): Promise<void> {
    if (!currentUserId.value) return;
    const me = currentUserId.value;
    const isInitiator = initiatorId === me;
    isConnecting.value = true;
    try {
      const stream = localStream || (await getLocalStream());
      if (!combinedRemoteStream) {
        combinedRemoteStream = new MediaStream();
        if (remoteAudioRef) remoteAudioRef.srcObject = combinedRemoteStream;
      }
      const others = participants.filter((id) => id !== me);
      others.forEach((peerId) => {
        const pc = createPeerConnection(peerId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        peerConnections.set(peerId, pc);
      });
      activeCall.value = {
        chatId,
        callType: 'group',
        participants: [me, ...others],
        isInitiator
      };
    } finally {
      isConnecting.value = false;
    }
  }

  async function onParticipantJoined(chatId: string, userId: string): Promise<void> {
    if (!activeCall.value || activeCall.value.chatId !== chatId || activeCall.value.callType !== 'group') return;
    if (peerConnections.has(userId)) return;
    const stream = localStream || (await getLocalStream());
    const pc = createPeerConnection(userId);
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
    isMuted.value = false;
    isConnecting.value = true;
    incomingCall.value = null;
    try {
      const stream = await getLocalStream();
      peerConnection = createPeerConnection(fromUserId);
      stream.getTracks().forEach((track) => peerConnection!.addTrack(track, stream));
      activeCall.value = {
        chatId,
        callType: 'private',
        peerUserId: fromUserId,
        participants: [currentUserId.value!, fromUserId],
        isInitiator: false
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
    isConnecting,
    currentUserId,
    isGroupCall,
    setRemoteAudioRef,
    getPeerUserId,
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
    setIncomingCall,
    setCallEnded,
    cleanup
  };
});
