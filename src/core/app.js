const config = require('config/')();

const fs = require('fs');

class App {
    constructor() {
        this.config = config;

    }

    init() {
        console.log('Started Contentful Sync Application')

    }
}

module.exports = new App().init();