import { UPDATE_ENTITY_DATA, REMOVE_ENTITY_DATA } from '../actions';

export default class Store {
  constructor(container) {
    this._container = container;
    this._subscriptions = {};
  }

  peekEntityById(typeName, id, options) {
    const reduxStore = this._container.get('redux');
    const reducer = this._container.get('reducer');
    const state = reduxStore.getState();
    const entitesById = state[reducer]?.[typeName] || {};

    return entitesById[this.normalizeId(typeName, id)] ?? null;
  }

  loadEntityById(typeName, id, options) {
    const requestDispatcher = this._container.get('request-dispatcher');
    const unserializedId = this.unserializeId(typeName, id);

    this.updateStoreEntity(typeName, { id: unserializedId });
    this.notify(typeName, [unserializedId], UPDATE_ENTITY_DATA);

    return requestDispatcher.loadEntityById(typeName, unserializedId, options)
      .then(entity => {
        this.updateStoreEntity(typeName, entity);
        this.notify(typeName, [unserializedId], UPDATE_ENTITY_DATA);

        return entity;
      })
      .catch(error => {
        this.logError(typeName, unserializedId, options, error);

        throw error;
      })
    ;
  }

  findEntityById(typeName, id, options) {
    const existingEntity = this.peekEntityById(typeName, id, options);

    if (existingEntity) {
      return Promise.resolve(existingEntity);
    }

    return this.loadEntityById(typeName, id, options);
  }

  peekEntitiesByIds(typeName, ids, options) {
    const reduxStore = this._container.get('redux');
    const reducer = this._container.get('reducer');
    const state = reduxStore.getState();
    const entitesById = state[reducer]?.[typeName] || {};

    return ids.map(id => entitesById[this.normalizeId(typeName, id)] ?? null).filter(entity => !!entity);
  }

  loadEntitiesByIds(typeName, ids, options) {
    const requestDispatcher = this._container.get('request-dispatcher');
    const unserializedIds = ids.map(id => this.unserializeId(typeName, id));

    this.updateStoreEntities(typeName, unserializedIds.map(id => ({ id })));

    return Promise.allSettled(
      unserializedIds.map(id => requestDispatcher.loadEntityById(typeName, id, options))
    )
      .then(results => {
        const successfulEntities = [];
        const failReasons = [];

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            successfulEntities.push(result.value);
          } else {
            failReasons.push(result.reason);
          }
        });

        if (successfulEntities.length) {
          this.updateStoreEntities(typeName, successfulEntities);
        }

        if (failReasons.length > 0) {
          throw failReasons[0];
        }

