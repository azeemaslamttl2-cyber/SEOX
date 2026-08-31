import { onRequestPost } from './functions/api/auth.js';

class FakeRequest {
  constructor(body) {
    this._body = body;
  }
  async json() {
    return this._body;
  }
  get url() {
    return 'http://localhost:3000/api/auth/login';
  }
}

(async () => {
  try {
    const response = await onRequestPost({ request: new FakeRequest({ email: 'test@example.com', password: 'abc123' }), env: process.env });
    console.log(response);
  } catch (err) {
    console.error('ERROR', err);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
})();