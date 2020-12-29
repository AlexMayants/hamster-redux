import { pluralize } from '../utils';

export default class Serializer {
  constructor(container) {
    this._container = container;
  }

  processPayload(typeName, payload, isSingle) {
    if (isSingle) {
      const entity = payload[typeName] || payload[pluralize(typeName)];

      if (!entity) { return null; }

      return this.processEntity(typeName, payload);
    } else {
      const entities = payload[pluralize(typeName)] || payload[typeName];

      if (!entities) { return []; }

      return entities.map(entity => this.processEntity(typeName, entity));
    }
  }

  processEntity(typeName, entity) {
    const schema = this._container.getSchemaFor(typeName);

    let id = entity?.id;

    if (!id) { return null; }

    const result = { id };

    if (schema) {
      Object.entries(schema).forEach(([ key, fieldTypeName ]) => {
        const transform = this._container.getTransformFor(fieldTypeName);
        const value = transform.unserialize(entity?.[key]);

        result[key] = value;
      });
    }

    return result;
  }
}
