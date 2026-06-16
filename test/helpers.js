export function createMockRequest(options = {}) {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    ...options
  };
}

export function createMockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    redirectUrl: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.ended = true;
      return this;
    },
    send(data) {
      this.body = data;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
    redirect(status, url) {
      if (typeof status === 'string') {
        url = status;
        status = 302;
      }
      this.statusCode = status;
      this.redirectUrl = url;
      this.ended = true;
      return this;
    }
  };
  return res;
}
