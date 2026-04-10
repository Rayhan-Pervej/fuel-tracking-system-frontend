import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket) {
    socket.auth = { token };
    return socket;
  }

  socket = io(`${SOCKET_URL}/dashboard`, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
    auth: { token },
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
