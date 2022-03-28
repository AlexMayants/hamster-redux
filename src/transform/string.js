import Transform from './transform';
import { isNone } from '../utils';

export default class StringTransform extends Transform {
  unserialize(serialized) {
    if (isNone(serialized)) {
      return null;
    }

    return String(serialized);
  }

  serialize(unserialized) {
    if (isNone(unserialized)) {
      return null;
    }

    return String(unserialized);
  }
}
