import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTransferLink } from '../src/services/transferLink.ts';

test('accepts Wi-Fi and hotspot pairing codes', () => {
  for (const ip of ['192.168.43.1', '192.168.1.20', '10.0.0.2', '172.16.4.1', '169.254.2.3']) {
    assert.equal(
      parseTransferLink(`http://${ip}:42421/#code=001234`),
      `http://${ip}:42421/#code=001234`
    );
  }
});

test('rejects unrelated QR codes, public addresses, credentials, ports and executable schemes', () => {
  for (const value of [
    'javascript:alert(1)',
    'https://example.com/#code=123456',
    'http://8.8.8.8:80/#code=123456',
    'http://127.0.0.1:80/#code=123456',
    'http://192.168.1.300:80/#code=123456',
    'http://192.168.1.1:65536/#code=123456',
    'http://192.168.1.1:0/#code=123456',
    'http://192.168.1.1:80/evil#code=123456',
    'http://user@192.168.1.1:80/#code=123456',
    'http://192.168.1.1:80/#code=123456&next=bad'
  ]) {
    assert.equal(parseTransferLink(value), null, value);
  }
});
