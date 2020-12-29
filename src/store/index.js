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

    return entitesById[id] ?? null;
  }

  loadEntityById(typeName, id, options) {
    const requestDispatcher = this._container.get('request-dispatcher');

    this.updateEntity(typeName, id, { id });
    this.notify(typeName, [id], UPDATE_ENTITY_DATA);

    return requestDispatcher.loadEntityById(typeName, id, options)
      .then(entity => {
        this.updateEntity(typeName, entity.id, entity);

        this.notify(typeName, [id], UPDATE_ENTITY_DATA);

        return entity;
      })
      .catch(error => {
        this.logError(typeName, id, options, error);
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

    return ids.map(id => entitesById[id] ?? null).filter(entity => !!entity);
  }

  loadEntitiesByIds(typeName, ids, options) {
    const requestDispatcher = this._container.get('request-dispatcher');

    ids.forEach(id => {
      this.updateEntity(typeName, id, { id });
    });
    this.notify(typeName, ids, UPDATE_ENTITY_DATA);

    return requestDispatcher.loadEntitiesByIds(typeName, ids, options)
      .then(entities => {
        entities.forEach(entity => {
          this.updateEntity(typeName, entity.id, entity);
        });

        this.notify(typeName, ids, UPDATE_ENTITY_DATA);

        return entities;
      })
      .catch(error => {
        this.logError(typeName, ids, options, error);
      })
    ;
  }

  findEntitiesByIds(typeName, ids, options) {
    const existingEntities = this.peekEntitiesByIds(typeName, ids, options);
    const allIds = new Set(ids);
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

    reduxStore.dispatch({
      type: REMOVE_ENTITY_DATA,
      typeName,
      id,
    });
    this.notify(typeName, [id], REMOVE_ENTITY_DATA);
  }

  removeEntitiesByIds(typeName, ids) {
    const reduxStore = this._container.get('redux');

    ids.forEach(id => {
      reduxStore.dispatch({
        type: REMOVE_ENTITY_DATA,
        typeName,
        id,
      });
    });

    this.notify(typeName, ids, REMOVE_ENTITY_DATA);
  }

  removeAllEntities(typeName) {
    const allEntities = this.peekAllEntities(typeName);
    const allIds = allEntities.map(entity => entity.id);

    this.removeEntitiesByIds(typeName, allIds);
    this.notify(typeName, allIds, REMOVE_ENTITY_DATA);
  }

  query(typeName, params, options) {
    const requestDispatcher = this._container.get('request-dispatcher');

    return requestDispatcher.query(typeName, params, options)
      .then(entities => {
        entities.forEach(entity => {
          this.updateEntity(typeName, entity.id, entity);
        });

        this.notify(typeName, entities.map(entity => entity.id), UPDATE_ENTITY_DATA);

        return entities;
      })
      .catch(error => {
        this.logError(typeName, params, options, error);
      })
    ;
  }

  updateEntity(typeName, id, entity) {
    const reduxStore = this._container.get('redux');

    reduxStore.dispatch({
      type: UPDATE_ENTITY_DATA,
      typeName,
      id,
      entity,
    });
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
}
