import { UPDATE_ENTITY_DATA, REMOVE_ENTITY_DATA } from '../actions';

export default function reducer(state = {}, { type, typeName, id, entity } = {}) {
  switch (type) {
    case UPDATE_ENTITY_DATA:
      return {
        ...state,
        [typeName]: {
          ...state[typeName] ?? {},
          [id]: {
            ...state[typeName]?.[id] ?? {},
            ...entity,
          },
        },
      };

    case REMOVE_ENTITY_DATA: {
      const entitiesById = { ...state[typeName] ?? {} };

      delete entitiesById[id];

      return {
        ...state,
        [typeName]: entitiesById,
      };
    }

    default:
      return state;
  }
}
