import Transform from './transform';
import { isEmpty } from '../utils';

export default class IdCapableTransform extends Transform {
  normalizeId(unideal) {
    const unserialized = this.unserialize(unideal);

    return isEmpty(unserialized) ? null : String(unserialized);
  }
}
