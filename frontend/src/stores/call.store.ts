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
  peerUserId: string;
  chatId: string;
  isInitiator: boolean;
}

export const useCallStore = defineStore('call', () => {
  const authStore = useAuthStore();
  const incomingCall = ref<IncomingCall | null>(null);
  const activeCall = ref<ActiveCall | null>(null);
  const isMuted = ref(false);
  const isConnecting = ref(false);

  const currentUserId = computed(() => authStore.user?.id ?? null);

  let peerConnection: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = null;
  let remoteAudioRef: HTMLAudioElement | null = null;

  function setRemoteAudioRef(el: HTMLAudioElement | null): void {
    remoteAudioRef = el;
    if (el && activeCall.value) {
      el.srcObject = null;
    }
  }

  function getPeerUserId(): string | null {
    if (!activeCall.value) return null;
    return activeCall.value.peerUserId;
  }

  async function getLocalStream(): Promise<MediaStream> {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return localStream;
  }

  function createPeerConnection(peerUserId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        websocketService.send('call:signal', { targetUserId: peerUserId, signal: { type: 'ice', candidate: event.candidate } });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (remoteAudioRef) {
        remoteAudioRef.srcObject = stream;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        if (activeCall.value && pc.connectionState === 'closed') {
          // only cleanup on closed, not on temporary disconnect
          cleanup();
        }
      }
    };

    return pc;
  }

  function cleanup(): void {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    if (remoteAudioRef) {
      remoteAudioRef.srcObject = null;
    }
    activeCall.value = null;
    incomingCall.value = null;
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

      activeCall.value = { peerUserId: targetUserId, chatId, isInitiator: true };
      websocketService.send('call:start', { chatId, targetUserId });
    } catch (err) {
      console.error('startCall error:', err);
      cleanup();
    } finally {
      isConnecting.value = false;
    }
  }

  function onCallAccepted(chatId: string, acceptedByUserId: string): void {
    if (!activeCall.value || activeCall.value.chatId !== chatId || activeCall.value.peerUserId !== acceptedByUserId) return;
    if (!peerConnection) return;
    const offer = peerConnection.localDescription;
    if (offer) {
      websocketService.send('call:signal', { targetUserId: acceptedByUserId, signal: { type: 'offer', sdp: offer.sdp } });
    }
  }

  async function acceptCall(chatId: string, fromUserId: string): Promise<void> {
    if (activeCall.value || !incomingCall.value || incomingCall.value.fromUserId !== fromUserId || incomingCall.value.chatId !== chatId) return;
    isMuted.value = false;
    isConnecting.value = true;
    incomingCall.value = null;
    try {
      const stream = await getLocalStream();
      peerConnection = createPeerConnection(fromUserId);
      stream.getTracks().forEach((track) => peerConnection!.addTrack(track, stream));
      activeCall.value = { peerUserId: fromUserId, chatId, isInitiator: false };
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
    if (incomingCall.value && incomingCall.value.fromUserId === fromUserId) {
      incomingCall.value = null;
    }
  }

  function hangUp(): void {
    const peer = activeCall.value?.peerUserId ?? incomingCall.value?.fromUserId;
    if (peer) {
      websocketService.send('call:hangup', { targetUserId: peer });
    }
    cleanup();
  }

  async function handleRemoteSignal(fromUserId: string, signal: { type: string; sdp?: string; candidate?: RTCIceCandidateInit }): Promise<void> {
    if (!peerConnection) return;
    if (signal.type === 'offer' && signal.sdp) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      websocketService.send('call:signal', { targetUserId: fromUserId, signal: { type: 'answer', sdp: answer.sdp } });
    } else if (signal.type === 'answer' && signal.sdp) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
    } else if (signal.type === 'ice' && signal.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
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
    isMuted,
    isConnecting,
    currentUserId,
    setRemoteAudioRef,
    getPeerUserId,
    startCall,
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
