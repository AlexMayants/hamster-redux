import Adapter from '../adapter';
import RequestDispatcher from '../request-dispatcher';
import Serializer from '../serializer';
import Store from '../store';
import Transform, { IdCapableTransform, NumberTransform, StringTransform, BooleanTransform } from '../transform';

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

export default class Container {
  constructor() {
    initPrivateProps(this);

    setPrivateProp(this, 'registry', new Map());

    this.initDefaults();
  }

  initDefaults() {
    this.registerFactory('request-dispatcher', RequestDispatcher);
    this.registerFactory('store', Store);

    this.registerFactory('adapter:default', Adapter);
    this.registerFactory('serializer:default', Serializer);
    this.registerFactory('transform:default', Transform);

    this.registerFieldType('number', { transform: NumberTransform });
    this.registerFieldType('string', { transform: StringTransform });
    this.registerFieldType('boolean', { transform: BooleanTransform });
  }


  registerFactory(name, Factory) {
    getPrivateProp(this, 'registry').set(name, new Factory(this));
  }

  registerValue(name, instance) {
    getPrivateProp(this, 'registry').set(name, instance);
  }

  get(name) {
    return getPrivateProp(this, 'registry').get(name) ?? null;
  }


  registerRedux(reduxStore) {
    this.registerValue('redux', reduxStore);
  }

  registerReducer(reducerName) {
    this.registerValue('reducer', reducerName);
  }


  registerFieldType(fieldTypeName, { transform: Transform } = {}) {
    if (Transform) {
      this.registerFactory(`transform:${fieldTypeName}`, Transform);
    }
  }

  getTransformFor(fieldTypeName) {
    return this.get(`transform:${fieldTypeName}`) || this.get(`transform:default`)
  }


  registerEntityType(typeName, { adapter: Adapter, serializer: Serializer, schema = {} } = {}) {
    if (Adapter) {
      this.registerFactory(`adapter:${typeName}`, Adapter);
    }

    if (Serializer) {
      this.registerFactory(`serializer:${typeName}`, Serializer);
    }

    if (!schema.id) {
      throw new Error(`${typeName} field is missing`);
    }

    if (!(this.getTransformFor(schema.id) instanceof IdCapableTransform)) {
      throw new Error(`Invalid transform for ${typeName}::id`);
    }

    this.registerValue(`schema:${typeName}`, schema);
  }

  getAdapterFor(typeName) {
    return this.get(`adapter:${typeName}`) || this.get(`adapter:default`)
  }

  getSerializerFor(typeName) {
    return this.get(`serializer:${typeName}`) || this.get(`serializer:default`)
  }

  getSchemaFor(typeName) {
    return this.get(`schema:${typeName}`) || {};
  }
}