        return successfulEntities;
      })
      .catch(error => {
        this.logError(typeName, unserializedIds, options, error);

        throw error;
      })
    ;
  }

  findEntitiesByIds(typeName, ids, options) {
    const unserializedIds = ids.map(id => this.unserializeId(typeName, id));
    const existingEntities = this.peekEntitiesByIds(typeName, ids, options);
    const allIds = new Set(unserializedIds);
    const existingIds = new Set(existingEntities.map(entity => entity.id));

    if (existingIds.size === allIds.size) {
      return Promise.resolve(existingEntities);
    }

    const missingIds = new Set(allIds);

    for (const id of existingIds) {
      missingIds.delete(id);
    }

    return this.loadEntitiesByIds(typeName, [...missingIds], options)
      .then(loadedMissingEntities => {
        return [...existingEntities, ...loadedMissingEntities];
      })
    ;
  }

  peekAllEntities(typeName) {
    const reduxStore = this._container.get('redux');
    const reducer = this._container.get('reducer');
    const state = reduxStore.getState();
    const entitesById = state[reducer]?.[typeName] || {};

    return Object.values(entitesById);
  }

  removeEntityById(typeName, id) {
    const reduxStore = this._container.get('redux');
    const normalizedId = this.normalizeId(typeName, id);
    const unserializedId = this.unserializeId(typeName, id);

    reduxStore.dispatch({
      type: REMOVE_ENTITY_DATA,
      typeName,
      ids: [normalizedId],
    });
    this.notify(typeName, [unserializedId], REMOVE_ENTITY_DATA);
  }

  removeEntitiesByIds(typeName, ids) {
    const normalizedIds = ids.map(id => this.normalizeId(typeName, id));
    const unserializedIds = ids.map(id => this.unserializeId(typeName, id));

    const reduxStore = this._container.get('redux');

    reduxStore.dispatch({
      type: REMOVE_ENTITY_DATA,
      typeName,
      ids: normalizedIds,
    });
    this.notify(typeName, unserializedIds, REMOVE_ENTITY_DATA);
  }

  removeAllEntities(typeName) {
    const allEntities = this.peekAllEntities(typeName);
    const allIds = allEntities.map(entity => entity.id);

    this.removeEntitiesByIds(typeName, allIds);
  }

  query(typeName, params, options) {
    const requestDispatcher = this._container.get('request-dispatcher');

    return requestDispatcher.query(typeName, params, options)
      .then(entities => {
        this.updateStoreEntities(typeName, entities);

        return entities;
      })
      .catch(error => {
        this.logError(typeName, params, options, error);

        throw error;
      })
    ;
  }

  createEntity(typeName, data, options) {
    const requestDispatcher = this._container.get('request-dispatcher');

    return requestDispatcher.createEntity(typeName, data, options)
      .then(entity => {
        this.updateStoreEntity(typeName, entity);

        return entity;
      })
      .catch(error => {
        this.logError(typeName, data, options, error);

        throw error;
      })
    ;
  }

  updateEntity(typeName, id, options) {
    const entity = this.peekEntityById(typeName, id, options);

    const requestDispatcher = this._container.get('request-dispatcher');

    return new Promise((resolve, reject) => {
      if (!entity) {
        reject(new Error(`${typeName} with ID ${id} not found in store`));
        return;
      }

      resolve(requestDispatcher.updateEntity(typeName, entity, options));
    })
      .then(entity => {
        this.updateStoreEntity(typeName, entity);

        return entity;
      })
      .catch(error => {
        this.logError(typeName, id, options, error);

        throw error;
      })
    ;
  }

  deleteEntity(typeName, id, options) {
    const entity = this.peekEntityById(typeName, id, options);

    const requestDispatcher = this._container.get('request-dispatcher');

    return new Promise((resolve, reject) => {
      if (!entity) {
        reject(new Error(`${typeName} with ID ${id} not found in store`));
        return;
      }

      resolve(requestDispatcher.deleteEntity(typeName, entity.id, options));
    })
      .then(() => {
        this.removeEntityById(typeName, id);
      })
      .catch(error => {
        this.logError(typeName, id, options, error);

        throw error;
      })
    ;
  }

  updateStoreEntity(typeName, entity) {
    this.updateStoreEntities(typeName, [entity]);
  }

  updateStoreEntities(typeName, entities) {
    const reduxStore = this._container.get('redux');

    reduxStore.dispatch({
      type: UPDATE_ENTITY_DATA,
      typeName,
      data: entities,
    });

    this.notify(typeName, entities.map(entity => entity.id), UPDATE_ENTITY_DATA);
  }

  subscribe(typeName, callback) {
    const subscriptions = this._subscriptions[typeName] = this._subscriptions[typeName] || [];

    const index = subscriptions.push(callback) - 1;

    return function unsubscribe() {
      subscriptions[index] = null;
    };
  }

  notify(typeName, ids, action) {
    const subscriptions = this._subscriptions[typeName] || [];

    subscriptions.forEach(callback => {
      if (callback) {
        callback(ids, action);
      }
    });
  }

  logError(typeName, params, options, error) {
    console.error(typeName, params, options, error);
  }

  normalizeId(typeName, id) {
    const schema = this._container.getSchemaFor(typeName);

    if (!schema) {
      throw new Error(`Unknown entity type ${typeName}`);
    }

    const transform = this._container.getTransformFor(schema.id);

    if (!transform.normalizeId) {
      throw new Error(`Invalid transform for ${typeName}::id`);
    }

    return transform.normalizeId(id);
  }

  unserializeId(typeName, id) {
    const schema = this._container.getSchemaFor(typeName);

    if (!schema) {
      throw new Error(`Unknown entity type ${typeName}`);
    }

    const transform = this._container.getTransformFor(schema.id);

    return transform.unserialize(id);
  }
}
