const contentful = require('contentful-management');
const path = require('path');
const request = require('request');
const Image = require('core/Image');

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
        this.app.logger.info('Starting Contentful Connection');

        this.space = await this.client.getSpace(this.app.config.contentfulSpaceId);

        this.environment = await this.space.getEnvironment('master');

        this.currentAssets = await this.getAssets();
        
        this.app.logger.info('Started Contentful Connection');
    }

    /**
     * Gets assets from contentful
     */
    async getAssets() {
        const assets = await this.environment.getAssets();
        return assets.items;
    }

    /**
     * Updates an assets name an description based off asset id
     */
    async updateAssetNameDescription({name, description, contentfulImageId}) {
        const asset = await this.environment.getAsset(contentfulImageId);
        if(!asset) return;
        asset.fields.title['en-US'] = name;
        asset.fields.description['en-US'] = description;
        await asset.update();
    }

    /**
     * Deletes an asset from contentful based off id
     * @param {string} contentfulImageId
     */
    async deleteAsset(contentfulImageId) {
        const asset = await this.environment.getAsset(contentfulImageId);
        if(!asset) return;
        await asset.delete();
    }

    /**
     * Create, upload and watermark a new asset
     * @param {object} assetInfo 
     * @param {string} assetInfo.title - The title for the contentful image
     * @param {string} assetInfo.fileName - The file name of the image
     * @param {string} assetInfo.relativePath - The path relative to the image directory for the image
     */
    async uploadWatermarkNewAsset(assetInfo) {
        return new Promise(async (resolve) => {
            const fullPath = path.join(this.app.config.assetDirectory, assetInfo.relativePath);

            const [asset, watermarkedImageInfo] = await Promise.all([
                this.createAsset({
                    title: assetInfo.title,
                    description: assetInfo.description,
                    fileName: assetInfo.fileName
                }),
                this.app.watermarker.watermarkImage({
                    fileName: assetInfo.fileName,
                    path: fullPath,
                    relativePath: assetInfo.relativePath
                })
            ])

            const originalImage = await Image.build({
                path: fullPath,
                relativePath: assetInfo.relativePath,
                fileName: assetInfo.fileName,
                data: watermarkedImageInfo.originalImageData
            });
    
            const watermarkedImage = await Image.build({
                path: watermarkedImageInfo.path,
                relativePath: watermarkedImageInfo.relativePath,
                fileName: watermarkedImageInfo.fileName,
                data: watermarkedImageInfo.watermarkedImageData
            });

            this.app.fileManager.currentImageFileListDisk.find(diskAsset => diskAsset.contentfulImageId === originalImage._contentfulImageId).contentfulImageId = asset.sys.id; //change the contentful image id in disk cache

            await Promise.all([
                originalImage.setContentfulImageId(asset.sys.id),
                watermarkedImage.setContentfulImageId(asset.sys.id),
                this.uploadAssetImage({
                    fileName: watermarkedImageInfo.fileName,
                    assetId: asset.sys.id,
                    relativePath: watermarkedImageInfo.relativePath,
                    data: watermarkedImageInfo.watermarkedImageData
                })
            ]);
    
            return resolve(asset.sys.id);
        })
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
                const upload = await this.uploadImageWatermarked(imageInfo);
                const asset = await this.environment.getAsset(imageInfo.assetId);
                asset.fields.file['en-US'].contentType = 'image/jpg';
                asset.fields.file['en-US'].fileName = imageInfo.fileName;
                delete asset.fields.file['en-US'].url;
                delete asset.fields.file['en-US'].details;
                asset.fields.file['en-US'].uploadFrom = {
                    sys: {
                      type: 'Link',
                      linkType: 'Upload',
                      id: upload.sys.id
                    }
                }
                await asset.update();
                await asset.processForLocale('en-US', { processingCheckWait: 2000});
            } catch(e) {
                return reject(e);
            }
            return resolve();
        })
    }

    /**
     * Uploads a watermarked image to contentful
     * @param {string} imageInfo.fileName - The file name of the image
     * @param {string} imageInfo.assetId - The id of the asset the image is for
     * @param {string} imageInfo.relativePath - The path relative to the image directory for the image
     * @param {string} imageInfo.data - The image data
     */
    async uploadImageWatermarked(imageInfo) {
        return new Promise((resolve, reject) => {
            request.post({
                url: `https://upload.contentful.com/spaces/${this.app.config.contentfulSpaceId}/uploads`,
                body: imageInfo.data,
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Authorization": `Bearer ${this.app.config.contentfulAccessToken}`
                }
            }, (err, resp, body) => {
                if(err) return reject(err);
                return resolve(JSON.parse(body));
            });
        })
    }
}

module.exports = Contentful;