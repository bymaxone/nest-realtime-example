/**
 * @fileoverview Incident room chat over WebSocket.
 * @layer app
 *
 * Requires the api booted with `websocket` or `both`. Authenticates the socket
 * handshake with a short-lived bearer from `POST /auth/ws-token` (Pattern C).
 * Joining/leaving a room is a REST call (`/rooms/join` and `/leave`, composing
 * the room id server-side); sending a message uses the WebSocket branch's
 * documented client-to-server `emit(event, data)` surface (absent on SSE,
 * typed `never` there) rather than a REST fallback, since the api's chat
 * gateway is the library's own `@Subscribe` handler for exactly this event.
 */
'use client';

import { useRealtime } from '@bymax-one/nest-realtime/react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip, StatusChip } from '@/components/ui/chip';
import { Code } from '@/components/ui/code';
import { Input, Label } from '@/components/ui/input';
import { ApiError, authApi, roomsApi } from '@/lib/api-client';
import { WS_URL } from '@/lib/constants';

interface ChatMessageData {
  readonly roomId: string;
  readonly from: string;
  readonly body: string;
  readonly at: string;
}

interface ConnectionEstablishedData {
  readonly connectionId: string;
}

/** Find this socket's own connection id from its most recent `connection:established` event. */
function findConnectionId(events: ReadonlyArray<{ type: string; data: unknown }>): string | null {
  const established = [...events]
    .reverse()
    .find((entry) => entry.type === 'connection:established');
  return established ? (established.data as ConnectionEstablishedData).connectionId : null;
}

/** Filter the accumulated events down to chat messages for one room. */
function filterRoomMessages(
  events: ReadonlyArray<{ type: string; data: unknown }>,
  roomId: string | null,
): readonly ChatMessageData[] {
  return events
    .filter((entry) => entry.type === 'chat.message')
    .map((entry) => entry.data as ChatMessageData)
    .filter((data) => data.roomId === roomId);
}

/** Everything the chat page's JSX needs, derived from one WebSocket connection. */
interface ChatRoomState {
  readonly connected: boolean;
  readonly connectionId: string | null;
  readonly joinedRoomId: string | null;
  readonly messages: readonly ChatMessageData[];
  readonly incidentId: string;
  readonly setIncidentId: (value: string) => void;
  readonly body: string;
  readonly setBody: (value: string) => void;
  readonly error: string | null;
  readonly join: (activeConnectionId: string) => void;
  readonly leave: (activeConnectionId: string) => void;
  readonly send: () => void;
}

/** Mints the short-lived WebSocket bearer once on mount. */
function useWsToken(): string | null {
  const [wsToken, setWsToken] = useState<string | null>(null);
  useEffect(() => {
    authApi
      .mintWsToken()
      .then((grant) => setWsToken(grant.token))
      .catch(() => setWsToken(null));
  }, []);
  return wsToken;
}

