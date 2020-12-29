import Transform from './transform';
import { isNone } from '../utils';

export default class BooleanTransform extends Transform {
  unserialize(data) {
    if (isNone(data)) { return data; }

    return Boolean(Number(data));
  }
}
