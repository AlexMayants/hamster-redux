export function pluralize(str) {
  if (str && str[str.length - 1] === 's') {
    return `${str}es`;
  }

  return `${str}s`;
}

export function isNone(value) {
  return value === null || value === undefined;
}

export function isEmpty(value) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}
