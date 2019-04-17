const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');


class Watermarker  {
    constructor(App) {
        /**
         * The app for the file manager
         */
        Object.defineProperty(this, 'app', {value: App});
    }


    /**
     * Saves a watermark of an image
     * @param {object} imageInfo
     * @param {string} imageInfo.path - The path of the file
     * @param {string} imageInfo.fileName - The file name of the image
     * @param {string} imageInfo.relativePath - The path relative to the image directory for the image
     */
    async watermarkImage(imageInfo) {
        const baseImageData = await this.readImage(imageInfo.path);

        const baseImage = await Jimp.read(Buffer.from(baseImageData));
        const watermarkImage = await Jimp.read(path.join(__dirname, '../assets/Watermark.png'));

        if(baseImage.bitmap.width >= baseImage.bitmap.height) watermarkImage.resize(0.387*baseImage.bitmap.width, Jimp.AUTO); //Resize for square or landscape image
        else watermarkImage.resize(0.749*baseImage.bitmap.width, Jimp.AUTO); //Resize for portrait image

        const newRelativePath = `/watermarked${imageInfo.relativePath.substring(0, imageInfo.relativePath.length-4)}-watermarked.jpg`;
        const newFileName = `${imageInfo.fileName.substring(0, imageInfo.fileName.length-4)}-watermarked.jpg`;

        await baseImage.composite(watermarkImage, 
            baseImage.bitmap.width-watermarkImage.bitmap.width, 
            baseImage.bitmap.height-watermarkImage.bitmap.height
            ).quality(88).writeAsync(path.join(this.app.config.assetDirectory, newRelativePath));

        const watermarkedImageData = await baseImage.getBufferAsync(Jimp.MIME_JPEG);

        return {
            originalImageData: baseImageData,
            watermarkedImageData,
            path: path.join(this.app.config.assetDirectory, newRelativePath),
            relativePath: newRelativePath,
            fileName: newFileName
        }
    }

    /**
     * Reads an image from disk
     * @param {string} path 
     */
    readImage(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, (err, data) => {
                if(err) throw err; //TODO: log error properly
                resolve(data);
            });
        });
    }
}

module.exports = Watermarker;