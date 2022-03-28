import Transform from './transform';
import { isNone } from '../utils';

export default class BooleanTransform extends Transform {
  unserialize(serialized) {
    if (isNone(serialized)) {
      return null;
    }

    return Boolean(Number(serialized));
  }

  serialize(unserialized) {
    if (isNone(unserialized)) {
      return null;
    }

    return Boolean(unserialized);
  }
}
