import IdCapableTransform from './id-capable-transform';
import { isNone } from '../utils';

export default class NumberTransform extends IdCapableTransform {
  unserialize(serialized) {
    if (isNone(serialized) || serialized === '') {
      return null;
    }

    const transformed = Number(serialized);

    return isFinite(transformed) ? transformed : null;
  }

  serialize(unserialized) {
    if (isNone(unserialized) || unserialized === '') {
      return null;
    }

    const transformed = Number(unserialized);

    return isFinite(transformed) ? transformed : null;
  }
}
