import { isEmpty, pluralize } from '../utils';

export default class Serializer {
  constructor(container) {
    this._container = container;
  }

  unserializePayload(typeName, payload, isSingle) {
    if (isSingle) {
      const entity = payload[typeName] || payload[pluralize(typeName)];

      if (!entity) { return null; }

      return this.unserializeEntity(typeName, entity);
    } else {
      const entities = payload[pluralize(typeName)] || payload[typeName];

      if (!entities) { return []; }

      return entities.map(entity => this.unserializeEntity(typeName, entity));
    }
  }

  unserializeEntity(typeName, entity) {
    const schema = this._container.getSchemaFor(typeName);

    const result = {};

    if (schema) {
      Object.entries(schema).forEach(([ key, fieldTypeName ]) => {
        const transform = this._container.getTransformFor(fieldTypeName);
        const value = transform.unserialize(entity?.[key]);

        result[key] = value;
      });
    }

    if (isEmpty(result.id)) { return null; }

    return result;
  }

  unserializeMeta(typeName, payload) {
    return payload?.meta;
  }

  serializePayload(typeName, payload) {
    if (!payload) { return null; }

    return {
      [typeName]: this.serializeEntity(typeName, payload)
    };
  }

  serializeEntity(typeName, entity) {
    const schema = this._container.getSchemaFor(typeName);

    const result = {};

    if (schema) {
      Object.entries(schema).forEach(([ key, fieldTypeName ]) => {
        const transform = this._container.getTransformFor(fieldTypeName);
        const value = transform.serialize(entity?.[key]);

        result[key] = value;
      });
    }

    if (isEmpty(result.id)) {
      delete result.id;
    }

    return result;
  }
}
