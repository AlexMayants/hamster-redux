module.exports = {
  parser: "@babel/eslint-parser",
  extends: "eslint:recommended",
  env: {
    "browser": true,
    "mocha": true,
    "es6": true
  },
  rules: {
    "no-unused-vars": ["error", { "args": "none" }],
  },
};