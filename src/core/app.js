const config = require('config/')();

const FileManager = require('core/FileManager');
const Contentful = require('core/Contentful');
const storage = require('core/storage');

class App {
    constructor() {
        this.config = config;

        this.contentful = new Contentful(this);

        this.fileManager = new FileManager(this);

        this.storage = storage;

        this.currentContentfulImages = new Map();

    }

    async init() {
        console.log('Starting Contentful Sync Application');

        await this.contentful.init();

        await this.fileManager.init();

        this._startFileManagerListen();

        const diskImagesList = this.fileManager.currentImageFileListDisk;
        console.log(diskImagesList);
        for(let i=0; i<diskImagesList.length; i++) {
            if(diskImagesList[i].contentfulImageId === '') { //no id
                const file = diskImagesList[i];
                await this.contentful.uploadNewAsset({
                    title: file.fileName.substring(1, file.fileName.length),
                    description: '',
                    fileType: file.fileType,
                    fileName: file.fileName,
                    relativePath: file.relativePath
                })
            }
        }

        console.log('Started Contentful Sync Application');
    }

    _startFileManagerListen() {
        this.fileManager.on('fileUpdate', (image) => {
            console.log(image)
        })
    }
}

module.exports = new App().init();