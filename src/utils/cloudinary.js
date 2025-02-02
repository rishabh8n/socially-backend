const { v2 } = require("cloudinary");
const fs = require("fs");

v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloud = async (filePath) => {
  try {
    if (!filePath) {
      return null;
    }
    const response = await v2.uploader.upload(filePath, {
      resource_type: "auto",
      transformation: [{ width: 500, height: 500, crop: "limit" }],
    });
    fs.unlinkSync(filePath);
    return response;
  } catch (error) {
    fs.unlinkSync(filePath);
  }
};

const deleteFromCloud = async (url) => {
  try {
    if (!url) {
      return null;
    }
    const publicId = url.split("/").pop().split(".")[0];
    const response = await v2.uploader.destroy(publicId);
    return response;
  } catch (error) {
    return null;
  }
};

module.exports = { uploadOnCloud, deleteFromCloud };
