import Transform from './transform';
import { isNone } from '../utils';

export default class StringTransform extends Transform {
  unserialize(data) {
    if (isNone(data)) { return data; }

    return String(data);
  }
}
