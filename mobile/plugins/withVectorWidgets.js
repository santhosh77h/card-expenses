const { createRunOncePlugin } = require('@expo/config-plugins');
const withIosWidgets = require('./withVectorWidgets/withIosWidgets');
const withAndroidWidgets = require('./withVectorWidgets/withAndroidWidgets');

function withVectorWidgets(config) {
  config = withIosWidgets(config);
  config = withAndroidWidgets(config);
  return config;
}

module.exports = createRunOncePlugin(
  withVectorWidgets,
  'withVectorWidgets',
  '1.0.0'
);
