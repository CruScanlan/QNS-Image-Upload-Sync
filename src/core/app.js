const config = require('config/')();

const FileManager = require('core/FileManager');
const Contentful = require('core/Contentful');
const Watermarker = require('core/Watermarker');
const storage = require('core/storage');

class App {
    constructor() {
        this.config = config;

        this.contentful = new Contentful(this);

        this.fileManager = new FileManager(this);

        this.watermarker = new Watermarker(this);

        this.storage = storage;

        this.currentContentfulImages = new Map();

    }

    async init() {
        console.log('Starting Contentful Sync Application');

        await this.contentful.init();

        await this.fileManager.init();

        this._startFileManagerListen();

/*         await this.contentful.uploadWatermarkNewAsset({
            title: 'ayylmao',
            description: '',
            fileName: '$Acacia amblygona inflorescence, phyllodes, Curra SF July 2018 2.jpg',
            relativePath: '/$Acacia amblygona inflorescence, phyllodes, Curra SF July 2018 2.jpg'
        }) */
        const diskImagesList = this.fileManager.currentImageFileListDisk;
        //console.log(diskImagesList);
        for(let i=0; i<diskImagesList.length; i++) {
            if(diskImagesList[i].contentfulImageId !== '') { //has id
                const contentfulAsset = this.contentful.currentAssets.find(asset => asset.sys.id === diskImagesList[i].contentfulImageId);
                if(contentfulAsset) continue; //id exists in contentful
            }
            const file = diskImagesList[i];
            console.log(`Creating, watermarking and uploading new asset at ${file.relativePath}`);
            await this.contentful.uploadWatermarkNewAsset({
                title: file.fileName.substring(1, file.fileName.length),
                description: '',
                fileName: file.fileName,
                relativePath: file.relativePath
            })
            console.log(`Done, creating, watermarking and uploading new asset at ${file.relativePath}`);
        }

        console.log('Started Contentful Sync Application');
    }

    _startFileManagerListen() {
        this.fileManager.on('fileUpdate', (image) => {
            console.log(image.fileName)
        })
    }
}

module.exports = new App().init();