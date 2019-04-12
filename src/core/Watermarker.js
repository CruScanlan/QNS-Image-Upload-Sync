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


    async watermarkImage(imageInfo) {
        const baseImageData = await this.readImage(imageInfo.path);

        const baseImage = await Jimp.read(Buffer.from(baseImageData));
        const watermarkImage = await Jimp.read(path.join(__dirname, '../assets/Watermark.png'));

        if(baseImage.bitmap.width >= baseImage.bitmap.height) watermarkImage.resize(0.387*baseImage.bitmap.width, Jimp.AUTO); //Landscape or square
        else watermarkImage.resize(0.749*baseImage.bitmap.width, Jimp.AUTO);

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