const FETCH_DEBOUNCE_TIME = 50;

const PRIVATE_PROPS = new WeakMap();

function initPrivateProps(obj) {
  PRIVATE_PROPS.set(obj, {});
}

function getPrivateProp(obj, name) {
  return PRIVATE_PROPS.get(obj)[name];
}

function setPrivateProp(obj, name, value) {
  PRIVATE_PROPS.get(obj)[name] = value;
}

export default class RequestDispatcher {
  constructor(container) {
    this._container = container;

    initPrivateProps(this);
    setPrivateProp(this, 'debounceTimeoutsByTypeName', {});
    setPrivateProp(this, 'pendingFetchesByTypeName', {});
  }

  loadEntityById(typeName, id, options = {}) {
    return new Promise((resolve, reject) => {
      const { signal } = options;

      this.addPendingFetch(typeName, id, resolve, reject, options);
      this.schedulePurgePendingFetches(typeName);

      if (signal) {
        signal.addEventListener('abort', () => {
          this.rejectPendingFetch(typeName, id, new Error('Operation was aborted'));
        });
      }
    });
  }

  addPendingFetch(typeName, id, resolve, reject, options) {
    const pendingFetchesByTypeName = getPrivateProp(this, 'pendingFetchesByTypeName');

    if (!pendingFetchesByTypeName[typeName]) {
      pendingFetchesByTypeName[typeName] = {};
    }

    if (!pendingFetchesByTypeName[typeName][id]) {
      pendingFetchesByTypeName[typeName][id] = {
        resolves: [],
        rejects : [],
        options : [],
      };
    }

    pendingFetchesByTypeName[typeName][id].resolves.push(resolve);
    pendingFetchesByTypeName[typeName][id].rejects.push(reject);
    pendingFetchesByTypeName[typeName][id].options.push(options);
  }

  resolvePendingFetch(typeName, id, data) {
    const pendingFetchesByTypeName = getPrivateProp(this, 'pendingFetchesByTypeName');
    const pendingFetch = pendingFetchesByTypeName[typeName]?.[id];

    if (pendingFetch) {
      pendingFetch.resolves.forEach(resolve => resolve(data));
      delete pendingFetchesByTypeName[typeName][id];
    }
  }

  rejectPendingFetch(typeName, id, reason) {
    const pendingFetchesByTypeName = getPrivateProp(this, 'pendingFetchesByTypeName');
    const pendingFetch = pendingFetchesByTypeName[typeName]?.[id];

    if (pendingFetch) {
      pendingFetch.rejects.forEach(reject => reject(reason));
      delete pendingFetchesByTypeName[typeName][id];
    }
  }

  rejectAllPendingFetches(typeName, reason) {
    const pendingFetchesByTypeName = getPrivateProp(this, 'pendingFetchesByTypeName');
    const pendingFetchesById = pendingFetchesByTypeName[typeName] ?? {};

    Object.keys(pendingFetchesById).forEach(id => {
      const pendingFetch = pendingFetchesById[id];

      if (pendingFetch) {
        pendingFetch.rejects.forEach(reject => reject(reason));
        delete pendingFetchesByTypeName[typeName][id];
      }
    });
  }

  schedulePurgePendingFetches(typeName) {
    const debounceTimeoutsByTypeName = getPrivateProp(this, 'debounceTimeoutsByTypeName');

    clearTimeout(debounceTimeoutsByTypeName[typeName]);

    debounceTimeoutsByTypeName[typeName] = setTimeout(() => {
      this.purgePendingFetches(typeName);
    }, FETCH_DEBOUNCE_TIME);
  }

  purgePendingFetches(typeName) {
    const pendingFetchesByTypeName = getPrivateProp(this, 'pendingFetchesByTypeName');
    const pendingFetches = pendingFetchesByTypeName[typeName];

    if (!pendingFetches) {
      return;
    }

    const pendingIds = Object.keys(pendingFetches).filter(id => !pendingFetches[id].isLoadingStarted);

    if (pendingIds.length === 0) {
      return;
    }

    const adapter = this._container.getAdapterFor(typeName);
    const chunkSize = adapter.getChunkSize();

    for (let idx = 0; idx < pendingIds.length; idx += chunkSize) {
      const chunkIds = pendingIds.slice(idx, idx + chunkSize);

      this.purgePendingChunk(typeName, chunkIds);
    }
  }

