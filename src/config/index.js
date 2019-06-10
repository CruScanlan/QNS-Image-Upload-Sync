const process = require('process');

const baseConfig = require('./base-config');
const devConfig = require('./dev-config');
const prodConfig = require('./prod-config');
const testConfig = require('./test-config');

module.exports = function(){
    switch(process.env.NODE_ENV || 'production'){
        case 'development':
            return {...baseConfig, ...devConfig};
        case 'production':
            return {...baseConfig, ...prodConfig};
        case 'test': 
            return {...baseConfig, ...testConfig}
        default:
            throw new Error('NODE_ENV not set');
    }
};