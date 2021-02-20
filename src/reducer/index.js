import { UPDATE_ENTITY_DATA, REMOVE_ENTITY_DATA } from '../actions';

export default function reducer(state = {}, { type, typeName, ids, data } = {}) {
  switch (type) {
    case UPDATE_ENTITY_DATA:
      return {
        ...state,
        [typeName]: {
          ...data.reduce(
            (acc, entity) => ({
              ...acc,
              [entity.id]: {
                ...state[typeName]?.[entity.id] ?? {},
                ...entity,
              }
            }),
            state[typeName] ?? {}
          )
        },
      };

    case REMOVE_ENTITY_DATA: {
      const entitiesById = { ...state[typeName] ?? {} };

      ids.forEach(id => {
        delete entitiesById[id];
      });

      return {
        ...state,
        [typeName]: entitiesById,
      };
    }

    default:
      return state;
  }
}
