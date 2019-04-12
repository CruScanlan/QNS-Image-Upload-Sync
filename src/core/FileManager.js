const fs = require('fs');
const watch = require('node-watch');
const { EventEmitter } = require('events');
const Image = require('models/Image');

class FileManager extends EventEmitter{
    constructor(App) {
        super();

        /**
         * The app for the file manager
         */
        Object.defineProperty(this, 'app', {value: App});

        this.currentImageFileListDisk = [];

    }

    async init() {
        console.log('Starting File Manager');

        await this.populateDiskImageFileList();
        await this._startWatchingFileChanges();

        console.log('Started File Manager');
    }

    async _startWatchingFileChanges() {
        return new Promise((resolve) => {
            watch(this.app.config.assetDirectory, {
                persistent: true, 
                recursive: true,
                filter: name => name.endsWith('.jpg')
            }, async (event, file) => {
                file = file.split('\\').join('/');
    
                const imageInfo = {
                    path: file,
                    relativePath: file.substring(this.app.config.assetDirectory.length, file.length),
                    fileName: file.substring(file.lastIndexOf('/')+1, file.length)
                }
                return;
                const image = await Image.build(Object.assign({}, imageInfo));
                const eventType = event === 'update' ? 'fileUpdate' : 'fileDelete';
    
                if(image._contentfulImageId === '' && eventType === 'update') {
                    this.currentImageFileListDisk.push({
                        ...imageInfo,
                        contentfulImageId: image._contentfulImageId
                    });
                    return this.emit(eventType, image);
                }
    
                for(let i=0; i<this.currentImageFileListDisk.length; i++) {
                    if(this.currentImageFileListDisk[i].contentfulImageId === image._contentfulImageId) {
                        if(eventType === "fileUpdate") this.currentImageFileListDisk.splice(i, 1, {...imageInfo, contentfulImageId: image._contentfulImageId});
                        else this.currentImageFileListDisk.splice(i, 1);
                        this.emit(eventType, image);
                    }
                }
            }).on('ready', () => {
                console.log('Started watching for file changes');
                resolve();
            })
        })
    }

    async populateDiskImageFileList() {
        this.currentImageFileListDisk = await this.getImageFileList(this.app.config.assetDirectory, '');
        console.log(`Disk Image File List Populated With ${this.currentImageFileListDisk.length} Images`);
        return;
    }

    async getImageFileList(searchPath, relativePath) {
        let images = [];
        let data;
        try {
            data = await this.readDir(searchPath);
        } catch(e) {
            throw e;
        }

        for(let i=0; i<data.length; i++) {
            const item = data[i];
            if(images.length > 4) continue;
            if(item.indexOf('.') !== -1) {
                if(item.endsWith('.jpg') && item.startsWith('$')) {
                    const imageInfo = {
                        path: `${searchPath}/${item}`,
                        relativePath: `${relativePath}/${item}`,
                        fileName: item
                    };
                    //Use object assign to copy variables and allow the image data to be garbage collected
                    const image = await Image.build(Object.assign({}, imageInfo));
                    images.push(Object.assign({}, imageInfo, {
                        contentfulImageId: image._contentfulImageId
                    }));
                }
                continue;
            }
            if(relativePath === '' && item === 'watermarked') continue;
            images.push(...await this.getImageFileList(`${searchPath}/${item}`, `${relativePath}/${item}`));
        }
        return images;
    }

    async readDir(path) {
        return new Promise((resolve, reject) => {
            fs.readdir(path, (err, data) => {
                if(err) return reject(err);
                return resolve(data);
            });
        })
    }
}

module.exports = FileManager;