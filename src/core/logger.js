const winston = require('winston');
require('winston-daily-rotate-file');

const transportDailyRotate = new (winston.transports.DailyRotateFile)({
    filename: 'log-%DATE%.log',
    dirname: '/src/data/logs',
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '90d'
});


const logFormat = winston.format.printf(function(info) {
    let date = new Date().toISOString();
    return `${date}-${info.level}: ${JSON.stringify(info.message, null, 4)}\n`;
});

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), logFormat)
        }),
        transportDailyRotate
    ]
});

winston.exceptions.handle(new winston.transports.File({ filename: './src/data/logs/exceptions.log' }))

module.exports = logger;