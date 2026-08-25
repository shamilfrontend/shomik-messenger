import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedFileUrl, sanitizeFileUrl, sanitizeMessageType } from '../utils/sanitize';

describe('sanitizeFileUrl (XSS / open redirect)', () => {
  it('блокирует javascript: и HTML в fileUrl', () => {
    assert.equal(sanitizeFileUrl('javascript:alert(1)'), '');
    assert.equal(sanitizeFileUrl('<img src=x onerror=alert(1)>'), '');
    assert.equal(isAllowedFileUrl('javascript:alert(1)'), false);
  });

  it('блокирует внешние URL', () => {
    assert.equal(sanitizeFileUrl('https://evil.example/x.png'), '');
    assert.equal(sanitizeFileUrl('//evil.example/x.png'), '');
  });

  it('пропускает только /uploads/ и data:image', () => {
    assert.equal(sanitizeFileUrl('/uploads/avatar.png'), '/uploads/avatar.png');
    assert.equal(sanitizeFileUrl('data:image/png;base64,aaa').startsWith('data:image/'), true);
  });
});

describe('sanitizeMessageType', () => {
  it('не даёт клиенту выставить type=system', () => {
    assert.equal(sanitizeMessageType('system'), 'text');
    assert.equal(sanitizeMessageType('<script>'), 'text');
  });
});
