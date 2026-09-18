// GridFS storage engine setup for file uploads (papers, datasets, results)
// Configure multer-gridfs-storage here and export the bucket/storage instance
const mongoose = require("mongoose");

let bucket;

/**
 * Returns a singleton GridFSBucket tied to the active mongoose connection.
 * Lazily created on first use (by the time any request comes in, the
 * connection is already established since server.js awaits connectDB first).
 */
const getBucket = () => {
  if (!bucket) {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });
  }
  return bucket;
};

module.exports = { getBucket };