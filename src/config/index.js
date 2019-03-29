const process = require('process');

const baseConfig = require('./base-config');
const devConfig = require('./dev-config');
const prodConfig = require('./prod-config');

module.exports = function(){
    switch(process.env.NODE_ENV){
        case 'development':
            return {...baseConfig, ...devConfig};
        case 'production':
            return {...baseConfig, ...prodConfig};
        default:
            throw new Error('NODE_ENV not set');
    }
};