module.exports = {
    apps : [
        {
          name: "QNS-Image-Upload-Sync",
          script: "./src/index.js",
          watch: false,
          env: {
            "NODE_ENV": "production",
          }
        }
    ]
  }
  