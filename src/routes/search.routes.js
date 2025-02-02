const { Router } = require("express");
const verifyJWT = require("../middlewares/auth.middleware");
const {
  searchUsers,
  searchPosts,
} = require("../controllers/search.controller");
const router = Router();

router.route("/users").post(verifyJWT, searchUsers);
router.route("/posts").post(verifyJWT, searchPosts);

module.exports = router;
