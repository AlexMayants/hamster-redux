export default class Transform {
  constructor(container) {
    this._container = container;
  }

  unserialize(serialized) {
    return serialized;
  }

  serialize(unserialized) {
    return unserialized;
  }
}
