export function pluralize(str) {
  if (str && str[str.length - 1] === 's') {
    return `${str}es`;
  }

  return `${str}s`;  
}

export function isNone(value) {
  return value === null || value === undefined;
}
