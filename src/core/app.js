const config = require('config/')();

const uuidv4 = require('uuid/v4');

const FileManager = require('core/FileManager');
const Contentful = require('core/Contentful');
const Watermarker = require('core/Watermarker');

const logger = require('core/logger');

class App {
    constructor() {

        /**
         * The config for the application
         * @type {object}
         */
        this.config = config;

        /**
         * The contentful connection componet for the application
         * @type {Contentful}
         */
        this.contentful = new Contentful(this);

        /**
         * The file manager component for the application
         * @type {FileManager}
         */
        this.fileManager = new FileManager(this);

        /**
         * The watermarker component for the application
         * @type {Watermarker}
         */
        this.watermarker = new Watermarker(this);

        /**
         * The applications logger
         * @type {object}
         */
        this.logger = logger;

        /**
         * UUID Generator
         * @type {function}
         */
        this.genUUID = uuidv4;

        /**
         * Object containing file paths to currently uploading images
         * @type {object}
         */
        this.uploadingNewImage = {};

        /**
         * Object containing existing image ids that are uploading
         */
        this.uploadingExistingImage = {};

    }

    /**
     * Initialization of the application
     */
    async init() {
        this.logger.info('Starting Contentful Sync Application');

        await this.contentful.init();

        await this.fileManager.init();

        const diskImagesList = this.fileManager.currentImageFileListDisk;
        for(let i=0; i<diskImagesList.length; i++) { //Check for new images
            const file = diskImagesList[i];
            const {name, description} = this.getNameDescriptionFromFileName(file.fileName);
            if(diskImagesList[i].contentfulImageId !== '') { //has id
                const contentfulAsset = this.contentful.currentAssets.find(asset => asset.sys.id === file.contentfulImageId);
                if(contentfulAsset) {  //id exists in contentful
                    if(contentfulAsset.fields.title['en-US'] === name) continue; //name has not changed
                    const actionId = this.genUUID();
                    this.logger.info(`Updating asset name with id: ${file.contentfulImageId}`, {contentfulImageId: file.contentfulImageId, oldName: contentfulAsset.fields.title['en-US'], newName: name, fileName: file.fileName, actionId});
                    await this.contentful.updateAssetNameDescription({
                        name,
                        description,
                        contentfulImageId: file.contentfulImageId
                    });
                    this.logger.info(`Completed, Updating asset name with id: ${file.contentfulImageId}`, {contentfulImageId: file.contentfulImageId, oldName: contentfulAsset.fields.title['en-US'], newName: name, fileName: file.fileName, actionId});
                    continue;
                }
            }
            const actionId = this.genUUID();
            this.logger.info(`Creating, watermarking and uploading new asset with relative path: ${file.relativePath}`, {file, name, description, actionId});
            const contentfulImageId = await this.contentful.uploadWatermarkNewAsset({
                title: name,
                description: description,
                fileName: file.fileName,
                relativePath: file.relativePath
            })
            this.logger.info(`Completed, Creating, watermarking and uploading new asset with relative path: ${file.relativePath}`, {file, name, description, actionId, contentfulImageId});
        }

        await this.fileManager._startWatchingFileChanges();
        this._startFileManagerListen();

        this.logger.info('Started Contentful Sync Application');
    }

    /**
     * Parses a file name for name and description
     * @param {string} fileName 
     */
    getNameDescriptionFromFileName(fileName) {
        const name = fileName.substring(fileName.startsWith('$') ? 1 : 0, fileName.length-4); //remove the $ and .jpg
        const descripStart = name.indexOf('-')+1; //look for first -

        if(descripStart === -1) {
            return {
                name,
                description: ''
            }
        }
        
        const descripEnd = name.indexOf('-', descripStart);
        const description = name.substring(descripStart, descripEnd !== -1 ? descripEnd : name.length); //end description at second - or end of name
        return {
            name,
            description
        }
    }

    /**
     * Starts litsening to the file manager for file changes
     */
    _startFileManagerListen() {
        this.fileManager.on('fileNew', async (image) => {
            this.uploadingNewImage[image.path] = true; //set currently uploading to true
            const {name, description} = this.getNameDescriptionFromFileName(image.fileName);
            const actionId = this.genUUID();
            this.logger.info(`Creating, watermarking and uploading new asset with relative path: ${image.relativePath}`, {file: {path: image.path, relativePath: image.relativePath, fileName: image.fileName}, name, description, actionId});
            const contentfulImageId = await this.contentful.uploadWatermarkNewAsset({
                title: name,
                description: description,
                fileName: image.fileName,
                relativePath: image.relativePath
            })
            this.uploadingNewImage[image.path] = false; //set currently uploading to false
            this.logger.info(`Completed, Creating, watermarking and uploading new asset with relative path: ${image.relativePath}`, {file: {path: image.path, relativePath: image.relativePath, fileName: image.fileName}, name, description, actionId, contentfulImageId});
        })

        this.fileManager.on('fileNameUpdate', async (image) => {
            const actionId = this.genUUID();
            const {name, description} = this.getNameDescriptionFromFileName(image.fileName);
            this.logger.info(`Updating image name and description with id: ${image._contentfulImageId}`, {file: {path: image.path, relativePath: image.relativePath, fileName: image.fileName, contentfulImageId: image._contentfulImageId}, newName: name, description, actionId});
            await this.contentful.updateAssetNameDescription({
                name,
                description,
                contentfulImageId: image._contentfulImageId
            })
            this.logger.info(`Completed, Updating image name and description with id: ${image._contentfulImageId}`, {file: {path: image.path, relativePath: image.relativePath, fileName: image.fileName, contentfulImageId: image._contentfulImageId}, newName: name, description, actionId});
        })

        this.fileManager.on('fileContentUpdate', async (image) => {
            if(this.uploadingNewImage[image.path] || this.uploadingExistingImage[image._contentfulImageId]) return;
            this.uploadingExistingImage[image._contentfulImageId] = true;
            const actionId = this.genUUID();
            this.logger.info(`Uploading new image to existing asset with id: ${image._contentfulImageId}`, {file: {path: image.path, relativePath: image.relativePath, fileName: image.fileName, contentfulImageId: image._contentfulImageId}, actionId});
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
            this.uploadingExistingImage[image._contentfulImageId] = false;
            this.logger.info(`Completed, Uploading new image to existing asset with id: ${image._contentfulImageId}`, {file: {path: image.path, relativePath: image.relativePath, fileName: image.fileName, contentfulImageId: image._contentfulImageId}, actionId});
        })

        this.fileManager.on('fileDelete', async (image) => {
            const actionId = this.genUUID();
            this.logger.info(`Deleting asset with id: ${image.contentfulImageId}`, {file: image, actionId});
            const deleted = await this.contentful.deleteAsset(image.contentfulImageId);
            if(!deleted) return this.logger.info(`Failed, Deleting asset with id: ${image.contentfulImageId}`, {file: image, actionId});
            this.logger.info(`Completed, Deleting asset with id: ${image.contentfulImageId}`, {file: image, actionId});
        })
    }
}

module.exports = new App().init();