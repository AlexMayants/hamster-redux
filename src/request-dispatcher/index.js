const FETCH_DEBOUNCE_TIME = 50;

const PRIVATE_PROPS = new WeakMap();

function initPrivateProps(obj) {
  PRIVATE_PROPS.set(obj, new Map());
}

function getPrivateProp(obj, name) {
  return PRIVATE_PROPS.get(obj).get(name);
}

function setPrivateProp(obj, name, value) {
  PRIVATE_PROPS.get(obj).set(name, value);
}

export default class RequestDispatcher {
  constructor(container) {
    this._container = container;

    initPrivateProps(this);
    setPrivateProp(this, 'debounceTimeoutsByTypeName', new Map());
    setPrivateProp(this, 'pendingFetchesByTypeName', new Map());
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

    if (!pendingFetchesByTypeName.has(typeName)) {
      pendingFetchesByTypeName.set(typeName, new Map());
    }

    if (!pendingFetchesByTypeName.get(typeName).has(id)) {
      pendingFetchesByTypeName.get(typeName).set(id, {
        resolves: [],
        rejects : [],
        options : [],
      });
    }

    pendingFetchesByTypeName.get(typeName).get(id).resolves.push(resolve);
    pendingFetchesByTypeName.get(typeName).get(id).rejects.push(reject);
    pendingFetchesByTypeName.get(typeName).get(id).options.push(options);
  }

  resolvePendingFetch(typeName, id, data) {
    const pendingFetchesByTypeName = getPrivateProp(this, 'pendingFetchesByTypeName');
    const pendingFetch = pendingFetchesByTypeName.get(typeName)?.get(id);

    if (pendingFetch) {
      pendingFetch.resolves.forEach(resolve => resolve(data));
      pendingFetchesByTypeName.get(typeName).delete(id);
    }
  }

  rejectPendingFetch(typeName, id, reason) {
    const pendingFetchesByTypeName = getPrivateProp(this, 'pendingFetchesByTypeName');
    const pendingFetch = pendingFetchesByTypeName.get(typeName)?.get(id);

    if (pendingFetch) {
      pendingFetch.rejects.forEach(reject => reject(reason));
      pendingFetchesByTypeName.get(typeName).delete(id);
    }
  }

  rejectAllPendingFetches(typeName, reason) {
    const pendingFetchesByTypeName = getPrivateProp(this, 'pendingFetchesByTypeName');
    const pendingFetchesById = pendingFetchesByTypeName.get(typeName);

    pendingFetchesById?.forEach((pendingFetch, id) => {
      if (pendingFetch) {
        pendingFetch.rejects.forEach(reject => reject(reason));
        pendingFetchesById.delete(id);
      }
    });
  }

  schedulePurgePendingFetches(typeName) {
    const debounceTimeoutsByTypeName = getPrivateProp(this, 'debounceTimeoutsByTypeName');

    clearTimeout(debounceTimeoutsByTypeName.get(typeName));

    debounceTimeoutsByTypeName.set(typeName, setTimeout(() => {
      this.purgePendingFetches(typeName);
    }, FETCH_DEBOUNCE_TIME));
  }

  purgePendingFetches(typeName) {
    const pendingFetchesByTypeName = getPrivateProp(this, 'pendingFetchesByTypeName');
    const pendingFetches = pendingFetchesByTypeName.get(typeName);

    if (!pendingFetches) {
      return;
    }

    const pendingIds = [...pendingFetches.keys()].filter(id => !pendingFetches.get(id).isLoadingStarted);

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
    const pendingFetches = pendingFetchesByTypeName.get(typeName);

    let combinedOptions = {};
    const abortedById = new Map();
    const idsBySignal = new Map();

    ids.forEach(id => {
      pendingFetches.get(id).isLoadingStarted = true;

      const options = pendingFetches.get(id).options;

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
      .then(payload => {
        let result = serializer.unserializePayload(typeName, payload, false);

        result.meta = serializer.unserializeMeta(typeName, payload);

        return result;
      })
    ;
  }

  createEntity(typeName, data, options) {
    const adapter = this._container.getAdapterFor(typeName);
    const serializer = this._container.getSerializerFor(typeName);

    const payload = serializer.serializePayload(typeName, data);

    return adapter.createEntity(typeName, payload, options)
      .then(payload => serializer.unserializePayload(typeName, payload, true))
    ;
  }

  updateEntity(typeName, data, options) {
    const adapter = this._container.getAdapterFor(typeName);
    const serializer = this._container.getSerializerFor(typeName);

    const payload = serializer.serializePayload(typeName, data);

    return adapter.updateEntity(typeName, data.id, payload, options)
      .then(payload => serializer.unserializePayload(typeName, payload, true))
    ;
  }

  deleteEntity(typeName, id, options) {
    const adapter = this._container.getAdapterFor(typeName);

    return adapter.deleteEntity(typeName, id, options);
  }
}