/** Join a resource room and report the outcome through the given state setters. */
function joinRoom(
  activeConnectionId: string,
  incidentId: string,
  setJoinedRoomId: (roomId: string) => void,
  setError: (error: string | null) => void,
): void {
  roomsApi
    .join(activeConnectionId, 'incident', incidentId)
    .then((result) => {
      setJoinedRoomId(result.roomId);
      setError(null);
    })
    .catch((err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Failed to join the room'),
    );
}

/** Mints the WS bearer, opens the socket, and owns join/leave/send. */
function useChatRoom(): ChatRoomState {
  const wsToken = useWsToken();
  const [incidentId, setIncidentId] = useState('1');
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const auth = useMemo(() => (wsToken !== null ? { token: wsToken } : undefined), [wsToken]);
  const { connected, events, emit } = useRealtime({
    url: WS_URL,
    transport: 'websocket',
    ...(auth !== undefined ? { auth } : {}),
  });

  const connectionId = useMemo(() => findConnectionId(events), [events]);
  const messages = filterRoomMessages(events, joinedRoomId);

  const join = (activeConnectionId: string): void =>
    joinRoom(activeConnectionId, incidentId, setJoinedRoomId, setError);

  const leave = (activeConnectionId: string): void => {
    void roomsApi
      .leave(activeConnectionId, 'incident', incidentId)
      .then(() => setJoinedRoomId(null));
  };

  const send = (): void => {
    if (!joinedRoomId || body.trim().length === 0) return;
    emit('chat.message', { roomId: joinedRoomId, body: body.trim() });
    setBody('');
  };

  return {
    connected,
    connectionId,
    joinedRoomId,
    messages,
    incidentId,
    setIncidentId,
    body,
    setBody,
    error,
    join,
    leave,
    send,
  };
}

/** The join/leave control, whose action depends on the current room and connection state. */
function JoinLeaveControl({
  joinedRoomId,
  connectionId,
  join,
  leave,
}: Pick<ChatRoomState, 'joinedRoomId' | 'connectionId' | 'join' | 'leave'>) {
  // The label stays fixed and the room id rides in a chip beside it: interpolating
  // the id resized the button on every join and leaked a wire identifier into a label.
  if (joinedRoomId && connectionId) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => leave(connectionId)}>
          Leave room
        </Button>
        <Chip className="font-mono">{joinedRoomId}</Chip>
      </div>
    );
  }
  if (connectionId) {
    return <Button onClick={() => join(connectionId)}>Join room</Button>;
  }
  return <Button disabled>Join room</Button>;
}

/** The scrollable message log, or an empty-state line when no message has arrived. */
function ChatMessageList({ messages }: { readonly messages: readonly ChatMessageData[] }) {
  if (messages.length === 0) {
    return <span className="text-xs text-white/30">No messages yet.</span>;
  }
  return (
    <>
      {messages.map((message, index) => (
        <div key={index} className="text-xs">
          <span className="font-mono text-brand-500">{message.from}</span>{' '}
          <span className="text-white/70">{message.body}</span>
        </div>
      ))}
    </>
  );
}

/** Title, live status chip, and the incident-id + join/leave row. */
function ChatHeader({ connected }: Pick<ChatRoomState, 'connected'>) {
  return (
    // The status chip sits beside the heading on wide screens and above it on
    // narrow ones, where a fixed row would push it off the card.
    <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <CardTitle>Incident chat</CardTitle>
        <CardDescription>
          WebSocket transport; requires <Code>REALTIME_TRANSPORT=websocket</Code> or{' '}
          <Code>both</Code>.
        </CardDescription>
      </div>
      <StatusChip className="shrink-0" tone={connected ? 'success' : 'danger'}>
        {connected ? 'connected' : 'disconnected'}
      </StatusChip>
    </div>
  );
}

/** The incident-id field and the join/leave control. */
function RoomControls(
  room: Pick<
    ChatRoomState,
    'incidentId' | 'setIncidentId' | 'joinedRoomId' | 'connectionId' | 'join' | 'leave'
  >,
) {
  return (
    <div className="flex items-end gap-3">
      <div>
        <Label htmlFor="incident-id">Incident id</Label>
        <Input
          id="incident-id"
          value={room.incidentId}
          onChange={(e) => room.setIncidentId(e.target.value)}
          className="w-32"
        />
      </div>
      <JoinLeaveControl
        joinedRoomId={room.joinedRoomId}
        connectionId={room.connectionId}
        join={room.join}
        leave={room.leave}
      />
    </div>
  );
}

/** Incident room chat page (WebSocket transport only). */
export default function ChatPage() {
  const room = useChatRoom();

  return (
    <Card>
      <CardHeader accent>
        <ChatHeader connected={room.connected} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RoomControls {...room} />
        {room.error ? <p className="text-xs text-(--color-danger)">{room.error}</p> : null}

        <div className="flex h-64 flex-col gap-2 overflow-y-auto rounded-lg border border-(--glass-border) bg-(--glass-bg) p-3">
          <ChatMessageList messages={room.messages} />
        </div>

        <div className="flex gap-2">
          <Input
            value={room.body}
            onChange={(e) => room.setBody(e.target.value)}
            placeholder="Message the incident room"
            disabled={!room.joinedRoomId}
          />
          <Button onClick={room.send} disabled={!room.joinedRoomId}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
