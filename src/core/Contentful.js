const contentful = require('contentful-management');
const fs = require('fs');
const path = require('path');
const request = require('request');
const PassThrough = require('stream').PassThrough;
const Image = require('models/Image');

class Contentful {
    constructor(App) {
        /**
         * The app for the file manager
         */
        Object.defineProperty(this, 'app', {value: App});

        /**
         * The contentful client connection
         * @type {object}
         */
        this.client = contentful.createClient({
            accessToken: this.app.config.contentfulAccessToken
        })

        /**
         * The contentful space
         * @type {object|null}
         */
        this.space = null;

        /**
         * The contentful environment
         * @type {object|null}
         */
        this.environment = null;

        /**
         * The current assets in contentful
         * @type {array}
         */
        this.currentAssets = [];
    }

    /**
     * Initialises the Contentful connection
     */
    async init() {
        console.log('Starting Contentful Connection');

        this.space = await this.client.getSpace(this.app.config.contentfulSpaceId);

        this.environment = await this.space.getEnvironment('master');

        this.currentAssets = await this.getAssets();

        /* await this.uploadNewAsset({
            title: 'ayy',
            description: 'test description',
            fileName: '$Acacia amblygona inflorescence, phyllodes, fruit, Curra SF July 2018.jpg',
            relativePath: `/Acacia amblygona/$Acacia amblygona inflorescence, phyllodes, fruit, Curra SF July 2018.jpg`
        }) */

        console.log('Started Contentful Connection');
    }

    async getAssets() {
        const assets = await this.environment.getAssets();
        return assets.items;
    }

    /**
     * Upload and create a new asset
     * @param {object} assetInfo 
     * @param {string} assetInfo.title - The title for the contentful image
     * @param {string} assetInfo.fileType - The file type for the image
     * @param {string} assetInfo.fileName - The file name of the image
     * @param {string} assetInfo.relativePath - The path relative to the image directory for the image
     */
    async uploadNewAsset(assetInfo) {
        const asset = await this.createAsset({
            title: assetInfo.title,
            description: assetInfo.description,
            fileType: assetInfo.fileType,
            fileName: assetInfo.fileName
        });
        await this.uploadAssetImage({
            fileName: assetInfo.fileName,
            assetId: asset.sys.id,
            relativePath: assetInfo.relativePath
        })
        return;
    }

    /**
     * Creates a contentful asset
     * @param {object} assetInfo 
     * @param {string} assetInfo.title - The title for the contentful image
     * @param {string} assetInfo.fileName - The file name of the image
     */
    async createAsset(assetInfo) {
        return await this.environment.createAsset({
            fields: {
              title: {
                'en-US': assetInfo.title
              },
              description: {
                'en-US': assetInfo.description || ''
              },
              file: {
                'en-US': {
                  contentType: 'image/jpg',
                  fileName: assetInfo.fileName
                }
              }
            }
        })
    }

    /**
     * Uploads an image to an existing asset file in contentful
     * @param {object} imageInfo
     * @param {string} imageInfo.fileName - The file name of the image
     * @param {string} imageInfo.assetId - The id of the asset the image is for
     * @param {string} imageInfo.relativePath - The path relative to the image directory for the image
     */
    async uploadAssetImage(imageInfo) {
        return new Promise(async (resolve, reject) => {
            try {
                const upload = await this.uploadImage(imageInfo);
                const asset = await this.environment.getAsset(imageInfo.assetId);
                asset.fields.file['en-US'].uploadFrom = {
                    sys: {
                      type: 'Link',
                      linkType: 'Upload',
                      id: upload.sys.id
                    }
                }
                await asset.update();
                await asset.processForLocale('en-US', { processingCheckWait: 2000 });
            } catch(e) {
                return reject(e);
            }
            return resolve();
        })
    }

    /**
     * Uploads an image to contentful
     * @param {string} imageInfo.fileName - The file name of the image
     * @param {string} imageInfo.assetId - The id of the asset the image is for
     * @param {string} imageInfo.relativePath - The path relative to the image directory for the image
     */
    async uploadImage(imageInfo) {
        return new Promise((resolve, reject) => {
            let imageDataBufs = [];
            const fullPath = path.join(this.app.config.assetDirectory, imageInfo.relativePath);

            const fsStream = fs.createReadStream(fullPath);

            let uploadData = {};
            let imageIdUpdated = false;

            const contentfulStream = request.post({
                url: `https://upload.contentful.com/spaces/${this.app.config.contentfulSpaceId}/uploads`,
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Authorization": `Bearer ${this.app.config.contentfulAccessToken}`
                }
            }, (err, resp, body) => {
                console.log(body)
                if(err) return reject(err);
                uploadData = JSON.parse(body);
                return resolve(uploadData);
            });

            const imageStream = new PassThrough();
            fsStream.pipe(contentfulStream);
            fsStream.pipe(imageStream);

            imageStream.on('data', (chunk) => {
                imageDataBufs.push(chunk);
            }).on('end', async () => {
                const image = await new Image(Object.assign({}, {
                    path: fullPath,
                    relativePath: imageInfo.relativePath,
                    fileName: imageInfo.fileName,
                    data: Buffer.concat(imageDataBufs).toString('binary')
                }));
                await image.setContentfulImageId(imageInfo.assetId);
            });

        })
    }
}

module.exports = Contentful;