const piexif = require('piexifjs');
const fs = require('fs');

class Image {
    /**
     * Handles reading an image from disk and storing all relevent info
     * @param {Object} imageInfo 
     */
    constructor(imageInfo) {
        if(typeof imageInfo === 'undefined') throw new Error('Cannot be called directly, use build');

        /**
         * An images file name
         * @type {string}
         */
        this.fileName = imageInfo.fileName;

        /**
         * An images full file path
         * @type {string}
         */
        this.path = imageInfo.path;

        /**
         * The path relative to the file mangagers ssearch directory
         * @type {string}
         */
        this.relativePath = imageInfo.relativePath;

        console.log(this.fileName, imageInfo.data)

        /**
         * The image data for an image in string form
         * @type {string}
         */
        this._data = imageInfo.data.toString('binary');

        /**
         * The exif meta data for an image
         * @type {object}
         */
        this._exif = piexif.load(this._data);

        /**
         * The contentful image id for an image
         * @type {string}
         */
        this._contentfulImageId = this._getContentfulImageIdFromExif();
    }

    /**
     * Build the class asyncronously
     * @param {object} imageInfo 
     * @return {Image}
     */
    static async build(imageInfo) {
        return new Promise(async (resolve) => {
            if(!imageInfo.data) imageInfo.data = await this.getImageDataFromDisk(imageInfo.path);
            resolve(new Image(imageInfo));
        })
    }
    
    /**
     * Gets the image data from disk
     * @param {string} path 
     * @return {promise}
     */
    static async getImageDataFromDisk(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, (err, data) => {
                if(err) throw err; //TODO: log error properly
                resolve(data);
            });
        });
    }

    /**
     * Writes the image data to disk
     */
    async _writeImageDataToDisk() {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.path, this._data, 'binary', (err) => {
                if(err) throw err; //TODO: log error properly
                resolve();
            });
        });
    }

    /**
     * Sets the contentful image id on an image's meta data
     * @param {string} id 
     * @return {void}
     */
    async setContentfulImageId(id) {
        const commentArr = [99,0,111,0,110,0,116,0,101,0,110,0,116,0,102,0,117,0,108,0,73,0,109,0,97,0,103,0,101,0,73,0,100,0,45,0];
        for(let i=0; i<id.length; i++) {
            commentArr.push(id.charCodeAt(i), 0);
        }
        this._exif['0th']['40092'] = commentArr;
        this.contentfulImageId = this._getContentfulImageIdFromExif();
        this._writeExifToImageData();
        return this._writeImageDataToDisk();
    }

    /**
     * Writes the exif data to the images data
     */
    _writeExifToImageData() {
        const exifStr = piexif.dump(this._exif);
        this._data = piexif.remove(this._data);
        this._data = piexif.insert(exifStr, this._data);
    }

    /**
     * Gets the contentful image id from an images meta data
     * @return {string} contentfulImageId
     */
    _getContentfulImageIdFromExif() {
        let commentArr = this._exif['0th']['40092'];
        if(!commentArr) return '';
        commentArr = commentArr.filter(val => val !== 0); //remove null bytes
        const commentString = String.fromCharCode(...commentArr);

        if(commentString.startsWith('contentfulImageId-')) return commentString.substring(18, commentString.length);
        return '';
    }
}

module.exports = Image;