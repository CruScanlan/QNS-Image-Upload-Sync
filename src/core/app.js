const config = require('config/')();

const FileManager = require('core/FileManager');
const Contentful = require('core/Contentful');
const Watermarker = require('core/Watermarker');

class App {
    constructor() {
        this.config = config;

        this.contentful = new Contentful(this);

        this.fileManager = new FileManager(this);

        this.watermarker = new Watermarker(this);

        //this.storage = storage;

        this.uploadingNewImage = {};

    }

    async init() {
        console.log('Starting Contentful Sync Application');

        await this.contentful.init();

        await this.fileManager.init();

        const diskImagesList = this.fileManager.currentImageFileListDisk;
        for(let i=0; i<diskImagesList.length; i++) { //Check for new images
            if(diskImagesList[i].contentfulImageId !== '') { //has id
                const contentfulAsset = this.contentful.currentAssets.find(asset => asset.sys.id === diskImagesList[i].contentfulImageId);
                const file = diskImagesList[i];
                const {name, description} = this.getNameDescriptionFromFileName(file.fileName);
                if(contentfulAsset) {  //id exists in contentful
                    if(contentfulAsset.fields.title['en-US'] === name) continue; //name has not changed
                    console.log(`Updating asset name at ${file.relativePath} with id: ${file.contentfulImageId}`);
                    await this.contentful.updateAssetNameDescription({
                        name,
                        description,
                        contentfulImageId: file.contentfulImageId
                    });
                    console.log(`Done, Updating asset name at ${file.relativePath} with id: ${file.contentfulImageId}`);
                    continue;
                }
            }
            console.log(`Creating, watermarking and uploading new asset at ${file.relativePath}`);
            await this.contentful.uploadWatermarkNewAsset({
                title: name,
                description: description,
                fileName: file.fileName,
                relativePath: file.relativePath
            })
            console.log(`Done, creating, watermarking and uploading new asset at ${file.relativePath}`);
        }

        await this.fileManager._startWatchingFileChanges();
        this._startFileManagerListen();

        console.log('Started Contentful Sync Application');
    }

    getNameDescriptionFromFileName(fileName) {
        const name = fileName.substring(fileName.startsWith('$') ? 1 : 0, fileName.length-4);
        const descripStart = name.indexOf('-')+1;

        if(descripStart === -1) {
            return {
                name,
                description: ''
            }
        }
        
        const descripEnd = name.indexOf('-', descripStart);
        const description = name.substring(descripStart, descripEnd !== -1 ? descripEnd : name.length);
        return {
            name,
            description
        }
    }

    _startFileManagerListen() {
        this.fileManager.on('fileNew', async (image) => {
            this.uploadingNewImage[image.path] = true;
            console.log(`Creating, watermarking and uploading new asset at ${image.relativePath}`);
            const {name, description} = this.getNameDescriptionFromFileName(image.fileName);
            await this.contentful.uploadWatermarkNewAsset({
                title: name,
                description: description,
                fileName: image.fileName,
                relativePath: image.relativePath
            })
            this.uploadingNewImage[image.path] = false;
            console.log(`Done, creating, watermarking and uploading new asset at ${image.relativePath}`);
        })

        this.fileManager.on('fileNameUpdate', async (image) => {
            console.log('updating file name');
            const {name, description} = this.getNameDescriptionFromFileName(image.fileName);
            await this.contentful.updateAssetNameDescription({
                name,
                description,
                contentfulImageId: image._contentfulImageId
            })
            console.log('done updating file name');
        })

        this.fileManager.on('fileContentUpdate', async (image) => {
            if(this.uploadingNewImage[image.path]) return;
            console.log('updating image on asset');
            const watermarkedImageInfo = await this.watermarker.watermarkImage({
                fileName: image.fileName,
                path: image.path,
                relativePath: image.relativePath
            });
            await this.contentful.uploadAssetImage({
                fileName: watermarkedImageInfo.fileName,
                assetId: image._contentfulImageId,
                relativePath: watermarkedImageInfo.relativePath,
                data: watermarkedImageInfo.watermarkedImageData
            });
            console.log('done updating image on asset')
        })

        this.fileManager.on('fileDelete', async (image) => {
            console.log('deleteing asset');
            await this.contentful.deleteAsset(image.contentfulImageId);
            console.log('done deleteing asset');
        })
    }
}

module.exports = new App().init();