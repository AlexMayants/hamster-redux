import IdCapableTransform from './id-capable-transform';
import { isNone } from '../utils';

export default class StringTransform extends IdCapableTransform {
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
