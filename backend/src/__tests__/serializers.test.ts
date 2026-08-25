import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex, isAllowedFileUrl, sanitizeMessageType } from '../utils/sanitize';
import { serializeUser } from '../serializers/user.serializer';
import { serializeMessage } from '../serializers/message.serializer';
import { serializeChat } from '../serializers/chat.serializer';

describe('escapeRegex', () => {
  it('экранирует спецсимволы', () => {
    assert.equal(escapeRegex('a+b?c'), 'a\\+b\\?c');
  });
});

describe('isAllowedFileUrl', () => {
  it('разрешает /uploads/ с безопасным именем', () => {
    assert.equal(isAllowedFileUrl('/uploads/file-1.jpg'), true);
  });

  it('запрещает внешние и javascript URL', () => {
    assert.equal(isAllowedFileUrl('https://evil.example/x.png'), false);
    assert.equal(isAllowedFileUrl('javascript:alert(1)'), false);
    assert.equal(isAllowedFileUrl('/uploads/../secret'), false);
  });

  it('разрешает data:image', () => {
    assert.equal(isAllowedFileUrl('data:image/png;base64,aaa'), true);
  });
});

describe('sanitizeMessageType', () => {
  it('не позволяет system с клиента', () => {
    assert.equal(sanitizeMessageType('system'), 'text');
    assert.equal(sanitizeMessageType('image'), 'image');
  });
});

describe('serializers', () => {
    it('userDto не отдаёт email чужим и чистит javascript-аватар', () => {
    const dto = serializeUser(
      { _id: 'abc', username: 'sam', email: 'a@b.c', avatar: 'javascript:alert(1)' },
      { includeEmail: false },
    );
    assert.equal(dto?.email, undefined);
    assert.equal(dto?.avatar, '');
  });

  it('messageDto дублирует id и _id', () => {
    const dto = serializeMessage({
      _id: 'm1',
      chatId: 'c1',
      senderId: { _id: 'u1', username: 'sam' },
      content: 'hi',
      type: 'text',
      readBy: [],
      reactions: {},
    });
    assert.equal(dto?.id, 'm1');
    assert.equal(dto?._id, 'm1');
    assert.equal(typeof dto?.senderId, 'object');
  });

    it('chatDto содержит unreadCount без email участников', () => {
    const dto = serializeChat({
      _id: 'c1',
      type: 'private',
      participants: [{ _id: 'u1', username: 'sam', email: 'hidden@x.com' }],
    }, { unreadCount: 3 });
    assert.equal(dto?.id, 'c1');
    assert.equal(dto?.unreadCount, 3);
    assert.equal(dto?.participants[0]?.email, undefined);
  });
});
