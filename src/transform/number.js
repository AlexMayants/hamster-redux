import Transform from './transform';
import { isNone } from '../utils';

export default class NumberTransform extends Transform {
  unserialize(data) {
    if (isNone(data)) { return data; }

    return Number(data);
  }
}
