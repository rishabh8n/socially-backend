const { Router } = require("express");
const verifyJWT = require("../middlewares/auth.middleware");
const {
  getProfile,
  followUser,
  unfollowUser,
  updateAvatar,
  updateProfile,
  usernameAvailable,
  getFollowers,
  getFollowing,
} = require("../controllers/profile.controller");
const { upload } = require("../middlewares/multer");

const router = Router();

router.route("/:username").get(verifyJWT, getProfile);
router.route("/follow").post(verifyJWT, followUser);
router.route("/unfollow").post(verifyJWT, unfollowUser);
router
  .route("/update-avatar")
  .put(verifyJWT, upload.single("avatar"), updateAvatar);
router.route("/update-profile").put(verifyJWT, updateProfile);
router.route("/username-available").post(verifyJWT, usernameAvailable);
router.route("/:username/followers").get(verifyJWT, getFollowers);
router.route("/:username/following").get(verifyJWT, getFollowing);
module.exports = router;