  purgePendingChunk(typeName, ids) {
    const pendingFetchesByTypeName = getPrivateProp(this, 'pendingFetchesByTypeName');
    const pendingFetches = pendingFetchesByTypeName[typeName];

    let combinedOptions = {};
    const abortedById = new Map();
    const idsBySignal = new Map();

    ids.forEach(id => {
      pendingFetches[id].isLoadingStarted = true;

      const options = pendingFetches[id].options;

      options.forEach(opts => {
        if (opts) {
          combinedOptions = {
            ...combinedOptions,
            ...opts,
          };

          const signal = opts.signal;

          if (signal) {
            idsBySignal.set(signal, [
              ...idsBySignal.get(signal) || [],
              id,
            ]);
          }
        }
      });
    });

    if (idsBySignal.size) {
      const controller = new AbortController();
      const combinedSignal = controller.signal;

      combinedOptions.signal = combinedSignal;

      for (const signal of idsBySignal.keys()) {
        signal.addEventListener('abort', () => {
          idsBySignal.get(signal).forEach(id => abortedById.set(id, true));

          if (abortedById.size === ids.length) {
            combinedSignal.abort();
          }
        });
      }
    }

    const adapter = this._container.getAdapterFor(typeName);
    const serializer = this._container.getSerializerFor(typeName);

    if (ids.length === 1) {
      const singleId = ids[0];

      adapter.findEntity(typeName, singleId, combinedOptions)
        .then(payload => serializer.unserializePayload(typeName, payload, true))
        .then(entity => {
          if (entity.id !== singleId) {
            this.rejectPendingFetch(typeName, singleId, new Error(`Expected single ${typeName} with ID ${singleId}`));
          }

          this.resolvePendingFetch(typeName, singleId, entity);
        })
        .catch(error => {
          this.rejectPendingFetch(typeName, singleId, error);
        })
      ;
    } else {
      adapter.findEntities(typeName, ids, combinedOptions)
        .then(payload => serializer.unserializePayload(typeName, payload, false))
        .then(entities => {
          const loadedById = new Map();

          entities.forEach(entity => {
            loadedById.set(entity.id, entity);
          });

          ids.forEach(id => {
            if (!abortedById.get(id) && !loadedById.has(id)) {
              this.rejectPendingFetch(typeName, id, new Error(`Expected ${typeName} with ID ${id} to be present`));
            }
          });

          ids.forEach(id => {
            this.resolvePendingFetch(typeName, id, loadedById.get(id));
          });
        })
        .catch(error => {
          ids.forEach(id => {
            this.rejectPendingFetch(typeName, id, error);
          });
        })
      ;
    }
  }

  query(typeName, params, options) {
    const adapter = this._container.getAdapterFor(typeName);
    const serializer = this._container.getSerializerFor(typeName);

    return adapter.query(typeName, params, options)
      .then(payload => serializer.unserializePayload(typeName, payload, false))
    ;
  }

  createEntity(typeName, data, options) {
    const adapter = this._container.getAdapterFor(typeName);
    const serializer = this._container.getSerializerFor(typeName);

    const payload = serializer.serializePayload(typeName, data);

    return adapter.createEntity(typeName, payload, options)
      .then(payload => serializer.unserializePayload(typeName, payload, false))
    ;
  }

  updateEntity(typeName, data, options) {
    const adapter = this._container.getAdapterFor(typeName);
    const serializer = this._container.getSerializerFor(typeName);

    const payload = serializer.serializePayload(typeName, data);

    return adapter.updateEntity(typeName, data.id, payload, options)
      .then(payload => serializer.unserializePayload(typeName, payload, false))
    ;
  }

  deleteEntity(typeName, id, options) {
    const adapter = this._container.getAdapterFor(typeName);

    return adapter.deleteEntity(typeName, id, options);
  }
}
