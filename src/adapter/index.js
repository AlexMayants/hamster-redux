import { stringify } from 'query-string';
import { pluralize } from '../utils';

const DEFAULT_CHUNK_SIZE = 20;
const DEFAULT_CONTENT_TYPE = 'application/json; charset=utf-8';

const HTTP_STATUS_NO_CONTENT = 204

const HTTP_EMPTY_RESPONSE_STATUSES = [HTTP_STATUS_NO_CONTENT];

export default class Adapter {
  constructor(container) {
    this._container = container;
  }

  getChunkSize() {
    return DEFAULT_CHUNK_SIZE;
  }

  getHost() {
    return '';
  }

  getNamespace() {
    return '';
  }

  getPathForType(typeName) {
    return pluralize(typeName);
  }

  buildUrl(typeName, id) {
    const host = this.getHost();
    const namespace = this.getNamespace();

    let url = [];

    if (host) {
      url.push(host);
    }

    if (namespace) {
      url.push(namespace);
    }

    if (typeName) {
      const path = this.getPathForType(typeName);

      if (path) {
        url.push(path);
      }
    }

    if (id) {
      url.push(encodeURIComponent(id));
    }

    url = url.join('/');

    if (!host) {
      url = `/${url}`;
    }

    return url;
  }

  findEntity(typeName, id, options) {
    const url = this.buildUrl(typeName, id);

    return this.request(url, 'GET', {}, options);
  }

  findEntities(typeName, ids, options) {
    const url = this.buildUrl(typeName);

    return this.request(url, 'GET', { queryParams: { ids } }, options);
  }

  query(typeName, params, options) {
    const url = this.buildUrl(typeName);

    return this.request(url, 'GET', { queryParams: params }, options);
  }

  createEntity(typeName, data, options) {
    const url = this.buildUrl(typeName);

    return this.request(url, 'POST', { body: data }, options);
  }

  updateEntity(typeName, id, data, options) {
    const url = this.buildUrl(typeName, id);

    return this.request(url, 'PUT', { body: data }, options);
  }

  deleteEntity(typeName, id, options) {
    const url = this.buildUrl(typeName, id);

    return this.request(url, 'DELETE', {}, options);
  }

  getFetchOptions(url, method, params, options = {}) {
    const { body } = params;
    const { signal, headers } = options

    const fetchOptions = {
      signal,
      headers,
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.headers = fetchOptions.headers || {};

      if (!fetchOptions.headers['Content-Type'] && !fetchOptions.headers['content-type']) {
        fetchOptions.headers['content-type'] = DEFAULT_CONTENT_TYPE;
      }

      if (Object.prototype.toString.call(body) === '[object Object]') {
        fetchOptions.body = JSON.stringify(body);
      } else {
        fetchOptions.body = body;
      }
    }

    return fetchOptions;
  }

  request(url, method, params = {}, options) {
    const { queryParams, body } = params;
    const fetchOptions = this.getFetchOptions(url, method, params, options);

    if (queryParams) {
      url += '?' + stringify(queryParams, { arrayFormat: 'bracket' });
    }

    return this.fetch(url, {
      method,
      body,
      ...fetchOptions
    })
      .then(response => {
        if (!response.ok) {
          const error = new Error(response.statusText);
          error.response = response;
          throw error;
        }

        if (HTTP_EMPTY_RESPONSE_STATUSES.includes(response.status)) {
          return response.text()
        }

        return response.json();
      })
    ;
  }

  fetch(url, options) {
    return fetch(url, options);
  }
}
